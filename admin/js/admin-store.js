/**
 * PawTrack Admin store. Supabase is the database: every list is read from it into a local cache the views read,
 * and every change is written to it (see "Supabase: the only database" below).
 */

const STORAGE_KEYS = {
  PETS: 'pawtrack_admin_pets',
  IMPOUNDMENTS: 'pawtrack_admin_impoundments',
  NOTIFICATIONS: 'pawtrack_admin_notifications',
  SHELTERS: 'pawtrack_admin_shelters',
  CURRENT_USER: 'pawtrack_current_user',
  THEME: 'pawtrack_theme',
  RFID_TAGS: 'pawtrack_admin_rfid_tags',
  ADMIN_LOGS: 'pawtrack_admin_logs',
  SETTINGS: 'pawtrack_system_settings',
  SIGHTINGS: 'pawtrack_admin_sightings',
  CASES: 'pawtrack_admin_cases',
  SHELTER_EXTRAS: 'pawtrack_shelter_extras',
  TICKETS: 'pawtrack_penalty_tickets',
  EXTRA_MAINS: 'pawtrack_extra_main_ids',
  CLAIMS: 'pawtrack_impound_claims',
  REHAB: 'pawtrack_rehab_cases'
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
        STORAGE_KEYS.RFID_TAGS, STORAGE_KEYS.SIGHTINGS, STORAGE_KEYS.CASES, STORAGE_KEYS.TICKETS, STORAGE_KEYS.REHAB].forEach((key) => localStorage.setItem(key, '[]'));
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

  // ---- Keeping the data current ----
  // 1. Realtime: the database pushes a change on the tables below, and we reload (about a second later).
  // 2. A safety-net poll: every 60s while Realtime is live, every 15s while it is not; backs off 15s, 30s, 60s
  //    after failures; skipped while the tab is hidden.
  // 3. Coming back to the tab reloads, but never more than once per 10s.
  // 4. Our own saves reload at once (see write()).
  // syncStatus tells the UI the truth: 'live' (Realtime), 'connected' (polling only), 'offline', 'connecting'.
  static get REALTIME_TABLES() { return ['impounded_pets', 'penalty_tickets', 'notifications', 'missing_pets', 'impound_claims']; }

  startSupabaseSync() {
    this.realtime = 'off';
    this.syncFailures = 0;
    this.realtimeDebounceMs = this.realtimeDebounceMs || 400;
    this.statusListeners = [];
    this._pollStarted = true;
    this.syncFromSupabase();
    this.schedulePoll();
    this.connectRealtime();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.syncIfStale(10000); });
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('online', () => this.syncFromSupabase());
      window.addEventListener('offline', () => this.setStatus('offline'));
    }
  }

  // Be told when the connection state changes (does not redraw pages, unlike subscribe)
  onStatus(fn) {
    this.statusListeners = this.statusListeners || [];
    this.statusListeners.push(fn);
    return () => { this.statusListeners = this.statusListeners.filter((x) => x !== fn); };
  }

  setStatus(next) {
    if (this.syncStatus === next) return;
    this.syncStatus = next;
    (this.statusListeners || []).forEach((fn) => { try { fn(next); } catch (e) { /* a listener must not break syncing */ } });
  }

  pollDelay() {
    if (this.syncFailures > 0) return [15000, 30000, 60000][Math.min(this.syncFailures - 1, 2)];
    return this.realtime === 'live' ? 60000 : 15000;
  }

  // One timer, restarted after every sync, so a poll never follows right behind a push-triggered load
  schedulePoll() {
    if (!this._pollStarted) return;
    clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => {
      if (!document.hidden) this.syncFromSupabase(); // syncFromSupabase schedules the next poll itself
      else this.schedulePoll();
    }, this.pollDelay());
    if (this.pollTimer && this.pollTimer.unref) this.pollTimer.unref(); // tests running in Node can exit
  }

  syncIfStale(maxAgeMs) {
    if (!this.lastSyncedAt || Date.now() - this.lastSyncedAt >= maxAgeMs) return this.syncFromSupabase();
    return Promise.resolve(true);
  }

  // A burst of changes (an intake touches several tables) becomes one reload; a change that lands while a
  // reload is running gets its own reload straight after
  queueSync() {
    clearTimeout(this._rtTimer);
    this._rtTimer = setTimeout(() => {
      if (this.syncing) this.syncing.then(() => this.syncFromSupabase());
      else this.syncFromSupabase();
    }, this.realtimeDebounceMs);
    if (this._rtTimer && this._rtTimer.unref) this._rtTimer.unref();
  }

  async connectRealtime() {
    if (this._rtStarting) return;
    this._rtStarting = true;
    const sb = await this.waitForClient();
    if (!sb || typeof sb.channel !== 'function' || this.rtChannel) {
      this._rtStarting = false;
      if (!sb && !this.rtChannel) setTimeout(() => this.connectRealtime(), 20000); // client was slow: try again
      return;
    }
    try {
      const channel = sb.channel('admin-live');
      AdminStore.REALTIME_TABLES.forEach((table) => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => this.queueSync());
      });
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.realtime = 'live';
          if (this.syncStatus === 'connected') this.setStatus('live');
          this.syncFromSupabase(); // anything that changed while the channel was connecting
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // supabase-js reconnects by itself and reports SUBSCRIBED again; until then the poll is quicker
          this.realtime = 'off';
          if (this.syncStatus === 'live') this.setStatus('connected');
          this.schedulePoll();
        }
      });
      this.rtChannel = channel;
    } catch (e) {
      console.warn('[AdminStore] Realtime is unavailable, using the timer only:', e && e.message);
    }
  }

  isDbId(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
  }

  syncFromSupabase() {
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      try {
        return await this.runSync();
      } catch (err) {
        // A full storage quota or one malformed row must not stop polling or surface as an unhandled rejection
        console.warn('[AdminStore] Sync failed:', err && (err.message || err));
        this.syncFailures = (this.syncFailures || 0) + 1;
        this.setStatus('offline');
        this.schedulePoll();
        return false;
      }
    })().finally(() => { this.syncing = null; });
    return this.syncing;
  }

  async runSync() {
    {
      const sb = await this.waitForClient();
      if (!sb) { this.syncFailures = (this.syncFailures || 0) + 1; this.setStatus('offline'); this.schedulePoll(); return false; }
      // The API hands back at most 1000 rows per request and does not say when it cut the list short, so the lists
      // that grow with the number of guardians are read page by page (otherwise rows past 1000 would silently vanish)
      const pageAll = async (table, orderBy) => {
        const PAGE = 1000, MAX_PAGES = 50; // 50,000 rows is far past what one console should hold in memory
        let rows = [];
        for (let i = 0; i < MAX_PAGES; i++) {
          const { data, error } = await sb.from(table).select('*')
            .order(orderBy, { ascending: false }).order('id', { ascending: false })
            .range(i * PAGE, (i + 1) * PAGE - 1);
          if (error) return { error };
          rows = rows.concat(data || []);
          if (!data || data.length < PAGE) break;
        }
        return { data: rows };
      };
      const [pets, reports, sightings, impounded, shelters, tags, notifs, tickets, extraMains, claims, rehab] = await Promise.all([
        pageAll('registered_pets', 'created_at'),
        pageAll('missing_pets', 'created_at'),
        sb.from('community_sightings').select('*').order('created_at', { ascending: false }).limit(1000),
        pageAll('impounded_pets', 'intake_at'),
        sb.from('shelters').select('*').order('name').limit(1000),
        pageAll('nfc_tags', 'created_at'),
        sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(300),
        pageAll('penalty_tickets', 'created_at'),
        sb.from('facility_extra_mains').select('shelter_id'),
        sb.from('impound_claims').select('*').order('created_at', { ascending: false }).limit(500),
        pageAll('rehab_cases', 'started_at')
      ].map((p) => Promise.resolve(p).catch((error) => ({ error }))));

      // Every core list failed: the database cannot be reached. Keep what we have, show it, and back off.
      if ([pets, impounded, shelters].every((r) => r && r.error)) {
        this.syncFailures = (this.syncFailures || 0) + 1;
        this.setStatus('offline');
        this.schedulePoll();
        return false;
      }

      let changed = false;
      const put = (key, list) => {
        const next = JSON.stringify(list);
        if (localStorage.getItem(key) === next) return;
        try { localStorage.setItem(key, next); } catch (e) { /* storage full: keep it in memory only */ }
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
      // Main facilities this account manages besides its own (a database without them simply has none)
      put(STORAGE_KEYS.EXTRA_MAINS, extraMains && !extraMains.error ? (extraMains.data || []).map((r) => r.shelter_id) : []);
      // Owners' claims on impounded animals (a database without the table simply has none)
      put(STORAGE_KEYS.CLAIMS, claims && !claims.error ? (claims.data || []).map((r) => this.fromClaimRow(r)) : []);
      // The ticket table may not exist yet on an older database: then there are simply no tickets
      put(STORAGE_KEYS.TICKETS, tickets.error ? [] : (tickets.data || []).map((t) => this.fromTicketRow(t)));
      // Rehabilitation cases: a database without the table simply has none, and the page says so
      const wasRehabReady = this.rehabReady;
      this.rehabReady = !!rehab && !rehab.error;
      if (wasRehabReady !== this.rehabReady) changed = true; // the Rehabilitation page redraws once it knows
      put(STORAGE_KEYS.REHAB, this.rehabReady ? (rehab.data || []).map((r) => this.fromRehabRow(r)) : []);
      // Facility settings that only newer databases have (the penalty amount): used to show or hide those fields
      this.penaltyReady = !shelters.error && (shelters.data || []).some((r) => 'penalty_php' in r);
      // Pickup pins: only sent once the database has the columns (checked once)
      if (this.pickupCoordsReady === undefined) {
        try { this.pickupCoordsReady = !(await sb.from('impounded_pets').select('impound_lat').limit(1)).error; } catch (e) { this.pickupCoordsReady = false; }
      }

      this.syncFailures = 0;
      this.setStatus(this.realtime === 'live' ? 'live' : 'connected');
      this.lastSyncedAt = Date.now();
      this.schedulePoll();
      // A manager may have added or removed this account from a facility since the last poll
      this.refreshAccount().catch(() => {});
      // The first answer always notifies, even when it matches the cache, so a page waiting on it can stop showing a skeleton
      const firstSync = !this.hasSynced;
      this.hasSynced = true;
      if (changed || firstSync) this.notify('supabase_sync');
      // Uncollected pets at sub-facilities move to the main facility after their holding window
      this.runOverdueTransfers().catch(() => {});
      return true;
    }
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
    // A reload already in flight started before this write, so it may carry old rows: reload again after it
    (this.syncing ? this.syncing.then(() => this.syncFromSupabase()) : this.syncFromSupabase()).catch(() => {});
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
      nfcSerial: p.nfc_serial || '',
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
      // Where the database routed the report (null until the routing migration is applied, or when PawTrack handles it)
      routedShelterId: r.routed_shelter_id || null,
      routedVia: r.routed_via || null,
      lastSeenBarangay: r.last_seen_barangay || '',
      lastSeenCity: r.last_seen_city || '',
      createdAt: r.created_at,
      lastUpdated: r.updated_at || r.created_at,
      timeline
    };
  }

  fromSightingRow(s) {
    return {
      id: s.id,
      missing_report_id: s.missing_pet_id || null,
      species: window.PawSpecies.normalize(s.species),
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
      paperAddress: s.paper_address || '',
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
      impoundLat: i.impound_lat == null ? null : Number(i.impound_lat),
      impoundLng: i.impound_lng == null ? null : Number(i.impound_lng),
      intakeOfficer: i.intake_officer || '',
      healthCondition: i.health_condition || '',
      shelterId: i.shelter_id,
      shelterName: shelter ? shelter.name : 'Animal facility',
      originShelterId: i.origin_shelter_id || null,
      transferStatus: i.transfer_status || null,          // null | 'pending' | 'received' | 'not_arrived'
      transferToId: i.transfer_to_shelter_id || null,
      transferStartedAt: i.transfer_started_at || null,
      transferResolvedAt: i.transfer_resolved_at || null,
      transferNotes: i.transfer_notes || '',
      intakeDate: i.intake_at,
      claimDeadline: i.claim_deadline,
      status: i.status === 'in_holding' ? 'active_impounded' : i.status,
      closedAt: i.closed_at,
      euthanasia: i.status === 'euthanized' ? { reason: i.euthanasia_reason || '', vet: i.euthanasia_vet || '', license: i.euthanasia_license || '', notes: i.euthanasia_notes || '', at: i.euthanized_at || i.closed_at } : null,
      notificationSent: true
    };
  }

  // Columns from Supabase (older device-only extras are only a fallback)
  fromShelterRow(s) {
    const extras = this.getShelterExtras()[s.id] || {};
    return {
      ...extras,
      id: s.id,
      parentId: s.parent_id || null,   // set for a sub-facility: the main facility it belongs to
      penaltyPhp: s.penalty_php != null ? s.penalty_php : null,
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
      photoUrl: s.photo_url || extras.photoUrl || '',
      // Shared columns; older device-only extras are the fallback until the database has them
      capacity: s.capacity != null ? s.capacity : (extras.capacity || 50),
      officerInCharge: s.officer_in_charge || extras.officerInCharge || '',
      city: s.city || extras.city || '',
      type: s.facility_type || extras.type || '',
      cityPlaceId: s.city_place_id || '',
      cityBounds: s.city_bounds || null,
      coverage: Array.isArray(s.coverage_barangays) ? s.coverage_barangays : []
    };
  }

  fromRehabRow(r) {
    return {
      id: r.id, impoundId: r.impound_id, shelterId: r.shelter_id, stage: r.stage === 'assessment' ? 'medical' : r.stage, // the assessment stage was removed
      checklist: r.checklist && typeof r.checklist === 'object' ? r.checklist : {},
      notes: r.stage_notes && typeof r.stage_notes === 'object' ? r.stage_notes : {},
      withdrawnReason: r.withdrawn_reason || '',
      condition: { overall: r.condition_overall || 'stable', tags: Array.isArray(r.condition_tags) ? r.condition_tags : [], note: r.condition_note || '' },
      startedAt: r.started_at, stageChangedAt: r.stage_changed_at, readyAt: r.ready_at || null, updatedAt: r.updated_at
    };
  }

  fromClaimRow(r) {
    return {
      id: r.id, impoundId: r.impound_id, claimantId: r.claimant_id,
      name: r.claimant_name, email: r.claimant_email, phone: r.claimant_phone || '', message: r.message || '',
      status: r.status, decidedAt: r.decided_at || null, note: r.decision_note || '', createdAt: r.created_at,
      photo: /^data:image\/jpeg;base64,/.test(r.evidence_photo || '') ? r.evidence_photo : ''
    };
  }

  getClaims() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.CLAIMS)) || []; } catch { return []; }
  }

  // Claims waiting for a decision on animals held by the facility being viewed
  getPendingClaimCount() {
    const active = this.getActiveFacilityId();
    const held = new Map(this.getImpoundments().map((i) => [String(i.id), i.shelterId]));
    return this.getClaims().filter((c) => c.status === 'pending' && held.has(String(c.impoundId)) && (!active || held.get(String(c.impoundId)) === active)).length;
  }

  // Accepts or rejects a claim, then emails the owner (the email function checks this admin may decide it).
  // Resolves { ok, emailed }.
  async decideClaim(id, status, note) {
    const sb = await this.waitForClient(5000);
    const me = this.currentAdminId();
    if (!sb || !me) { this.dbError('Could not save the decision', { message: 'not signed in' }); return { ok: false }; }
    const { data, error } = await sb.from('impound_claims').update({ status, decided_by: me, decided_at: new Date().toISOString(), decision_note: note || null }).eq('id', id).eq('status', 'pending').select('id');
    if (error || !data || !data[0]) {
      this.dbError('Could not save the decision', error || { message: 'it was already decided, or it is not for your facility' });
      this.syncFromSupabase();
      return { ok: false };
    }
    let emailed = false;
    try {
      const res = await sb.functions.invoke('notify-claim', { body: { claim_id: id } });
      emailed = !res.error;
    } catch (e) { emailed = false; }
    this.logAction(status === 'accepted' ? 'Accepted a Claim' : 'Rejected a Claim', `Claim ${id}`);
    await this.syncFromSupabase();
    return { ok: true, emailed };
  }

  fromTicketRow(t) {
    return {
      id: t.id,
      ticketNo: t.ticket_no,
      impoundId: t.impound_id,
      petId: t.pet_id,
      petName: t.pet_name,
      ownerId: t.owner_id,
      issuedByShelterId: t.issued_by_shelter_id,
      payeeShelterId: t.payee_shelter_id,
      amount: t.amount_php,
      status: t.status,                // 'unpaid' | 'paid' | 'waived'
      createdAt: t.created_at,
      paidAt: t.paid_at,
      reference: t.payment_reference || '',
      waivedReason: t.waived_reason || ''
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
    // a tag is found by its PawTrack ID, or by the hardware serial of the chip
    return this.getPets().find(p => (p.rfidTag || '').toUpperCase() === clean || (p.nfcSerial || '').toUpperCase() === clean);
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
      species: window.PawSpecies.normalize(petData.species),
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

  // Open missing reports routed to this account's facilities (a main facility also gets its sub-facilities')
  getRoutedReports() {
    const ids = this.getMyFacilityIds();
    if (!ids.length) return [];
    return this.getCases().filter(c => c.routedShelterId && ids.includes(c.routedShelterId) && c.status !== 'reunited');
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
      // the pet is marked impounded AFTER the impound is saved: a missing pet's penalty ticket is decided at that moment
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
      species: window.PawSpecies.normalize(record.species),
      breed: record.breed || null,
      photo_url: /^https:\/\//.test(record.photoUrl || '') ? record.photoUrl : null,
      nfc_tag: record.rfidTag || null,
      kennel: record.cageNumber || null,
      impound_location: record.impoundLocation || record.location || null,
      ...(this.pickupCoordsReady && Number.isFinite(record.impoundLat) && Number.isFinite(record.impoundLng)
        ? { impound_lat: record.impoundLat, impound_lng: record.impoundLng } : {}),
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
    )).then((saved) => {
      if (isNew && saved !== null && record.petId) this.updatePetStatus(record.petId, 'impounded');
    });
    return record;
  }

  claimImpoundment(impoundId, operator = 'Admin') {
    const impoundments = this.getImpoundments();
    const imp = impoundments.find(i => i.id === impoundId);
    const ticket = imp && this.getTicketForImpound(imp.id);
    if (ticket && ticket.status === 'unpaid') {
      this.dbError('Could not release the pet', { message: `penalty ticket ${ticket.ticketNo} (PHP ${ticket.amount}) is unpaid. Record the payment, or waive it, first.` });
      return null;
    }
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

  // ----- Euthanasia of an animal nobody claimed during its claim period (the database enforces the same rules) -----
  // '' when it may be euthanized, otherwise the reason it may not (shown to the admin)
  euthanasiaBlock(imp) {
    if (!imp) return 'Animal not found.';
    if (imp.status === 'euthanized') return 'Already euthanized.';
    if (imp.status !== 'active_impounded' && imp.status !== 'forfeited') return 'Only an animal that was never claimed can be euthanized.';
    const deadline = new Date(imp.claimDeadline).getTime();
    if (imp.status === 'active_impounded' && Number.isFinite(deadline) && deadline > Date.now()) {
      return `Available after the claim period ends, ${new Date(deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`;
    }
    if (imp.transferStatus === 'pending') return 'It is being moved to another facility.';
    if (this.getClaims().some((c) => c.impoundId === imp.id && c.status === 'pending')) return 'An owner has a claim waiting on it. Decide the claim first.';
    const rehab = this.getRehabForImpound ? this.getRehabForImpound(imp.id) : null;
    if (rehab && rehab.stage !== 'withdrawn') return 'It is in rehabilitation. Withdraw it first.';
    return '';
  }

  // details: { reason, vet, license, notes, at (ISO) }. Waits for the database: it cannot be undone, so the screen
  // only changes once the record is really saved. Resolves true on success.
  async euthanizeImpoundment(impoundId, details) {
    const imp = this.getImpoundmentById(impoundId);
    const blocked = this.euthanasiaBlock(imp);
    if (blocked) { this.dbError('Could not record the euthanasia', { message: blocked }); return false; }
    if (!this.isDbId(impoundId)) { this.dbError('Could not record the euthanasia', { message: 'this case is not saved in the database yet' }); return false; }
    const at = details.at || new Date().toISOString();
    const sb = await this.waitForClient(5000);
    if (!sb) { this.dbError('Could not record the euthanasia', { message: 'no connection to the database' }); return false; }
    const { error } = await sb.from('impounded_pets').update({
      status: 'euthanized', closed_at: at, euthanized_at: at,
      euthanasia_reason: details.reason, euthanasia_vet: (details.vet || '').trim(),
      euthanasia_license: (details.license || '').trim() || null, euthanasia_notes: (details.notes || '').trim() || null
    }).eq('id', impoundId);
    if (error) { this.dbError('Could not record the euthanasia', error); return false; }
    const list = this.getImpoundments();
    const rec = list.find((i) => i.id === impoundId);
    if (rec) {
      rec.status = 'euthanized'; rec.closedAt = at;
      rec.euthanasia = { reason: details.reason, vet: (details.vet || '').trim(), license: (details.license || '').trim(), notes: (details.notes || '').trim(), at };
      localStorage.setItem(STORAGE_KEYS.IMPOUNDMENTS, JSON.stringify(list));
    }
    this.logAction('Euthanasia recorded', `${imp.petName} (${imp.species}) was euthanized by ${(details.vet || '').trim()}. Reason: ${details.reason}`);
    this.notify('impoundment_euthanized');
    this.syncFromSupabase().catch(() => {});
    return true;
  }

  // Removes an impound case for good (its penalty tickets and claims go with it in the database)
  deleteImpoundment(impoundId) {
    const list = this.getImpoundments();
    const imp = list.find(i => i.id === impoundId);
    if (!imp) return false;
    localStorage.setItem(STORAGE_KEYS.IMPOUNDMENTS, JSON.stringify(list.filter(i => i.id !== impoundId)));
    if (this.isDbId(impoundId)) this.write('Could not delete the impound case', (sb) => sb.from('impounded_pets').delete().eq('id', impoundId));
    this.logAction('Deleted Impound', `Deleted impound case ${imp.id} (${imp.petName}).`);
    this.notify('impound_deleted');
    return true;
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
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  // ----- Facility membership -----
  // An admin account works for ONE facility (admin_accounts.shelter_id) as its manager or as staff, and a facility
  // has many accounts. The first staff member registers the facility and becomes its manager; the rest join with
  // the manager's invite code. Membership only changes through database functions.
  currentAdmin() {
    return (window.adminApp && window.adminApp.currentAdmin) || null;
  }

  currentAdminId() {
    const a = this.currentAdmin();
    return a ? a.id : null;
  }

  myShelterId() {
    const a = this.currentAdmin();
    return (a && a.shelter_id) || null;
  }

  // 'manager', 'staff', or null when the account has no facility yet
  myFacilityRole() {
    const a = this.currentAdmin();
    return a && a.shelter_id ? (a.facility_role || 'staff') : null;
  }

  isFacilityManager() {
    return this.myFacilityRole() === 'manager';
  }

  getMyShelter() {
    const id = this.myShelterId();
    return id ? (this.getShelters().find(s => s.id === id) || null) : null;
  }

  // ----- Main facility and its sub-facilities -----
  // A main facility has sub-facilities; main staff see and manage the whole tree, sub-facility staff only their own.
  isMainFacility() {
    const mine = this.getMyShelter();
    return !!mine && !mine.parentId;
  }

  // Ids of the other main facilities this account manages (it can add more than one main facility)
  getExtraMainIds() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXTRA_MAINS));
      return Array.isArray(list) && this.isFacilityManager() && this.isMainFacility() ? list : [];
    } catch {
      return [];
    }
  }

  // The main facilities this account works in: its own plus any it added (empty for a sub-facility employee)
  getMainFacilities() {
    if (!this.isMainFacility()) return [];
    const all = this.getShelters();
    return [this.myShelterId(), ...this.getExtraMainIds()]
      .map(id => all.find(s => s.id === id))
      .filter(Boolean);
  }

  getSubFacilities() {
    const mains = this.getMainFacilities().map(s => s.id);
    return mains.length ? this.getShelters().filter(s => mains.includes(s.parentId)) : [];
  }

  // For a sub-facility employee: the main facility their pets go to after the holding window
  getMainFacility() {
    const mine = this.getMyShelter();
    return mine && mine.parentId ? (this.getShelters().find(s => s.id === mine.parentId) || null) : null;
  }

  // Every facility this account works in: its own, plus the sub-facilities of a main facility
  getMyFacilityIds() {
    const id = this.myShelterId();
    if (!id) return [];
    return [...this.getMainFacilities().map(s => s.id).concat(this.isMainFacility() ? [] : [id])].filter((v, i, a) => a.indexOf(v) === i)
      .concat(this.getSubFacilities().map(s => s.id));
  }

  // The facility the whole console is showing (the account's own, or another one in its tree that was picked).
  // Remembered across refreshes; falls back to the account's own facility when nothing valid is remembered.
  getActiveFacilityId() {
    const ids = this.getMyFacilityIds();
    if (!ids.length) return null;
    let saved = null;
    try { saved = localStorage.getItem('pawtrack_active_facility'); } catch (e) { saved = null; }
    if (saved && ids.includes(saved)) return saved;
    const own = this.myShelterId();
    return ids.includes(own) ? own : ids[0];
  }

  getActiveFacility() {
    const id = this.getActiveFacilityId();
    return id ? (this.getShelters().find(s => s.id === id) || null) : null;
  }

  setActiveFacility(id) {
    if (!id || !this.getMyFacilityIds().includes(id) || id === this.getActiveFacilityId()) return;
    try { localStorage.setItem('pawtrack_active_facility', id); } catch (e) { /* private mode: not remembered */ }
    this.notify('active_facility'); // every page redraws for the new facility
  }

  // Facilities this account may edit and manage the team of (managers only)
  getManagedShelterIds() {
    return this.isFacilityManager() ? this.getMyFacilityIds() : [];
  }

  // Impounds in the signed-in admin's facility, and in its sub-facilities when it is a main facility
  getMyImpoundments() {
    const ids = this.getMyFacilityIds();
    return ids.length ? this.getImpoundments().filter(i => ids.includes(i.shelterId)) : [];
  }

  // Pets on their way to this (main) facility that staff still have to confirm
  getIncomingTransfers() {
    const ids = this.getMainFacilities().map(s => s.id);
    return ids.length ? this.getImpoundments().filter(i => i.transferStatus === 'pending' && ids.includes(i.transferToId) && i.status === 'active_impounded') : [];
  }

  // Pets of this facility (or its sub-facilities) that are waiting to move to the main facility
  getOutgoingTransfers() {
    const ids = this.getMyFacilityIds();
    return this.getImpoundments().filter(i => i.transferStatus === 'pending' && ids.includes(i.shelterId));
  }

  async runOverdueTransfers() {
    if (!this.hasFacility()) return 0;
    const sb = this.client();
    if (!sb) return 0;
    const { data, error } = await sb.rpc('run_overdue_transfers');
    if (error || !data) return 0;   // quiet: this runs in the background
    this.syncFromSupabase();
    return data;
  }

  async confirmTransferArrival(impoundId, arrived, cage, notes) {
    const res = await this.rpc('Could not save the arrival', 'confirm_transfer_arrival', { p_impound: impoundId, p_arrived: !!arrived, p_cage: cage || null, p_notes: notes || null });
    if (res.ok) {
      this.logAction(arrived ? 'Transfer Received' : 'Transfer Not Arrived', `Impound ${impoundId}`);
      await this.syncFromSupabase();
    }
    return res.ok;
  }

  async createSubFacility(shelterData, onDone) {
    return this.saveShelter({ ...shelterData, asSub: true }, onDone);
  }

  // ----- Violations an admin records against a person (see supabase/migrations/20261131_issued_violations.sql) -----
  async findGuardians(query) {
    const q = String(query || '').trim();
    if (q.length < 2) return [];
    const res = await this.rpc('Could not look up people', 'find_guardians', { p_query: q });
    return res.ok ? (res.data || []) : [];
  }

  // row: one entry of PawViolations.rows. The database works out the offense number and the fine from the ladder.
  async issueViolation({ ownerId, ownerName, row, reason, petName }) {
    const pen = row.provision.penalty;
    const ladder = pen.kind === 'ladder' ? pen.steps : pen.kind === 'flat' ? [pen.amount] : [];
    const args = {
      p_owner: ownerId, p_rule_id: row.id, p_rule_name: row.name, p_section: row.provision.ref,
      p_ladder: ladder, p_reason: reason, p_pet_name: petName || null
    };
    // The facility is sent once the database has the newer issue_violation (supabase/migrations/20261132); until then without it
    const facility = this.getActiveFacilityId();
    let res = facility && this.violationFacilityReady !== false
      ? await this.rpc('Could not record the violation', 'issue_violation', { ...args, p_shelter: facility }, true)
      : { ok: false, missingFn: true };
    if (!res.ok && (res.missingFn || /could not find the function|schema cache/i.test(res.message || ''))) {
      this.violationFacilityReady = false;
      res = await this.rpc('Could not record the violation', 'issue_violation', args);
    }
    if (!res.ok) return null;
    this.logAction('Violation Issued', `${row.provision.ref}: ${row.name} recorded against ${ownerName || ownerId}`);
    // The email (through Brevo, in the facility's name) is best effort: the violation and the in-app alert are already saved
    let emailed = false;
    try {
      const sb = await this.waitForClient(5000);
      const out = sb && await sb.functions.invoke('notify-violation', { body: { violation_id: res.data.id } });
      emailed = !!(out && out.data && out.data.sent);
    } catch (e) { console.warn('[AdminStore] violation email:', e && e.message); }
    return { ...res.data, emailed };
  }

  // Pets that went 7 days without an NFC tag, waiting for a facility to decide whether it is a violation
  async listNfcFlags() {
    const sb = await this.waitForClient(5000);
    if (!sb) return { rows: [], missing: false };
    const { data, error } = await sb.from('nfc_flags').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(200);
    if (error) return { rows: [], missing: true };
    return { rows: data || [], missing: false };
  }

  // The facility's decision. A violation is recorded by the database (offense and fine worked out there), then the person is emailed.
  async decideNfcFlag(flagId, violate, note) {
    const facility = this.getActiveFacilityId();
    const res = await this.rpc('Could not save the decision', 'decide_nfc_flag', { p_flag: flagId, p_violate: !!violate, p_note: note || null, p_shelter: facility || null });
    if (!res.ok) return null;
    const out = res.data || {};
    let emailed = false;
    if (violate && out.violation_id) {
      try {
        const sb = await this.waitForClient(5000);
        const sent = sb && await sb.functions.invoke('notify-violation', { body: { violation_id: out.violation_id } });
        emailed = !!(sent && !sent.error);
      } catch (e) { emailed = false; }
    }
    this.logAction(violate ? 'Violation Issued' : 'Report Dismissed', `Pet without an NFC tag: ${flagId}`);
    return { ...out, emailed };
  }

  async listViolations() {
    const sb = await this.waitForClient(5000);
    if (!sb) return { rows: [], missing: false };
    const { data, error } = await sb.from('violations').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return { rows: [], missing: true };
    return { rows: data || [], missing: false };
  }

  // ----- Penalty tickets: owners of missing pets pay a penalty to the main facility -----
  // ----- Rehabilitation: unclaimed animals prepared for adoption in stages (see supabase/migrations/20261146_rehabilitation.sql) -----
  getRehabCases() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.REHAB));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  getRehabForImpound(impoundId) {
    return this.getRehabCases().find((c) => c.impoundId === impoundId) || null;
  }

  // Puts an animal on the rehabilitation track, at the first stage
  // condition: { overall, tags, note }, what the admin says is wrong (or not) with the animal, asked before it starts
  async startRehab(impoundId, condition = {}) {
    const imp = this.getImpoundments().find((i) => i.id === impoundId);
    if (!imp || !this.isDbId(impoundId)) return null;
    if (this.getRehabForImpound(impoundId)) return this.getRehabForImpound(impoundId);
    const rows = await this.write('Could not start rehabilitation', (sb) => sb.from('rehab_cases').insert({ impound_id: impoundId, condition_overall: condition.overall || 'stable', condition_tags: condition.tags || [], condition_note: (condition.note || '').trim() || null }).select('*'));
    if (!rows || !rows[0]) return null;
    const created = this.fromRehabRow(rows[0]);
    localStorage.setItem(STORAGE_KEYS.REHAB, JSON.stringify([created, ...this.getRehabCases().filter((c) => c.id !== created.id)]));
    this.logAction('Rehabilitation started', `${imp.petName} (${imp.species}) entered rehabilitation. Condition: ${created.condition.overall}${created.condition.tags.length ? ` (${created.condition.tags.join(', ')})` : ''}`);
    this.notify('rehab_started');
    return created;
  }

  // patch: { stage?, checklist?, notes?, withdrawnReason? }. The screen updates at once; the database confirms
  saveRehab(caseId, patch) {
    const list = this.getRehabCases();
    const c = list.find((x) => x.id === caseId);
    if (!c) return null;
    const row = {};
    if (patch.stage !== undefined) { c.stage = patch.stage; row.stage = patch.stage; c.stageChangedAt = new Date().toISOString(); if (patch.stage !== 'withdrawn') c.withdrawnReason = ''; }
    if (patch.checklist !== undefined) { c.checklist = patch.checklist; row.checklist = patch.checklist; }
    if (patch.notes !== undefined) { c.notes = patch.notes; row.stage_notes = patch.notes; }
    if (patch.condition !== undefined) { c.condition = patch.condition; row.condition_overall = patch.condition.overall; row.condition_tags = patch.condition.tags || []; row.condition_note = (patch.condition.note || '').trim() || null; }
    if (patch.withdrawnReason !== undefined) { c.withdrawnReason = patch.withdrawnReason; row.withdrawn_reason = patch.withdrawnReason || null; }
    if (c.stage === 'ready') c.readyAt = c.readyAt || new Date().toISOString(); else c.readyAt = null;
    localStorage.setItem(STORAGE_KEYS.REHAB, JSON.stringify(list));
    if (this.isDbId(caseId)) this.write('Could not save the rehabilitation case', (sb) => sb.from('rehab_cases').update(row).eq('id', caseId));
    if (patch.stage !== undefined) {
      const imp = this.getImpoundments().find((i) => i.id === c.impoundId);
      this.logAction('Rehabilitation stage', `${imp ? imp.petName : 'Animal'} moved to ${patch.stage}`);
    }
    this.notify('rehab_updated');
    return c;
  }

  // Sets an animal as rehabilitated. The database only lets "ready" follow final clearance, so it goes through that
  // step first. Resolves true when the database accepted it.
  async finishRehab(caseId) {
    const list = this.getRehabCases();
    const c = list.find((x) => x.id === caseId);
    if (!c || !this.isDbId(caseId)) return false;
    const sb = await this.waitForClient(5000);
    if (!sb) { this.dbError('Could not mark the animal as rehabilitated', { message: 'no connection to the database' }); return false; }
    let { error } = await sb.from('rehab_cases').update({ stage: 'clearance' }).eq('id', caseId);
    if (!error) ({ error } = await sb.from('rehab_cases').update({ stage: 'ready' }).eq('id', caseId));
    if (error) { this.dbError('Could not mark the animal as rehabilitated', error); return false; }
    c.stage = 'ready';
    c.readyAt = c.readyAt || new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.REHAB, JSON.stringify(list));
    const imp = this.getImpoundments().find((i) => i.id === c.impoundId);
    this.logAction('Rehabilitated', `${imp ? imp.petName : 'Animal'} finished rehabilitation and is ready for adoption`);
    this.notify('rehab_ready');
    this.syncFromSupabase().catch(() => {});
    return true;
  }

  getTickets() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.TICKETS));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  getTicketForImpound(impoundId) {
    return this.getTickets().find(t => t.impoundId === impoundId) || null;
  }

  // Unpaid tickets this (main) facility is waiting to be paid
  getTicketsToCollect() {
    const ids = this.getMyFacilityIds();
    return ids.length ? this.getTickets().filter(t => t.status === 'unpaid' && ids.includes(t.payeeShelterId)) : [];
  }

  async recordTicketPayment(ticketId, reference) {
    const res = await this.rpc('Could not record the payment', 'record_ticket_payment', { p_ticket: ticketId, p_reference: reference || null });
    if (res.ok) { this.logAction('Penalty Paid', `Ticket ${ticketId} recorded as paid`); await this.syncFromSupabase(); }
    return res.ok;
  }

  async waiveTicket(ticketId, reason) {
    const res = await this.rpc('Could not waive the ticket', 'waive_ticket', { p_ticket: ticketId, p_reason: reason });
    if (res.ok) { this.logAction('Penalty Waived', `Ticket ${ticketId} waived`); await this.syncFromSupabase(); }
    return res.ok;
  }

  // Re-reads the signed-in admin's own account (their facility membership may have changed)
  async refreshAccount() {
    if (window.adminApp && typeof window.adminApp.refreshAccount === 'function') await window.adminApp.refreshAccount();
  }

  // Registering and joining are the two ways in; both are offered wherever a facility is missing
  hasFacility() {
    return !!this.myShelterId();
  }

  // Runs a database function; resolves { ok, data }. Errors are shown once as a toast.
  async rpc(what, name, args, quiet) {
    const sb = await this.waitForClient(5000);
    if (!sb) { this.dbError(what, { message: 'no connection to the database' }); return { ok: false, data: null }; }
    const { data, error } = await sb.rpc(name, args || {});
    if (error) { if (!quiet) this.dbError(what, error); return { ok: false, data: null, message: error.message }; }
    return { ok: true, data };
  }

  // What deleting a facility would affect, and what blocks it. null when the database refused or could not be reached.
  async facilityDeletePreview(id) {
    const res = await this.rpc('Could not check this facility', 'facility_delete_preview', { p_id: id });
    return res.ok ? res.data : null;
  }

  // Makes a facility a sub-facility of one of the account's main facilities (parentId), or a main facility (null).
  // Resolves true on success; the database re-checks every rule and its refusal is shown as a toast.
  async setFacilityParent(id, parentId) {
    const res = await this.rpc('Could not change the facility type', 'set_facility_parent', { p_id: id, p_parent: parentId || null });
    if (!res.ok) return false;
    await this.syncFromSupabase();
    return true;
  }

  // Deletes a facility (the database re-checks that it is allowed). Resolves the summary, or null on failure.
  async deleteFacility(id) {
    const res = await this.rpc('Could not delete the facility', 'delete_facility', { p_id: id });
    if (!res.ok) return null;
    try { if (localStorage.getItem('pawtrack_active_facility') === id) localStorage.removeItem('pawtrack_active_facility'); } catch (e) { /* ignore */ }
    await this.syncFromSupabase();
    return res.data || {};
  }

  // Register the admin's facility (they become its manager), or update it (manager only).
  // onDone(databaseId) runs once the database has answered (null if it failed or was refused).
  saveShelter(shelterData, onDone) {
    const finish = (id) => { if (typeof onDone === 'function') onDone(id || null); return null; };
    const refuse = (message) => { this.dbError('Could not save the facility', { message }); return finish(null); };
    if (!this.currentAdminId()) return refuse('sign in again');

    const isNew = !this.isDbId(shelterData.id);
    const asSub = !!shelterData.asSub;
    const asMain = !!shelterData.asMain;
    if (asSub && !(this.isFacilityManager() && this.isMainFacility())) return refuse('only the main facility\'s manager can create a sub-facility');
    if (asSub && shelterData.parentId && !this.getMainFacilities().some(s => s.id === shelterData.parentId)) return refuse('that main facility is not yours');
    if (asMain && !(this.isFacilityManager() && this.isMainFacility())) return refuse('only the manager of a main facility can add another main facility');
    if (isNew && !asSub && !asMain && this.myShelterId()) return refuse('your account already belongs to a facility');
    if (!isNew && !(this.isFacilityManager() && this.getManagedShelterIds().includes(shelterData.id))) return refuse('only the facility manager can edit its details');

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
      capacity: parseInt(shelterData.capacity, 10) || 50,
      officer_in_charge: shelterData.officerInCharge || null,
      city: shelterData.city || null,
      facility_type: shelterData.type || null,
      city_place_id: shelterData.cityPlaceId || null,
      city_bounds: shelterData.cityBounds || null
    };
    if (asSub || (!isNew && Array.isArray(shelterData.coverage))) row.coverage_barangays = Array.isArray(shelterData.coverage) ? shelterData.coverage : [];

    if (isNew) {
      if (asSub) {
        const subRow = shelterData.parentId ? { ...row, parent_id: shelterData.parentId } : row;
        this.write('Could not create the sub-facility', (sb) => sb.rpc('create_sub_facility', { p: subRow })).then(async (id) => {
          if (typeof id !== 'string') return finish(null); // the error was already shown
          await this.syncFromSupabase();
          this.logAction('Created Sub-facility', `Created sub-facility ${shelterData.name}`);
          finish(id);
        });
        return shelterData;
      }
      if (asMain) {
        this.write('Could not add the main facility', (sb) => sb.rpc('add_main_facility', { p: row })).then(async (id) => {
          if (typeof id !== 'string') return finish(null); // the error was already shown
          await this.syncFromSupabase();
          this.logAction('Added Main Facility', `Added main facility ${shelterData.name}`);
          finish(id);
        });
        return shelterData;
      }
      this.write('Could not register the facility', (sb) => sb.rpc('register_facility', { p: row })).then(async (id) => {
        if (typeof id !== 'string') return finish(null); // the error was already shown
        await this.refreshAccount();
        this.logAction('Registered Facility', `Registered ${shelterData.name} and became its manager`);
        finish(id);
      });
      return shelterData;
    }

    // Update: show it straight away, then let the database confirm
    const shelters = this.getShelters();
    const index = shelters.findIndex(s => s.id === shelterData.id);
    if (index >= 0) {
      shelters[index] = { ...shelters[index], ...shelterData };
      localStorage.setItem(STORAGE_KEYS.SHELTERS, JSON.stringify(shelters));
      this.notify('shelters_updated');
    }
    this.logAction('Updated Facility', `Updated shelter details for ${shelterData.name}`);
    this.write('Could not save the facility', (sb) => (
      sb.from('shelters').update({ ...row, ...(this.penaltyReady && shelterData.penaltyPhp != null ? { penalty_php: Math.max(0, parseInt(shelterData.penaltyPhp, 10) || 0) } : {}), ...(shelterData.photoUrl !== undefined ? { photo_url: /^https:\/\//.test(shelterData.photoUrl || '') ? shelterData.photoUrl : null } : {}) }).eq('id', shelterData.id).select('id')
    )).then((rows) => {
      const id = rows && rows[0] && rows[0].id;
      // No error but no row back: the database's access rules turned the change away
      if (rows && !id) this.dbError('Could not save the facility', { message: 'the database did not accept the change (only the facility manager can edit it)' });
      finish(id);
    });
    return shelterData;
  }

  // Stores a facility's photo in the public "facility-photos" bucket (folder = the facility's id) and points the
  // facility at it. Pass null to clear the photo. Returns the new URL, '' when cleared, or null when it failed.
  // The facility's address as written on its papers. Saved right after the facility exists; true on success.
  async setFacilityPaperAddress(shelterId, value) {
    const sb = this.client();
    if (!sb || !this.isDbId(shelterId)) return false;
    const { error } = await sb.from('shelters').update({ paper_address: String(value || '').trim() || null }).eq('id', shelterId);
    if (error) { console.warn('[AdminStore] paper address:', error.message); return false; }
    const list = this.getShelters();
    const i = list.findIndex((s) => s.id === shelterId);
    if (i >= 0) { list[i] = { ...list[i], paperAddress: String(value || '').trim() }; localStorage.setItem(STORAGE_KEYS.SHELTERS, JSON.stringify(list)); }
    return true;
  }

  async setFacilityPhoto(shelterId, blob) {
    const sb = this.client();
    if (!sb || !this.isDbId(shelterId)) { this.dbError('Could not save the facility photo', { message: 'the facility is not saved yet' }); return null; }
    const shelters = this.getShelters();
    const current = (shelters.find(s => s.id === shelterId) || {}).photoUrl || '';
    let url = '';
    let path = '';
    if (blob) {
      path = (window.FacilityPhoto ? window.FacilityPhoto.pathFor(shelterId) : `${shelterId}/${Date.now()}.jpg`);
      const up = await sb.storage.from('facility-photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (up.error) { this.dbError('Could not upload the facility photo', up.error); return null; }
      url = sb.storage.from('facility-photos').getPublicUrl(path).data.publicUrl || '';
    }
    const res = await sb.from('shelters').update({ photo_url: url || null }).eq('id', shelterId).select('id');
    if (res.error || !res.data || !res.data[0]) {
      if (path) sb.storage.from('facility-photos').remove([path]).catch(() => {});
      this.dbError('Could not save the facility photo', res.error || { message: 'only the facility manager can change it' });
      return null;
    }
    // The previous file is no longer used: remove it (best effort)
    const old = current.split('/facility-photos/')[1];
    if (old) sb.storage.from('facility-photos').remove([decodeURIComponent(old)]).catch(() => {});
    const index = shelters.findIndex(s => s.id === shelterId);
    if (index >= 0) {
      shelters[index] = { ...shelters[index], photoUrl: url, photo: url };
      localStorage.setItem(STORAGE_KEYS.SHELTERS, JSON.stringify(shelters));
      this.notify('shelters_updated');
    } else {
      // A facility that was just created is not in the saved list yet (it still has its temporary id): load the list
      // again so the photo shows straight away instead of after the next refresh
      if (this.syncing) { try { await this.syncing; } catch (e) { /* ignore */ } }
      await this.syncFromSupabase();
    }
    this.logAction(url ? 'Updated Facility Photo' : 'Removed Facility Photo', 'Changed the facility photo');
    return url;
  }

  async joinFacility(code, onDone) {
    const res = await this.rpc('Could not join the facility', 'join_facility', { p_code: code });
    if (res.ok) {
      await this.refreshAccount();
      await this.syncFromSupabase();
      this.logAction('Joined Facility', 'Joined a facility with an invite code');
    }
    if (typeof onDone === 'function') onDone(res.ok ? res.data : null);
    return res.ok;
  }

  async leaveFacility() {
    const res = await this.rpc('Could not leave the facility', 'leave_facility');
    if (res.ok) { await this.refreshAccount(); this.logAction('Left Facility', 'Left the facility'); }
    return res.ok;
  }

  // Manager tools
  async getFacilityTeam(shelterId) {
    const sb = this.client();
    const sid = shelterId || this.myShelterId();
    if (!sb || !sid) return [];
    const { data, error } = await sb.from('admin_accounts').select('id, full_name, email, position, facility_role, status').eq('shelter_id', sid).order('full_name');
    if (error) { this.dbError('Could not load the team', error); return []; }
    return data || [];
  }

  async getInviteCode(shelterId) {
    const sb = this.client();
    const sid = shelterId || this.myShelterId();
    if (!sb || !sid) return null;
    const { data, error } = await sb.from('facility_invites').select('code').eq('shelter_id', sid).maybeSingle();
    if (error) { this.dbError('Could not load the invite code', error); return null; }
    return data ? data.code : null;
  }

  async rotateInvite(shelterId) {
    const res = await this.rpc('Could not create a new invite code', 'rotate_facility_invite', shelterId ? { p_shelter: shelterId } : {});
    if (res.ok) this.logAction('Rotated Invite Code', 'Created a new facility invite code');
    return res.ok ? res.data : null;
  }

  async removeStaff(adminId) {
    const res = await this.rpc('Could not remove that person', 'remove_facility_staff', { p_admin: adminId });
    if (res.ok) this.logAction('Removed Staff', `Removed ${adminId} from the facility`);
    return res.ok;
  }

  async setStaffRole(adminId, role) {
    const res = await this.rpc('Could not change the role', 'set_facility_role', { p_admin: adminId, p_role: role });
    if (res.ok) { await this.refreshAccount(); this.logAction('Changed Role', `Set ${adminId} to ${role}`); }
    return res.ok;
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
      species: window.PawSpecies.normalize(sightingData.species),
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
      STORAGE_KEYS.RFID_TAGS, STORAGE_KEYS.SIGHTINGS, STORAGE_KEYS.CASES, STORAGE_KEYS.TICKETS, STORAGE_KEYS.REHAB].forEach((key) => localStorage.setItem(key, '[]'));
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
