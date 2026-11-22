-- A pet registered without an NFC tag is no longer fined automatically. Once 7 days pass without a tag, the owner's
-- device reports the pet here; an impoundment facility reviews it and decides whether it becomes a violation.
-- If it does, the person is emailed (notify-violation) and fined PHP 1,000 / 1,500 / 2,000 for the 1st / 2nd / 3rd offense.

create table if not exists public.nfc_flags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.guardians(id) on delete cascade,
  owner_name text,
  pet_id uuid not null references public.registered_pets(id) on delete cascade,
  pet_name text not null,
  pet_registered_on date,
  status text not null default 'pending' check (status in ('pending', 'violation', 'dismissed')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  violation_id uuid references public.violations(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (pet_id)
);
create index if not exists nfc_flags_status_idx on public.nfc_flags (status, created_at desc);

alter table public.nfc_flags enable row level security;
revoke all on public.nfc_flags from anon;
revoke insert, update, delete on public.nfc_flags from authenticated;

drop policy if exists "Guardians read their own flags" on public.nfc_flags;
create policy "Guardians read their own flags" on public.nfc_flags
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "Facility admins read flags" on public.nfc_flags;
create policy "Facility admins read flags" on public.nfc_flags
  for select to authenticated
  using (cardinality(coalesce((select private.my_facility_ids()), array[]::uuid[])) > 0);

-- The owner's device calls this once a pet has gone 7 days without a tag. The 7 days are checked here, not trusted.
create or replace function public.flag_unlinked_pet(p_pet uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_pet public.registered_pets%rowtype;
  v_name text;
  v_id uuid;
begin
  select * into v_pet from public.registered_pets where id = p_pet and owner_id = (select auth.uid());
  if not found then raise exception 'That is not your pet'; end if;
  if coalesce(btrim(v_pet.nfc_tag), '') <> '' then return null; end if;
  if v_pet.created_at > now() - interval '7 days' then return null; end if;
  select coalesce(nullif(btrim(g.full_name), ''), g.email) into v_name from public.guardians g where g.id = v_pet.owner_id;
  insert into public.nfc_flags (owner_id, owner_name, pet_id, pet_name, pet_registered_on)
  values (v_pet.owner_id, v_name, v_pet.id, v_pet.name, v_pet.registered_on)
  on conflict (pet_id) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- A facility decides: record the violation (offense and fine are worked out here) or dismiss the report.
create or replace function public.decide_nfc_flag(p_flag uuid, p_violate boolean, p_note text default null, p_shelter uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_ids uuid[] := coalesce(private.my_facility_ids(), array[]::uuid[]);
  v_flag public.nfc_flags%rowtype;
  v_viol public.violations%rowtype;
  v_pet_nfc text;
begin
  if cardinality(v_ids) = 0 then raise exception 'Only a facility admin can decide this'; end if;
  select * into v_flag from public.nfc_flags where id = p_flag and status = 'pending' for update;
  if not found then raise exception 'That report was already decided'; end if;
  select nfc_tag into v_pet_nfc from public.registered_pets where id = v_flag.pet_id;
  if p_violate and coalesce(btrim(v_pet_nfc), '') <> '' then
    p_violate := false; -- the owner linked a tag in the meantime
    p_note := coalesce(p_note, 'A tag was linked before the review.');
  end if;
  if p_violate then
    v_viol := public.issue_violation(
      v_flag.owner_id, 's35-1', 'Unregistered / no microchips', 'Section 35', array[1000, 1500, 2000],
      coalesce(nullif(btrim(p_note), ''), 'No NFC tag was linked to ' || v_flag.pet_name || ' within 7 days of registering it.'),
      v_flag.pet_name, p_shelter
    );
  end if;
  update public.nfc_flags
     set status = case when p_violate then 'violation' else 'dismissed' end,
         decided_by = (select auth.uid()), decided_at = now(), decision_note = nullif(btrim(p_note), ''),
         violation_id = case when p_violate then v_viol.id else null end
   where id = p_flag;
  return jsonb_build_object('violation_id', case when p_violate then v_viol.id else null end,
                            'offense', case when p_violate then v_viol.offense else null end,
                            'fine_php', case when p_violate then v_viol.fine_php else null end);
end $$;

revoke all on function public.flag_unlinked_pet(uuid) from public, anon;
revoke all on function public.decide_nfc_flag(uuid, boolean, text, uuid) from public, anon;
grant execute on function public.flag_unlinked_pet(uuid) to authenticated;
grant execute on function public.decide_nfc_flag(uuid, boolean, text, uuid) to authenticated;
