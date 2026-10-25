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
    this.confirmDeleteId = null;
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
        .select('id, name, species, breed, gender, color, age_months, status, nfc_tag, photo_url, registered_on, created_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      const ids = (pets || []).map((p) => p.id);
      let rows = [];
      if (ids.length) {
        const res = await client
          .from('pet_vaccinations')
          .select('id, pet_id, vaccine_name, date_given, next_due_date, veterinarian, clinic, notes, created_at')
          .in('pet_id', ids)
          .order('date_given', { ascending: false });
        if (res.error) throw new Error(res.error.message);
        rows = res.data || [];
      }
      const grouped = {};
      rows.forEach((r) => { (grouped[r.pet_id] = grouped[r.pet_id] || []).push(r); });

      this.pets = pets || [];
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
    this.confirmDeleteId = null;
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
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const todayIso = today.toISOString().slice(0, 10);

    const facts = [
      ['Species', pet.species], ['Breed', pet.breed], ['Gender', pet.gender],
      ['Age', this.formatAge(pet.age_months)], ['Color & markings', pet.color],
      ['NFC tag', pet.nfc_tag || 'Not linked']
    ].filter(([, v]) => v);

    body.innerHTML = `
      <div class="pet-detail-hero">
        ${pet.photo_url ? `<img src="${this.esc(pet.photo_url)}" alt="${this.esc(pet.name)}" />` : '<div class="pet-card-noimg"><i data-lucide="paw-print"></i></div>'}
        <div>
          <h2>${this.esc(pet.name)}</h2>
          <span class="pet-status pet-status-${this.esc(pet.status)} pet-status-inline">${this.statusLabel(pet.status)}</span>
        </div>
      </div>
      <dl class="pet-detail-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${this.esc(v)}</dd></div>`).join('')}</dl>

      <section class="vax-section">
        <h3><i data-lucide="syringe"></i> Vaccinations <span class="vax-count">${rows.length}</span></h3>
        <div class="vax-list" id="vax-list">
          ${rows.length ? rows.map((r) => this.vaxRowHtml(r)).join('') : '<p class="vax-empty">No vaccinations recorded yet. Add the first one below.</p>'}
        </div>

        <form class="vax-form" id="vax-form" novalidate>
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
          <button type="submit" class="btn btn-primary" id="vax-submit"><i data-lucide="plus"></i> Add vaccination</button>
        </form>
      </section>`;

    body.querySelector('#vax-form').addEventListener('submit', (e) => { e.preventDefault(); this.addVaccination(pet.id); });
    if (window.lucide) window.lucide.createIcons({ root: body });
  }

  vaxRowHtml(r) {
    const info = this.dueInfo(r);
    const who = [r.veterinarian, r.clinic].filter(Boolean).join(' · ');
    const confirming = this.confirmDeleteId === r.id;
    return `
      <div class="vax-item">
        <div class="vax-item-main">
          <div class="vax-item-name">${this.esc(r.vaccine_name)}</div>
          <div class="vax-item-sub">Given ${this.esc(this.fmtDate(r.date_given))}${who ? ` · ${this.esc(who)}` : ''}</div>
          ${r.notes ? `<div class="vax-item-notes">${this.esc(r.notes)}</div>` : ''}
          ${info ? `<span class="vax-chip vax-${info.cls}">${this.esc(info.label)}</span>` : ''}
        </div>
        <div class="vax-item-actions">
          ${confirming
            ? `<button type="button" class="btn btn-danger btn-sm" onclick="window.petsView.deleteVaccination('${this.esc(r.id)}')">Delete</button>
               <button type="button" class="btn btn-outline btn-sm" onclick="window.petsView.askDelete(null)">Keep</button>`
            : `<button type="button" class="vax-del" onclick="window.petsView.askDelete('${this.esc(r.id)}')" aria-label="Delete ${this.esc(r.vaccine_name)}" title="Delete"><i data-lucide="trash-2"></i></button>`}
        </div>
      </div>`;
  }

  askDelete(id) {
    this.confirmDeleteId = id;
    this.renderVaxList();
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

    const client = this.client();
    const btn = document.getElementById('vax-submit');
    this.setMsg('');
    btn.disabled = true;
    try {
      const { data, error } = await client.from('pet_vaccinations').insert({
        pet_id: petId,
        vaccine_name: name,
        date_given: given,
        next_due_date: due || null,
        veterinarian: val('vax-vet') || null,
        clinic: val('vax-clinic') || null,
        notes: val('vax-notes') || null
      }).select('id, pet_id, vaccine_name, date_given, next_due_date, veterinarian, clinic, notes, created_at').single();
      if (error) throw new Error(error.message);

      this.vaccines[petId] = [data, ...(this.vaccines[petId] || [])].sort((a, b) => (a.date_given < b.date_given ? 1 : -1));
      this.renderDetail();
      this.draw(); // card badges
      if (window.notifManager) window.notifManager.showToast(`${name} added.`, 'success', 3000);
    } catch (err) {
      console.warn('[Pets] add vaccination failed:', err);
      btn.disabled = false;
      this.setMsg(`Could not save the vaccination: ${err.message}`);
    }
  }

  async deleteVaccination(id) {
    const petId = this.openPetId;
    const client = this.client();
    try {
      const { error } = await client.from('pet_vaccinations').delete().eq('id', id);
      if (error) throw new Error(error.message);
      this.vaccines[petId] = (this.vaccines[petId] || []).filter((r) => r.id !== id);
      this.confirmDeleteId = null;
      this.renderVaxList();
      this.draw();
    } catch (err) {
      this.confirmDeleteId = null;
      this.renderVaxList();
      this.setMsg(`Could not delete the record: ${err.message}`);
    }
  }
}

window.petsView = new PetsView();
