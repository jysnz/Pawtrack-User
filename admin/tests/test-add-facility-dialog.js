// "Add facility" dialog: one checkbox says whether it is a sub-facility; if so, the main facility is asked for.
// Run: node admin/tests/test-add-facility-dialog.js
const path = require('path');
global.window = global;
global.document = { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [], createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {}, addEventListener() {} }) };

let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 220) : ''}`); if (!ok) failed++; };

// ---- a stand-in for the dialog's DOM ----
const registry = {};
const mkEl = (key) => registry[key] || (registry[key] = {
  key, hidden: false, disabled: false, required: false, checked: false, value: '', textContent: '', handlers: {}, attrs: {},
  addEventListener(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); },
  setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute() {}, focus() {}, scrollIntoView() {}, remove() {},
  classList: { add() {}, remove() {}, toggle() {} }, querySelector: (s) => mkEl('q:' + s), querySelectorAll: () => [],
  click() { (this.handlers.click || []).forEach(fn => fn({ preventDefault() {}, currentTarget: this })); },
  change() { (this.handlers.change || []).forEach(fn => fn({ target: this })); }
});
const fields = {};
const form = {
  elements: new Proxy({}, { get: (_t, name) => (fields[name] = fields[name] || mkEl('f:' + String(name))) }),
  checkValidity() { return !(fields.isSub && fields.isSub.checked && fields.parentId && fields.parentId.required && !fields.parentId.value); },
  reportValidity() {}, querySelector: () => null
};
let shownHtml = '';
let closed = false;
const modal = { isConnected: true, querySelector(sel) { return sel === '#shelter-form' ? form : mkEl(sel); }, querySelectorAll: () => [] };
window.adminApp = { showToast() {}, closeModal() { closed = true; }, openModalContent(html) { shownHtml = html; return modal; } };
global.FormData = class { constructor(f) { this.f = f; } get(k) { const e = fields[k] || registry['f:' + k]; return e ? (k === 'isSub' ? (e.checked ? 'on' : null) : e.value) : null; } };

window.FacilityPhoto = { fieldHtml: () => '<div id="fp-root"></div>', bind: () => ({ has: () => true, blob: () => null, removed: () => false, nudge() {} }) };
window.FacilityForm = {
  phone: { digits: (v) => String(v || ''), toStored: (v) => v, bind() {} },
  hours: { parse: () => null, defaultModel: () => ({}), fieldHtml: () => '', bind: () => ({ value: () => 'Mon-Fri 9-5', validate: () => null }) },
  MapPicker: { create: async () => ({ canGeocode: false, getPin: () => pin, clearPin() { pin = null; }, setBounds(b) { boundsSet.push(b); }, setAreas() {}, destroy() {} }) },
  City: {
    inBounds: (p, b) => !b || !p || (p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east),
    resolve: async () => null,
    attach: (input, onChange) => { cityCtl = { set: (c) => onChange(c) }; return cityCtl; }
  }
};
let pin = { lat: 14.6, lng: 121 };
let cityCtl = null;
const boundsSet = [];
const QC = { name: 'Quezon City', placeId: 'p1', bounds: { north: 14.8, south: 14.55, east: 121.15, west: 121.0 } };

const mains = [{ id: 'M1', name: 'Main One', city: 'Quezon City', cityBounds: { north: 14.8, south: 14.55, east: 121.15, west: 121.0 } }, { id: 'M2', name: 'Main Two', city: 'Quezon City', cityBounds: { north: 14.8, south: 14.55, east: 121.15, west: 121.0 } }];
const saved = [];
let nextId = 'NEW';
window.adminStore = {
  isFacilityManager: () => true, isMainFacility: () => true, hasFacility: () => true, getMainFacilities: () => mains,
  getManagedShelterIds: () => ['M1', 'M2'], getShelters: () => mains, penaltyReady: false,
  saveShelter: (data, cb) => { saved.push(data); cb(nextId); }
};
require(path.join(__dirname, '../js/views/shelters-view.js'));
const V = window.SheltersView;

const resetDom = () => { Object.keys(registry).forEach(k => delete registry[k]); Object.keys(fields).forEach(k => delete fields[k]); };

(async () => {
  let created = null;
  V.openShelterModal(null, { chooseType: true, onCreated: (id) => { created = id; } });
  await new Promise(r => setTimeout(r, 10));

  const at = (re) => shownHtml.search(re);
  check('the first field is the facility name, before the type checkbox and the photo', at(/name="name"/) > 0 && at(/name="name"/) < at(/id="fm-is-sub"/) && at(/name="name"/) < at(/id="fp-root"/), JSON.stringify([at(/name="name"/), at(/id="fm-is-sub"/), at(/id="fp-root"/)]));
  check('the dialog has a "This is a sub-facility" checkbox', /id="fm-is-sub"/.test(shownHtml) && /This is a sub-facility/.test(shownHtml));
  check('it starts as a main facility (title and button)', /Add a main facility/.test(shownHtml) && /Add main facility<\/button>/.test(shownHtml));
  check('the main-facility prompt is there but hidden until the box is ticked', /id="fm-parent-wrap" hidden/.test(shownHtml));
  check('the prompt lists the user\'s main facilities', /<option value="M1" >Main One/.test(shownHtml) && /<option value="M2" >Main Two/.test(shownHtml) && /Select the main facility/.test(shownHtml));

  // fill the form
  const set = (k, v) => { mkEl('f:' + k).value = v; };
  set('name', 'New Place'); set('address', '1 Road'); set('city', 'QC'); set('phone', '9171234567'); set('capacity', '20');
  mkEl('#fm-type-other').disabled = true; // the "other facility type" box stays off while a listed type is chosen

  // No city picked yet: nothing is saved
  mkEl('#shelter-save-btn').click();
  await new Promise(r => setTimeout(r, 10));
  check('without a chosen city nothing is saved', saved.length === 0 && !closed);
  check('the map is locked until a city is chosen', /fm-map-box is-locked/.test(shownHtml));

  // Choosing a city limits the map to it
  cityCtl.set(QC);
  check('choosing a city limits the map to its bounds', boundsSet.length && boundsSet[boundsSet.length - 1] === QC.bounds);

  // A pin outside the city is refused
  pin = { lat: 10.3, lng: 123.9 };
  mkEl('#shelter-save-btn').click();
  await new Promise(r => setTimeout(r, 10));
  check('a pin outside the city is not saved', saved.length === 0 && !closed && /outside Quezon City/.test(mkEl('#fm-error').textContent), mkEl('#fm-error').textContent);
  pin = { lat: 14.6, lng: 121 };

  // Unticked: saved as a main facility
  mkEl('#shelter-save-btn').click();
  await new Promise(r => setTimeout(r, 10));
  check('the city and its bounds are saved with the facility', saved[0] && saved[0].city === 'Quezon City' && saved[0].cityBounds === QC.bounds && saved[0].cityPlaceId === 'p1', JSON.stringify(saved[0]));
  check('unticked, it is saved as a main facility', saved[0] && saved[0].asMain === true && saved[0].asSub === false && saved[0].parentId === undefined, JSON.stringify(saved[0]));
  check('the dialog closes and reports the new facility', closed && created === 'NEW');

  // Ticked: the main facility prompt appears and is required
  closed = false; created = null; resetDom();
  V.openShelterModal(null, { chooseType: true, onCreated: (id) => { created = id; } });
  await new Promise(r => setTimeout(r, 10));
  set('name', 'New Sub'); set('address', '2 Road'); set('city', 'QC'); mkEl('#fm-type-other').disabled = true;
  cityCtl.set(QC);
  pin = { lat: 14.6, lng: 121 }; // choosing the city clears an old pin, so drop a new one
  const box = mkEl('f:isSub'); box.checked = true; box.change();
  check('ticking the box shows the main facility prompt and makes it required', mkEl('#fm-parent-wrap').hidden === false && mkEl('#fm-parent').required === true);
  check('...and the title and button now say sub-facility', mkEl('#fm-title').textContent === 'Add a sub-facility' && mkEl('#shelter-save-btn').textContent === 'Add sub-facility', mkEl('#fm-title').textContent + ' / ' + mkEl('#shelter-save-btn').textContent);

  // No main facility chosen: it is not saved
  const before = saved.length;
  mkEl('f:parentId').value = ''; mkEl('#fm-parent').value = '';   // the same select, reached two ways
  mkEl('#shelter-save-btn').click();
  await new Promise(r => setTimeout(r, 10));
  check('without choosing the main facility, nothing is saved', saved.length === before && !closed);

  // Choose it: the city comes from the main facility, and the barangays covered are required
  mkEl('f:parentId').value = 'M2'; mkEl('#fm-parent').value = 'M2';
  mkEl('f:parentId').change();
  check('a sub-facility takes its city from the main facility and the city box is read-only', mkEl('f:city').readOnly === true && mkEl('#fm-coverage-wrap').hidden === false);
  const beforeCov = saved.length;
  mkEl('#shelter-save-btn').click();
  await new Promise(r => setTimeout(r, 10));
  check('without any barangay nothing is saved', saved.length === beforeCov && !closed);
  mkEl('q:#fm-cov-text').value = 'Bgy One, Bgy Two, Bgy One';
  mkEl('#shelter-save-btn').click();
  await new Promise(r => setTimeout(r, 10));
  const sub = saved[saved.length - 1];
  check('with a main facility chosen, it is saved as a sub-facility of it', saved.length === before + 1 && sub.asSub === true && sub.asMain === false && sub.parentId === 'M2', JSON.stringify({ asSub: sub && sub.asSub, asMain: sub && sub.asMain, parentId: sub && sub.parentId, name: sub && sub.name }));
  check('the barangays covered are saved (no duplicates)', JSON.stringify(sub.coverage) === JSON.stringify(['Bgy One', 'Bgy Two']), JSON.stringify(sub.coverage));

  // Unticking again goes back to main
  box.checked = false; box.change();
  check('unticking hides the prompt again', mkEl('#fm-parent-wrap').hidden === true && mkEl('#fm-parent').required === false && mkEl('#fm-title').textContent === 'Add a main facility');

  // Only a manager of a main facility gets the dialog
  shownHtml = '';
  window.adminStore.isFacilityManager = () => false;
  V.openShelterModal(null, { chooseType: true });
  check('staff cannot open it', shownHtml === '');

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
