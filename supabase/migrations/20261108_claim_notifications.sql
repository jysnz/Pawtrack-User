-- A claim now (1) keeps the finder's number on the claim, so the claimant can see it again later, and
-- (2) alerts both people: the finder ("someone claimed the pet you reported") and the claimant ("you claimed this pet").

alter table public.sighting_claims
  add column if not exists finder_phone text check (finder_phone is null or char_length(finder_phone) <= 30);

create or replace function public.claim_sighting(p_sighting_id uuid, p_phone text, p_message text, p_photo_path text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.community_sightings%rowtype;
  v_name text;
  v_finder_phone text;
  v_what text;
begin
  if v_uid is null then
    raise exception 'Sign in to claim a pet';
  end if;
  if char_length(btrim(coalesce(p_phone, ''))) < 6 or char_length(p_phone) > 30 then
    raise exception 'Please enter a valid phone number';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) < 5 or char_length(p_message) > 500 then
    raise exception 'Tell the finder how you know this is your pet (5 to 500 characters)';
  end if;
  if p_photo_path is null or p_photo_path not like v_uid::text || '/%' or char_length(p_photo_path) > 300 then
    raise exception 'Add a photo of you with the pet';
  end if;

  select * into v_s from public.community_sightings where id = p_sighting_id;
  if not found or v_s.status in ('archived', 'dismissed') then
    raise exception 'This report is no longer available';
  end if;
  if v_s.reporter_id is not null and v_s.reporter_id = v_uid then
    raise exception 'You sent this report yourself';
  end if;

  if (select count(*) from public.sighting_claims c
      where c.claimant_id = v_uid and c.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many claims were sent recently. Please try again later.';
  end if;

  select coalesce(nullif(btrim(g.full_name), ''), 'A PawTrack guardian') into v_name
  from public.guardians g where g.id = v_uid;
  v_name := coalesce(v_name, 'A PawTrack guardian');

  select c.phone into v_finder_phone from public.sighting_contacts c where c.sighting_id = p_sighting_id;
  v_what := coalesce(nullif(btrim(v_s.breed), ''), v_s.species);

  begin
    insert into public.sighting_claims (sighting_id, claimant_id, phone, message, photo_path, claimant_name, finder_phone)
    values (p_sighting_id, v_uid, btrim(p_phone), btrim(p_message), p_photo_path, v_name, v_finder_phone);
  exception when unique_violation then
    raise exception 'You already claimed this pet';
  end;

  -- To the finder
  if v_s.reporter_id is not null then
    insert into public.notifications (recipient_id, type, title, message, pet_name, location)
    values (
      v_s.reporter_id,
      'system',
      'SOMEONE CLAIMED THE PET YOU REPORTED',
      v_name || ' says the ' || v_what || ' you reported near ' || v_s.location || ' is theirs. Phone: ' || btrim(p_phone)
        || '. Message: "' || btrim(p_message) || '". Open the report on the Sightings page to see their photo.',
      v_what,
      v_s.location
    );
  end if;

  -- To the claimant
  insert into public.notifications (recipient_id, type, title, message, pet_name, location)
  values (
    v_uid,
    'system',
    'YOU CLAIMED A PET',
    'You said the ' || v_what || ' reported near ' || v_s.location || ' is yours. The finder was alerted'
      || case when v_finder_phone is not null then ' and can call you. Finder phone: ' || v_finder_phone || '.' else ' and will contact you on the number you gave.' end,
    v_what,
    v_s.location
  );

  return v_finder_phone;
end;
$$;

revoke all on function public.claim_sighting(uuid, text, text, text) from public, anon;
grant execute on function public.claim_sighting(uuid, text, text, text) to authenticated;
