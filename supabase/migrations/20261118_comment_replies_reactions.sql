-- Comments on sightings feed posts: replies, reactions, and notifications (comments, replies and likes).
--   * A reply is a comment with parent_id set (one level deep: a reply to a reply stays under the same top-level
--     comment, and reply_to_id/reply_to_name say who it answers).
--   * Reactions on comments and replies: one reaction per person per comment.
--   * Notifications: the post's author hears about new comments; a comment's author hears about replies.

-- ---------------------------------------------------------------------------
-- 1. Replies
-- ---------------------------------------------------------------------------
alter table public.sighting_comments
  add column if not exists parent_id uuid references public.sighting_comments(id) on delete cascade,
  add column if not exists reply_to_id uuid references public.sighting_comments(id) on delete set null,
  add column if not exists reply_to_name text check (reply_to_name is null or char_length(reply_to_name) <= 80);

create index if not exists sighting_comments_parent_idx on public.sighting_comments (parent_id);

-- Same checks as before (author, avatar, flood limit), plus: a reply only names the comment it answers. The server
-- works out the post, the top-level parent and the name, so none of it can be forged from the browser.
create or replace function public.set_sighting_comment_author()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_target public.sighting_comments%rowtype;
begin
  new.user_id := auth.uid();
  new.body := btrim(new.body);
  new.author_name := coalesce(
    (select nullif(btrim(g.full_name), '') from public.guardians g where g.id = auth.uid()),
    'A PawTrack guardian');
  new.author_avatar := (select g.avatar_url from public.guardians g
                        where g.id = auth.uid() and g.avatar_url ~ '^https://' and char_length(g.avatar_url) <= 500);

  new.parent_id := null;
  new.reply_to_name := null;
  if new.reply_to_id is not null then
    select * into v_target from public.sighting_comments where id = new.reply_to_id;
    if not found then
      raise exception 'The comment you are replying to is no longer there.';
    end if;
    new.sighting_id := v_target.sighting_id;
    new.missing_pet_id := v_target.missing_pet_id;
    new.parent_id := coalesce(v_target.parent_id, v_target.id);
    new.reply_to_name := v_target.author_name;
  end if;

  if (select count(*) from public.sighting_comments c
      where c.user_id = new.user_id and c.created_at > now() - interval '1 minute') >= 10 then
    raise exception 'You are commenting too fast. Please wait a moment.';
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Reactions on comments and replies
-- ---------------------------------------------------------------------------
create table if not exists public.comment_reactions (
  comment_id uuid not null references public.sighting_comments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'love', 'haha', 'wow', 'sad', 'angry')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_reactions_user_idx on public.comment_reactions (user_id);

alter table public.comment_reactions enable row level security;

create policy "Anyone can see comment reactions" on public.comment_reactions
  for select to anon, authenticated using (true);
create policy "Guardians react as themselves" on public.comment_reactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Guardians change their own reaction" on public.comment_reactions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Guardians remove their own reaction" on public.comment_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Notifications: new types, and a link back to the post and comment
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['sighting_verification', 'impound_alert', 'reunited', 'missing_alert', 'system', 'comment', 'reply', 'like']));

alter table public.notifications
  add column if not exists comment_id uuid references public.sighting_comments(id) on delete set null,
  add column if not exists post_id uuid,
  add column if not exists post_kind text check (post_kind is null or post_kind in ('sighting', 'missing')),
  add column if not exists actor_id uuid; -- who did it (the liker), so one person's repeated likes alert once

-- After a comment is saved: tell the post's author, and (for a reply) the author of the comment it answers.
-- Nobody is notified about their own comment, and nobody gets two alerts for one comment. A problem here must
-- never stop the comment itself from being saved.
create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_owner uuid;
  v_what text;
  v_where text;
  v_kind text;
  v_post uuid;
  v_reply_author uuid;
  v_snippet text := left(new.body, 120) || case when char_length(new.body) > 120 then '…' else '' end;
  v_name text := coalesce(nullif(btrim(new.author_name), ''), 'Someone');
begin
  begin
    if new.sighting_id is not null then
      v_kind := 'sighting';
      v_post := new.sighting_id;
      select s.reporter_id, coalesce(nullif(btrim(s.breed), ''), s.species), s.location
        into v_owner, v_what, v_where
      from public.community_sightings s where s.id = new.sighting_id;
    else
      v_kind := 'missing';
      v_post := new.missing_pet_id;
      select m.reporter_id, coalesce(nullif(btrim(m.pet_name), ''), nullif(btrim(m.breed), ''), m.species), m.last_seen_location
        into v_owner, v_what, v_where
      from public.missing_pets m where m.id = new.missing_pet_id;
    end if;

    if new.reply_to_id is not null then
      select c.user_id into v_reply_author from public.sighting_comments c where c.id = new.reply_to_id;
    end if;

    -- To the author of the comment that was replied to
    if v_reply_author is not null and v_reply_author <> new.user_id
       and exists (select 1 from public.guardians g where g.id = v_reply_author) then
      insert into public.notifications (recipient_id, type, title, message, pet_name, location, comment_id, post_id, post_kind)
      values (
        v_reply_author, 'reply', 'NEW REPLY TO YOUR COMMENT',
        v_name || ' replied to your comment: "' || v_snippet || '"',
        v_what, v_where, new.id, v_post, v_kind
      );
    end if;

    -- To the author of the post (unless they were just told about the reply, or wrote it)
    if v_owner is not null and v_owner <> new.user_id and v_owner is distinct from v_reply_author
       and exists (select 1 from public.guardians g where g.id = v_owner) then
      insert into public.notifications (recipient_id, type, title, message, pet_name, location, comment_id, post_id, post_kind)
      values (
        v_owner, 'comment', 'NEW COMMENT ON YOUR POST',
        v_name || case when new.reply_to_id is not null then ' replied in a comment thread on your post: "' else ' commented on your post: "' end
          || v_snippet || '"',
        v_what, v_where, new.id, v_post, v_kind
      );
    end if;
  exception when others then
    raise warning 'notify_comment skipped: %', sqlerrm;
  end;
  return new;
end;
$function$;

revoke all on function public.notify_comment() from public, anon, authenticated;

drop trigger if exists sighting_comments_notify on public.sighting_comments;
create trigger sighting_comments_notify
  after insert on public.sighting_comments
  for each row execute function public.notify_comment();

-- ---------------------------------------------------------------------------
-- 4. A like on a post tells the post's author (never for liking your own post, and once per person per post,
--    so liking and un-liking over and over does not pile up alerts)
-- ---------------------------------------------------------------------------
create or replace function public.notify_like()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_owner uuid;
  v_what text;
  v_where text;
  v_kind text;
  v_post uuid;
  v_name text;
begin
  begin
    if new.sighting_id is not null then
      v_kind := 'sighting';
      v_post := new.sighting_id;
      select s.reporter_id, coalesce(nullif(btrim(s.breed), ''), s.species), s.location
        into v_owner, v_what, v_where
      from public.community_sightings s where s.id = new.sighting_id;
    else
      v_kind := 'missing';
      v_post := new.missing_pet_id;
      select m.reporter_id, coalesce(nullif(btrim(m.pet_name), ''), nullif(btrim(m.breed), ''), m.species), m.last_seen_location
        into v_owner, v_what, v_where
      from public.missing_pets m where m.id = new.missing_pet_id;
    end if;

    if v_owner is null or v_owner = new.user_id
       or not exists (select 1 from public.guardians g where g.id = v_owner) then
      return new;
    end if;
    if exists (select 1 from public.notifications n
               where n.recipient_id = v_owner and n.type = 'like' and n.post_id = v_post and n.actor_id = new.user_id) then
      return new;
    end if;

    v_name := coalesce((select nullif(btrim(g.full_name), '') from public.guardians g where g.id = new.user_id), 'Someone');
    insert into public.notifications (recipient_id, type, title, message, pet_name, location, post_id, post_kind, actor_id)
    values (v_owner, 'like', 'NEW LIKE ON YOUR POST', v_name || ' liked your post.', v_what, v_where, v_post, v_kind, new.user_id);
  exception when others then
    raise warning 'notify_like skipped: %', sqlerrm;
  end;
  return new;
end;
$function$;

revoke all on function public.notify_like() from public, anon, authenticated;

drop trigger if exists sighting_likes_notify on public.sighting_likes;
create trigger sighting_likes_notify
  after insert on public.sighting_likes
  for each row execute function public.notify_like();
