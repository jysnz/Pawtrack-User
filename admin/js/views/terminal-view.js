/**
 * PawTrack Admin — Shelter Terminal
 * Scan or type a collar tag, look up the guardian, and log the intake into holding.
 */

window.TerminalView = {
  scanned: null, // { code, pet } for the tag currently on screen

  render(container) {
    const store = window.adminStore;
    const tags = store.getRfidTags();
    const impoundments = store.getImpoundments();
    const holding = impoundments.filter(i => i.status === 'active_impounded');
    const overdue = holding.filter(i => Date.now() > new Date(i.claimDeadline).getTime()).length;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Shelter Terminal</h1>
          <div class="subtitle">
            <span>Scan a collar tag to look up the guardian and log the intake</span>
          </div>
        </div>
      </div>

      <div class="kpi-grid kpi-grid-3">
        <div class="kpi-card">
          <div class="kpi-label">In Holding Now</div>
          <div class="kpi-body"><div>
            <div class="kpi-value">${holding.length} Animals</div>
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
          <input type="text" class="form-control" id="terminal-code" list="terminal-tag-list" placeholder="Tag code or microchip no." autocomplete="off" style="flex: 1; min-width: 220px; font-family: var(--font-mono);" />
          <datalist id="terminal-tag-list">
            ${tags.map(t => `<option value="${t.code}">${t.petName ? `Assigned to ${t.petName}` : 'Unassigned'}</option>`).join('')}
          </datalist>
          <button type="submit" class="btn btn-primary">Look Up</button>
        </form>
        <div id="terminal-result" style="margin-top: 16px;"></div>
      </div>

      <div class="table-container">
        <div class="table-toolbar">
          <span style="font-size: 12px; font-weight: 700; color: var(--ink-primary);">Recent Intakes</span>
          <div class="table-filters">
            <a href="#impoundments" class="mono-tag" style="font-size: 10px; text-decoration: none;">Open Impoundments</a>
          </div>
        </div>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Pet</th>
                <th>Facility</th>
                <th>Intake</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${impoundments.length === 0 ? `
                <tr><td colspan="4" style="text-align: center; padding: 32px; color: var(--ink-muted);">No intakes logged yet.</td></tr>
              ` : impoundments.slice(0, 6).map(imp => {
                const outcome = window.IMPOUND_OUTCOMES && window.IMPOUND_OUTCOMES[imp.status];
                return `
                  <tr>
                    <td>
                      <b>${imp.petName || 'Unidentified Pet'}</b>
                      <div class="mono-tag" style="font-size: 9px; width: max-content; margin-top: 2px;">${imp.rfidTag || 'NO TAG'}</div>
                    </td>
                    <td>${imp.shelterName || 'Municipal Shelter'}<div style="font-size: 10px; color: var(--ink-muted);">${imp.cageNumber || ''}</div></td>
                    <td style="font-size: 11px;">${new Date(imp.intakeDate).toLocaleString()}</td>
                    <td><span class="status-pill ${outcome ? outcome.pill : 'status-impounded'}">${outcome ? outcome.label : 'In holding'}</span></td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

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
    if (!box || !this.scanned) return;
    const { code, pet } = this.scanned;
    const shelters = window.adminStore.getShelters();

    const guardian = pet && pet.owner ? `
      <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-main); border-radius: var(--radius-md); padding: 12px;">
        <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: var(--ink-muted); margin-bottom: 4px;">Guardian</div>
        <div style="font-weight: 700;">${pet.owner.name || 'Unknown'}</div>
        <div style="font-size: 12px; color: var(--ink-secondary);">${pet.owner.phone || ''} ${pet.owner.email ? '· ' + pet.owner.email : ''}</div>
        <div style="font-size: 12px; color: var(--ink-muted);">${pet.owner.address || ''}</div>
      </div>` : '';

    box.innerHTML = `
      <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 14px;">
        ${pet ? `<img src="${pet.photoUrl || ''}" class="pet-thumb" />` : ''}
        <div style="flex: 1;">
          ${pet
            ? `<b style="color: var(--color-green); font-size: 14px;">MATCH FOUND: ${pet.name}</b>
               <div style="font-size: 11px; color: var(--ink-secondary);">${pet.breed || ''} · Status: <b>${String(pet.status || '').toUpperCase()}</b> · <span class="mono-tag">${code}</span></div>`
            : `<b style="color: var(--color-amber); font-size: 14px;">UNREGISTERED TAG</b>
               <div style="font-size: 11px; color: var(--ink-muted);">${code} is not linked to a pet. You can still log the animal as a stray below.</div>`}
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="terminal-reset">Reset</button>
      </div>
      ${guardian}
      <form id="terminal-intake-form" class="form-grid" style="margin-top: 14px;">
        <div class="form-group">
          <label class="form-label">Pet Name / Identifier *</label>
          <input type="text" class="form-control" name="petName" value="${pet ? pet.name : ''}" placeholder="e.g. Unidentified dog" required />
        </div>
        <div class="form-group">
          <label class="form-label">Receiving Facility *</label>
          <select class="form-control" name="shelterId">
            ${shelters.map(s => `<option value="${s.id}" data-name="${s.name}" data-phone="${s.phone}" data-address="${s.address}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Kennel Bay *</label>
          <input type="text" class="form-control" name="cageNumber" value="Kennel Bay B-12" required />
        </div>
        <div class="form-group">
          <label class="form-label">Animal Control Officer</label>
          <input type="text" class="form-control" name="intakeOfficer" value="Officer Rafael Garcia (ACO-412)" />
        </div>
        <div class="form-group form-full">
          <label class="form-label">Pickup Location</label>
          <input type="text" class="form-control" name="impoundLocation" placeholder="e.g. Corner E. Rodriguez & Tomas Morato" />
        </div>
        <div class="form-group form-full">
          <label class="form-label">Health Observations</label>
          <input type="text" class="form-control" name="healthCondition" value="Active, healthy, collar tag verified." />
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
    const { code, pet } = this.scanned;
    const data = new FormData(form);
    const opt = form.querySelector('[name="shelterId"]').selectedOptions[0];

    const record = window.adminStore.saveImpoundment({
      petId: pet ? pet.id : null,
      petName: data.get('petName'),
      rfidTag: code,
      species: pet ? pet.species : undefined,
      breed: pet ? pet.breed : undefined,
      age: pet ? pet.age : undefined,
      shelterId: data.get('shelterId'),
      shelterName: opt ? opt.getAttribute('data-name') : 'Municipal Animal Facility',
      shelterAddress: opt ? opt.getAttribute('data-address') : 'Metro Manila',
      shelterPhone: opt ? opt.getAttribute('data-phone') : '',
      cageNumber: data.get('cageNumber'),
      impoundLocation: data.get('impoundLocation'),
      intakeOfficer: data.get('intakeOfficer'),
      healthCondition: data.get('healthCondition') || 'Normal upon intake assessment.',
      photoUrl: pet && pet.photoUrl ? pet.photoUrl : 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80'
    });

    window.adminApp.showToast(`Logged intake for ${record.petName}. 72h countdown started.`, 'success');
    this.scanned = null;
    window.adminApp.renderView('terminal');
  }
};
