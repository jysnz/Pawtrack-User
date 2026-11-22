-- A new facility's official email is confirmed with an emailed code before the facility is registered
-- (edge function admin-account-otp, purpose 'facility_email').
alter table public.admin_account_otps drop constraint if exists admin_account_otps_purpose_check;
alter table public.admin_account_otps
  add constraint admin_account_otps_purpose_check check (purpose in ('email', 'password', 'facility_email'));
