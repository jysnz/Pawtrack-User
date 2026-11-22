/**
 * Runtime test for the Report Pet submissions ("Submit and Notify"), run against the real js/report-manager.js
 * with a fake page and a fake store. The owner's alert itself is created on the server (database trigger / the
 * notify-owner-found Edge Function), so here we check what the browser is responsible for: validating the form,
 * saving the sighting or missing report with the right data, and telling the person what happened.
 */
const assert = require('assert');

const fs = require('fs');
const path = require('path');

// Mock browser globals
global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
global.innerWidth = 1280;
global.innerHeight = 800;
global.document = {
  elements: {},
  getElementById(id) {
    if (!this.elements[id]) {
      this.elements[id] = { value: '' };
    }
    const el = this.elements[id];
    if (!el.style) el.style = {};
    if (!el.classList) el.classList = { add() {}, remove() {}, toggle() {} };
    if (!el.focus) el.focus = function() {};
    if (!el.scrollIntoView) el.scrollIntoView = function() {};
    if (!el.closest) el.closest = function() { return el.group = el.group || { classList: { add() {}, remove() {}, toggle() {} }, querySelector: () => null, appendChild() {}, addEventListener() {}, dataset: {} }; };
    if (!el.matches) el.matches = function() { return false; };
    if (!el.querySelector) el.querySelector = function() { return null; };
    if (!el.setAttribute) el.setAttribute = function() {};
    if (!el.removeAttribute) el.removeAttribute = function() {};
    if (!el.appendChild) el.appendChild = function() {};
    return el;
  },
  querySelector() { return null; },
  createElement() { return { classList: { add() {}, remove() {} }, setAttribute() {}, style: {} }; },
  querySelectorAll() {
    return [];
  },
  addEventListener() {}
};

// Mock pawStore
const toasts = [];
const notifications = [];
const sightings = [];
const missingReports = [];
const cases = [];

global.pawStore = {
  notifications,
  sightings,
  missingReports,
  cases,
  getPets() {
    return [
      { id: 'pet-1', name: 'Bella', species: 'Dog', breed: 'Golden Retriever', nfcTag: 'NFC-9901', status: 'active', owner: { email: 'maria@gmail.com', phone: '+63 917 111 2222', community: 'District 4, Quezon City' } },
      { id: 'pet-2', name: 'Milo', species: 'Cat', breed: 'Siamese', nfcTag: 'NFC-8822', status: 'lost', owner: { email: 'carlos@gmail.com', phone: '+63 918 333 4444', community: 'District 1, Quezon City' } }
    ];
  },
  getGoogleUser() { return { id: 'user-1', name: 'Carlos', email: 'carlos@gmail.com', phone: '+63 918 333 4444' }; },
  getPetById(id) {
    return this.getPets().find(p => p.id === id);
  },
  getPetByNFC(nfc) {
    return this.getPets().find(p => p.nfcTag === nfc);
  },
  getActiveMissingReportForPet(petId) {
    return this.missingReports.find(r => r.petId === petId);
  },
  addSighting(sighting) {
    sightings.push(sighting);
    return sighting;
  },
  addNotification(notif) {
    notifications.push(notif);
    return notif;
  },
  addCaseTimelineEvent(petId, event) {},
  updatePetStatus(petId, status, meta) {},
  createMissingReport(report) {
    report.id = 'MR-' + Date.now();
    missingReports.push(report);
    return report;
  },
  saveCase(c) {
    cases.push(c);
  }
};

global.notifManager = {
  showToast(msg, type) {
    toasts.push({ msg, type });
    console.log(`  Toast [${type}]: ${msg}`);
  },
  showFinderInfo(info) {}
};

global.location = { hash: '#map' };

// Load report manager code
const reportManagerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'report-manager.js'), 'utf8');
eval(reportManagerCode);

const ok = (msg) => console.log('[PASS] ' + msg);
const lastToast = () => toasts[toasts.length - 1] || {};

(async () => {
  console.log('--- Found pet, no NFC match ---');
  document.elements['report-found-pet-select'] = { value: 'unregistered' };
  document.elements['report-found-species'] = { value: 'Dog' };
  document.elements['report-found-breed'] = { value: 'Aspin' };
  document.elements['report-found-location'] = { value: 'District 2 (Commonwealth), Quezon City' };
  document.elements['report-found-nfc'] = { value: 'NFC-UNKNOWN' };
  document.elements['report-found-phone'] = { value: '+63 917 000 1111' };
  document.elements['report-found-notes'] = { value: 'Spotted resting under tree near Commonwealth market.' };
  window.reportManager.currentType = 'found';
  window.reportManager.pinnedLat = 14.6850;
  window.reportManager.pinnedLng = 121.0850;
  await window.reportManager.submitFoundReport();
  assert.strictEqual(sightings.length, 1, 'one sighting is saved');
  assert.strictEqual(sightings[0].location, 'District 2 (Commonwealth), Quezon City');
  assert.deepStrictEqual(sightings[0].coords, [14.685, 121.085]);
  assert.strictEqual(lastToast().type, 'success');
  assert(/pinned to Incident Map/.test(lastToast().msg), 'the finder is told the sighting is on the map');
  ok('a stray with no match is saved at the pinned place and the finder is told');

  console.log('--- Found pet, NFC matches a registered pet ---');
  document.elements['report-found-pet-select'] = { value: 'pet-1' }; // Bella
  document.elements['report-found-nfc'] = { value: 'NFC-9901' };
  await window.reportManager.submitFoundReport();
  assert.strictEqual(sightings.length, 2, 'a second sighting is saved');
  assert(/MATCH CONFIRMED: Registered pet "Bella"/.test(lastToast().msg), 'the finder sees the match');
  ok('a matched tag is saved and the finder sees which pet it is');

  console.log('--- Missing pet, no date (must be refused) ---');
  window.reportManager.currentType = 'missing';
  window.reportManager.pinChosen = true; // the person dropped the pin on the map
  document.elements['report-missing-pet-select'] = { value: 'pet-2' };
  document.elements['report-missing-location'] = { value: 'District 1 (La Loma), Quezon City' };
  document.elements['report-missing-date'] = { value: '' };
  document.elements['report-missing-phone'] = { value: '+63 918 333 4444' };
  document.elements['report-missing-notes'] = { value: '' };
  await window.reportManager.submitMissingReport();
  assert.strictEqual(missingReports.length, 0, 'nothing is saved without a date');
  ok('a missing report without a date is refused');

  console.log('--- Missing pet, no current photo (must be refused) ---');
  document.elements['report-missing-date'] = { value: new Date().toISOString().slice(0, 16) };
  document.elements['report-missing-condition'] = { value: 'Healthy, red collar with a bell.' };
  document.elements['report-missing-custom-desc'] = { value: 'Siamese cat, cream coat, blue eyes.' };
  await window.reportManager.submitMissingReport();
  assert.strictEqual(missingReports.length, 0, 'nothing is saved without a current photo');
  ok('a missing report without a current photo is refused');

  console.log('--- Missing pet, valid (optional notes left empty) ---');
  window.reportManager.uploadedPhotoData = 'data:image/png;base64,iVBORw0KGgo=';
  await window.reportManager.submitMissingReport();
  assert.strictEqual(missingReports.length, 1, 'the missing report is saved');
  assert.strictEqual(missingReports[0].petId, 'pet-2');
  assert.strictEqual(missingReports[0].lastSeenLocation, 'District 1 (La Loma), Quezon City');
  assert(missingReports[0].photoUrl, 'the current photo is attached');
  ok('a valid missing report is saved with the pet, the place and the photo');

  console.log('\nAll "Submit and Notify" checks passed.');
})().catch((e) => { console.error('FAILED:', e && e.stack || e); process.exit(1); });
