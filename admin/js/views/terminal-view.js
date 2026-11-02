/**
 * PawTrack Admin — Shelter Terminal
 * Pick the receiving facility first, then scan or type a collar tag, look up the guardian,
 * and log the intake into holding. Facilities come from the database (Shelters page).
 */

window.TerminalView = {
  scanned: null,     // { code, pet } for the tag currently on screen
  facilityId: null,  // the facility this terminal session is working for

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  stepper(active) {
    const step = (n, label) => `
      <div class="tm-step ${active === n ? 'is-active' : ''} ${active > n ? 'is-done' : ''}">
        <span class="tm-step-dot">${active > n ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M20 6 9 17l-5-5"/></svg>' : n}</span>
        <span class="tm-step-label">${label}</span>
      </div>`;
    return `<div class="tm-stepper" aria-label="Progress">${step(1, 'Choose facility')}<span class="tm-step-line"></span>${step(2, 'Scan &amp; log intake')}</div>`;
  },

  facility() {
    if (!this.facilityId) return null;
    return window.adminStore.getShelters().find(s => s.id === this.facilityId) || null;
  },

  render(container) {
    // Opening the page afresh always asks for a facility first; refreshes while on the page keep it
    if (!container.querySelector('.tm-root')) {
      this.facilityId = null;
      this.scanned = null;
    }
    const shelters = window.adminStore.getShelters();
    if (this.facilityId && !shelters.some(s => s.id === this.facilityId)) this.facilityId = null;

    if (shelters.length === 0) return this.renderNoFacility(container);
    if (!this.facilityId) return this.renderPicker(container, shelters);
    return this.renderTerminal(container, this.facility());
  },

  // ----- Step 0: there is no facility in the database yet -----
  renderNoFacility(container) {
    container.innerHTML = `
      <div class="tm-root">
        <div class="view-header">
          <div class="view-header-titles">
            <h1>Shelter Terminal</h1>
            <div class="subtitle"><span>Scan a collar tag to look up the guardian and log the intake</span></div>
          </div>
        </div>
        <div class="nock-card tm-empty">
          <div class="tm-empty-icon" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/></svg>
          </div>
          <h2>No impound facility yet</h2>
          <p>The terminal logs animals into a shelter, so it needs at least one facility. Add the shelter or pound you work for and it will be saved to the database and shared with the Shelters and Impoundments pages.</p>
          <div class="tm-empty-actions">
            <button class="btn btn-primary" id="tm-add-shelter">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add a shelter
            </button>
            <a href="#shelters" class="btn btn-secondary">Open Shelters page</a>
          </div>
        </div>
      </div>`;
    container.querySelector('#tm-add-shelter').addEventListener('click', () => this.addShelter());
  },

  // ----- Step 1: choose a facility -----
  renderPicker(container, shelters) {
    const holding = window.adminStore.getImpoundments().filter(i => i.status === 'active_impounded');
    const pin = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    const building = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/></svg>';
    container.innerHTML = `
      <div class="tm-root">
        <div class="view-header">
          <div class="view-header-titles">
            <h1>Shelter Terminal</h1>
            <div class="subtitle"><span>Log animals into holding and notify their guardians</span></div>
          </div>
          <div class="view-header-actions">
            ${this.stepper(1)}
            <button class="btn btn-primary btn-sm" id="tm-add-shelter">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add a shelter
            </button>
          </div>
        </div>

        <div class="tm-picker-head">
          <h2>Where are you receiving animals?</h2>
          <p>Choose the facility for this session. Every intake you log will be recorded against it.</p>
        </div>

        <div class="tm-facility-grid">
          ${shelters.map(s => {
            const here = holding.filter(i => i.shelterId === s.id || i.shelterName === s.name).length;
            return `
              <button type="button" class="tm-card" data-facility="${this.esc(s.id)}">
                <span class="tm-card-top">
                  <span class="tm-avatar">${building}</span>
                  <span class="tm-badge ${here ? 'is-busy' : ''}">${here ? `${here} in holding` : 'No animals in holding'}</span>
                </span>
                <span class="tm-card-name">${this.esc(s.name)}</span>
                <span class="tm-card-addr">${pin}<span>${this.esc(s.address || 'No address on file')}</span></span>
                <span class="tm-card-stats">
                  <span><em>Hours</em><b>${this.esc(s.hours || 'Not set')}</b></span>
                  <span><em>Daily fee</em><b>${this.esc(s.fee || 'Not set')}</b></span>
                </span>
                <span class="tm-card-cta">Select facility
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </span>
              </button>`;
          }).join('')}
          <button type="button" class="tm-card tm-card-add" id="tm-add-shelter-card">
            <span class="tm-plus">+</span>
            <span class="tm-card-name">Add a new shelter</span>
            <span class="tm-card-addr tm-card-addr-plain">Not listed? Create it now and it becomes a facility you can select.</span>
          </button>
        </div>
      </div>`;
    container.querySelectorAll('[data-facility]').forEach(btn => btn.addEventListener('click', () => {
      this.facilityId = btn.getAttribute('data-facility');
      this.render(container);
    }));
    container.querySelector('#tm-add-shelter').addEventListener('click', () => this.addShelter());
    container.querySelector('#tm-add-shelter-card').addEventListener('click', () => this.addShelter());
  },

  // Creates a facility (saved to the database) and selects it
  addShelter() {
    if (!window.SheltersView || typeof window.SheltersView.openShelterModal !== 'function') {
      window.location.hash = '#shelters';
      return;
    }
    window.SheltersView.openShelterModal(null, {
      onCreated: async (dbId) => {
        const store = window.adminStore;
        try { await store.syncFromSupabase(); } catch (e) { /* the list is refreshed on the next sync anyway */ }
        if (dbId && store.getShelters().some(s => s.id === dbId)) this.facilityId = dbId;
        this.scanned = null;
        window.adminApp.renderView('terminal');
      }
    });
  },

  // ----- Step 2: the terminal, scoped to the chosen facility -----
  renderTerminal(container, facility) {
    const store = window.adminStore;
    const tags = store.getRfidTags();
    const here = store.getImpoundments().filter(i => i.shelterId === facility.id || i.shelterName === facility.name);
    const holding = here.filter(i => i.status === 'active_impounded');
    const overdue = holding.filter(i => Date.now() > new Date(i.claimDeadline).getTime()).length;

    container.innerHTML = `
      <div class="tm-root">
        <div class="view-header">
          <div class="view-header-titles">
            <h1>Shelter Terminal</h1>
            <div class="subtitle"><span>Scan a collar tag to look up the guardian and log the intake</span></div>
          </div>
          <div class="view-header-actions">${this.stepper(2)}</div>
        </div>

        <div class="tm-facility-bar">
          <div class="tm-facility-bar-info">
            <span class="tm-facility-bar-label">Receiving facility</span>
            <b>${this.esc(facility.name)}</b>
            <span>${this.esc(facility.address || '')}</span>
          </div>
          <button class="btn btn-secondary btn-sm" id="tm-change-facility">Change facility</button>
        </div>

        <div class="kpi-grid kpi-grid-3">
          <div class="kpi-card">
            <div class="kpi-label">In Holding Here</div>
            <div class="kpi-body"><div>
              <div class="kpi-value">${holding.length} ${holding.length === 1 ? 'Animal' : 'Animals'}</div>
              <div class="kpi-delta neutral">Within the 72-hour window</div>
            </div></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Past Holding Window</div>
            <div class="kpi-body"><div>
              <div class="kpi-value">${overdue} Overdue</div>
              <div class="kpi-delta neutral">Need release or follow-up</div>
            </div></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Reader</div>
            <div class="kpi-body"><div>
              <div class="kpi-value">Online</div>
              <div class="kpi-delta neutral">USB / NFC reader ready</div>
            </div></div>
          </div>
        </div>

        <div class="nock-card" style="padding: 18px; margin-bottom: 16px;">
          <div class="nock-card-title" style="margin-bottom: 10px;">Tag Lookup</div>
          <form id="terminal-scan-form" style="display: flex; gap: 8px; flex-wrap: wrap;">
            <input type="text" class="form-control" id="terminal-code" list="terminal-tag-list" placeholder="Tag code or microchip no." autocomplete="off" style="flex: 1; min-width: 220px;" />
            <datalist id="terminal-tag-list">
              ${tags.map(t => `<option value="${this.esc(t.code)}">${t.petName ? `Assigned to ${this.esc(t.petName)}` : 'Unassigned'}</option>`).join('')}
            </datalist>
            <button type="submit" class="btn btn-primary">Look Up</button>
          </form>
          <div id="terminal-result" style="margin-top: 16px;"></div>
        </div>

        <div class="table-container">
          <div class="table-toolbar">
            <span style="font-size: 12px; font-weight: 700; color: var(--ink-primary);">Recent Intakes at this facility</span>
            <div class="table-filters">
              <a href="#impoundments" class="mono-tag" style="font-size: 10px; text-decoration: none;">Open Impoundments</a>
            </div>
          </div>
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead><tr><th>Pet</th><th>Kennel</th><th>Intake</th><th>Status</th></tr></thead>
              <tbody>
                ${here.length === 0 ? `
                  <tr><td colspan="4" style="text-align: center; padding: 32px; color: var(--ink-muted);">No intakes logged at this facility yet.</td></tr>
                ` : here.slice(0, 6).map(imp => {
                  const outcome = window.IMPOUND_OUTCOMES && window.IMPOUND_OUTCOMES[imp.status];
                  return `
                    <tr>
                      <td>
                        <b>${this.esc(imp.petName || 'Unidentified Pet')}</b>
                        <div class="mono-tag" style="font-size: 9px; width: max-content; margin-top: 2px;">${this.esc(imp.rfidTag || 'NO TAG')}</div>
                      </td>
                      <td>${this.esc(imp.cageNumber || '—')}</td>
                      <td style="font-size: 11px;">${new Date(imp.intakeDate).toLocaleString()}</td>
                      <td><span class="status-pill ${outcome ? outcome.pill : 'status-impounded'}">${outcome ? outcome.label : 'In holding'}</span></td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

    container.querySelector('#tm-change-facility').addEventListener('click', () => {
      this.facilityId = null;
      this.scanned = null;
      this.render(container);
    });
    container.querySelector('#terminal-scan-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.scan(container.querySelector('#terminal-code').value);
    });

    // Keep an in-progress scan visible across re-renders
    if (this.scanned) {
      container.querySelector('#terminal-code').value = this.scanned.code;
      this.renderResult();
    }
  },

  scan(raw) {
    const code = String(raw || '').trim().toUpperCase();
    if (!code) return;
    const store = window.adminStore;
    const pet = store.getPetByRFID(code);
    this.scanned = { code, pet };
    store.logAction('Terminal Scan', pet ? `Tag ${code} read for ${pet.name}` : `Unregistered tag ${code} read`);
    this.renderResult();
  },

  clear() {
    this.scanned = null;
    const box = document.getElementById('terminal-result');
    if (box) box.innerHTML = '';
    const input = document.getElementById('terminal-code');
    if (input) input.value = '';
  },

  renderResult() {
    const box = document.getElementById('terminal-result');
    const facility = this.facility();
    if (!box || !this.scanned || !facility) return;
    const { code, pet } = this.scanned;

    const guardian = pet && pet.owner ? `
      <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-main); border-radius: var(--radius-md); padding: 12px;">
        <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: var(--ink-muted); margin-bottom: 4px;">Guardian</div>
        <div style="font-weight: 700;">${this.esc(pet.owner.name || 'Unknown')}</div>
        <div style="font-size: 12px; color: var(--ink-secondary);">${this.esc(pet.owner.phone || '')} ${pet.owner.email ? '· ' + this.esc(pet.owner.email) : ''}</div>
        <div style="font-size: 12px; color: var(--ink-muted);">${this.esc(pet.owner.address || '')}</div>
      </div>` : '';

    box.innerHTML = `
      <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 14px;">
        ${pet && pet.photoUrl ? `<img src="${this.esc(pet.photoUrl)}" class="pet-thumb" alt="" />` : ''}
        <div style="flex: 1;">
          ${pet
            ? `<b style="color: var(--color-green); font-size: 14px;">MATCH FOUND: ${this.esc(pet.name)}</b>
               <div style="font-size: 11px; color: var(--ink-secondary);">${this.esc(pet.breed || '')} · Status: <b>${this.esc(String(pet.status || '').toUpperCase())}</b> · <span class="mono-tag">${this.esc(code)}</span></div>`
            : `<b style="color: var(--color-amber); font-size: 14px;">UNREGISTERED TAG</b>
               <div style="font-size: 11px; color: var(--ink-muted);">${this.esc(code)} is not linked to a pet. You can still log the animal as a stray below.</div>`}
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="terminal-reset">Reset</button>
      </div>
      ${guardian}
      <form id="terminal-intake-form" class="form-grid" style="margin-top: 14px;">
        <div class="form-group">
          <label class="form-label">Pet Name / Identifier *</label>
          <input type="text" class="form-control" name="petName" value="${this.esc(pet ? pet.name : '')}" placeholder="e.g. Unidentified dog" required />
        </div>
        <div class="form-group">
          <label class="form-label">Receiving Facility</label>
          <input type="text" class="form-control" value="${this.esc(facility.name)}" readonly />
        </div>
        <div class="form-group">
          <label class="form-label">Kennel Bay *</label>
          <input type="text" class="form-control" name="cageNumber" placeholder="e.g. Bay B-12" required />
        </div>
        <div class="form-group">
          <label class="form-label">Animal Control Officer</label>
          <input type="text" class="form-control" name="intakeOfficer" placeholder="Name or ID of the receiving officer" />
        </div>
        <div class="form-group form-full">
          <label class="form-label">Pickup Location</label>
          <input type="text" class="form-control" name="impoundLocation" placeholder="e.g. Corner E. Rodriguez & Tomas Morato" />
        </div>
        <div class="form-group form-full">
          <label class="form-label">Health Observations</label>
          <input type="text" class="form-control" name="healthCondition" placeholder="e.g. Active, healthy, collar tag verified" />
        </div>
        <div class="form-group form-full">
          <button type="submit" class="btn btn-primary">Record Intake & Alert Guardian</button>
        </div>
      </form>
    `;

    box.querySelector('#terminal-reset').addEventListener('click', () => this.clear());
    box.querySelector('#terminal-intake-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitIntake(e.currentTarget);
    });
  },

  submitIntake(form) {
    const facility = this.facility();
    if (!facility) { window.adminApp.showToast('Choose a facility first.', 'warning'); return; }
    const { code, pet } = this.scanned;
    const data = new FormData(form);

    const record = window.adminStore.saveImpoundment({
      petId: pet ? pet.id : null,
      petName: data.get('petName'),
      rfidTag: code,
      species: pet ? pet.species : undefined,
      breed: pet ? pet.breed : undefined,
      age: pet ? pet.age : undefined,
      shelterId: facility.id,
      shelterName: facility.name,
      shelterAddress: facility.address || '',
      shelterPhone: facility.phone || '',
      cageNumber: data.get('cageNumber'),
      impoundLocation: data.get('impoundLocation'),
      intakeOfficer: data.get('intakeOfficer'),
      healthCondition: data.get('healthCondition') || 'Normal upon intake assessment.',
      photoUrl: pet && pet.photoUrl ? pet.photoUrl : ''
    });

    window.adminApp.showToast(`Logged intake for ${record.petName}. 72h countdown started.`, 'success');
    this.scanned = null;
    window.adminApp.renderView('terminal');
  }
};
