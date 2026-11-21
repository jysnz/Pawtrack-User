const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock browser DOM and LocalStorage environment
const localStorageData = {};
global.localStorage = {
  getItem: (k) => localStorageData[k] || null,
  setItem: (k, v) => { localStorageData[k] = String(v); },
  removeItem: (k) => { delete localStorageData[k]; }
};

global.mockElements = {};
global.window = global;
global.document = {
  getElementById: (id) => {
    if (!global.mockElements[id]) {
      global.mockElements[id] = {
        id,
        style: {},
        classList: {
          classes: new Set(),
          add: function(c) { this.classes.add(c); },
          remove: function(c) { this.classes.delete(c); },
          contains: function(c) { return this.classes.has(c); }
        },
        textContent: '',
        innerHTML: '',
        dataset: {},
        querySelector: () => null
      };
    }
    return global.mockElements[id];
  },
  createElement: (tag) => ({
    tag,
    style: {},
    className: '',
    appendChild: () => {},
    remove: () => {}
  }),
  body: { appendChild: () => {} }
};

const notifCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'notifications.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
eval(notifCode);

const notifMgr = window.notifManager;

// Test 1: Button order in HTML (Others first, Priority second)
const othersIdx = indexHtml.indexOf('id="notif-tab-others"');
const priorityIdx = indexHtml.indexOf('id="notif-tab-priority"');
assert.ok(othersIdx !== -1 && priorityIdx !== -1, 'Both tab buttons exist in index.html');
assert.ok(othersIdx < priorityIdx, 'Others tab button appears BEFORE Priority tab button');

// Test 2: Classification logic
const goodSamaritanItem = {
  id: 'notif-1',
  type: 'pet_found_match',
  title: 'GOOD SAMARITAN FOUND YOUR PET: "BUSTER TEST" !',
  message: 'Your pet was found and reported near Katipunan Ave...',
  nfcTag: 'TEST-NFC-998811',
  finderPhone: '+63 918 777 4321'
};

const impoundItem = {
  id: 'notif-2',
  type: 'impound_alert',
  title: 'Official Impound Notice: Buster',
  message: 'Your pet has been recorded at QC Animal Care. 72-Hour holding window initiated.'
};

const sightingItem = {
  id: 'notif-3',
  type: 'sighting',
  title: 'Sighting Pinned: Siberian Husky (Dog)',
  message: 'Community sighting logged at QC Circle.'
};

assert.strictEqual(notifMgr.isPriority(goodSamaritanItem), false, 'Good Samaritan found pet is classified as Others');
assert.strictEqual(notifMgr.isPriority(impoundItem), true, 'Official impound notice is classified as Priority');
assert.strictEqual(notifMgr.isPriority(sightingItem), false, 'Community sighting is classified as Others');
assert.strictEqual(notifMgr.activeCategory, 'others', 'Default active category is others');

global.pawStore = {
  getNotifications: () => [goodSamaritanItem, impoundItem, sightingItem],
  markNotificationRead: (id) => {
    const item = [goodSamaritanItem, impoundItem, sightingItem].find(n => n.id === id);
    if (item) item.read = true;
  },
  getPetByNFC: () => null,
  getPetById: () => null,
  getSightings: () => [],
  getCases: () => [],
  getPets: () => []
};

// Test 3: Rendering in Others tab (Default)
notifMgr.renderNotifDropdown();
const listElem = document.getElementById('notif-dropdown-list');
assert.ok(listElem.innerHTML.includes('GOOD SAMARITAN FOUND YOUR PET: &quot;BUSTER TEST&quot; !'), 'Good Samaritan notice is rendered in Others tab');
assert.ok(listElem.innerHTML.includes('Sighting Pinned'), 'Community sighting is rendered in Others tab');
assert.ok(!listElem.innerHTML.includes('Official Impound Notice'), 'Impound notice is NOT rendered in Others tab');
assert.ok(!listElem.innerHTML.includes('View Finder Info'), 'View Finder Info button is NOT present in notification items');

// Test 4: Switching to Priority tab
notifMgr.setCategory('priority');
assert.strictEqual(notifMgr.activeCategory, 'priority', 'Active category switched to priority');
assert.ok(listElem.innerHTML.includes('Official Impound Notice: Buster'), 'Impound notice is rendered in Priority tab');
assert.ok(!listElem.innerHTML.includes('GOOD SAMARITAN FOUND YOUR PET'), 'Good Samaritan notice is NOT rendered in Priority tab');

// Test 5: Tapping/Clicking notification changes it to read state with read-item class
notifMgr.setCategory('others');
assert.ok(listElem.innerHTML.includes('unread-match'), 'Unread match has unread-match class');
notifMgr.handleNotifClick('notif-1');
assert.strictEqual(goodSamaritanItem.read, true, 'Notification marked as read');
assert.ok(listElem.innerHTML.includes('read-item'), 'Read notification has read-item class');
assert.ok(!listElem.innerHTML.includes('unread-match'), 'Read notification no longer has unread-match class');

// Test 6: Verify icons removed from category tab bar in HTML
const catBarMatch = indexHtml.match(/<div class="fb-notif-category-bar" id="notif-category-bar">([\s\S]*?)<\/div>/);
assert.ok(catBarMatch, 'Category bar found in HTML');
assert.ok(!catBarMatch[1].includes('<svg'), 'No SVG icons inside category tab buttons');

// Test 7: Verify badge counts only appear when there are unread notifications
const othersBadge = document.getElementById('notif-badge-others');
const priorityBadge = document.getElementById('notif-badge-priority');

// When unread > 0
impoundItem.read = false;
notifMgr.renderNotifDropdown();
assert.strictEqual(priorityBadge.style.display, 'inline-block', 'Priority badge is displayed when there is an unread notification');

// When unread === 0
impoundItem.read = true;
goodSamaritanItem.read = true;
sightingItem.read = true;
notifMgr.renderNotifDropdown();
assert.strictEqual(priorityBadge.style.display, 'none', 'Priority badge is hidden when there are 0 unread notifications');
assert.strictEqual(othersBadge.style.display, 'none', 'Others badge is hidden when there are 0 unread notifications');

console.log('ALL CATEGORY AND BUTTON TESTS PASSED SUCCESSFULLY!');
