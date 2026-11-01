-- "It left that spot": tell the finder and anyone else who reported this pet, so they can look nearby.
-- The owner's case also gets the moved-on time so the screen can show search guidance.

create or replace function public.mark_sighting_moved_on(p_sighting_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  s public.community_sightings%rowtype;
  m public.missing_pets%rowtype;
  v_name text;
  v_case uuid;
  r record;
begin
  select * into s from public.community_sightings where id = p_sighting_id;
  if not found then raise exception 'Sighting not found'; end if;
  select * into m from public.missing_pets where id = s.missing_pet_id;
  if not found or m.reporter_id is distinct from v_uid then
    raise exception 'Only the guardian who reported this pet missing can do this';
  end if;
  if s.moved_on_at is not null then return; end if;

  v_name := coalesce(m.pet_name, 'the pet');
  update public.community_sightings set moved_on_at = now() where id = s.id;
  update public.reunion_cases set status = 'still_searching', last_reminder_at = now(), owner_reminders = 0
    where sighting_id = s.id and owner_id = v_uid and status = 'connecting';
  select id into v_case from public.reunion_cases where sighting_id = s.id and owner_id = v_uid;

  -- the finder: did you see where it went?
  if s.reporter_id is not null and s.reporter_id <> v_uid then
    insert into public.notifications (recipient_id, type, title, message, pet_name, location, reunion_case_id)
    values (s.reporter_id, 'system', upper(v_name) || ' LEFT THAT SPOT',
      'The owner says ' || v_name || ' is no longer near ' || s.location || '. Did you see where it went? Tap to share a new sighting.',
      v_name, s.location, v_case);
  end if;

  -- everyone else who reported this pet: keep an eye out nearby
  for r in
    select distinct x.reporter_id from public.community_sightings x
    where x.missing_pet_id = m.id and x.reporter_id is not null and x.reporter_id <> v_uid
      and x.reporter_id is distinct from s.reporter_id
  loop
    insert into public.notifications (recipient_id, type, title, message, pet_name, location)
    values (r.reporter_id, 'system', upper(v_name) || ' MOVED ON',
      'The owner says ' || v_name || ' is no longer near ' || s.location || '. If you pass by, please keep an eye out.',
      v_name, s.location);
  end loop;
end;
$$;

revoke all on function public.mark_sighting_moved_on(uuid) from public, anon;
grant execute on function public.mark_sighting_moved_on(uuid) to authenticated;
