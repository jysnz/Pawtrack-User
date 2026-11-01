-- Profile pictures on feed posts and comments.
-- The picture is copied from the poster's own account when the post or comment is created (never supplied by the
-- browser), and only when it is an https image. Anonymous sightings ("Community Good Samaritan") carry no picture.

alter table public.community_sightings
  add column if not exists reporter_avatar text check (reporter_avatar is null or (char_length(reporter_avatar) <= 500 and reporter_avatar ~ '^https://'));
alter table public.sighting_comments
  add column if not exists author_avatar text check (author_avatar is null or (char_length(author_avatar) <= 500 and author_avatar ~ '^https://'));

create or replace function public.set_sighting_reporter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.reporter_id := auth.uid();
  new.reporter_avatar := case
    when auth.uid() is null or new.reporter_name in ('Community Good Samaritan', 'Anonymous') then null
    else (select g.avatar_url from public.guardians g
          where g.id = auth.uid() and g.avatar_url ~ '^https://' and char_length(g.avatar_url) <= 500)
  end;
  return new;
end;
$$;

revoke all on function public.set_sighting_reporter() from public, anon, authenticated;

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
  new.author_avatar := (select g.avatar_url from public.guardians g
                        where g.id = auth.uid() and g.avatar_url ~ '^https://' and char_length(g.avatar_url) <= 500);
  if (select count(*) from public.sighting_comments c
      where c.user_id = new.user_id and c.created_at > now() - interval '1 minute') >= 10 then
    raise exception 'You are commenting too fast. Please wait a moment.';
  end if;
  return new;
end;
$$;

revoke all on function public.set_sighting_comment_author() from public, anon, authenticated;
