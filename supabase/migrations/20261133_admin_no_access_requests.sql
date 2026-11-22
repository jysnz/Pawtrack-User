-- Admin console: no more access requests.
-- A new admin account is active as soon as it is created (email verified by the admin-signup-otp / admin-register
-- Edge Functions, 18+ rule still enforced here). Accounts still waiting for approval are activated too (rejected and suspended ones stay locked).
-- Suspending an account (status = 'suspended') still locks that person out of the console.

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
  new.status := 'approved';
  new.reviewed_by := new.id;
  new.reviewed_at := now();
  return new;
end;
$function$;

update public.admin_accounts
   set status = 'approved'
 where status = 'pending';
