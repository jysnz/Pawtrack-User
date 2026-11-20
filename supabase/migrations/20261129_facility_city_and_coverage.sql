-- A facility belongs to a city (its map is limited to that city), and a sub-facility says which barangays it covers.
alter table public.shelters
  add column if not exists city_place_id text,
  add column if not exists city_bounds jsonb,
  add column if not exists coverage_barangays text[];

alter table public.shelters drop constraint if exists shelters_city_bounds_shape;
alter table public.shelters add constraint shelters_city_bounds_shape
  check (city_bounds is null or (city_bounds ? 'north' and city_bounds ? 'south' and city_bounds ? 'east' and city_bounds ? 'west'));

-- Helpers used by the three facility functions below
create or replace function private.facility_pin_in_bounds(lat float8, lng float8, b jsonb)
returns boolean language sql immutable set search_path = ''
as $$
  select b is null
      or (lat between (b ->> 'south')::float8 and (b ->> 'north')::float8
          and lng between (b ->> 'west')::float8 and (b ->> 'east')::float8);
$$;

create or replace function private.facility_barangays(p jsonb)
returns text[] language sql immutable set search_path = ''
as $$
  select coalesce(array(select distinct btrim(x) from jsonb_array_elements_text(coalesce(p -> 'coverage_barangays', '[]'::jsonb)) x where btrim(x) <> ''), '{}');
$$;

-- ---------- first registration ----------
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
  if not private.facility_pin_in_bounds((p ->> 'lat')::float8, (p ->> 'lng')::float8, p -> 'city_bounds') then
    raise exception 'The pin must be inside the facility''s city';
  end if;

  insert into public.shelters (name, address, phone, email, hours, lat, lng, daily_fee_php, holding_period_days,
                               capacity, officer_in_charge, city, facility_type, city_place_id, city_bounds)
  values (btrim(p ->> 'name'), btrim(p ->> 'address'),
          nullif(btrim(coalesce(p ->> 'phone', '')), ''), nullif(btrim(coalesce(p ->> 'email', '')), ''),
          nullif(btrim(coalesce(p ->> 'hours', '')), ''),
          (p ->> 'lat')::float8, (p ->> 'lng')::float8,
          coalesce(nullif(p ->> 'daily_fee_php', '')::int, 0), coalesce(nullif(p ->> 'holding_period_days', '')::int, 3),
          coalesce(nullif(p ->> 'capacity', '')::int, 50),
          nullif(btrim(coalesce(p ->> 'officer_in_charge', '')), ''), nullif(btrim(coalesce(p ->> 'city', '')), ''),
          nullif(btrim(coalesce(p ->> 'facility_type', '')), ''),
          nullif(btrim(coalesce(p ->> 'city_place_id', '')), ''), p -> 'city_bounds')
  returning id into new_id;

  insert into public.facility_invites (shelter_id, code) values (new_id, private.new_invite_code());

  perform set_config('pawtrack.facility_rpc', '1', true);
  update public.admin_accounts set shelter_id = new_id, facility_role = 'manager' where id = uid;
  return new_id;
end;
$$;

-- ---------- another main facility ----------
create or replace function public.add_main_facility(p jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  me public.admin_accounts%rowtype;
  new_id uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into me from public.admin_accounts
   where id = uid and status = 'approved' and facility_role = 'manager' and shelter_id is not null;
  if not found then raise exception 'Only a facility manager can add another main facility'; end if;
  if exists (select 1 from public.shelters where id = me.shelter_id and parent_id is not null) then
    raise exception 'Only the manager of a main facility can add another main facility';
  end if;
  if char_length(btrim(coalesce(p ->> 'name', ''))) < 2 or char_length(btrim(coalesce(p ->> 'address', ''))) < 2 then
    raise exception 'A facility needs a name and an address';
  end if;
  if not private.facility_pin_in_bounds((p ->> 'lat')::float8, (p ->> 'lng')::float8, p -> 'city_bounds') then
    raise exception 'The pin must be inside the facility''s city';
  end if;

  insert into public.shelters (name, address, phone, email, hours, lat, lng, daily_fee_php, holding_period_days,
                               capacity, officer_in_charge, city, facility_type, city_place_id, city_bounds)
  values (btrim(p ->> 'name'), btrim(p ->> 'address'),
          nullif(btrim(coalesce(p ->> 'phone', '')), ''), nullif(btrim(coalesce(p ->> 'email', '')), ''),
          nullif(btrim(coalesce(p ->> 'hours', '')), ''),
          (p ->> 'lat')::float8, (p ->> 'lng')::float8,
          coalesce(nullif(p ->> 'daily_fee_php', '')::int, 0), coalesce(nullif(p ->> 'holding_period_days', '')::int, 3),
          coalesce(nullif(p ->> 'capacity', '')::int, 50),
          nullif(btrim(coalesce(p ->> 'officer_in_charge', '')), ''), nullif(btrim(coalesce(p ->> 'city', '')), ''),
          nullif(btrim(coalesce(p ->> 'facility_type', '')), ''),
          nullif(btrim(coalesce(p ->> 'city_place_id', '')), ''), p -> 'city_bounds')
  returning id into new_id;

  insert into public.facility_invites (shelter_id, code) values (new_id, private.new_invite_code());
  insert into public.facility_extra_mains (admin_id, shelter_id) values (uid, new_id);
  return new_id;
end;
$$;

-- ---------- sub-facility: same city as its main facility, and the barangays it covers ----------
create or replace function public.create_sub_facility(p jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed uuid[] := private.my_managed_shelter_ids();
  pid uuid := coalesce(nullif(p ->> 'parent_id', '')::uuid, private.my_manager_shelter_id());
  parent public.shelters%rowtype;
  areas text[] := private.facility_barangays(p);
  new_id uuid;
begin
  if managed is null or pid is null or not (pid = any (managed)) then
    raise exception 'Only a facility manager can create a sub-facility';
  end if;
  select * into parent from public.shelters where id = pid;
  if parent.parent_id is not null then
    raise exception 'A sub-facility cannot have sub-facilities of its own';
  end if;
  if char_length(btrim(coalesce(p ->> 'name', ''))) < 2 or char_length(btrim(coalesce(p ->> 'address', ''))) < 2 then
    raise exception 'A sub-facility needs a name and an address';
  end if;
  if coalesce(array_length(areas, 1), 0) = 0 then
    raise exception 'Choose the barangays this sub-facility covers';
  end if;
  -- The main facility's city limits where the sub-facility can be
  if not private.facility_pin_in_bounds((p ->> 'lat')::float8, (p ->> 'lng')::float8, coalesce(parent.city_bounds, p -> 'city_bounds')) then
    raise exception 'The pin must be inside the main facility''s city';
  end if;

  insert into public.shelters (name, address, phone, email, hours, lat, lng, daily_fee_php, holding_period_days,
                               capacity, officer_in_charge, city, facility_type, parent_id, city_place_id, city_bounds, coverage_barangays)
  values (btrim(p ->> 'name'), btrim(p ->> 'address'),
          nullif(btrim(coalesce(p ->> 'phone', '')), ''), nullif(btrim(coalesce(p ->> 'email', '')), ''),
          nullif(btrim(coalesce(p ->> 'hours', '')), ''),
          (p ->> 'lat')::float8, (p ->> 'lng')::float8,
          coalesce(nullif(p ->> 'daily_fee_php', '')::int, 0), coalesce(nullif(p ->> 'holding_period_days', '')::int, 3),
          coalesce(nullif(p ->> 'capacity', '')::int, 50),
          nullif(btrim(coalesce(p ->> 'officer_in_charge', '')), ''),
          coalesce(parent.city, nullif(btrim(coalesce(p ->> 'city', '')), '')),
          nullif(btrim(coalesce(p ->> 'facility_type', '')), ''), pid,
          coalesce(parent.city_place_id, nullif(btrim(coalesce(p ->> 'city_place_id', '')), '')),
          coalesce(parent.city_bounds, p -> 'city_bounds'), areas)
  returning id into new_id;

  insert into public.facility_invites (shelter_id, code) values (new_id, private.new_invite_code());
  return new_id;
end;
$$;
