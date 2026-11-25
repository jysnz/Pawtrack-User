-- Before an animal starts rehabilitation, the admin says what will happen to it afterwards. That decision is kept on the case.
--   adoption  put up for adoption       foster   placed with a foster home
--   transfer  moved to a partner shelter or rescue (plan_note names it)
--   return    returned to where it was found

alter table public.rehab_cases
  add column if not exists plan text not null default 'adoption',
  add column if not exists plan_note text;

alter table public.rehab_cases drop constraint if exists rehab_cases_plan_check;
alter table public.rehab_cases add constraint rehab_cases_plan_check
  check (plan in ('adoption', 'foster', 'transfer', 'return'));

alter table public.rehab_cases drop constraint if exists rehab_cases_plan_note_check;
alter table public.rehab_cases add constraint rehab_cases_plan_note_check
  check (plan_note is null or char_length(plan_note) <= 200);

-- A transfer must say where to
alter table public.rehab_cases drop constraint if exists rehab_cases_transfer_needs_note;
alter table public.rehab_cases add constraint rehab_cases_transfer_needs_note
  check (plan <> 'transfer' or char_length(btrim(coalesce(plan_note, ''))) >= 2);
