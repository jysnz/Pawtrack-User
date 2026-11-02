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
    if (this.state === 'loading') return;
    if (!force && this.state === 'ready' && Date.now() - this.fetchedAt < 8000) return;

    const client = this.client();
    if (!client) {
      // pawApp finishes constructing after the first render
      if (this.attempts++ < 20) setTimeout(() => this.refresh(force), 300);
      return;
    }
    const first = this.state !== 'ready';
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
    this.draw();
    if (this.openPetId) this.renderDetail();
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
    } else if (this.state === 'loading' || this.state === 'idle') {
      body = `<div class="pets-grid">${[1, 2, 3].map(() => '<div class="pet-card pet-card-skeleton" aria-hidden="true"></div>').join('')}</div>`;
    } else if (this.state === 'error') {
      body = this.emptyState('wifi-off', 'Could not load your pets', this.esc(this.error || 'Check your connection and try again.'), `<button class="btn btn-primary" onclick="window.petsView.refresh(true)">Try again</button>`);
    } else if (!this.pets.length) {
      body = this.emptyState('paw-print', 'No pets yet', 'Register your first pet and link an NFC tag to its collar. Then keep its vaccination records here.', `<button class="btn btn-primary" onclick="window.ownerView && window.ownerView.openRegisterModal()"><i data-lucide="plus-circle"></i> Register Pet</button>`);
    } else {
      body = `<div class="pets-grid">${this.pets.map((p) => this.cardHtml(p)).join('')}</div>`;
    }

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>${this.t('pets.title', 'My Pets')}</h1>
          <div class="view-subtitle">${this.t('pets.subtitle', 'Tap a pet to see its details and keep its vaccination records.')}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window.ownerView && window.ownerView.openRegisterModal()">
          <i data-lucide="plus-circle"></i> ${this.t('pets.register', 'Register Pet')}
        </button>
      </div>
      ${body}`;
    if (window.lucide) window.lucide.createIcons({ root: this.container });
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
      ${pet.nfc_tag ? `
      <div class="pet-pass-row">
        <div class="pet-pass-text">
          <strong><i data-lucide="credit-card"></i> Digital NFC pass <button type="button" class="pass-info-btn" onclick="window.notifManager.openModal('pass-info-modal')" aria-label="About the Digital NFC pass" title="What is this?"><i data-lucide="info"></i></button></strong>
          <span>Save ${this.esc(pet.name)}'s pass as an image to keep on your phone.</span>
        </div>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.petsView.savePass('${this.esc(pet.id)}')"><i data-lucide="download"></i> Save pass</button>
      </div>
      ` : ''}
      <dl class="pet-detail-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${this.esc(v)}</dd></div>`).join('')}</dl>

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
              <input id="vax-due" type="date" />
              <span class="vax-error">Next due must be after the date given.</span>
            </div>
          </div>
          <div class="vax-row">
            <div class="vax-field">
              <label for="vax-vet">Veterinarian <span class="vax-opt">(optional)</span></label>
              <input id="vax-vet" maxlength="120" placeholder="e.g. Dr. Reyes" />
            </div>
            <div class="vax-field">
              <label for="vax-clinic">Clinic <span class="vax-opt">(optional)</span></label>
              <input id="vax-clinic" maxlength="160" placeholder="e.g. Happy Paws Vet" />
            </div>
          </div>
          <div class="vax-field">
            <label for="vax-notes">Notes <span class="vax-opt">(optional)</span></label>
            <textarea id="vax-notes" maxlength="1000" rows="2" placeholder="Batch number, reactions, reminders"></textarea>
          </div>
          <div class="vax-field" id="vax-doc-field">
            <label for="vax-doc">Vaccination document <span class="vax-opt">(photo or PDF, up to 8 MB)</span></label>
            <input id="vax-doc" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
            <span class="vax-error" id="vax-doc-error">Choose a JPG, PNG, WebP or PDF file under 8 MB.</span>
            <span class="vax-hint">Attach the vaccination card or vet certificate so it is kept safely with this record.</span>
          </div>
          <button type="submit" class="btn btn-primary" id="vax-submit"><i data-lucide="plus"></i> Add vaccination</button>
        </form>`}
      </section>`;

    const form = body.querySelector('#vax-form');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this.addVaccination(pet.id); });
    if (window.lucide) window.lucide.createIcons({ root: body });
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

    const nameOk = name.length > 0;
    const givenOk = !!given && given <= todayIso;
    const dueOk = !due || (givenOk && due >= given);
    document.getElementById('vax-name-field').classList.toggle('has-error', !nameOk);
    document.getElementById('vax-given-field').classList.toggle('has-error', !givenOk);
    document.getElementById('vax-due-field').classList.toggle('has-error', !dueOk);
    if (!nameOk || !givenOk || !dueOk) {
      document.getElementById(!nameOk ? 'vax-name' : (!givenOk ? 'vax-given' : 'vax-due')).focus();
      return;
    }

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
    docField.classList.remove('has-error');

    // Prompt once for a document; a second tap on the button saves without one
    if (!file && !this.skipDocPrompt) {
      this.skipDocPrompt = true;
      this.setMsg('Please add the vaccination document (card or vet certificate) so it stays on record. Tap "Add vaccination" again to save without one.');
      document.getElementById('vax-doc')?.focus();
      return;
    }
    this.skipDocPrompt = false;

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
      if (window.notifManager) window.notifManager.showToast(`${name} added.`, 'success', 3000);
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
