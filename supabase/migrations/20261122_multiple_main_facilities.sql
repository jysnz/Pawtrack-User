-- More than one main facility per manager.
-- An account still has one PRIMARY facility (admin_accounts.shelter_id). A manager can now also add further MAIN facilities,
-- recorded in facility_extra_mains. The access helpers treat them like the primary one: the manager manages each main
-- facility and all of its sub-facilities, and staff of a facility see only that facility's tree.
--
--   facility_extra_mains            the additional main facilities an account manages
--   private.my_facility_ids()       primary tree + extra mains' trees (extras only count while the account is a manager)
--   private.my_managed_shelter_ids  the same, managers only (null for everyone else, as before)
--   add_main_facility(p)            a manager adds another main facility (with its own invite code)
--   create_sub_facility(p)          p.parent_id picks which of the manager's main facilities the new sub belongs to
--   confirm_transfer_arrival / record_ticket_payment / waive_ticket now work for any main facility the caller belongs to

create table if not exists public.facility_extra_mains (
  admin_id uuid not null references public.admin_accounts(id) on delete cascade,
  shelter_id uuid not null unique references public.shelters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (admin_id, shelter_id)
);
alter table public.facility_extra_mains enable row level security;
revoke all on public.facility_extra_mains from anon;
revoke insert, update, delete on public.facility_extra_mains from authenticated;
drop policy if exists "Managers read their extra main facilities" on public.facility_extra_mains;
create policy "Managers read their extra main facilities" on public.facility_extra_mains
  for select to authenticated using (admin_id = (select auth.uid()));

create or replace function private.my_facility_ids()
returns uuid[] language sql stable security definer set search_path = ''
as $$
  with me as (
    select a.id, a.shelter_id, a.facility_role from public.admin_accounts a
    where a.id = (select auth.uid()) and a.status = 'approved'
  ),
  mains as (
    select shelter_id as id from me where shelter_id is not null
    union
    select e.shelter_id from public.facility_extra_mains e join me on me.id = e.admin_id where me.facility_role = 'manager'
  )
  select coalesce((select array_agg(distinct x) from (
           select id as x from mains
           union
           select c.id from public.shelters c join mains m on c.parent_id = m.id
         ) t), array[]::uuid[]);
$$;

create or replace function private.my_managed_shelter_ids()
returns uuid[] language sql stable security definer set search_path = ''
as $$
  with me as (
    select a.id, a.shelter_id from public.admin_accounts a
    where a.id = (select auth.uid()) and a.status = 'approved' and a.facility_role = 'manager' and a.shelter_id is not null
  ),
  mains as (
    select shelter_id as id from me
    union
    select e.shelter_id from public.facility_extra_mains e join me on me.id = e.admin_id
  )
  select case when not exists (select 1 from me) then null
         else (select array_agg(distinct x) from (
                 select id as x from mains
                 union
                 select c.id from public.shelters c join mains m on c.parent_id = m.id
               ) t) end;
$$;

-- ---------- add another main facility ----------
create or replace function public.add_main_facility(p jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  me public.admin_accounts%rowtype;
  new_id uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into me from public.admin_accounts
   where id = uid and status = 'approved' and facility_role = 'manager' and shelter_id is not null;
  if not found then raise exception 'Only a facility manager can add another main facility'; end if;
  if char_length(btrim(coalesce(p ->> 'name', ''))) < 2 or char_length(btrim(coalesce(p ->> 'address', ''))) < 2 then
    raise exception 'A facility needs a name and an address';
  end if;

  insert into public.shelters (name, address, phone, email, hours, lat, lng, daily_fee_php, holding_period_days,
                               capacity, officer_in_charge, city, facility_type)
  values (btrim(p ->> 'name'), btrim(p ->> 'address'),
          nullif(btrim(coalesce(p ->> 'phone', '')), ''), nullif(btrim(coalesce(p ->> 'email', '')), ''),
          nullif(btrim(coalesce(p ->> 'hours', '')), ''),
          (p ->> 'lat')::float8, (p ->> 'lng')::float8,
          coalesce(nullif(p ->> 'daily_fee_php', '')::int, 0), coalesce(nullif(p ->> 'holding_period_days', '')::int, 3),
          coalesce(nullif(p ->> 'capacity', '')::int, 50),
          nullif(btrim(coalesce(p ->> 'officer_in_charge', '')), ''), nullif(btrim(coalesce(p ->> 'city', '')), ''),
          nullif(btrim(coalesce(p ->> 'facility_type', '')), ''))
  returning id into new_id;

  insert into public.facility_invites (shelter_id, code) values (new_id, private.new_invite_code());
  insert into public.facility_extra_mains (admin_id, shelter_id) values (uid, new_id);
  return new_id;
end;
$$;

-- ---------- sub-facilities: choose the main facility they belong to ----------
create or replace function public.create_sub_facility(p jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  managed uuid[] := private.my_managed_shelter_ids();
  pid uuid := coalesce(nullif(p ->> 'parent_id', '')::uuid, private.my_manager_shelter_id());
  new_id uuid;
begin
  if managed is null or pid is null or not (pid = any (managed)) then
    raise exception 'Only a facility manager can create a sub-facility';
  end if;
  if exists (select 1 from public.shelters where id = pid and parent_id is not null) then
    raise exception 'A sub-facility cannot have sub-facilities of its own';
  end if;
  if char_length(btrim(coalesce(p ->> 'name', ''))) < 2 or char_length(btrim(coalesce(p ->> 'address', ''))) < 2 then
    raise exception 'A sub-facility needs a name and an address';
  end if;

  insert into public.shelters (name, address, phone, email, hours, lat, lng, daily_fee_php, holding_period_days,
                               capacity, officer_in_charge, city, facility_type, parent_id)
  values (btrim(p ->> 'name'), btrim(p ->> 'address'),
          nullif(btrim(coalesce(p ->> 'phone', '')), ''), nullif(btrim(coalesce(p ->> 'email', '')), ''),
          nullif(btrim(coalesce(p ->> 'hours', '')), ''),
          (p ->> 'lat')::float8, (p ->> 'lng')::float8,
          coalesce(nullif(p ->> 'daily_fee_php', '')::int, 0), coalesce(nullif(p ->> 'holding_period_days', '')::int, 3),
          coalesce(nullif(p ->> 'capacity', '')::int, 50),
          nullif(btrim(coalesce(p ->> 'officer_in_charge', '')), ''), nullif(btrim(coalesce(p ->> 'city', '')), ''),
          nullif(btrim(coalesce(p ->> 'facility_type', '')), ''), pid)
  returning id into new_id;

  insert into public.facility_invites (shelter_id, code) values (new_id, private.new_invite_code());
  return new_id;
end;
$$;

-- ---------- transfers and tickets: any main facility the caller belongs to ----------
create or replace function public.confirm_transfer_arrival(p_impound uuid, p_arrived boolean, p_cage text default null, p_notes text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  mine uuid[] := private.my_facility_ids();
  rec public.impounded_pets%rowtype;
  days int;
begin
  if coalesce(array_length(mine, 1), 0) = 0 then raise exception 'Only facility staff can confirm an arrival'; end if;
  select * into rec from public.impounded_pets where id = p_impound for update;
  if not found or rec.transfer_status is null or rec.transfer_status = 'received' then
    raise exception 'That pet has no transfer waiting for confirmation';
  end if;
  if rec.transfer_to_shelter_id is null or not (rec.transfer_to_shelter_id = any (mine)) then
    raise exception 'Only the receiving facility can confirm this arrival';
  end if;
  if char_length(coalesce(p_notes, '')) > 500 then raise exception 'Notes are too long'; end if;

  if p_arrived then
    select holding_period_days into days from public.shelters where id = rec.transfer_to_shelter_id;
    update public.impounded_pets
       set shelter_id = rec.transfer_to_shelter_id, kennel = nullif(btrim(coalesce(p_cage, '')), ''),
           transfer_status = 'received', transfer_resolved_at = now(), transfer_resolved_by = uid,
           transfer_notes = nullif(btrim(coalesce(p_notes, '')), ''),
           claim_deadline = now() + make_interval(days => coalesce(days, 3))
     where id = p_impound;
  else
    update public.impounded_pets
       set transfer_status = 'not_arrived', transfer_resolved_at = now(), transfer_resolved_by = uid,
           transfer_notes = nullif(btrim(coalesce(p_notes, '')), '')
     where id = p_impound;
  end if;
end;
$$;

create or replace function public.record_ticket_payment(p_ticket uuid, p_reference text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  mine uuid[] := private.my_facility_ids();
  t public.penalty_tickets%rowtype;
  payee_name text;
begin
  if coalesce(array_length(mine, 1), 0) = 0 then raise exception 'Only facility staff can record a payment'; end if;
  select * into t from public.penalty_tickets where id = p_ticket for update;
  if not found or t.status <> 'unpaid' then raise exception 'That ticket is not waiting for payment'; end if;
  if not (t.payee_shelter_id = any (mine)) then
    raise exception 'Only the main facility that receives this penalty can record its payment';
  end if;
  if char_length(coalesce(p_reference, '')) > 120 then raise exception 'The receipt reference is too long'; end if;

  update public.penalty_tickets
     set status = 'paid', paid_at = now(), recorded_by = uid, payment_reference = nullif(btrim(coalesce(p_reference, '')), '')
   where id = p_ticket;

  select name into payee_name from public.shelters where id = t.payee_shelter_id;
  if t.owner_id is not null then
    insert into public.notifications (recipient_id, type, title, message, pet_name, location)
    values (t.owner_id, 'impound_alert', 'PENALTY PAID',
            'Thank you. ' || payee_name || ' received your payment of PHP ' || t.amount_php || ' for ticket ' || t.ticket_no
              || '. You can now collect ' || t.pet_name || '.', t.pet_name, payee_name);
  end if;
end;
$$;

create or replace function public.waive_ticket(p_ticket uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  managed uuid[] := private.my_managed_shelter_ids();
  t public.penalty_tickets%rowtype;
begin
  if managed is null then raise exception 'Only a facility manager can waive a ticket'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for waiving the ticket'; end if;
  select * into t from public.penalty_tickets where id = p_ticket for update;
  if not found or t.status <> 'unpaid' then raise exception 'That ticket is not waiting for payment'; end if;
  if not (t.payee_shelter_id = any (managed)) then
    raise exception 'Only the main facility that receives this penalty can waive it';
  end if;
  update public.penalty_tickets
     set status = 'waived', paid_at = now(), recorded_by = uid, waived_reason = left(btrim(p_reason), 300)
   where id = p_ticket;
end;
$$;

revoke all on function public.add_main_facility(jsonb) from public, anon;
grant execute on function public.add_main_facility(jsonb) to authenticated;
