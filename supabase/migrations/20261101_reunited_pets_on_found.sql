-- Marking a pet as found records it in reunited_pets.
-- Done in the database so every path (My Pets, the map, the admin portal) is covered by one rule.

alter table public.reunited_pets
  add column if not exists missing_report_id uuid references public.missing_pets(id) on delete set null;

-- One reunion per report, so a repeated update never adds a second row
create unique index if not exists reunited_pets_one_per_report
  on public.reunited_pets (missing_report_id) where missing_report_id is not null;

-- A report that goes from open to 'found' becomes a reunited_pets row
create or replace function public.record_reunited_pet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'found' and old.status is distinct from 'found' then
    insert into public.reunited_pets
      (missing_report_id, pet_id, pet_name, species, breed, photo_url, found_location, lat, lng, days_missing, reunited_at)
    values
      (new.id, new.pet_id, new.pet_name, new.species, new.breed, new.photo_url, new.last_seen_location, new.lat, new.lng,
       greatest(0, (now()::date - coalesce(new.last_seen_at, new.created_at)::date)), now())
    on conflict (missing_report_id) where missing_report_id is not null do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.record_reunited_pet() from public, anon, authenticated;

drop trigger if exists missing_pets_record_reunion on public.missing_pets;
create trigger missing_pets_record_reunion
  after update of status on public.missing_pets
  for each row execute function public.record_reunited_pet();

-- A pet set back to safe closes its open reports, which then record the reunion above
create or replace function public.close_reports_when_pet_safe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'safe' and old.status = 'missing' then
    update public.missing_pets
       set status = 'found', updated_at = now()
     where pet_id = new.id and status in ('missing', 'sighted');
  end if;
  return new;
end;
$$;

revoke all on function public.close_reports_when_pet_safe() from public, anon, authenticated;

drop trigger if exists registered_pets_close_reports on public.registered_pets;
create trigger registered_pets_close_reports
  after update of status on public.registered_pets
  for each row execute function public.close_reports_when_pet_safe();

-- Reports already marked found before this existed
insert into public.reunited_pets
  (missing_report_id, pet_id, pet_name, species, breed, photo_url, found_location, lat, lng, days_missing, reunited_at)
select m.id, m.pet_id, m.pet_name, m.species, m.breed, m.photo_url, m.last_seen_location, m.lat, m.lng,
       greatest(0, (coalesce(m.updated_at, m.created_at)::date - coalesce(m.last_seen_at, m.created_at)::date)),
       coalesce(m.updated_at, m.created_at)
  from public.missing_pets m
 where m.status = 'found'
on conflict (missing_report_id) where missing_report_id is not null do nothing;
