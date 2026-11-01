-- Sighting contacts and claims.
-- 1) The finder's phone number is stored privately (community_sightings is public, so it cannot live there).
--    Only the finder, the guardian who reported the matching missing pet, and admins can read it.
-- 2) A signed-in guardian can claim that a reported pet is theirs. The claim alerts the finder and gives the
--    claimant the finder's phone number so they can arrange to meet.

create table if not exists public.sighting_contacts (
  sighting_id uuid primary key references public.community_sightings(id) on delete cascade,
  phone text not null check (char_length(btrim(phone)) between 6 and 30),
  created_at timestamptz not null default now()
);

alter table public.sighting_contacts enable row level security;

create policy "Finders add the contact for their own sighting"
  on public.sighting_contacts for insert to authenticated
  with check (exists (select 1 from public.community_sightings s
                      where s.id = sighting_id and s.reporter_id = (select auth.uid())));

create policy "Finders, owners of the matching pet and admins read sighting contacts"
  on public.sighting_contacts for select to authenticated
  using (
    (select private.is_approved_admin())
    or exists (select 1 from public.community_sightings s
               where s.id = sighting_id
                 and (s.reporter_id = (select auth.uid())
                      or exists (select 1 from public.missing_pets m
                                 where m.id = s.missing_pet_id and m.reporter_id = (select auth.uid()))))
  );

create table if not exists public.sighting_claims (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null references public.community_sightings(id) on delete cascade,
  claimant_id uuid not null references auth.users(id) on delete cascade,
  phone text not null check (char_length(btrim(phone)) between 6 and 30),
  message text not null check (char_length(btrim(message)) between 5 and 500),
  created_at timestamptz not null default now(),
  unique (sighting_id, claimant_id)
);

alter table public.sighting_claims enable row level security;

-- Claims are only created through claim_sighting(); people can read their own
create policy "Claimants read their own claims; admins all"
  on public.sighting_claims for select to authenticated
  using (claimant_id = (select auth.uid()) or (select private.is_approved_admin()));

create or replace function public.claim_sighting(p_sighting_id uuid, p_phone text, p_message text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.community_sightings%rowtype;
  v_name text;
  v_finder_phone text;
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

  begin
    insert into public.sighting_claims (sighting_id, claimant_id, phone, message)
    values (p_sighting_id, v_uid, btrim(p_phone), btrim(p_message));
  exception when unique_violation then
    raise exception 'You already claimed this pet';
  end;

  select coalesce(nullif(btrim(g.full_name), ''), 'A PawTrack guardian') into v_name
  from public.guardians g where g.id = v_uid;
  v_name := coalesce(v_name, 'A PawTrack guardian');

  if v_s.reporter_id is not null then
    insert into public.notifications (recipient_id, type, title, message, pet_name, location)
    values (
      v_s.reporter_id,
      'system',
      'SOMEONE CLAIMED THE PET YOU REPORTED',
      v_name || ' says the ' || coalesce(nullif(btrim(v_s.breed), ''), v_s.species)
        || ' you reported near ' || v_s.location || ' is theirs. Phone: ' || btrim(p_phone)
        || '. Message: "' || btrim(p_message) || '"',
      coalesce(nullif(btrim(v_s.breed), ''), v_s.species),
      v_s.location
    );
  end if;

  select c.phone into v_finder_phone from public.sighting_contacts c where c.sighting_id = p_sighting_id;
  return v_finder_phone;
end;
$$;

revoke all on function public.claim_sighting(uuid, text, text) from public, anon;
grant execute on function public.claim_sighting(uuid, text, text) to authenticated;
