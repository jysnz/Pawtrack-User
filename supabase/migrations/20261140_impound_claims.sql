-- Owners can claim an impounded pet from the Impoundments page; the facility that holds it accepts or rejects the claim.
-- A claim is visible to the person who made it and to the admins of the facility that holds the pet.

create table if not exists public.impound_claims (
  id uuid primary key default gen_random_uuid(),
  impound_id uuid not null references public.impounded_pets(id) on delete cascade,
  claimant_id uuid not null references auth.users(id) on delete cascade,
  claimant_name text not null,
  claimant_email text not null,
  claimant_phone text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

-- One open claim per person per animal
create unique index if not exists impound_claims_one_open
  on public.impound_claims (impound_id, claimant_id) where status = 'pending';
create index if not exists impound_claims_by_impound on public.impound_claims (impound_id);
create index if not exists impound_claims_by_claimant on public.impound_claims (claimant_id);

alter table public.impound_claims enable row level security;

drop policy if exists "Guardians claim as themselves" on public.impound_claims;
create policy "Guardians claim as themselves" on public.impound_claims
  for insert to authenticated
  with check (claimant_id = (select auth.uid()) and status = 'pending' and decided_by is null);

drop policy if exists "Guardians read their own claims" on public.impound_claims;
create policy "Guardians read their own claims" on public.impound_claims
  for select to authenticated
  using (claimant_id = (select auth.uid()));

drop policy if exists "Facility staff read claims for their animals" on public.impound_claims;
create policy "Facility staff read claims for their animals" on public.impound_claims
  for select to authenticated
  using (exists (
    select 1 from public.impounded_pets i
    where i.id = impound_claims.impound_id
      and i.shelter_id = any (coalesce((select private.my_facility_ids()), array[]::uuid[]))
  ));

drop policy if exists "Facility staff decide claims for their animals" on public.impound_claims;
create policy "Facility staff decide claims for their animals" on public.impound_claims
  for update to authenticated
  using (exists (
    select 1 from public.impounded_pets i
    where i.id = impound_claims.impound_id
      and i.shelter_id = any (coalesce((select private.my_facility_ids()), array[]::uuid[]))
  ))
  with check (status in ('accepted', 'rejected') and decided_by = (select auth.uid()));

-- Realtime for the admin console's Claims page
do $$ begin
  alter publication supabase_realtime add table public.impound_claims;
exception when duplicate_object then null; when undefined_object then null; end $$;
