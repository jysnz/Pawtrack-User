-- Reunion cases: what happens after an owner confirms a sighting is their pet.
--   confirm_sighting        owner confirms -> the sighting is Confirmed, a case opens, the finder is told
--   case trigger            owner marks the pet found -> the finder is asked "Did {pet} go home?"
--   finder_confirm_handover the finder answers; both sides complete (or flag) the reunion
--   owner_case_response     owner says "still searching" or "it wasn't my pet"
--   mark_sighting_moved_on  the pet is no longer at that spot
--   send_case_reminders     follow-up reminders at 24h and 72h (run when the app opens)
--   case_details            what the case screen shows, including the other person's number

alter table public.community_sightings add column if not exists moved_on_at timestamptz;

create table if not exists public.reunion_cases (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null references public.community_sightings(id) on delete cascade,
  missing_pet_id uuid references public.missing_pets(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  finder_id uuid references auth.users(id) on delete set null,
  status text not null default 'connecting'
    check (status in ('connecting', 'owner_marked', 'reunited', 'disputed', 'still_searching', 'not_mine')),
  owner_confirmed_at timestamptz not null default now(),
  owner_marked_at timestamptz,
  finder_answer text check (finder_answer in ('yes', 'no')),
  finder_answered_at timestamptz,
  owner_reminders int not null default 0,
  finder_reminders int not null default 0,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sighting_id, owner_id)
);

alter table public.reunion_cases enable row level security;

create policy "Owner and finder read their reunion case; admins all"
  on public.reunion_cases for select to authenticated
  using (owner_id = (select auth.uid()) or finder_id = (select auth.uid()) or (select private.is_approved_admin()));

alter table public.notifications
  add column if not exists reunion_case_id uuid references public.reunion_cases(id) on delete set null;

-- helper: a person's name for a notification
create or replace function private.person_name(p_id uuid)
returns text language sql stable security definer set search_path = ''
as $$ select coalesce(nullif(btrim(g.full_name), ''), 'A PawTrack guardian') from public.guardians g where g.id = p_id $$;

-- 1) owner confirms a sighting
create or replace function public.confirm_sighting(p_sighting_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  s public.community_sightings%rowtype;
  m public.missing_pets%rowtype;
  v_case uuid;
  v_owner text;
  v_phone text;
  v_what text;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into s from public.community_sightings where id = p_sighting_id;
  if not found then raise exception 'Sighting not found'; end if;
  select * into m from public.missing_pets where id = s.missing_pet_id and reporter_id = v_uid;
  if not found then raise exception 'Only the guardian who reported this pet missing can confirm it'; end if;

  update public.community_sightings set status = 'confirmed_sighting' where id = s.id;

  insert into public.reunion_cases (sighting_id, missing_pet_id, owner_id, finder_id)
  values (s.id, m.id, v_uid, s.reporter_id)
  on conflict (sighting_id, owner_id) do update
    set status = case when public.reunion_cases.status in ('not_mine', 'still_searching') then 'connecting' else public.reunion_cases.status end,
        owner_confirmed_at = now(),
        finder_id = coalesce(public.reunion_cases.finder_id, excluded.finder_id)
  returning id into v_case;

  v_owner := private.person_name(v_uid);
  select g.phone into v_phone from public.guardians g where g.id = v_uid;
  v_what := coalesce(nullif(btrim(m.pet_name), ''), nullif(btrim(s.breed), ''), s.species);

  if s.reporter_id is not null and s.reporter_id <> v_uid then
    insert into public.notifications (recipient_id, type, title, message, pet_name, location, reunion_case_id)
    values (s.reporter_id, 'system', 'THE OWNER CONFIRMED YOUR SIGHTING',
      v_owner || ' says the ' || v_what || ' you reported near ' || s.location || ' is their pet. They will contact you'
        || case when v_phone is not null then '. You can also call them: ' || v_phone else ' on the number you gave' end
        || '. Tap to see the next steps.',
      v_what, s.location, v_case);
  end if;
  return v_case;
end;
$$;

-- 2) owner marks the pet found: ask the finder whether it went home
create or replace function private.case_on_pet_found()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare c record;
begin
  if new.status = 'found' and old.status is distinct from 'found' then
    for c in select * from public.reunion_cases where missing_pet_id = new.id and status in ('connecting', 'still_searching') loop
      update public.reunion_cases set status = 'owner_marked', owner_marked_at = now() where id = c.id;
      if c.finder_id is not null and c.finder_id <> c.owner_id then
        insert into public.notifications (recipient_id, type, title, message, pet_name, location, reunion_case_id)
        values (c.finder_id, 'system', 'DID ' || upper(new.pet_name) || ' GO HOME?',
          private.person_name(c.owner_id) || ' marked ' || new.pet_name || ' as found. Please confirm that the pet went home.',
          new.pet_name, new.last_seen_location, c.id);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists missing_pets_case_found on public.missing_pets;
create trigger missing_pets_case_found
  after update of status on public.missing_pets
  for each row execute function private.case_on_pet_found();

-- 3) the finder answers
create or replace function public.finder_confirm_handover(p_case_id uuid, p_yes boolean)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.reunion_cases%rowtype;
  m public.missing_pets%rowtype;
  v_name text;
  v_status text;
begin
  select * into c from public.reunion_cases where id = p_case_id;
  if not found or c.finder_id is distinct from v_uid then raise exception 'Only the finder of this pet can answer'; end if;
  if c.status <> 'owner_marked' then raise exception 'The owner has not marked the pet as found yet'; end if;
  select * into m from public.missing_pets where id = c.missing_pet_id;
  v_name := coalesce(m.pet_name, 'the pet');
  v_status := case when p_yes then 'reunited' else 'disputed' end;

  update public.reunion_cases set finder_answer = case when p_yes then 'yes' else 'no' end, finder_answered_at = now(), status = v_status where id = c.id;

  if p_yes then
    insert into public.notifications (recipient_id, type, title, message, pet_name, location, reunion_case_id)
    values (c.owner_id, 'reunited', 'REUNION CONFIRMED BY THE FINDER',
      private.person_name(v_uid) || ' confirmed that ' || v_name || ' went home. Welcome back, ' || v_name || '!', v_name, m.last_seen_location, c.id),
           (v_uid, 'reunited', 'THANK YOU FOR HELPING ' || upper(v_name) || ' GET HOME',
      'Because of your sighting, ' || v_name || ' is back with ' || private.person_name(c.owner_id) || '. Thank you!', v_name, m.last_seen_location, c.id);
  else
    insert into public.notifications (recipient_id, type, title, message, pet_name, location, reunion_case_id)
    values (c.owner_id, 'system', 'THE FINDER SAYS ' || upper(v_name) || ' DID NOT GO HOME',
      private.person_name(v_uid) || ' says ' || v_name || ' did not go home. Please check with them. Tap to see their contact.', v_name, m.last_seen_location, c.id);
  end if;
  return v_status;
end;
$$;

-- 4) owner: still searching, or it was not their pet
create or replace function public.owner_case_response(p_case_id uuid, p_answer text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.reunion_cases%rowtype;
  m public.missing_pets%rowtype;
  s public.community_sightings%rowtype;
  v_name text;
begin
  if p_answer not in ('searching', 'not_mine') then raise exception 'Unknown answer'; end if;
  select * into c from public.reunion_cases where id = p_case_id;
  if not found or c.owner_id <> v_uid then raise exception 'Only the owner can answer'; end if;
  if c.status not in ('connecting', 'still_searching') then raise exception 'This case is already closed'; end if;
  select * into m from public.missing_pets where id = c.missing_pet_id;
  select * into s from public.community_sightings where id = c.sighting_id;
  v_name := coalesce(m.pet_name, 'the pet');

  if p_answer = 'searching' then
    update public.reunion_cases set status = 'still_searching', last_reminder_at = now(), owner_reminders = 0 where id = c.id;
    return 'still_searching';
  end if;

  update public.reunion_cases set status = 'not_mine' where id = c.id;
  update public.community_sightings set status = 'dismissed' where id = c.sighting_id;
  if c.finder_id is not null and c.finder_id <> v_uid then
    insert into public.notifications (recipient_id, type, title, message, pet_name, location, reunion_case_id)
    values (c.finder_id, 'system', 'THE OWNER SAYS IT WAS NOT THEIR PET',
      'Thank you for looking. ' || private.person_name(v_uid) || ' checked and the pet you reported near ' || s.location || ' is not ' || v_name || '.', v_name, s.location, c.id);
  end if;
  return 'not_mine';
end;
$$;

-- 5) the pet is no longer at that spot
create or replace function public.mark_sighting_moved_on(p_sighting_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); s public.community_sightings%rowtype;
begin
  select * into s from public.community_sightings where id = p_sighting_id;
  if not found or not exists (select 1 from public.missing_pets m where m.id = s.missing_pet_id and m.reporter_id = v_uid) then
    raise exception 'Only the guardian who reported this pet missing can do this';
  end if;
  update public.community_sightings set moved_on_at = now() where id = s.id;
  update public.reunion_cases set status = 'still_searching', last_reminder_at = now(), owner_reminders = 0
    where sighting_id = s.id and owner_id = v_uid and status = 'connecting';
end;
$$;

-- 6) reminders for the signed-in person's own open cases (24h, then 72h)
create or replace function public.send_case_reminders()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c record;
  v_name text;
  v_n int := 0;
begin
  if v_uid is null then return 0; end if;

  for c in select * from public.reunion_cases
           where owner_id = v_uid and status in ('connecting', 'still_searching')
             and ((owner_reminders = 0 and now() - coalesce(last_reminder_at, owner_confirmed_at) >= interval '24 hours')
               or (owner_reminders = 1 and now() - coalesce(last_reminder_at, owner_confirmed_at) >= interval '48 hours')) loop
    select coalesce(m.pet_name, 'your pet') into v_name from public.missing_pets m where m.id = c.missing_pet_id;
    v_name := coalesce(v_name, 'your pet');
    insert into public.notifications (recipient_id, type, title, message, pet_name, reunion_case_id)
    values (v_uid, 'system', 'DID YOU REUNITE WITH ' || upper(v_name) || '?',
      'You confirmed a sighting of ' || v_name || '. Tell us how it went: reunited, still searching, or not your pet.', v_name, c.id);
    update public.reunion_cases set owner_reminders = owner_reminders + 1, last_reminder_at = now() where id = c.id;
    v_n := v_n + 1;
  end loop;

  for c in select * from public.reunion_cases
           where finder_id = v_uid and status = 'owner_marked' and finder_answer is null and finder_reminders = 0
             and now() - owner_marked_at >= interval '24 hours' loop
    select coalesce(m.pet_name, 'the pet') into v_name from public.missing_pets m where m.id = c.missing_pet_id;
    v_name := coalesce(v_name, 'the pet');
    insert into public.notifications (recipient_id, type, title, message, pet_name, reunion_case_id)
    values (v_uid, 'system', 'DID ' || upper(v_name) || ' GO HOME?',
      'The owner marked ' || v_name || ' as found. Please confirm that the pet went home.', v_name, c.id);
    update public.reunion_cases set finder_reminders = 1 where id = c.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- 7) what the case screen shows
create or replace function public.case_details(p_case_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.reunion_cases%rowtype;
  s public.community_sightings%rowtype;
  m public.missing_pets%rowtype;
  g public.guardians%rowtype;
  v_role text;
  v_other uuid;
  v_phone text;
  v_name text;
begin
  select * into c from public.reunion_cases where id = p_case_id;
  if not found or (c.owner_id <> v_uid and c.finder_id is distinct from v_uid) then raise exception 'Case not found'; end if;
  v_role := case when c.owner_id = v_uid then 'owner' else 'finder' end;
  v_other := case when v_role = 'owner' then c.finder_id else c.owner_id end;
  select * into s from public.community_sightings where id = c.sighting_id;
  select * into m from public.missing_pets where id = c.missing_pet_id;
  select * into g from public.guardians where id = v_other;
  if v_role = 'owner' then
    select cc.phone into v_phone from public.sighting_contacts cc where cc.sighting_id = c.sighting_id;
    v_phone := coalesce(v_phone, g.phone);
    v_name := case when s.reporter_name in ('Community Good Samaritan', 'Anonymous') then 'The finder' else coalesce(nullif(btrim(g.full_name), ''), s.reporter_name) end;
  else
    v_phone := g.phone;
    v_name := coalesce(nullif(btrim(g.full_name), ''), 'The owner');
  end if;
  return jsonb_build_object(
    'id', c.id, 'role', v_role, 'status', c.status,
    'owner_confirmed_at', c.owner_confirmed_at, 'owner_marked_at', c.owner_marked_at,
    'finder_answer', c.finder_answer, 'finder_answered_at', c.finder_answered_at,
    'sighting_id', c.sighting_id, 'moved_on_at', s.moved_on_at, 'missing_report_id', m.id, 'registered_pet_id', m.pet_id,
    'pet_name', coalesce(m.pet_name, 'the pet'), 'pet_photo', coalesce(m.photo_url, s.photo_url),
    'sighting_photo', s.photo_url, 'breed', s.breed, 'location', s.location,
    'counterpart_name', v_name, 'counterpart_phone', v_phone);
end;
$$;

revoke all on function public.confirm_sighting(uuid) from public, anon;
revoke all on function public.finder_confirm_handover(uuid, boolean) from public, anon;
revoke all on function public.owner_case_response(uuid, text) from public, anon;
revoke all on function public.mark_sighting_moved_on(uuid) from public, anon;
revoke all on function public.send_case_reminders() from public, anon;
revoke all on function public.case_details(uuid) from public, anon;
revoke all on function private.case_on_pet_found() from public, anon, authenticated;
grant execute on function public.confirm_sighting(uuid) to authenticated;
grant execute on function public.finder_confirm_handover(uuid, boolean) to authenticated;
grant execute on function public.owner_case_response(uuid, text) to authenticated;
grant execute on function public.mark_sighting_moved_on(uuid) to authenticated;
grant execute on function public.send_case_reminders() to authenticated;
grant execute on function public.case_details(uuid) to authenticated;
