-- NFC tag linking: pet age, unique tag identifier, and safe public functions for the tap page.

alter table public.registered_pets
  add column if not exists age_months integer
    check (age_months is null or age_months between 0 and 600),
  add column if not exists nfc_serial text;

-- One physical tag / one tag ID can only ever point at one pet
create unique index if not exists registered_pets_nfc_tag_key
  on public.registered_pets (lower(nfc_tag)) where nfc_tag is not null;
create unique index if not exists registered_pets_nfc_serial_key
  on public.registered_pets (lower(nfc_serial)) where nfc_serial is not null;

-- Public lookup used by the tap page. Never returns owner name, phone or email.
create or replace function public.get_pet_by_nfc(p_tag text)
returns table (
  id uuid, name text, species text, breed text, gender text, color text,
  age_months integer, status text, photo_url text, community text, registered_on date
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.species, p.breed, p.gender, p.color,
         p.age_months, p.status, p.photo_url, p.community, p.registered_on
  from public.registered_pets p
  where lower(p.nfc_tag) = lower(btrim(p_tag))
  limit 1;
$$;

-- Lets a finder alert the owner without seeing the owner's contact details.
create or replace function public.notify_owner_found(
  p_tag text, p_phone text, p_location text, p_notes text default null
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_pet public.registered_pets%rowtype;
begin
  if char_length(btrim(coalesce(p_phone, ''))) < 6 or char_length(p_phone) > 30 then
    raise exception 'Please enter a valid phone number';
  end if;
  if char_length(btrim(coalesce(p_location, ''))) < 2 or char_length(p_location) > 300 then
    raise exception 'Please enter where the pet was found';
  end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'Message is too long';
  end if;

  select * into v_pet from public.registered_pets
  where lower(nfc_tag) = lower(btrim(p_tag)) limit 1;
  if not found then
    return false;
  end if;

  -- Stop a tag link from being used to spam an owner
  if (select count(*) from public.notifications n
      where n.recipient_id is not distinct from v_pet.owner_id
        and n.pet_name = v_pet.name
        and n.type = 'sighting_verification'
        and n.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many alerts were sent for this pet recently. Please try again later.';
  end if;

  insert into public.notifications (recipient_id, type, title, message, pet_name, location)
  values (
    v_pet.owner_id,
    'sighting_verification',
    'GOOD SAMARITAN FOUND YOUR PET: "' || upper(v_pet.name) || '"!',
    'Someone scanned the NFC tag and reported ' || v_pet.name || ' near ' || btrim(p_location)
      || '. Finder phone: ' || btrim(p_phone)
      || coalesce('. Message: "' || nullif(btrim(p_notes), '') || '"', ''),
    v_pet.name,
    btrim(p_location)
  );

  update public.nfc_tags set last_scanned_at = now() where lower(code) = lower(v_pet.nfc_tag);
  return true;
end;
$$;

revoke all on function public.get_pet_by_nfc(text) from public;
revoke all on function public.notify_owner_found(text, text, text, text) from public;
grant execute on function public.get_pet_by_nfc(text) to anon, authenticated;
grant execute on function public.notify_owner_found(text, text, text, text) to anon, authenticated;
