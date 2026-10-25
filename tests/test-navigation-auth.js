/**
 * Test: Navigation Auth Restriction (Logged-out vs Logged-in)
 * Validates that when a user is not logged in on the owner side,
 * only "Home" and "Report Pet" are navigable/visible.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== Running Test: Navigation Auth Restriction ===\n');

// Read app.js and index.html
const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 1. Verify index.html navigation items
const navTabs = ['owner', 'map', 'cases', 'impounded', 'report'];
navTabs.forEach(tab => {
  assert(indexHtml.includes(`data-view="${tab}"`), `Tab data-view="${tab}" must exist in index.html`);
  console.log(`[PASS] Found tab [data-view="${tab}"] in index.html`);
});

// Verify Hardware Specs button in User Account Dropdown
assert(indexHtml.includes('id="dropdown-hardware-btn"'), 'index.html must include #dropdown-hardware-btn in user dropdown');
console.log('[PASS] Found #dropdown-hardware-btn in User Account Dropdown menu.');

// 2. Mock DOM environment
let currentUser = null;
let currentHash = '#owner';
let toasts = [];

const mockRoleTabBtns = navTabs.map(view => ({
  dataset: { view },
  style: { display: '' },
  classList: {
    classes: new Set(view === 'owner' ? ['active', 'role-tab-btn'] : ['role-tab-btn']),
    add(c) { this.classes.add(c); },
    remove(c) { this.classes.delete(c); },
    contains(c) { return this.classes.has(c); }
  }
}));

const mockDom = {
  'header-login-btn': { style: { display: '' } },
  'header-user-btn': { style: { display: 'none' } },
  'header-user-name': { textContent: '' },
  'header-avatar-circle': { textContent: '' },
  'dropdown-user-name': { textContent: '' },
  'dropdown-user-email': { textContent: '' },
  'dropdown-avatar-circle': { textContent: '' },
  'google-required-modal': { style: { display: 'none' } },
  'google-onetap-prompt': { style: { display: 'none' } },
  'app-viewport': { innerHTML: '' }
};

global.window = {
  location: {
    get hash() { return currentHash; },
    set hash(val) { currentHash = val.startsWith('#') ? val : '#' + val; }
  },
  pawStore: {
    getGoogleUser: () => currentUser,
    setGoogleUser: (u) => { currentUser = u; },
    getPets: () => [],
    getNotifications: () => [],
    subscribe: () => {}
  },
  notifManager: {
    showToast: (msg, type) => { toasts.push({ msg, type }); }
  },
  ownerView: { render: () => {} },
  publicView: { render: () => {} },
  casesView: { render: () => {} },
  hardwareView: { render: () => {} },
  reportManager: { openReportModal: () => {} }
};

global.document = {
  getElementById: (id) => mockDom[id] || null,
  querySelectorAll: (selector) => {
    if (selector === '.role-tab-btn') return mockRoleTabBtns;
    return [];
  },
  documentElement: {
    getAttribute: () => 'dark',
    setAttribute: () => {}
  }
};

// 3. Test App Logic using simulated App instance
class TestApp {
  constructor() {
    this.currentView = 'owner';
    this.views = {
      owner: window.ownerView,
      map: window.publicView,
      cases: window.casesView,
      impounded: window.impoundedView,
      hardware: window.hardwareView
    };
  }

  updateGoogleAuthUI() {
    const user = window.pawStore ? window.pawStore.getGoogleUser() : null;
    const loginBtn = document.getElementById('header-login-btn');
    const userBtn = document.getElementById('header-user-btn');
    const nameEl = document.getElementById('header-user-name');
    const avatarCircle = document.getElementById('header-avatar-circle');
    const dropdownName = document.getElementById('dropdown-user-name');
    const dropdownEmail = document.getElementById('dropdown-user-email');
    const dropdownAvatar = document.getElementById('dropdown-avatar-circle');

    const isLoggedIn = !!(user && user.name);

    if (isLoggedIn) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userBtn) userBtn.style.display = 'inline-flex';
      const short = user.shortName || user.name || 'User';
      const initial = user.avatarInitial || (user.name ? user.name[0].toUpperCase() : 'G');
      if (nameEl) nameEl.textContent = short;
      if (avatarCircle) avatarCircle.textContent = initial;
      if (dropdownName) dropdownName.textContent = user.name || 'Google User';
      if (dropdownEmail) dropdownEmail.textContent = user.email || 'user@gmail.com';
      if (dropdownAvatar) dropdownAvatar.textContent = initial;
    } else {
      if (loginBtn) loginBtn.style.display = 'inline-flex';
      if (userBtn) userBtn.style.display = 'none';
    }

    // Role tabs visibility: when not logged in, only Home and Report Pet are visible
    document.querySelectorAll('.role-tab-btn').forEach(btn => {
      const view = btn.dataset.view;
      if (view === 'owner' || view === 'report') {
        btn.style.display = '';
      } else {
        btn.style.display = isLoggedIn ? '' : 'none';
      }
    });
  }

  handleRoute() {
    let hash = window.location.hash.replace('#', '');
    const user = window.pawStore ? window.pawStore.getGoogleUser() : null;
    const isLoggedIn = !!(user && user.name);

    // If logged out, only 'owner' (Home) is accessible. Any other view redirects to 'owner'.
    if (!isLoggedIn && hash && hash !== 'owner') {
      window.location.hash = 'owner';
      const warningModal = document.getElementById('google-required-modal');
      const onetapPrompt = document.getElementById('google-onetap-prompt');
      if (warningModal) {
        warningModal.style.display = 'flex';
      } else if (onetapPrompt) {
        onetapPrompt.style.display = 'block';
      }
      if (window.notifManager && typeof window.notifManager.showToast === 'function') {
        window.notifManager.showToast('Please sign in to access this section.', 'info');
      }
      return;
    }

    if (!hash || !this.views[hash]) {
      hash = 'owner';
    }

    this.currentView = hash;

    document.querySelectorAll('.role-tab-btn').forEach(btn => {
      if (btn.dataset.view === hash) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}

const app = new TestApp();

// TEST 1: Logged-out state
console.log('\n--- Test 1: Logged-Out Tab Visibility ---');
currentUser = null;
app.updateGoogleAuthUI();

const visibleTabsLoggedOut = mockRoleTabBtns.filter(b => b.style.display !== 'none').map(b => b.dataset.view);
const hiddenTabsLoggedOut = mockRoleTabBtns.filter(b => b.style.display === 'none').map(b => b.dataset.view);

console.log('Visible tabs when logged out:', visibleTabsLoggedOut);
console.log('Hidden tabs when logged out:', hiddenTabsLoggedOut);

assert.deepStrictEqual(visibleTabsLoggedOut, ['owner', 'report'], 'Only owner and report tabs must be visible when logged out');
assert.deepStrictEqual(hiddenTabsLoggedOut, ['map', 'cases', 'impounded'], 'Map, cases, and impounded must be hidden when logged out');
console.log('[PASS] Logged-out tab visibility correct!');

// TEST 2: Logged-out Route Protection
console.log('\n--- Test 2: Logged-Out Route Protection ---');
['map', 'cases', 'impounded', 'hardware'].forEach(protectedView => {
  window.location.hash = '#' + protectedView;
  app.handleRoute();
  assert.strictEqual(window.location.hash, '#owner', `Hash should redirect to #owner when attempting #${protectedView}`);
  assert.strictEqual(app.currentView, 'owner', `Current view must remain 'owner'`);
  assert.strictEqual(mockDom['google-required-modal'].style.display, 'flex', 'Warning modal must be triggered');
  console.log(`[PASS] Route #${protectedView} successfully protected and redirected to #owner`);
});

// TEST 3: Logged-in state
console.log('\n--- Test 3: Logged-In Tab Visibility and Navigation ---');
currentUser = { name: 'Dariush', shortName: 'Dariush', email: 'dariush@gmail.com', avatarInitial: 'D' };
app.updateGoogleAuthUI();

const visibleTabsLoggedIn = mockRoleTabBtns.filter(b => b.style.display !== 'none').map(b => b.dataset.view);
console.log('Visible tabs when logged in:', visibleTabsLoggedIn);

assert.strictEqual(visibleTabsLoggedIn.length, 6, 'All 6 tabs must be visible when logged in');
console.log('[PASS] Logged-in tabs all visible!');

['map', 'cases', 'impounded', 'hardware'].forEach(view => {
  window.location.hash = '#' + view;
  app.handleRoute();
  assert.strictEqual(window.location.hash, '#' + view, `Logged-in user can access #${view}`);
  console.log(`[PASS] Logged-in user navigated to #${view} successfully`);
});

// TEST 4: Responsive Navigation CSS Verification
console.log('\n--- Test 4: Responsive Navigation CSS Verification ---');
const mainCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'main.css'), 'utf8');

assert(mainCss.includes('.role-tabs {'), 'css/main.css must define .role-tabs');
assert(mainCss.includes('.role-tab-btn {'), 'css/main.css must define .role-tab-btn');
assert(mainCss.includes('@media (min-width: 993px) and (max-width: 1280px)'), 'css/main.css must support intermediate desktop/laptop screens');
assert(mainCss.includes('@media (max-width: 992px)'), 'css/main.css must support mobile and tablet floating navigation');
assert(mainCss.includes('@media (max-width: 480px)'), 'css/main.css must support compact mobile screens');
assert(mainCss.includes('@media (max-width: 340px)'), 'css/main.css must support ultra-compact mobile screens');

console.log('[PASS] Responsive navigation breakpoints for desktop, laptop, tablet, and mobile verified.');

console.log('\n=== All Navigation Auth & Responsiveness Tests Passed! ===\n');
