-- Impound facilities have staff: an admin account belongs to ONE facility, and a facility has MANY accounts.
--
--   admin_accounts.shelter_id / facility_role   which facility the account works for, and whether it is the
--                                               'manager' or ordinary 'staff'
--   register_facility(p)                        the first staff member registers their facility and becomes its manager
--   join_facility(code)                         later staff join with the invite code their manager shares
--   rotate_facility_invite / remove_facility_staff / set_facility_role / leave_facility    team management
--   shelters                                    everyone can still see every facility (public map); only its manager edits it
--   impounded_pets                              staff can only log or change impounds that belong to their own facility
--   impounded_pets.created_by                   which account logged each intake
--
-- Membership is changed ONLY through the functions below. The admin_accounts triggers reject a direct update,
-- because authenticated users can otherwise edit their own row and could put themselves in any facility.
--
-- Existing shelters have no manager. To attach an admin yourself (SQL editor / service role):
--   update public.admin_accounts set shelter_id = '<shelter id>', facility_role = 'manager' where email = '<admin email>';

-- ---------- shared facility details (were kept per browser) ----------
alter table public.shelters
  add column if not exists capacity int not null default 50 check (capacity between 1 and 500),
  add column if not exists officer_in_charge text check (officer_in_charge is null or char_length(officer_in_charge) <= 120),
  add column if not exists city text check (city is null or char_length(city) <= 120),
  add column if not exists facility_type text check (facility_type is null or char_length(facility_type) <= 80);

-- ---------- membership ----------
alter table public.admin_accounts
  add column if not exists shelter_id uuid references public.shelters(id),
  add column if not exists facility_role text check (facility_role in ('manager', 'staff'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admin_accounts_facility_membership') then
    alter table public.admin_accounts
      add constraint admin_accounts_facility_membership
      check ((shelter_id is null and facility_role is null) or (shelter_id is not null and facility_role is not null));
  end if;
end $$;

create index if not exists admin_accounts_shelter_idx on public.admin_accounts (shelter_id);

alter table public.impounded_pets
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

-- ---------- invite codes (separate table: shelters is public, codes must not be) ----------
create table if not exists public.facility_invites (
  shelter_id uuid primary key references public.shelters(id) on delete cascade,
  code text not null unique,
  rotated_at timestamptz not null default now()
);
alter table public.facility_invites enable row level security;
revoke all on public.facility_invites from anon;

-- ---------- helpers ----------
create or replace function private.new_invite_code()
returns text language sql volatile set search_path = ''
as $$ select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)) $$;

-- The facility the signed-in, approved admin works for (null when none)
create or replace function private.my_shelter_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select shelter_id from public.admin_accounts
  where id = (select auth.uid()) and status = 'approved';
$$;

-- Same, but only when they are its manager
create or replace function private.my_manager_shelter_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select shelter_id from public.admin_accounts
  where id = (select auth.uid()) and status = 'approved' and facility_role = 'manager';
$$;

-- ---------- keep membership out of direct updates ----------
create or replace function private.admin_accounts_before_insert()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is not null then
    new.id := (select auth.uid());
    new.email := lower(coalesce((select auth.jwt()) ->> 'email', ''));
    new.shelter_id := null;      -- membership is granted through register_facility / join_facility only
    new.facility_role := null;
  end if;
  new.email := lower(new.email);
  if new.email = '' then
    raise exception 'Your account has no email address';
  end if;
  if new.birth_date is null
     or new.birth_date > ((now() at time zone 'Asia/Manila')::date - interval '18 years')::date then
    raise exception 'Admins must be at least 18 years old';
  end if;
  new.created_at := now();
  new.updated_at := now();
  if exists (select 1 from private.admin_bootstrap_emails where email = new.email) then
    new.status := 'approved';
    new.reviewed_by := new.id;
    new.reviewed_at := now();
  else
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$function$;

create or replace function private.admin_accounts_before_update()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  new.updated_at := now();
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.id <> old.id or new.email <> old.email or new.created_at <> old.created_at then
    raise exception 'Account identity cannot be changed';
  end if;
  if (new.shelter_id is distinct from old.shelter_id or new.facility_role is distinct from old.facility_role)
     and coalesce(current_setting('pawtrack.facility_rpc', true), '') <> '1' then
    raise exception 'Facility membership can only be changed through the facility functions';
  end if;
  if new.birth_date is distinct from old.birth_date then
    if old.birth_date is not null
       or new.birth_date is null
       or new.birth_date > ((now() at time zone 'Asia/Manila')::date - interval '18 years')::date then
      raise exception 'Birth date cannot be changed';
    end if;
  end if;
  if new.status is distinct from old.status then
    if not private.is_approved_admin() then
      raise exception 'Only approved admins can review access requests';
    end if;
    if old.id = (select auth.uid()) then
      raise exception 'You cannot change the status of your own account';
    end if;
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  else
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end;
$function$;

-- ---------- facility functions ----------
-- The first staff member registers their facility and becomes its manager.
create or replace function public.register_facility(p jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  me public.admin_accounts%rowtype;
  new_id uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into me from public.admin_accounts where id = uid and status = 'approved' for update;
  if not found then raise exception 'Only approved admins can register a facility'; end if;
  if me.shelter_id is not null then raise exception 'Your account already belongs to a facility'; end if;
  if char_length(btrim(coalesce(p ->> 'name', ''))) < 2 or char_length(btrim(coalesce(p ->> 'address', ''))) < 2 then
    raise exception 'A facility needs a name and an address';
  end if;

  insert into public.shelters (name, address, phone, email, hours, lat, lng, daily_fee_php, holding_period_days,
                               capacity, officer_in_charge, city, facility_type)
  values (btrim(p ->> 'name'), btrim(p ->> 'address'),
          nullif(btrim(coalesce(p ->> 'phone', '')), ''), nullif(btrim(coalesce(p ->> 'email', '')), ''),
          nullif(btrim(coalesce(p ->> 'hours', '')), ''),
          (p ->> 'lat')::float8, (p ->> 'lng')::float8,
          coalesce(nullif(p ->> 'daily_fee_php', '')::int, 0), coalesce(nullif(p ->> 'holding_period_days', '')::int, 3),
          coalesce(nullif(p ->> 'capacity', '')::int, 50),
          nullif(btrim(coalesce(p ->> 'officer_in_charge', '')), ''), nullif(btrim(coalesce(p ->> 'city', '')), ''),
          nullif(btrim(coalesce(p ->> 'facility_type', '')), ''))
  returning id into new_id;

  insert into public.facility_invites (shelter_id, code) values (new_id, private.new_invite_code());

  perform set_config('pawtrack.facility_rpc', '1', true);
  update public.admin_accounts set shelter_id = new_id, facility_role = 'manager' where id = uid;
  return new_id;
end;
$$;

-- Later staff join with the invite code their manager shares.
create or replace function public.join_facility(p_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  me public.admin_accounts%rowtype;
  target uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into me from public.admin_accounts where id = uid and status = 'approved' for update;
  if not found then raise exception 'Only approved admins can join a facility'; end if;
  if me.shelter_id is not null then raise exception 'Your account already belongs to a facility'; end if;

  select shelter_id into target from public.facility_invites where code = upper(btrim(coalesce(p_code, '')));
  if target is null then raise exception 'That invite code is not valid'; end if;

  perform set_config('pawtrack.facility_rpc', '1', true);
  update public.admin_accounts set shelter_id = target, facility_role = 'staff' where id = uid;
  return target;
end;
$$;

-- Manager: replace the invite code (the old one stops working)
create or replace function public.rotate_facility_invite()
returns text language plpgsql security definer set search_path = ''
as $$
declare sid uuid := private.my_manager_shelter_id(); c text;
begin
  if sid is null then raise exception 'Only the facility manager can do this'; end if;
  update public.facility_invites set code = private.new_invite_code(), rotated_at = now()
  where shelter_id = sid returning code into c;
  if c is null then
    insert into public.facility_invites (shelter_id, code) values (sid, private.new_invite_code()) returning code into c;
  end if;
  return c;
end;
$$;

-- Manager: take someone off the team
create or replace function public.remove_facility_staff(p_admin uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare sid uuid := private.my_manager_shelter_id();
begin
  if sid is null then raise exception 'Only the facility manager can do this'; end if;
  if p_admin = (select auth.uid()) then raise exception 'Use "Leave facility" to remove yourself'; end if;
  perform set_config('pawtrack.facility_rpc', '1', true);
  update public.admin_accounts set shelter_id = null, facility_role = null where id = p_admin and shelter_id = sid;
  if not found then raise exception 'That person is not on your team'; end if;
end;
$$;

-- Manager: promote staff to manager (or step down while another manager remains)
create or replace function public.set_facility_role(p_admin uuid, p_role text)
returns void language plpgsql security definer set search_path = ''
as $$
declare sid uuid := private.my_manager_shelter_id();
begin
  if sid is null then raise exception 'Only the facility manager can do this'; end if;
  if p_role not in ('manager', 'staff') then raise exception 'Unknown role'; end if;
  if p_admin = (select auth.uid()) and p_role = 'staff'
     and not exists (select 1 from public.admin_accounts
                     where shelter_id = sid and facility_role = 'manager' and status = 'approved' and id <> p_admin) then
    raise exception 'Make someone else a manager before stepping down';
  end if;
  perform set_config('pawtrack.facility_rpc', '1', true);
  update public.admin_accounts set facility_role = p_role where id = p_admin and shelter_id = sid;
  if not found then raise exception 'That person is not on your team'; end if;
end;
$$;

-- Anyone on a team can leave; the last manager cannot (the facility would have nobody in charge)
create or replace function public.leave_facility()
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); me public.admin_accounts%rowtype;
begin
  select * into me from public.admin_accounts where id = uid for update;
  if not found or me.shelter_id is null then raise exception 'You are not part of a facility'; end if;
  if me.facility_role = 'manager'
     and not exists (select 1 from public.admin_accounts
                     where shelter_id = me.shelter_id and facility_role = 'manager' and status = 'approved' and id <> uid) then
    raise exception 'Make someone else a manager before you leave';
  end if;
  perform set_config('pawtrack.facility_rpc', '1', true);
  update public.admin_accounts set shelter_id = null, facility_role = null where id = uid;
end;
$$;

revoke all on function public.register_facility(jsonb), public.join_facility(text), public.rotate_facility_invite(),
  public.remove_facility_staff(uuid), public.set_facility_role(uuid, text), public.leave_facility() from public, anon;
grant execute on function public.register_facility(jsonb), public.join_facility(text), public.rotate_facility_invite(),
  public.remove_facility_staff(uuid), public.set_facility_role(uuid, text), public.leave_facility() to authenticated;

-- ---------- policies ----------
-- shelters: everyone reads; only a facility's manager edits it. Rows are created by register_facility, never deleted by clients.
drop policy if exists "Admins manage shelters" on public.shelters;
drop policy if exists "Admins add their own facility" on public.shelters;
drop policy if exists "Admins edit their own facility" on public.shelters;
drop policy if exists "Admins remove their own facility" on public.shelters;
drop policy if exists "Facility managers edit their facility" on public.shelters;

create policy "Facility managers edit their facility" on public.shelters
  for update to authenticated
  using (id = (select private.my_manager_shelter_id()))
  with check (id = (select private.my_manager_shelter_id()));

-- invite codes: only that facility's manager can read them
drop policy if exists "Managers see their invite code" on public.facility_invites;
create policy "Managers see their invite code" on public.facility_invites
  for select to authenticated
  using (shelter_id = (select private.my_manager_shelter_id()));

-- impounded_pets: any staff member of the facility manages its impounds, and only those
drop policy if exists "Admins manage impounded pets" on public.impounded_pets;
drop policy if exists "Admins manage their facility's impounds" on public.impounded_pets;
drop policy if exists "Staff manage their facility's impounds" on public.impounded_pets;

create policy "Staff manage their facility's impounds" on public.impounded_pets
  for all to authenticated
  using (shelter_id = (select private.my_shelter_id()))
  with check (shelter_id = (select private.my_shelter_id()));

-- ---------- existing facilities get an invite code (readable once an admin is made their manager) ----------
insert into public.facility_invites (shelter_id, code)
select id, private.new_invite_code() from public.shelters
on conflict (shelter_id) do nothing;
