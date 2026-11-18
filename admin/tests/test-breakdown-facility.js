// The breakdown describes only the signed-in account's facility (and its sub-facilities).
// Run: node admin/tests/test-breakdown-facility.js
const path = require('path');
global.window = global;
window.IMPOUND_OUTCOMES = { claimed: { label: 'Reunited with owner', color: 'c' }, forfeited: { label: 'Unclaimed', color: 'f' } };
require(path.join(__dirname, '../js/views/breakdown-view.js'));
const V = window.BreakdownView;
let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 200) : ''}`); if (!ok) failed++; };
const past = new Date(Date.now() - 3600e3).toISOString();
const mine = [
  { id: '1', shelterId: 'MAIN', species: 'Dog', breed: 'aspin', age: '2 years', rfidTag: 'T1', status: 'active_impounded', claimDeadline: past, intakeDate: past },
  { id: '2', shelterId: 'SUB', species: 'Cat', breed: 'puspin', age: '6 months', petId: 'p1', status: 'claimed', intakeDate: past },
  { id: '3', shelterId: 'SUB', species: 'Dog', breed: 'Aspin', age: '', status: 'forfeited', intakeDate: past }
];
const mk = (over = {}) => ({
  getMyShelter: () => ({ id: 'MAIN', name: 'Main Shelter' }), getMyImpoundments: () => mine, getMyFacilityIds: () => ['MAIN', 'SUB'],
  getShelters: () => [{ id: 'MAIN', name: 'Main Shelter' }, { id: 'SUB', name: 'Sub One', parentId: 'MAIN' }, { id: 'OTHER', name: 'Other' }],
  getPets: () => [{ id: 'p1', species: 'Cat', microchipNo: 'CHIP' }, { id: 'zz', species: 'Dog' }],
  getImpoundments: () => { throw new Error('must not read every facility'); },
  getCases: () => { throw new Error('no missing cases'); }, getSightings: () => { throw new Error('no sightings'); }, ...over
});
const render = (store) => { window.adminStore = store; const c = { innerHTML: '', querySelectorAll: () => [] }; V.render(c); return c.innerHTML; };

let html = '';
try { html = render(mk()); check('renders from the facility\'s impoundments only', true); } catch (e) { check('renders from the facility\'s impoundments only', false, e.message); }
check('names the facility and its sub-facility', /Main Shelter \+ 1 sub-facility/.test(html));
check('counts the 3 animals taken in', />Animals taken in<[\s\S]*?kpi-value">3</.test(html), html.match(/Animals taken in[\s\S]{0,120}/)?.[0]);
check('one of three has no chip or tag... (the linked pet\'s chip counts)', /33%/.test(html), html.match(/Without chip[\s\S]{0,160}/)?.[0]);
check('intakes by facility is shown for a main facility with subs', /Intakes by facility/.test(html) && /Sub One/.test(html));
check('no registry-wide wording remains', !/Community sighting|Self-report|Where reports come from|go missing/i.test(html));
check('breeds are merged and counted (Aspin x2)', /Aspin<\/b>[\s\S]*?<b>2<\/b>/.test(html));

const single = render(mk({ getMyFacilityIds: () => ['MAIN'], getShelters: () => [{ id: 'MAIN', name: 'Main Shelter' }] }));
check('a facility without subs sees registered vs unregistered instead', /Registered or not/.test(single) && !/Intakes by facility/.test(single));
const none = render(mk({ getMyShelter: () => null }));
check('no facility: set-up prompt, no data', /Set up your impound facility/.test(none) && !/Animals taken in/.test(none));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
