-- One pending sign-up code per email address. The signup-otp edge function (service role) is the only reader and
-- writer: the code is stored hashed, expires after 10 minutes, and allows 5 wrong guesses.
create table if not exists public.signup_otps (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_at timestamptz not null default now(),
  window_started_at timestamptz not null default now(),
  sends_in_window integer not null default 1
);

alter table public.signup_otps enable row level security;
revoke all on public.signup_otps from anon, authenticated;

comment on table public.signup_otps is 'Pending email verification codes for new guardian sign-ups. Service role only.';
