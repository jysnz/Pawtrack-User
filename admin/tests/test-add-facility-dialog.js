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
  MapPicker: { create: async () => ({ canGeocode: false, getPin: () => ({ lat: 14.6, lng: 121 }), destroy() {} }) }
};

const mains = [{ id: 'M1', name: 'Main One' }, { id: 'M2', name: 'Main Two' }];
const saved = [];
let nextId = 'NEW';
window.adminStore = {
  isFacilityManager: () => true, isMainFacility: () => true, hasFacility: () => true, getMainFacilities: () => mains,
  getManagedShelterIds: () => ['M1', 'M2'], penaltyReady: false,
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

  // Unticked: saved as a main facility
  mkEl('#shelter-save-btn').click();
  await new Promise(r => setTimeout(r, 10));
  check('unticked, it is saved as a main facility', saved[0] && saved[0].asMain === true && saved[0].asSub === false && saved[0].parentId === undefined, JSON.stringify(saved[0]));
  check('the dialog closes and reports the new facility', closed && created === 'NEW');

  // Ticked: the main facility prompt appears and is required
  closed = false; created = null; resetDom();
  V.openShelterModal(null, { chooseType: true, onCreated: (id) => { created = id; } });
  await new Promise(r => setTimeout(r, 10));
  set('name', 'New Sub'); set('address', '2 Road'); set('city', 'QC');
  const box = mkEl('f:isSub'); box.checked = true; box.change();
  check('ticking the box shows the main facility prompt and makes it required', mkEl('#fm-parent-wrap').hidden === false && mkEl('#fm-parent').required === true);
  check('...and the title and button now say sub-facility', mkEl('#fm-title').textContent === 'Add a sub-facility' && mkEl('#shelter-save-btn').textContent === 'Add sub-facility', mkEl('#fm-title').textContent + ' / ' + mkEl('#shelter-save-btn').textContent);

  // No main facility chosen: it is not saved
  const before = saved.length;
  mkEl('f:parentId').value = ''; mkEl('#fm-parent').value = '';   // the same select, reached two ways
  mkEl('#shelter-save-btn').click();
  await new Promise(r => setTimeout(r, 10));
  check('without choosing the main facility, nothing is saved', saved.length === before && !closed);

  // Choose it: saved as a sub-facility of that main facility
  mkEl('f:parentId').value = 'M2'; mkEl('#fm-parent').value = 'M2';
  mkEl('#shelter-save-btn').click();
  await new Promise(r => setTimeout(r, 10));
  const sub = saved[saved.length - 1];
  check('with a main facility chosen, it is saved as a sub-facility of it', saved.length === before + 1 && sub.asSub === true && sub.asMain === false && sub.parentId === 'M2', JSON.stringify({ asSub: sub && sub.asSub, asMain: sub && sub.asMain, parentId: sub && sub.parentId, name: sub && sub.name }));

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
