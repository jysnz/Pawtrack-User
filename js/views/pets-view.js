/**
 * My Pets: every pet registered to the signed-in account, read from the database.
 * Tapping a pet opens its detail screen, where vaccination records are listed and added.
 */

const COMMON_VACCINES = [
  'Rabies', 'DHPP (Distemper, Hepatitis, Parvo, Parainfluenza)', 'Leptospirosis', 'Bordetella (Kennel cough)',
  'Canine Influenza', 'Lyme disease', 'FVRCP (Feline combo)', 'FeLV (Feline leukemia)', '5-in-1', '6-in-1', '8-in-1'
];

class PetsView {
  constructor() {
    this.pets = [];
    this.vaccines = {};      // pet id -> vaccination rows
    this.state = 'idle';     // idle | loading | ready | error
    this.layout = this.loadLayout(); // tiles | rows
    this.fetchedAt = 0;
    this.container = null;
    this.openPetId = null;
    this.attempts = 0;
    window.pawStore.subscribe((event) => { if (event === 'pets_updated') this.fetchedAt = 0; });
  }

  t(key, fallback) {
    return window.pawI18n ? window.pawI18n.t(key, fallback) : fallback;
  }

  esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  client() {
    return window.pawApp && window.pawApp.supabase;
  }

  // ---------- data ----------

  async refresh(force = false) {
    this.loadApprovedClaims();
    if (this.state === 'loading') return;
    if (!force && this.state === 'ready' && Date.now() - this.fetchedAt < 8000) return;

    const client = this.client();
    if (!client) {
      // pawApp finishes constructing after the first render
      if (this.attempts++ < 20) setTimeout(() => this.refresh(force), 300);
      return;
    }
    const first = this.state !== 'ready';
    const before = first ? '' : this.signature();
    this.state = 'loading';
    if (first) this.draw();

    try {
      const { data: session } = await client.auth.getSession();
      if (!(session && session.session)) {
        this.pets = [];
        this.vaccines = {};
        this.state = 'ready';
        this.fetchedAt = Date.now();
        this.draw();
        return;
      }
      const { data: pets, error } = await client
        .from('registered_pets')
        .select('id, name, species, breed, gender, color, age_months, status, nfc_tag, photo_url, registered_on, created_at, description')
        // Only this account's pets: an account that is also an approved admin can read every pet through RLS
        .eq('owner_id', session.session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      const ids = (pets || []).map((p) => p.id);
      let rows = [];
      if (ids.length) {
        const res = await client
          .from('pet_vaccinations')
          .select('id, pet_id, vaccine_name, date_given, next_due_date, veterinarian, clinic, notes, document_path, document_name, document_type, created_at')
          .in('pet_id', ids)
          .order('date_given', { ascending: false });
        if (res.error) throw new Error(res.error.message);
        rows = res.data || [];
      }
      const grouped = {};
      rows.forEach((r) => { (grouped[r.pet_id] = grouped[r.pet_id] || []).push(r); });

      this.pets = pets || [];
      this.mirrorToDevice(this.pets);
      this.vaccines = grouped;
      this.state = 'ready';
      this.attempts = 0;
      this.fetchedAt = Date.now();
    } catch (err) {
      console.warn('[Pets] load failed:', err);
      this.state = 'error';
      this.error = err.message;
    }
    // Same data as already on screen: leave the page alone, redrawing it makes the cards and photos flash
    if (!first && this.state === 'ready' && before === this.signature()) return;
    this.draw();
    if (this.openPetId) this.renderDetail();
  }

  signature() {
    return JSON.stringify([this.pets, this.vaccines]);
  }

  // The missing-pet report lists pets from the copy saved on this device, so make sure every pet
  // in the account is in it (a new phone, for instance, starts empty)
  mirrorToDevice(pets) {
    const store = window.pawStore;
    const user = store.getGoogleUser() || {};
    pets.forEach((p) => {
      const local = store.getPetById(p.id);
      if (local && local.name) return; // a saved copy with no name is only a leftover: fill it in
      store.savePet({
        id: p.id, name: p.name, species: p.species, breed: p.breed, gender: p.gender, color: p.color,
        age: this.formatAge(p.age_months), ageMonths: p.age_months, description: p.description || '',
        nfcTag: p.nfc_tag || '', photoUrl: p.photo_url, status: p.status === 'missing' ? 'lost' : p.status,
        registeredDate: p.registered_on,
        owner: { name: user.name || '', phone: user.phone || '', email: user.email || '', address: '' }
      });
    });
  }

  // ---------- helpers ----------

  formatAge(months) {
    if (months == null) return '';
    const m = Number(months);
    if (m < 12) return `${m} ${m === 1 ? 'month' : 'months'}`;
    const y = Math.floor(m / 12);
    const rest = m % 12;
    return `${y} ${y === 1 ? 'year' : 'years'}${rest ? ` ${rest} mo` : ''}`;
  }

  fmtDate(value) {
    if (!value) return '';
    const d = new Date(value + (String(value).length === 10 ? 'T00:00:00' : ''));
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { dateStyle: 'medium' });
  }

  daysUntil(value) {
    const due = new Date(value + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
  }

  // The day after an ISO date (YYYY-MM-DD), as an ISO date
  dayAfter(iso) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // The state of one record's next dose, or null when no due date was given
  dueInfo(row) {
    if (!row.next_due_date) return null;
    const days = this.daysUntil(row.next_due_date);
    if (days < 0) return { cls: 'overdue', label: `Overdue by ${-days} ${-days === 1 ? 'day' : 'days'}` };
    if (days === 0) return { cls: 'soon', label: 'Due today' };
    if (days <= 30) return { cls: 'soon', label: `Due in ${days} ${days === 1 ? 'day' : 'days'}` };
    return { cls: 'ok', label: `Next due ${this.fmtDate(row.next_due_date)}` };
  }

  // Worst state across a pet's records, for the card badge
  summary(petId) {
    const rows = this.vaccines[petId] || [];
    if (!rows.length) return { cls: 'none', label: this.t('pets.noVaccines', 'No vaccines recorded') };
    let worst = null;
    rows.forEach((r) => {
      const info = this.dueInfo(r);
      if (!info) return;
      const rank = { overdue: 3, soon: 2, ok: 1 }[info.cls];
      if (!worst || rank > worst.rank) worst = { ...info, rank };
    });
    if (worst && worst.cls !== 'ok') return worst;
    return { cls: 'ok', label: `${rows.length} ${rows.length === 1 ? 'vaccine' : 'vaccines'} recorded` };
  }

  // ---------- approved claims (an impounded pet the facility accepted as yours) ----------

  async loadApprovedClaims() {
    const user = window.pawStore.getGoogleUser();
    const client = this.client();
    if (!user || !user.id || !client) return;
    const { data, error } = await client.from('impound_claims').select('id, impound_id, status, decided_at, created_at').eq('claimant_id', user.id).eq('status', 'accepted').order('decided_at', { ascending: false });
    if (error) return; // the claims table may not exist yet: nothing to show
    const next = JSON.stringify(data || []);
    if (next === this._claimsKey) return;
    this._claimsKey = next;
    this.approvedClaims = data || [];
    this.draw();
  }

  claimsSectionHtml() {
    const claims = (this.approvedClaims || []).map((c) => ({ c, imp: (window.pawStore.getImpoundments() || []).find((i) => String(i.id) === String(c.impound_id)) })).filter((x) => x.imp && x.imp.status !== 'claimed');
    if (!claims.length) return '';
    return `
      <section class="claim-approved" aria-label="Approved claims">
        <h2><i data-lucide="badge-check"></i> Claim approved</h2>
        ${claims.map(({ c, imp }) => {
          const shelter = (window.pawStore.getShelters() || []).find((x) => x.id === imp.shelterId) || {};
          const photo = /^https:\/\//.test(imp.photoUrl || '') ? imp.photoUrl : '';
          return `
          <article class="claim-approved-card">
            ${photo ? `<img src="${this.esc(photo)}" alt="" />` : '<span class="claim-approved-noimg"><i data-lucide="paw-print"></i></span>'}
            <div class="claim-approved-text">
              <strong>${this.esc(imp.petName || 'Your pet')} is ready to be collected</strong>
              <span>Go to <b>${this.esc(shelter.name || imp.shelterName || 'the facility')}</b>${shelter.address ? ', ' + this.esc(shelter.address) : ''} and show your Digital NFC card.</span>
            </div>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.petsView.openClaimCard('${this.esc(c.id)}')"><i data-lucide="nfc"></i> Digital NFC card</button>
          </article>`;
        }).join('')}
      </section>`;
  }

  // A printable card the facility checks when the owner collects the pet
  openClaimCard(claimId) {
    const c = (this.approvedClaims || []).find((x) => String(x.id) === String(claimId));
    if (!c) return;
    const imp = (window.pawStore.getImpoundments() || []).find((i) => String(i.id) === String(c.impound_id)) || {};
    const shelter = (window.pawStore.getShelters() || []).find((x) => x.id === imp.shelterId) || {};
    const user = window.pawStore.getGoogleUser() || {};
    const photo = /^https:\/\//.test(imp.photoUrl || '') ? imp.photoUrl : '';
    let modal = document.getElementById('claim-card-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'claim-card-modal';
      modal.addEventListener('mousedown', (e) => { if (e.target === modal) window.notifManager.closeModal('claim-card-modal'); });
      document.body.appendChild(modal);
    }
    const ref = String(c.id).replace(/-/g, '').slice(0, 8).toUpperCase();
    const rows = [
      ['Animal', imp.petName || 'Unidentified'], ['Species', [imp.species, imp.breed].filter(Boolean).join(' · ')], ['Kennel', imp.kennel || imp.cageNumber],
      ['Release to', user.name], ['Facility', shelter.name || imp.shelterName], ['Address', shelter.address], ['Hours', shelter.hours],
      ['Approved on', c.decided_at ? new Date(c.decided_at).toLocaleDateString([], { dateStyle: 'long' }) : '']
    ].filter(([, v]) => v);
    modal.innerHTML = `
      <div class="modal-box claim-card-box" role="dialog" aria-modal="true" aria-label="Digital NFC card">
        <div class="claim-card" id="claim-card-print">
          <div class="claim-card-head"><span class="claim-card-brand"><img src="images/pawtrack-logo.svg" alt="" />PawTrack</span><span class="claim-card-tag"><i data-lucide="nfc"></i> DIGITAL NFC CARD</span></div>
          <div class="claim-card-main">
            ${photo ? `<img class="claim-card-photo" src="${this.esc(photo)}" alt="" />` : '<span class="claim-card-photo is-empty"><i data-lucide="paw-print"></i></span>'}
            <div><div class="claim-card-ref">Claim no.</div><div class="claim-card-refno">${this.esc(ref)}</div><div class="claim-card-status">APPROVED</div></div>
          </div>
          <dl class="claim-card-rows">${rows.map(([k, v]) => `<div><dt>${this.esc(k)}</dt><dd>${this.esc(v)}</dd></div>`).join('')}</dl>
          <p class="claim-card-foot">Show this card and a valid ID to the facility staff to collect your pet.</p>
        </div>
        <div class="claim-card-actions no-print">
          <button type="button" class="btn btn-outline" onclick="window.notifManager.closeModal('claim-card-modal')">Close</button>
          <button type="button" class="btn btn-primary" onclick="window.petsView.printClaimCard()"><i data-lucide="printer"></i> Print card</button>
        </div>
      </div>`;
    window.notifManager.openModal('claim-card-modal');
    if (window.lucide) window.lucide.createIcons({ root: modal });
  }

  printClaimCard() {
    document.body.classList.add('printing-claim-card');
    const done = () => { document.body.classList.remove('printing-claim-card'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  }

  // ---------- edit a pet's details ----------

  startEdit() {
    this.editingPetId = this.openPetId;
    this.renderDetail();
    document.getElementById('pe-name')?.focus();
  }

  cancelEdit() {
    this.editingPetId = null;
    this.renderDetail();
  }

  editFormHtml(pet) {
    const months = Number(pet.age_months);
    const hasAge = pet.age_months != null && Number.isFinite(months);
    const years = hasAge ? Math.floor(months / 12) : '';
    const rest = hasAge ? months % 12 : '';
    const options = (list, current) => {
      const all = current && !list.includes(current) ? [...list, current] : list;
      return all.map((v) => `<option value="${this.esc(v)}"${v === current ? ' selected' : ''}>${this.esc(v)}</option>`).join('');
    };
    return `
      <form class="vax-form pet-edit-form" id="pet-edit-form" novalidate>
        <h4><i data-lucide="pencil"></i> Edit ${this.esc(pet.name)}'s details</h4>
        <div class="vax-msg" id="pe-msg" role="alert" hidden></div>
        <div class="vax-row">
          <div class="vax-field" id="pe-name-field">
            <label for="pe-name">Name *</label>
            <input id="pe-name" maxlength="60" value="${this.esc(pet.name)}" autocomplete="off" />
            <span class="vax-error">Enter your pet's name.</span>
          </div>
          <div class="vax-field" id="pe-species-field">
            <label for="pe-species">Species *</label>
            <select id="pe-species">${options(window.PawSpecies.KEYS, window.PawSpecies.normalize(pet.species))}</select>
            <span class="vax-error">Choose the species.</span>
          </div>
        </div>
        <div class="vax-row">
          <div class="vax-field" id="pe-breed-field">
            <label for="pe-breed">Breed <span class="vax-opt">(optional)</span></label>
            <input id="pe-breed" maxlength="80" value="${this.esc(pet.breed || '')}" placeholder="e.g. Aspin" autocomplete="off" />
          </div>
          <div class="vax-field" id="pe-gender-field">
            <label for="pe-gender">Gender <span class="vax-opt">(optional)</span></label>
            <select id="pe-gender"><option value="">Not set</option>${options(['Male', 'Female'], pet.gender || '')}</select>
          </div>
        </div>
        <div class="vax-row">
          <div class="vax-field" id="pe-years-field">
            <label for="pe-years">Age (years)</label>
            <input id="pe-years" type="number" min="0" max="40" inputmode="numeric" value="${years}" placeholder="0" />
            <span class="vax-error">Enter a valid age.</span>
          </div>
          <div class="vax-field" id="pe-months-field">
            <label for="pe-months">Age (months)</label>
            <input id="pe-months" type="number" min="0" max="11" inputmode="numeric" value="${rest}" placeholder="0" />
            <span class="vax-error">Months go from 0 to 11.</span>
          </div>
        </div>
        <div class="vax-field" id="pe-color-field">
          <label for="pe-color">Color &amp; markings <span class="vax-opt">(optional)</span></label>
          <input id="pe-color" maxlength="120" value="${this.esc(pet.color || '')}" placeholder="e.g. Brown with a white chest" autocomplete="off" />
        </div>
        <div class="vax-field" id="pe-desc-field">
          <label for="pe-desc">Description <span class="vax-opt">(optional)</span></label>
          <textarea id="pe-desc" maxlength="500" rows="3" placeholder="Anything that helps someone recognise ${this.esc(pet.name)}">${this.esc(pet.description || '')}</textarea>
        </div>
        <div class="pet-edit-actions">
          <button type="button" class="btn btn-outline" onclick="window.petsView.cancelEdit()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="pe-save"><i data-lucide="check"></i> Save changes</button>
        </div>
      </form>`;
  }

  async saveEdit(petId) {
    const pet = this.pets.find((p) => p.id === petId);
    if (!pet) return;
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const name = val('pe-name');
    const species = val('pe-species');
    const years = val('pe-years');
    const months = val('pe-months');
    const yearsOk = years === '' || (/^\d+$/.test(years) && +years <= 40);
    const monthsOk = months === '' || (/^\d+$/.test(months) && +months <= 11);
    const checks = [['pe-name', name.length >= 1], ['pe-species', !!species], ['pe-years', yearsOk], ['pe-months', monthsOk]];
    checks.forEach(([id, ok]) => document.getElementById(id + '-field')?.classList.toggle('has-error', !ok));
    const failed = checks.find(([, ok]) => !ok);
    if (failed) { document.getElementById(failed[0])?.focus(); return; }

    const ageMonths = (years === '' && months === '') ? null : (+years || 0) * 12 + (+months || 0);
    const update = {
      name,
      species,
      breed: val('pe-breed') || null,
      gender: val('pe-gender') || null,
      color: val('pe-color') || null,
      age_months: ageMonths,
      description: val('pe-desc') || null
    };
    const btn = document.getElementById('pe-save');
    const msg = document.getElementById('pe-msg');
    if (msg) { msg.hidden = true; msg.textContent = ''; }
    if (btn) btn.disabled = true;
    const { error } = await this.client().from('registered_pets').update(update).eq('id', petId);
    if (error) {
      if (btn) btn.disabled = false;
      if (msg) { msg.textContent = `Could not save the changes: ${error.message}`; msg.hidden = false; }
      return;
    }
    Object.assign(pet, update);
    // The saved copy on this device (used by the report form) follows
    const store = window.pawStore;
    const local = store && store.getPetById ? store.getPetById(petId) : null;
    if (local) store.savePet({ ...local, name, species, breed: update.breed || '', gender: update.gender || '', color: update.color || '', ageMonths, age: this.formatAge(ageMonths), description: update.description || '' });
    this.editingPetId = null;
    this.draw();
    // One dialog at a time: the details modal closes, so the screen is not darkened twice
    this.close();
    if (window.notifManager) window.notifManager.showDialog({
      tone: 'success',
      title: 'Details updated',
      message: `${name}'s details were saved.`,
      rows: [
        ['Name', name], ['Species', species], ['Breed', update.breed], ['Gender', update.gender],
        ['Age', ageMonths != null ? this.formatAge(ageMonths) : ''], ['Color & markings', update.color]
      ],
      actions: [{ label: 'Done', primary: true }, { label: 'View details', onClick: () => this.open(petId) }]
    });
  }

  // ---------- sightings of this pet (someone saw it, or you verified it) ----------

  // Sightings posted for this pet's missing reports, newest first (dismissed and archived ones are not listed)
  petSightings(pet) {
    const store = window.pawStore;
    if (!store || !pet) return [];
    const ids = new Set((store.getMissingReports ? store.getMissingReports() : []).filter((r) => String(r.petId) === String(pet.id)).map((r) => String(r.id)));
    const active = store.getActiveMissingReportForPet ? store.getActiveMissingReportForPet(pet.id) : null;
    if (active) ids.add(String(active.id));
    const when = (x) => new Date(x.createdAt || x.dateTimeSeen || 0).getTime() || 0;
    return (store.getSightings() || [])
      .filter((x) => x.status !== 'dismissed' && x.status !== 'archived'
        && (ids.has(String(x.missing_report_id)) || String(x.matchedPetId) === String(pet.id) || String(x.petId) === String(pet.id)))
      .sort((a, b) => when(b) - when(a));
  }

  sightingCounts(pet) {
    const list = this.petSightings(pet);
    return { possible: list.filter((x) => x.status !== 'confirmed_sighting').length, confirmed: list.filter((x) => x.status === 'confirmed_sighting').length };
  }

  timeAgo(value) {
    const t = new Date(value).getTime();
    if (!t) return '';
    const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return days < 30 ? `${days} ${days === 1 ? 'day' : 'days'} ago` : this.fmtDate(String(value).slice(0, 10));
  }

  sightingChipHtml(pet) {
    const c = this.sightingCounts(pet);
    if (!c.possible && !c.confirmed) return '';
    const parts = [];
    if (c.possible) parts.push(`<span class="pet-sight-chip is-new"><i data-lucide="eye"></i>${c.possible} ${c.possible === 1 ? 'sighting' : 'sightings'} to verify</span>`);
    if (c.confirmed) parts.push(`<span class="pet-sight-chip is-confirmed"><i data-lucide="badge-check"></i>${c.confirmed === 1 ? 'Sighting verified' : `${c.confirmed} sightings verified`}</span>`);
    return `<div class="pet-sight-chips">${parts.join('')}</div>`;
  }

  sightingsSectionHtml(pet) {
    const list = this.petSightings(pet);
    if (!list.length) return '';
    return `
      <section class="pet-sightings" aria-label="Sightings of ${this.esc(pet.name)}">
        <h3><i data-lucide="eye"></i> Sightings <span class="vax-count">${list.length}</span></h3>
        ${list.map((x) => {
          const confirmed = x.status === 'confirmed_sighting';
          const photo = x.photoUrl || x.photo || '';
          return `
          <div class="pet-sight-row${confirmed ? ' is-confirmed' : ''}">
            ${photo ? `<img src="${this.esc(photo)}" alt="" loading="lazy" onerror="this.remove()" />` : '<span class="pet-sight-noimg"><i data-lucide="map-pin"></i></span>'}
            <div class="pet-sight-info">
              <strong>${confirmed ? 'Sighting verified' : 'Someone may have seen ' + this.esc(pet.name)}</strong>
              <span>${this.esc(x.location || 'Location not shared')}</span>
              <small>${this.esc(this.timeAgo(x.createdAt || x.dateTimeSeen))}${x.reporterName ? ' · ' + this.esc(x.reporterName) : ''}</small>
            </div>
            <button type="button" class="btn ${confirmed ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="window.petsView.${confirmed ? 'openNextSteps' : 'openSighting'}('${this.esc(x.id)}')">
              <i data-lucide="${confirmed ? 'route' : 'shield-check'}"></i> ${confirmed ? 'Next steps' : 'Verify'}
            </button>
          </div>`;
        }).join('')}
      </section>`;
  }

  // Opens the same Owner Verification dialog as the notification and the Verify button on the post
  openSighting(sightingId) {
    this.close();
    if (window.notifManager) window.notifManager.openSightingVerificationModal(sightingId);
  }

  async openNextSteps(sightingId) {
    const caseId = window.pawStore.getCaseIdForSighting ? await window.pawStore.getCaseIdForSighting(sightingId) : null;
    this.close();
    if (caseId && window.notifManager) window.notifManager.openReunionCase(caseId);
    else if (window.notifManager) window.notifManager.openSightingVerificationModal(sightingId);
  }

  statusLabel(status) {
    return { safe: 'Safe', missing: 'Missing', impounded: 'Impounded', reunited: 'Reunited' }[status] || 'Safe';
  }

  // ---------- list page ----------

  render(container) {
    this.container = container;
    this.draw();
    this.refresh();
  }

  draw() {
    if (!this.container || (window.pawApp && window.pawApp.currentView !== 'pets')) return;
    const user = window.pawStore.getGoogleUser();
    let body;

    if (!user || !user.name) {
      body = this.emptyState('lock', 'Sign in to see your pets', 'Your registered pets and their vaccination records are tied to your account.', `<button class="btn btn-primary" onclick="window.pawApp.openLoginDialog && window.pawApp.openLoginDialog()">Log In</button>`);
    } else if ((this.state === 'loading' && !this.fetchedAt) || this.state === 'idle') {
      body = `<div class="pets-grid">${[1, 2, 3].map(() => '<div class="pet-card pet-card-skeleton" aria-hidden="true"></div>').join('')}</div>`;
    } else if (this.state === 'error') {
      body = this.emptyState('wifi-off', 'Could not load your pets', this.esc(this.error || 'Check your connection and try again.'), `<button class="btn btn-primary" onclick="window.petsView.refresh(true)">Try again</button>`);
    } else if (!this.pets.length) {
      body = this.emptyState('paw-print', 'No pets yet', 'Register your first pet and link an NFC tag to its collar. Then keep its vaccination records here.', `<button class="btn btn-primary" onclick="window.ownerView && window.ownerView.openRegisterModal()"><i data-lucide="plus-circle"></i> Register Pet</button>`);
    } else {
      body = `<div class="pets-grid${this.layout === 'rows' ? ' is-rows' : ''}">${this.pets.map((p) => this.cardHtml(p)).join('')}</div>`;
    }

    const showToggle = this.pets.length > 0 && (this.state === 'ready' || (this.state === 'loading' && !!this.fetchedAt));
    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>${this.t('pets.title', 'My Pets')}</h1>
          <div class="view-subtitle">${this.t('pets.subtitle', 'Tap a pet to see its details and keep its vaccination records.')}</div>
        </div>
      </div>
      <div class="pets-toolbar">
        <button class="btn btn-primary btn-sm" onclick="window.ownerView && window.ownerView.openRegisterModal()">
          <i data-lucide="plus-circle"></i> ${this.t('pets.register', 'Register Pet')}
        </button>
        ${showToggle ? `<button class="btn btn-secondary btn-sm pets-layout-btn" id="btn-pets-layout" onclick="window.petsView.toggleLayout()" title="${this.layout === 'rows' ? 'Show as tiles' : 'Show as rows'}" aria-label="${this.layout === 'rows' ? 'Show pets as tiles' : 'Show pets as rows'}">
            <i data-lucide="${this.layout === 'rows' ? 'layout-grid' : 'list'}"></i>
          </button>` : ''}
      </div>
      ${user && user.name ? this.claimsSectionHtml() : ''}
      ${body}`;
    if (window.lucide) window.lucide.createIcons({ root: this.container });
  }

  loadLayout() {
    try { return localStorage.getItem('pawtrack_pets_layout') === 'rows' ? 'rows' : 'tiles'; } catch (e) { return 'tiles'; }
  }

  // Switch between tiles and rows; the choice is remembered on this device
  toggleLayout() {
    this.layout = this.layout === 'rows' ? 'tiles' : 'rows';
    try { localStorage.setItem('pawtrack_pets_layout', this.layout); } catch (e) { /* private mode: just not remembered */ }
    this.draw();
  }

  emptyState(icon, title, text, action) {
    return `<div class="glass-card pets-empty"><div class="pets-empty-icon"><i data-lucide="${icon}"></i></div><h2>${title}</h2><p>${text}</p>${action}</div>`;
  }

  cardHtml(p) {
    const sum = this.summary(p.id);
    const photo = p.photo_url
      ? `<img src="${this.esc(p.photo_url)}" alt="${this.esc(p.name)}" loading="lazy" decoding="async" />`
      : '<div class="pet-card-noimg"><i data-lucide="paw-print"></i></div>';
    const meta = [p.breed, p.species].filter(Boolean).join(' · ');
    return `
      <button type="button" class="pet-card" onclick="window.petsView.open('${this.esc(p.id)}')" aria-label="${this.esc(p.name)}">
        <div class="pet-card-photo">${photo}<span class="pet-status pet-status-${this.esc(p.status)}">${this.statusLabel(p.status)}</span></div>
        <div class="pet-card-body">
          <div class="pet-card-name">${this.esc(p.name)}</div>
          <div class="pet-card-meta">${this.esc(meta)}${p.age_months != null ? ` · ${this.esc(this.formatAge(p.age_months))}` : ''}</div>
          <div class="vax-chip vax-${sum.cls}"><i data-lucide="syringe"></i>${this.esc(sum.label)}</div>
          ${this.sightingChipHtml(p)}
        </div>
      </button>`;
  }

  // ---------- detail screen ----------

  open(petId) {
    this.openPetId = petId;
    this.renderDetail();
    window.notifManager.openModal('pet-detail-modal');
  }

  close() {
    this.openPetId = null;
    this.editingPetId = null;
    window.notifManager.closeModal('pet-detail-modal');
  }

  renderDetail() {
    const body = document.getElementById('pet-detail-body');
    const pet = this.pets.find((p) => p.id === this.openPetId);
    if (!body || !pet) return;
    const rows = this.vaccines[pet.id] || [];
    const missing = pet.status === 'missing';
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const todayIso = today.toISOString().slice(0, 10);

    const facts = [
      ['Species', pet.species], ['Breed', pet.breed], ['Gender', pet.gender],
      ['Age', this.formatAge(pet.age_months)], ['Color & markings', pet.color]
    ].filter(([, v]) => v);
    const nfcBadge = pet.nfc_tag
      ? `<span class="pet-nfc-badge is-linked" title="Tag ${this.esc(pet.nfc_tag)}"><i data-lucide="nfc"></i> NFC linked</span>`
      : '<span class="pet-nfc-badge"><i data-lucide="nfc"></i> No NFC</span>';

    body.innerHTML = `
      <div class="pet-detail-hero">
        ${pet.photo_url ? `<img src="${this.esc(pet.photo_url)}" alt="${this.esc(pet.name)}" />` : '<div class="pet-card-noimg"><i data-lucide="paw-print"></i></div>'}
        <div>
          <h2>${this.esc(pet.name)}</h2>
          <div class="pet-detail-badges">
            <span class="pet-status pet-status-${this.esc(pet.status)} pet-status-inline">${this.statusLabel(pet.status)}</span>
            ${nfcBadge}
          </div>
        </div>
      </div>
      ${pet.description ? `<p class="pet-detail-desc">${this.esc(pet.description)}</p>` : ''}
      ${this.statusActionHtml(pet)}
      ${this.sightingsSectionHtml(pet)}
      ${pet.nfc_tag ? '' : `
      <div class="pet-pass-row pet-link-row">
        <div class="pet-pass-text">
          <strong><i data-lucide="nfc"></i> No NFC tag yet</strong>
          <span>Link a tag to ${this.esc(pet.name)}'s collar so a finder can reach you. Pets without one can be fined under Section 35.</span>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.nfcReminders && window.nfcReminders.linkNow('${this.esc(pet.id)}')"><i data-lucide="nfc"></i> Link NFC tag</button>
      </div>`}
      ${pet.nfc_tag ? `
      <div class="pet-pass-row">
        <div class="pet-pass-text">
          <strong><i data-lucide="credit-card"></i> Digital NFC pass <button type="button" class="pass-info-btn" onclick="window.notifManager.openModal('pass-info-modal')" aria-label="About the Digital NFC pass" title="What is this?"><i data-lucide="info"></i></button></strong>
          <span>Save ${this.esc(pet.name)}'s pass as an image to keep on your phone.</span>
        </div>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.petsView.savePass('${this.esc(pet.id)}')"><i data-lucide="download"></i> Save pass</button>
      </div>
      ` : ''}
      ${this.editingPetId === pet.id ? this.editFormHtml(pet) : `
      <div class="pet-facts-head">
        <h3><i data-lucide="id-card"></i> Pet details</h3>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.petsView.startEdit()"><i data-lucide="pencil"></i> Edit details</button>
      </div>
      <dl class="pet-detail-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${this.esc(v)}</dd></div>`).join('')}</dl>`}

      <section class="vax-section">
        <h3><i data-lucide="syringe"></i> Vaccinations <span class="vax-count">${rows.length}</span></h3>
        <div class="vax-list" id="vax-list">
          ${rows.length ? rows.map((r) => this.vaxRowHtml(r)).join('') : `<p class="vax-empty">No vaccinations recorded yet.${missing ? '' : ' Add the first one below.'}</p>`}
        </div>

        ${missing ? `<div class="pet-missing-note"><i data-lucide="lock"></i><span>Vaccinations can't be added while ${this.esc(pet.name)} is missing. Mark ${this.esc(pet.name)} as found to add one.</span></div>` : `<form class="vax-form" id="vax-form" novalidate>
          <h4>Add a vaccination</h4>
          <div class="vax-msg" id="vax-msg" role="alert" hidden></div>
          <div class="vax-field" id="vax-name-field">
            <label for="vax-name">Vaccine *</label>
            <input id="vax-name" list="vax-names" maxlength="120" placeholder="e.g. Rabies" autocomplete="off" />
            <datalist id="vax-names">${COMMON_VACCINES.map((v) => `<option value="${this.esc(v)}"></option>`).join('')}</datalist>
            <span class="vax-error">Enter the vaccine name.</span>
          </div>
          <div class="vax-row">
            <div class="vax-field" id="vax-given-field">
              <label for="vax-given">Date given *</label>
              <input id="vax-given" type="date" max="${todayIso}" value="${todayIso}" />
              <span class="vax-error">Pick a date that is not in the future.</span>
            </div>
            <div class="vax-field" id="vax-due-field">
              <label for="vax-due">Next due <span class="vax-opt">(optional)</span></label>
              <input id="vax-due" type="date" min="${this.dayAfter(todayIso)}" />
              <span class="vax-error" id="vax-due-error">Pick a date after the date given, or leave it empty.</span>
            </div>
          </div>
          <div class="vax-row">
            <div class="vax-field" id="vax-vet-field">
              <label for="vax-vet">Veterinarian *</label>
              <input id="vax-vet" maxlength="120" placeholder="e.g. Dr. Reyes" />
              <span class="vax-error">Enter the veterinarian's name.</span>
            </div>
            <div class="vax-field" id="vax-clinic-field">
              <label for="vax-clinic">Clinic *</label>
              <input id="vax-clinic" maxlength="160" placeholder="e.g. Happy Paws Vet" />
              <span class="vax-error">Enter the clinic.</span>
            </div>
          </div>
          <div class="vax-field" id="vax-notes-field">
            <label for="vax-notes">Notes <span class="vax-opt">(optional)</span></label>
            <textarea id="vax-notes" maxlength="1000" rows="2" placeholder="Batch number, reactions, reminders"></textarea>
          </div>
          <div class="vax-field" id="vax-doc-field">
            <label for="vax-doc">Vaccination document *</label>
            <div class="vax-drop" id="vax-drop">
              <input id="vax-doc" class="vax-drop-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
              <div class="vax-drop-empty" id="vax-drop-empty">
                <span class="vax-drop-icon"><i data-lucide="upload-cloud"></i></span>
                <span class="vax-drop-text"><b>Choose a file</b> or drag it here</span>
                <span class="vax-drop-sub">Photo or PDF of the vaccination card or vet certificate &middot; JPG, PNG, WebP, PDF &middot; up to 8 MB</span>
              </div>
              <div class="vax-drop-file" id="vax-drop-file" hidden>
                <span class="vax-drop-thumb" id="vax-drop-thumb"></span>
                <span class="vax-drop-meta"><b id="vax-drop-name"></b><span id="vax-drop-size"></span></span>
                <button type="button" class="vax-drop-remove" id="vax-drop-remove" aria-label="Remove file" title="Remove file"><i data-lucide="x"></i></button>
              </div>
            </div>
            <span class="vax-error" id="vax-doc-error">Choose a JPG, PNG, WebP or PDF file under 8 MB.</span>
          </div>
          <button type="submit" class="btn btn-primary" id="vax-submit"><i data-lucide="plus"></i> Add vaccination</button>
        </form>`}
      </section>`;

    const editForm = body.querySelector('#pet-edit-form');
    if (editForm) editForm.addEventListener('submit', (e) => { e.preventDefault(); this.saveEdit(pet.id); });
    const form = body.querySelector('#vax-form');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this.addVaccination(pet.id); });
    const givenInput = body.querySelector('#vax-given');
    const dueInput = body.querySelector('#vax-due');
    if (givenInput && dueInput) {
      const syncDue = () => {
        dueInput.min = givenInput.value ? this.dayAfter(givenInput.value) : '';
        if (dueInput.value && givenInput.value && dueInput.value <= givenInput.value) dueInput.value = ''; // no longer later than the date given
        document.getElementById('vax-due-field')?.classList.remove('has-error');
      };
      givenInput.addEventListener('change', syncDue);
      givenInput.addEventListener('input', syncDue);
      dueInput.addEventListener('input', () => document.getElementById('vax-due-field')?.classList.remove('has-error'));
      syncDue();
    }
    this.bindDropzone(body);
    if (window.lucide) window.lucide.createIcons({ root: body });
  }

  // The document picker: a drop zone that shows the chosen file (a thumbnail for a photo) with a remove button
  bindDropzone(root) {
    const drop = root.querySelector('#vax-drop');
    const input = root.querySelector('#vax-doc');
    if (!drop || !input) return;
    const empty = root.querySelector('#vax-drop-empty');
    const card = root.querySelector('#vax-drop-file');
    const thumb = root.querySelector('#vax-drop-thumb');
    let previewUrl = '';

    const size = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
    const show = () => {
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
      const file = input.files && input.files[0];
      drop.classList.toggle('has-file', !!file);
      empty.hidden = !!file;
      card.hidden = !file;
      root.querySelector('#vax-doc-field')?.classList.remove('has-error');
      if (!file) return;
      root.querySelector('#vax-drop-name').textContent = file.name;
      root.querySelector('#vax-drop-size').textContent = size(file.size);
      if (/^image\//.test(file.type)) {
        previewUrl = URL.createObjectURL(file);
        thumb.innerHTML = `<img src="${previewUrl}" alt="" />`;
      } else {
        thumb.innerHTML = '<i data-lucide="file-text"></i>';
        if (window.lucide) window.lucide.createIcons({ root: thumb });
      }
    };
    input.addEventListener('change', show);
    root.querySelector('#vax-drop-remove').addEventListener('click', (e) => {
      e.preventDefault();
      input.value = '';
      show();
    });
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) { input.files = files; show(); }
    });
  }

  // Report as missing (while safe) or mark as found (while missing)
  statusActionHtml(pet) {
    if (pet.status === 'safe') {
      return `<div class="pet-detail-actions">
        <button type="button" class="btn btn-danger" onclick="window.petsView.reportMissing('${this.esc(pet.id)}')"><i data-lucide="siren"></i> Report as missing</button>
      </div>`;
    }
    if (pet.status === 'missing') {
      return `<div class="pet-missing-note"><i data-lucide="triangle-alert"></i><span>${this.esc(pet.name)} is reported missing. Anyone who taps the tag sees an alert.</span></div>
      <div class="pet-detail-actions">
        <button type="button" class="btn btn-primary" id="pet-found-btn" onclick="window.petsView.markFound('${this.esc(pet.id)}')"><i data-lucide="check-circle-2"></i> Mark as found</button>
      </div>`;
    }
    return '';
  }

  // Opens the missing-pet report (last seen place, time, contact) for this pet
  reportMissing(petId) {
    const pet = this.pets.find((p) => p.id === petId);
    if (!pet || !window.reportManager) return;
    this.close();
    // The report form reads pets from the saved copy on this device, which may not have this one yet
    if (!window.pawStore.getPetById(pet.id)) {
      const user = window.pawStore.getGoogleUser() || {};
      window.pawStore.savePet({
        id: pet.id, name: pet.name, species: pet.species, breed: pet.breed, gender: pet.gender, color: pet.color,
        age: this.formatAge(pet.age_months), ageMonths: pet.age_months, nfcTag: pet.nfc_tag || '', photoUrl: pet.photo_url,
        status: 'safe', registeredDate: pet.registered_on,
        owner: { name: user.name || '', phone: user.phone || '', email: user.email || '', address: '' }
      });
    }
    window.reportManager.openReportModal('missing', pet.id);
  }

  markFound(petId) {
    // One "Mark as found" dialog for the whole app: it asks for the pet's condition and a proof photo
    if (window.publicView && window.publicView.openMarkFound) return window.publicView.openMarkFound(petId);
    return this.markFoundQuick(petId);
  }

  // The pet's status shown in this list after the dialog marked it found
  afterMarkedFound(petId) {
    const pet = this.pets.find((p) => p.id === petId);
    if (!pet) return;
    pet.status = 'safe';
    this.draw();
    if (this.openPetId === petId) this.renderDetail();
  }

  async markFoundQuick(petId) {
    const btn = document.getElementById('pet-found-btn');
    if (btn) btn.disabled = true;
    const ok = await this.setStatus(petId, 'safe');
    if (!ok) { if (btn) btn.disabled = false; return; }
    // Close the open report on this device too
    const store = window.pawStore;
    const report = store.getActiveMissingReportForPet && store.getActiveMissingReportForPet(petId);
    const pet = this.pets.find((p) => p.id === petId);
    if (store.getPetById(petId)) store.updatePetStatus(petId, 'safe');
    store.resolveCasesForPet(petId, { missingReportId: report && report.id, nfcTag: pet && pet.nfc_tag });
    if (report) store.updateMissingReport(report.id, { status: 'resolved' });
    if (window.notifManager) window.notifManager.showToast('Marked as found. Glad they are safe.', 'success', 3500);
  }

  // Saves a pet's status (safe / missing) to the database so the tap page shows the right state
  async setStatus(petId, status) {
    // The pet may not be in this list yet (it loads when My Pets opens, and a missing report can be filed from
    // another page), so the database is updated by id either way; the list is only refreshed when it has the pet
    const pet = this.pets.find((p) => p.id === petId);
    const client = this.client();
    if (!client || !/^[0-9a-f-]{36}$/i.test(petId)) return false;
    const { error } = await client.from('registered_pets').update({ status }).eq('id', petId);
    if (error) {
      console.warn('[Pets] status update failed:', error.message);
      if (window.notifManager) window.notifManager.showToast(`Could not update the status: ${error.message}`, 'error', 5000);
      return false;
    }
    if (pet) {
      pet.status = status;
      this.draw();
      if (this.openPetId === petId) this.renderDetail();
    }
    return true;
  }

  vaxRowHtml(r) {
    const info = this.dueInfo(r);
    const who = [r.veterinarian, r.clinic].filter(Boolean).join(' · ');
    return `
      <div class="vax-item">
        <div class="vax-item-main">
          <div class="vax-item-name">${this.esc(r.vaccine_name)}</div>
          <div class="vax-item-sub">Given ${this.esc(this.fmtDate(r.date_given))}${who ? ` · ${this.esc(who)}` : ''}</div>
          ${r.notes ? `<div class="vax-item-notes">${this.esc(r.notes)}</div>` : ''}
          ${info ? `<span class="vax-chip vax-${info.cls}">${this.esc(info.label)}</span>` : ''}
        </div>
        <div class="vax-item-actions">
          ${r.document_path ? `<button type="button" class="vax-del" onclick="window.petsView.viewDocument('${this.esc(r.id)}')" aria-label="View document" title="View document"><i data-lucide="file-text"></i></button>` : ''}
          <button type="button" class="vax-del" onclick="window.petsView.askDelete('${this.esc(r.id)}')" aria-label="Delete ${this.esc(r.vaccine_name)}" title="Delete"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`;
  }

  // Asks in a modal before a vaccination record is deleted
  askDelete(id) {
    const rec = (this.vaccines[this.openPetId] || []).find((r) => r.id === id);
    if (!rec) return;
    let modal = document.getElementById('vax-delete-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'vax-delete-modal';
      modal.addEventListener('mousedown', (e) => { if (e.target === modal) window.notifManager.closeModal('vax-delete-modal'); });
      document.body.appendChild(modal);
    }
    const who = [rec.veterinarian, rec.clinic].filter(Boolean).join(' · ');
    modal.innerHTML = `
      <div class="modal-box" role="alertdialog" aria-modal="true" aria-labelledby="vax-delete-title" style="max-width:420px;">
        <div class="modal-header">
          <h3 id="vax-delete-title">Delete vaccination?</h3>
          <button type="button" class="btn-outline btn-sm" onclick="window.notifManager.closeModal('vax-delete-modal')" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <p style="margin:0 0 0.6rem;">Are you sure you want to delete this vaccination record? This can't be undone.</p>
          <div class="vax-item-main">
            <div class="vax-item-name">${this.esc(rec.vaccine_name)}</div>
            <div class="vax-item-sub">Given ${this.esc(this.fmtDate(rec.date_given))}${who ? ` · ${this.esc(who)}` : ''}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.notifManager.closeModal('vax-delete-modal')">Keep it</button>
          <button type="button" class="btn btn-danger" id="vax-delete-confirm" onclick="window.petsView.deleteVaccination('${this.esc(rec.id)}')"><i data-lucide="trash-2"></i> Yes, delete</button>
        </div>
      </div>`;
    window.notifManager.openModal('vax-delete-modal');
    if (window.lucide) window.lucide.createIcons({ root: modal });
  }

  renderVaxList() {
    const list = document.getElementById('vax-list');
    const pet = this.pets.find((p) => p.id === this.openPetId);
    if (!list || !pet) return;
    const rows = this.vaccines[pet.id] || [];
    list.innerHTML = rows.length ? rows.map((r) => this.vaxRowHtml(r)).join('') : '<p class="vax-empty">No vaccinations recorded yet. Add the first one below.</p>';
    const count = document.querySelector('#pet-detail-body .vax-count');
    if (count) count.textContent = rows.length;
    if (window.lucide) window.lucide.createIcons({ root: list });
  }

  setMsg(text) {
    const box = document.getElementById('vax-msg');
    if (!box) return;
    box.textContent = text || '';
    box.hidden = !text;
  }

  async addVaccination(petId) {
    const current = this.pets.find((p) => p.id === petId);
    if (current && current.status === 'missing') return;
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const name = val('vax-name');
    const given = val('vax-given');
    const due = val('vax-due');
    const todayIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    // Checked top to bottom; the first one that fails gets the focus. The next due date is optional, but when one
    // is given it must come after the date the vaccine was given.
    const checks = [
      ['vax-name', name.length > 0],
      ['vax-given', !!given && given <= todayIso],
      ['vax-due', !due || (!!given && due > given)],
      ['vax-vet', val('vax-vet').length > 0],
      ['vax-clinic', val('vax-clinic').length > 0]
    ];
    checks.forEach(([id, ok]) => document.getElementById(id + '-field')?.classList.toggle('has-error', !ok));
    const failed = checks.find(([, ok]) => !ok);
    if (failed) {
      document.getElementById(failed[0])?.focus();
      return;
    }

    const vetName = val('vax-vet');
    const clinicName = val('vax-clinic');
    let file = document.getElementById('vax-doc')?.files?.[0] || null;
    const docField = document.getElementById('vax-doc-field');
    const docError = document.getElementById('vax-doc-error');
    if (file) {
      // Verify the file really is a photo or a PDF, and strip anything that could carry a script
      const check = await this.inspectDocument(file);
      if (!check.ok) {
        if (docError) docError.textContent = check.reason;
        docField.classList.add('has-error');
        return;
      }
      file = check.file;
    }
    // The document is required: the vaccination card or vet certificate is the proof of the record
    if (!file) {
      if (docError) docError.textContent = 'Please add the vaccination card or vet certificate (JPG, PNG, WebP or PDF, up to 8 MB).';
      docField.classList.add('has-error');
      document.getElementById('vax-doc')?.focus();
      return;
    }
    docField.classList.remove('has-error');

    const client = this.client();
    const btn = document.getElementById('vax-submit');
    this.setMsg('');
    btn.disabled = true;
    let uploadedPath = null;
    try {
      let doc = { document_path: null, document_name: null, document_type: null };
      if (file) {
        const { data: userData } = await client.auth.getUser();
        const uid = userData && userData.user && userData.user.id;
        if (!uid) throw new Error('Please sign in again.');
        const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' })[file.type];
        uploadedPath = `${uid}/${petId}/${crypto.randomUUID()}.${ext}`;
        const up = await client.storage.from('vaccination-documents').upload(uploadedPath, file, { contentType: file.type });
        if (up.error) { uploadedPath = null; throw new Error(`Document upload failed: ${up.error.message}`); }
        doc = { document_path: uploadedPath, document_name: file.name.slice(0, 200), document_type: file.type };
      }
      const { data, error } = await client.from('pet_vaccinations').insert({
        pet_id: petId,
        vaccine_name: name,
        date_given: given,
        next_due_date: due || null,
        veterinarian: val('vax-vet') || null,
        clinic: val('vax-clinic') || null,
        notes: val('vax-notes') || null,
        ...doc
      }).select('id, pet_id, vaccine_name, date_given, next_due_date, veterinarian, clinic, notes, document_path, document_name, document_type, created_at').single();
      if (error) throw new Error(error.message);

      this.vaccines[petId] = [data, ...(this.vaccines[petId] || [])].sort((a, b) => (a.date_given < b.date_given ? 1 : -1));
      this.renderDetail();
      this.draw(); // card badges
      const petName = (this.pets.find((p) => p.id === petId) || {}).name || 'your pet';
      if (window.notifManager) window.notifManager.showDialog({
        tone: 'success',
        title: 'Vaccination recorded',
        message: `${name} is now in ${petName}'s vaccination record.`,
        rows: [
          ['Vaccine', name],
          ['Given', this.fmtDate(given)],
          ['Next due', due ? this.fmtDate(due) : 'Not set'],
          ['Veterinarian', vetName],
          ['Clinic', clinicName]
        ],
        actions: [{ label: 'Done', primary: true }]
      });
    } catch (err) {
      console.warn('[Pets] add vaccination failed:', err);
      // Don't leave an orphan file behind if the record itself could not be saved
      if (uploadedPath) client.storage.from('vaccination-documents').remove([uploadedPath]).catch(() => {});
      btn.disabled = false;
      this.setMsg(`Could not save the vaccination: ${err.message}`);
    }
  }

  // Saves the open pet's digital NFC pass as an image (the same card as the Digital Pass screen)
  savePass(petId) {
    const pet = this.pets.find((p) => p.id === petId);
    if (!pet || !pet.nfc_tag || !window.ownerView) return;
    this.mirrorToDevice([pet]); // makes sure the saved copy on this device has the pet and guardian details
    window.ownerView.savePetPass(petId);
  }

  // Checks an upload before it leaves the browser. Returns { ok, file } or { ok:false, reason }.
  // - The real type comes from the file's first bytes, never from its name or the browser-reported type
  // - Photos are decoded and redrawn, which drops anything hidden in them (scripts, trailing data, EXIF/GPS)
  // - PDFs are refused if they carry scripts, auto-run actions, launch commands or embedded files
  async inspectDocument(file) {
    const MAX = 8 * 1024 * 1024;
    if (!file.size) return { ok: false, reason: 'That file is empty.' };
    if (file.size > MAX) return { ok: false, reason: 'That file is over 8 MB.' };

    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const startsWith = (...b) => b.every((v, i) => head[i] === v);
    const ascii = (from, to) => String.fromCharCode(...head.slice(from, to));
    let type = null;
    if (startsWith(0xFF, 0xD8, 0xFF)) type = 'image/jpeg';
    else if (startsWith(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) type = 'image/png';
    else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') type = 'image/webp';
    else if (ascii(0, 5) === '%PDF-') type = 'application/pdf';
    if (!type) return { ok: false, reason: 'Only real JPG, PNG, WebP or PDF files are accepted.' };

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const okExt = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'application/pdf': ['pdf'] }[type];
    if (!okExt.includes(ext)) return { ok: false, reason: 'The file name does not match its contents. Rename it or choose another file.' };

    if (type === 'application/pdf') {
      // Latin-1 keeps every byte as one character; #xx escapes in PDF names (e.g. /J#61vaScript) are decoded first
      const text = new TextDecoder('latin1').decode(new Uint8Array(await file.arrayBuffer()))
        .replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      const risky = /\/(JavaScript|JS|Launch|OpenAction|AA|EmbeddedFiles?|RichMedia|XFA|SubmitForm|ImportData|GoToR|GoToE)\b/;
      if (risky.test(text)) {
        return { ok: false, reason: 'This PDF contains scripts or embedded content and was blocked. Save it as a plain PDF or upload a photo instead.' };
      }
      return { ok: true, file: new File([file], file.name, { type }) };
    }

    // Photos: decode, then redraw onto a clean canvas and save that copy
    try {
      const bmp = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width; canvas.height = bmp.height;
      canvas.getContext('2d').drawImage(bmp, 0, 0);
      if (bmp.close) bmp.close();
      const blob = await new Promise((res) => canvas.toBlob(res, type, 0.92));
      if (!blob || blob.type !== type) throw new Error('re-encode failed');
      if (blob.size > MAX) return { ok: false, reason: 'That file is over 8 MB.' };
      return { ok: true, file: new File([blob], file.name, { type }) };
    } catch (e) {
      return { ok: false, reason: 'That image could not be read. It may be damaged or not a real photo.' };
    }
  }

  // Opens the stored document through a short-lived signed link (the bucket is private)
  async viewDocument(id) {
    const rec = (this.vaccines[this.openPetId] || []).find((r) => r.id === id);
    if (!rec || !rec.document_path) return;
    const win = window.open('', '_blank');
    try {
      const { data, error } = await this.client().storage.from('vaccination-documents').createSignedUrl(rec.document_path, 120);
      if (error || !data) throw new Error(error ? error.message : 'No link');
      if (win) win.location.href = data.signedUrl; else window.location.href = data.signedUrl;
    } catch (err) {
      if (win) win.close();
      this.setMsg(`Could not open the document: ${err.message}`);
    }
  }

  async deleteVaccination(id) {
    const petId = this.openPetId;
    const client = this.client();
    const btn = document.getElementById('vax-delete-confirm');
    if (btn) btn.disabled = true;
    try {
      const rec = (this.vaccines[petId] || []).find((r) => r.id === id);
      const { error } = await client.from('pet_vaccinations').delete().eq('id', id);
      if (error) throw new Error(error.message);
      if (rec && rec.document_path) client.storage.from('vaccination-documents').remove([rec.document_path]).catch(() => {});
      this.vaccines[petId] = (this.vaccines[petId] || []).filter((r) => r.id !== id);
      window.notifManager.closeModal('vax-delete-modal');
      this.renderVaxList();
      this.draw();
    } catch (err) {
      window.notifManager.closeModal('vax-delete-modal');
      this.renderVaxList();
      this.setMsg(`Could not delete the record: ${err.message}`);
    }
  }
}

window.petsView = new PetsView();
