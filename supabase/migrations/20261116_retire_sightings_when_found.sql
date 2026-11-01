-- When a missing report is closed as found, its sightings are no longer live leads:
-- retire them so they leave the map, the Community Sightings list and the feed.
-- (The reunion itself stays visible under Reunited.)

create or replace function private.retire_sightings_on_found()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'found' and old.status is distinct from 'found' then
    update public.community_sightings
       set status = 'archived'
     where missing_pet_id = new.id and status in ('possible_sighting', 'confirmed_sighting');
  end if;
  return new;
end;
$$;

drop trigger if exists missing_pets_retire_sightings on public.missing_pets;
create trigger missing_pets_retire_sightings
  after update of status on public.missing_pets
  for each row execute function private.retire_sightings_on_found();

-- Reports already closed as found
update public.community_sightings s
   set status = 'archived'
  from public.missing_pets m
 where s.missing_pet_id = m.id and m.status = 'found' and s.status in ('possible_sighting', 'confirmed_sighting');
