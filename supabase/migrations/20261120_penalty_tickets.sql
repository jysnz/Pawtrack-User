-- Penalty tickets: when a facility (main or sub) impounds a MISSING registered pet, the owner gets a ticket to pay a
-- penalty to the MAIN facility.
--
--   shelters.penalty_php           the penalty a main facility charges for a missing pet (0 = no ticket)
--   penalty_tickets                one ticket per impound: ticket number, amount, who is paid (the main facility),
--                                  who issued it (the facility that impounded the pet), unpaid / paid / waived
--   issue_penalty_ticket()         trigger on impounded_pets: a registered pet that is missing (status 'missing' or an
--                                  open missing report) gets a ticket, and its guardian is notified
--   record_ticket_payment(...)     main facility staff record that the owner paid (with a receipt reference)
--   waive_ticket(...)              the main facility's manager can waive a ticket, with a reason
--   release guard                  a pet with an unpaid ticket cannot be released (marked claimed) until it is paid or waived
-- Guardians can read their own tickets; admins can read the tickets of their facility tree. Nobody writes tickets
-- directly: only the functions above do.

alter table public.shelters
  add column if not exists penalty_php int not null default 500 check (penalty_php >= 0 and penalty_php <= 1000000);

create sequence if not exists public.penalty_ticket_seq;

create table if not exists public.penalty_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique default ('PT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.penalty_ticket_seq')::text, 5, '0')),
  impound_id uuid not null unique references public.impounded_pets(id) on delete cascade,
  pet_id uuid references public.registered_pets(id) on delete set null,
  pet_name text not null,
  owner_id uuid references public.guardians(id) on delete set null,
  issued_by_shelter_id uuid not null references public.shelters(id),
  payee_shelter_id uuid not null references public.shelters(id),
  amount_php int not null check (amount_php >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'waived')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  payment_reference text check (payment_reference is null or char_length(payment_reference) <= 120),
  recorded_by uuid references auth.users(id) on delete set null,
  waived_reason text check (waived_reason is null or char_length(waived_reason) <= 300)
);
create index if not exists penalty_tickets_owner_idx on public.penalty_tickets (owner_id);
create index if not exists penalty_tickets_payee_idx on public.penalty_tickets (payee_shelter_id, status);
alter table public.penalty_tickets enable row level security;
revoke all on public.penalty_tickets from anon;
revoke insert, update, delete on public.penalty_tickets from authenticated;

drop policy if exists "Guardians read their own tickets" on public.penalty_tickets;
create policy "Guardians read their own tickets" on public.penalty_tickets
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "Admins read their facility tickets" on public.penalty_tickets;
create policy "Admins read their facility tickets" on public.penalty_tickets
  for select to authenticated
  using (payee_shelter_id = any (coalesce((select private.my_facility_ids()), array[]::uuid[]))
         or issued_by_shelter_id = any (coalesce((select private.my_facility_ids()), array[]::uuid[])));

-- ---------- issue a ticket when a missing registered pet is impounded ----------
create or replace function private.issue_penalty_ticket()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  p public.registered_pets%rowtype;
  sh public.shelters%rowtype;
  payee public.shelters%rowtype;
  t public.penalty_tickets%rowtype;
  was_missing boolean;
begin
  if new.pet_id is null then return new; end if;
  select * into p from public.registered_pets where id = new.pet_id;
  if not found or p.owner_id is null then return new; end if;

  was_missing := p.status = 'missing'
    or exists (select 1 from public.missing_pets m where m.pet_id = p.id and m.status in ('missing', 'sighted'));
  if not was_missing then return new; end if;

  select * into sh from public.shelters where id = new.shelter_id;
  select * into payee from public.shelters where id = coalesce(sh.parent_id, sh.id);
  if payee.penalty_php <= 0 then return new; end if;

  insert into public.penalty_tickets (impound_id, pet_id, pet_name, owner_id, issued_by_shelter_id, payee_shelter_id, amount_php)
  values (new.id, p.id, new.pet_name, p.owner_id, new.shelter_id, payee.id, payee.penalty_php)
  on conflict (impound_id) do nothing
  returning * into t;

  if t.id is not null then
    insert into public.notifications (recipient_id, type, title, message, pet_name, location)
    values (p.owner_id, 'impound_alert', 'PENALTY TICKET ISSUED',
            'Your missing pet ' || new.pet_name || ' was found and impounded at ' || sh.name || '. A penalty of PHP '
              || t.amount_php || ' is payable to ' || payee.name || coalesce(' (' || nullif(payee.address, '') || ')', '')
              || coalesce(', ' || nullif(payee.phone, ''), '') || '. Ticket ' || t.ticket_no || ': show this number when you pay and collect your pet.',
            new.pet_name, payee.name);
  end if;
  return new;
end;
$$;
drop trigger if exists impounded_pets_issue_ticket on public.impounded_pets;
create trigger impounded_pets_issue_ticket after insert on public.impounded_pets
  for each row execute function private.issue_penalty_ticket();

-- ---------- a pet with an unpaid ticket cannot be released ----------
create or replace function private.guard_release_unpaid()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare tno text;
begin
  if new.status = 'claimed' and old.status is distinct from 'claimed' then
    select ticket_no into tno from public.penalty_tickets where impound_id = new.id and status = 'unpaid';
    if tno is not null then
      raise exception 'Penalty ticket % is unpaid. Record the payment, or waive it, before releasing this pet.', tno;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists impounded_pets_guard_release on public.impounded_pets;
create trigger impounded_pets_guard_release before update of status on public.impounded_pets
  for each row execute function private.guard_release_unpaid();

-- ---------- record a payment / waive ----------
create or replace function public.record_ticket_payment(p_ticket uuid, p_reference text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  mine uuid := private.my_shelter_id();
  t public.penalty_tickets%rowtype;
  payee_name text;
begin
  if mine is null then raise exception 'Only facility staff can record a payment'; end if;
  select * into t from public.penalty_tickets where id = p_ticket for update;
  if not found or t.status <> 'unpaid' then raise exception 'That ticket is not waiting for payment'; end if;
  if t.payee_shelter_id is distinct from mine then
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
  mgr uuid := private.my_manager_shelter_id();
  t public.penalty_tickets%rowtype;
begin
  if mgr is null then raise exception 'Only a facility manager can waive a ticket'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for waiving the ticket'; end if;
  select * into t from public.penalty_tickets where id = p_ticket for update;
  if not found or t.status <> 'unpaid' then raise exception 'That ticket is not waiting for payment'; end if;
  if t.payee_shelter_id is distinct from mgr then
    raise exception 'Only the main facility that receives this penalty can waive it';
  end if;
  update public.penalty_tickets
     set status = 'waived', paid_at = now(), recorded_by = uid, waived_reason = left(btrim(p_reason), 300)
   where id = p_ticket;
end;
$$;

revoke all on function public.record_ticket_payment(uuid, text), public.waive_ticket(uuid, text) from public, anon;
grant execute on function public.record_ticket_payment(uuid, text), public.waive_ticket(uuid, text) to authenticated;
revoke all on function private.issue_penalty_ticket(), private.guard_release_unpaid() from public, anon, authenticated;
