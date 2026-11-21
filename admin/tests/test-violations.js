// The admin Violations page: one row per violation, the data matches the notice, tapping a row opens its detail.
// Run: node admin/tests/test-violations.js
const fs = require('fs');
const path = require('path');
global.window = global;
const keyHandlers = [];
global.document = { addEventListener: (t, f) => { if (t === 'keydown') keyHandlers.push(f); }, getElementById: () => null };
global.location = { hash: '#violations' };
let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 200) : ''}`); if (!ok) failed++; };

require('../../js/violations-data.js');
require('../js/views/violations-view.js');
const D = window.PawViolations;
const V = window.ViolationsView;
const prov = (id) => D.provisions.find(p => p.id === id);
const ids = (rows) => rows.map(r => r.id).join();

// ---- the data, against the notice ----
check('eight provisions, as on the notice', D.provisions.length === 8, D.provisions.length);
check('Section 35: unregistered / no microchips, 1,000 then 1,500 then 2,000',
  prov('s35').violations.join() === 'Unregistered / no microchips' && prov('s35').penalty.kind === 'ladder' && prov('s35').penalty.steps.join() === '1000,1500,2000');
check('Section 37: one 2,000 fine and confiscation of excess animals', prov('s37').penalty.kind === 'flat' && prov('s37').penalty.amount === 2000 && /excess animals/.test(prov('s37').penalty.extras[0]));
check('Section 38: no special permit, 2,000 and confiscation', prov('s38').violations[0] === 'No special permit' && prov('s38').penalty.amount === 2000 && /Confiscation/.test(prov('s38').penalty.extras[0]));
check('Section 40: four prohibited acts, 2,000 and confiscation', prov('s40').violations.length === 4 && prov('s40').penalty.amount === 2000 && /Confiscation/.test(prov('s40').penalty.extras[0]));
check('Section 53: four responsibilities, 1,000 then 1,500 then 2,000', prov('s53').violations.length === 4 && prov('s53').penalty.steps.join() === '1000,1500,2000');
check('Section 65: no permit, and no fine is made up for it', prov('s65').violations[0] === 'No permit' && prov('s65').penalty.kind === 'none');
check('SP-2990, S-2020: backyard piggeries and poultry farms, 2,000 then 3,000 then 5,000', /piggeries and poultry/.test(prov('sp2990').violations[0]) && prov('sp2990').penalty.steps.join() === '2000,3000,5000');
check('Section 69: opposing, resisting and intervening with authorities, no fine stated', /Opposing, resisting/.test(prov('s69').title) && prov('s69').penalty.kind === 'none');

// ---- one row per violation ----
check('14 rows: 1 + 1 + 1 + 4 + 4 + 1 + 1 + 1', D.rows.length === 14, D.rows.length);
check('row ids are the section id and a number', ids(D.rows.filter(r => r.provision.id === 's40')) === 's40-1,s40-2,s40-3,s40-4');
check('Section 69 has no listed violation, so its own title is its row', D.byId('s69-1').name === prov('s69').title && D.byId('s69-1').listed === false);
check('a row finds the other violations under its section', ids(D.siblings(D.byId('s53-1'))) === 's53-2,s53-3,s53-4' && D.siblings(D.byId('s35-1')).length === 0);
check('the fine in a few words', D.fineLabel(prov('s35')) === '₱1,000 – ₱2,000' && D.fineLabel(prov('s38')) === '₱2,000 + confiscation' && D.fineLabel(prov('s65')) === 'No fine stated');

// ---- search and filters ----
check('everything shows by default', D.filter('', 'all').length === 14);
check('"fine rises" keeps the rows of Sections 35, 53 and SP-2990', ids(D.filter('', 'ladder')) === 's35-1,s53-1,s53-2,s53-3,s53-4,sp2990-1');
check('"one fine" keeps Sections 37, 38 and 40', ids(D.filter('', 'flat')) === 's37-1,s38-1,s40-1,s40-2,s40-3,s40-4');
check('"no fine stated" keeps Sections 65 and 69', ids(D.filter('', 'none')) === 's65-1,s69-1');
check('searching a word finds that violation', ids(D.filter('leash', 'all')) === 's53-1');
check('searching a section number finds all its rows', ids(D.filter('section 40', 'all')) === 's40-1,s40-2,s40-3,s40-4');
check('searching a fine finds its rows', ids(D.filter('5000', 'all')) === 'sp2990-1');
check('a word in two sections finds both', ids(D.filter('microchip', 'all')) === 's35-1,s40-3,s40-4', ids(D.filter('microchip', 'all')));

// ---- the page ----
V.query = ''; V.filter = 'all'; window.adminApp = { routeParam: '' };
const list = V.renderList();
check('every violation is its own row, and a row is a link to its detail', (list.match(/class="vio-row"/g) || []).length === 14 && list.includes('href="#violations/s53-1"'));
check('a row shows the violation, its section and its fine', /Unleashed/.test(list) && /Section 53/.test(list) && /₱1,000 – ₱2,000/.test(list));
V.query = 'zzzz'; check('no match says so', /No violation matches/.test(V.renderList()));
V.query = '<img src=x onerror=alert(1)>'; check('what is typed is escaped in the empty message', !/<img/.test(V.renderList()));
V.query = '';

const container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
V.render(container);
check('with nothing open there is no detail sheet', !/vio-sheet-wrap/.test(container.innerHTML) && /<h1>Violations<\/h1>/.test(container.innerHTML));

window.adminApp.routeParam = 's53-3';
check('the open violation is read from the address', V.openRow() && V.openRow().name === 'Defecation on public and private property');
V.render(container);
const sheet = container.innerHTML;
check('tapping a row shows its detail sheet as a dialog', /role="dialog"/.test(sheet) && /aria-modal="true"/.test(sheet) && /<h2 class="vio-sheet-title" id="vio-sheet-title">Defecation on public and private property/.test(sheet));
check('the sheet shows the section, ordinance and every offense\'s fine', /Section 53/.test(sheet) && /SP-2505, S-2016 \(Quezon City Veterinary Code\)/.test(sheet) && /1st offense/.test(sheet) && /₱1,500/.test(sheet) && /3rd offense/.test(sheet));
const sheetOnly = sheet.slice(sheet.indexOf('id="vio-sheet-wrap"'));
check('the sheet lists the other violations under the section as links', (sheetOnly.match(/href="#violations\/s53-\d"/g) || []).length === 3 && !/href="#violations\/s53-3"/.test(sheetOnly), (sheetOnly.match(/href="#violations\/s53-\d"/g) || []).join());
window.adminApp.routeParam = 's69-1'; V.render(container);
check('a violation with no printed fine says so, and keeps the handwritten note', /Not stated on the notice/.test(container.innerHTML) && /Written in by hand/.test(container.innerHTML));
window.adminApp.routeParam = 's38-1'; V.render(container);
check('a flat fine shows the amount and the confiscation', /₱2,000/.test(container.innerHTML) && /Confiscation of animals/.test(container.innerHTML));
window.adminApp.routeParam = 'nope'; V.render(container);
check('an unknown id in the address opens nothing', !/vio-sheet-wrap/.test(container.innerHTML));
window.adminApp.routeParam = '';


// ---- the fine dropdown ----
V.filter = 'all'; V.render(container);
const optsA = [...container.innerHTML.matchAll(/<option value="([^"]+)"( selected)?>([^<]+)<\/option>/g)].map((m) => [m[1], m[3], !!m[2]]);
check('the dropdown offers All, Fine rises per offense, One fine and No fine stated', JSON.stringify(optsA.map((o) => o[1])) === JSON.stringify(['All', 'Fine rises per offense', 'One fine', 'No fine stated']), JSON.stringify(optsA));
check('it is a select the page listens to', /<select id="vio-filter"/.test(container.innerHTML) && optsA[0][2]);
V.filter = 'none'; V.render(container);
check('the chosen option stays selected when the page redraws', /<option value="none" selected>No fine stated<\/option>/.test(container.innerHTML));
check('and the list follows it', (V.renderList().match(/class="vio-row"/g) || []).length === 2);
V.filter = 'all';

// ---- wiring ----
const index = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../js/admin-app.js'), 'utf8');
check('the sidebar has a Violations tab', /data-route="violations"[\s\S]{0,120}Violations/.test(index));
check('the shared data loads before the page script', index.indexOf('../js/violations-data.js') > -1 && index.indexOf('../js/violations-data.js') < index.indexOf('js/views/violations-view.js'));
check('the route is valid and renders the page', /'violations', 'settings'\]/.test(app) && /case 'violations':[\s\S]{0,120}ViolationsView\.render/.test(app));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
