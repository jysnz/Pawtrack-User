-- Indexes for the queries every device runs on a timer (see js/store.js syncFromSupabase and admin/js/admin-store.js).
-- Without them each poll scans and sorts whole tables, which gets slow once many guardians use the app at once.
-- Each index is created only when its table exists, and only if it is missing, so this is safe to run again.
do $$
declare
  spec text[];
  specs text[][] := array[
    -- name,                                  table,              columns
    ['registered_pets_owner_created_idx',     'registered_pets',  'owner_id, created_at'],
    ['registered_pets_created_idx',           'registered_pets',  'created_at desc, id desc'],
    ['notifications_recipient_created_idx',   'notifications',    'recipient_id, created_at desc'],
    ['notifications_created_idx',             'notifications',    'created_at desc'],
    ['missing_pets_status_last_seen_idx',     'missing_pets',     'status, last_seen_at desc'],
    ['missing_pets_created_idx',              'missing_pets',     'created_at desc, id desc'],
    ['community_sightings_created_idx',       'community_sightings', 'created_at desc'],
    ['impounded_pets_intake_idx',             'impounded_pets',   'intake_at desc, id desc'],
    ['reunited_pets_reunited_at_idx',         'reunited_pets',    'reunited_at desc'],
    ['nfc_tags_created_idx',                  'nfc_tags',         'created_at desc, id desc'],
    ['penalty_tickets_created_idx',           'penalty_tickets',  'created_at desc, id desc'],
    ['violations_owner_created_idx',          'violations',       'owner_id, created_at desc']
  ];
  i int;
begin
  for i in 1 .. array_length(specs, 1) loop
    spec := array[specs[i][1], specs[i][2], specs[i][3]];
    if to_regclass('public.' || spec[2]) is not null then
      begin
        execute format('create index if not exists %I on public.%I (%s)', spec[1], spec[2], spec[3]);
      exception when undefined_column then
        raise notice 'skipped % (column missing on %)', spec[1], spec[2];
      end;
    end if;
  end loop;
end $$;
