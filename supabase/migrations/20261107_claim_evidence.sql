-- Claiming a reported pet now needs a photo of the claimant with the pet.
-- Photos live in a private bucket (<claimant id>/<file>); only the claimant, the finder who sent the report, and admins can read them.

alter table public.sighting_claims
  add column if not exists claimant_name text check (claimant_name is null or char_length(claimant_name) <= 120),
  add column if not exists photo_path text check (photo_path is null or char_length(photo_path) <= 300);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('claim-evidence', 'claim-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Claimants upload evidence to their folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'claim-evidence'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and name ~* '\.(jpg|png|webp)$');

create policy "Claimants, the finder and admins read claim evidence"
  on storage.objects for select to authenticated
  using (bucket_id = 'claim-evidence'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or (select private.is_approved_admin())
              or exists (select 1 from public.sighting_claims c
                         join public.community_sightings s on s.id = c.sighting_id
                         where c.photo_path = storage.objects.name and s.reporter_id = (select auth.uid()))));

create policy "Claimants delete their own evidence"
  on storage.objects for delete to authenticated
  using (bucket_id = 'claim-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- The finder who sent a report can read the claims made on it
create policy "Finders read claims on their sightings"
  on public.sighting_claims for select to authenticated
  using (exists (select 1 from public.community_sightings s
                 where s.id = sighting_id and s.reporter_id = (select auth.uid())));

drop function if exists public.claim_sighting(uuid, text, text);

create or replace function public.claim_sighting(p_sighting_id uuid, p_phone text, p_message text, p_photo_path text)
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

  begin
    insert into public.sighting_claims (sighting_id, claimant_id, phone, message, photo_path, claimant_name)
    values (p_sighting_id, v_uid, btrim(p_phone), btrim(p_message), p_photo_path, v_name);
  exception when unique_violation then
    raise exception 'You already claimed this pet';
  end;

  if v_s.reporter_id is not null then
    insert into public.notifications (recipient_id, type, title, message, pet_name, location)
    values (
      v_s.reporter_id,
      'system',
      'SOMEONE CLAIMED THE PET YOU REPORTED',
      v_name || ' says the ' || coalesce(nullif(btrim(v_s.breed), ''), v_s.species)
        || ' you reported near ' || v_s.location || ' is theirs. Phone: ' || btrim(p_phone)
        || '. Message: "' || btrim(p_message) || '". Open the report on the Sightings page to see their photo.',
      coalesce(nullif(btrim(v_s.breed), ''), v_s.species),
      v_s.location
    );
  end if;

  select c.phone into v_finder_phone from public.sighting_contacts c where c.sighting_id = p_sighting_id;
  return v_finder_phone;
end;
$$;

revoke all on function public.claim_sighting(uuid, text, text, text) from public, anon;
grant execute on function public.claim_sighting(uuid, text, text, text) to authenticated;
