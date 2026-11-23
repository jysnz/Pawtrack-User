-- FRESH START WITH TEST DATA.  NOT a migration: run it by hand, once, in the Supabase SQL editor.
--
-- KEEPS:    every account (auth.users, public.guardians, public.admin_accounts).
-- DELETES:  everything else the app stores: pets, missing reports, sightings, comments, likes, claims,
--           reunions, impounds, penalty tickets, violations, NFC flags, vaccinations, notifications,
--           and ALL impound facilities (public.shelters, their invites and extra-main links).
-- ADDS:     for every existing guardian, 2 registered pets (one of them reported missing, with a missing-pet report).
--
-- This cannot be undone. Take a backup first (Dashboard > Database > Backups) or run it on a copy.
-- It runs in one transaction: if any statement fails, nothing changes. Not tested against your database, so read the
-- result of the check query at the bottom before the commit (replace "commit" with "rollback" to just look).
-- Files in Storage (pet photos, evidence photos) are NOT removed by SQL; clear those buckets in the Dashboard if wanted.

begin;

-- 1. Facilities: unlink admin accounts first (the table requires shelter_id and facility_role to be null together)
update public.admin_accounts set shelter_id = null, facility_role = null where shelter_id is not null;

-- 2. User-side data, children before parents
delete from public.comment_reactions;
delete from public.sighting_comments;
delete from public.sighting_likes;
delete from public.sighting_contacts;
delete from public.sighting_claims;
delete from public.reunion_cases;
delete from public.community_sightings;
delete from public.reunited_pets;
delete from public.impound_claims;
delete from public.penalty_tickets;
delete from public.violations;
delete from public.nfc_flags;
delete from public.notifications;
delete from public.missing_pets;
delete from public.impounded_pets;
delete from public.pet_vaccinations;
delete from public.registered_pets;

-- 3. All impound facilities
delete from public.facility_invites;
delete from public.facility_extra_mains;
delete from public.shelters;

-- 4. Test data for the existing guardians: a safe pet and a missing pet each
insert into public.registered_pets (owner_id, name, species, breed, gender, color, age_months, description, status)
select g.id, 'Test Pet ' || row_number() over (order by g.created_at), 'Dog', 'Aspin', 'Male', 'Brown', 24,
       'Test pet for trying the app.', 'safe'
from public.guardians g;

with missing as (
  insert into public.registered_pets (owner_id, name, species, breed, gender, color, age_months, description, status)
  select g.id, 'Test Missing ' || row_number() over (order by g.created_at), 'Cat', 'Domestic Shorthair', 'Female', 'Orange and white', 18,
         'Test missing pet for trying the app.', 'missing'
  from public.guardians g
  returning id, owner_id, name, species, breed, gender, color
)
insert into public.missing_pets (pet_id, reporter_id, pet_name, species, breed, gender, color, description,
                                 last_seen_location, last_seen_city, lat, lng, status)
select m.id, m.owner_id, m.name, m.species, m.breed, m.gender, m.color, 'Test report.',
       'Quezon City Memorial Circle', 'Quezon City', 14.6507, 121.0494, 'missing'
from missing m;

-- Check before committing
select 'guardians (kept)' as t, count(*) from public.guardians
union all select 'admin_accounts (kept)', count(*) from public.admin_accounts
union all select 'registered_pets', count(*) from public.registered_pets
union all select 'missing_pets', count(*) from public.missing_pets
union all select 'shelters (should be 0)', count(*) from public.shelters
union all select 'impounded_pets (should be 0)', count(*) from public.impounded_pets;

commit;
