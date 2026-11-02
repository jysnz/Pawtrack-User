-- Reactions on feed posts (not only comments): a like becomes one of six reactions.
-- Every existing like stays a 'like'. One reaction per person per post (the unique indexes already enforce it).

alter table public.sighting_likes
  add column if not exists reaction text not null default 'like'
  check (reaction in ('like', 'love', 'haha', 'wow', 'sad', 'angry'));

-- Changing your reaction is an update of your own row
drop policy if exists "Guardians change their own post reaction" on public.sighting_likes;
create policy "Guardians change their own post reaction" on public.sighting_likes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The post author's alert says which reaction it was. Still one alert per person per post.
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
      v_what, v_where, v_post, v_kind, new.user_id
    );
  exception when others then
    raise warning 'notify_like skipped: %', sqlerrm;
  end;
  return new;
end;
$function$;

revoke all on function public.notify_like() from public, anon, authenticated;
