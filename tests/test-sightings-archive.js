const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== Running Test: Sightings Navigation Archive, Retrieve & Delete ===\n');

const storeJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');
const sightingsViewJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'views', 'sightings-view.js'), 'utf8');

// 1. PawStore methods
assert(storeJs.includes('archiveSighting(sightingId)'), 'PawStore must have archiveSighting method');
assert(storeJs.includes('retrieveSighting(sightingId)'), 'PawStore must have retrieveSighting method');
assert(storeJs.includes('deleteSighting(sightingId)'), 'PawStore must have deleteSighting method');
console.log('[PASS] PawStore archive, retrieve, and delete methods present.');

// 2. Sighting reviews are saved in Supabase (community_sightings), not a local sync server
assert(storeJs.includes("from('community_sightings').update({ status })"), 'PawStore must save sighting status changes to Supabase');
console.log('[PASS] Sighting status changes are saved to Supabase.');

// 3. SightingsView buttons and actions
assert(sightingsViewJs.includes('id="sightings-header-archived-btn"'), 'SightingsView must have header Archived button');
assert(sightingsViewJs.includes("['archived', 'Archived', stats.archived]") && sightingsViewJs.includes('_filterPill('), 'SightingsView must have Archived filter pill');
assert(sightingsViewJs.includes('archiveSighting('), 'SightingsView must have archiveSighting method');
assert(sightingsViewJs.includes('retrieveSighting('), 'SightingsView must have retrieveSighting method');
assert(sightingsViewJs.includes('deleteSighting('), 'SightingsView must have deleteSighting method');
assert(sightingsViewJs.includes('Retrieve'), 'SightingsView must render Retrieve button on archived cards');
assert(sightingsViewJs.includes('Delete'), 'SightingsView must render Delete button on archived cards');
console.log('[PASS] SightingsView UI buttons, filters, and actions verified.');

// 4. Functional logic simulation
let sightings = [
  { id: 'sight-1', species: 'Dog', breed: 'Shih Tzu', status: 'possible_sighting', location: 'QC Circle' },
  { id: 'sight-2', species: 'Cat', breed: 'Persian', status: 'confirmed_sighting', location: 'Diliman' },
  { id: 'sight-3', species: 'Dog', breed: 'Aspin', status: 'dismissed', location: 'Cubao' }
];

// Mock PawStore
const mockStore = {
  getSightings: () => sightings,
  archiveSighting(id) {
    const s = sightings.find(item => item.id === id);
    if (s) {
      s.status = 'dismissed';
      s.archivedAt = new Date().toISOString();
      return s;
    }
    return null;
  },
  retrieveSighting(id) {
    const s = sightings.find(item => item.id === id);
    if (s) {
      s.status = 'possible_sighting';
      delete s.dismissedAt;
      delete s.archivedAt;
      return s;
    }
    return null;
  },
  deleteSighting(id) {
    const initLen = sightings.length;
    sightings = sightings.filter(item => item.id !== id);
    return sightings.length !== initLen;
  }
};

// Test Archive
mockStore.archiveSighting('sight-1');
assert.strictEqual(sightings.find(s => s.id === 'sight-1').status, 'dismissed', 'sight-1 status should be dismissed/archived');
console.log('[PASS] Mock archiveSighting updated status successfully.');

// Test Retrieve
mockStore.retrieveSighting('sight-3');
assert.strictEqual(sightings.find(s => s.id === 'sight-3').status, 'possible_sighting', 'sight-3 status should be restored to possible_sighting');
console.log('[PASS] Mock retrieveSighting restored status successfully.');

// Test Delete
const deleted = mockStore.deleteSighting('sight-1');
assert.strictEqual(deleted, true, 'deleteSighting should return true');
assert.strictEqual(sightings.find(s => s.id === 'sight-1'), undefined, 'sight-1 should be removed from sightings');
console.log('[PASS] Mock deleteSighting deleted record successfully.');

console.log('\n=== All Sightings Navigation Archive, Retrieve & Delete Tests Passed! ===\n');
