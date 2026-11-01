-- Marking a pet as found now records how the pet was when found and a photo of the owner reunited with it.
-- Both are saved on the missing report, then copied to the reunited record when the report closes as found.

alter table public.missing_pets
  add column if not exists found_condition text check (found_condition is null or char_length(found_condition) <= 500),
  add column if not exists reunion_photo_url text check (reunion_photo_url is null or (char_length(reunion_photo_url) <= 500 and reunion_photo_url ~ '^https://'));

alter table public.reunited_pets
  add column if not exists found_condition text check (found_condition is null or char_length(found_condition) <= 500),
  add column if not exists reunion_photo_url text check (reunion_photo_url is null or (char_length(reunion_photo_url) <= 500 and reunion_photo_url ~ '^https://'));

create or replace function public.record_reunited_pet()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'found' and old.status is distinct from 'found' then
    insert into public.reunited_pets
      (missing_report_id, pet_id, pet_name, species, breed, photo_url, found_location, lat, lng, days_missing, reunited_at,
       found_condition, reunion_photo_url)
    values
      (new.id, new.pet_id, new.pet_name, new.species, new.breed, new.photo_url, new.last_seen_location, new.lat, new.lng,
       greatest(0, (now()::date - coalesce(new.last_seen_at, new.created_at)::date)), now(),
       new.found_condition, new.reunion_photo_url)
    on conflict (missing_report_id) where missing_report_id is not null do nothing;
  end if;
  return new;
end;
$$;
