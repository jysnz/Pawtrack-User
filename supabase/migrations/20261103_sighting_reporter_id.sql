-- Who sent each community sighting, so the Sightings page can keep review actions (verify, archive, retrieve)
-- for the guardian who reported the pet missing and never show them to the finder who sent the sighting.
alter table public.community_sightings
  add column if not exists reporter_id uuid references auth.users(id) on delete set null;

create index if not exists community_sightings_reporter_id_idx on public.community_sightings (reporter_id);

-- Always the signed-in sender (null for guests), never a value the browser supplies
create or replace function public.set_sighting_reporter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.reporter_id := auth.uid();
  return new;
end;
$$;

revoke all on function public.set_sighting_reporter() from public, anon, authenticated;

drop trigger if exists community_sightings_set_reporter on public.community_sightings;
create trigger community_sightings_set_reporter
  before insert on public.community_sightings
  for each row execute function public.set_sighting_reporter();
