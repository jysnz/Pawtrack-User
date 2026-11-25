-- The rehabilitation track no longer has an "assessment" stage: intake already records the photo, tag and condition,
-- and the vet exam and parasite checks now live in the Medical care stage.
--   medical  ->  behavior  ->  clearance  ->  ready      (and 'withdrawn')

-- Anything already sitting in assessment moves to medical care, its first stage now
update public.rehab_cases set stage = 'medical' where stage = 'assessment';

alter table public.rehab_cases drop constraint if exists rehab_cases_stage_check;
alter table public.rehab_cases add constraint rehab_cases_stage_check
  check (stage in ('medical', 'behavior', 'clearance', 'ready', 'withdrawn'));
alter table public.rehab_cases alter column stage set default 'medical';

create or replace function private.rehab_case_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select i.shelter_id into new.shelter_id from public.impounded_pets i where i.id = new.impound_id;
    if new.shelter_id is null then raise exception 'That animal is not impounded here.'; end if;
    new.stage := 'medical';
    new.started_at := now();
    new.stage_changed_at := now();
    new.ready_at := null;
  else
    new.impound_id := old.impound_id;
    new.shelter_id := old.shelter_id;
    new.started_at := old.started_at;
    if new.stage is distinct from old.stage then
      new.stage_changed_at := now();
      -- the only way into 'ready' is from clearance, so the earlier stages cannot be skipped
      if new.stage = 'ready' and old.stage <> 'clearance' then
        raise exception 'An animal must pass the final clearance before it is ready for adoption.';
      end if;
    end if;
    new.ready_at := case when new.stage = 'ready' then coalesce(old.ready_at, now()) else null end;
    if new.stage <> 'withdrawn' then new.withdrawn_reason := null; end if;
    new.updated_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
