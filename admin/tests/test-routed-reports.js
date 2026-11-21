// Missing reports routed to a facility show up as alerts for that facility's staff (and not for others).
// Run: node admin/tests/test-routed-reports.js
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
require(path.join(__dirname, '../js/views/notifs-view.js'));

let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 200) : ''}`); if (!ok) failed++; };

const caseRow = store.caseFromReport({
  id: 'r1', pet_name: 'Mochi', species: 'Dog', status: 'missing', created_at: new Date().toISOString(),
  last_seen_location: 'Near the market', lat: 14.6, lng: 121.0,
  routed_shelter_id: 'S1', routed_via: 'barangay', last_seen_barangay: 'Bagong Silangan', last_seen_city: 'Quezon City'
}, []);
check('a case carries its routing', caseRow.routedShelterId === 'S1' && caseRow.routedVia === 'barangay' && caseRow.lastSeenBarangay === 'Bagong Silangan');
const plain = store.caseFromReport({ id: 'r0', pet_name: 'X', status: 'missing', created_at: new Date().toISOString() }, []);
check('an older row without routing still loads', plain.routedShelterId === null && plain.routedVia === null);

const day = 24 * 3600 * 1000;
const mk = (id, shelter, over = {}) => ({ ...caseRow, id, routedShelterId: shelter, ...over });
const cases = [
  mk('a', 'S1'),
  mk('b', 'SUB'),                                                       // a sub-facility of mine
  mk('c', 'OTHER'),                                                     // somebody else's area
  mk('d', null, { routedVia: 'pawtrack' }),                             // PawTrack handles it
  mk('e', 'S1', { status: 'reunited' }),                                // already found
  mk('f', 'S1', { petName: 'Old', createdAt: new Date(Date.now() - 10 * day).toISOString() }) // too old for an alert
];
store.getCases = () => cases;
store.getShelters = () => [{ id: 'S1', name: 'Main One', parentId: null }, { id: 'SUB', name: 'Sub One', parentId: 'S1' }, { id: 'OTHER', name: 'Elsewhere', parentId: null }];
store.getImpoundments = () => [];
store.getSightings = () => [];
store.getMyFacilityIds = () => ['S1', 'SUB'];

const mine = store.getRoutedReports().map(c => c.id).sort();
check('only open reports routed to my facilities count', mine.join() === 'a,b,f', mine.join());

const alerts = window.NotifsView.buildOpsAlerts().filter(a => a.kind === 'missing');
check('one alert per recent routed report', alerts.length === 2, alerts.length);
check('a fresh report is high severity', alerts.every(a => a.severity === 'high'));
check('the alert names the pet and the place', /Mochi/.test(alerts[0].title) && /Bagong Silangan, Quezon City/.test(alerts[0].message));
check('the alert names the facility it was routed to', alerts.some(a => /Main One/.test(a.message)) && alerts.some(a => /Sub One/.test(a.message)));

store.getMyFacilityIds = () => [];
check('an account with no facility gets nothing', store.getRoutedReports().length === 0 && window.NotifsView.buildOpsAlerts().every(a => a.kind !== 'missing'));

// --- tapping an alert opens that report on the Reports page ---
store.getMyFacilityIds = () => ['S1', 'SUB'];
const linked = window.NotifsView.buildOpsAlerts().filter(a => a.kind === 'missing');
check('a missing alert links to its report', linked.every(a => /^#reports\/(a|b)$/.test(a.href)), linked.map(a => a.href).join());
check('the alert card is a real link', /<a class="alert-item[^"]*" href="#reports\/a"/.test(window.NotifsView.renderOpsAlerts()));
check('other alerts link to their page', window.NotifsView.buildOpsAlerts().every(a => a.href));

window.PawSearch = { matches: () => true, highlight: (t) => t };
require(path.join(__dirname, '../js/views/reports-view.js'));
const RV = window.ReportsView;
const now = Date.now();
const incidents = Array.from({ length: 25 }, (_, i) => ({ id: 'id' + i, name: 'P' + i, status: 'lost', species: 'Dog', contact: 'Owner report', ts: now - i * 1000 }));
window.adminApp = { routeParam: 'id17' };
RV.status = 'found'; RV.query = 'zzz'; RV.page = 1;
RV.applyDeepLink(incidents);
check('the link clears filters and opens the page that holds the report', RV.status === 'all' && RV.query === '' && RV.page === 2 && RV._focusId === 'id17', `${RV.status} ${RV.page} ${RV._focusId}`);
RV._focusId = null; RV.page = 3;
RV.applyDeepLink(incidents);
check('the same link is not applied again on a redraw', RV.page === 3 && RV._focusId === null);
window.adminApp.routeParam = 'not-loaded-yet'; RV._linked = '';
RV.applyDeepLink(incidents);
check('a report that has not loaded yet is waited for', RV._linked === '' && RV._focusId === null);
window.adminApp.routeParam = ''; RV.applyDeepLink(incidents);
check('leaving the link forgets it', RV._linked === '');

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
