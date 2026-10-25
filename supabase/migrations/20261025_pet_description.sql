-- AI-written pet description, shown on the pet's page and on the NFC tap page.
alter table public.registered_pets
  add column if not exists description text
    check (description is null or char_length(description) <= 1000);

-- The tap page now also gets the description, so the return type changes
drop function if exists public.get_pet_by_nfc(text);

create function public.get_pet_by_nfc(p_tag text)
returns table (
  id uuid, name text, species text, breed text, gender text, color text,
  age_months integer, status text, photo_url text, community text, registered_on date,
  description text
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.species, p.breed, p.gender, p.color,
         p.age_months, p.status, p.photo_url, p.community, p.registered_on,
         p.description
  from public.registered_pets p
  where lower(p.nfc_tag) = lower(btrim(p_tag))
  limit 1;
$$;

revoke all on function public.get_pet_by_nfc(text) from public;
grant execute on function public.get_pet_by_nfc(text) to anon, authenticated;
