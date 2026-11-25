-- Before an animal starts rehabilitation the admin records its CURRENT CONDITION (this replaces the "plan afterwards"
-- columns of 20261148, which were the wrong question).
--   condition_overall  stable | vet_soon | critical
--   condition_tags     what applies: healthy, injured, sick, underweight, parasites, pregnant, young, senior,
--                      calm, fearful, aggressive
--   condition_note     anything else the team should know

alter table public.rehab_cases drop constraint if exists rehab_cases_transfer_needs_note;
alter table public.rehab_cases drop constraint if exists rehab_cases_plan_note_check;
alter table public.rehab_cases drop constraint if exists rehab_cases_plan_check;
alter table public.rehab_cases drop column if exists plan_note;
alter table public.rehab_cases drop column if exists plan;

alter table public.rehab_cases
  add column if not exists condition_overall text not null default 'stable',
  add column if not exists condition_tags text[] not null default '{}',
  add column if not exists condition_note text;

alter table public.rehab_cases drop constraint if exists rehab_cases_condition_overall_check;
alter table public.rehab_cases add constraint rehab_cases_condition_overall_check
  check (condition_overall in ('stable', 'vet_soon', 'critical'));

alter table public.rehab_cases drop constraint if exists rehab_cases_condition_tags_check;
alter table public.rehab_cases add constraint rehab_cases_condition_tags_check
  check (condition_tags <@ array['healthy', 'injured', 'sick', 'underweight', 'parasites', 'pregnant', 'young', 'senior', 'calm', 'fearful', 'aggressive']::text[]);

alter table public.rehab_cases drop constraint if exists rehab_cases_condition_note_check;
alter table public.rehab_cases add constraint rehab_cases_condition_note_check
  check (condition_note is null or char_length(condition_note) <= 500);
