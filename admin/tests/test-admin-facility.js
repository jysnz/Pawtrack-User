// An admin account belongs to ONE impound facility; a facility has many accounts (one manager + staff).
// Run: node admin/tests/test-admin-facility.js
const path = require('path');

const mem = {};
global.window = global;
global.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }
};
global.document = { addEventListener() {}, hidden: false };
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.BroadcastChannel = undefined;

const AdminStore = require(path.join(__dirname, '../js/admin-store.js'));
const store = window.adminStore || new AdminStore();
require(path.join(__dirname, '../js/views/shelters-view.js'));

let failed = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${!ok && extra ? ' -> ' + extra : ''}`);
  if (!ok) failed++;
};

const MANAGER = '11111111-1111-4111-8111-111111111111';
const STAFF = '22222222-2222-4222-8222-222222222222';
const LONER = '33333333-3333-4333-8333-333333333333';
const MINE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const THEIRS_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NEW_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const shelters = [
  { id: MINE_ID, name: 'Mine <b>Pound</b>', address: 'A St', lat: 14.6, lng: 121.0 },
  { id: THEIRS_ID, name: 'Theirs', address: 'B St', lat: 14.7, lng: 121.1 }
];
const impounds = [
  { id: 'i1', shelterId: MINE_ID, status: 'active_impounded' },
  { id: 'i2', shelterId: THEIRS_ID, status: 'active_impounded' },
  { id: 'i3', shelterId: MINE_ID, status: 'claimed' }
];
store.getShelters = () => shelters.map(s => ({ ...s }));
store.getImpoundments = () => impounds.map(i => ({ ...i }));

const errors = [];
store.dbError = (what, err) => errors.push(`${what}: ${err && err.message}`);
store.logAction = () => {};
store.notify = () => {};
store.syncFromSupabase = () => Promise.resolve(true);
store.refreshAccount = () => Promise.resolve();

// A fake Supabase client that records what the console asks the database to do
const calls = [];
let rpcError = null;
const rpcResult = { register_facility: NEW_ID, join_facility: MINE_ID, rotate_facility_invite: 'NEWCODE123' };
const fakeSb = {
  rpc: async (name, args) => {
    calls.push({ name, args });
    return rpcError ? { data: null, error: { message: rpcError } } : { data: rpcResult[name] === undefined ? null : rpcResult[name], error: null };
  },
  from: (table) => ({
    update: (row) => ({ eq: (col, val) => ({ select: async () => { calls.push({ name: `update:${table}`, row, where: val }); return { data: [{ id: val }], error: null }; } }) })
  })
};
store.waitForClient = async () => fakeSb;
store.client = () => fakeSb;

const signIn = (account) => { window.adminApp = { currentAdmin: account, showToast() {} }; };
const asManager = () => signIn({ id: MANAGER, shelter_id: MINE_ID, facility_role: 'manager' });
const asStaff = () => signIn({ id: STAFF, shelter_id: MINE_ID, facility_role: 'staff' });
const asLoner = () => signIn({ id: LONER, shelter_id: null, facility_role: null });
const reset = () => { calls.length = 0; errors.length = 0; rpcError = null; };

(async () => {
  // ---- membership lookups ----
  asManager();
  check('manager: has a facility, role is manager', store.hasFacility() && store.myFacilityRole() === 'manager' && store.isFacilityManager());
  check('manager: getMyShelter returns their facility', store.getMyShelter().id === MINE_ID);
  asStaff();
  check('staff in the SAME facility see the same facility', store.getMyShelter().id === MINE_ID && !store.isFacilityManager() && store.myFacilityRole() === 'staff');
  check('manager and staff see the same impounds, nobody else\'s', store.getMyImpoundments().map(i => i.id).sort().join() === 'i1,i3');
  asLoner();
  check('an account with no facility has none and sees no impounds', !store.hasFacility() && store.getMyShelter() === null && store.getMyImpoundments().length === 0 && store.myFacilityRole() === null);
  signIn(null);
  check('signed out: nothing', !store.hasFacility() && store.getMyImpoundments().length === 0);

  // ---- registering a facility (first staff member becomes manager, through the database function) ----
  reset(); asLoner();
  const shelterData = { id: 'sh-1', name: 'Fresh Pound', address: 'Y St', lat: 14.6, lng: 121, fee: 'PHP 300 / day', capacity: 80, city: 'Pasig City', type: 'Municipal LGU Pound', officerInCharge: 'Dr. Cruz', hours: '8-5', holdingPeriodDays: 3 };
  const newId = await new Promise((resolve) => store.saveShelter(shelterData, resolve));
  const reg = calls.find(c => c.name === 'register_facility');
  check('registering calls register_facility and returns the new id', newId === NEW_ID && !!reg, String(newId));
  check('the payload carries the shared facility fields', reg && reg.args.p.name === 'Fresh Pound' && reg.args.p.capacity === 80 && reg.args.p.city === 'Pasig City' && reg.args.p.officer_in_charge === 'Dr. Cruz' && reg.args.p.daily_fee_php === 300 && reg.args.p.facility_type === 'Municipal LGU Pound', JSON.stringify(reg && reg.args));
  check('the client never sends an owner or role (membership is set by the database)', reg && !('owner_id' in reg.args.p) && !('facility_role' in reg.args.p));

  reset(); asStaff();
  let done = 'unset';
  store.saveShelter({ ...shelterData, id: 'sh-2' }, (id) => { done = id; });
  check('an account already in a facility cannot register another', done === null && !calls.length && errors.length === 1, errors[0]);

  reset(); asManager();
  rpcError = 'Your account already belongs to a facility';
  done = 'unset';
  store.saveShelter({ ...shelterData, id: 'sh-3' }, (id) => { done = id; });
  check('a second registration is refused client-side before it reaches the database', done === null && !calls.length, JSON.stringify(calls));

  reset(); asLoner(); rpcError = 'Only approved admins can register a facility';
  const failedId = await new Promise((resolve) => store.saveShelter(shelterData, resolve));
  check('a database refusal is reported and resolves null', failedId === null && errors.length >= 1, errors[0]);

  // ---- editing: manager only, own facility only ----
  reset(); asStaff();
  done = 'unset';
  store.saveShelter({ ...shelterData, id: MINE_ID }, (id) => { done = id; });
  check('staff cannot edit the facility', done === null && !calls.length && errors.length === 1, errors[0]);

  reset(); asManager();
  done = 'unset';
  store.saveShelter({ ...shelterData, id: THEIRS_ID }, (id) => { done = id; });
  check('a manager cannot edit another facility', done === null && !calls.length && errors.length === 1, errors[0]);

  reset(); asManager();
  const editedId = await new Promise((resolve) => store.saveShelter({ ...shelterData, id: MINE_ID, name: 'Renamed' }, resolve));
  const upd = calls.find(c => c.name === 'update:shelters');
  check('a manager can edit their own facility', editedId === MINE_ID && upd && upd.row.name === 'Renamed' && upd.where === MINE_ID, JSON.stringify(calls));

  reset(); signIn(null);
  done = 'unset';
  store.saveShelter(shelterData, (id) => { done = id; });
  check('saving while signed out is refused', done === null && errors.length === 1, errors[0]);

  // ---- joining with an invite code ----
  reset(); asLoner();
  let joinedId = null;
  const joined = await store.joinFacility('abc123', (id) => { joinedId = id; });
  const jc = calls.find(c => c.name === 'join_facility');
  check('joining sends the code to join_facility', joined === true && jc && jc.args.p_code === 'abc123' && joinedId === MINE_ID, JSON.stringify(calls));

  reset(); asLoner(); rpcError = 'That invite code is not valid';
  const bad = await store.joinFacility('nope');
  check('a wrong code is refused and reported', bad === false && errors.length === 1, errors[0]);

  // ---- manager tools go through database functions ----
  reset(); asManager();
  const code = await store.rotateInvite();
  check('rotateInvite returns the new code', code === 'NEWCODE123' && calls[0].name === 'rotate_facility_invite');
  reset(); await store.removeStaff(STAFF);
  check('removeStaff calls remove_facility_staff', calls[0].name === 'remove_facility_staff' && calls[0].args.p_admin === STAFF);
  reset(); await store.setStaffRole(STAFF, 'manager');
  check('setStaffRole calls set_facility_role', calls[0].name === 'set_facility_role' && calls[0].args.p_role === 'manager' && calls[0].args.p_admin === STAFF);
  reset(); await store.leaveFacility();
  check('leaveFacility calls leave_facility', calls[0].name === 'leave_facility');

  // ---- map view data ----
  asStaff();
  const list = window.SheltersView.collect();
  check('the page lists the facilities this account owns, not other accounts\' facilities', list.length === 1 && list[0].id === MINE_ID);
  check('the admin\'s facility is flagged and sorted first (for staff too)', list[0].id === MINE_ID && list[0].mine === true && list.filter(s => s.mine).length === 1);
  check('holding counts are per facility', list.find(s => s.id === MINE_ID).holding === 1);

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
