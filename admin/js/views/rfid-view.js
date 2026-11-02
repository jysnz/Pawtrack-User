/**
 * PawTrack Admin — RFID Hardware & Tag Provisioning
 * Tag inventory, collar batteries, frequency standards, and scanner terminal emulator
 */

window.RfidView = {
  render(container) {
    const store = window.adminStore;
    const tags = store.getRfidTags();
    const pets = store.getPets();

    const assignedCount = tags.filter(t => t.status === 'assigned').length;
    const availableCount = tags.filter(t => t.status === 'available').length;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>RFID Tags</h1>
          <div class="subtitle">
            <span>Tag inventory and scanner · 134.2 kHz FDX-B</span>
          </div>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary" id="btn-batch-generate">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Batch Generate Tags
          </button>
          <button class="btn btn-primary" id="btn-test-scanner">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24"/></svg>
            RFID Scanner Simulator
          </button>
        </div>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="kpi-grid kpi-grid-2">
        <div class="kpi-card">
          <div class="kpi-label">Active Assigned Tags</div>
          <div class="kpi-body">
            <div>
              <div class="kpi-value">${assignedCount} Active</div>
              <div class="kpi-delta neutral">Linked to registered pets</div>
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Inventory in Stock</div>
          <div class="kpi-body">
            <div>
              <div class="kpi-value">${availableCount} Unassigned</div>
              <div class="kpi-delta neutral">Ready for new registrations</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tag Inventory Table -->
      <div class="table-container">
        <div class="table-toolbar">
          <span style="font-size: 12px; font-weight: 700; color: var(--ink-primary);">Tag Inventory Registry (${tags.length} Total)</span>
          <div class="table-filters">
            <span class="mono-tag" style="font-size: 10px;">Auto-Sync Active</span>
          </div>
        </div>

        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>RFID Code</th>
                <th>Assigned Pet</th>
                <th>Allocation Status</th>
                <th>Collar Battery</th>
                <th>Last Scanned</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${tags.map(tag => `
                <tr>
                  <td>
                    <b class="mono-tag" style="font-size: 12px; color: var(--brand-terracotta);">${tag.code}</b>
                  </td>
                  <td>
                    ${tag.petId ? `
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 700; color: var(--ink-primary);">${tag.petName || 'Assigned Pet'}</span>
                        <span class="mono-tag" style="font-size: 9.5px;">${tag.petId}</span>
                      </div>
                    ` : `
                      <span style="color: var(--ink-muted); font-style: italic;">Unassigned (Available)</span>
                    `}
                  </td>
                  <td>
                    <span class="status-pill ${tag.status === 'assigned' ? 'status-safe' : 'status-reunited'}">
                      ${tag.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span style="font-family: var(--font-mono); font-weight: 700; color: ${parseInt(tag.battery, 10) < 85 ? 'var(--color-amber)' : 'var(--color-green)'};">
                      ${tag.battery || '100%'}
                    </span>
                  </td>
                  <td>
                    <span style="font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-muted);">
                      ${tag.lastScanned ? new Date(tag.lastScanned).toLocaleString() : 'Never'}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-sm btn-secondary btn-simulate-scan" data-code="${tag.code}" title="Trigger Scanner Event">
                      Scan Now
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.attachEvents(container);
  },

  attachEvents(container) {
    const store = window.adminStore;

    // Batch generate button
    container.querySelector('#btn-batch-generate')?.addEventListener('click', () => {
      const count = prompt('How many new RFID tags do you want to provision?', '5');
      const num = parseInt(count, 10);
      if (num && num > 0 && num <= 50) {
        for (let i = 0; i < num; i++) {
          const code = 'RFID-' + Math.floor(100000 + Math.random() * 900000);
          store.createRfidTag({ code });
        }
        window.adminApp.showToast(`Provisioned ${num} new RFID tags into inventory!`, 'success');
        this.render(container);
      }
    });

    // Scanner simulator button
    container.querySelector('#btn-test-scanner')?.addEventListener('click', () => {
      this.openScannerSimulatorModal();
    });

    // Inline Scan Now buttons
    container.querySelectorAll('.btn-simulate-scan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.currentTarget.getAttribute('data-code');
        const pet = store.getPetByRFID(code);
        if (pet) {
          window.adminApp.showToast(`[RFID SCAN DETECTED] Identified Pet "${pet.name}" (${code})`, 'success');
          store.logAction('RFID Scanned', `Tag ${code} detected on municipal scanner for ${pet.name}`);
        } else {
          window.adminApp.showToast(`[RFID SCAN] Unregistered Tag detected: ${code}`, 'warning');
          store.logAction('RFID Scanned', `Unregistered tag ${code} detected`);
        }
      });
    });
  },

  openScannerSimulatorModal() {
    const store = window.adminStore;
    const tags = store.getRfidTags();

    const modalHtml = `
      <div class="modal-header">
        <div class="nock-card-title">RFID Transponder Terminal Simulator</div>
        <button class="icon-btn-subtle" id="sim-close-btn">&times;</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: #1c1917; color: #fff; border-radius: var(--radius-md); padding: 14px; font-family: var(--font-mono); font-size: 11.5px; display: flex; flex-direction: column; gap: 6px;">
          <div style="color: #4ade80;">[TERMINAL ONLINE] COM4 · 134.2 kHz Reader Active</div>
          <div style="color: #a8a29e;">Awaiting transponder collar tag signal within 15cm field...</div>
        </div>

        <div class="form-group">
          <label class="form-label">Select Tag to Simulate Tap / Scan</label>
          <select class="form-control" id="sim-tag-select" style="font-family: var(--font-mono); font-weight: 700;">
            ${tags.map(t => `
              <option value="${t.code}" data-pet="${t.petName || ''}">
                ${t.code} — ${t.petName ? `Assigned to: ${t.petName}` : 'Unassigned / Available'}
              </option>
            `).join('')}
          </select>
        </div>

        <div id="sim-result-box" style="display: none; padding: 12px; background: var(--bg-card-subtle); border: 1px solid var(--border-main); border-radius: var(--radius-md);">
          <!-- Result rendered here -->
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="sim-cancel-btn">Close</button>
        <button class="btn btn-primary" id="sim-trigger-btn">Transmit RFID Signal</button>
      </div>
    `;

    const modal = window.adminApp.openModalContent(modalHtml);

    modal.querySelector('#sim-close-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#sim-cancel-btn')?.addEventListener('click', () => window.adminApp.closeModal());

    modal.querySelector('#sim-trigger-btn')?.addEventListener('click', () => {
      const select = modal.querySelector('#sim-tag-select');
      const code = select.value;
      const pet = store.getPetByRFID(code);
      const resBox = modal.querySelector('#sim-result-box');

      resBox.style.display = 'block';
      if (pet) {
        resBox.innerHTML = `
          <div style="display: flex; gap: 10px; align-items: center;">
            <img src="${pet.photoUrl || ''}" class="pet-thumb" />
            <div>
              <b style="color: var(--color-green); font-size: 13px;">MATCH FOUND: ${pet.name}</b>
              <div style="font-size: 11px; color: var(--ink-secondary); margin-top: 2px;">
                Status: <b>${pet.status.toUpperCase()}</b> · Owner: <b>${pet.owner ? pet.owner.name : 'Unknown'}</b> (${pet.owner ? pet.owner.phone : ''})
              </div>
            </div>
          </div>
        `;
        store.logAction('Simulated RFID Trigger', `Terminal read tag ${code} for ${pet.name}`);
        window.adminApp.showToast(`Found pet ${pet.name} via RFID scan!`, 'success');
      } else {
        resBox.innerHTML = `
          <b style="color: var(--color-amber);">UNREGISTERED TRANSPONDER: ${code}</b>
          <div style="font-size: 11px; color: var(--ink-muted); margin-top: 2px;">
            This tag is not linked to any active pet in the registry.
          </div>
        `;
        window.adminApp.showToast(`Unregistered tag ${code} scanned`, 'warning');
      }
    });
  }
};
