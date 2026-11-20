-- Lost reports are routed to the impoundment facility that covers the place the pet was last seen.
--
--   1. a sub-facility whose coverage_barangays include the last-seen barangay (and that sits in the same city)
--   2. otherwise a main facility in the last-seen city (the nearest one when a city has several)
--   3. otherwise nobody: PawTrack itself handles the report (routed_shelter_id stays null, routed_via = 'pawtrack')
--
-- When a passerby then reports the pet as found, the owner is emailed automatically (edge function
-- notify-owner-found, through Brevo), in the routed facility's name, or in PawTrack's when nothing was routed.

-- Also in 20261129_facility_city_and_coverage.sql; repeated so this migration works on its own
alter table public.shelters
  add column if not exists city_place_id text,
  add column if not exists city_bounds jsonb,
  add column if not exists coverage_barangays text[];

alter table public.missing_pets
  add column if not exists last_seen_barangay text check (last_seen_barangay is null or char_length(last_seen_barangay) <= 120),
  add column if not exists last_seen_city text check (last_seen_city is null or char_length(last_seen_city) <= 120),
  add column if not exists routed_shelter_id uuid references public.shelters (id) on delete set null,
  add column if not exists routed_via text check (routed_via in ('barangay', 'city', 'pawtrack')),
  add column if not exists found_alert_at timestamptz,
  add column if not exists found_email_sent_at timestamptz;

create index if not exists missing_pets_routed_shelter_idx on public.missing_pets (routed_shelter_id) where routed_shelter_id is not null;

-- "City of Quezon", "Quezon City" and "quezon city" are the same place; "Brgy. Bagong Silangan" = "Bagong Silangan"
create or replace function private.place_key(v text)
returns text language sql immutable set search_path = ''
as $$
  select btrim(regexp_replace(regexp_replace(
           regexp_replace(lower(coalesce(v, '')), '\m(city of|municipality of|city|municipality|barangay|brgy\.?|brg\.?)\M', ' ', 'g'),
           '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'));
$$;

create or replace function private.route_missing_report(p_barangay text, p_city text, p_lat float8, p_lng float8)
returns table (shelter_id uuid, via text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- 1) a sub-facility that covers the barangay
  if private.place_key(p_barangay) <> '' then
    select s.id into v_id
    from public.shelters s
    where s.parent_id is not null
      and (private.place_key(p_city) = '' or private.place_key(s.city) = private.place_key(p_city))
      and exists (select 1 from unnest(coalesce(s.coverage_barangays, '{}')) c
                  where private.place_key(c) = private.place_key(p_barangay))
    order by (s.lat - p_lat) ^ 2 + (s.lng - p_lng) ^ 2
    limit 1;
    if v_id is not null then
      return query select v_id, 'barangay'::text;
      return;
    end if;
  end if;

  -- 2) a main facility in the city (the nearest if several)
  if private.place_key(p_city) <> '' then
    select s.id into v_id
    from public.shelters s
    where s.parent_id is null and private.place_key(s.city) = private.place_key(p_city)
    order by (s.lat - p_lat) ^ 2 + (s.lng - p_lng) ^ 2
    limit 1;
    if v_id is not null then
      return query select v_id, 'city'::text;
      return;
    end if;
  end if;

  -- 3) nobody covers it: PawTrack handles it
  return query select null::uuid, 'pawtrack'::text;
end;
$$;

-- Set on every new report; the client cannot choose where its report goes
create or replace function private.missing_pets_route()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  new.last_seen_barangay := nullif(btrim(new.last_seen_barangay), '');
  new.last_seen_city := nullif(btrim(new.last_seen_city), '');
  select * into r from private.route_missing_report(new.last_seen_barangay, new.last_seen_city, new.lat, new.lng);
  new.routed_shelter_id := r.shelter_id;
  new.routed_via := r.via;
  new.found_alert_at := null;
  new.found_email_sent_at := null;
  return new;
end;
$$;

drop trigger if exists missing_pets_route on public.missing_pets;
create trigger missing_pets_route before insert on public.missing_pets
  for each row execute function private.missing_pets_route();

-- Reporters may not re-route or reset the email bookkeeping of their own report
create or replace function private.missing_pets_lock_routing()
returns trigger language plpgsql set search_path = ''
as $$
begin
  -- security-definer functions and the service role run as other roles, so only direct client writes are held back
  if current_user in ('authenticated', 'anon') then
    new.routed_shelter_id := old.routed_shelter_id;
    new.routed_via := old.routed_via;
    new.found_alert_at := old.found_alert_at;
    new.found_email_sent_at := old.found_email_sent_at;
  end if;
  return new;
end;
$$;

drop trigger if exists missing_pets_lock_routing on public.missing_pets;
create trigger missing_pets_lock_routing before update on public.missing_pets
  for each row execute function private.missing_pets_lock_routing();

-- Facility staff read the reports routed to their facility (a main facility also sees its sub-facilities')
create or replace function public.facility_routed_reports()
returns setof public.missing_pets
language sql stable security definer set search_path = ''
as $$
  select m.* from public.missing_pets m
  where m.routed_shelter_id = any (coalesce((select private.my_facility_ids()), array[]::uuid[]))
  order by m.created_at desc;
$$;
revoke all on function public.facility_routed_reports() from public, anon;
grant execute on function public.facility_routed_reports() to authenticated;

-- A 'found' alert stamps the report so the email function knows there is something to send (once per alert)
create or replace function public.notify_missing_pet_reporter(p_missing_pet_id uuid, p_kind text, p_phone text, p_location text, p_notes text default null)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_report public.missing_pets%rowtype;
  v_actor_name text;
  v_actor_avatar text;
begin
  if p_kind not in ('found', 'sighting') then
    raise exception 'Unknown alert type';
  end if;
  if char_length(btrim(coalesce(p_phone, ''))) < 6 or char_length(p_phone) > 30 then
    raise exception 'Please enter a valid phone number';
  end if;
  if char_length(btrim(coalesce(p_location, ''))) < 2 or char_length(p_location) > 300 then
    raise exception 'Please enter where the pet was seen';
  end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'Message is too long';
  end if;

  select * into v_report from public.missing_pets
  where id = p_missing_pet_id and status in ('missing', 'sighted');
  if not found or v_report.reporter_id is null then
    return false;
  end if;

  if (select count(*) from public.notifications n
      where n.recipient_id = v_report.reporter_id
        and n.pet_name = v_report.pet_name
        and n.type = 'sighting_verification'
        and n.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many alerts were sent for this pet recently. Please try again later.';
  end if;

  if auth.uid() is not null then
    select nullif(btrim(g.full_name), ''),
           case when g.avatar_url ~ '^https://' and char_length(g.avatar_url) <= 500 then g.avatar_url end
      into v_actor_name, v_actor_avatar
    from public.guardians g where g.id = auth.uid();
  end if;

  insert into public.notifications (recipient_id, type, title, message, pet_name, location, actor_id, actor_name, actor_avatar)
  values (
    v_report.reporter_id,
    'sighting_verification',
    case
      when p_kind = 'sighting' then 'POSSIBLE SIGHTING: "' || upper(v_report.pet_name) || '"'
      when v_report.reported_by_owner then 'GOOD SAMARITAN FOUND YOUR PET: "' || upper(v_report.pet_name) || '"!'
      else 'GOOD SAMARITAN FOUND THE PET YOU REPORTED: "' || upper(v_report.pet_name) || '"!'
    end,
    case when p_kind = 'sighting' then 'Someone may have seen ' else 'Someone found ' end
      || v_report.pet_name || ' near ' || btrim(p_location)
      || '. Finder phone: ' || btrim(p_phone)
      || coalesce('. Message: "' || nullif(btrim(p_notes), '') || '"', ''),
    v_report.pet_name,
    btrim(p_location),
    auth.uid(), v_actor_name, v_actor_avatar
  );

  if p_kind = 'found' then
    update public.missing_pets set found_alert_at = now() where id = v_report.id;
  end if;
  return true;
end;
$function$;
