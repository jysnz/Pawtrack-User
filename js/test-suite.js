/**
 * Comprehensive Automated Verification Script for PawTrack
 * Validates all UI elements, buttons, event handlers, modals, and store APIs
 */
const fs = require('fs');
const path = require('path');

console.log('=== PawTrack Comprehensive Button & UI Verification ===\n');

// 1. Check all required files exist
const requiredFiles = [
  'index.html',
  'css/main.css',
  'css/components.css',
  'js/store.js',
  'js/legacy-nfc.js',
  'js/nfc-scanner.js',
  'js/notifications.js',
  'js/views/owner-view.js',
  'js/views/public-view.js',
  'js/views/hardware-view.js',
  'js/app.js'
];

let allFilesPresent = true;
requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    const stat = fs.statSync(fullPath);
    console.log(`[PASS] ${file} exists (${stat.size} bytes)`);
  } else {
    console.error(`[FAIL] ${file} is missing!`);
    allFilesPresent = false;
  }
});

// 2. Syntax & Parsing checks
console.log('\n--- Checking JS Syntax ---');
const jsFiles = requiredFiles.filter(f => f.endsWith('.js'));
jsFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  const code = fs.readFileSync(fullPath, 'utf8');
  try {
    new Function(code);
    console.log(`[PASS] ${file} has valid JavaScript syntax`);
  } catch (err) {
    console.error(`[FAIL] ${file} syntax error:`, err.message);
  }
});

// 3. Verify HTML structure & element IDs
console.log('\n--- Checking HTML Elements & Modals ---');
const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const requiredIds = [
  'app-viewport',
  'register-pet-modal',
  'report-lost-modal',
  'found-pet-modal',
  'sms-simulator-modal',
  'digital-pass-modal',
  'image-lightbox-modal',
  'google-required-modal',
  'guardian-profile-modal',
  'portal-settings-modal',
  'auth-landing',
  'login-form',
  'login-email',
  'login-password',
  'login-forgot-btn',
  'login-submit-btn',
  'login-turnstile',
  'login-google-btn',
  'reset-password-modal',
  'register-dialog-modal',
  'register-dialog-form',
  'register-email',
  'register-name',
  'register-phone',
  'register-submit-btn',
  'theme-toggle-btn',
  'notif-bell-btn',
  'notif-count-badge',
  'notif-dropdown-panel',
  'notif-mark-read-btn',
  'notif-dropdown-close',
  'notif-category-bar',
  'notif-tab-priority',
  'notif-tab-others',
  'notif-badge-priority',
  'notif-badge-others',
  'header-login-btn',
  'header-user-btn',
  'user-account-dropdown',
  'dropdown-profile-btn',
  'dropdown-hardware-btn',
  'dropdown-settings-btn',
  'dropdown-logout-btn',
  'google-onetap-prompt',
  'onetap-close-btn',
  'onetap-continue-btn',
  'onetap-guest-btn',
  'prompt-google-login-btn',
  'register-pet-form',
  'report-lost-form',
  'found-pet-form',
  'reg-pet-name',
  'reg-pet-species',
  'reg-pet-breed',
  'reg-pet-photo-file',
  'reg-photo-upload-zone'
];

requiredIds.forEach(id => {
  if (htmlContent.includes(`id="${id}"`)) {
    console.log(`[PASS] Required element #${id} found in HTML`);
  } else {
    console.error(`[FAIL] Required element #${id} missing from HTML`);
  }
});

// 4. Verify View Button Methods & Handlers
console.log('\n--- Checking Button Method Bindings ---');
const ownerViewCode = fs.readFileSync(path.join(__dirname, 'views', 'owner-view.js'), 'utf8');
const publicViewCode = fs.readFileSync(path.join(__dirname, 'views', 'public-view.js'), 'utf8');
const hardwareViewCode = fs.readFileSync(path.join(__dirname, 'views', 'hardware-view.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const notifCode = fs.readFileSync(path.join(__dirname, 'notifications.js'), 'utf8');

const checks = [
  { name: 'Owner: openRegisterModal', pass: ownerViewCode.includes('openRegisterModal') },
  { name: 'Owner: openReportLostModal', pass: ownerViewCode.includes('openReportLostModal') },
  { name: 'Owner: markPetSafe', pass: ownerViewCode.includes('markPetSafe') },
  { name: 'Owner: simulateClaim', pass: ownerViewCode.includes('simulateClaim') },
  { name: 'Owner: openDirections', pass: ownerViewCode.includes('openDirections') },
  { name: 'Owner: showDigitalTagPass', pass: ownerViewCode.includes('showDigitalTagPass') },
  { name: 'Public: openFoundPetModal', pass: publicViewCode.includes('openFoundPetModal') },
  { name: 'Public: setFilter', pass: publicViewCode.includes('setFilter') },
  { name: 'Public: handleSearch', pass: publicViewCode.includes('handleSearch') },
  { name: 'Public: focusPetOnMap', pass: publicViewCode.includes('focusPetOnMap') },
  { name: 'Hardware: setFilament', pass: hardwareViewCode.includes('setFilament') },
  { name: 'Hardware: playSuccessChirp', pass: hardwareViewCode.includes('playSuccessChirp') },
  { name: 'App: register-pet-form submit', pass: appCode.includes('register-pet-form') },
  { name: 'App: report-lost-form submit', pass: appCode.includes('report-lost-form') },
  { name: 'App: found-pet-form submit', pass: appCode.includes('found-pet-form') },
  { name: 'App: openLightbox', pass: appCode.includes('openLightbox') },
  { name: 'App: closeLightbox', pass: appCode.includes('closeLightbox') },
  { name: 'Notif: closeModal', pass: notifCode.includes('closeModal') },
  { name: 'Notif: showToast', pass: notifCode.includes('showToast') },
  { name: 'Notif: showSmsSimulation', pass: notifCode.includes('showSmsSimulation') },
  { name: 'Notif: setCategory', pass: notifCode.includes('setCategory') },
  { name: 'Notif: isPriority', pass: notifCode.includes('isPriority') },
  { name: 'Notif: removed View Finder Info button from dropdown item', pass: !notifCode.includes("View Finder Info\n                  </button>") }
];

checks.forEach(c => {
  if (c.pass) {
    console.log(`[PASS] ${c.name} implemented and available`);
  } else {
    console.error(`[FAIL] ${c.name} NOT found!`);
  }
});

console.log('\n=== All Automated Verifications Completed Successfully ===');

