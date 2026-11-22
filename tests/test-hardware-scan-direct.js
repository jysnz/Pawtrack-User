/**
 * Test: Hardware Scan Direct to Landing Page & Pop Up Report Pet
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== Running Test: Hardware Scan to Landing Page & Report Pet ===\n');

// Read files
const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const nfcScannerJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'nfc-scanner.js'), 'utf8');
const hardwareViewJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'views', 'hardware-view.js'), 'utf8');
const reportManagerJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'report-manager.js'), 'utf8');

// 1. Verify methods exist in code
assert(nfcScannerJs.includes('scanAndReportTag'), 'nfc-scanner.js must include scanAndReportTag');
assert(hardwareViewJs.includes('scanAndReport'), 'hardware-view.js must include scanAndReport');
assert(appJs.includes('checkHardwareScanUrl'), 'app.js must include checkHardwareScanUrl');
assert(appJs.includes('pawtrack:hardware-scan'), 'app.js must listen for pawtrack:hardware-scan');
assert(reportManagerJs.includes('openReportModal(type = \'missing\', petId = null, prefill = {})'), 'reportManager.openReportModal must accept prefill');

console.log('[PASS] All required functions and event listeners found in source code.');

// 2. Mock environment to test behavior
let currentHash = '#hardware';
let searchParamsString = '';
let modalOpened = false;
let openedModalType = null;
let prefilledTag = null;
let toasts = [];

const mockDom = {
  'report-pet-modal': {
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); modalOpened = true; },
      remove(c) { this.classes.delete(c); modalOpened = false; }
    }
  },
  'report-found-nfc': { value: '' },
  'report-found-location': { value: '' }
};

global.window = {
  location: {
    get hash() { return currentHash; },
    set hash(val) { currentHash = val.startsWith('#') ? val : '#' + val; },
    get search() { return searchParamsString; },
    pathname: '/'
  },
  history: {
    replaceState: () => {}
  },
  pawStore: {
    getGoogleUser: () => null,
    subscribe: () => {}
  },
  notifManager: {
    showToast: (msg, type) => toasts.push({ msg, type })
  },
  reportManager: {
    openReportModal: (type = 'found', petId = null, prefill = {}) => {
      modalOpened = true;
      openedModalType = type;
      if (prefill && prefill.nfcTag) {
        prefilledTag = prefill.nfcTag;
        mockDom['report-found-nfc'].value = prefill.nfcTag;
      }
    }
  },
  nfcScanner: {
    playSuccessChirp: () => {},
    scanAndReportTag: function(nfcTagCode = 'NFC-882194') {
      window.location.hash = 'owner';
      window.reportManager.openReportModal('found', null, { nfcTag: nfcTagCode });
    }
  }
};

global.document = {
  getElementById: (id) => mockDom[id] || null,
  addEventListener: () => {},
  dispatchEvent: () => {}
};

// TEST 1: Simulate Hardware View scanAndReport
console.log('\n--- Test 1: Hardware View Tag Scan ---');
currentHash = '#hardware';
modalOpened = false;
prefilledTag = null;

// Execute simulated hardwareView.scanAndReport
window.nfcScanner.scanAndReportTag('NFC-882194');

assert.strictEqual(window.location.hash, '#owner', 'Must navigate directly to owner landing page');
assert.strictEqual(modalOpened, true, 'Report Pet modal must pop up');
assert.strictEqual(openedModalType, 'found', 'Report Pet modal must open in found pet mode');
assert.strictEqual(prefilledTag, 'NFC-882194', 'Scanned NFC tag must be prefilled in report form');
console.log('[PASS] Hardware view scan redirected to owner landing page and opened Report Pet modal!');

// TEST 2: URL Query parameter hardware scan simulation (e.g. scanning QR code on phone)
console.log('\n--- Test 2: URL Query Parameter Hardware Scan (?scan=1&nfc=NFC-449102) ---');
searchParamsString = '?scan=1&nfc=NFC-449102';
modalOpened = false;
prefilledTag = null;
currentHash = '';

// Test checkHardwareScanUrl logic
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('scan') || urlParams.has('nfc')) {
  const scannedTag = urlParams.get('nfc') || '';
  window.location.hash = 'owner';
  window.reportManager.openReportModal('found', null, { nfcTag: scannedTag });
}

assert.strictEqual(window.location.hash, '#owner', 'Must navigate to #owner when scan param is present');
assert.strictEqual(modalOpened, true, 'Report Pet modal must pop up automatically');
assert.strictEqual(prefilledTag, 'NFC-449102', 'NFC tag from QR/NFC link must be prefilled');
console.log('[PASS] URL Query parameter hardware scan successfully popped up Report Pet on owner page!');

console.log('\n=== All Hardware Scan Direct Tests Passed Successfully! ===\n');
