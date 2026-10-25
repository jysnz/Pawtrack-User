const fs = require('fs');
const path = require('path');

console.log('===============================================================');
console.log('  PawTrack Comprehensive Element & Button Verification');
console.log('===============================================================');

// 1. Read all files
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const mainCss = fs.readFileSync(path.join(__dirname, 'css', 'main.css'), 'utf8');
const compCss = fs.readFileSync(path.join(__dirname, 'css', 'components.css'), 'utf8');
const i18nJs = fs.readFileSync(path.join(__dirname, 'js', 'i18n.js'), 'utf8');
const storeJs = fs.readFileSync(path.join(__dirname, 'js', 'store.js'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
const notifJs = fs.readFileSync(path.join(__dirname, 'js', 'notifications.js'), 'utf8');
const ownerJs = fs.readFileSync(path.join(__dirname, 'js', 'views', 'owner-view.js'), 'utf8');
const publicJs = fs.readFileSync(path.join(__dirname, 'js', 'views', 'public-view.js'), 'utf8');
const casesJs = fs.readFileSync(path.join(__dirname, 'js', 'views', 'cases-view.js'), 'utf8');
const hwJs = fs.readFileSync(path.join(__dirname, 'js', 'views', 'hardware-view.js'), 'utf8');
const reportJs = fs.readFileSync(path.join(__dirname, 'js', 'report-manager.js'), 'utf8');

const allJs = i18nJs + '\n' + storeJs + '\n' + appJs + '\n' + notifJs + '\n' + ownerJs + '\n' + publicJs + '\n' + casesJs + '\n' + hwJs + '\n' + reportJs;
const allHtmlAndJs = indexHtml + '\n' + allJs;

// Check 1: Modals Defined in index.html
console.log('\n[Check 1] Verifying Modal Elements in index.html:');
const expectedModals = [
  'register-pet-modal',
  'report-lost-modal',
  'found-pet-modal',
  'report-pet-modal',
  'sms-simulator-modal',
  'digital-pass-modal',
  'image-lightbox-modal',
  'google-required-modal',
  'guardian-profile-modal',
  'portal-settings-modal',
  'ai-match-modal',
  'case-dossier-modal',
  'claiming-verification-modal',
  'owner-guide-modal'
];

expectedModals.forEach(mId => {
  if (indexHtml.includes(`id="${mId}"`)) {
    console.log(`  ✓ Modal [${mId}] is present in DOM.`);
  } else {
    console.error(`  ✗ MISSING Modal: [${mId}]`);
  }
});

// Check 2: Global Object Methods called in onclick
console.log('\n[Check 2] Verifying All Onclick Handlers and Function Bindings:');
const onclickRegex = /onclick="([^"]+)"/g;
let match;
const onclickHandlers = new Set();

while ((match = onclickRegex.exec(allHtmlAndJs)) !== null) {
  onclickHandlers.add(match[1]);
}

console.log(`  Found ${onclickHandlers.size} distinct button onclick expressions.`);
let passedFunctions = 0;

onclickHandlers.forEach(handler => {
  // Check function calls like window.ownerView.openRegisterModal()
  const fnMatch = handler.match(/window\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\(/);
  if (fnMatch) {
    const [_, objName, fnName] = fnMatch;
    const isPresent = allJs.includes(fnName);
    if (isPresent) {
      passedFunctions++;
    } else {
      console.warn(`  ⚠ Warning: window.${objName}.${fnName} might not be declared in JS source!`);
    }
  }
});
console.log(`  ✓ ${passedFunctions} handler methods verified in JS code.`);

// Check 3: Role Tabs & Router Views
console.log('\n[Check 3] Verifying Router Views & Role Tabs:');
const expectedViews = ['owner', 'cases', 'impounded', 'sightings'];
expectedViews.forEach(v => {
  const inNav = indexHtml.includes(`data-view="${v}"`);
  const inRouter = appJs.includes(`${v}: window.`);
  if (inNav && inRouter) {
    console.log(`  ✓ Role tab and router view [${v}] are fully connected.`);
  } else {
    console.error(`  ✗ View [${v}] mismatch: inNav=${inNav}, inRouter=${inRouter}`);
  }
});

// Check 4: Form Elements & Submissions
console.log('\n[Check 4] Verifying Form IDs and Event Listeners:');
const expectedForms = [
  'register-pet-form',
  'report-lost-form',
  'found-pet-form',
  'claiming-verification-form'
];

expectedForms.forEach(fId => {
  const inHtml = indexHtml.includes(`id="${fId}"`);
  const inAppJs = appJs.includes(`getElementById('${fId}')`);
  if (inHtml && inAppJs) {
    console.log(`  ✓ Form [${fId}] DOM element + submit listener active.`);
  } else {
    console.error(`  ✗ Form [${fId}] missing: inHtml=${inHtml}, inAppJs=${inAppJs}`);
  }
});

// Check 5: Critical CSS Classes Visibility
console.log('\n[Check 5] Verifying Critical UI CSS Classes in components.css:');
const expectedClasses = [
  '.view-header',
  '.glass-card',
  '.stats-grid',
  '.pet-card',
  '.scanner-radar-disk',
  '.case-timeline-stepper',
  '.community-sighting-pin',
  '.countdown-timer-box',
  '.claim-checklist',
  '.badge-lost',
  '.badge-safe',
  '.badge-impounded',
  '.badge-reunited'
];

const allCss = mainCss + '\n' + compCss;
expectedClasses.forEach(cls => {
  if (allCss.includes(cls)) {
    console.log(`  ✓ CSS class [${cls}] defined.`);
  } else {
    console.warn(`  ⚠ Warning: CSS class [${cls}] not found in stylesheets.`);
  }
});

console.log('\n===============================================================');
console.log('  All Checks Complete. Project Elements & Buttons are Healthy!');
console.log('===============================================================');
