-- Notifications show who did it, with their photo (like Facebook): the commenter, the person who reacted, or the
-- person who reported seeing / finding the pet. Photos come from the guardian profile (https links only);
-- a signed-out finder simply has no photo and the app shows their initial.

alter table public.notifications
  add column if not exists actor_name text check (actor_name is null or char_length(actor_name) <= 80),
  add column if not exists actor_avatar text check (actor_avatar is null or (char_length(actor_avatar) <= 500 and actor_avatar ~ '^https://'));
-- actor_id already exists (added with the like alerts)

-- Comments and replies
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
      insert into public.notifications (recipient_id, type, title, message, pet_name, location, comment_id, post_id, post_kind, actor_id, actor_name, actor_avatar)
      values (
        v_reply_author, 'reply', 'NEW REPLY TO YOUR COMMENT',
        v_name || ' replied to your comment: "' || v_snippet || '"',
        v_what, v_where, new.id, v_post, v_kind, new.user_id, v_name, new.author_avatar
      );
    end if;

    -- To the author of the post (unless they were just told about the reply, or wrote it)
    if v_owner is not null and v_owner <> new.user_id and v_owner is distinct from v_reply_author
       and exists (select 1 from public.guardians g where g.id = v_owner) then
      insert into public.notifications (recipient_id, type, title, message, pet_name, location, comment_id, post_id, post_kind, actor_id, actor_name, actor_avatar)
      values (
        v_owner, 'comment', 'NEW COMMENT ON YOUR POST',
        v_name || case when new.reply_to_id is not null then ' replied in a comment thread on your post: "' else ' commented on your post: "' end
          || v_snippet || '"',
        v_what, v_where, new.id, v_post, v_kind, new.user_id, v_name, new.author_avatar
      );
    end if;
  exception when others then
    raise warning 'notify_comment skipped: %', sqlerrm;
  end;
  return new;
end;
$function$;

revoke all on function public.notify_comment() from public, anon, authenticated;

-- Reactions on a post
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
  v_avatar text;
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

    select coalesce(nullif(btrim(g.full_name), ''), 'Someone'),
           case when g.avatar_url ~ '^https://' and char_length(g.avatar_url) <= 500 then g.avatar_url end
      into v_name, v_avatar
    from public.guardians g where g.id = new.user_id;
    v_name := coalesce(v_name, 'Someone');

    insert into public.notifications (recipient_id, type, title, message, pet_name, location, post_id, post_kind, actor_id, actor_name, actor_avatar)
    values (
      v_owner, 'like',
      case when new.reaction = 'like' then 'NEW LIKE ON YOUR POST' else 'NEW REACTION ON YOUR POST' end,
      v_name || case new.reaction
        when 'like'  then ' liked your post.'
        when 'love'  then ' reacted ❤️ Love to your post.'
        when 'haha'  then ' reacted 😂 Haha to your post.'
        when 'wow'   then ' reacted 😮 Wow to your post.'
        when 'sad'   then ' reacted 😢 Sad to your post.'
        when 'angry' then ' reacted 😡 Angry to your post.'
        else ' reacted to your post.'
      end,
      v_what, v_where, v_post, v_kind, new.user_id, v_name, v_avatar
    );
  exception when others then
    raise warning 'notify_like skipped: %', sqlerrm;
  end;
  return new;
end;
$function$;

revoke all on function public.notify_like() from public, anon, authenticated;

-- "Seen this pet?" and "Found a pet" alerts to the reporter: the signed-in person who sent it appears with their photo
create or replace function public.notify_missing_pet_reporter(p_missing_pet_id uuid, p_kind text, p_phone text, p_location text, p_notes text default null)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_report public.missing_pets%rowtype;
  v_actor_name text;
  v_actor_avatar text;
begin
  if p_kind not in ('found', 'sighting') then
    raise exception 'Unknown alert type';
  end if;
  if char_length(btrim(coalesce(p_phone, ''))) < 6 or char_length(p_phone) > 30 then
    raise exception 'Please enter a valid phone number';
  end if;
  if char_length(btrim(coalesce(p_location, ''))) < 2 or char_length(p_location) > 300 then
    raise exception 'Please enter where the pet was seen';
  end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'Message is too long';
  end if;

  select * into v_report from public.missing_pets
  where id = p_missing_pet_id and status in ('missing', 'sighted');
  if not found or v_report.reporter_id is null then
    return false;
  end if;

  if (select count(*) from public.notifications n
      where n.recipient_id = v_report.reporter_id
        and n.pet_name = v_report.pet_name
        and n.type = 'sighting_verification'
        and n.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many alerts were sent for this pet recently. Please try again later.';
  end if;

  if auth.uid() is not null then
    select nullif(btrim(g.full_name), ''),
           case when g.avatar_url ~ '^https://' and char_length(g.avatar_url) <= 500 then g.avatar_url end
      into v_actor_name, v_actor_avatar
    from public.guardians g where g.id = auth.uid();
  end if;

  insert into public.notifications (recipient_id, type, title, message, pet_name, location, actor_id, actor_name, actor_avatar)
  values (
    v_report.reporter_id,
    'sighting_verification',
    case
      when p_kind = 'sighting' then 'POSSIBLE SIGHTING: "' || upper(v_report.pet_name) || '"'
      when v_report.reported_by_owner then 'GOOD SAMARITAN FOUND YOUR PET: "' || upper(v_report.pet_name) || '"!'
      else 'GOOD SAMARITAN FOUND THE PET YOU REPORTED: "' || upper(v_report.pet_name) || '"!'
    end,
    case when p_kind = 'sighting' then 'Someone may have seen ' else 'Someone found ' end
      || v_report.pet_name || ' near ' || btrim(p_location)
      || '. Finder phone: ' || btrim(p_phone)
      || coalesce('. Message: "' || nullif(btrim(p_notes), '') || '"', ''),
    v_report.pet_name,
    btrim(p_location),
    auth.uid(), v_actor_name, v_actor_avatar
  );
  return true;
end;
$function$;

-- Scanning a pet's NFC tag
create or replace function public.notify_owner_found(p_tag text, p_phone text, p_location text, p_notes text default null)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pet public.registered_pets%rowtype;
  v_actor_name text;
  v_actor_avatar text;
begin
  if char_length(btrim(coalesce(p_phone, ''))) < 6 or char_length(p_phone) > 30 then
    raise exception 'Please enter a valid phone number';
  end if;
  if char_length(btrim(coalesce(p_location, ''))) < 2 or char_length(p_location) > 300 then
    raise exception 'Please enter where the pet was found';
  end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'Message is too long';
  end if;

  select * into v_pet from public.registered_pets
  where lower(nfc_tag) = lower(btrim(p_tag)) limit 1;
  if not found then
    return false;
  end if;

  if (select count(*) from public.notifications n
      where n.recipient_id is not distinct from v_pet.owner_id
        and n.pet_name = v_pet.name
        and n.type = 'sighting_verification'
        and n.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many alerts were sent for this pet recently. Please try again later.';
  end if;

  if auth.uid() is not null then
    select nullif(btrim(g.full_name), ''),
           case when g.avatar_url ~ '^https://' and char_length(g.avatar_url) <= 500 then g.avatar_url end
      into v_actor_name, v_actor_avatar
    from public.guardians g where g.id = auth.uid();
  end if;

  insert into public.notifications (recipient_id, type, title, message, pet_name, location, actor_id, actor_name, actor_avatar)
  values (
    v_pet.owner_id,
    'sighting_verification',
    'GOOD SAMARITAN FOUND YOUR PET: "' || upper(v_pet.name) || '"!',
    'Someone scanned the NFC tag and reported ' || v_pet.name || ' near ' || btrim(p_location)
      || '. Finder phone: ' || btrim(p_phone)
      || coalesce('. Message: "' || nullif(btrim(p_notes), '') || '"', ''),
    v_pet.name,
    btrim(p_location),
    auth.uid(), v_actor_name, v_actor_avatar
  );

  update public.nfc_tags set last_scanned_at = now() where lower(code) = lower(v_pet.nfc_tag);
  return true;
end;
$function$;

-- Like alerts created before this change: fill in the photo and name from the profile
update public.notifications n
set actor_name = coalesce(nullif(btrim(g.full_name), ''), 'Someone'),
    actor_avatar = case when g.avatar_url ~ '^https://' and char_length(g.avatar_url) <= 500 then g.avatar_url end
from public.guardians g
where n.type = 'like' and n.actor_id = g.id and n.actor_name is null;
