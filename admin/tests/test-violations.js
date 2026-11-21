// The Violations page lists exactly what the notice of violation lists, and its search and filters work.
// Run: node admin/tests/test-violations.js
const fs = require('fs');
const path = require('path');
global.window = global;
let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 200) : ''}`); if (!ok) failed++; };

require('../js/views/violations-view.js');
const V = window.ViolationsView;
const by = (id) => V.provisions.find(p => p.id === id);

check('eight provisions, as on the notice', V.provisions.length === 8, V.provisions.length);
check('Section 35: unregistered / no microchips, 1,000 then 1,500 then 2,000',
  by('s35').violations.join() === 'Unregistered / no microchips' && by('s35').penalty.kind === 'ladder' && by('s35').penalty.steps.join() === '1000,1500,2000');
check('Section 37: one 2,000 fine and confiscation of excess animals',
  by('s37').penalty.kind === 'flat' && by('s37').penalty.amount === 2000 && /excess animals/.test(by('s37').penalty.extras[0]));
check('Section 38: no special permit, 2,000 and confiscation', by('s38').violations[0] === 'No special permit' && by('s38').penalty.amount === 2000 && /Confiscation/.test(by('s38').penalty.extras[0]));
check('Section 40: four prohibited acts, 2,000 and confiscation', by('s40').violations.length === 4 && by('s40').penalty.amount === 2000 && /Confiscation/.test(by('s40').penalty.extras[0]));
check('Section 53: four responsibilities, 1,000 then 1,500 then 2,000', by('s53').violations.length === 4 && by('s53').penalty.steps.join() === '1000,1500,2000');
check('Section 65: no permit, and no fine is made up for it', by('s65').violations[0] === 'No permit' && by('s65').penalty.kind === 'none');
check('SP-2990, S-2020: backyard piggeries and poultry farms, 2,000 then 3,000 then 5,000',
  /piggeries and poultry/.test(by('sp2990').violations[0]) && by('sp2990').penalty.steps.join() === '2000,3000,5000');
check('Section 69: opposing, resisting and intervening with authorities, no fine stated', /Opposing, resisting/.test(by('s69').title) && by('s69').penalty.kind === 'none');
check('every ordinance section is under SP-2505, S-2016 except the SP-2990 one', V.provisions.every(p => p.id === 'sp2990' ? p.ordinance === 'SP-2990, S-2020' : p.ordinance === 'SP-2505, S-2016'));

V.query = ''; V.filter = 'all';
check('everything shows by default', V.visible().length === 8);
V.filter = 'ladder'; check('the "fine rises" filter keeps the three that escalate', V.visible().map(p => p.id).join() === 's35,s53,sp2990', V.visible().map(p => p.id).join());
V.filter = 'flat'; check('the "one fine" filter keeps the three flat ones', V.visible().map(p => p.id).join() === 's37,s38,s40');
V.filter = 'none'; check('the "no fine stated" filter keeps Sections 65 and 69', V.visible().map(p => p.id).join() === 's65,s69');
V.filter = 'all';
V.query = 'leash'; check('searching a word finds the provision', V.visible().map(p => p.id).join() === 's53');
V.query = 'section 40'; check('searching a section number finds it', V.visible().map(p => p.id).join() === 's40', V.visible().map(p => p.id).join());
V.query = '5000'; check('searching a fine amount finds it', V.visible().map(p => p.id).join() === 'sp2990');
V.query = 'microchip'; check('a word in two sections finds both', V.visible().map(p => p.id).join() === 's35,s40', V.visible().map(p => p.id).join());
V.query = 'zzzz'; check('no match says so', /No provision matches/.test(V.renderList()));
V.query = '<img src=x onerror=alert(1)>'; check('what is typed is escaped in the empty message', !/<img/.test(V.renderList()));
V.query = '';

const html = V.renderList();
check('amounts are shown as pesos with thousands separators', html.includes('₱1,000') && html.includes('₱5,000'));
check('a ladder shows all three offenses', (html.match(/1st offense/g) || []).length === 3 && (html.match(/3rd offense/g) || []).length === 3);

const container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
V.render(container);
check('the page renders a heading, the notice and the cards', /<h1>Violations<\/h1>/.test(container.innerHTML) && /vio-notice/.test(container.innerHTML) && /vio-card/.test(container.innerHTML));

const index = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../js/admin-app.js'), 'utf8');
check('the sidebar has a Violations tab', /data-route="violations"[\s\S]{0,120}Violations/.test(index));
check('the page script is loaded', index.includes('js/views/violations-view.js'));
check('the route is valid and renders the page', /'violations', 'settings'\]/.test(app) && /case 'violations':[\s\S]{0,120}ViolationsView\.render/.test(app));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
