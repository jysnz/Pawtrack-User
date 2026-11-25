// The breakdown describes only the signed-in account's facility (and its sub-facilities).
// Run: node admin/tests/test-breakdown-facility.js
const path = require('path');
global.window = global;
require(require('path').join(__dirname, '..', '..', 'js', 'species.js'));
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
check('names the facility and its sub-facility', /<b>Main Shelter<\/b><span>1 sub-facility<\/span>/.test(html));
check('counts the 3 animals taken in, as one lead line', /<b class="dd-big">3<\/b><span>animals taken in<\/span>/.test(html), html.match(/dd-lead[\s\S]{0,160}/)?.[0]);
check('one of three has no chip or tag (the linked pet\'s chip counts), shown once as the one big fact', /Without a chip or tag[\s\S]{0,300}<dd>33%<\/dd>\s*<small>1 of 3 animals<\/small>/.test(html) && (html.match(/Without a chip or tag/g) || []).length === 1, html.match(/dd-facts[\s\S]{0,260}/)?.[0]);
check('intakes by facility is shown for a main facility with subs', /Intakes by facility/.test(html) && /Sub One/.test(html));
check('no registry-wide wording remains', !/Community sighting|Self-report|Where reports come from|go missing/i.test(html));
check('breeds are merged and counted (Aspin x2)', /Aspin<\/b>[\s\S]*?<b>2<\/b>/.test(html));

check('nothing repeats: no "most affected" tile (the species card says it), no card kit, no all-caps section labels', !/Most affected|kpi-card|bd-section-label|bd-eyebrow/.test(html));
check('sections run from general to specific: the hero (total, species), ages and breeds, then where from and how it ended', html.indexOf('Species') > 0 && html.indexOf('Species') < html.indexOf('Ages and breeds') && html.indexOf('Ages and breeds') < html.indexOf('Where they came from') && html.indexOf('nock-card-title">Age') > 0 && html.indexOf('nock-card-title">Age') < html.indexOf('nock-card-title">Breeds') && html.indexOf('Where they came from') < html.indexOf('How cases end'));
check('species is one colour-coded ribbon in the hero, not a second chart further down', /class="dd-now dd-hero bd-now"/.test(html) && /class="bd-ribbon" role="img" aria-label="Species: Dogs 67%, Cats 33%"/.test(html) && (html.match(/class="bd-ribbon-key"/g) || []).length === 1 && !/bd-donut-wrap[\s\S]{0,400}Species/.test(html) && /Aspin|Dogs/.test(html));
check('each ribbon segment is sized by its count and shows its share on hover', /<u style="flex:2; background:[^"]+" title="Dogs: 2 \(67%\)">/.test(html) && /<u style="flex:1; background:[^"]+" title="Cats: 1 \(33%\)">/.test(html));
check('each chart has a tap-for-the-formula button', ['bdSpecies', 'bdAge', 'bdBreeds', 'bdSource', 'bdOutcomes', 'bdChip'].every((k) => new RegExp(`data-info="${k}"`).test(html)));
check('no penalty block when there are no tickets', !/Penalty tickets/.test(html));
const withPen = render(mk({ penaltyReady: true, getTickets: () => [{ id: 't1', impoundId: '1', status: 'unpaid', amount: 500 }, { id: 't2', impoundId: '2', status: 'paid', amount: 700 }, { id: 't3', impoundId: '3', status: 'waived', amount: 500 }, { id: 'x', impoundId: 'other', status: 'unpaid', amount: 900 }] }));
check('penalty tickets get their own card beside how cases end, for this facility only', /nock-card-title">Penalty tickets/.test(withPen) && /Unpaid<\/dt><dd>1 <small>PHP 500<\/small>/.test(withPen) && /Paid<\/dt><dd>1 <small>PHP 700<\/small>/.test(withPen) && /Waived<\/dt><dd>1/.test(withPen) && !/PHP 900/.test(withPen) && /bd-span-6 bd-tall/.test(withPen));
check("the formula pop-ups get this page's own figures", V._live.total === 3 && V._live.unidentified === 1 && V._live.pen.unpaidPhp === 500 && V._live.withAge === 2);

const single = render(mk({ getMyFacilityIds: () => ['MAIN'], getShelters: () => [{ id: 'MAIN', name: 'Main Shelter' }] }));
check('a facility without subs sees registered vs unregistered instead', /Registered or not/.test(single) && !/Intakes by facility/.test(single));
const none = render(mk({ getMyShelter: () => null }));
check('no facility: set-up prompt, no data', /Set up your impound facility/.test(none) && !/Animals taken in/.test(none));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
