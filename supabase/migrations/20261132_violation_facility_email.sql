-- A violation now records the impoundment facility that issued it (shown as the sender of the email to the person)
-- and when that email went out (so one violation sends at most one email).

alter table public.violations
  add column if not exists shelter_id uuid references public.shelters(id) on delete set null,
  add column if not exists email_sent_at timestamptz;

drop function if exists public.issue_violation(uuid, text, text, text, int[], text, text);

create or replace function public.issue_violation(
  p_owner uuid, p_rule_id text, p_rule_name text, p_section text,
  p_ladder int[], p_reason text, p_pet_name text default null, p_shelter uuid default null
) returns public.violations
language plpgsql security definer set search_path = ''
as $$
declare
  v_ids uuid[] := coalesce(private.my_facility_ids(), array[]::uuid[]);
  v_shelter uuid;
  v_offense int;
  v_fine int := 0;
  v_row public.violations%rowtype;
  v_admin text;
  v_owner text;
begin
  if cardinality(v_ids) = 0 then
    raise exception 'Only a facility admin can issue a violation';
  end if;
  v_shelter := coalesce(p_shelter, v_ids[1]);
  if not (v_shelter = any (v_ids)) then
    raise exception 'That facility is not yours';
  end if;
  select coalesce(nullif(btrim(g.full_name), ''), g.email) into v_owner from public.guardians g where g.id = p_owner;
  if not found then
    raise exception 'That email or person does not exist in PawTrack';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Say what the person did';
  end if;

  select count(*) + 1 into v_offense from public.violations where owner_id = p_owner and rule_id = p_rule_id;
  if p_ladder is not null and cardinality(p_ladder) > 0 then
    v_fine := greatest(p_ladder[least(v_offense, cardinality(p_ladder))], 0);
  end if;
  select nullif(btrim(g.full_name), '') into v_admin from public.guardians g where g.id = auth.uid();

  insert into public.violations (owner_id, owner_name, rule_id, rule_name, section, pet_name, offense, fine_php, reason, issued_by, issued_by_name, shelter_id)
  values (p_owner, v_owner, p_rule_id, left(p_rule_name, 200), left(p_section, 80), nullif(left(btrim(coalesce(p_pet_name, '')), 120), ''),
          v_offense, v_fine, left(btrim(p_reason), 1000), auth.uid(), v_admin, v_shelter)
  returning * into v_row;

  insert into public.notifications (recipient_id, type, title, message, pet_name)
  values (p_owner, 'system', left('VIOLATION: ' || p_rule_name, 200),
          'A ' || p_section || ' violation was recorded on your account: offense no. ' || v_offense
            || case when v_fine > 0 then ', fine PHP ' || v_fine else '' end
            || '. ' || left(btrim(p_reason), 600) || ' You are directed to report to the City Veterinary Department.',
          nullif(btrim(coalesce(p_pet_name, '')), ''));
  return v_row;
end $$;

revoke all on function public.issue_violation(uuid, text, text, text, int[], text, text, uuid) from public, anon;
grant execute on function public.issue_violation(uuid, text, text, text, int[], text, text, uuid) to authenticated;

-- The person search also returns their profile picture, so the admin can see who they are picking
drop function if exists public.find_guardians(text);
create or replace function public.find_guardians(p_query text)
returns table (id uuid, full_name text, email text, avatar_url text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if cardinality(coalesce(private.my_facility_ids(), array[]::uuid[])) = 0 then
    raise exception 'Only a facility admin can look up people';
  end if;
  return query
    select g.id, g.full_name, g.email, g.avatar_url
    from public.guardians g
    where char_length(btrim(coalesce(p_query, ''))) >= 2
      and (g.full_name ilike '%' || btrim(p_query) || '%' or g.email ilike '%' || btrim(p_query) || '%')
    order by g.full_name
    limit 20;
end $$;
revoke all on function public.find_guardians(text) from public, anon;
grant execute on function public.find_guardians(text) to authenticated;
