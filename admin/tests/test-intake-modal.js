// Scan & intake dialog: what an NFC tag carries, and how it fills the intake form.
// Run: node admin/tests/test-intake-modal.js
const path = require('path');
const fs = require('fs');
global.window = global;
let shown = null, closed = 0; const toasts = []; const saved = [];
const stub = () => ({ addEventListener() {}, focus() {}, value: '', dataset: {}, setAttribute() {}, hidden: true, querySelector: stub });
const body = { set innerHTML(v) { box._html = v; }, get innerHTML() { return box._html; }, querySelector: stub };
const box = { _html: '', set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; }, querySelector(sel) { return sel === '#in-body' ? (this._html ? body : null) : stub(); } };
global.document = { getElementById: () => null, body: { contains: () => true }, createElement: () => ({}) };
window.adminApp = { openModalContent: (h) => { box.innerHTML = h; shown = h; return box; }, closeModal() { closed++; }, showToast: (m) => toasts.push(m), renderView() {}, currentRoute: 'impoundments' };
const MAIN = { id: 'MAIN', name: 'Main Shelter' }, SUB = { id: 'SUB', name: 'Sub One', parentId: 'MAIN' };
const pets = [
  { id: 'p1', name: 'Rex', species: 'Dog', breed: 'Aspin', age: '2 yrs', status: 'lost', rfidTag: 'PT-AB12CD34', nfcSerial: '04:A1:B2:C3', medicalNotes: 'Limps on left leg', photoUrl: 'https://x/rex.jpg', owner: { name: 'Ana Cruz', phone: '0917', email: 'a@x.ph' } },
  { id: 'p2', name: 'Mimi', species: 'Cat', breed: 'Puspin', age: '1 yr', status: 'safe', rfidTag: 'PT-HELD0001', owner: { name: 'Ben', phone: '0918' } }
];
const imps = [
  { id: 'i1', shelterId: 'MAIN', status: 'active_impounded', cageNumber: 'Cage 1' },
  { id: 'i2', shelterId: 'MAIN', status: 'active_impounded', cageNumber: 'Cage 2' },
  { id: 'i3', shelterId: 'MAIN', status: 'claimed', cageNumber: 'Cage 3' },
  { id: 'i4', shelterId: 'MAIN', status: 'active_impounded', petId: 'p2', rfidTag: 'PT-HELD0001', petName: 'Mimi', shelterName: 'Main Shelter', cageNumber: 'Cage 4' }
];
window.adminStore = {
  getMyShelter: () => MAIN, getMyFacilityIds: () => ['MAIN', 'SUB'], getShelters: () => [MAIN, SUB],
  currentAdmin: () => ({ full_name: 'Officer Dee' }), getRfidTags: () => [], logAction() {}, getImpoundments: () => imps,
  getPetByRFID: (c) => { const k = String(c || '').toUpperCase(); return pets.find(p => (p.rfidTag || '').toUpperCase() === k || (p.nfcSerial || '').toUpperCase() === k) || null; },
  saveImpoundment: (r) => { saved.push(r); return r; }
};
require(path.join(__dirname, '../js/views/intake-modal.js'));
const M = window.IntakeModal;
let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 200) : ''}`); if (!ok) failed++; };
const enc = (s) => new TextEncoder().encode(s);

(async () => {
  // The payload
  const p1 = M.parseTag({ records: [{ recordType: 'url', data: enc('https://pawtrack-user.vercel.app/?nfc=pt-ab12cd34') }] }, '04:a1:b2:c3');
  check('a PawTrack link gives tagId, serial, url and source', p1 && p1.tagId === 'PT-AB12CD34' && p1.serial === '04:A1:B2:C3' && /nfc=/.test(p1.url) && p1.source === 'pawtrack-link', JSON.stringify(p1));
  const p2 = M.parseTag({ records: [] }, '04:ff');
  check('a tag with no link is identified by its serial', p2 && p2.tagId === null && p2.serial === '04:FF' && p2.source === 'serial');
  check('a tag with nothing readable gives no payload', M.parseTag({ records: [] }, '') === null);
  check('typed PT- code is a tag ID, anything else a serial or chip no.', M.manualPayload('pt-x1').tagId === 'PT-X1' && M.manualPayload('985112').serial === '985112' && M.manualPayload('  ') === null);

  // A registered pet fills the form
  const d = M.buildDraft(p1, 'MAIN');
  check('registered pet: name, species, breed, age, photo, notes come from the pet', d.match === 'registered' && d.petId === 'p1' && d.petName === 'Rex' && d.species === 'Dog' && d.breed === 'Aspin' && d.age === '2 yrs' && d.photoUrl === 'https://x/rex.jpg' && d.healthCondition === 'Limps on left leg', JSON.stringify(d));
  check('guardian contact and missing status are picked up', d.guardian.name === 'Ana Cruz' && d.guardian.phone === '0917' && d.missing === true);
  check('generated: next free cage, officer, 72h deadline', d.cageNumber === 'Cage 3' && d.intakeOfficer === 'Officer Dee' && Math.round((new Date(d.claimDeadline) - new Date(d.intakeAt)) / 3600e3) === 72, d.cageNumber);
  check('a chip serial alone also finds the pet', M.buildDraft({ tagId: null, serial: '04:A1:B2:C3' }, 'MAIN').petId === 'p1');

  // Unknown tag, no tag, already held
  const u = M.buildDraft({ tagId: 'PT-NOPE', serial: null }, 'MAIN');
  check('unknown tag keeps the code and asks for the rest', u.match === 'unregistered' && u.tag === 'PT-NOPE' && u.petId === null && u.petName === '' && u.guardian === null);
  check('no tag is a manual entry', M.buildDraft(null, 'MAIN').match === 'none' && M.buildDraft(null, 'MAIN').tag === '');
  const held = M.buildDraft({ tagId: 'PT-HELD0001' }, 'MAIN');
  check('a pet already in holding is flagged', held.alreadyHeld && held.alreadyHeld.cageNumber === 'Cage 4');
  check('cage numbers are per facility', M.nextCage('SUB') === 'Cage 1');

  // The dialog
  M.open({ noAuto: true });
  check('opening shows the Scan & intake dialog', /Scan &amp; intake/.test(shown) && /id="in-body"/.test(shown));
  M.showForm(p1);
  const html = () => box.innerHTML;
  check('the form is filled from the tag', /value="Rex"/.test(html()) && /value="Aspin"/.test(html()) && /value="Cage 3"/.test(html()) && /Limps on left leg/.test(html()) && /Ana Cruz/.test(html()) && /reported missing/.test(html()) && /alert guardian/.test(html()));
  check('with several facilities the form asks for the receiving one', /id="in-fac"/.test(html()));
  M.showForm({ tagId: 'PT-HELD0001' });
  check('an already-held pet disables the submit button', /already in holding/.test(html()) && /id="in-submit" disabled/.test(html()));
  M.showForm({ tagId: 'PT-NOPE', serial: null });
  check('a stray form says the tag is not registered', /Tag not registered/.test(html()));

  // Submit
  M.showForm(p1);
  const data = { petName: 'Rex', cageNumber: 'Cage 3', species: 'Dog', breed: 'Aspin', age: '2 yrs', shelterId: 'SUB', impoundLocation: 'Market', intakeOfficer: 'Officer Dee', healthCondition: 'Limps' };
  global.FormData = class { get(k) { return data[k]; } };
  await M.submit({});
  const r = saved[0];
  check('submit logs the intake with the pet link, tag and chosen facility', r && r.petId === 'p1' && r.rfidTag === 'PT-AB12CD34' && r.shelterId === 'SUB' && r.shelterName === 'Sub One' && r.photoUrl === 'https://x/rex.jpg' && r.cageNumber === 'Cage 3', JSON.stringify(r));
  check('closes and confirms', closed >= 1 && toasts.some(t => /Logged intake for Rex at Sub One/.test(t)));

  // A stray with no tag
  M.showForm(null);
  data.petName = 'Stray'; data.species = 'Cat'; data.breed = 'Puspin'; data.shelterId = 'MAIN';
  await M.submit({});
  check('a pet with no tag is logged with an empty tag and no pet link', saved[1].rfidTag === '' && saved[1].petId === null && saved[1].species === 'Cat');

  // The NFC reader
  delete global.NDEFReader;
  Object.defineProperty(global, 'navigator', { value: { vibrate() {}, permissions: { query: async () => ({ state: 'granted' }) } }, configurable: true, writable: true });
  await M.startNfc();
  check('an unsupported device explains itself', M.nfc.state === 'error' && /Chrome on Android/.test(M.nfc.text));
  M.setNfc('idle');
  const handlers = {}; let aborted = false;
  global.NDEFReader = class { async scan({ signal }) { signal.addEventListener('abort', () => { aborted = true; }); } addEventListener(ev, fn) { handlers[ev] = fn; } };
  M.open({ noAuto: true });
  await M.startNfc();
  check('tapping starts scanning', M.nfc.state === 'scanning');
  handlers.readingerror();
  check('a bad read keeps scanning', M.nfc.state === 'scanning' && /keep still/.test(M.nfc.text));
  handlers.reading({ message: { records: [{ recordType: 'url', data: enc('https://x/?nfc=PT-AB12CD34') }] }, serialNumber: '04:A1:B2:C3' });
  check('a read stops the reader and fills the form', aborted && M.nfc.state === 'idle' && M.draft && M.draft.petId === 'p1');

  // Wiring
  const idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const imp = fs.readFileSync(path.join(__dirname, '../js/views/impoundments-view.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../js/admin-app.js'), 'utf8');
  check('no Shelter Terminal page any more', !/data-route="terminal"/.test(idx) && !/terminal-view\.js/.test(idx) && /intake-modal\.js/.test(idx) && !fs.existsSync(path.join(__dirname, '../js/views/terminal-view.js')));
  check('old #terminal links go to Impoundments', /rawHash === 'terminal'[^\n]*#impoundments/.test(app));
  check('the Scan & intake button opens the dialog', /Scan &amp; intake/.test(imp) && /IntakeModal\.open/.test(imp));

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
