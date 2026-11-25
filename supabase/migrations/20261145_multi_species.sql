-- PawTrack is no longer dog and cat only: birds, rabbits, small mammals and reptiles are first-class species.
-- 'Other' stays as the catch-all. The list must match js/species.js.
-- Only the allowed values widen, so every existing row stays valid.

do $$
declare
  t text;
  species_list constant text := $list$('Dog', 'Cat', 'Bird', 'Rabbit', 'Small mammal', 'Reptile', 'Other')$list$;
begin
  foreach t in array array['registered_pets', 'missing_pets', 'community_sightings', 'impounded_pets', 'reunited_pets'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_species_check');
    execute format('alter table public.%I add constraint %I check (species in %s)', t, t || '_species_check', species_list);
  end loop;
end $$;
