-- A claim on an impounded animal needs a photo of the owner with the pet, so the facility can compare it with the animal.
alter table public.impound_claims add column if not exists evidence_photo text;
alter table public.impound_claims drop constraint if exists impound_claims_evidence_size;
alter table public.impound_claims add constraint impound_claims_evidence_size
  check (evidence_photo is null or (evidence_photo like 'data:image/jpeg;base64,%' and char_length(evidence_photo) <= 600000));
