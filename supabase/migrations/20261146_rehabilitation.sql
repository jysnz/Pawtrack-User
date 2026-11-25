-- Rehabilitation workflow: an animal that nobody claimed is prepared for adoption in stages before it may be listed publicly.
--
--   assessment  ->  medical  ->  behavior  ->  clearance  ->  ready
--   (a case can also be 'withdrawn': taken out of the adoption track, with a reason)
--
--   rehab_cases   one row per impounded animal on the track: the current stage, the checklist ticks, the notes per stage
--   Only 'ready' animals may ever be listed publicly. Nothing here is readable by the public.
-- Staff of the facility that holds the animal manage its case, exactly like the impound itself.

create table if not exists public.rehab_cases (
  id uuid primary key default gen_random_uuid(),
  impound_id uuid not null unique references public.impounded_pets(id) on delete cascade,
  shelter_id uuid not null references public.shelters(id) on delete cascade,
  stage text not null default 'assessment' check (stage in ('assessment', 'medical', 'behavior', 'clearance', 'ready', 'withdrawn')),
  -- { "<item key>": { "done": true, "at": "<iso time>" } }
  checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object' and pg_column_size(checklist) <= 20000),
  -- { "assessment": "text", "medical": "text", ... }
  stage_notes jsonb not null default '{}'::jsonb check (jsonb_typeof(stage_notes) = 'object' and pg_column_size(stage_notes) <= 20000),
  withdrawn_reason text check (withdrawn_reason is null or char_length(withdrawn_reason) <= 500),
  started_at timestamptz not null default now(),
  stage_changed_at timestamptz not null default now(),
  ready_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists rehab_cases_shelter_stage_idx on public.rehab_cases (shelter_id, stage);

-- The case always belongs to the facility that currently holds the animal; times and the editor are kept by the database
create or replace function private.rehab_case_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select i.shelter_id into new.shelter_id from public.impounded_pets i where i.id = new.impound_id;
    if new.shelter_id is null then raise exception 'That animal is not impounded here.'; end if;
    new.stage := 'assessment';
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

drop trigger if exists rehab_case_guard on public.rehab_cases;
create trigger rehab_case_guard before insert or update on public.rehab_cases
  for each row execute function private.rehab_case_guard();

alter table public.rehab_cases enable row level security;
revoke all on public.rehab_cases from anon;

drop policy if exists "Staff manage their facility's rehab cases" on public.rehab_cases;
create policy "Staff manage their facility's rehab cases" on public.rehab_cases
  for all to authenticated
  using (shelter_id = any (coalesce((select private.my_facility_ids()), array[]::uuid[])))
  with check (shelter_id = any (coalesce((select private.my_facility_ids()), array[]::uuid[])));
