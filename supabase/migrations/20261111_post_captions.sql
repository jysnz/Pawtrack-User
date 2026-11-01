-- Post captions, and missing-pet reports as posts in the sightings feed.
-- 1) A caption (the words that go with the post) on missing reports and on sightings.
-- 2) Likes and comments can now be on a missing-pet report too, not only on a sighting.

alter table public.missing_pets
  add column if not exists caption text check (caption is null or char_length(caption) <= 500);
alter table public.community_sightings
  add column if not exists caption text check (caption is null or char_length(caption) <= 500);

-- Likes: one per person per post (a sighting or a missing report)
alter table public.sighting_likes drop constraint if exists sighting_likes_pkey;
alter table public.sighting_likes add column if not exists id uuid not null default gen_random_uuid();
alter table public.sighting_likes add primary key (id);
alter table public.sighting_likes alter column sighting_id drop not null;
alter table public.sighting_likes
  add column if not exists missing_pet_id uuid references public.missing_pets(id) on delete cascade;
alter table public.sighting_likes
  add constraint sighting_likes_one_post check ((sighting_id is null) <> (missing_pet_id is null));
create unique index if not exists sighting_likes_sighting_uq on public.sighting_likes (sighting_id, user_id) where sighting_id is not null;
create unique index if not exists sighting_likes_missing_uq on public.sighting_likes (missing_pet_id, user_id) where missing_pet_id is not null;

-- Comments
alter table public.sighting_comments alter column sighting_id drop not null;
alter table public.sighting_comments
  add column if not exists missing_pet_id uuid references public.missing_pets(id) on delete cascade;
alter table public.sighting_comments
  add constraint sighting_comments_one_post check ((sighting_id is null) <> (missing_pet_id is null));
create index if not exists sighting_comments_missing_idx on public.sighting_comments (missing_pet_id, created_at);
