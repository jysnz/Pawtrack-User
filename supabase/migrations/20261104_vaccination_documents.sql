-- Proof-of-vaccination documents (photo or PDF) attached to a vaccination record.
-- Files live in a private bucket under <owner id>/<pet id>/<file>; the record keeps the path so the document stays with it.

alter table public.pet_vaccinations
  add column if not exists document_path text check (document_path is null or char_length(document_path) <= 300),
  add column if not exists document_name text check (document_name is null or char_length(document_name) <= 200),
  add column if not exists document_type text check (document_type is null or char_length(document_type) <= 100);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vaccination-documents', 'vaccination-documents', false, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners read their vaccination documents; admins all"
  on storage.objects for select to authenticated
  using (bucket_id = 'vaccination-documents'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_approved_admin())));

create policy "Owners upload vaccination documents to their folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'vaccination-documents'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners delete their vaccination documents; admins all"
  on storage.objects for delete to authenticated
  using (bucket_id = 'vaccination-documents'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_approved_admin())));
