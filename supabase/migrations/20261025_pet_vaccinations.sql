-- Vaccination records for registered pets. Owners manage the records of their own pets; admins manage all.

create table if not exists public.pet_vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.registered_pets(id) on delete cascade,
  vaccine_name text not null check (char_length(btrim(vaccine_name)) between 1 and 120),
  date_given date not null,
  next_due_date date,
  veterinarian text check (veterinarian is null or char_length(veterinarian) <= 120),
  clinic text check (clinic is null or char_length(clinic) <= 160),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  check (next_due_date is null or next_due_date >= date_given)
);

create index if not exists pet_vaccinations_pet_id_idx on public.pet_vaccinations (pet_id, date_given desc);

alter table public.pet_vaccinations enable row level security;

create policy "Owners see vaccinations of their pets; admins see all"
  on public.pet_vaccinations for select to authenticated
  using (exists (
    select 1 from public.registered_pets p
    where p.id = pet_id
      and (p.owner_id = (select auth.uid()) or (select private.is_approved_admin()))
  ));

create policy "Owners add vaccinations to their pets; admins to any"
  on public.pet_vaccinations for insert to authenticated
  with check (exists (
    select 1 from public.registered_pets p
    where p.id = pet_id
      and (p.owner_id = (select auth.uid()) or (select private.is_approved_admin()))
  ));

create policy "Owners edit vaccinations of their pets; admins all"
  on public.pet_vaccinations for update to authenticated
  using (exists (
    select 1 from public.registered_pets p
    where p.id = pet_id
      and (p.owner_id = (select auth.uid()) or (select private.is_approved_admin()))
  ))
  with check (exists (
    select 1 from public.registered_pets p
    where p.id = pet_id
      and (p.owner_id = (select auth.uid()) or (select private.is_approved_admin()))
  ));

create policy "Owners delete vaccinations of their pets; admins all"
  on public.pet_vaccinations for delete to authenticated
  using (exists (
    select 1 from public.registered_pets p
    where p.id = pet_id
      and (p.owner_id = (select auth.uid()) or (select private.is_approved_admin()))
  ));

-- Tap page: the vaccine names and dates of the pet on a tag, without veterinarian, clinic or notes.
create or replace function public.get_pet_vaccinations_by_nfc(p_tag text)
returns table (vaccine_name text, date_given date, next_due_date date)
language sql stable security definer set search_path = ''
as $$
  select v.vaccine_name, v.date_given, v.next_due_date
  from public.pet_vaccinations v
  join public.registered_pets p on p.id = v.pet_id
  where lower(p.nfc_tag) = lower(btrim(p_tag))
  order by v.date_given desc, v.created_at desc
  limit 50;
$$;

revoke all on function public.get_pet_vaccinations_by_nfc(text) from public;
grant execute on function public.get_pet_vaccinations_by_nfc(text) to anon, authenticated;
