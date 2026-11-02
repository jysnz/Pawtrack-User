const fs = require('fs');
const path = require('path');

console.log('===============================================================');
console.log('   PAWTRACK ADMIN RESPONSIVE & LAYOUT VERIFICATION TEST        ');
console.log('===============================================================\n');

// 1. Verify CSS classes
const adminCss = fs.readFileSync(path.join(__dirname, '../css/admin.css'), 'utf8');
const compCss = fs.readFileSync(path.join(__dirname, '../css/components.css'), 'utf8');

const requiredClasses = [
  'stalls-audit-grid',
  'settings-grid',
  'facilities-grid',
  'form-grid',
  'kpi-grid',
  'chart-funnel-grid',
  'table-toolbar',
  'table-search',
  'data-table-wrapper',
  'modal-box',
  'drawer-panel'
];

console.log('--- 1. Checking Responsive Layout Classes in CSS ---');
let allCssOk = true;
requiredClasses.forEach(cls => {
  const present = compCss.includes('.' + cls) || adminCss.includes('.' + cls);
  if (present) {
    console.log(`[PASS] Class .${cls} is defined.`);
  } else {
    allCssOk = false;
    console.error(`[FAIL] Class .${cls} is MISSING from CSS!`);
  }
});

// 2. Check Media Queries
console.log('\n--- 2. Checking Media Queries Breakpoints ---');
const breakpoints = ['1024px', '860px', '768px', '680px', '640px', '600px', '480px'];
breakpoints.forEach(bp => {
  const inAdmin = adminCss.includes(bp);
  const inComp = compCss.includes(bp);
  if (inAdmin || inComp) {
    console.log(`[PASS] Breakpoint ${bp} is handled.`);
  } else {
    console.warn(`[WARN] Breakpoint ${bp} not found.`);
  }
});

// 3. Test View Renderings
console.log('\n--- 3. Testing HTML View Generation ---');
// Mock store
global.window = global;
global.window.adminStore = {
  getPets: () => [
    { id: 'pet-1', name: 'Luna', species: 'Dog', breed: 'Husky', status: 'safe', rfidTag: 'RFID-1001', microchipNo: '985141001', owner: { name: 'Maria Santos', phone: '+63 917 123 4567' }, registeredDate: '2026-08-20' }
  ],
  getImpoundments: () => [
    { id: 'imp-1', petId: 'pet-1', shelterId: 'sh-1', intakeDate: '2026-08-28', claimDeadline: '2026-08-31', status: 'active_impounded', feesAccumulated: 500 }
  ],
  getShelters: () => [
    { id: 'sh-1', name: 'Quezon City Animal Care', address: '123 Elliptical Rd', phone: '(02) 8988-4242', capacity: 60, occupied: 12, fee: 'PHP 500 / day' }
  ],
  getRfidTags: () => [
    { code: 'RFID-1001', status: 'assigned', assignedPetId: 'pet-1', batteryLevel: 94, lastScanned: '2026-08-30' }
  ],
  getNotifications: () => [
    { id: 'notif-1', title: 'Intake Notice', message: 'Pet logged in holding bay', read: false, type: 'impound_alert' }
  ],
  getSettings: () => ({
    systemName: 'PawTrack Municipal Gateway',
    holdingWindowHours: 72,
    dailyHoldingFeeDefault: 500
  }),
  getSightings: () => [
    { id: 'sight-1', species: 'Dog', breed: 'Aspin', location: 'Katipunan Ave, QC', reporterName: 'Carlos Dalisay', reporterPhone: '+63 918 777 4321', comments: 'Found wandering near convenience store', timestamp: new Date().toISOString(), status: 'active_sighting' }
  ],
  getLogs: () => [
    { id: 'log-1', action: 'Pet Registered', details: 'Luna registered', timestamp: new Date().toISOString() }
  ]
};

// Load view scripts
require('../js/views/activation-view.js');
require('../js/views/heatmap-view.js');
require('../js/views/pets-view.js');
require('../js/views/impoundments-view.js');
require('../js/views/breakdown-view.js');
require('../js/views/shelters-view.js');
require('../js/views/rfid-view.js');
require('../js/views/notifs-view.js');
require('../js/views/settings-view.js');

const views = [
  { name: 'ActivationView', view: window.ActivationView },
  { name: 'HeatmapView', view: window.HeatmapView },
  { name: 'PetsView', view: window.PetsView },
  { name: 'ImpoundmentsView', view: window.ImpoundmentsView },
  { name: 'BreakdownView', view: window.BreakdownView },
  { name: 'SheltersView', view: window.SheltersView },
  { name: 'RfidView', view: window.RfidView },
  { name: 'NotifsView', view: window.NotifsView },
  { name: 'SettingsView', view: window.SettingsView }
];

let allViewsOk = true;
views.forEach(v => {
  const container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  try {
    v.view.render(container);
    if (container.innerHTML && container.innerHTML.length > 50) {
      console.log(`[PASS] ${v.name} rendered successfully (${container.innerHTML.length} chars of HTML).`);
    } else {
      allViewsOk = false;
      console.error(`[FAIL] ${v.name} rendered empty HTML!`);
    }
  } catch (err) {
    allViewsOk = false;
    console.error(`[FAIL] ${v.name} threw error on render:`, err.message);
  }
});

console.log('\n===============================================================');
if (allCssOk && allViewsOk) {
  console.log('   ALL RESPONSIVE LAYOUT & VIEW CHECKS PASSED PERFECTLY!       ');
} else {
  console.log('   SOME CHECKS FAILED. PLEASE REVIEW LOGS ABOVE.               ');
}
console.log('===============================================================\n');
