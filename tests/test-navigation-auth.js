/**
 * Test: Navigation auth restriction (logged-out vs logged-in).
 * Runs the REAL isGuestView(), updateGoogleAuthUI() and handleRoute() from js/app.js against a small fake page.
 * Signed-out visitors may open: Missing Pets (#owner), Found a Pet (#found), Impound facilities (#impound) and the
 * violations reference (#fines). Report Pet sends a signed-out visitor to Found a Pet. Everything else asks them to sign in.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== Running Test: Navigation Auth Restriction ===\n');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 1. Tabs in index.html
const navTabs = ['pets', 'owner', 'sightings', 'found', 'report', 'impound', 'violations', 'settings'];
navTabs.forEach((tab) => {
  assert(indexHtml.includes(`data-view="${tab}"`), `Tab data-view="${tab}" must exist in index.html`);
});
console.log(`[PASS] All ${navTabs.length} tabs exist in index.html.`);
assert(!indexHtml.includes('id="dropdown-hardware-btn"') && !indexHtml.includes('id="dropdown-profile-btn"'), 'account dropdown must not list Guardian Profile or Hardware Specs');
console.log('[PASS] Account dropdown no longer lists Guardian Profile or Hardware Specs.');

// 2. Pull the real methods out of app.js
const grab = (name) => {
  const start = appJs.indexOf(`\n  ${name}(`);
  assert(start > 0, `app.js must define ${name}()`);
  // a method ends at the first line that is exactly "  }"
  const end = appJs.indexOf('\n  }\n', start);
  return appJs.slice(start, end + 4);
};
const methods = ['isGuestView', 'updateGoogleAuthUI', 'handleRoute'].map(grab).join('\n');
const App = new Function(`return class TestApp { ${methods} };`)();

// 3. A small fake page
let currentUser = null;
let currentHash = '#owner';
let chatUser;
const toasts = [];
const mkBtn = (view) => ({ dataset: { view }, style: { display: '' }, classList: { classes: new Set(), add(c) { this.classes.add(c); }, remove(c) { this.classes.delete(c); }, contains(c) { return this.classes.has(c); } }, querySelectorAll: () => [] });
const tabs = navTabs.map(mkBtn);
const mockDom = {
  'header-login-btn': { style: {} }, 'header-user-btn': { style: {} }, 'header-user-name': {}, 'header-avatar-circle': {},
  'dropdown-user-name': {}, 'dropdown-user-email': {}, 'dropdown-avatar-circle': {}, 'google-required-modal': { style: { display: 'none' } },
  'google-onetap-prompt': { style: { display: 'none' } }
};
global.window = {
  location: { get hash() { return currentHash; }, set hash(v) { currentHash = v.startsWith('#') ? v : '#' + v; } },
  pawStore: { getGoogleUser: () => currentUser, getPets: () => [], getNotifications: () => [] },
  chatView: { setUser(id) { chatUser = id; } },
  notifManager: { showToast: (msg, type) => toasts.push({ msg, type }) }
};
global.document = {
  getElementById: (id) => mockDom[id] || { style: {}, appendChild() {}, querySelector: () => null, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, removeAttribute() {} },
  querySelectorAll: (sel) => (sel === '.role-tab-btn' ? tabs : []),
  querySelector: () => null
};

const app = new App();
app.views = { pets: {}, owner: {}, sightings: {}, found: {}, report: {}, impound: {}, violations: {}, settings: {}, fines: {} };
app.updateGreeting = () => {};
app.renderAvatar = () => {};
app.renderCurrentView = () => {}; // drawing the page is not under test
const visible = () => tabs.filter((b) => b.style.display !== 'none').map((b) => b.dataset.view);

// TEST 1: signed out
console.log('\n--- Test 1: Logged-out tab visibility ---');
currentUser = null;
app.updateGoogleAuthUI();
assert.equal(chatUser, null, 'The assistant receives no user when signed out');
assert.deepStrictEqual(visible(), ['owner', 'found', 'impound'], `Signed-out visitors see Missing Pets, Found a Pet and Impound only (saw ${visible()})`);
console.log('[PASS] Visible when logged out:', visible().join(', '));

// TEST 2: signed-out route protection
console.log('\n--- Test 2: Logged-out route protection ---');
['pets', 'sightings', 'violations', 'settings'].forEach((view) => {
  currentHash = '#' + view; mockDom['google-required-modal'].style.display = 'none';
  app.handleRoute();
  assert.strictEqual(currentHash, '#owner', `#${view} must redirect a signed-out visitor to #owner`);
  assert.strictEqual(mockDom['google-required-modal'].style.display, 'flex', 'the sign-in prompt must show');
  console.log(`[PASS] #${view} is protected`);
});
currentHash = '#report'; app.handleRoute();
assert.strictEqual(currentHash, '#found', 'a signed-out visitor who opens Report Pet is sent to Found a Pet');
console.log('[PASS] #report sends a signed-out visitor to Found a Pet');
['owner', 'found', 'impound'].forEach((view) => {
  currentHash = '#' + view; app.handleRoute();
  assert.strictEqual(currentHash, '#' + view, `#${view} stays open to everyone`);
  assert.strictEqual(app.currentView, view);
});
console.log('[PASS] #owner, #found and #impound stay open to visitors');

// TEST 3: signed in
console.log('\n--- Test 3: Logged-in tab visibility and navigation ---');
currentUser = { id: 'guardian', name: 'Dariush', shortName: 'Dariush', email: 'dariush@gmail.com', avatarInitial: 'D' };
app.updateGoogleAuthUI();
assert.equal(chatUser, 'guardian', 'The assistant receives the active guardian ID');
assert.strictEqual(visible().length, navTabs.length, `All ${navTabs.length} tabs are visible when logged in (saw ${visible()})`);
['pets', 'sightings', 'report', 'violations', 'settings'].forEach((view) => {
  currentHash = '#' + view; app.handleRoute();
  assert.strictEqual(currentHash, '#' + view, `a signed-in guardian can open #${view}`);
  assert.strictEqual(app.currentView, view);
});
console.log('[PASS] A signed-in guardian can open every page.');

console.log('\n=== All Navigation Auth Tests Passed! ===\n');
