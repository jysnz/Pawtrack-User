// The console keeps its data in sync live: it loads at start-up, refreshes on a timer and when the tab returns,
// follows saves made in other tabs, and redraws when something changed.
// Run: node admin/tests/test-startup-sync.js
const path = require('path');
const fs = require('fs');
const mem = {};
global.window = global;
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const docListeners = [];
global.document = { addEventListener: (type, fn) => docListeners.push({ type, fn }), hidden: false };
const winListeners = [];
global.addEventListener = (type, fn) => winListeners.push({ type, fn });
global.removeEventListener = () => {};
global.BroadcastChannel = undefined;

let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 160) : ''}`); if (!ok) failed++; };

const ID = '11111111-1111-4111-8111-111111111111';
const rows = {
  shelters: [{ id: ID, name: 'Main', address: 'A', lat: 1, lng: 2, capacity: 10 }],
  registered_pets: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Rex', species: 'Dog', status: 'safe', created_at: '2026-01-01T00:00:00Z' }],
  impounded_pets: [{ id: '33333333-3333-4333-8333-333333333333', shelter_id: ID, pet_name: 'Stray', species: 'Cat', status: 'in_holding', intake_at: '2026-11-01T00:00:00Z', claim_deadline: '2026-11-04T00:00:00Z' }]
};
let queries = 0;
const fakeSb = {
  from: (t) => { const q = { select: () => q, order: () => q, limit: () => q, eq: () => q, in: () => q, then: (ok) => { queries++; return Promise.resolve({ data: rows[t] || [], error: null }).then(ok); } }; return q; },
  rpc: async () => ({ data: 0, error: null })
};

const AdminStore = require(path.join(__dirname, '../js/admin-store.js'));
window.adminApp = { currentAdmin: { id: 'a', shelter_id: ID, facility_role: 'manager' }, supabase: fakeSb, refreshAccount: async () => {}, showToast() {} };

(async () => {
  const events = [];
  const store = new AdminStore();
  store.subscribe((_s, reason) => events.push(reason));
  store.client = () => fakeSb;
  await store.syncFromSupabase();
  check('the first load tells the page the data arrived', events.includes('supabase_sync'), JSON.stringify(events));

  check('the data refreshes on a timer', !!store.pollTimer);
  check('the data refreshes when the tab becomes visible again', docListeners.some(l => l.type === 'visibilitychange'));

  // A visibility change loads again
  let before = queries;
  store.lastSyncedAt = Date.now() - 60000;
  docListeners.filter(l => l.type === 'visibilitychange').forEach(l => l.fn());
  await store.syncing;
  check('coming back to the tab reloads stale data', queries > before, queries - before);
  before = queries;
  docListeners.filter(l => l.type === 'visibilitychange').forEach(l => l.fn());
  await store.syncing;
  check('coming back again within 10 seconds does not reload again', queries === before, queries - before);

  // Another tab saving data redraws this page
  events.length = 0;
  winListeners.filter(l => l.type === 'storage').forEach(l => l.fn({ key: 'pawtrack_admin_pets' }));
  check('data saved in another tab redraws this page', events.includes('cross_tab_sync'), JSON.stringify(events));

  // New data redraws it; an unchanged poll stays quiet
  events.length = 0;
  await store.syncFromSupabase();
  check('a refresh with nothing new does not redraw', !events.includes('supabase_sync'), JSON.stringify(events));
  rows.impounded_pets = rows.impounded_pets.concat([{ id: '44444444-4444-4444-8444-444444444444', shelter_id: ID, pet_name: 'New', species: 'Dog', status: 'in_holding', intake_at: '2026-11-02T00:00:00Z', claim_deadline: '2026-11-05T00:00:00Z' }]);
  await store.syncFromSupabase();
  check('a refresh that finds new data redraws the page', events.includes('supabase_sync') && store.getImpoundments().length === 2, JSON.stringify(events));

  // The toast that was asked to be removed stays removed
  const app = fs.readFileSync(path.join(__dirname, '../js/admin-app.js'), 'utf8');
  check('the "Data synchronized live" message stays removed', !/Data synchronized live/.test(app));

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
