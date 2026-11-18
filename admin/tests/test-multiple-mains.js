// A manager can add more than one main facility; each main facility has its own sub-facilities.
// Run: node admin/tests/test-multiple-mains.js
const path = require('path');
const mem = {};
global.window = global;
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
global.document = { addEventListener() {}, hidden: false };
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.BroadcastChannel = undefined;
const AdminStore = require(path.join(__dirname, '../js/admin-store.js'));
const store = window.adminStore || new AdminStore();

let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 200) : ''}`); if (!ok) failed++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const M1 = U(1), SUB1 = U(2), M2 = U(3), SUB2 = U(4), OTHER = U(5), ME = U(9);
const shelters = [
  { id: M1, name: 'Main One', parentId: null, capacity: 10 },
  { id: SUB1, name: 'Sub of One', parentId: M1 },
  { id: M2, name: 'Main Two', parentId: null, capacity: 20 },
  { id: SUB2, name: 'Sub of Two', parentId: M2 },
  { id: OTHER, name: 'Somebody Else', parentId: null }
];
const imp = (id, shelterId, extra = {}) => ({ id, shelterId, status: 'active_impounded', ...extra });
const impounds = [imp('a', M1), imp('b', SUB1), imp('c', M2), imp('d', SUB2), imp('e', OTHER),
  imp('t', SUB2, { transferStatus: 'pending', transferToId: M2, originShelterId: SUB2 })];
const tickets = [{ id: 't1', impoundId: 'c', status: 'unpaid', payeeShelterId: M2, amount: 500 }, { id: 't2', impoundId: 'e', status: 'unpaid', payeeShelterId: OTHER, amount: 500 }];
store.getShelters = () => shelters.map(s => ({ ...s }));
store.getImpoundments = () => impounds.map(i => ({ ...i }));
store.getTickets = () => tickets.map(t => ({ ...t }));
const errors = [];
store.dbError = (what, err) => errors.push(what + ': ' + (err && err.message));
store.logAction = () => {}; store.notify = () => {};
store.syncFromSupabase = () => Promise.resolve(true);
store.refreshAccount = () => Promise.resolve();
const calls = [];
const updates = [];
const fakeSb = {
  rpc: async (name, args) => { calls.push({ name, args }); return { data: U(7), error: null }; },
  from: (t) => ({ update: (row) => ({ eq: (col, id) => ({ select: async () => { updates.push({ t, id, row }); return { data: [{ id }], error: null }; } }) }) })
};
store.waitForClient = async () => fakeSb;
store.client = () => fakeSb;
const signIn = (shelterId, role) => { window.adminApp = { currentAdmin: { id: ME, shelter_id: shelterId, facility_role: role }, showToast() {} }; };
const setExtra = (ids) => { mem['pawtrack_extra_main_ids'] = JSON.stringify(ids); };

(async () => {
  // A manager of Main One who also manages Main Two
  signIn(M1, 'manager'); setExtra([M2]);
  check('lists both main facilities', eq(store.getMainFacilities().map(s => s.id), [M1, M2]));
  check('lists the sub-facilities of both', eq(store.getSubFacilities().map(s => s.id).sort(), [SUB1, SUB2].sort()));
  check('the whole tree is theirs, nothing of anyone else', eq(store.getMyFacilityIds().sort(), [M1, SUB1, M2, SUB2].sort()));
  check('they manage every facility in it', eq(store.getManagedShelterIds().sort(), [M1, SUB1, M2, SUB2].sort()));
  check('they see the pets of all of them, not another facility\'s', eq(store.getMyImpoundments().map(i => i.id).sort(), ['a', 'b', 'c', 'd', 't']));
  check('a transfer into the second main facility is theirs to confirm', eq(store.getIncomingTransfers().map(i => i.id), ['t']));
  check('penalties payable to the second main facility are theirs to collect, not another facility\'s', eq(store.getTicketsToCollect().map(t => t.id), ['t1']));

  // Staff of Main One do not get the extra main
  signIn(M1, 'staff');
  check('staff only see the facility they work in, not the extra main', eq(store.getMyFacilityIds().sort(), [M1, SUB1].sort()) && store.getManagedShelterIds().length === 0);

  // A sub-facility employee
  signIn(SUB2, 'manager'); setExtra([M2]);
  check('a sub-facility manager has no main facilities of their own to add to', store.getMainFacilities().length === 0 && eq(store.getMyFacilityIds(), [SUB2]));

  // Adding a main facility
  signIn(M1, 'manager'); setExtra([]);
  const newId = await new Promise(r => store.saveShelter({ id: 'sh-new', asMain: true, name: 'Third', address: 'Addr', lat: 14, lng: 121, capacity: 30 }, r));
  const c = calls.find(x => x.name === 'add_main_facility');
  check('a manager can add another main facility', newId === U(7) && c && c.args.p.name === 'Third' && !('parent_id' in c.args.p), JSON.stringify(calls));
  check('it does not use the "register your first facility" call', !calls.some(x => x.name === 'register_facility'));

  calls.length = 0; errors.length = 0;
  signIn(M1, 'staff');
  let done = 'unset'; store.saveShelter({ id: 'sh-new', asMain: true, name: 'X', address: 'Y', lat: 1, lng: 1 }, (id) => { done = id; });
  check('staff cannot add a main facility', done === null && !calls.length && errors.length === 1, errors);
  signIn(SUB1, 'manager'); done = 'unset'; errors.length = 0;
  store.saveShelter({ id: 'sh-new', asMain: true, name: 'X', address: 'Y', lat: 1, lng: 1 }, (id) => { done = id; });
  check('a sub-facility\'s manager cannot add a main facility', done === null && !calls.length, errors);

  // A sub-facility is created under the chosen main facility
  signIn(M1, 'manager'); setExtra([M2]); calls.length = 0;
  await new Promise(r => store.saveShelter({ id: 'sh-s', asSub: true, parentId: M2, name: 'New Sub', address: 'A', lat: 1, lng: 1 }, r));
  const sub = calls.find(x => x.name === 'create_sub_facility');
  check('the new sub-facility is sent with the chosen main facility', sub && sub.args.p.parent_id === M2, JSON.stringify(calls));
  calls.length = 0; errors.length = 0; done = 'unset';
  store.saveShelter({ id: 'sh-s', asSub: true, parentId: OTHER, name: 'Hijack', address: 'A', lat: 1, lng: 1 }, (id) => { done = id; });
  check('...but never under a main facility that is not theirs', done === null && !calls.length, errors);
  await new Promise(r => store.saveShelter({ id: 'sh-s', asSub: true, name: 'Default Sub', address: 'A', lat: 1, lng: 1 }, r));
  check('without a choice the sub-facility goes under their own main facility', !('parent_id' in calls[calls.length - 1].args.p));

  // Editing the second main facility
  errors.length = 0;
  const edited = await new Promise(r => store.saveShelter({ id: M2, name: 'Main Two renamed', address: 'A', lat: 1, lng: 1 }, r));
  check('the manager can edit the second main facility', edited === M2 && updates.some(u => u.id === M2) && errors.length === 0, JSON.stringify({ edited, errors }));
  signIn(M1, 'staff'); errors.length = 0;
  let refused = 'unset'; store.saveShelter({ id: M2, name: 'Nope', address: 'A', lat: 1, lng: 1 }, (id) => { refused = id; });
  check('staff cannot edit it', refused === null && errors.length === 1, errors);

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
