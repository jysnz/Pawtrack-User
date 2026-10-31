/**
 * PawTrack store. Supabase is the database: lists are read from it into a local cache the views read from,
 * and every change is written to it (see "Supabase: the only database" below).
 */

// Shown when a pet or report has no photo, so templates never render src="undefined"
window.PET_PHOTO_PLACEHOLDER = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80';

const STORAGE_KEYS = {
  PETS: 'pawtrack_pets',
  IMPOUNDMENTS: 'pawtrack_impoundments',
  NOTIFICATIONS: 'pawtrack_notifications',
  SHELTERS: 'pawtrack_shelters',
  CURRENT_USER: 'pawtrack_current_user',
  THEME: 'pawtrack_theme',
  GOOGLE_AUTH: 'pawtrack_google_auth',
  NFC_TAGS: 'pawtrack_nfc_tags',
  SETTINGS: 'pawtrack_system_settings',
  SIGHTINGS: 'pawtrack_sightings',
  CASES: 'pawtrack_cases',
  MISSING_REPORTS: 'pawtrack_missing_reports',
  LOCAL_NOTIFICATIONS: 'pawtrack_local_notifications'
};

// Bumped when the cached lists change meaning; older caches are cleared on load (v1: Supabase replaces the
// local JSON database, whose ids and records do not exist in Supabase)
const DATA_SOURCE_VERSION = 'supabase-v1';

const SEED_SHELTERS = [
  {
    id: 'sh-1',
    name: 'Quezon City Animal Care & Adoption Facility',
    address: 'Clemente St., Lupang Pangako, Payatas, Quezon City',
    phone: '+63 (2) 8988-4242 loc 8036',
    email: 'animalcare@quezoncity.gov.ph',
    hours: 'Mon - Fri: 8:00 AM - 5:00 PM',
    lat: 14.7118,
    lng: 121.1037,
    fee: 'PHP 500 / day',
    holdingPeriodDays: 3,
    photoUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'sh-2',
    name: 'Manila City Pound & Veterinary Inspection Board',
    address: 'Vitas St., Tondo, Manila, Metro Manila',
    phone: '+63 (2) 8243-7952',
    email: 'vib@manila.gov.ph',
    hours: 'Mon - Sat: 8:00 AM - 4:00 PM',
    lat: 14.6231,
    lng: 120.9634,
    fee: 'PHP 350 / day',
    holdingPeriodDays: 3,
    photoUrl: 'https://images.unsplash.com/photo-1587764379873-97837921fd44?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'sh-3',
    name: 'Pasig City Animal Welfare Facility',
    address: 'Caruncho Ave., San Nicolas, Pasig City',
    phone: '+63 (2) 8643-1111',
    email: 'animalwelfare@pasigcity.gov.ph',
    hours: 'Mon - Fri: 8:00 AM - 5:00 PM',
    lat: 14.5583,
    lng: 121.0825,
    fee: 'PHP 400 / day',
    holdingPeriodDays: 3,
    photoUrl: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=600&q=80'
  }
];

// Demo data shipped by earlier versions (pets, one missing report, sightings, an alert). Never kept or accepted from a sync.
const isDemoRecord = (x) => {
  if (!x || typeof x !== 'object') return false;
  return ['id', 'petId', 'matchedPetId', 'missing_report_id', 'missingReportId', 'sightingId'].some((k) => {
    const v = x[k];
    return typeof v === 'string' && (v.startsWith('pet-seed-') || v === 'mr-2026-001' || /^sight-2026-00\d$/.test(v) || v === 'notif-sight-review-01');
  });
};

const SEED_PETS = []; // no demo records: pets, reports and sightings come from real registrations

const SEED_MISSING_REPORTS = []; // no demo records: pets, reports and sightings come from real registrations

const SEED_SIGHTINGS = []; // no demo records: pets, reports and sightings come from real registrations

const SEED_NOTIFICATIONS = []; // no demo records: pets, reports and sightings come from real registrations

class Store {
  constructor() {
    this.listeners = [];
    this.broadcastChannel = null;
    this.syncStatus = 'connecting';
    this.init();
    this.initBroadcastBus();
    this.startSupabaseSync();
  }

  // Brings data saved before the RFID -> NFC rename up to date (field names, tag prefixes, storage key)
  migrateLegacyNfcData() {
    try {
      const legacyTags = localStorage.getItem('pawtrack_rfid_tags');
      if (legacyTags !== null) {
        if (localStorage.getItem(STORAGE_KEYS.NFC_TAGS) === null) localStorage.setItem(STORAGE_KEYS.NFC_TAGS, legacyTags);
        localStorage.removeItem('pawtrack_rfid_tags');
      }
      [STORAGE_KEYS.PETS, STORAGE_KEYS.IMPOUNDMENTS, STORAGE_KEYS.NOTIFICATIONS, STORAGE_KEYS.SIGHTINGS,
        STORAGE_KEYS.CASES, STORAGE_KEYS.MISSING_REPORTS, STORAGE_KEYS.NFC_TAGS].forEach(key => {
        const raw = localStorage.getItem(key);
        if (!raw || !/rfid/i.test(raw)) return;
        localStorage.setItem(key, JSON.stringify(window.migrateLegacyNfc(JSON.parse(raw))));
      });
    } catch (e) {
      console.warn('[Store] Could not migrate legacy RFID data:', e);
    }
  }

  // Earlier versions saved demo pets, a missing report, sightings and an alert into every browser
  purgeDemoRecords() {
    try {
      [STORAGE_KEYS.PETS, STORAGE_KEYS.MISSING_REPORTS, STORAGE_KEYS.SIGHTINGS, STORAGE_KEYS.NOTIFICATIONS, STORAGE_KEYS.CASES].forEach((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return;
        const kept = list.filter((x) => !isDemoRecord(x));
        if (kept.length !== list.length) localStorage.setItem(key, JSON.stringify(kept));
      });
    } catch (e) {
      console.warn('[Store] Could not remove demo records:', e);
    }
  }

  init() {
    // Lists cached from the old local JSON database are cleared once; Supabase fills them again
    if (localStorage.getItem('pawtrack_data_source') !== DATA_SOURCE_VERSION) {
      [STORAGE_KEYS.PETS, STORAGE_KEYS.IMPOUNDMENTS, STORAGE_KEYS.NOTIFICATIONS, STORAGE_KEYS.SHELTERS,
        STORAGE_KEYS.NFC_TAGS, STORAGE_KEYS.SIGHTINGS, STORAGE_KEYS.CASES, STORAGE_KEYS.MISSING_REPORTS,
        STORAGE_KEYS.LOCAL_NOTIFICATIONS].forEach((key) => localStorage.removeItem(key));
      localStorage.setItem('pawtrack_data_source', DATA_SOURCE_VERSION);
    }
    this.migrateLegacyNfcData();
    this.purgeDemoRecords();
    if (localStorage.getItem(STORAGE_KEYS.PETS) === null) {
      localStorage.setItem(STORAGE_KEYS.PETS, JSON.stringify(SEED_PETS));
    }
    if (localStorage.getItem(STORAGE_KEYS.IMPOUNDMENTS) === null) {
      localStorage.setItem(STORAGE_KEYS.IMPOUNDMENTS, JSON.stringify([]));
    }
    if (localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) === null) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(SEED_NOTIFICATIONS));
    }
    if (localStorage.getItem(STORAGE_KEYS.SIGHTINGS) === null) {
      localStorage.setItem(STORAGE_KEYS.SIGHTINGS, JSON.stringify(SEED_SIGHTINGS));
    }
    if (localStorage.getItem(STORAGE_KEYS.CASES) === null) {
      localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify([]));
    }
    if (localStorage.getItem(STORAGE_KEYS.MISSING_REPORTS) === null) {
      localStorage.setItem(STORAGE_KEYS.MISSING_REPORTS, JSON.stringify(SEED_MISSING_REPORTS));
    }
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
    } catch (e) {}

    window.addEventListener('storage', (e) => {
      if (Object.values(STORAGE_KEYS).includes(e.key)) {
        this.notify('cross_tab_sync');
      }
    });
  }

  handleIncomingBroadcast(data) {
    if (data.type === 'mutation' || data.type === 'state_push') {
      this.syncFromSupabase();
    }
  }

  // ---------- Supabase: the only database ----------
  // Everything the views show is read from Supabase into a local cache (the STORAGE_KEYS lists), so the views can
  // keep reading synchronously. Every change is written to Supabase, then the cache is refreshed. Only the theme,
  // the signed-in profile, cases and alerts this device raised for itself stay on the device.

  client() {
    return (window.pawApp && window.pawApp.supabase) || null;
  }

  // pawApp (which creates the Supabase client) is built after the store
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

  // Loads the public lists (missing reports, sightings, shelters, impounds) and, when signed in, the guardian's own
  // pets and notifications. A list whose request fails keeps its previous copy.
  syncFromSupabase() {
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      const sb = await this.waitForClient();
      if (!sb) { this.syncStatus = 'offline'; return false; }
      const user = this.getGoogleUser();
      const signedIn = !!(user && user.id);
      const none = Promise.resolve({ data: [] });
      const [reports, sightings, shelters, impounded, pets, notifs] = await Promise.all([
        sb.from('missing_pets').select('*').in('status', ['missing', 'sighted']).order('last_seen_at', { ascending: false }),
        sb.from('community_sightings').select('*').order('created_at', { ascending: false }).limit(500),
        sb.from('shelters').select('*').order('name'),
        sb.from('impounded_pets').select('*').order('intake_at', { ascending: false }).limit(200),
        signedIn ? sb.from('registered_pets').select('*').order('created_at') : none,
        signedIn ? sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100) : none
      ].map((p) => Promise.resolve(p).catch((error) => ({ error }))));

      let changed = false;
      const put = (key, list) => {
        const next = JSON.stringify(list);
        if (localStorage.getItem(key) === next) return;
        localStorage.setItem(key, next);
        changed = true;
      };
      const warn = (what, res) => { if (res && res.error) console.warn(`[Store] Could not load ${what}:`, res.error.message || res.error); };
      [['missing reports', reports], ['sightings', sightings], ['shelters', shelters], ['impounds', impounded], ['pets', pets], ['notifications', notifs]].forEach(([w, r]) => warn(w, r));

      const reportList = reports.error ? this.getMissingReports() : (reports.data || []).map((r) => this.fromReportRow(r));
      if (!reports.error) put(STORAGE_KEYS.MISSING_REPORTS, reportList);
      if (!sightings.error) put(STORAGE_KEYS.SIGHTINGS, (sightings.data || []).map((s) => this.fromSightingRow(s)));
      const shelterList = shelters.error ? this.getShelters() : (shelters.data || []).map((s) => this.fromShelterRow(s));
      if (!shelters.error) put(STORAGE_KEYS.SHELTERS, shelterList);
      if (!impounded.error) put(STORAGE_KEYS.IMPOUNDMENTS, (impounded.data || []).map((i) => this.fromImpoundRow(i, shelterList)));
      if (!pets.error) put(STORAGE_KEYS.PETS, (pets.data || []).map((p) => this.fromPetRow(p, reportList)));
      if (!notifs.error) {
        const before = new Set(this.getNotifications().map((n) => n.id));
        const list = (notifs.data || []).map((n) => this.fromNotificationRow(n));
        put(STORAGE_KEYS.NOTIFICATIONS, list);
        // A new unread alert (a finder found or saw the pet) pops up, except on the first load after signing in
        const fresh = list.filter((n) => !n.read && !before.has(n.id));
        const uid = signedIn ? user.id : null;
        if (uid && this.notifsLoadedFor === uid && fresh.length && window.notifManager) window.notifManager.showToast(fresh[0].title, 'success', 7000);
        this.notifsLoadedFor = uid;
      }

      this.syncStatus = 'connected';
      if (changed) this.notify('supabase_sync');
      return true;
    })().finally(() => { this.syncing = null; });
    return this.syncing;
  }

  isDbId(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
  }

  // ----- rows from Supabase, in the shapes the views use -----

  fromReportRow(r) {
    return {
      id: r.id,
      petId: r.pet_id || null,
      petName: r.pet_name,
      species: r.species,
      breed: r.breed || '',
      gender: r.gender || '',
      color: r.color || '',
      photoUrl: r.photo_url || '',
      photo: r.photo_url || '',
      description: r.description || '',
      community: r.community || '',
      lastSeenLocation: r.last_seen_location,
      lastSeenCoords: [r.lat, r.lng],
      lastSeenDate: r.last_seen_at,
      notes: r.notes || '',
      status: 'active', // only open reports (missing or sighted) are loaded
      dbStatus: r.status,
      reportedByOwner: r.reported_by_owner !== false,
      reporterId: r.reporter_id,
      createdAt: r.created_at
    };
  }

  fromPetRow(p, reports) {
    const open = (reports || []).find((r) => r.petId === p.id);
    return {
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed || '',
      gender: p.gender || '',
      color: p.color || '',
      status: p.status === 'missing' ? 'lost' : (p.status || 'safe'),
      nfcTag: p.nfc_tag || '',
      photoUrl: p.photo_url || '',
      photo: p.photo_url || '',
      description: p.description || '',
      ageMonths: p.age_months,
      community: p.community || '',
      registeredDate: p.registered_on,
      owner: { name: p.owner_name || '', phone: p.owner_phone || '', email: p.owner_email || '' },
      ownerId: p.owner_id,
      ownerPhone: p.owner_phone || '',
      ...(open ? {
        missingReportId: open.id,
        lastSeenLocation: open.lastSeenLocation,
        lastSeenCoords: open.lastSeenCoords,
        lastSeenDate: open.lastSeenDate
      } : {})
    };
  }

  fromSightingRow(s) {
    return {
      id: s.id,
      missing_report_id: s.missing_pet_id || null,
      species: s.species || '',
      breed: s.breed || '',
      color: s.color || '',
      location: s.location,
      lat: s.lat,
      lng: s.lng,
      coords: [s.lat, s.lng],
      dateTimeSeen: s.seen_at,
      createdAt: s.created_at,
      comments: s.notes || '',
      notes: s.notes || '',
      photoUrl: s.photo_url || '',
      photo: s.photo_url || '',
      reporterName: s.reporter_name || '',
      confidenceScore: s.confidence_score,
      status: s.status || 'possible_sighting'
    };
  }

  fromShelterRow(s) {
    return {
      id: s.id,
      name: s.name,
      address: s.address,
      phone: s.phone || '',
      email: s.email || '',
      hours: s.hours || '',
      lat: s.lat,
      lng: s.lng,
      fee: s.daily_fee_php != null ? `PHP ${s.daily_fee_php} / day` : '',
      holdingPeriodDays: s.holding_period_days,
      photoUrl: s.photo_url || ''
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
      nfcTag: i.nfc_tag || '',
      kennel: i.kennel || '',
      impoundLocation: i.impound_location || '',
      healthCondition: i.health_condition || '',
      shelterId: i.shelter_id,
      shelterName: shelter ? shelter.name : 'Animal facility',
      intakeDate: i.intake_at,
      claimDeadline: i.claim_deadline,
      status: i.status === 'in_holding' ? 'active_impounded' : i.status
    };
  }

  // Supabase notifications are already only the signed-in guardian's (row level security)
  fromNotificationRow(n) {
    const message = n.message || '';
    const found = n.type === 'sighting_verification' && !/^POSSIBLE SIGHTING/i.test(n.title || '');
    const pet = this.getPets().find((p) => p.name === n.pet_name);
    const report = this.getMissingReports().find((r) => r.petName === n.pet_name);
    return {
      id: 'sb-' + n.id,
      dbId: n.id,
      type: found ? 'pet_found_match' : n.type,
      title: n.title,
      message,
      petName: n.pet_name,
      petId: pet ? pet.id : undefined,
      missingReportId: report ? report.id : undefined,
      location: n.location || '',
      finderName: 'Community Good Samaritan',
      finderPhone: (message.match(/Finder phone: ([^.]+)/) || [])[1] || '',
      finderNotes: (message.match(/Message: "([^"]*)"/) || [])[1] || '',
      timestamp: n.created_at,
      read: !!n.is_read
    };
  }

  // Photos go to the public sighting-photos bucket; rows only keep the link (https URLs pass through)
  async uploadPhoto(photo, folder) {
    const value = String(photo || '');
    if (/^https:\/\//.test(value)) return value;
    if (!value.startsWith('data:')) return null;
    const sb = this.client();
    if (!sb) return null;
    try {
      const blob = await this.shrinkPhoto(value);
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await sb.storage.from('sighting-photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      return sb.storage.from('sighting-photos').getPublicUrl(path).data.publicUrl;
    } catch (e) {
      console.warn('[Store] Photo upload failed:', e.message || e);
      return null;
    }
  }

  // Phone photos are several megabytes: stored as a JPEG of at most 1280px on the long side
  shrinkPhoto(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image conversion failed'))), 'image/jpeg', 0.82);
      };
      img.onerror = () => reject(new Error('Could not read the photo'));
      img.src = dataUrl;
    });
  }

  // Shows a database error to the person, once per action
  dbError(what, error) {
    console.warn(`[Store] ${what}:`, error && (error.message || error));
    if (window.notifManager) window.notifManager.showToast(`${what}: ${(error && error.message) || 'please try again.'}`, 'error', 5000);
  }

  // Kept so older callers still work: there is no separate sync step any more
  syncToBackend() {}
  pushBackendMutation() {}
  syncFromBackend() { return this.syncFromSupabase(); }

  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  }

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    this.notify('theme_change');
  }

  getGoogleUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.GOOGLE_AUTH)) || null;
    } catch {
      return null;
    }
  }

  setGoogleUser(user) {
    const before = (this.getGoogleUser() || {}).id;
    if (before !== (user && user.id)) setTimeout(() => this.syncFromSupabase(), 0);
    if (user) {
      localStorage.setItem(STORAGE_KEYS.GOOGLE_AUTH, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.GOOGLE_AUTH);
    }
    this.notify('auth_change');
  }

  isLoggedIn() {
    return !!this.getGoogleUser();
  }

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

  getPetByNFC(nfcTag) {
    if (!nfcTag) return null;
    const cleanTag = window.normalizeNfcCode(nfcTag);
    return this.getPets().find(p => window.normalizeNfcCode(p.nfcTag) === cleanTag);
  }

  // Pets are registered and edited in Supabase by the Pets page (nfc-link.js, pets-view.js); this only keeps
  // the cached copy in step until the next sync.
  savePet(pet) {
    const pets = this.getPets();
    const existingIndex = pets.findIndex(p => p.id === pet.id);

    if (existingIndex >= 0) {
      pets[existingIndex] = { ...pets[existingIndex], ...pet, updatedAt: new Date().toISOString() };
    } else {
      if (!pet.name) return pet; // a partial update for a pet that is not cached here must not create a nameless pet
      const newPet = {
        ...pet,
        id: pet.id || 'pet-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        status: pet.status || 'safe',
        registeredDate: pet.registeredDate || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      };
      pets.push(newPet);
      pet = newPet;
    }

    localStorage.setItem(STORAGE_KEYS.PETS, JSON.stringify(pets));
    this.notify('pets_updated');
    return pet;
  }

  deletePet(id) {
    const pets = this.getPets().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PETS, JSON.stringify(pets));
    this.notify('pets_updated');
  }

  // Status of a registered pet ('lost' here is 'missing' in the database). 'safe' also closes its open reports.
  async updatePetStatus(petId, status, extraData = {}) {
    const pets = this.getPets();
    const pet = pets.find(p => p.id === petId);
    if (pet) {
      pet.status = status;
      Object.assign(pet, extraData);
      pet.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.PETS, JSON.stringify(pets));
      this.notify('pet_status_changed');
    }
    if (status === 'safe') {
      this.resolveCasesForPet(petId);
      this.getMissingReports()
        .filter(r => r.petId === petId && r.status === 'active')
        .forEach(r => this.updateMissingReport(r.id, { status: 'resolved', resolvedAt: new Date().toISOString() }));
    }

    const sb = this.client();
    if (!sb || !this.isDbId(petId)) return;
    const dbStatus = { lost: 'missing', missing: 'missing', safe: 'safe', impounded: 'impounded', reunited: 'reunited' }[status];
    if (!dbStatus) return;
    const { error } = await sb.from('registered_pets').update({ status: dbStatus }).eq('id', petId);
    if (error) this.dbError('Could not save the pet\'s status', error);
  }

  // Cases are a device-only timeline (the admin portal builds its own from reports and sightings)
  resolveCasesForPet(petId, { missingReportId, nfcTag } = {}) {
    this.getCases()
      .filter(c => c.status !== 'reunited' && (
        c.petId === petId ||
        (missingReportId && c.missingReportId === missingReportId) ||
        (nfcTag && c.nfcTag === nfcTag)
      ))
      .forEach(c => {
        this.saveCase({
          ...c,
          status: 'reunited',
          timeline: [
            {
              timestamp: new Date().toISOString(),
              type: 'reunited',
              title: 'Pet Reunited & Safe at Home',
              location: 'Home / Safe',
              notes: 'Guardian confirmed pet is safely recovered.'
            },
            ...(Array.isArray(c.timeline) ? c.timeline : [])
          ]
        });
      });
  }

  getImpoundments() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.IMPOUNDMENTS)) || [];
    } catch {
      return [];
    }
  }

  getActiveImpoundmentForPet(petId) {
    const impoundments = this.getImpoundments();
    return impoundments.find(i => i.petId === petId && (i.status === 'active_impounded' || i.status === 'active'));
  }

  // Impounds are recorded by shelters in the admin portal; guardians only read them
  createImpoundment(impoundment) {
    return this.addImpoundment(impoundment);
  }

  addImpoundment(impoundment) {
    console.warn('[Store] Impounds are recorded in the admin portal, not here:', impoundment && impoundment.petName);
    return null;
  }

  // A guardian claims at the shelter; the shelter closes the impound in the admin portal. Here the pet is shown as
  // safe right away so the guardian is not left looking at an impound alert.
  claimImpoundment(impoundId) {
    const impound = this.getImpoundments().find(i => i.id === impoundId);
    if (impound && impound.petId) this.updatePetStatus(impound.petId, 'safe');
    this.notify('impoundment_claimed');
  }

  getShelters() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHELTERS));
      return Array.isArray(list) && list.length ? list : SEED_SHELTERS;
    } catch {
      return SEED_SHELTERS;
    }
  }

  // Supabase notifications (the signed-in guardian's) followed by alerts this device raised for itself
  getNotifications() {
    const read = (key) => {
      try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
    };
    return [...read(STORAGE_KEYS.NOTIFICATIONS), ...read(STORAGE_KEYS.LOCAL_NOTIFICATIONS)]
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }

  // What the signed-in guardian sees: their Supabase notifications, and device alerts about their own pets.
  // "Pet is missing" alerts are not shown (none are created any more).
  getMyNotifications() {
    const user = this.getGoogleUser();
    if (!user || !user.email) return [];
    const missingAlert = (n) => n.type === 'missing' || (n.type === 'broadcast' && /missing pet alert/i.test(n.title || ''));
    const myReports = new Set(this.getMissingReports().filter(r => this.isMyPet(this.reportAsPet(r))).map(r => String(r.id)));
    return this.getNotifications().filter(n => !missingAlert(n)).filter(n =>
      String(n.id).startsWith('sb-') ||
      (n.petId && this.isMyPet(this.getPetById(n.petId))) ||
      (n.missingReportId && myReports.has(String(n.missingReportId)))
    );
  }

  // A device-only alert (other people are notified through Supabase, see notifyReporter)
  addNotification(notif) {
    let list;
    try { list = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_NOTIFICATIONS)) || []; } catch { list = []; }
    list.unshift({ ...notif, id: notif.id || 'notif-' + Date.now(), timestamp: new Date().toISOString(), read: false });
    localStorage.setItem(STORAGE_KEYS.LOCAL_NOTIFICATIONS, JSON.stringify(list.slice(0, 50)));
    this.notify('notification_added');
  }

  markNotificationRead(notifId) {
    const id = String(notifId);
    const key = id.startsWith('sb-') ? STORAGE_KEYS.NOTIFICATIONS : STORAGE_KEYS.LOCAL_NOTIFICATIONS;
    let list;
    try { list = JSON.parse(localStorage.getItem(key)) || []; } catch { list = []; }
    const notif = list.find(n => String(n.id) === id);
    if (!notif || notif.read) return;
    notif.read = true;
    localStorage.setItem(key, JSON.stringify(list));
    this.notify('notification_read');
    const sb = this.client();
    if (sb && notif.dbId) sb.from('notifications').update({ is_read: true }).eq('id', notif.dbId).then(({ error }) => { if (error) console.warn('[Store] mark read:', error.message); });
  }

  markAllNotificationsRead() {
    [STORAGE_KEYS.NOTIFICATIONS, STORAGE_KEYS.LOCAL_NOTIFICATIONS].forEach((key) => {
      let list;
      try { list = JSON.parse(localStorage.getItem(key)) || []; } catch { list = []; }
      list.forEach(n => { n.read = true; });
      localStorage.setItem(key, JSON.stringify(list));
    });
    this.notify('notifications_read');
    const sb = this.client();
    if (sb && this.getGoogleUser()) sb.from('notifications').update({ is_read: true }).eq('is_read', false).then(({ error }) => { if (error) console.warn('[Store] mark all read:', error.message); });
  }

  // Alerts whoever reported a missing pet: kind 'found' (Found a Pet) or 'sighting' ("Seen this pet?").
  // Works for signed-out finders; the database never hands out the reporter's details.
  async notifyReporter(missingReportId, kind, { phone, location, notes } = {}) {
    const sb = await this.waitForClient(5000);
    if (!sb || !this.isDbId(missingReportId)) return false;
    const { data, error } = await sb.rpc('notify_missing_pet_reporter', {
      p_missing_pet_id: missingReportId,
      p_kind: kind,
      p_phone: String(phone || '').trim(),
      p_location: String(location || '').trim().slice(0, 300),
      p_notes: notes ? String(notes).slice(0, 1000) : null
    });
    if (error) { this.dbError('Could not alert the owner', error); return false; }
    return !!data;
  }

  getSightings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SIGHTINGS)) || [];
    } catch {
      return [];
    }
  }

  // Shown at once, saved to community_sightings (with its photo), then replaced by the saved row on the next sync
  addSighting(sighting) {
    const sightings = this.getSightings();
    const newSighting = {
      ...sighting,
      id: sighting.id || 'sight-' + Date.now(),
      createdAt: sighting.createdAt || new Date().toISOString(),
      status: 'possible_sighting'
    };
    sightings.unshift(newSighting);
    localStorage.setItem(STORAGE_KEYS.SIGHTINGS, JSON.stringify(sightings));
    this.notify('sighting_added');
    this.saveSightingRow(newSighting);
    return newSighting;
  }

  async saveSightingRow(s) {
    const sb = await this.waitForClient(5000);
    const coords = Array.isArray(s.coords) ? s.coords : [s.lat, s.lng];
    if (!sb || !Number.isFinite(+coords[0]) || !Number.isFinite(+coords[1])) return;
    const reportId = [s.missing_report_id, s.missingReportId, s.matchedReportId].find((id) => this.isDbId(id)) || null;
    const photoUrl = await this.uploadPhoto(s.photoUrl || s.photo, 'sightings');
    const { error } = await sb.from('community_sightings').insert({
      missing_pet_id: reportId,
      species: ['Dog', 'Cat', 'Other'].includes(s.species) ? s.species : 'Other',
      breed: s.breed || null,
      color: s.color || null,
      photo_url: photoUrl,
      location: String(s.location || 'Pinned location').slice(0, 300),
      lat: +coords[0],
      lng: +coords[1],
      seen_at: new Date(s.dateTimeSeen || s.timestamp || s.createdAt || Date.now()).toISOString(),
      notes: String(s.comments || s.notes || '').slice(0, 1000) || null,
      reporter_name: String(s.reporterName || 'Anonymous').slice(0, 80),
      status: 'possible_sighting'
    });
    if (error) {
      if (/rate limit/i.test(error.message)) {
        if (window.notifManager) window.notifManager.showToast('You have sent several sightings recently, so this one was not added to the public map. The owner was still alerted.', 'warning', 6000);
      } else {
        this.dbError('Could not save the sighting', error);
      }
      return;
    }
    this.syncFromSupabase();
  }

  getMissingReports() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.MISSING_REPORTS)) || [];
    } catch {
      return [];
    }
  }

  getMissingReportById(id) {
    if (!id) return null;
    return this.getMissingReports().find(r => r.id === id || r.petId === id);
  }

  getActiveMissingReportForPet(petId) {
    if (!petId) return null;
    return this.getMissingReports().find(r => r.petId === petId && r.status === 'active');
  }

  // A missing report in the shape of a pet, for the map, the missing list and the counts
  reportAsPet(r) {
    return {
      id: r.id,
      name: r.petName || 'Missing pet',
      species: r.species || 'Other',
      breed: r.breed || '',
      description: r.description || '', // what the reporter wrote: breed or mix, size, colours, collar
      gender: r.gender || '',
      color: r.description || r.color || '',
      status: 'lost',
      photoUrl: r.photoUrl || r.photo,
      photo: r.photo || r.photoUrl,
      lastSeenLocation: r.lastSeenLocation,
      lastSeenDate: r.lastSeenDate,
      lastSeenCoords: r.lastSeenCoords,
      community: r.community,
      notes: r.notes,
      missingReportId: r.id,
      registeredPetId: r.petId || null,
      reporterId: r.reporterId, // the person who reported it: finders notify them
      reportedByOwner: r.reportedByOwner !== false,
      unregistered: !r.petId, // reported through "Another pet"
      reportOnly: true
    };
  }

  // Open reports for pets that are not the guardian's own registered pets: other people's missing pets and
  // pets reported without registering. (The guardian's own registered pets come from getPets.)
  getUnregisteredMissingPets() {
    const mine = new Set(this.getPets().map(p => String(p.id)));
    return this.getMissingReports()
      .filter(r => r.status === 'active' && !mine.has(String(r.petId)))
      .map(r => this.reportAsPet(r));
  }

  // Whether the signed-in guardian owns this pet: their registered pet, or a report they filed
  isMyPet(pet) {
    const user = this.getGoogleUser();
    if (!user || !pet) return false;
    if (pet.reportOnly) return !!user.id && pet.reporterId === user.id;
    if (pet.ownerId && user.id) return pet.ownerId === user.id;
    return String((pet.owner && pet.owner.email) || '').toLowerCase() === String(user.email || '').toLowerCase();
  }

  // The guardian's own registered pets plus every other open missing report
  getMapPets() {
    return [...this.getPets(), ...this.getUnregisteredMissingPets()];
  }

  // Files a report in missing_pets (as the signed-in guardian). Returns the saved report, or null.
  async createMissingReport(reportData) {
    const sb = await this.waitForClient(5000);
    if (!sb) { this.dbError('Could not file the report', { message: 'no connection to the database' }); return null; }
    const petId = this.isDbId(reportData.petId) ? reportData.petId : null;
    const coords = reportData.lastSeenCoords || [];
    const photoUrl = await this.uploadPhoto(reportData.photoUrl || reportData.photo, 'reports');
    const { data, error } = await sb.from('missing_pets').insert({
      pet_id: petId,
      pet_name: String(reportData.petName || 'Missing pet').slice(0, 80),
      species: ['Dog', 'Cat', 'Other'].includes(reportData.species) ? reportData.species : 'Other',
      breed: reportData.breed || null,
      gender: ['Male', 'Female'].includes(reportData.gender) ? reportData.gender : null,
      color: reportData.color || null,
      photo_url: photoUrl,
      description: reportData.description ? String(reportData.description).slice(0, 1000) : null,
      community: reportData.community || null,
      last_seen_location: String(reportData.lastSeenLocation || '').slice(0, 300),
      lat: +coords[0],
      lng: +coords[1],
      last_seen_at: new Date(reportData.lastSeenDate || Date.now()).toISOString(),
      notes: reportData.notes ? String(reportData.notes).slice(0, 1000) : null,
      reported_by_owner: reportData.reportedByOwner !== false,
      status: 'missing'
    }).select('*').single();
    if (error) {
      this.dbError('Could not file the report', /one_open_per_pet/.test(error.message) ? { message: 'this pet already has an open missing report' } : error);
      return null;
    }

    const report = this.fromReportRow(data);
    localStorage.setItem(STORAGE_KEYS.MISSING_REPORTS, JSON.stringify([report, ...this.getMissingReports()]));
    if (petId) {
      await this.updatePetStatus(petId, 'lost', {
        lastSeenLocation: report.lastSeenLocation,
        lastSeenDate: report.lastSeenDate,
        lastSeenCoords: report.lastSeenCoords,
        missingReportId: report.id
      });
    }
    this.notify('missing_report_created');
    this.syncFromSupabase();
    return report;
  }

  // 'resolved' closes the report (database status 'found'); a closed report leaves the open list
  updateMissingReport(id, updates) {
    const reports = this.getMissingReports();
    const report = reports.find(r => r.id === id);
    if (!report) return null;
    const closing = updates.status === 'resolved';
    const next = closing ? reports.filter(r => r.id !== id) : reports.map(r => (r.id === id ? { ...r, ...updates } : r));
    localStorage.setItem(STORAGE_KEYS.MISSING_REPORTS, JSON.stringify(next));
    this.notify('missing_report_updated');

    const sb = this.client();
    if (sb && this.isDbId(id)) {
      const row = { updated_at: new Date().toISOString() };
      if (closing) row.status = 'found';
      if (updates.lastSeenLocation) row.last_seen_location = String(updates.lastSeenLocation).slice(0, 300);
      if (Array.isArray(updates.lastSeenCoords)) { row.lat = +updates.lastSeenCoords[0]; row.lng = +updates.lastSeenCoords[1]; }
      if (updates.notes !== undefined) row.notes = updates.notes ? String(updates.notes).slice(0, 1000) : null;
      sb.from('missing_pets').update(row).eq('id', id).then(({ error }) => {
        if (error) this.dbError('Could not update the report', error);
        else this.syncFromSupabase();
      });
    }
    return { ...report, ...updates };
  }

  getSightingsForMissingReport(missingReportId) {
    if (!missingReportId) return [];
    return this.getSightings().filter(s => s.missing_report_id === missingReportId || s.matchedPetId === missingReportId);
  }

  getSightingById(id) {
    if (!id) return null;
    return this.getSightings().find(s => s.id === id);
  }

  // The reporter of a missing pet reviews its sightings (the database allows only them, and admins)
  setSightingStatus(sightingId, status, eventName) {
    const sightings = this.getSightings();
    const s = sightings.find(item => item.id === sightingId);
    if (!s) return null;
    s.status = status;
    localStorage.setItem(STORAGE_KEYS.SIGHTINGS, JSON.stringify(sightings));
    this.notify(eventName);
    const sb = this.client();
    if (sb && this.isDbId(sightingId)) {
      sb.from('community_sightings').update({ status }).eq('id', sightingId).select('id').then(({ data, error }) => {
        if (error) this.dbError('Could not update the sighting', error);
        else if (!data || !data.length) this.dbError('Could not update the sighting', { message: 'only the person who reported this pet can review its sightings' });
      });
    }
    return s;
  }

  updateSighting(sightingId, updates) {
    if (updates && updates.status) return this.setSightingStatus(sightingId, updates.status, 'sighting_updated');
    const sightings = this.getSightings();
    const s = sightings.find(item => item.id === sightingId);
    if (!s) return null;
    Object.assign(s, updates);
    localStorage.setItem(STORAGE_KEYS.SIGHTINGS, JSON.stringify(sightings));
    this.notify('sighting_updated');
    return s;
  }

  confirmSighting(sightingId) {
    const s = this.setSightingStatus(sightingId, 'confirmed_sighting', 'sighting_confirmed');
    if (s && s.missing_report_id) {
      this.addCaseTimelineEvent(s.missing_report_id, {
        type: 'sighting',
        title: 'Guardian Confirmed Sighting Match',
        location: s.location || 'Metro Manila',
        finder: s.reporterName || 'Community Good Samaritan',
        notes: 'Owner visually verified photo and details. Status updated to Confirmed Sighting.',
        photoUrl: s.photoUrl || s.photo
      });
    }
    return s;
  }

  dismissSighting(sightingId) {
    return this.setSightingStatus(sightingId, 'dismissed', 'sighting_dismissed');
  }

  archiveSighting(sightingId) {
    return this.setSightingStatus(sightingId, 'archived', 'sighting_archived');
  }

  retrieveSighting(sightingId) {
    return this.setSightingStatus(sightingId, 'possible_sighting', 'sighting_updated');
  }

  // Sightings are not deleted from the database: the reporter archives them instead
  deleteSighting(sightingId) {
    const sightings = this.getSightings();
    if (!sightings.some(item => item.id === sightingId)) return false;
    this.setSightingStatus(sightingId, 'archived', 'sighting_deleted');
    localStorage.setItem(STORAGE_KEYS.SIGHTINGS, JSON.stringify(this.getSightings().filter(item => item.id !== sightingId)));
    this.notify('sighting_deleted');
    return true;
  }

  getCases() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CASES)) || [];
    } catch {
      return [];
    }
  }

  getCaseById(id) {
    return this.getCases().find(c => c.id === id || c.petId === id);
  }

  saveCase(caseData) {
    const cases = this.getCases();
    const idx = cases.findIndex(c => c.id === caseData.id);
    if (idx >= 0) {
      cases[idx] = { ...cases[idx], ...caseData, lastUpdated: new Date().toISOString() };
    } else {
      cases.unshift({
        ...caseData,
        id: caseData.id || 'CASE-' + new Date().getFullYear() + '-' + String(cases.length + 1).padStart(4, '0'),
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }
    localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(cases));
    this.notify('case_updated');
    return idx >= 0 ? cases[idx] : cases[0];
  }

  addCaseTimelineEvent(petIdOrCaseId, event) {
    const cases = this.getCases();
    // A pet reported without registering is found by its report id
    let petCase = cases.find(c => c.id === petIdOrCaseId || c.petId === petIdOrCaseId || c.missingReportId === petIdOrCaseId);
    if (!petCase) {
      const pet = this.getPetById(petIdOrCaseId);
      petCase = {
        id: 'CASE-' + new Date().getFullYear() + '-' + String(cases.length + 1).padStart(4, '0'),
        petId: pet ? pet.id : petIdOrCaseId,
        petName: pet ? pet.name : 'Unknown Pet',
        nfcTag: pet ? pet.nfcTag : null,
        status: event.type || 'missing',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        timeline: []
      };
      cases.unshift(petCase);
    }

    if (!Array.isArray(petCase.timeline)) petCase.timeline = [];
    petCase.timeline.unshift({
      timestamp: event.timestamp || new Date().toISOString(),
      type: event.type || 'status_update',
      title: event.title || 'Case Update',
      location: event.location || 'Metro Manila',
      officer: event.officer || null,
      finder: event.finder || null,
      notes: event.notes || '',
      photoUrl: event.photoUrl || null
    });
    petCase.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(cases));
    this.notify('case_timeline_added');
    return petCase;
  }

  verifyClaimDocuments(impoundId) {
    this.claimImpoundment(impoundId);
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * AI / Image-Based Pet Matching Engine (SkinWise-style multi-trait comparison)
   */
  runAiPetMatch(sighting, candidatePets = null) {
    const pets = candidatePets || this.getPets();
    if (!pets || pets.length === 0) return [];

    const results = pets.map(pet => {
      // 1. Species Match (20%)
      let speciesScore = 0;
      if (!sighting.species || !pet.species) {
        speciesScore = 70;
      } else if ((sighting.species || '').toLowerCase() === (pet.species || '').toLowerCase()) {
        speciesScore = 100;
      } else {
        speciesScore = 0; // completely different species (e.g. Dog vs Cat)
      }

      if (speciesScore === 0) {
        return { pet, confidenceScore: 0, traitBreakdown: null };
      }

      // 2. Color / Coat Pattern Match (25%)
      let colorScore = 45;
      const sColor = (sighting.color || sighting.breed || sighting.comments || '').toLowerCase();
      const pColor = ((pet.color || '') + ' ' + (pet.breed || '') + ' ' + (pet.medicalNotes || '') + ' ' + (pet.description || '')).toLowerCase();
      const colorKeywords = ['golden', 'brown', 'black', 'white', 'calico', 'orange', 'grey', 'gray', 'tan', 'brindle', 'spotted', 'tricolor', 'yellow', 'cream', 'chocolate', 'rust'];
      let matchedColors = 0;
      let totalPetColors = 0;
      colorKeywords.forEach(kw => {
        const inPet = pColor.includes(kw);
        const inSighting = sColor.includes(kw);
        if (inPet) totalPetColors++;
        if (inPet && inSighting) matchedColors++;
      });

      if (totalPetColors > 0) {
        colorScore = Math.min(100, Math.round((matchedColors / totalPetColors) * 60 + 40));
      } else if (sColor && pColor) {
        colorScore = 75;
      }

      // 3. Breed Silhouette Match (20%)
      let breedScore = 50;
      const sBreed = (sighting.breed || '').toLowerCase();
      const pBreed = (pet.breed || '').toLowerCase();
      if (sBreed && pBreed) {
        if (sBreed === pBreed) breedScore = 100;
        else if (sBreed.includes(pBreed) || pBreed.includes(sBreed)) breedScore = 92;
        else {
          const wordsS = sBreed.split(/\s+/);
          const wordsP = pBreed.split(/\s+/);
          const overlap = wordsS.filter(w => wordsP.includes(w) && w.length > 2);
          if (overlap.length > 0) breedScore = 80;
          else breedScore = 50;
        }
      }

      // 4. Distinctive Markings Match (15%)
      let markingsScore = 65;
      const sNotes = (sighting.comments || sighting.distinctMarkings || '').toLowerCase();
      const pNotes = ((pet.medicalNotes || '') + ' ' + (pet.color || '') + ' ' + (pet.description || '')).toLowerCase();
      const markTerms = ['collar', 'tag', 'patch', 'spots', 'ear', 'tail', 'socks', 'chest', 'scar', 'fluffy', 'short', 'white patch'];
      let marksMatched = 0;
      markTerms.forEach(term => {
        if (sNotes.includes(term) && pNotes.includes(term)) marksMatched++;
      });
      markingsScore = Math.min(100, 60 + marksMatched * 15);

      // 5. Geographic Proximity Match (10%)
      let proximityScore = 70;
      let distanceKm = null;
      if (sighting.lat && sighting.lng && pet.lastSeenLat && pet.lastSeenLng) {
        distanceKm = this.calculateDistance(sighting.lat, sighting.lng, pet.lastSeenLat, pet.lastSeenLng);
        if (distanceKm <= 1.0) proximityScore = 98;
        else if (distanceKm <= 3.0) proximityScore = 90;
        else if (distanceKm <= 7.0) proximityScore = 80;
        else if (distanceKm <= 15.0) proximityScore = 65;
        else proximityScore = 45;
      } else {
        const sLoc = (sighting.location || '').toLowerCase();
        const pLoc = (pet.lastSeenLocation || (pet.owner && pet.owner.address) || '').toLowerCase();
        if (sLoc && pLoc) {
          const words = sLoc.split(/[\s,]+/);
          const matched = words.filter(w => w.length > 3 && pLoc.includes(w));
          if (matched.length > 0) proximityScore = 94;
          else if (sLoc.includes('qc') || sLoc.includes('quezon') || sLoc.includes('manila') || sLoc.includes('pasig')) proximityScore = 82;
        }
      }

      // 6. Time Recency Match (10%)
      let recencyScore = 88;
      if (pet.lastSeenDate && sighting.dateTimeSeen) {
        const hoursDiff = Math.abs(new Date(sighting.dateTimeSeen) - new Date(pet.lastSeenDate)) / (1000 * 60 * 60);
        if (hoursDiff <= 24) recencyScore = 98;
        else if (hoursDiff <= 72) recencyScore = 90;
        else if (hoursDiff <= 168) recencyScore = 78;
        else recencyScore = 60;
      }

      // Overall weighted confidence score
      const overallScore = Math.round(
        (speciesScore * 0.20) +
        (colorScore * 0.25) +
        (breedScore * 0.20) +
        (markingsScore * 0.15) +
        (proximityScore * 0.10) +
        (recencyScore * 0.10)
      );

      return {
        pet,
        confidenceScore: overallScore,
        distanceKm: distanceKm ? distanceKm.toFixed(1) + ' km' : 'Within 2.5 km',
        traitBreakdown: {
          color: colorScore,
          breed: breedScore,
          markings: markingsScore,
          proximity: proximityScore,
          recency: recencyScore,
          species: speciesScore
        }
      };
    });

    return results
      .filter(r => r.confidenceScore >= 35)
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  getAnalyticsSummary() {
    const pets = this.getPets();
    const impoundments = this.getImpoundments();
    const sightings = this.getSightings();
    const cases = this.getCases();

    const totalRegistered = pets.length;
    const missingCount = pets.filter(p => p.status === 'lost').length;
    const sightedCount = sightings.length;
    const impoundedCount = impoundments.filter(i => i.status === 'active_impounded').length;
    const reunitedCount = pets.filter(p => p.status === 'reunited' || p.status === 'safe').length;
    // Share of cases that ended with the pet back home
    const reunitedCases = cases.filter(c => c.status === 'reunited' || c.status === 'safe');
    const recoveryRate = cases.length ? Math.round(reunitedCases.length / cases.length * 100) : 0;

    // Average time from opening a case to its reunion, in hours
    const spans = reunitedCases.map(c => {
      const done = (Array.isArray(c.timeline) ? c.timeline.find(e => e.type === 'reunited') : null);
      const end = new Date((done && done.timestamp) || c.lastUpdated);
      const start = new Date(c.createdAt);
      return (end - start) / 36e5;
    }).filter(h => Number.isFinite(h) && h >= 0);
    const avgHours = spans.length ? spans.reduce((n, h) => n + h, 0) / spans.length : null;

    // Share of registered pets that have an NFC tag linked
    const tagged = pets.filter(p => p.nfcTag).length;
    const nfcAdoption = totalRegistered ? Math.round(tagged / totalRegistered * 100) : 0;

    return {
      totalRegistered,
      missingCount,
      sightedCount,
      impoundedCount,
      reunitedCount,
      totalCases: cases.length,
      recoveryRate,
      avgRecoveryHours: avgHours === null ? null : Math.round(avgHours * 10) / 10,
      nfcScanAdoption: nfcAdoption,
      nfcTagged: tagged,
      nfcUntagged: totalRegistered - tagged
    };
  }

  // Areas ranked by the incidents reported there: missing-pet reports, community sightings and impound intakes.
  // The area is the last two parts of the address (for example "Diliman, Quezon City").
  getHotspotAreas(limit = 5) {
    const areaOf = (loc) => String(loc || '').split(',').map(x => x.trim())
      .filter(x => x && !/^(philippines|metro manila|ncr|national capital region)$/i.test(x))
      .slice(-2).join(', ');
    const groups = new Map();
    const seen = new Set();
    const add = (kind, id, loc, coords) => {
      const area = areaOf(loc);
      const key = `${kind}:${id}`;
      if (!area || (id && seen.has(key))) return; // the same report can be stored twice after a sync
      if (id) seen.add(key);
      if (!groups.has(area)) groups.set(area, { name: area, reports: 0, sightings: 0, impounds: 0, lat: 0, lng: 0, located: 0 });
      const g = groups.get(area);
      g[kind]++;
      if (Array.isArray(coords) && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) { g.lat += coords[0]; g.lng += coords[1]; g.located++; }
    };

    this.getMissingReports().forEach(r => add('reports', r.id, r.lastSeenLocation, r.lastSeenCoords));
    this.getSightings().filter(x => x.status !== 'dismissed').forEach(x => add('sightings', x.id, x.location, x.coords));
    this.getImpoundments().forEach(i => add('impounds', i.id, i.foundLocation || i.location, i.coords));

    const list = [...groups.values()].map(g => {
      const count = g.reports + g.sightings + g.impounds;
      const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
      const parts = [];
      if (g.reports) parts.push(plural(g.reports, 'missing report'));
      if (g.sightings) parts.push(plural(g.sightings, 'sighting'));
      if (g.impounds) parts.push(plural(g.impounds, 'impound'));
      return { name: g.name, count, risk: parts.join(' · '), coords: g.located ? [g.lat / g.located, g.lng / g.located] : null };
    }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);

    const max = list.length ? list[0].count : 1;
    return list.map(h => ({ ...h, percent: Math.round(h.count / max * 100) }));
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  notify(event) {
    this.listeners.forEach(fn => {
      try { fn(event); } catch (e) {}
    });
  }
}

window.pawStore = new Store();
