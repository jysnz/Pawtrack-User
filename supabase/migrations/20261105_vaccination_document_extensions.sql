-- Vaccination documents: the stored file name must end in a safe extension (jpg, png, webp or pdf),
-- on top of the bucket's allowed MIME types and size limit. The browser also checks file contents before upload.
drop policy if exists "Owners upload vaccination documents to their folder" on storage.objects;

create policy "Owners upload vaccination documents to their folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'vaccination-documents'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and name ~* '\.(jpg|png|webp|pdf)$');
