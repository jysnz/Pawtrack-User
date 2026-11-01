-- The finder who sent a report can mark a claim as reunited, or discard it. Both people are notified, and
-- every claim notification carries the claim's id so tapping it can open the details.

alter table public.sighting_claims
  add column if not exists status text not null default 'pending' check (status in ('pending', 'reunited', 'discarded')),
  add column if not exists resolved_at timestamptz;

alter table public.notifications
  add column if not exists sighting_claim_id uuid references public.sighting_claims(id) on delete set null;

-- Claim notifications sent before this change
update public.notifications n
set sighting_claim_id = c.id
from public.sighting_claims c
join public.community_sightings s on s.id = c.sighting_id
where n.sighting_claim_id is null
  and n.type = 'system'
  and ((n.title = 'YOU CLAIMED A PET' and n.recipient_id = c.claimant_id)
    or (n.title = 'SOMEONE CLAIMED THE PET YOU REPORTED' and n.recipient_id = s.reporter_id))
  and n.created_at between c.created_at - interval '1 minute' and c.created_at + interval '1 minute';

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
  v_claim uuid;
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
    values (p_sighting_id, v_uid, btrim(p_phone), btrim(p_message), p_photo_path, v_name, v_finder_phone)
    returning id into v_claim;
  exception when unique_violation then
    raise exception 'You already claimed this pet';
  end;

  if v_s.reporter_id is not null then
    insert into public.notifications (recipient_id, type, title, message, pet_name, location, sighting_claim_id)
    values (
      v_s.reporter_id,
      'system',
      'SOMEONE CLAIMED THE PET YOU REPORTED',
      v_name || ' says the ' || v_what || ' you reported near ' || v_s.location || ' is theirs. Tap to review the claim, then mark the pet as reunited or discard the claim.',
      v_what,
      v_s.location,
      v_claim
    );
  end if;

  insert into public.notifications (recipient_id, type, title, message, pet_name, location, sighting_claim_id)
  values (
    v_uid,
    'system',
    'YOU CLAIMED A PET',
    'You said the ' || v_what || ' reported near ' || v_s.location || ' is yours. The finder was alerted'
      || case when v_finder_phone is not null then ' and can call you. Tap to see the details.' else ' and will contact you on the number you gave. Tap to see the details.' end,
    v_what,
    v_s.location,
    v_claim
  );

  return v_finder_phone;
end;
$$;

revoke all on function public.claim_sighting(uuid, text, text, text) from public, anon;
grant execute on function public.claim_sighting(uuid, text, text, text) to authenticated;

-- p_action: 'reunited' (the pet went home with the claimant) or 'discarded' (the claim is rejected)
create or replace function public.resolve_claim(p_claim_id uuid, p_action text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_c public.sighting_claims%rowtype;
  v_s public.community_sightings%rowtype;
  v_what text;
  v_other record;
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;
  if p_action not in ('reunited', 'discarded') then
    raise exception 'Unknown action';
  end if;

  select * into v_c from public.sighting_claims where id = p_claim_id;
  if not found then
    raise exception 'Claim not found';
  end if;
  select * into v_s from public.community_sightings where id = v_c.sighting_id;
  if not found or v_s.reporter_id is null or v_s.reporter_id <> v_uid then
    raise exception 'Only the finder who sent this report can review its claims';
  end if;
  if v_c.status <> 'pending' then
    raise exception 'This claim was already reviewed';
  end if;

  v_what := coalesce(nullif(btrim(v_s.breed), ''), v_s.species);

  update public.sighting_claims set status = p_action, resolved_at = now() where id = p_claim_id;

  if p_action = 'reunited' then
    -- The pet is home: close the report, and discard any other pending claims on it
    update public.community_sightings set status = 'archived' where id = v_s.id;

    for v_other in
      select id, claimant_id from public.sighting_claims
      where sighting_id = v_s.id and status = 'pending' and id <> p_claim_id
    loop
      update public.sighting_claims set status = 'discarded', resolved_at = now() where id = v_other.id;
      insert into public.notifications (recipient_id, type, title, message, pet_name, location, sighting_claim_id)
      values (v_other.claimant_id, 'system', 'YOUR CLAIM WAS CLOSED',
        'The ' || v_what || ' reported near ' || v_s.location || ' went home with another claimant, so your claim was closed.',
        v_what, v_s.location, v_other.id);
    end loop;

    insert into public.notifications (recipient_id, type, title, message, pet_name, location, sighting_claim_id)
    values (v_c.claimant_id, 'reunited', 'REUNITED! YOUR CLAIM WAS CONFIRMED',
      'The finder confirmed that the ' || v_what || ' reported near ' || v_s.location || ' is yours. Tap to see the details.',
      v_what, v_s.location, p_claim_id);

    insert into public.notifications (recipient_id, type, title, message, pet_name, location, sighting_claim_id)
    values (v_uid, 'reunited', 'YOU MARKED A PET AS REUNITED',
      'You marked the ' || v_what || ' reported near ' || v_s.location || ' as reunited with ' || coalesce(v_c.claimant_name, 'its owner') || '. Tap to see the details.',
      v_what, v_s.location, p_claim_id);
  else
    insert into public.notifications (recipient_id, type, title, message, pet_name, location, sighting_claim_id)
    values (v_c.claimant_id, 'system', 'YOUR CLAIM WAS DISCARDED',
      'The finder discarded your claim on the ' || v_what || ' reported near ' || v_s.location || '. Tap to see the details.',
      v_what, v_s.location, p_claim_id);

    insert into public.notifications (recipient_id, type, title, message, pet_name, location, sighting_claim_id)
    values (v_uid, 'system', 'YOU DISCARDED A CLAIM',
      'You discarded ' || coalesce(v_c.claimant_name, 'a') || '''s claim on the ' || v_what || ' reported near ' || v_s.location || '. Tap to see the details.',
      v_what, v_s.location, p_claim_id);
  end if;

  return p_action;
end;
$$;

revoke all on function public.resolve_claim(uuid, text) from public, anon;
grant execute on function public.resolve_claim(uuid, text) to authenticated;
