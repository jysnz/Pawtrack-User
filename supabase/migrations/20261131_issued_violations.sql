-- Violations an admin records against a person (a guardian) for breaking the ordinance.
-- Admins (anyone who manages a facility) issue them through issue_violation(); a guardian can only read their own.
-- The offense number (1st, 2nd, 3rd...) and the fine are worked out here, not trusted from the browser.

create table if not exists public.violations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.guardians(id) on delete cascade,
  owner_name text check (owner_name is null or char_length(owner_name) <= 120),
  rule_id text not null check (char_length(rule_id) <= 40),
  rule_name text not null check (char_length(rule_name) <= 200),
  section text not null check (char_length(section) <= 80),
  pet_name text check (pet_name is null or char_length(pet_name) <= 120),
  offense int not null check (offense >= 1),
  fine_php int not null check (fine_php >= 0),
  reason text not null check (char_length(reason) <= 1000),
  issued_by uuid references auth.users(id) on delete set null,
  issued_by_name text check (issued_by_name is null or char_length(issued_by_name) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists violations_owner_idx on public.violations (owner_id, created_at desc);
alter table public.violations enable row level security;
revoke all on public.violations from anon;
revoke insert, update, delete on public.violations from authenticated;

drop policy if exists "Guardians read their own violations" on public.violations;
create policy "Guardians read their own violations" on public.violations
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "Admins read all violations" on public.violations;
create policy "Admins read all violations" on public.violations
  for select to authenticated
  using (cardinality(coalesce((select private.my_facility_ids()), array[]::uuid[])) > 0);

-- Find a person to issue a violation to (admins only; at most 20 matches)
create or replace function public.find_guardians(p_query text)
returns table (id uuid, full_name text, email text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if cardinality(coalesce(private.my_facility_ids(), array[]::uuid[])) = 0 then
    raise exception 'Only a facility admin can look up people';
  end if;
  return query
    select g.id, g.full_name, g.email
    from public.guardians g
    where char_length(btrim(coalesce(p_query, ''))) >= 2
      and (g.full_name ilike '%' || btrim(p_query) || '%' or g.email ilike '%' || btrim(p_query) || '%')
    order by g.full_name
    limit 20;
end $$;

-- p_ladder: the fine for the 1st, 2nd, 3rd... offense of this rule; the last step applies to every offense after.
create or replace function public.issue_violation(
  p_owner uuid, p_rule_id text, p_rule_name text, p_section text,
  p_ladder int[], p_reason text, p_pet_name text default null
) returns public.violations
language plpgsql security definer set search_path = ''
as $$
declare
  v_offense int;
  v_fine int;
  v_row public.violations%rowtype;
  v_admin text;
  v_owner text;
begin
  if cardinality(coalesce(private.my_facility_ids(), array[]::uuid[])) = 0 then
    raise exception 'Only a facility admin can issue a violation';
  end if;
  select coalesce(nullif(btrim(g.full_name), ''), g.email) into v_owner from public.guardians g where g.id = p_owner;
  if not found then
    raise exception 'That person was not found';
  end if;
  if p_ladder is null or cardinality(p_ladder) = 0 then
    v_fine := 0;
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Say what the person did';
  end if;

  select count(*) + 1 into v_offense from public.violations where owner_id = p_owner and rule_id = p_rule_id;
  if p_ladder is not null and cardinality(p_ladder) > 0 then
    v_fine := greatest(p_ladder[least(v_offense, cardinality(p_ladder))], 0);
  end if;
  select nullif(btrim(g.full_name), '') into v_admin from public.guardians g where g.id = auth.uid();

  insert into public.violations (owner_id, owner_name, rule_id, rule_name, section, pet_name, offense, fine_php, reason, issued_by, issued_by_name)
  values (p_owner, v_owner, p_rule_id, left(p_rule_name, 200), left(p_section, 80), nullif(left(btrim(coalesce(p_pet_name, '')), 120), ''),
          v_offense, v_fine, left(btrim(p_reason), 1000), auth.uid(), v_admin)
  returning * into v_row;

  insert into public.notifications (recipient_id, type, title, message, pet_name)
  values (p_owner, 'system', left('VIOLATION: ' || p_rule_name, 200),
          'A ' || p_section || ' violation was recorded on your account: ' || v_offense || ' offense'
            || case when v_fine > 0 then ', fine PHP ' || v_fine else '' end
            || '. ' || left(btrim(p_reason), 600) || ' You are directed to report to the City Veterinary Department.',
          nullif(btrim(coalesce(p_pet_name, '')), ''));
  return v_row;
end $$;

revoke all on function public.find_guardians(text) from public, anon;
revoke all on function public.issue_violation(uuid, text, text, text, int[], text, text) from public, anon;
grant execute on function public.find_guardians(text) to authenticated;
grant execute on function public.issue_violation(uuid, text, text, text, int[], text, text) to authenticated;
