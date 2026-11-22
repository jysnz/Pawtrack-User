// The dashboard describes the signed-in staff member's own facility only.
// Run: node admin/tests/test-dashboard-facility.js
const path = require('path');
global.window = global;
global.document = { addEventListener() {} };
global.sessionStorage = { getItem: () => null, setItem() {} };
window.AdminMotion = { routeEntering: false };

require(path.join(__dirname, '../js/views/activation-view.js'));
const V = window.ActivationView;

let failed = 0;
const check = (name, ok, extra) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${!ok && extra !== undefined ? ' -> ' + String(extra).slice(0, 200) : ''}`); if (!ok) failed++; };

const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();
const imp = (id, shelterId, extra = {}) => ({ id, shelterId, shelterName: shelterId, petName: 'Pet ' + id, species: 'Dog', status: 'active_impounded', intakeDate: daysAgo(1), claimDeadline: hoursFromNow(48), ...extra });

const mine = [
  imp('a', 'MAIN'),
  imp('b', 'SUB', { species: 'Cat', claimDeadline: hoursFromNow(-5) }),                       // overdue
  imp('c', 'SUB', { claimDeadline: hoursFromNow(10), petId: 'p1' }),                          // due soon
  imp('d', 'MAIN', { status: 'claimed', intakeDate: daysAgo(5), closedAt: daysAgo(3) }),
  imp('e', 'MAIN', { transferStatus: 'pending', transferToId: 'MAIN', originShelterId: 'SUB' })   // incoming
];
const everyoneElse = [imp('x1', 'OTHER'), imp('x2', 'OTHER')];

const render = (store) => {
  window.adminStore = store;
  const container = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  V.render(container);
  return container.innerHTML;
};
const base = {
  syncStatus: 'live', hasFacility: () => true,
  getMyShelter: () => ({ id: 'MAIN', name: 'Main Shelter' }),
  getMyImpoundments: () => mine,
  getImpoundments: () => mine.concat(everyoneElse),
  getMyFacilityIds: () => ['MAIN', 'SUB'],
  getShelters: () => [{ id: 'MAIN', name: 'Main Shelter', capacity: 10 }, { id: 'SUB', name: 'Sub One', capacity: 10, parentId: 'MAIN' }, { id: 'OTHER', name: 'Other', capacity: 99 }],
  getSubFacilities: () => [{ id: 'SUB', name: 'Sub One', capacity: 10, parentId: 'MAIN' }],
  getMainFacility: () => null,
  getIncomingTransfers: () => [mine[4]],
  getOutgoingTransfers: () => [],
  getTickets: () => [{ id: 't1', impoundId: 'c', status: 'unpaid', amount: 500, payeeShelterId: 'MAIN' }, { id: 't2', impoundId: 'x1', status: 'unpaid', amount: 900, payeeShelterId: 'OTHER' }],
  getTicketsToCollect: () => [{ id: 't1' }],
  penaltyReady: true,
  // registry-wide data that must NOT leak into the page
  getPets: () => { throw new Error('dashboard must not read the pet registry'); },
  getCases: () => { throw new Error('dashboard must not read missing cases'); },
  getSightings: () => { throw new Error('dashboard must not read sightings'); }
};

let html = '';
try { html = render(base); check('renders without touching the pet registry, cases or sightings', true); }
catch (e) { check('renders without touching the pet registry, cases or sightings', false, e.message); }

check('names the facility and says it is a main facility', /Main Shelter/.test(html) && /Main facility/.test(html));
check('counts only this facility\'s animals in holding (4 of 5, not the other facility\'s)', />4 <span class="kpi-unit">animals/.test(html), html.match(/In holding now[\s\S]{0,400}/)?.[0]);
check('capacity uses the facility tree only (4 of 20)', /4 of 20 places taken/.test(html) && />20%</.test(html), html.match(/Capacity in use[\s\S]{0,400}/)?.[0]);
check('flags the overdue claim', /1 past deadline/.test(html));
check('needs-attention lists the incoming transfer and the unpaid ticket', /pets arriving from sub-facilities/.test(html) && /penalty tickets waiting for payment/.test(html));
check('penalty card counts only tickets for this facility (not the other facility\'s 900)', /1 · PHP 500/.test(html) && !/PHP 900/.test(html));
check('the page is for one facility, so there is no by-facility breakdown', !/By facility/.test(html));
check('no registry-wide wording remains', !/Pets safe at home|Median recovery|New registrations|Recovery funnel|sighting/i.test(html));
check('the report only holds facility figures', V._report.metrics.some((m) => m[0] === 'Capacity in use') && !V._report.metrics.some((m) => /Registered pets|missing cases/i.test(m[0])));

// A sub-facility employee
mine.length = 0; mine.push(imp('s1', 'SUB'));
const subHtml = render({ ...base, getMyShelter: () => ({ id: 'SUB', name: 'Sub One', parentId: 'MAIN' }), getMyFacilityIds: () => ['SUB'], getSubFacilities: () => [], getMainFacility: () => ({ id: 'MAIN', name: 'Main Shelter' }), getIncomingTransfers: () => [], getTickets: () => [], getTicketsToCollect: () => [], getShelters: base.getShelters });
check('a sub-facility employee sees it labelled as a sub-facility, without the facility breakdown', /Sub-facility of Main Shelter/.test(subHtml) && !/By facility/.test(subHtml));

// No facility at all
const none = render({ ...base, hasFacility: () => false, getMyShelter: () => null, getMyImpoundments: () => [], getMyFacilityIds: () => [], getSubFacilities: () => [], getIncomingTransfers: () => [], getTickets: () => [], getTicketsToCollect: () => [] });
check('someone without a facility sees the set-up prompt and zeros, not other facilities\' data', /not part of an impound facility/.test(none) && />0 <span class="kpi-unit">animals/.test(none));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
