/**
 * Owner app: the Violations page lists one violation per row, and tapping a row opens its detail sheet.
 * Run: node tests/test-violations-owner.js
 */
const fs = require('fs');
const path = require('path');
let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 200) : ''}`); if (!ok) failed++; };

// A small fake page: enough DOM for the view's page, its sheet on <body> and the history it uses
const handlers = { popstate: [], hashchange: [], keydown: [] };
const bodyKids = [];
const classes = new Set();
const pushed = [];
let focused = null;
global.window = global;
global.location = { hash: '#fines', href: 'http://localhost/#fines' };
global.history = { state: null, pushState(s) { this.state = s; pushed.push(s); }, back() { this.state = null; handlers.popstate.forEach((f) => f({ state: null })); } };
global.addEventListener = (t, f) => { (handlers[t] = handlers[t] || []).push(f); };
function el(tag) {
  const e = {
    tag, id: '', className: '', _html: '', listeners: {}, scrollTop: 0,
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
    remove() { const i = bodyKids.indexOf(this); if (i > -1) bodyKids.splice(i, 1); },
    querySelector(sel) { return sel === '#vl-sheet-close' ? { focus() { focused = 'close'; } } : sel === '.vl-sheet' ? this : null; },
    click(target) { (this.listeners.click || []).forEach((f) => f({ target })); }
  };
  return e;
}
global.document = {
  addEventListener(t, f) { (handlers[t] = handlers[t] || []).push(f); },
  createElement: el,
  getElementById: (id) => bodyKids.find((k) => k.id === id) || null,
  body: { appendChild(k) { bodyKids.push(k); }, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } }
};

require('../js/violations-data.js');
require('../js/views/violations-view.js');
const V = window.violationsView;
const D = window.PawViolations;

check('the page registers itself for the router', V && typeof V.render === 'function');

// ---- the page ----
const page = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
V.render(page);
const html = page.innerHTML;
check('a heading, the notice, a search box and a fine dropdown', /<h1>Violations<\/h1>/.test(html) && /vl-notice/.test(html) && /id="vl-search"/.test(html) && /<select id="vl-filter"/.test(html));
check('every violation is its own row (14)', (html.match(/class="vl-row"/g) || []).length === 14, (html.match(/class="vl-row"/g) || []).length);
check('a row shows the violation, its section and its fine', /Unleashed/.test(html) && /Section 53/.test(html) && /₱1,000 – ₱2,000/.test(html));
check('rows are buttons that open a dialog', /<button type="button" class="vl-row" data-id="s53-1" aria-haspopup="dialog">/.test(html));
V.query = 'leash'; check('search narrows the rows', (V.listHtml().match(/class="vl-row"/g) || []).length === 1);
V.query = ''; V.filter = 'none'; check('the filter narrows the rows', (V.listHtml().match(/class="vl-row"/g) || []).length === 2);
V.filter = 'all'; V.query = '<script>x</script>'; check('what is typed is escaped', !/<script>x/.test(V.listHtml()));
V.query = '';


// ---- the fine dropdown ----
const opts = [...html.matchAll(/<option value="([^"]+)"( selected)?>([^<]+)<\/option>/g)].map((m) => [m[1], m[3], !!m[2]]);
check('the dropdown offers All, Fine rises per offense, One fine and No fine stated', JSON.stringify(opts.map((o) => o[1])) === JSON.stringify(['All', 'Fine rises per offense', 'One fine', 'No fine stated']), JSON.stringify(opts));
check('All is selected to start with', opts.length === 4 && opts[0][2] && !opts.slice(1).some((o) => o[2]));
for (const [value, rows] of [['ladder', 6], ['flat', 6], ['none', 2], ['all', 14]]) {
  V.filter = value;
  check(`choosing "${value}" lists ${rows} rows`, (V.listHtml().match(/class="vl-row"/g) || []).length === rows);
}
V.filter = 'flat'; V.render(page);
check('the chosen option stays selected when the page redraws', /<option value="flat" selected>One fine<\/option>/.test(page.innerHTML));
V.filter = 'all';

// ---- tapping a row ----
check('no sheet until a row is tapped', !document.getElementById('vl-sheet-wrap') && !classes.has('vl-sheet-open'));
V.openSheet('s53-1');
const wrap = document.getElementById('vl-sheet-wrap');
check('tapping a row adds a detail sheet to the page', !!wrap && classes.has('vl-sheet-open'));
check('the sheet is a dialog with the violation, its section and the fine for each offense',
  /role="dialog"/.test(wrap.innerHTML) && /aria-modal="true"/.test(wrap.innerHTML) && />Unleashed</.test(wrap.innerHTML) && /Section 53/.test(wrap.innerHTML) && /1st offense/.test(wrap.innerHTML) && /3rd offense/.test(wrap.innerHTML) && /₱2,000/.test(wrap.innerHTML));
check('it lists the other violations under the section', (wrap.innerHTML.match(/class="vl-also-btn"/g) || []).length === 3);
check('focus moves into the sheet', focused === 'close');
check('opening takes one history entry, so Back can close it', pushed.length === 1 && pushed[0].vlOpen === 's53-1');

wrap.click({ closest: (s) => (s === '.vl-also-btn' ? { dataset: { id: 's53-4' } } : null) });
check('tapping another violation in the sheet switches to it', V.openId === 's53-4' && />Unvaccinated</.test(document.getElementById('vl-sheet-wrap').innerHTML));

history.back(); // the phone's Back button
check('Back closes the sheet and stays on the page', !document.getElementById('vl-sheet-wrap') && !classes.has('vl-sheet-open') && V.openId === null);

V.openSheet('s65-1');
check('a violation with no printed fine says so', /Not stated on the notice/.test(document.getElementById('vl-sheet-wrap').innerHTML));
handlers.keydown.forEach((f) => f({ key: 'Escape' }));
check('Esc closes the sheet', !document.getElementById('vl-sheet-wrap') && V.openId === null);

V.openSheet('s69-1');
check('Section 69 shows the handwritten note', /Written in by hand/.test(document.getElementById('vl-sheet-wrap').innerHTML));
const w2 = document.getElementById('vl-sheet-wrap');
w2.click(w2); // a tap on the dim area around the sheet
check('a tap outside the sheet closes it', !document.getElementById('vl-sheet-wrap'));

V.openSheet('s35-1');
global.location.hash = '#pets';
handlers.hashchange.forEach((f) => f());
check('leaving the page closes the sheet', !document.getElementById('vl-sheet-wrap') && !classes.has('vl-sheet-open'));
V.openSheet('does-not-exist');
check('an unknown violation opens nothing', !document.getElementById('vl-sheet-wrap'));

// ---- wiring ----
const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
check('the sidebar Violations tab is the owners own violations', /href="#violations"[^>]*data-view="violations"/.test(index) && /violations: window\.myViolationsView/.test(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8')));
check('the full violations list moved to Settings', /data-goto="fines"/.test(fs.readFileSync(path.join(root, 'js/views/settings-view.js'), 'utf8')) && /fines: window\.violationsView/.test(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8')));
check('the stylesheet is linked', index.includes('css/violations.css'));
check('the data loads before the page, and both before the app',
  index.indexOf('js/violations-data.js') > -1 && index.indexOf('js/violations-data.js') < index.indexOf('js/views/violations-view.js') && index.indexOf('js/views/violations-view.js') < index.indexOf('js/app.js'));
check('the router knows the page', /fines: window\.violationsView/.test(app));
check('signed-out visitors can open it, like the facility list', /view === 'fines'/.test(app));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
