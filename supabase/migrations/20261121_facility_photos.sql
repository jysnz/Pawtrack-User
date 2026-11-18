-- Facility photos: a public bucket whose files each live in a folder named after the facility they belong to
-- (facility-photos/<shelter id>/<file>.jpg). Anyone can see a facility's photo (the owner app shows it on the map),
-- but only a manager of that facility, or of its main facility, can add, replace or delete files in its folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('facility-photos', 'facility-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Managers upload their facility photos" on storage.objects;
create policy "Managers upload their facility photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'facility-photos'
    and (storage.foldername(name))[1] = any (
      select id::text from unnest(coalesce((select private.my_managed_shelter_ids()), array[]::uuid[])) as id
    )
  );

drop policy if exists "Managers replace their facility photos" on storage.objects;
create policy "Managers replace their facility photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'facility-photos'
    and (storage.foldername(name))[1] = any (
      select id::text from unnest(coalesce((select private.my_managed_shelter_ids()), array[]::uuid[])) as id
    )
  )
  with check (
    bucket_id = 'facility-photos'
    and (storage.foldername(name))[1] = any (
      select id::text from unnest(coalesce((select private.my_managed_shelter_ids()), array[]::uuid[])) as id
    )
  );

drop policy if exists "Managers delete their facility photos" on storage.objects;
create policy "Managers delete their facility photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'facility-photos'
    and (storage.foldername(name))[1] = any (
      select id::text from unnest(coalesce((select private.my_managed_shelter_ids()), array[]::uuid[])) as id
    )
  );
