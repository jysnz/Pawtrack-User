-- Clears everything the Sightings feed shows, so the flows can be tried from scratch.
-- NOT a migration: run it by hand in the Supabase SQL editor, once, when you want a clean slate.
-- It removes: missing-pet reports, community sightings (with their private phone numbers), claims, likes,
-- comments, reunited records, and the claim/sighting notifications. It keeps your registered pets, accounts,
-- shelters, impounds and every other notification.

begin;

-- Pets first: switching them back to safe can create reunited records, which are removed below.
update public.registered_pets set status = 'safe' where status = 'missing';

delete from public.sighting_comments;
delete from public.sighting_likes;
delete from public.sighting_claims;
delete from public.community_sightings;   -- also removes sighting_contacts
delete from public.missing_pets;          -- also removes likes and comments on missing posts
delete from public.reunited_pets;
delete from public.notifications
  where type in ('sighting_verification', 'reunited') or sighting_claim_id is not null;

-- Check: everything above should read 0, and registered_pets keeps all of your pets.
select 'missing_pets' as t, count(*) from public.missing_pets
union all select 'community_sightings', count(*) from public.community_sightings
union all select 'reunited_pets', count(*) from public.reunited_pets
union all select 'sighting_claims', count(*) from public.sighting_claims
union all select 'sighting_contacts', count(*) from public.sighting_contacts
union all select 'sighting_likes', count(*) from public.sighting_likes
union all select 'sighting_comments', count(*) from public.sighting_comments
union all select 'registered_pets still missing', count(*) from public.registered_pets where status = 'missing'
union all select 'registered_pets total (kept)', count(*) from public.registered_pets;

commit;
