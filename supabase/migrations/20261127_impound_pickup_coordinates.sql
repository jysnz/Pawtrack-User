-- Where an animal was picked up, as a map pin (the text description stays in impound_location).
-- Optional: the admin app only sends these once the columns exist.
alter table public.impounded_pets
  add column if not exists impound_lat double precision check (impound_lat is null or impound_lat between -90 and 90),
  add column if not exists impound_lng double precision check (impound_lng is null or impound_lng between -180 and 180);
