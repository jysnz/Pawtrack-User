-- Signed-in admins change their email or password with a one-time code emailed to them (edge function admin-account-otp).
--   admin_account_otps      one pending code per (admin, purpose). Service role / edge function only.
--   auth_email_taken(email) lets the edge function refuse an email that already belongs to another account (admin or pet owner).

create table if not exists public.admin_account_otps (
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('email', 'password')),
  target text,                                   -- the new email address, for purpose = 'email'
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_at timestamptz not null default now(),
  window_started_at timestamptz not null default now(),
  sends_in_window integer not null default 1,
  primary key (user_id, purpose)
);

alter table public.admin_account_otps enable row level security;
revoke all on public.admin_account_otps from anon, authenticated;
comment on table public.admin_account_otps is 'Pending email/password change codes for signed-in admins. Service role only.';

create or replace function public.auth_email_taken(p_email text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from auth.users where lower(email) = lower(btrim(p_email)));
$$;
revoke all on function public.auth_email_taken(text) from public, anon, authenticated;
grant execute on function public.auth_email_taken(text) to service_role;
