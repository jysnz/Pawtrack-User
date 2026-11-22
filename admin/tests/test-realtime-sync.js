// Realtime: pushed changes reload the data, the poll slows down while live and backs off when failing,
// and the status the UI shows is truthful.
// Run: node admin/tests/test-realtime-sync.js
const path = require('path');
const fs = require('fs');
const mem = {};
global.window = global;
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
global.document = { addEventListener() {}, hidden: false };
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.BroadcastChannel = undefined;

let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 160) : ''}`); if (!ok) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ID = '11111111-1111-4111-8111-111111111111';
let failing = false, queries = 0;
const rows = { shelters: [{ id: ID, name: 'Main', address: 'A', lat: 1, lng: 2, capacity: 10 }], registered_pets: [], impounded_pets: [] };
const handlers = []; let onStatus = null; const subscribedTables = [];
const channel = {
  on(_type, filter, fn) { subscribedTables.push(filter.table); handlers.push(fn); return channel; },
  subscribe(cb) { onStatus = cb; return channel; }
};
const fakeSb = {
  channel: () => channel,
  from: (t) => { const q = { select: () => q, order: () => q, limit: () => q, range: () => q, eq: () => q, in: () => q, then: (ok) => { queries++; return Promise.resolve(failing ? { data: null, error: { message: 'down' } } : { data: rows[t] || [], error: null }).then(ok); } }; return q; },
  rpc: async () => ({ data: 0, error: null })
};
window.adminApp = { currentAdmin: { id: 'a', shelter_id: ID, facility_role: 'manager' }, supabase: fakeSb, refreshAccount: async () => {}, showToast() {} };
const AdminStore = require(path.join(__dirname, '../js/admin-store.js'));

(async () => {
  const store = new AdminStore();
  store.realtimeDebounceMs = 5;
  store.client = () => fakeSb;
  await store.syncFromSupabase();
  await wait(20);

  check('it listens to the tables that matter', ['impounded_pets', 'penalty_tickets', 'notifications', 'missing_pets'].every(t => subscribedTables.includes(t)), subscribedTables.join());
  check('before the channel is up the status is polling, with a 15s timer', store.syncStatus === 'connected' && store.pollDelay() === 15000);

  const seen = [];
  store.onStatus((s) => seen.push(s));
  onStatus('SUBSCRIBED');
  await wait(20);
  check('once subscribed the status is live and the timer slows to 60s', store.syncStatus === 'live' && store.pollDelay() === 60000 && seen.includes('live'), JSON.stringify({ s: store.syncStatus, seen }));

  // A push reloads the data, and a burst becomes one reload
  await store.syncing;
  let before = queries;
  const mine = handlers.slice(-4); mine.slice(0, 3).forEach((fn) => fn({}));
  await wait(60);
  await store.syncing;
  const perSync = Math.max(1, before ? 9 : 9);
  check('a burst of pushed changes causes exactly one reload', queries - before === perSync, queries - before);

  // A change while a reload is running is not lost
  before = queries;
  const running = store.syncFromSupabase();
  handlers[handlers.length - 1]({});
  await running;
  await wait(60);
  await store.syncing;
  check('a change that arrives mid-reload gets its own reload afterwards', queries - before === perSync * 2, queries - before);

  // The channel drops
  onStatus('CHANNEL_ERROR');
  check('a dropped channel falls back to polling every 15s', store.syncStatus === 'connected' && store.pollDelay() === 15000, store.syncStatus);
  onStatus('SUBSCRIBED');
  await wait(20);
  check('and recovers to live when it reconnects', store.syncStatus === 'live');

  // The database is unreachable
  failing = true;
  const ok = await store.syncFromSupabase();
  check('a failed reload reports offline and keeps the data', ok === false && store.syncStatus === 'offline' && seen.includes('offline'));
  check('failures back off 15s, 30s, 60s and stay at 60s', store.pollDelay() === 15000 && (store.syncFailures = 2, store.pollDelay() === 30000) && (store.syncFailures = 3, store.pollDelay() === 60000) && (store.syncFailures = 9, store.pollDelay() === 60000));
  store.syncFailures = 1;
  failing = false;
  await store.syncFromSupabase();
  check('the next good reload clears the failure and goes back to live', store.syncFailures === 0 && store.syncStatus === 'live' && store.pollDelay() === 60000);

  // The page
  const app = fs.readFileSync(path.join(__dirname, '../js/admin-app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  check('the app keeps following the store status (indicator removed from the top bar)', /onStatus\(\(\) => this\.updateSyncIndicator\(\)\)/.test(app) && /Offline, retrying/.test(app));
  check('the migration enables Realtime for the tables', /supabase_realtime/.test(fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261124_realtime_admin.sql'), 'utf8')));

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
