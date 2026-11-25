-- Euthanasia of an impounded animal that nobody claimed during its claim period.
-- A new final outcome, 'euthanized', with the record kept on the impound: why, which veterinarian, when.
--
-- The database enforces the rules, not just the screen:
--   - only an animal that is in holding or was forfeited can be euthanized
--   - its claim period must have ended
--   - no owner claim may be waiting on it, it must not be moving to another facility, and it must not be in rehabilitation
--   - the reason, the veterinarian and the time are required (an "other" reason needs an explanation)
--   - once recorded it cannot be changed or undone

alter table public.impounded_pets drop constraint if exists impounded_pets_status_check;
alter table public.impounded_pets add constraint impounded_pets_status_check
  check (status in ('in_holding', 'claimed', 'forfeited', 'transferred', 'deceased', 'euthanized'));

alter table public.impounded_pets
  add column if not exists euthanasia_reason text,
  add column if not exists euthanasia_vet text,
  add column if not exists euthanasia_license text,
  add column if not exists euthanasia_notes text,
  add column if not exists euthanized_at timestamptz,
  add column if not exists euthanized_by uuid references auth.users(id) on delete set null;

alter table public.impounded_pets drop constraint if exists impounded_pets_euthanasia_reason_check;
alter table public.impounded_pets add constraint impounded_pets_euthanasia_reason_check
  check (euthanasia_reason is null or euthanasia_reason in ('untreatable', 'dangerous', 'contagious', 'other'));

alter table public.impounded_pets drop constraint if exists impounded_pets_euthanasia_lengths;
alter table public.impounded_pets add constraint impounded_pets_euthanasia_lengths
  check ((euthanasia_vet is null or char_length(euthanasia_vet) <= 120)
     and (euthanasia_license is null or char_length(euthanasia_license) <= 60)
     and (euthanasia_notes is null or char_length(euthanasia_notes) <= 1000));

-- An euthanized row is always complete
alter table public.impounded_pets drop constraint if exists impounded_pets_euthanasia_complete;
alter table public.impounded_pets add constraint impounded_pets_euthanasia_complete
  check (status <> 'euthanized'
         or (euthanasia_reason is not null
             and char_length(btrim(coalesce(euthanasia_vet, ''))) >= 2
             and euthanized_at is not null
             and (euthanasia_reason <> 'other' or char_length(btrim(coalesce(euthanasia_notes, ''))) >= 5)));

create or replace function private.impound_euthanasia_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'euthanized' then
      raise exception 'An animal has to be impounded before it can be euthanized.';
    end if;
    return new;
  end if;

  -- a recorded euthanasia is final
  if old.status = 'euthanized' then
    if new.status is distinct from 'euthanized'
       or new.euthanasia_reason is distinct from old.euthanasia_reason
       or new.euthanasia_vet is distinct from old.euthanasia_vet
       or new.euthanasia_license is distinct from old.euthanasia_license
       or new.euthanasia_notes is distinct from old.euthanasia_notes
       or new.euthanized_at is distinct from old.euthanized_at then
      raise exception 'A euthanasia record cannot be changed.';
    end if;
    return new;
  end if;

  if new.status = 'euthanized' then
    if old.status not in ('in_holding', 'forfeited') then
      raise exception 'Only an animal that is in holding or was never claimed can be euthanized.';
    end if;
    if old.claim_deadline > now() then
      raise exception 'The claim period has not ended yet.';
    end if;
    if old.transfer_status = 'pending' then
      raise exception 'This animal is being moved to another facility.';
    end if;
    if exists (select 1 from public.impound_claims c where c.impound_id = old.id and c.status = 'pending') then
      raise exception 'An owner has a claim waiting on this animal. Decide the claim first.';
    end if;
    if exists (select 1 from public.rehab_cases r where r.impound_id = old.id and r.stage <> 'withdrawn') then
      raise exception 'This animal is in rehabilitation. Withdraw it first.';
    end if;
    if new.euthanized_at > now() + interval '5 minutes' then
      raise exception 'The time of the euthanasia cannot be in the future.';
    end if;
    new.euthanized_by := auth.uid();
    new.closed_at := coalesce(new.closed_at, new.euthanized_at);
  else
    -- the euthanasia fields belong to an euthanized record only
    new.euthanasia_reason := old.euthanasia_reason;
    new.euthanasia_vet := old.euthanasia_vet;
    new.euthanasia_license := old.euthanasia_license;
    new.euthanasia_notes := old.euthanasia_notes;
    new.euthanized_at := old.euthanized_at;
  end if;
  return new;
end;
$$;

drop trigger if exists impound_euthanasia_guard on public.impounded_pets;
create trigger impound_euthanasia_guard before insert or update on public.impounded_pets
  for each row execute function private.impound_euthanasia_guard();
