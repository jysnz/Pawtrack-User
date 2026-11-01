-- Likes and comments on community sightings (the sightings feed).
-- Anyone can read them; only signed-in guardians can like or comment, and only as themselves.

create table if not exists public.sighting_likes (
  sighting_id uuid not null references public.community_sightings(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sighting_id, user_id)
);

alter table public.sighting_likes enable row level security;

create policy "Anyone can see sighting likes" on public.sighting_likes
  for select to anon, authenticated using (true);
create policy "Guardians like as themselves" on public.sighting_likes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Guardians remove their own like" on public.sighting_likes
  for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.sighting_comments (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null references public.community_sightings(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default '' check (char_length(author_name) <= 80),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists sighting_comments_sighting_idx on public.sighting_comments (sighting_id, created_at);

alter table public.sighting_comments enable row level security;

create policy "Anyone can read sighting comments" on public.sighting_comments
  for select to anon, authenticated using (true);
create policy "Guardians comment as themselves" on public.sighting_comments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Guardians delete their own comments; admins any" on public.sighting_comments
  for delete to authenticated using (user_id = (select auth.uid()) or (select private.is_approved_admin()));

-- The name on a comment always comes from the account, never from the browser; and no flooding
create or replace function public.set_sighting_comment_author()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.body := btrim(new.body);
  new.author_name := coalesce(
    (select nullif(btrim(g.full_name), '') from public.guardians g where g.id = auth.uid()),
    'A PawTrack guardian');
  if (select count(*) from public.sighting_comments c
      where c.user_id = new.user_id and c.created_at > now() - interval '1 minute') >= 10 then
    raise exception 'You are commenting too fast. Please wait a moment.';
  end if;
  return new;
end;
$$;

revoke all on function public.set_sighting_comment_author() from public, anon, authenticated;

drop trigger if exists sighting_comments_set_author on public.sighting_comments;
create trigger sighting_comments_set_author
  before insert on public.sighting_comments
  for each row execute function public.set_sighting_comment_author();
