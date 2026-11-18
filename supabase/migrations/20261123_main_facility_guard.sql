-- Only the manager of a MAIN facility can add another main facility (a sub-facility's manager cannot).
-- Same function as in 20261122, with that one extra check.
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
  insert into public.facility_extra_mains (admin_id, shelter_id) values (uid, new_id);
  return new_id;
end;
$$;
