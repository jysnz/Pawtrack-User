const fs = require('fs');
const path = require('path');

console.log('===============================================================');
console.log('   PAWTRACK ADMIN BUTTONS VERIFICATION TEST (DOM & STORE)     ');
console.log('===============================================================\n');

// Mock browser environment
const localStorageData = {};
global.localStorage = {
  getItem: (k) => localStorageData[k] || null,
  setItem: (k, v) => { localStorageData[k] = String(v); },
  removeItem: (k) => { delete localStorageData[k]; },
  clear: () => { for (const k in localStorageData) delete localStorageData[k]; }
};

global.sessionStorage = {
  getItem: (k) => 'true',
  setItem: () => {}
};

global.window = global;
// The store syncs with localhost:8080/3000; keep this test from overwriting a running server's shared DB.
global.fetch = () => Promise.reject(new Error('Network disabled in tests'));
global.window.addEventListener = (ev, fn) => {};
global.BroadcastChannel = class {
  constructor() {}
  postMessage() {}
  close() {}
};

global.document = {
  getElementById: (id) => {
    return {
      id,
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {}
      },
      innerHTML: '',
      addEventListener: () => {},
      appendChild: () => {},
      querySelectorAll: () => [],
      querySelector: () => null,
      contains: () => true
    };
  },
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {}
};

global.FormData = class {
  constructor(form) {
    this.data = form?._data || {};
  }
  get(key) {
    return this.data[key] || '';
  }
};

// Load admin store
require('../js/admin-store.js');
const store = global.adminStore;

// Load views and app
global.adminApp = {
  currentDrawer: null,
  currentModal: null,
  openDrawer: (html) => {
    global.adminApp.currentDrawer = html;
    return {
      querySelector: (sel) => ({
        addEventListener: (ev, handler) => {
          if (!global.adminApp.drawerHandlers) global.adminApp.drawerHandlers = {};
          global.adminApp.drawerHandlers[sel] = handler;
        }
      })
    };
  },
  closeDrawer: () => {
    global.adminApp.currentDrawer = null;
  },
  openModalContent: (html) => {
    global.adminApp.currentModal = html;
    return {
      querySelector: (sel) => ({
        addEventListener: (ev, handler) => {
          if (!global.adminApp.modalHandlers) global.adminApp.modalHandlers = {};
          global.adminApp.modalHandlers[sel] = handler;
        }
      })
    };
  },
  closeModal: () => {
    global.adminApp.currentModal = null;
  },
  showToast: (msg, type) => {
    console.log(`       [UI Toast ${type.toUpperCase()}]: ${msg}`);
  }
};

require('../js/views/pets-view.js');
const petsView = global.PetsView;

console.log('[1/4] Registering a test pet in store...');
const testPet = store.savePet({
  id: 'pet-test-btn-1',
  name: 'Sparky Button Test',
  species: 'Dog',
  breed: 'Husky',
  color: 'Black & White',
  rfidTag: 'RFID-882194',
  status: 'safe',
  owner: {
    name: 'Alice Reyes',
    phone: '+63 918 000 1111',
    email: 'alice@example.com'
  }
});
console.log(`[PASS] Pet created: "${testPet.name}" (ID: ${testPet.id}, RFID: ${testPet.rfidTag})`);

// 2. Test Pet Edit Drawer Button
console.log('\n[2/4] Testing "Edit" button (opening drawer and saving edits)...');
petsView.openPetDrawer(testPet);
if (global.adminApp.currentDrawer && global.adminApp.currentDrawer.includes('Edit Pet: Sparky Button Test')) {
  console.log('       [PASS] Drawer successfully opened with pet details & edit fields.');
} else {
  throw new Error('Failed to open pet drawer.');
}

// Simulate form edit and save
const mockDrawerForm = {
  _data: {
    name: 'Sparky (Edited Name)',
    species: 'Dog',
    breed: 'Siberian Husky',
    color: 'Silver & White',
    gender: 'Male',
    age: '4 years',
    weight: '25 kg',
    rfidTag: 'RFID-882194',
    microchipNo: '985141001234567',
    photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1',
    status: 'safe',
    medicalNotes: 'Fully vaccinated & microchipped',
    ownerName: 'Alice Reyes',
    ownerPhone: '+63 918 000 1111',
    ownerEmail: 'alice@example.com',
    ownerAddress: 'Quezon City, Metro Manila'
  }
};

// Simulate clicking '#drawer-save-btn'
if (global.adminApp.drawerHandlers && global.adminApp.drawerHandlers['#drawer-save-btn']) {
  // Override querySelector to supply form
  const origOpenDrawer = global.adminApp.openDrawer;
  global.adminApp.openDrawer = (html) => {
    const el = origOpenDrawer(html);
    el.querySelector = (sel) => {
      if (sel === '#drawer-pet-form') return mockDrawerForm;
      return { addEventListener: (ev, h) => { global.adminApp.drawerHandlers[sel] = h; } };
    };
    return el;
  };
  petsView.openPetDrawer(testPet);
  global.adminApp.drawerHandlers['#drawer-save-btn']();
}

const editedPet = store.getPetById('pet-test-btn-1');
if (editedPet && editedPet.name === 'Sparky (Edited Name)' && editedPet.breed === 'Siberian Husky') {
  console.log(`       [PASS] Pet edits successfully saved in store: "${editedPet.name}"`);
} else {
  throw new Error('Pet edits were not saved.');
}

// 3. Test Pet Delete Modal Button (Trash Icon)
console.log('\n[3/4] Testing "Delete" button (trash icon & confirmation modal)...');
petsView.confirmDeletePet(editedPet);
if (global.adminApp.currentModal && global.adminApp.currentModal.includes('Delete Pet Record')) {
  console.log('       [PASS] Delete confirmation modal successfully opened with pet details.');
} else {
  throw new Error('Failed to open delete confirmation modal.');
}

// Simulate clicking confirm delete
if (global.adminApp.modalHandlers && global.adminApp.modalHandlers['#del-pet-confirm']) {
  global.adminApp.modalHandlers['#del-pet-confirm']();
}

const deletedCheck = store.getPetById('pet-test-btn-1');
if (!deletedCheck) {
  console.log('       [PASS] Pet successfully deleted and removed from store.');
} else {
  throw new Error('Pet was not removed upon delete confirmation.');
}

// 4. Verify RFID tag was released back into available inventory
console.log('\n[4/4] Verifying RFID tag inventory auto-release on pet deletion...');
const tags = store.getRfidTags();
const rfidTag = tags.find(t => (t.code || t.tag) === 'RFID-882194');
if (rfidTag && rfidTag.status === 'available' && rfidTag.petId === null) {
  console.log(`       [PASS] RFID tag ${rfidTag.code} is released back to "available" inventory.`);
} else {
  throw new Error('RFID tag was not released.');
}

console.log('\n===============================================================');
console.log('   ALL BUTTONS (EDIT & DELETE) ARE 100% OPERATIONAL & VERIFIED ');
console.log('===============================================================\n');
