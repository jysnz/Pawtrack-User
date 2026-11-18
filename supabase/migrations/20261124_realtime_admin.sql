-- Live updates for the admin console: changes to these tables are pushed to signed-in admins (Supabase Realtime)
-- instead of waiting for the next poll. Realtime follows row level security, so an admin only receives rows
-- they are already allowed to read. Safe to run more than once.
do $$
declare
  t text;
begin
  foreach t in array array['impounded_pets', 'penalty_tickets', 'notifications', 'missing_pets'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
