// Facilities -> Impoundments hand-off, the in-app confirm dialog, and the plainer Impoundments wording.
// Run: node admin/tests/test-facility-to-impoundments.js
const path = require('path');
const fs = require('fs');
global.window = global;
require(require('path').join(__dirname, '..', '..', 'js', 'species.js'));
const clicks = {};
const stub = () => ({ addEventListener(ev, fn) { clicks[ev] = fn; }, focus() {}, querySelector: stub, querySelectorAll: () => [], classList: { toggle() {} } });
const rows = [];
const container = {
  innerHTML: '',
  querySelector: () => null,
  querySelectorAll(sel) {
    if (sel === '.shm-frow') return rows;
    return [];
  }
};
global.document = { getElementById: () => null, createElement: () => ({}), addEventListener() {}, removeEventListener() {} };
const MAIN = { id: 'MAIN', name: 'Main Shelter', capacity: 10 }, SUB = { id: 'SUB', name: 'Sub One', parentId: 'MAIN' };
const imps = [{ id: 'a', shelterId: 'SUB', status: 'active_impounded', petName: 'Rex', intakeDate: new Date().toISOString(), claimDeadline: new Date(Date.now() + 3600e3 * 30).toISOString(), shelterName: 'Sub One' }];
let activeFacility = 'MAIN';
window.adminStore = {
  getActiveFacilityId: () => activeFacility, setActiveFacility: (id) => { activeFacility = id; },
  getMyShelter: () => MAIN, myShelterId: () => 'MAIN', getMyFacilityIds: () => ['MAIN', 'SUB'], getShelters: () => [MAIN, SUB, { id: 'OTHER', name: 'Elsewhere' }],
  getImpoundments: () => imps, getMyImpoundments: () => imps, hasFacility: () => true, isFacilityManager: () => true, isMainFacility: () => true,
  getManagedShelterIds: () => ['MAIN', 'SUB'], getMainFacility: () => null, getSubFacilities: () => [SUB], getIncomingTransfers: () => [], getTicketForImpound: () => null,
  getRfidTags: () => [], currentAdmin: () => ({ full_name: 'Officer' }), getMainFacilities: () => [MAIN], isDbId: () => true
};
const rendered = [];
window.adminApp = { updateFacilityChip() {}, currentRoute: 'shelters', renderView: (r) => rendered.push(r), showToast() {} };
global.location = { hash: '#shelters' };
Object.defineProperty(global, 'window', { value: global, writable: true });
window.location = global.location;
require(path.join(__dirname, '../js/search-box.js'));
require(path.join(__dirname, '../js/views/impoundments-view.js'));
require(path.join(__dirname, '../js/views/shelters-view.js'));
let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 200) : ''}`); if (!ok) failed++; };

(async () => {
  // Facilities page: rows are links
  window.SheltersView.render(container);
  const html = container.innerHTML;
  check('each facility row is a link to its pets', (html.match(/role="link"/g) || []).length === 2 && /Open the pets at Sub One/.test(html));
  check('the list shows only this account\'s facilities', !/Elsewhere/.test(html));

  // Tapping a facility
  const I = window.ImpoundmentsView;
  I.showFacility('SUB', 'active');
  check('tapping a facility sets the Impoundments filter and goes there', I.facilityFilter === 'SUB' && I.currentTab === 'active' && window.location.hash === '#impoundments', JSON.stringify({ f: I.facilityFilter, h: window.location.hash }));

  // Impoundments page for that facility
  const page = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  I.render(page);
  const p = page.innerHTML;
  check('the facility chooser has that facility selected', /<option value="SUB" selected>Sub One<\/option>/.test(p) && /<option value="MAIN" >Main Shelter<\/option>/.test(p));
  check('it has a Facilities button and a Scan & intake button', /id="btn-facilities"[\s\S]*Facilities/.test(p) && /Scan &amp; intake/.test(p) && /href="#shelters"/.test(p));
  check('it shows that facility\'s pet', /Rex/.test(p));
  check('plain wording, no jargon: the claim period and a More actions menu', /Claim period/.test(p) && /aria-label="More actions for/.test(p) && !/Operations|Condition \/ Officer/.test(p));
  check('release says what it does', /Release to owner/.test(p) && /Give the owner 24 more hours/.test(p));
  check('the facility chooser shows whenever there is more than one facility', /id="imp-facility-select"/.test(p));

  // Dashboard / palette hand-off
  window.adminApp.currentRoute = 'activation';
  I.requestIntake();
  check('requesting intake from another page opens Impoundments and queues the dialog', I.pendingIntake === true && window.location.hash === '#impoundments');
  let opened = null;
  I.openIntakeModal = (o) => { opened = o; };
  I.facilityFilter = 'SUB';
  I.render(page);
  check('the dialog opens once the page has drawn, for the facility being viewed, then is not queued again', opened && opened.facilityId === 'SUB' && I.pendingIntake === false);

  // Source-level checks: no native confirm/prompt, one name for the action
  const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
  const noNative = ['../js/views/impoundments-view.js', '../js/views/shelters-view.js', '../js/admin-app.js'].every(f => !/[^.\w]confirm\(|[^.\w]prompt\(/.test(read(f).replace(/confirmDialog\(/g, '')));
  check('no browser confirm() or prompt() boxes are left', noNative);
  check('no fake jurisdiction switcher in the sidebar', !/workspace-dropdown|Connect LGU Cluster/.test(read('../index.html')) && /id="facility-chip"/.test(read('../index.html')));
  check('one name for the action: Scan & intake', !/Log Animal (Control )?Intake|Log impounded pet/.test(read('../js/admin-app.js') + read('../js/views/activation-view.js') + read('../js/views/impoundments-view.js')));
  check('the edit dialog escapes pet names', /value="\$\{this\.esc\(imp\.petName\)\}"/.test(read('../js/views/impoundments-view.js')));

  // confirmDialog
  const body = []; let keydown = null;
  const wrap = { className: '', innerHTML: '', listeners: {}, addEventListener(ev, fn) { this.listeners[ev] = fn; }, remove() { this.removed = true; }, querySelector: () => ({ focus() {} }) };
  global.document = { createElement: () => wrap, body: { appendChild: (n) => body.push(n) }, addEventListener: (ev, fn) => { keydown = fn; }, removeEventListener() {} };
  const src = read('../js/admin-app.js');
  const start = src.indexOf('  confirmDialog(');
  const end = src.indexOf('  showDialog(');
  // the slice stops before showDialog, so drop the comment lines that introduce it
  const fn = eval('(function(){ return { ' + src.slice(start, end).trim().replace(/(\s*\/\/[^\n]*)+\s*$/, '').replace(/,\s*$/, '') + ' } })()').confirmDialog;
  let p1 = fn({ title: 'Leave <b>?', message: 'm', confirmLabel: 'Go', danger: true });
  check('the dialog is added to the page, escapes its text and marks danger', body.length === 1 && /Leave &lt;b&gt;\?/.test(wrap.innerHTML) && /btn-danger/.test(wrap.innerHTML));
  wrap.listeners.click({ target: { closest: () => ({ getAttribute: () => 'yes' }) } });
  check('confirm resolves true and closes', (await p1) === true && wrap.removed === true);
  wrap.removed = false;
  p1 = fn({ title: 't', message: 'm' });
  keydown({ key: 'Escape', stopPropagation() {} });
  check('Escape resolves false', (await p1) === false);

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
