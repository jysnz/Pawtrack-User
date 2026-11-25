// The dashboard describes the signed-in staff member's own facility only.
// Run: node admin/tests/test-dashboard-facility.js
const path = require('path');
global.window = global;
require(require('path').join(__dirname, '..', '..', 'js', 'species.js'));
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
  getTicketsToCollect: () => [{ id: 't1', amount: 500 }],
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
check('counts only this facility\'s animals in holding (4 of 5, not the other facility\'s)', /<b class="dd-big">4<\/b><span>animals in holding<\/span>/.test(html), html.match(/dd-lead[\s\S]{0,200}/)?.[0]);
check('capacity uses the facility tree only (4 of 20), drawn as one kennel per place', /4 of 20 places taken, 20% full/.test(html) && (html.match(/class="dd-k is-/g) || []).length >= 20 && /class="dd-kennels" role="img" aria-label="4 of 20 places taken/.test(html), html.match(/dd-cap[\s\S]{0,160}/)?.[0]);
check('flags the overdue claim, in the kennels and in the to-do list', /1 past the claim deadline/.test(html) && /class="dd-k is-late"/.test(html) && /<b class="dt-title">pet is past its claim deadline<\/b>/.test(html));
check('needs-attention lists the incoming transfer and the unpaid ticket, in the singular for one', /<b class="dt-title">pet arriving from a sub-facility<\/b>/.test(html) && /<b class="dt-title">penalty ticket waiting for payment<\/b>/.test(html) && !/1 pets|1 tickets/.test(html));
check('each task says what to do and has a clear action word', /Confirm that they reached your facility/.test(html) && /class="dt-cta">Confirm<\/span>/.test(html) && /Record the payment or waive the penalty/.test(html) && /class="dt-cta">Collect<\/span>/.test(html) && !/→/.test(html.replace(/<style[\s\S]*?<\/style>/g, '')));
check('a task button reads out its urgency, count and what to do', /aria-label="Urgent: 1 pet is past its claim deadline\. Release it to its owner/.test(html));
check('the To do heading says how many things need a person', /<h2>To do<\/h2><p>\d things? needs? a person<\/p>/.test(html));
check('holding rows show the animal, its details and a claim-window bar', /class="dh-row"/.test(html) && /class="dh-bar tone-/.test(html) && /class="dash-time tone-/.test(html) && /View all|Open impoundments/.test(html));
check('to do and in holding sit side by side as two ruled lists', /\.dd-cols \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/.test(require('fs').readFileSync(path.join(__dirname, '..', 'css', 'polish.css'), 'utf8')) && /class="dd-col"/.test(html));
check('each fact has one home: no species ring, no outcomes funnel, no by-facility or penalty card on the Dashboard', !/Holding by species|How cases ended|By facility|Penalty tickets|kpi-card|funnel-/.test(html));
check('the page has no numbered section badges and no all-caps eyebrow', !/class="dash-sec-no"|dash-eyebrow/.test(html));
check('the unpaid penalty shows once, in the to-do list, for this facility only (not the other facility\'s 900)', /PHP 500 to collect/.test(html) && !/PHP 900/.test(html));
check('the page is for one facility, so there is no by-facility breakdown', !/By facility/.test(html));
check('no registry-wide wording remains', !/Pets safe at home|Median recovery|New registrations|Recovery funnel|sighting/i.test(html));
check('the report only holds facility figures', V._report.metrics.some((m) => m[0] === 'Capacity in use') && !V._report.metrics.some((m) => /Registered pets|missing cases/i.test(m[0])));

// A sub-facility employee
mine.length = 0; mine.push(imp('s1', 'SUB'));
const subHtml = render({ ...base, getMyShelter: () => ({ id: 'SUB', name: 'Sub One', parentId: 'MAIN' }), getMyFacilityIds: () => ['SUB'], getSubFacilities: () => [], getMainFacility: () => ({ id: 'MAIN', name: 'Main Shelter' }), getIncomingTransfers: () => [], getTickets: () => [], getTicketsToCollect: () => [], getShelters: base.getShelters });
check('a sub-facility employee sees it labelled as a sub-facility, without the facility breakdown', /Sub-facility of Main Shelter/.test(subHtml) && !/By facility/.test(subHtml));

// No facility at all
const none = render({ ...base, hasFacility: () => false, getMyShelter: () => null, getMyImpoundments: () => [], getMyFacilityIds: () => [], getSubFacilities: () => [], getIncomingTransfers: () => [], getTickets: () => [], getTicketsToCollect: () => [] });
check('someone without a facility sees the set-up prompt and zeros, not other facilities\' data', /not part of an impound facility/.test(none) && /<b class="dd-big">0<\/b>/.test(none));

// ---- worst case for the Act on now cards: many animals, long and odd names, plurals, nothing at all ----
mine.length = 0;
for (let i = 0; i < 12; i++) mine.push(imp('w' + i, 'MAIN', { petName: i === 0 ? 'Aleksandra Wiśniewska-Kowalczyk the Third of Northwind Industries Holdings' : i === 1 ? '<img src=x onerror=alert(1)>' : i === 2 ? '' : 'Dog ' + i, breed: i === 0 ? 'Cavalier King Charles Spaniel × Miniature Poodle (Cavoodle) mix' : '', claimDeadline: i === 0 ? hoursFromNow(-30) : i === 1 ? hoursFromNow(-40) : i === 2 ? hoursFromNow(-35) : hoursFromNow(i < 6 ? -(i + 2) : 40 + i), photoUrl: '' }));
let worst = '';
try { worst = render({ ...base, getIncomingTransfers: () => [mine[0], mine[1], mine[2]], getTicketsToCollect: () => [{ id: 'a' }, { id: 'b' }] }); } catch (e) { worst = 'THREW ' + e.stack; }
check('twelve animals with awkward names draw without an error', !/^THREW/.test(worst), worst.slice(0, 160));
check('only the five closest to their deadline are listed, and the link says how many there are', (worst.match(/class="dh-row"/g) || []).length === 5 && /See all 12 in holding/.test(worst));
check('plurals are right for several: pets, tickets', /<b class="dt-title">pets arriving from sub-facilities<\/b>/.test(worst) && /<b class="dt-title">penalty tickets waiting for payment<\/b>/.test(worst) && /<b class="dt-title">pets are past their claim deadline<\/b>/.test(worst));
check('markup in a name is escaped, a missing name reads Unidentified animal', !/<img src=x/.test(worst) && /&lt;img src=x onerror=alert\(1\)&gt;/.test(worst) && /Unidentified animal/.test(worst));
check('the long name is kept whole in a tooltip, and clipped by CSS', worst.includes('title="Aleksandra Wiśniewska-Kowalczyk the Third of Northwind Industries Holdings"') && /\.dh-name \{[^}]*text-overflow: ellipsis/.test(require('fs').readFileSync(path.join(__dirname, '..', 'css', 'polish.css'), 'utf8')));
check('an overdue animal has a full red bar, the rest show what is left', /class="dh-bar tone-late" aria-hidden="true"><u style="width:100%">/.test(worst));
mine.length = 0;
const quiet = render({ ...base, getIncomingTransfers: () => [], getTicketsToCollect: () => [], getTickets: () => [] });
check('nothing to do and nobody in holding: both cards say so plainly', /Nothing needs attention/.test(quiet) && /All clear/.test(quiet) && /Nobody in holding/.test(quiet) && !/dt-item/.test(quiet));


// every tap-for-the-formula entry opens, has a formula, and uses the figures it is given
let infoHtml = '';
window.adminApp = { openModalContent: (h) => { infoHtml = h; return null; }, closeModal() {}, showToast() {} };
const keys = Object.keys(V.INFO);
let bad = [];
keys.forEach((k) => { try { infoHtml = ''; V.openInfo(k); if (!/dash-info-formula/.test(infoHtml)) bad.push(k + ': no formula'); } catch (e) { bad.push(k + ': ' + e.message); } });
check('every info entry (' + keys.length + ') opens and shows a formula', bad.length === 0, bad.join('; '));
V.openInfo('bdOutcomes', { bd: { closed: 4, released: 3 } });
check('another page can hand over its own figures for the worked example', /3 released ÷ 4 closed × 100 = 75%/.test(infoHtml), infoHtml.match(/With your numbers[\s\S]{0,120}/)?.[0]);
V.openInfo('stay');
check('the Time in holding entry explains the average and the longest', /Average = the sum of those times/.test(infoHtml) && /Longest = the largest/.test(infoHtml));

// ---- the lively parts ----
const four = [imp('l1', 'MAIN'), imp('l2', 'MAIN', { claimDeadline: hoursFromNow(-5) }), imp('l3', 'MAIN', { claimDeadline: hoursFromNow(10) }), imp('l4', 'MAIN')];
const lively = render({ ...base, getMyImpoundments: () => four, getIncomingTransfers: () => [], getTicketsToCollect: () => [] });
check('Right now is the one dark panel, and every taken place has a paw', /<section class="dd-now dd-hero">/.test(lively) && /<symbol id="dd-paw"/.test(lively) && (lively.match(/<use href="#dd-paw"\/>/g) || []).length === 4);
check('free places stay empty outlines, and the places are numbered so they can fill in one after another', /class="dd-k is-free" style="--n:\d+"><\/i>/.test(lively) && /style="--n:0"/.test(lively) && (lively.match(/class="dd-k is-late" style/g) || []).length === 1 && (lively.match(/class="dd-k is-soon" style/g) || []).length === 1 && (lively.match(/class="dd-k is-on" style/g) || []).length === 2);
check('the chart and the advice sit in their own panels, the advice warm-tinted', /class="dd-block dd-panel"/.test(lively) && /class="dd-block dd-panel is-ai"/.test(lively));
const css = require('fs').readFileSync(path.join(__dirname, '..', 'css', 'polish.css'), 'utf8');
check('the arrival animation is one moment, short, and switched off for reduced motion', /\.is-animated \.dd-hero \.dd-k:not\(\.is-free\) \{ animation: dd-fill 380ms/.test(css) && /prefers-reduced-motion: reduce\) \{ \.is-animated \.dd-hero \.dd-k/.test(css));
check('past-deadline places pulse a ring, also off for reduced motion', /\.dd-k\.is-late::after \{[^}]*animation: dd-ring/.test(css) && /\.dd-k\.is-late::after \{ animation: none; \}/.test(css));

// ---- the second pass ----
const fd = V.formatDuration.bind(V);
check('durations read as people say them: 5h, 1d 22h, never 46h 39m or 5h 0m', fd(5 * 3600e3) === '5h' && fd(5.5 * 3600e3) === '5h 30m' && fd(46.65 * 3600e3) === '1d 22h' && fd(48 * 3600e3) === '2d' && fd(45 * 60e3) === '45m' && fd(null) === '—');
check('the chart says only what it shows: no repeated deadline count, holding count or release share, no second link', !/analytics-footer-summary|View impoundments|released to owners|past the claim deadline<\/span>/.test(lively.replace(/aria-label="[^"]*"/g, '')) && !/btn-chart-view-registry/.test(lively));
check('the advice idle state is one calm sentence, with no doubled word', /class="dd-ai-idle">The advisor reads the figures on this page and suggests/.test(lively) && !/\band and\b/.test(lively));
check('holding rows use a real photo or a species tile, never a repeated stock photo', /class="dh-photo" style="--sc:#/.test(worst) && !/dh-photo is-stock|Sample/.test(worst) && !/unsplash/.test(worst));
check('the section bar has no second rule under it, and a quiet active tab in dark mode too', /\.dd \.dash-jump \{ border-bottom: 0; \}/.test(css) && /html\[data-theme="dark"\] \.dd \.dash-jump button\.is-active \{ background: transparent/.test(css));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
