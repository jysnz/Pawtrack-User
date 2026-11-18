-- Sub-facilities, and the 3-day hand-over of uncollected pets to the main facility.
--
--   shelters.parent_id              a facility can have sub-facilities (one level: a sub-facility has no sub-facilities)
--   create_sub_facility(p)          the MAIN facility's manager creates one; it gets its own invite code, and the
--                                   employees who join with that code work in that sub-facility only
--   visibility                      main facility staff see and manage the main facility AND all its sub-facilities;
--                                   sub-facility staff see and manage only their own
--   managers                        the main manager can edit sub-facilities, read their invite codes, rotate them,
--                                   and add / remove / re-role their employees
--   start_overdue_transfers()       a pet still uncollected at its sub-facility when its claim deadline passes (the
--                                   3-day holding window, plus any extension) is marked as being moved to the main
--                                   facility, and its guardian is told. Runs every 10 minutes (pg_cron) and whenever
--                                   the console syncs (run_overdue_transfers).
--   confirm_transfer_arrival(...)   the main facility answers a form: the pet arrived (it moves to the main facility
--                                   with a cage number and notes, and its holding window restarts) or did not arrive
--                                   (kept on record for follow-up).

-- ---------- structure ----------
alter table public.shelters
  add column if not exists parent_id uuid references public.shelters(id);
create index if not exists shelters_parent_idx on public.shelters (parent_id);

create or replace function private.shelters_check_parent()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'A facility cannot be its own sub-facility';
    end if;
    if exists (select 1 from public.shelters p where p.id = new.parent_id and p.parent_id is not null) then
      raise exception 'A sub-facility cannot have sub-facilities of its own';
    end if;
    if exists (select 1 from public.shelters c where c.parent_id = new.id) then
      raise exception 'A facility that has sub-facilities cannot become a sub-facility';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists shelters_check_parent on public.shelters;
create trigger shelters_check_parent before insert or update of parent_id on public.shelters
  for each row execute function private.shelters_check_parent();

alter table public.impounded_pets
  add column if not exists origin_shelter_id uuid references public.shelters(id),
  add column if not exists transfer_to_shelter_id uuid references public.shelters(id),
  add column if not exists transfer_status text check (transfer_status in ('pending', 'received', 'not_arrived')),
  add column if not exists transfer_started_at timestamptz,
  add column if not exists transfer_resolved_at timestamptz,
  add column if not exists transfer_resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists transfer_notes text check (transfer_notes is null or char_length(transfer_notes) <= 500);
create index if not exists impounded_pets_transfer_idx on public.impounded_pets (transfer_status) where transfer_status is not null;

-- ---------- who can reach which facilities ----------
-- The signed-in admin's own facility, plus its sub-facilities when it is a main facility
create or replace function private.my_facility_ids()
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select case when s.id is null then array[]::uuid[]
              else array[s.id] || coalesce((select array_agg(c.id) from public.shelters c where c.parent_id = s.id), array[]::uuid[]) end
  from public.admin_accounts a
  left join public.shelters s on s.id = a.shelter_id
  where a.id = (select auth.uid()) and a.status = 'approved';
$$;

-- The facilities this admin MANAGES: their own (as manager), and the sub-facilities when it is a main facility
create or replace function private.my_managed_shelter_ids()
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select array[s.id] || coalesce((select array_agg(c.id) from public.shelters c where c.parent_id = s.id), array[]::uuid[])
  from public.admin_accounts a
  join public.shelters s on s.id = a.shelter_id
  where a.id = (select auth.uid()) and a.status = 'approved' and a.facility_role = 'manager';
$$;

-- ---------- policies ----------
drop policy if exists "Staff manage their facility's impounds" on public.impounded_pets;
create policy "Staff manage their facility's impounds" on public.impounded_pets
  for all to authenticated
  using (shelter_id = any (coalesce((select private.my_facility_ids()), array[]::uuid[])))
  with check (shelter_id = any (coalesce((select private.my_facility_ids()), array[]::uuid[])));

drop policy if exists "Facility managers edit their facility" on public.shelters;
create policy "Facility managers edit their facility" on public.shelters
  for update to authenticated
  using (id = any (coalesce((select private.my_managed_shelter_ids()), array[]::uuid[])))
  with check (id = any (coalesce((select private.my_managed_shelter_ids()), array[]::uuid[])));

drop policy if exists "Managers see their invite code" on public.facility_invites;
create policy "Managers see their invite code" on public.facility_invites
  for select to authenticated
  using (shelter_id = any (coalesce((select private.my_managed_shelter_ids()), array[]::uuid[])));

-- ---------- sub-facility functions ----------
create or replace function public.create_sub_facility(p jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  sid uuid := private.my_manager_shelter_id();
  new_id uuid;
begin
  if sid is null then raise exception 'Only a facility manager can create a sub-facility'; end if;
  if exists (select 1 from public.shelters where id = sid and parent_id is not null) then
    raise exception 'A sub-facility cannot have sub-facilities of its own';
  end if;
  if char_length(btrim(coalesce(p ->> 'name', ''))) < 2 or char_length(btrim(coalesce(p ->> 'address', ''))) < 2 then
    raise exception 'A sub-facility needs a name and an address';
  end if;

  insert into public.shelters (name, address, phone, email, hours, lat, lng, daily_fee_php, holding_period_days,
                               capacity, officer_in_charge, city, facility_type, parent_id)
  values (btrim(p ->> 'name'), btrim(p ->> 'address'),
          nullif(btrim(coalesce(p ->> 'phone', '')), ''), nullif(btrim(coalesce(p ->> 'email', '')), ''),
          nullif(btrim(coalesce(p ->> 'hours', '')), ''),
          (p ->> 'lat')::float8, (p ->> 'lng')::float8,
          coalesce(nullif(p ->> 'daily_fee_php', '')::int, 0), coalesce(nullif(p ->> 'holding_period_days', '')::int, 3),
          coalesce(nullif(p ->> 'capacity', '')::int, 50),
          nullif(btrim(coalesce(p ->> 'officer_in_charge', '')), ''), nullif(btrim(coalesce(p ->> 'city', '')), ''),
          nullif(btrim(coalesce(p ->> 'facility_type', '')), ''), sid)
  returning id into new_id;

  insert into public.facility_invites (shelter_id, code) values (new_id, private.new_invite_code());
  return new_id;
end;
$$;

-- A manager replaces the invite code of their own facility, or of one of their sub-facilities
drop function if exists public.rotate_facility_invite();
create or replace function public.rotate_facility_invite(p_shelter uuid default null)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  target uuid := coalesce(p_shelter, private.my_manager_shelter_id());
  c text;
begin
  if target is null or not (target = any (coalesce(private.my_managed_shelter_ids(), array[]::uuid[]))) then
    raise exception 'Only the facility manager can do this';
  end if;
  update public.facility_invites set code = private.new_invite_code(), rotated_at = now()
  where shelter_id = target returning code into c;
  if c is null then
    insert into public.facility_invites (shelter_id, code) values (target, private.new_invite_code()) returning code into c;
  end if;
  return c;
end;
$$;

-- Managers (the main manager for sub-facilities too) take people off a team or change their role
create or replace function public.remove_facility_staff(p_admin uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare managed uuid[] := private.my_managed_shelter_ids();
begin
  if managed is null then raise exception 'Only the facility manager can do this'; end if;
  if p_admin = (select auth.uid()) then raise exception 'Use "Leave facility" to remove yourself'; end if;
  perform set_config('pawtrack.facility_rpc', '1', true);
  update public.admin_accounts set shelter_id = null, facility_role = null where id = p_admin and shelter_id = any (managed);
  if not found then raise exception 'That person is not on your team'; end if;
end;
$$;

create or replace function public.set_facility_role(p_admin uuid, p_role text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  managed uuid[] := private.my_managed_shelter_ids();
  uid uuid := (select auth.uid());
  own uuid := private.my_manager_shelter_id();
begin
  if managed is null then raise exception 'Only the facility manager can do this'; end if;
  if p_role not in ('manager', 'staff') then raise exception 'Unknown role'; end if;
  if p_admin = uid and p_role = 'staff'
     and not exists (select 1 from public.admin_accounts
                     where shelter_id = own and facility_role = 'manager' and status = 'approved' and id <> p_admin) then
    raise exception 'Make someone else a manager before stepping down';
  end if;
  perform set_config('pawtrack.facility_rpc', '1', true);
  update public.admin_accounts set facility_role = p_role where id = p_admin and shelter_id = any (managed);
  if not found then raise exception 'That person is not on your team'; end if;
end;
$$;

-- ---------- the 3-day hand-over ----------
create or replace function private.start_overdue_transfers()
returns int language plpgsql security definer set search_path = ''
as $$
declare
  n int := 0;
  r record;
begin
  for r in
    select i.id, i.pet_id, i.pet_name, i.shelter_id, s.parent_id, s.name as sub_name, m.name as main_name
    from public.impounded_pets i
    join public.shelters s on s.id = i.shelter_id and s.parent_id is not null
    join public.shelters m on m.id = s.parent_id
    where i.status = 'in_holding' and i.transfer_status is null and i.claim_deadline <= now()
    for update of i skip locked
  loop
    update public.impounded_pets
       set origin_shelter_id = r.shelter_id, transfer_to_shelter_id = r.parent_id,
           transfer_status = 'pending', transfer_started_at = now()
     where id = r.id;
    n := n + 1;

    if r.pet_id is not null then
      insert into public.notifications (recipient_id, type, title, message, pet_name, location)
      select p.owner_id, 'impound_alert', 'YOUR PET IS BEING MOVED',
             r.pet_name || ' was not collected from ' || r.sub_name || ' in time and is being moved to ' || r.main_name
               || '. Please contact ' || r.main_name || ' to claim your pet.',
             r.pet_name, r.main_name
      from public.registered_pets p
      where p.id = r.pet_id and p.owner_id is not null;
    end if;
  end loop;
  return n;
end;
$$;

-- The console runs this after every sync, so the hand-over never waits for the scheduler
create or replace function public.run_overdue_transfers()
returns int language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_approved_admin() then raise exception 'Only approved admins can do this'; end if;
  return private.start_overdue_transfers();
end;
$$;

-- The main facility answers the arrival form
create or replace function public.confirm_transfer_arrival(p_impound uuid, p_arrived boolean, p_cage text default null, p_notes text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  mine uuid := private.my_shelter_id();
  rec public.impounded_pets%rowtype;
  days int;
begin
  if mine is null then raise exception 'Only facility staff can confirm an arrival'; end if;
  select * into rec from public.impounded_pets where id = p_impound for update;
  if not found or rec.transfer_status is null or rec.transfer_status = 'received' then
    raise exception 'That pet has no transfer waiting for confirmation';
  end if;
  if rec.transfer_to_shelter_id is distinct from mine then
    raise exception 'Only the receiving facility can confirm this arrival';
  end if;
  if char_length(coalesce(p_notes, '')) > 500 then raise exception 'Notes are too long'; end if;

  if p_arrived then
    select holding_period_days into days from public.shelters where id = mine;
    update public.impounded_pets
       set shelter_id = mine, kennel = nullif(btrim(coalesce(p_cage, '')), ''),
           transfer_status = 'received', transfer_resolved_at = now(), transfer_resolved_by = uid,
           transfer_notes = nullif(btrim(coalesce(p_notes, '')), ''),
           claim_deadline = now() + make_interval(days => coalesce(days, 3))
     where id = p_impound;
  else
    update public.impounded_pets
       set transfer_status = 'not_arrived', transfer_resolved_at = now(), transfer_resolved_by = uid,
           transfer_notes = nullif(btrim(coalesce(p_notes, '')), '')
     where id = p_impound;
  end if;
end;
$$;

revoke all on function public.create_sub_facility(jsonb), public.rotate_facility_invite(uuid),
  public.run_overdue_transfers(), public.confirm_transfer_arrival(uuid, boolean, text, text) from public, anon;
grant execute on function public.create_sub_facility(jsonb), public.rotate_facility_invite(uuid),
  public.run_overdue_transfers(), public.confirm_transfer_arrival(uuid, boolean, text, text) to authenticated;
revoke all on function private.start_overdue_transfers() from public, anon, authenticated;
