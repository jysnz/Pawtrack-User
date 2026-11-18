-- Delete a facility (main or sub-facility).
-- Clients never delete from public.shelters directly (no delete policy). A manager deletes through delete_facility(), which:
--   * only works for a facility the caller manages (their own main facility, an extra main facility, or a sub-facility of one)
--   * REFUSES while the facility still has animals in holding, pending transfers, or unpaid penalty tickets
--   * deleting a MAIN facility does not delete its sub-facilities: they become main facilities, and the manager who
--     deleted it keeps managing them (each becomes one of their main facilities)
--   * removes the facility together with its own finished impound records and settled tickets, frees its team
--     (a manager who also runs another main facility is moved to that one), and clears transfer references from other records
--
--   facility_delete_preview(p_id)   what deleting would affect, and what blocks it (used by the confirmation dialog)
--   delete_facility(p_id)           does it, re-checking every rule

create or replace function private.facility_delete_counts(p_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'sub_facilities',    (select count(*) from public.shelters where parent_id = p_id),
    'in_holding',        (select count(*) from public.impounded_pets
                           where shelter_id = p_id and status = 'active_impounded'),
    'pending_transfers', (select count(*) from public.impounded_pets
                           where transfer_status = 'pending' and status = 'active_impounded'
                             and (shelter_id = p_id or transfer_to_shelter_id = p_id)),
    'unpaid_tickets',    (select count(*) from public.penalty_tickets
                           where status = 'unpaid' and (issued_by_shelter_id = p_id or payee_shelter_id = p_id)),
    'past_records',      (select count(*) from public.impounded_pets
                           where shelter_id = p_id and status <> 'active_impounded'),
    'members',           (select count(*) from public.admin_accounts where shelter_id = p_id)
  );
$$;

create or replace function public.facility_delete_preview(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  managed uuid[] := private.my_managed_shelter_ids();
  s public.shelters%rowtype;
begin
  if managed is null or p_id is null or not (p_id = any (managed)) then
    raise exception 'Only the facility manager can delete this facility';
  end if;
  select * into s from public.shelters where id = p_id;
  if not found then raise exception 'This facility no longer exists'; end if;
  return private.facility_delete_counts(p_id) || jsonb_build_object(
    'name', s.name,
    'is_sub', s.parent_id is not null,
    'subs', (select coalesce(jsonb_agg(c.name order by c.name), '[]'::jsonb) from public.shelters c where c.parent_id = p_id));
end;
$$;

create or replace function public.delete_facility(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  managed uuid[] := private.my_managed_shelter_ids();
  s public.shelters%rowtype;
  c jsonb;
  adm record;
  kid record;
  next_main uuid;
begin
  if managed is null or p_id is null or not (p_id = any (managed)) then
    raise exception 'Only the facility manager can delete this facility';
  end if;
  select * into s from public.shelters where id = p_id for update;
  if not found then raise exception 'This facility no longer exists'; end if;

  c := private.facility_delete_counts(p_id);
  if (c ->> 'in_holding')::int > 0 then raise exception 'Animals are still in holding here. Release, claim or move them first'; end if;
  if (c ->> 'pending_transfers')::int > 0 then raise exception 'There are transfers waiting to be confirmed. Settle them first'; end if;
  if (c ->> 'unpaid_tickets')::int > 0 then raise exception 'There are unpaid penalty tickets. Collect or waive them first'; end if;

  perform set_config('pawtrack.facility_rpc', '1', true);

  -- sub-facilities are not deleted: each becomes a main facility, managed by whoever deleted this one
  for kid in select id from public.shelters where parent_id = p_id loop
    update public.shelters set parent_id = null where id = kid.id;
    insert into public.facility_extra_mains (admin_id, shelter_id) values (uid, kid.id) on conflict do nothing;
  end loop;

  -- the team: a manager who also runs another main facility moves to it, everyone else is released
  for adm in select id from public.admin_accounts where shelter_id = p_id loop
    select e.shelter_id into next_main from public.facility_extra_mains e
     where e.admin_id = adm.id and e.shelter_id <> p_id order by e.created_at limit 1;
    if next_main is not null then
      update public.admin_accounts set shelter_id = next_main where id = adm.id;
      delete from public.facility_extra_mains where admin_id = adm.id and shelter_id = next_main;
    else
      update public.admin_accounts set shelter_id = null, facility_role = null where id = adm.id;
    end if;
  end loop;

  -- finished records of this facility go with it (animals in holding already blocked the delete above)
  -- a sub-facility's settled tickets named this facility as payee: they now belong to the sub-facility that issued them
  update public.penalty_tickets set payee_shelter_id = issued_by_shelter_id
   where payee_shelter_id = p_id and issued_by_shelter_id <> p_id;
  delete from public.penalty_tickets where issued_by_shelter_id = p_id or payee_shelter_id = p_id;
  delete from public.impounded_pets where shelter_id = p_id;
  update public.impounded_pets set origin_shelter_id = null where origin_shelter_id = p_id;
  update public.impounded_pets set transfer_to_shelter_id = null where transfer_to_shelter_id = p_id;

  delete from public.shelters where id = p_id;   -- its invite code and extra-main link cascade
  return c || jsonb_build_object('name', s.name);
end;
$$;

revoke all on function public.facility_delete_preview(uuid), public.delete_facility(uuid) from public, anon;
grant execute on function public.facility_delete_preview(uuid), public.delete_facility(uuid) to authenticated;
revoke all on function private.facility_delete_counts(uuid) from public, anon, authenticated;

-- ---------- switch a facility between main and sub-facility ----------
--   set_facility_parent(p_id, p_parent)   p_parent = one of the caller's MAIN facilities makes p_id its sub-facility;
--                                         p_parent = null makes p_id a main facility (the caller keeps managing it)
-- Refused while the facility has sub-facilities (when it would become a sub), pending transfers or unpaid tickets.
create or replace function public.set_facility_parent(p_id uuid, p_parent uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  managed uuid[] := private.my_managed_shelter_ids();
  s public.shelters%rowtype;
  c jsonb;
  own_primary uuid;
begin
  if managed is null or p_id is null or not (p_id = any (managed)) then
    raise exception 'Only the facility manager can change this facility''s type';
  end if;
  select * into s from public.shelters where id = p_id for update;
  if not found then raise exception 'This facility no longer exists'; end if;
  if s.parent_id is not distinct from p_parent then return; end if;

  c := private.facility_delete_counts(p_id);
  if (c ->> 'pending_transfers')::int > 0 then raise exception 'There are transfers waiting to be confirmed. Settle them first'; end if;
  if (c ->> 'unpaid_tickets')::int > 0 then raise exception 'There are unpaid penalty tickets. Collect or waive them first'; end if;

  perform set_config('pawtrack.facility_rpc', '1', true);
  if p_parent is not null then
    if p_parent = p_id then raise exception 'A facility cannot be its own sub-facility'; end if;
    if not (p_parent = any (managed))
       or exists (select 1 from public.shelters where id = p_parent and parent_id is not null) then
      raise exception 'Choose one of your main facilities';
    end if;
    if (c ->> 'sub_facilities')::int > 0 then raise exception 'Move or delete its sub-facilities first'; end if;
    update public.shelters set parent_id = p_parent where id = p_id;
    delete from public.facility_extra_mains where shelter_id = p_id;   -- no longer a main facility of its own
  else
    update public.shelters set parent_id = null where id = p_id;
    select shelter_id into own_primary from public.admin_accounts where id = uid;
    if own_primary is distinct from p_id then
      insert into public.facility_extra_mains (admin_id, shelter_id) values (uid, p_id) on conflict do nothing;
    end if;
  end if;
end;
$$;

revoke all on function public.set_facility_parent(uuid, uuid) from public, anon;
grant execute on function public.set_facility_parent(uuid, uuid) to authenticated;
