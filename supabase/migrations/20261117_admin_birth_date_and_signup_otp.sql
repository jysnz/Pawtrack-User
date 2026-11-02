-- Admin console registration: birth date (admins must be 18+) and an emailed sign-up code.

-- 1. Birth date on the admin profile. Nullable so existing admins keep working; every new request must carry one.
alter table public.admin_accounts add column if not exists birth_date date;

-- The office is assigned inside the system by an administrator, not typed in at registration.
alter table public.admin_accounts alter column office drop not null;

-- 2. One pending sign-up code per email, same shape as signup_otps (owner app). Edge function / service role only.
create table if not exists public.admin_signup_otps (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_at timestamptz not null default now(),
  window_started_at timestamptz not null default now(),
  sends_in_window integer not null default 1
);

alter table public.admin_signup_otps enable row level security;
revoke all on public.admin_signup_otps from anon, authenticated;

comment on table public.admin_signup_otps is 'Pending email verification codes for admin console sign-ups. Service role only.';

-- 3. New requests: the birth date must exist and be at least 18 years ago (Philippine date).
--    Same logic as before plus the age check.
create or replace function private.admin_accounts_before_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is not null then
    new.id := (select auth.uid());
    new.email := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  end if;
  new.email := lower(new.email);
  if new.email = '' then
    raise exception 'Your account has no email address';
  end if;
  if new.birth_date is null
     or new.birth_date > ((now() at time zone 'Asia/Manila')::date - interval '18 years')::date then
    raise exception 'Admins must be at least 18 years old';
  end if;
  new.created_at := now();
  new.updated_at := now();
  if exists (select 1 from private.admin_bootstrap_emails where email = new.email) then
    new.status := 'approved';
    new.reviewed_by := new.id;
    new.reviewed_at := now();
  else
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$function$;

-- 4. Signed-in users may edit their own profile, but not their birth date (it can be set once if it was missing).
create or replace function private.admin_accounts_before_update()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  new.updated_at := now();
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.id <> old.id or new.email <> old.email or new.created_at <> old.created_at then
    raise exception 'Account identity cannot be changed';
  end if;
  if new.birth_date is distinct from old.birth_date then
    if old.birth_date is not null
       or new.birth_date is null
       or new.birth_date > ((now() at time zone 'Asia/Manila')::date - interval '18 years')::date then
      raise exception 'Birth date cannot be changed';
    end if;
  end if;
  if new.status is distinct from old.status then
    if not private.is_approved_admin() then
      raise exception 'Only approved admins can review access requests';
    end if;
    if old.id = (select auth.uid()) then
      raise exception 'You cannot change the status of your own account';
    end if;
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  else
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end;
$function$;
