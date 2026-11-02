/**
 * PawTrack Admin store. Supabase is the database: every list is read from it into a local cache the views read,
 * and every change is written to it (see "Supabase: the only database" below).
 */

const STORAGE_KEYS = {
  PETS: 'pawtrack_pets',
  IMPOUNDMENTS: 'pawtrack_impoundments',
  NOTIFICATIONS: 'pawtrack_notifications',
  SHELTERS: 'pawtrack_shelters',
  CURRENT_USER: 'pawtrack_current_user',
  THEME: 'pawtrack_theme',
  RFID_TAGS: 'pawtrack_rfid_tags',
  ADMIN_LOGS: 'pawtrack_admin_logs',
  SETTINGS: 'pawtrack_system_settings',
  SIGHTINGS: 'pawtrack_sightings',
  CASES: 'pawtrack_cases',
  SHELTER_EXTRAS: 'pawtrack_shelter_extras'
};

// Bumped when the cached lists change meaning; older caches are cleared on load (v1: Supabase replaces the
// local JSON database, whose ids and records do not exist in Supabase)
const DATA_SOURCE_VERSION = 'supabase-v1';

// Clean Reset: 0 initial registered pets as requested
const SEED_PETS = [];
const SEED_IMPOUNDMENTS = [];
const SEED_NOTIFICATIONS = [];
const SEED_SIGHTINGS = [];
const SEED_CASES = [];

const SEED_SHELTERS = [
  {
    id: 'sh-qc-payatas',
    name: 'Quezon City Animal Care & Adoption Facility',
    type: 'Municipal LGU Facility',
    city: 'Quezon City (District 2)',
    address: 'Clemente St., Lupang Pangako, Payatas, Quezon City',
    phone: '+63 (2) 8988-4242 loc 8036',
    email: 'animalcare@quezoncity.gov.ph',
    hours: 'Mon - Fri: 8:00 AM - 5:00 PM',
    lat: 14.7118,
    lng: 121.1037,
    fee: 'PHP 500 / day',
    holdingPeriodDays: 3,
    capacity: 65,
    occupied: 0,
    partnered: true,
    officerInCharge: 'Dr. Fernando Gomez, DVM'
  },
  {
    id: 'sh-paws-qc',
    name: 'PAWS Animal Rehabilitation Center (PARC)',
    type: 'Non-Profit Animal Welfare Sanctuary',
    city: 'Quezon City (District 3)',
    address: 'Aurora Blvd. cor. Katipunan Ave., Loyola Heights, Quezon City',
    phone: '+63 (2) 8475-1688',
    email: 'philpaws@paws.org.ph',
    hours: 'Mon - Sat: 10:00 AM - 5:00 PM',
    lat: 14.6339,
    lng: 121.0741,
    fee: 'PHP 0 (NGO Shelter)',
    holdingPeriodDays: 30,
    capacity: 120,
    occupied: 0,
    partnered: true,
    officerInCharge: 'Anna Cabrera, Executive Director'
  },
  {
    id: 'sh-cara-mandaluyong',
    name: 'CARA Welfare Philippines Rescue Clinic',
    type: 'Non-Profit Rescue Clinic & Sanctuary',
    city: 'Mandaluyong City (Metro Manila)',
    address: '175 Lopez Rizal St. cor. Samat St., Mandaluyong City',
    phone: '+63 (2) 8532-3340',
    email: 'clinic@carawelfare.ph',
    hours: 'Tue - Sun: 9:00 AM - 5:00 PM',
    lat: 14.5886,
    lng: 121.0345,
    fee: 'Subsidized NGO Rates',
    holdingPeriodDays: 14,
    capacity: 45,
    occupied: 0,
    partnered: true,
    officerInCharge: 'Dr. Riza Zuniga, DVM'
  },
  {
    id: 'sh-akf-rescue',
    name: 'Animal Kingdom Foundation (AKF) Rescue Network',
    type: 'Anti-Cruelty Sanctuary & Rescue NGO',
    city: 'Quezon City / Capas Facility',
    address: '88 Malakas St., Diliman, Quezon City',
    phone: '+63 (939) 914-2402',
    email: 'akfrescue@gmail.com',
    hours: 'Mon - Sat: 9:00 AM - 5:00 PM',
    lat: 14.6465,
    lng: 121.0503,
    fee: 'PHP 0 (Non-Profit)',
    holdingPeriodDays: 60,
    capacity: 150,
    occupied: 0,
    partnered: true,
    officerInCharge: 'Atty. Heidi Caguioa'
  },
  {
    id: 'sh-ppbcc-foundation',
    name: 'Philippine Pet Birth Control Center Foundation (PPBCC)',
    type: 'Spay/Neuter & Animal Welfare Center',
    city: 'Metro Manila (QC Outreach)',
    address: '391 Boni Ave., Mandaluyong City',
    phone: '+63 (2) 8983-3933',
    email: 'ppbccfoundation@gmail.com',
    hours: 'Mon - Sun: 8:00 AM - 6:00 PM',
    lat: 14.5768,
    lng: 121.0381,
    fee: 'Subsidized Clinic',
    holdingPeriodDays: 7,
    capacity: 35,
    occupied: 0,
    partnered: true,
    officerInCharge: 'Dr. Mace Licuanan, DVM'
  },
  {
    id: 'sh-biyaya-care',
    name: 'Biyaya Animal Care Sanctuary & Hospital',
    type: 'Animal Welfare Hospital & Sanctuary',
    city: 'Quezon City / Mandaluyong',
    address: 'Katarungan St., Mandaluyong / QC Outpost',
    phone: '+63 (917) 543-3444',
    email: 'info@biyaya.org.ph',
    hours: 'Open 24/7 (Emergency & Shelter)',
    lat: 14.5824,
    lng: 121.0315,
    fee: 'Subsidized Rates',
    holdingPeriodDays: 21,
    capacity: 80,
    occupied: 0,
    partnered: true,
    officerInCharge: 'Dr. Ronald Santos, DVM'
  },
  {
    id: 'sh-sws-shelter',
    name: 'Strays Worth Saving (SWS) Rescue Shelter',
    type: 'Private Animal Rescue Sanctuary',
    city: 'Greater Manila Area',
    address: 'Tanauan / Metro Manila Operations Hub',
    phone: '+63 (917) 835-5177',
    email: 'straysworthsaving@gmail.com',
    hours: 'By Appointment',
    lat: 14.0845,
    lng: 121.1500,
    fee: 'PHP 0 (Private NGO)',
    holdingPeriodDays: 90,
    capacity: 180,
    occupied: 0,
    partnered: false,
    officerInCharge: 'Reena Del Rosario'
  },
  {
    id: 'sh-manila-vib',
    name: 'Manila City Pound & Veterinary Inspection Board',
    type: 'Municipal LGU Pound',
    city: 'City of Manila',
    address: 'Vitas St., Tondo, Manila, Metro Manila',
    phone: '+63 (2) 8243-7952',
    email: 'vib@manila.gov.ph',
    hours: 'Mon - Sat: 8:00 AM - 4:00 PM',
    lat: 14.6231,
    lng: 120.9634,
    fee: 'PHP 350 / day',
    holdingPeriodDays: 3,
    capacity: 50,
    occupied: 0,
    partnered: false,
    officerInCharge: 'Dr. Manuel Soriano, DVM'
  },
  {
    id: 'sh-pasig-pound',
    name: 'Pasig City Animal Welfare Facility & Pound',
    type: 'Municipal LGU Pound',
    city: 'Pasig City',
    address: 'Caruncho Ave., San Nicolas, Pasig City',
    phone: '+63 (2) 8643-1111',
    email: 'animalwelfare@pasigcity.gov.ph',
    hours: 'Mon - Fri: 8:00 AM - 5:00 PM',
    lat: 14.5583,
    lng: 121.0825,
    fee: 'PHP 400 / day',
    holdingPeriodDays: 3,
    capacity: 40,
    occupied: 0,
    partnered: false,
    officerInCharge: 'Dr. Angela Bautista, DVM'
  },
  {
    id: 'sh-mby-sanctuary',
    name: 'MBY Pet Rescue & Sanctuary',
    type: 'Private No-Kill Sanctuary',
    city: 'Rizal / Metro East',
    address: '113 Pantay St., Sitio Pantay, Antipolo, Rizal',
    phone: '+63 (2) 8656-3456',
    email: 'mbypetrescue@yahoo.com',
    hours: 'Sat - Sun: 10:00 AM - 4:00 PM',
    lat: 14.5862,
    lng: 121.2185,
    fee: 'PHP 0 (Private Sanctuary)',
    holdingPeriodDays: 180,
    capacity: 300,
    occupied: 0,
    partnered: false,
    officerInCharge: 'Marita Baquiran'
  },
  {
    id: 'sh-mandaluyong-pound',
    name: 'Mandaluyong City Veterinary Services & Pound',
    type: 'Municipal LGU Pound',
    city: 'Mandaluyong City',
    address: 'Martinez St., Barangay Plainview, Mandaluyong City',
    phone: '+63 (2) 8532-5001 loc 523',
    email: 'veterinary@mandaluyong.gov.ph',
    hours: 'Mon - Fri: 8:00 AM - 5:00 PM',
    lat: 14.5794,
    lng: 121.0359,
    fee: 'PHP 300 / day',
    holdingPeriodDays: 3,
    capacity: 35,
    occupied: 0,
    partnered: false,
    officerInCharge: 'Dr. Evelyn Morales, DVM'
  },
  {
    id: 'sh-caloocan-pound',
    name: 'Caloocan City Veterinary Office & Animal Pound',
    type: 'Municipal LGU Pound',
    city: 'Caloocan City',
    address: '8th Ave. cor. 8th St., Grace Park, Caloocan City',
    phone: '+63 (2) 8288-8811',
    email: 'vet@caloocancity.gov.ph',
    hours: 'Mon - Fri: 8:00 AM - 5:00 PM',
    lat: 14.6507,
    lng: 120.9830,
    fee: 'PHP 350 / day',
    holdingPeriodDays: 3,
    capacity: 40,
    occupied: 0,
    partnered: false,
    officerInCharge: 'Dr. Teodoro Gomez, DVM'
  }
];

const SEED_SETTINGS = {
  systemName: 'PawTrack Municipal Gateway',
  holdingWindowHours: 72,
  dailyHoldingFeeDefault: 500,
  currency: 'PHP',
  autoNotifyOwnerOnIntake: true,
  autoNotifyOwnerOnExpiryWarning: true,
  expiryWarningHours: 12,
  rfidScannerBaudRate: 9600,
  municipalJurisdiction: 'National Capital Region (Metro Manila)',
  syncStatus: 'Active Multi-Tab Shared'
};

class AdminStore {
  constructor() {
    this.listeners = [];
    this.broadcastChannel = null;
    this.syncStatus = 'connecting';
    this.init();
    this.initBroadcastBus();
    this.startSupabaseSync();
  }

  init() {
    // Lists cached from the old local JSON database are cleared once; Supabase fills them again
    if (localStorage.getItem('pawtrack_admin_data_source') !== DATA_SOURCE_VERSION) {
      [STORAGE_KEYS.PETS, STORAGE_KEYS.IMPOUNDMENTS, STORAGE_KEYS.NOTIFICATIONS, STORAGE_KEYS.SHELTERS,
        STORAGE_KEYS.RFID_TAGS, STORAGE_KEYS.SIGHTINGS, STORAGE_KEYS.CASES].forEach((key) => localStorage.setItem(key, '[]'));
      localStorage.setItem('pawtrack_admin_data_source', DATA_SOURCE_VERSION);
    }
    // Safe initialization: Only set defaults if keys do not exist in localStorage
    if (localStorage.getItem(STORAGE_KEYS.PETS) === null) {
      localStorage.setItem(STORAGE_KEYS.PETS, JSON.stringify(SEED_PETS));
    }
    if (localStorage.getItem(STORAGE_KEYS.IMPOUNDMENTS) === null) {
      localStorage.setItem(STORAGE_KEYS.IMPOUNDMENTS, JSON.stringify(SEED_IMPOUNDMENTS));
    }
    if (localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) === null) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(SEED_NOTIFICATIONS));
    }
    if (localStorage.getItem(STORAGE_KEYS.RFID_TAGS) === null) {
      localStorage.setItem(STORAGE_KEYS.RFID_TAGS, '[]');
    }
    if (localStorage.getItem(STORAGE_KEYS.SETTINGS) === null) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(SEED_SETTINGS));
    }
    if (localStorage.getItem(STORAGE_KEYS.SIGHTINGS) === null) {
      localStorage.setItem(STORAGE_KEYS.SIGHTINGS, JSON.stringify(SEED_SIGHTINGS));
    }
    if (localStorage.getItem(STORAGE_KEYS.CASES) === null) {
      localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(SEED_CASES));
    }
    if (localStorage.getItem(STORAGE_KEYS.ADMIN_LOGS) === null) {
      localStorage.setItem(STORAGE_KEYS.ADMIN_LOGS, JSON.stringify([
        {
          id: 'log-1',
          action: 'System Boot',
          details: 'PawTrack Admin Console initialized and synced with local storage.',
          operator: 'Super Admin',
          timestamp: new Date().toISOString()
        }
      ]));
    }
    localStorage.setItem('pawtrack_schema_v', '5.1');
  }

  initBroadcastBus() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('pawtrack_sync_bus');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type) {
            this.handleIncomingBroadcast(event.data);
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported, using storage fallback.');
    }

    // Cross-tab fallback listener
    window.addEventListener('storage', (e) => {
      if (Object.values(STORAGE_KEYS).includes(e.key)) {
        this.notify('cross_tab_sync');
      }
    });
  }

  handleIncomingBroadcast(data) {
    if (data.type === 'mutation' || data.type === 'state_push') this.syncFromSupabase();
  }

  // ---------- Supabase: the only database ----------
  // The console reads every list from Supabase into a local cache (STORAGE_KEYS) that the views read, and writes
  // each change to Supabase. Approved admins see all rows (row level security). Settings, the audit log and
  // shelter extras without a column (partner flag, officer, capacity) stay on this device.

  client() {
    return (window.adminApp && window.adminApp.supabase) || null;
  }

  // adminApp (which creates the Supabase client) is built after the store
  async waitForClient(timeoutMs = 15000) {
    const started = Date.now();
    while (!this.client() && Date.now() - started < timeoutMs) {
      await new Promise((r) => setTimeout(r, 150));
    }
    return this.client();
  }

  startSupabaseSync() {
    this.syncFromSupabase();
    this.pollTimer = setInterval(() => { if (!document.hidden) this.syncFromSupabase(); }, 20000);
    if (this.pollTimer && this.pollTimer.unref) this.pollTimer.unref(); // tests running in Node can exit
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.syncFromSupabase(); });
  }

  isDbId(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
  }

  syncFromSupabase() {
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      const sb = await this.waitForClient();
      if (!sb) { this.syncStatus = 'offline'; return false; }
      const [pets, reports, sightings, impounded, shelters, tags, notifs] = await Promise.all([
        sb.from('registered_pets').select('*').order('created_at', { ascending: false }),
        sb.from('missing_pets').select('*').order('created_at', { ascending: false }),
        sb.from('community_sightings').select('*').order('created_at', { ascending: false }).limit(1000),
        sb.from('impounded_pets').select('*').order('intake_at', { ascending: false }),
        sb.from('shelters').select('*').order('name'),
        sb.from('nfc_tags').select('*').order('created_at', { ascending: false }),
        sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(300)
      ].map((p) => Promise.resolve(p).catch((error) => ({ error }))));

      let changed = false;
      const put = (key, list) => {
        const next = JSON.stringify(list);
        if (localStorage.getItem(key) === next) return;
        localStorage.setItem(key, next);
        changed = true;
      };
      [['pets', pets], ['missing reports', reports], ['sightings', sightings], ['impounds', impounded], ['shelters', shelters], ['NFC tags', tags], ['notifications', notifs]]
        .forEach(([w, r]) => { if (r && r.error) console.warn(`[AdminStore] Could not load ${w}:`, r.error.message || r.error); });

      const petRows = pets.error ? null : (pets.data || []);
      if (petRows) put(STORAGE_KEYS.PETS, petRows.map((p) => this.fromPetRow(p)));
      const shelterList = shelters.error ? this.getShelters() : (shelters.data || []).map((s) => this.fromShelterRow(s));
      if (!shelters.error) put(STORAGE_KEYS.SHELTERS, shelterList);
      const sightingList = sightings.error ? this.getSightings() : (sightings.data || []).map((s) => this.fromSightingRow(s));
      if (!sightings.error) put(STORAGE_KEYS.SIGHTINGS, sightingList);
      if (!reports.error) put(STORAGE_KEYS.CASES, (reports.data || []).map((r) => this.caseFromReport(r, sightingList)));
      if (!impounded.error) put(STORAGE_KEYS.IMPOUNDMENTS, (impounded.data || []).map((i) => this.fromImpoundRow(i, shelterList)));
      if (!tags.error) put(STORAGE_KEYS.RFID_TAGS, (tags.data || []).map((t) => this.fromTagRow(t, petRows || [])));
      if (!notifs.error) put(STORAGE_KEYS.NOTIFICATIONS, (notifs.data || []).map((n) => this.fromNotificationRow(n)));

      this.syncStatus = 'connected';
      if (changed) this.notify('supabase_sync');
      return true;
    })().finally(() => { this.syncing = null; });
    return this.syncing;
  }

  // Shows a database error once per action
  dbError(what, error) {
    console.warn(`[AdminStore] ${what}:`, error && (error.message || error));
    if (window.adminApp && typeof window.adminApp.showToast === 'function') window.adminApp.showToast(`${what}: ${(error && error.message) || 'please try again.'}`, 'error');
  }

  // Runs one write and reloads the lists; returns the result rows, or null on error
  async write(what, run) {
    const sb = await this.waitForClient(5000);
    if (!sb) { this.dbError(what, { message: 'no connection to the database' }); return null; }
    const { data, error } = await run(sb);
    if (error) { this.dbError(what, error); return null; }
    this.syncFromSupabase();
    return data || [];
  }

  // ----- rows from Supabase, in the shapes the views use -----

  fromPetRow(p) {
    const months = p.age_months;
    return {
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed || '',
      gender: p.gender || '',
      color: p.color || '',
      age: months == null ? '' : months >= 12 ? `${Math.floor(months / 12)} yr${months >= 24 ? 's' : ''}` : `${months} mo`,
      ageMonths: months,
      status: p.status === 'missing' ? 'lost' : (p.status || 'safe'),
      rfidTag: p.nfc_tag || '',
      microchipNo: p.microchip_no || '',
      medicalNotes: p.medical_notes || '',
      description: p.description || '',
      photoUrl: p.photo_url || '',
      registeredDate: p.registered_on || (p.created_at || '').slice(0, 10),
      community: p.community || '',
      ownerId: p.owner_id,
      owner: { name: p.owner_name || '', phone: p.owner_phone || '', email: p.owner_email || '', address: p.community || '' }
    };
  }

  // A missing report as a case: filed, its sightings, then closed (reunited) when found
  caseFromReport(r, sightings) {
    const open = r.status === 'missing' || r.status === 'sighted';
    const seen = (sightings || []).filter((s) => s.missing_report_id === r.id);
    const timeline = [
      { type: 'missing', title: 'Reported missing', timestamp: r.created_at, location: r.last_seen_location, notes: r.notes || '', photoUrl: r.photo_url || null },
      ...seen.map((s) => ({
        type: 'sighting',
        title: s.status === 'confirmed_sighting' ? 'Sighting confirmed by the guardian' : 'Possible sighting',
        timestamp: s.dateTimeSeen || s.timestamp,
        location: s.location,
        finder: s.reporterName || null,
        notes: s.notes || '',
        photoUrl: s.photoUrl || null
      })),
      ...(open ? [] : [{ type: 'reunited', title: 'Marked found', timestamp: r.updated_at || r.created_at, location: r.last_seen_location, notes: '' }])
    ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return {
      id: r.id,
      petId: r.pet_id || null,
      petName: r.pet_name,
      species: r.species,
      breed: r.breed || '',
      photoUrl: r.photo_url || '',
      description: r.description || '',
      unregistered: !r.pet_id,
      reportedByOwner: r.reported_by_owner !== false,
      status: open ? (seen.length || r.status === 'sighted' ? 'sighted' : 'missing') : 'reunited',
      location: r.last_seen_location,
      coords: [r.lat, r.lng],
      createdAt: r.created_at,
      lastUpdated: r.updated_at || r.created_at,
      timeline
    };
  }

  fromSightingRow(s) {
    return {
      id: s.id,
      missing_report_id: s.missing_pet_id || null,
      species: s.species || 'Other',
      breed: s.breed || '',
      color: s.color || '',
      location: s.location,
      coords: [s.lat, s.lng],
      lat: s.lat,
      lng: s.lng,
      timestamp: s.created_at,
      createdAt: s.created_at,
      dateTimeSeen: s.seen_at,
      comments: s.notes || '',
      notes: s.notes || '',
      photoUrl: s.photo_url || '',
      photo: s.photo_url || '',
      reporterName: s.reporter_name || '',
      reporterPhone: '', // finders' phone numbers are not stored with sightings
      confidenceScore: s.confidence_score,
      status: s.status || 'possible_sighting',
      reportType: 'sighting'
    };
  }

  fromImpoundRow(i, shelters) {
    const shelter = (shelters || []).find((s) => s.id === i.shelter_id);
    return {
      id: i.id,
      petId: i.pet_id,
      petName: i.pet_name,
      species: i.species,
      breed: i.breed || '',
      photoUrl: i.photo_url || '',
      rfidTag: i.nfc_tag || '',
      cageNumber: i.kennel || '',
      location: i.impound_location || '',
      intakeOfficer: i.intake_officer || '',
      healthCondition: i.health_condition || '',
      shelterId: i.shelter_id,
      shelterName: shelter ? shelter.name : 'Animal facility',
      intakeDate: i.intake_at,
      claimDeadline: i.claim_deadline,
      status: i.status === 'in_holding' ? 'active_impounded' : i.status,
      closedAt: i.closed_at,
      notificationSent: true
    };
  }

  // Columns from Supabase; the console's own extras (partner flag, officer, capacity, city) from this device
  fromShelterRow(s) {
    const extras = this.getShelterExtras()[s.id] || SEED_SHELTERS.find((x) => x.name === s.name) || {};
    return {
      ...extras,
      id: s.id,
      name: s.name,
      address: s.address,
      phone: s.phone || '',
      email: s.email || '',
      hours: s.hours || '',
      lat: s.lat,
      lng: s.lng,
      coords: [s.lat, s.lng],
      fee: s.daily_fee_php != null ? `PHP ${s.daily_fee_php} / day` : (extras.fee || ''),
      holdingPeriodDays: s.holding_period_days,
      photoUrl: s.photo_url || extras.photoUrl || ''
    };
  }

  fromTagRow(t, petRows) {
    const pet = (petRows || []).find((p) => p.id === t.pet_id);
    return {
      id: t.id,
      code: t.code,
      tag: t.code,
      status: t.status || 'available',
      petId: t.pet_id,
      petName: pet ? pet.name : null,
      frequency: t.frequency || '',
      battery: t.battery_pct != null ? `${t.battery_pct}%` : '',
      lastScanned: t.last_scanned_at
    };
  }

  fromNotificationRow(n) {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      petName: n.pet_name,
      location: n.location || '',
      recipientId: n.recipient_id,
      timestamp: n.created_at,
      read: !!n.is_read
    };
  }

  getShelterExtras() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SHELTER_EXTRAS)) || {}; } catch { return {}; }
  }

  setShelterExtras(id, extras) {
    const all = this.getShelterExtras();
    all[id] = { ...(all[id] || {}), ...extras };
    localStorage.setItem(STORAGE_KEYS.SHELTER_EXTRAS, JSON.stringify(all));
  }

  // Kept so older callers still work: there is no separate sync step any more
  pushBackendMutation() {}
  syncFromBackend() { return this.syncFromSupabase(); }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify(eventReason = 'update') {
    this.listeners.forEach(fn => fn(this, eventReason));
  }

  // --- Audit Logs ---
  getLogs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ADMIN_LOGS)) || [];
    } catch {
      return [];
    }
  }

  logAction(action, details, operator = 'Admin Controller') {
    const logs = this.getLogs();
    const newLog = {
      id: 'log-' + Date.now(),
      action,
      details,
      operator,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog);
    if (logs.length > 100) logs.pop();
    localStorage.setItem(STORAGE_KEYS.ADMIN_LOGS, JSON.stringify(logs));
    return newLog;
  }

  // --- Pets API ---
  getPets() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PETS)) || [];
    } catch {
      return [];
    }
  }

  getPetById(id) {
    return this.getPets().find(p => p.id === id);
  }

  getPetByRFID(rfidTag) {
    if (!rfidTag) return null;
    const clean = rfidTag.trim().toUpperCase();
    return this.getPets().find(p => (p.rfidTag || '').toUpperCase() === clean);
  }

  // Saves to registered_pets. Returns the pet at once (the cache is updated); the database write follows.
  savePet(petData) {
    const pets = this.getPets();
    const existingIndex = pets.findIndex(p => p.id === petData.id);
    const isNew = existingIndex < 0;

    if (!isNew) {
      pets[existingIndex] = { ...pets[existingIndex], ...petData, lastUpdated: new Date().toISOString() };
      this.logAction('Updated Pet', `Modified profile for ${petData.name} (${petData.rfidTag || 'No RFID'})`);
    } else {
      petData.registeredDate = petData.registeredDate || new Date().toISOString().split('T')[0];
      pets.unshift(petData);
      this.logAction('Registered Pet', `Added new pet ${petData.name} with RFID ${petData.rfidTag}`);
    }
    localStorage.setItem(STORAGE_KEYS.PETS, JSON.stringify(pets));
    this.notify('pets_updated');

    const owner = petData.owner || {};
    const row = {
      name: petData.name,
      species: ['Dog', 'Cat', 'Other'].includes(petData.species) ? petData.species : 'Other',
      breed: petData.breed || null,
      gender: ['Male', 'Female'].includes(petData.gender) ? petData.gender : null,
      color: petData.color || null,
      status: { lost: 'missing', missing: 'missing', safe: 'safe', impounded: 'impounded', reunited: 'reunited' }[petData.status] || 'safe',
      nfc_tag: petData.rfidTag ? String(petData.rfidTag).trim().toUpperCase() : null,
      microchip_no: petData.microchipNo || null,
      medical_notes: petData.medicalNotes || null,
      photo_url: /^https:\/\//.test(petData.photoUrl || '') ? petData.photoUrl : null,
      owner_name: owner.name || null,
      owner_phone: owner.phone || null,
      owner_email: owner.email || null,
      community: owner.address || petData.community || null
    };
    // The tag shows as assigned at once; a new pet's tag is linked to its database id once the insert returns
    if (petData.rfidTag) this.syncRfidAssignment(petData.rfidTag, petData.id, petData.name);
    this.write(isNew ? 'Could not register the pet' : 'Could not save the pet', (sb) => (
      isNew || !this.isDbId(petData.id)
        ? sb.from('registered_pets').insert(row).select('id')
        : sb.from('registered_pets').update(row).eq('id', petData.id).select('id')
    )).then((rows) => {
      const id = rows && rows[0] && rows[0].id;
      if (id && id !== petData.id && petData.rfidTag) this.syncRfidAssignment(petData.rfidTag, id, petData.name);
    });
    return petData;
  }

  deletePet(petId) {
    const target = this.getPets().find(p => p.id === petId);
    if (!target) return false;
    localStorage.setItem(STORAGE_KEYS.PETS, JSON.stringify(this.getPets().filter(p => p.id !== petId)));
    if (target.rfidTag) this.freeRfidTag(target.rfidTag);
    if (this.isDbId(petId)) this.write('Could not delete the pet', (sb) => sb.from('registered_pets').delete().eq('id', petId));
    this.logAction('Deleted Pet', `Removed pet ${target.name} (${target.id}) from registry.`);
    this.notify('pets_deleted');
    return true;
  }

  updatePetStatus(petId, status, extraFields = {}) {
    const pets = this.getPets();
    const pet = pets.find(p => p.id === petId);
    if (pet) {
      const prev = pet.status;
      pet.status = status;
      Object.assign(pet, extraFields);
      localStorage.setItem(STORAGE_KEYS.PETS, JSON.stringify(pets));
      this.logAction('Changed Pet Status', `Status for ${pet.name} changed from ${prev} to ${status}`);
      this.notify('pet_status_changed');
    }
    const dbStatus = { lost: 'missing', missing: 'missing', safe: 'safe', impounded: 'impounded', reunited: 'reunited' }[status];
    if (dbStatus && this.isDbId(petId)) this.write('Could not change the pet\'s status', (sb) => sb.from('registered_pets').update({ status: dbStatus }).eq('id', petId));
    return pet;
  }

  // --- Cases API ---
  // Built from missing_pets and their sightings on each sync (see caseFromReport)
  getCases() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CASES)) || [];
    } catch {
      return [];
    }
  }

  // --- Impoundments API ---
  getImpoundments() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.IMPOUNDMENTS)) || [];
    } catch {
      return [];
    }
  }

  getImpoundmentById(id) {
    return this.getImpoundments().find(i => i.id === id);
  }

  // Saves to impounded_pets. Returns the record at once; the database write follows.
  saveImpoundment(data) {
    const impoundments = this.getImpoundments();
    const index = impoundments.findIndex(i => i.id === data.id);
    const isNew = index < 0;
    let record;

    if (!isNew) {
      record = { ...impoundments[index], ...data };
      impoundments[index] = record;
      this.logAction('Updated Impoundment', `Modified impound case ${data.id} for ${data.petName}`);
    } else {
      record = {
        intakeDate: data.intakeDate || new Date().toISOString(),
        claimDeadline: data.claimDeadline || new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        status: data.status || 'active_impounded',
        notificationSent: true,
        ...data
      };
      impoundments.unshift(record);
      if (data.petId) this.updatePetStatus(data.petId, 'impounded');
      this.logAction('Created Impoundment', `Logged impoundment for ${data.petName} at ${data.shelterName}`);
    }
    localStorage.setItem(STORAGE_KEYS.IMPOUNDMENTS, JSON.stringify(impoundments));
    this.notify('impoundments_updated');

    if (!this.isDbId(record.shelterId)) {
      this.dbError('Could not save the impound', { message: 'choose a shelter from the list' });
      return record;
    }
    const row = {
      pet_id: this.isDbId(record.petId) ? record.petId : null,
      shelter_id: record.shelterId,
      pet_name: record.petName || 'Unknown pet',
      species: ['Dog', 'Cat', 'Other'].includes(record.species) ? record.species : 'Other',
      breed: record.breed || null,
      photo_url: /^https:\/\//.test(record.photoUrl || '') ? record.photoUrl : null,
      nfc_tag: record.rfidTag || null,
      kennel: record.cageNumber || null,
      impound_location: record.impoundLocation || record.location || null,
      intake_officer: record.intakeOfficer || null,
      health_condition: record.healthCondition || null,
      intake_at: record.intakeDate,
      claim_deadline: record.claimDeadline,
      status: record.status === 'active_impounded' || record.status === 'active' ? 'in_holding' : record.status,
      closed_at: record.closedAt || null
    };
    this.write('Could not save the impound', (sb) => (
      isNew || !this.isDbId(record.id)
        ? sb.from('impounded_pets').insert(row)
        : sb.from('impounded_pets').update(row).eq('id', record.id)
    ));
    return record;
  }

  claimImpoundment(impoundId, operator = 'Admin') {
    const impoundments = this.getImpoundments();
    const imp = impoundments.find(i => i.id === impoundId);
    if (imp) {
      imp.status = 'claimed';
      imp.closedAt = new Date().toISOString();
      imp.claimedByOfficer = operator;
      localStorage.setItem(STORAGE_KEYS.IMPOUNDMENTS, JSON.stringify(impoundments));
      if (imp.petId) this.updatePetStatus(imp.petId, 'safe');
      if (this.isDbId(impoundId)) {
        this.write('Could not record the claim', (sb) => sb.from('impounded_pets').update({ status: 'claimed', closed_at: imp.closedAt }).eq('id', impoundId));
      }
      this.logAction('Claimed Pet', `Completed release clearance for case ${imp.id} (${imp.petName})`);
      this.notify('impoundment_claimed');
    }
    return imp;
  }

  extendImpoundDeadline(impoundId, additionalHours = 24) {
    const impoundments = this.getImpoundments();
    const imp = impoundments.find(i => i.id === impoundId);
    if (imp) {
      const current = new Date(imp.claimDeadline).getTime();
      imp.claimDeadline = new Date(current + additionalHours * 3600 * 1000).toISOString();
      localStorage.setItem(STORAGE_KEYS.IMPOUNDMENTS, JSON.stringify(impoundments));
      if (this.isDbId(impoundId)) {
        this.write('Could not extend the deadline', (sb) => sb.from('impounded_pets').update({ claim_deadline: imp.claimDeadline }).eq('id', impoundId));
      }
      this.logAction('Extended Deadline', `Extended holding window for ${imp.petName} by ${additionalHours} hours.`);
      this.notify('impound_extended');
    }
    return imp;
  }

  // --- Shelters API ---
  getShelters() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHELTERS));
      return Array.isArray(list) && list.length ? list : SEED_SHELTERS;
    } catch {
      return SEED_SHELTERS;
    }
  }

  saveShelter(shelterData) {
    const shelters = this.getShelters();
    const index = shelters.findIndex(s => s.id === shelterData.id);
    const isNew = index < 0 || !this.isDbId(shelterData.id);
    if (index >= 0) shelters[index] = { ...shelters[index], ...shelterData };
    else shelters.push(shelterData);
    localStorage.setItem(STORAGE_KEYS.SHELTERS, JSON.stringify(shelters));
    this.logAction(isNew ? 'Added Facility' : 'Updated Facility', `${isNew ? 'Added new shelter facility' : 'Updated shelter details for'} ${shelterData.name}`);
    this.notify('shelters_updated');

    const coords = Array.isArray(shelterData.coords) ? shelterData.coords : [shelterData.lat, shelterData.lng];
    const row = {
      name: shelterData.name,
      address: shelterData.address || '',
      phone: shelterData.phone || null,
      email: shelterData.email || null,
      hours: shelterData.hours || null,
      lat: +coords[0],
      lng: +coords[1],
      daily_fee_php: parseInt(String(shelterData.fee || '').replace(/[^0-9]/g, ''), 10) || 0,
      holding_period_days: parseInt(shelterData.holdingPeriodDays, 10) || 3,
      photo_url: /^https:\/\//.test(shelterData.photoUrl || '') ? shelterData.photoUrl : null
    };
    this.write('Could not save the shelter', (sb) => (
      isNew ? sb.from('shelters').insert(row).select('id') : sb.from('shelters').update(row).eq('id', shelterData.id).select('id')
    )).then((rows) => {
      // Fields with no column are kept on this device, keyed by the shelter's database id
      const id = rows && rows[0] && rows[0].id;
      if (id) {
        const { partnered, officerInCharge, capacity, occupied, city, type } = shelterData;
        this.setShelterExtras(id, { partnered, officerInCharge, capacity, occupied, city, type });
      }
    });
    return shelterData;
  }

  deleteShelter(shelterId) {
    localStorage.setItem(STORAGE_KEYS.SHELTERS, JSON.stringify(this.getShelters().filter(s => s.id !== shelterId)));
    if (this.isDbId(shelterId)) this.write('Could not delete the shelter', (sb) => sb.from('shelters').delete().eq('id', shelterId));
    this.logAction('Deleted Facility', `Removed facility with ID ${shelterId}`);
    this.notify('shelters_deleted');
    return true;
  }

  // The partner flag has no column: it is kept on this device
  toggleShelterPartner(shelterId) {
    const shelters = this.getShelters();
    const sh = shelters.find(s => s.id === shelterId);
    if (!sh) return null;
    sh.partnered = !sh.partnered;
    localStorage.setItem(STORAGE_KEYS.SHELTERS, JSON.stringify(shelters));
    this.setShelterExtras(shelterId, { partnered: sh.partnered });
    this.logAction('Partnership Toggled', `${sh.name} partnership set to: ${sh.partnered ? 'Partnered' : 'Not Partnered'}`);
    this.notify('shelters_updated');
    return sh;
  }

  // --- RFID Tag Management (nfc_tags) ---
  getRfidTags() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.RFID_TAGS));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  syncRfidAssignment(rfidCode, petId, petName) {
    if (!rfidCode) return;
    const clean = rfidCode.trim().toUpperCase();
    const tags = this.getRfidTags();
    const tag = tags.find(t => ((t.code || t.tag || '').toUpperCase() === clean));
    if (tag) Object.assign(tag, { status: 'assigned', petId, petName, lastScanned: new Date().toISOString() });
    else tags.push({ id: 'tag-' + Date.now(), code: clean, tag: clean, status: 'assigned', petId, petName, frequency: '134.2 kHz FDX-B', battery: '100%' });
    localStorage.setItem(STORAGE_KEYS.RFID_TAGS, JSON.stringify(tags));
    const row = { code: clean, status: 'assigned', pet_id: this.isDbId(petId) ? petId : null, last_scanned_at: new Date().toISOString() };
    this.write('Could not assign the tag', (sb) => sb.from('nfc_tags').upsert(row, { onConflict: 'code' }));
  }

  freeRfidTag(rfidCode) {
    if (!rfidCode) return;
    const clean = rfidCode.trim().toUpperCase();
    const tags = this.getRfidTags();
    const tag = tags.find(t => ((t.code || t.tag || '').toUpperCase() === clean));
    if (tag) {
      Object.assign(tag, { status: 'available', petId: null, petName: null });
      localStorage.setItem(STORAGE_KEYS.RFID_TAGS, JSON.stringify(tags));
    }
    this.write('Could not free the tag', (sb) => sb.from('nfc_tags').update({ status: 'available', pet_id: null }).eq('code', clean));
  }

  createRfidTag(tagData) {
    const newTag = { id: 'tag-' + Date.now(), status: 'available', frequency: '134.2 kHz FDX-B', battery: '100%', ...tagData };
    localStorage.setItem(STORAGE_KEYS.RFID_TAGS, JSON.stringify([newTag, ...this.getRfidTags()]));
    this.write('Could not create the tag', (sb) => sb.from('nfc_tags').insert({
      code: String(newTag.code || '').trim().toUpperCase(),
      status: ['available', 'assigned', 'lost', 'retired'].includes(newTag.status) ? newTag.status : 'available',
      frequency: newTag.frequency || null,
      battery_pct: parseInt(newTag.battery, 10) || 100
    }));
    this.logAction('Generated RFID Tag', `Provisioned tag ${newTag.code}`);
    this.notify('rfid_updated');
    return newTag;
  }

  // --- Notifications & Broadcasts API (notifications table; admins see and manage all) ---
  getNotifications() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) || [];
    } catch {
      return [];
    }
  }

  // A broadcast from the console. Without a recipient it is a system-wide message.
  addNotification(notif) {
    const newNotif = { id: 'notif-' + Date.now(), timestamp: new Date().toISOString(), read: false, ...notif };
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([newNotif, ...this.getNotifications()]));
    const type = ['sighting_verification', 'impound_alert', 'reunited', 'missing_alert', 'system'].includes(newNotif.type) ? newNotif.type : 'system';
    this.write('Could not send the broadcast', (sb) => sb.from('notifications').insert({
      recipient_id: this.isDbId(newNotif.recipientId) ? newNotif.recipientId : null,
      type,
      title: String(newNotif.title || 'PawTrack notice').slice(0, 200),
      message: String(newNotif.message || '').slice(0, 2000) || '-',
      pet_name: newNotif.petName || null,
      location: newNotif.location || null
    }));
    this.logAction('Broadcast Alert', `Dispatched notification: "${newNotif.title}"`);
    this.notify('notifications_updated');
    return newNotif;
  }

  deleteNotification(notifId) {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(this.getNotifications().filter(n => n.id !== notifId)));
    if (this.isDbId(notifId)) this.write('Could not delete the notification', (sb) => sb.from('notifications').delete().eq('id', notifId));
    this.notify('notifications_updated');
  }

  markAllNotificationsRead() {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(this.getNotifications().map(n => ({ ...n, read: true }))));
    this.write('Could not mark notifications read', (sb) => sb.from('notifications').update({ is_read: true }).eq('is_read', false));
    this.notify('notifications_updated');
  }

  // --- System Settings (this device) ---
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || SEED_SETTINGS;
    } catch {
      return SEED_SETTINGS;
    }
  }

  saveSettings(newSettings) {
    const merged = { ...this.getSettings(), ...newSettings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    this.logAction('Updated Settings', 'Municipal gateway configuration updated.');
    this.notify('settings_updated');
    return merged;
  }

  // --- Sightings & found reports (community_sightings) ---
  getSightings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SIGHTINGS)) || [];
    } catch {
      return [];
    }
  }

  getSightingById(id) {
    return this.getSightings().find(s => s.id === id);
  }

  saveSighting(sightingData) {
    const sightings = this.getSightings();
    const existingIndex = sightings.findIndex(s => s.id === sightingData.id);
    const isNew = existingIndex < 0 || !this.isDbId(sightingData.id);
    if (existingIndex >= 0) {
      sightings[existingIndex] = { ...sightings[existingIndex], ...sightingData, lastUpdated: new Date().toISOString() };
      this.logAction('Updated Found Report', `Updated report ${sightingData.id} (${sightingData.species || 'Pet'} found at ${sightingData.location || 'Unknown'})`);
    } else {
      sightingData.id = sightingData.id || 'SIGHT-' + Date.now().toString().slice(-6);
      sightingData.timestamp = sightingData.timestamp || new Date().toISOString();
      sightingData.reportType = sightingData.reportType || 'found';
      sightings.unshift(sightingData);
      this.logAction('Created Found Report', `Logged report for ${sightingData.species || 'Pet'} at ${sightingData.location || 'Unknown'}`);
    }
    localStorage.setItem(STORAGE_KEYS.SIGHTINGS, JSON.stringify(sightings));
    this.notify('sightings_updated');

    const coords = Array.isArray(sightingData.coords) ? sightingData.coords : [sightingData.lat, sightingData.lng];
    if (!Number.isFinite(+coords[0]) || !Number.isFinite(+coords[1])) {
      this.dbError('Could not save the report', { message: 'it needs a map location' });
      return sightingData;
    }
    const statuses = ['possible_sighting', 'confirmed_sighting', 'dismissed', 'archived'];
    const row = {
      missing_pet_id: this.isDbId(sightingData.missing_report_id) ? sightingData.missing_report_id : null,
      species: ['Dog', 'Cat', 'Other'].includes(sightingData.species) ? sightingData.species : 'Other',
      breed: sightingData.breed || null,
      color: sightingData.color || null,
      photo_url: /^https:\/\//.test(sightingData.photoUrl || '') ? sightingData.photoUrl : null,
      location: String(sightingData.location || 'Pinned location').slice(0, 300),
      lat: +coords[0],
      lng: +coords[1],
      seen_at: new Date(sightingData.dateTimeSeen || sightingData.timestamp || Date.now()).toISOString(),
      notes: String(sightingData.comments || sightingData.notes || '').slice(0, 1000) || null,
      reporter_name: String(sightingData.reporterName || 'Community Good Samaritan').slice(0, 80),
      status: statuses.includes(sightingData.status) ? sightingData.status : 'possible_sighting'
    };
    this.write('Could not save the report', (sb) => (
      isNew ? sb.from('community_sightings').insert(row) : sb.from('community_sightings').update(row).eq('id', sightingData.id)
    ));
    return sightingData;
  }

  deleteSighting(sightingId) {
    const target = this.getSightings().find(s => s.id === sightingId);
    if (!target) return false;
    localStorage.setItem(STORAGE_KEYS.SIGHTINGS, JSON.stringify(this.getSightings().filter(s => s.id !== sightingId)));
    if (this.isDbId(sightingId)) this.write('Could not delete the report', (sb) => sb.from('community_sightings').delete().eq('id', sightingId));
    this.logAction('Deleted Found Report', `Removed report ${target.id} (${target.species} found at ${target.location || 'Unknown'})`);
    this.notify('sightings_deleted');
    return true;
  }

  // --- Backup, Export & Reset ---
  exportDatabaseJSON() {
    const data = {
      exportTimestamp: new Date().toISOString(),
      schemaVersion: '6.0-supabase',
      pets: this.getPets(),
      cases: this.getCases(),
      impoundments: this.getImpoundments(),
      shelters: this.getShelters(),
      notifications: this.getNotifications(),
      rfidTags: this.getRfidTags(),
      sightings: this.getSightings(),
      settings: this.getSettings(),
      logs: this.getLogs()
    };
    return JSON.stringify(data, null, 2);
  }

  // Bulk restores would overwrite the shared Supabase database, so only this device's settings and audit log
  // are restored from a bundle; the records themselves are managed in Supabase.
  importDatabaseJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      if (data.logs) localStorage.setItem(STORAGE_KEYS.ADMIN_LOGS, JSON.stringify(data.logs));
      this.logAction('Restored Settings', 'Imported settings and audit log from a bundle (records live in Supabase).');
      this.notify('database_restored');
      return true;
    } catch (err) {
      console.error('Import failed', err);
      return false;
    }
  }

  // Clears this device's cached copy and settings, then reloads everything from Supabase. Nothing in the
  // database is deleted.
  resetToDefaults() {
    [STORAGE_KEYS.PETS, STORAGE_KEYS.IMPOUNDMENTS, STORAGE_KEYS.NOTIFICATIONS, STORAGE_KEYS.SHELTERS,
      STORAGE_KEYS.RFID_TAGS, STORAGE_KEYS.SIGHTINGS, STORAGE_KEYS.CASES].forEach((key) => localStorage.setItem(key, '[]'));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(SEED_SETTINGS));
    this.logAction('Reset Console', 'Cleared this device\'s cached data and settings; reloading from Supabase.');
    this.notify('factory_reset');
    this.syncFromSupabase();
  }
}

// Global Store Instance
if (typeof window !== 'undefined') {
  window.adminStore = new AdminStore();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminStore;
}
