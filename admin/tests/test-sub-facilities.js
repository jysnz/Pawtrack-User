// Sub-facilities, the hand-over of uncollected pets, and penalty tickets (store logic).
// Run: node admin/tests/test-sub-facilities.js
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
const check = (name, ok, extra) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${!ok && extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); if (!ok) failed++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const MAIN = U(1), SUB_A = U(2), SUB_B = U(3), OTHER = U(4), OTHER_SUB = U(5), ME = U(9);
const shelters = [
  { id: MAIN, name: 'Main', parentId: null },
  { id: SUB_A, name: 'Sub A', parentId: MAIN },
  { id: SUB_B, name: 'Sub B', parentId: MAIN },
  { id: OTHER, name: 'Other main', parentId: null },
  { id: OTHER_SUB, name: 'Other sub', parentId: OTHER }
];
const imp = (id, shelterId, extra = {}) => ({ id, shelterId, status: 'active_impounded', ...extra });
const impounds = [
  imp('i-main', MAIN), imp('i-a', SUB_A), imp('i-b', SUB_B), imp('i-other', OTHER), imp('i-other-sub', OTHER_SUB),
  imp('i-moving', SUB_A, { transferStatus: 'pending', transferToId: MAIN, originShelterId: SUB_A }),
  imp('i-moving-other', OTHER_SUB, { transferStatus: 'pending', transferToId: OTHER, originShelterId: OTHER_SUB }),
  imp('i-claimed', SUB_A, { status: 'claimed', transferStatus: 'pending', transferToId: MAIN })
];
const tickets = [
  { id: 't1', impoundId: 'i-a', status: 'unpaid', payeeShelterId: MAIN, amount: 500, ticketNo: 'PT-2026-00001' },
  { id: 't2', impoundId: 'i-b', status: 'paid', payeeShelterId: MAIN, amount: 500, ticketNo: 'PT-2026-00002' },
  { id: 't3', impoundId: 'i-other', status: 'unpaid', payeeShelterId: OTHER, amount: 300, ticketNo: 'PT-2026-00003' }
];
store.getShelters = () => shelters.map(s => ({ ...s }));
store.getImpoundments = () => impounds.map(i => ({ ...i }));
store.getTickets = () => tickets.map(t => ({ ...t }));

const errors = [];
store.dbError = (what, err) => errors.push(`${what}: ${err && err.message}`);
store.logAction = () => {};
store.notify = () => {};
store.syncFromSupabase = () => Promise.resolve(true);
store.refreshAccount = () => Promise.resolve();
const calls = [];
let rpcError = null;
const rpcResult = { create_sub_facility: U(7), rotate_facility_invite: 'NEWCODE', run_overdue_transfers: 2 };
const fakeSb = {
  rpc: async (name, args) => { calls.push({ name, args }); return rpcError ? { data: null, error: { message: rpcError } } : { data: rpcResult[name] === undefined ? null : rpcResult[name], error: null }; },
  from: () => ({ update: () => ({ eq: () => ({ select: async () => ({ data: [{ id: 'x' }], error: null }) }) }) })
};
store.waitForClient = async () => fakeSb;
store.client = () => fakeSb;
const reset = () => { calls.length = 0; errors.length = 0; rpcError = null; };
const signIn = (shelterId, role) => { window.adminApp = { currentAdmin: { id: ME, shelter_id: shelterId, facility_role: role }, showToast() {} }; };

(async () => {
  // ---- who sees what ----
  signIn(MAIN, 'staff');
  check('main staff: is a main facility, has no main facility above', store.isMainFacility() && store.getMainFacility() === null);
  check('main staff: sub-facilities are exactly their own', eq(store.getSubFacilities().map(s => s.id).sort(), [SUB_A, SUB_B].sort()));
  check('main staff: facility ids = main + own subs', eq(store.getMyFacilityIds().sort(), [MAIN, SUB_A, SUB_B].sort()));
  check('main staff see impounds of the main facility and its sub-facilities only', eq(store.getMyImpoundments().map(i => i.id).sort(), ['i-a', 'i-b', 'i-claimed', 'i-main', 'i-moving']), store.getMyImpoundments().map(i => i.id));
  signIn(SUB_A, 'staff');
  check('sub employee: not a main facility, knows the main facility', !store.isMainFacility() && store.getMainFacility().id === MAIN);
  check('sub employee: no sub-facilities of their own', store.getSubFacilities().length === 0);
  check('sub employee sees only their sub-facility\'s impounds', eq(store.getMyImpoundments().map(i => i.id).sort(), ['i-a', 'i-claimed', 'i-moving']));
  check('sub employee manages nothing (staff)', store.getManagedShelterIds().length === 0);
  signIn(MAIN, 'manager');
  check('main manager manages the main facility and its sub-facilities', eq(store.getManagedShelterIds().sort(), [MAIN, SUB_A, SUB_B].sort()));
  signIn(SUB_A, 'manager');
  check('a sub-facility manager manages only that sub-facility', eq(store.getManagedShelterIds(), [SUB_A]));

  // ---- transfers ----
  signIn(MAIN, 'staff');
  check('incoming: pending, to my facility, still in holding', eq(store.getIncomingTransfers().map(i => i.id), ['i-moving']), store.getIncomingTransfers().map(i => i.id));
  signIn(SUB_A, 'staff');
  check('a sub-facility has no incoming transfers; its pending ones are outgoing', store.getIncomingTransfers().length === 0 && eq(store.getOutgoingTransfers().map(i => i.id).sort(), ['i-claimed', 'i-moving']));
  signIn(MAIN, 'staff'); reset();
  check('confirming an arrival sends the answer to the database', (await store.confirmTransferArrival('i-moving', true, 'Cage 4', 'ok')) && calls[0].name === 'confirm_transfer_arrival' && calls[0].args.p_arrived === true && calls[0].args.p_cage === 'Cage 4', calls);
  reset(); rpcError = 'Only the receiving facility can confirm this arrival';
  check('a refusal is reported and returns false', (await store.confirmTransferArrival('i-moving', true, 'x', '')) === false && errors.length === 1, errors);

  // ---- creating and editing sub-facilities ----
  reset(); signIn(MAIN, 'manager');
  const subId = await new Promise(r => store.saveShelter({ id: 'sh-new', asSub: true, name: 'New Sub', address: 'Somewhere', lat: 14.6, lng: 121, capacity: 20 }, r));
  const c = calls.find(x => x.name === 'create_sub_facility');
  check('the main manager can create a sub-facility', subId === U(7) && c && c.args.p.name === 'New Sub', JSON.stringify(calls));
  check('the client never sends a parent or role (the database sets them)', c && !('parent_id' in c.args.p) && !('facility_role' in c.args.p));
  reset(); signIn(MAIN, 'staff');
  let done = 'unset'; store.saveShelter({ id: 'sh-new', asSub: true, name: 'X', address: 'Y', lat: 1, lng: 1 }, (id) => { done = id; });
  check('main staff who are not managers cannot create one', done === null && !calls.length && errors.length === 1, errors);
  reset(); signIn(SUB_A, 'manager'); done = 'unset';
  store.saveShelter({ id: 'sh-new', asSub: true, name: 'X', address: 'Y', lat: 1, lng: 1 }, (id) => { done = id; });
  check('a sub-facility\'s manager cannot create sub-facilities of their own', done === null && !calls.length, errors);
  reset(); signIn(MAIN, 'manager');
  const edited = await new Promise(r => store.saveShelter({ id: SUB_A, name: 'Sub A renamed', address: 'Z', lat: 1, lng: 1 }, r));
  check('the main manager can edit a sub-facility', edited === 'x' && errors.length === 0, { edited, errors });
  reset(); signIn(MAIN, 'manager'); done = 'unset';
  store.saveShelter({ id: OTHER, name: 'Hijack', address: 'Z', lat: 1, lng: 1 }, (id) => { done = id; });
  check('...but not a facility outside their tree', done === null && errors.length === 1, errors);
  reset(); signIn(MAIN, 'manager');
  check('rotating a sub-facility\'s invite code names that facility', (await store.rotateInvite(SUB_A)) === 'NEWCODE' && calls[0].args.p_shelter === SUB_A, calls);

  // ---- penalty tickets ----
  signIn(MAIN, 'staff');
  check('tickets to collect: unpaid and payable to my facility', eq(store.getTicketsToCollect().map(t => t.id), ['t1']));
  check('ticket lookup by impound', store.getTicketForImpound('i-a').ticketNo === 'PT-2026-00001' && store.getTicketForImpound('i-main') === null);
  reset();
  check('recording a payment calls record_ticket_payment', (await store.recordTicketPayment('t1', 'OR-1')) && calls[0].name === 'record_ticket_payment' && calls[0].args.p_reference === 'OR-1', calls);
  reset();
  check('waiving calls waive_ticket with a reason', (await store.waiveTicket('t1', 'Indigent owner')) && calls[0].name === 'waive_ticket' && calls[0].args.p_reason === 'Indigent owner', calls);
  reset();
  const blocked = store.claimImpoundment('i-a', 'Officer');
  check('a pet with an unpaid ticket cannot be released', blocked === null && errors.length === 1 && /PT-2026-00001/.test(errors[0]), errors);
  reset();
  check('a pet with a paid ticket can be released', !!store.claimImpoundment('i-b', 'Officer') && errors.length === 0, errors);

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
