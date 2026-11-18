-- A password change is two steps: first the emailed code is proven, then the new password is set.
-- verified_at marks a code that was entered correctly (valid for the rest of its 10 minutes).
alter table public.admin_account_otps add column if not exists verified_at timestamptz;
