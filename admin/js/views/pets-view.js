/**
 * PawTrack Admin — Pet Registry Management View
 * Clean separation of Registered Pets and Unregistered Stray & Found Reports
 * Full CRUD, Drawer Inspections, Delete Confirmations, and Live Multi-Channel Sync
 */

window.PetsView = {
  currentFilter: 'all',    // For registered pets: 'all' | 'safe' | 'impounded' | 'reunited' | 'lost'
  reportFilter: 'all',     // For unregistered reports: 'all' | 'active_sighting' | 'under_review' | 'shelter_intake' | 'resolved'
  petSearchQuery: '',
  reportSearchQuery: '',

  render(container) {
    const store = window.adminStore;
    const allPets = store.getPets ? store.getPets() : [];
    const allSightings = store.getSightings ? store.getSightings() : [];

    // Filter registered pets
    let displayPets = allPets;
    if (this.currentFilter !== 'all') {
      displayPets = displayPets.filter(p => p.status === this.currentFilter);
    }
    if (this.petSearchQuery && this.petSearchQuery.trim()) {
      const q = this.petSearchQuery.toLowerCase().trim();
      displayPets = displayPets.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.breed && p.breed.toLowerCase().includes(q)) ||
        (p.rfidTag && p.rfidTag.toLowerCase().includes(q)) ||
        (p.microchipNo && p.microchipNo.toLowerCase().includes(q)) ||
        (p.owner && p.owner.name && p.owner.name.toLowerCase().includes(q)) ||
        (p.owner && p.owner.phone && p.owner.phone.includes(q))
      );
    }

    // Filter unregistered reports
    let displayReports = allSightings;
    if (this.reportFilter !== 'all') {
      if (this.reportFilter === 'active_sighting') {
        displayReports = displayReports.filter(r => !r.status || r.status === 'active_sighting');
      } else if (this.reportFilter === 'resolved') {
        displayReports = displayReports.filter(r => r.status === 'resolved' || r.status === 'registered_promoted');
      } else {
        displayReports = displayReports.filter(r => r.status === this.reportFilter);
      }
    }
    if (this.reportSearchQuery && this.reportSearchQuery.trim()) {
      const q = this.reportSearchQuery.toLowerCase().trim();
      displayReports = displayReports.filter(r =>
        (r.species && r.species.toLowerCase().includes(q)) ||
        (r.breed && r.breed.toLowerCase().includes(q)) ||
        (r.location && r.location.toLowerCase().includes(q)) ||
        (r.reporterName && r.reporterName.toLowerCase().includes(q)) ||
        (r.finderName && r.finderName.toLowerCase().includes(q)) ||
        (r.reporterPhone && r.reporterPhone.includes(q)) ||
        (r.finderPhone && r.finderPhone.includes(q)) ||
        (r.comments && r.comments.toLowerCase().includes(q)) ||
        (r.finderNotes && r.finderNotes.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        (r.rfidTag && r.rfidTag.toLowerCase().includes(q)) ||
        (r.id && r.id.toLowerCase().includes(q))
      );
    }

    container.innerHTML = `
      <!-- View Header -->
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Pet Registry</h1>
          <div class="subtitle">
            <span>Registered pets and community stray reports</span>
          </div>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary" id="btn-refresh-reports" title="Refresh Live Citizen Reports">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
            Refresh Reports
          </button>
          <button class="btn btn-secondary" id="btn-add-report" title="Log Found / Stray Animal Report">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Log Report
          </button>
          <button class="btn btn-primary" id="btn-add-pet" title="Register New Pet to Database">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Register Pet
          </button>
        </div>
      </div>

      <!-- Section 1: Registered Pets -->
      <div class="table-container" style="margin-bottom: 24px;">
        <div class="table-toolbar">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; font-size: 13px; color: var(--ink-primary);">Registered Pets</span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            <div class="table-search" style="height: 30px; font-size: 11.5px; box-sizing: border-box;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--ink-muted); flex-shrink: 0;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" id="pet-search-input" placeholder="Search by name, RFID, microchip, owner..." value="${this.petSearchQuery || ''}" style="font-size: 11.5px;" />
              ${this.petSearchQuery ? `<button id="btn-clear-pet-search" style="border:none;background:transparent;cursor:pointer;color:var(--ink-muted);font-size:12px;padding:0 2px;">&times;</button>` : ''}
            </div>

            <div class="table-filters" style="box-sizing: border-box;">
              <button class="filter-pill ${this.currentFilter === 'all' ? 'active' : ''}" data-pet-filter="all">All</button>
              <button class="filter-pill ${this.currentFilter === 'safe' ? 'active' : ''}" data-pet-filter="safe">Safe</button>
              <button class="filter-pill ${this.currentFilter === 'impounded' ? 'active' : ''}" data-pet-filter="impounded">Impounded</button>
              <button class="filter-pill ${this.currentFilter === 'reunited' ? 'active' : ''}" data-pet-filter="reunited">Reunited</button>
              <button class="filter-pill ${this.currentFilter === 'lost' ? 'active' : ''}" data-pet-filter="lost">Lost</button>
            </div>
          </div>
        </div>

        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Pet Identification</th>
                <th>RFID Tag & Chip</th>
                <th>Status</th>
                <th>Owner & Contact</th>
                <th>Registered Date</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${displayPets.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 36px 24px; color: var(--ink-muted);">
                    <div style="font-weight: 700; color: var(--ink-primary); font-size: 13.5px; margin-bottom: 4px;">Pet Registry is Empty</div>
                    <div style="font-size: 12px; max-width: 480px; margin: 0 auto; line-height: 1.5; color: var(--ink-muted);">
                      No registered pets matching criteria. Pets registered on the Owner Portal (<b>http://localhost:3000</b>) will sync here live in real-time.
                    </div>
                  </td>
                </tr>
              ` : displayPets.map(pet => `
                <tr data-pet-id="${pet.id}">
                  <td>
                    <div class="pet-cell">
                      <img src="${pet.photoUrl || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=150&q=80'}" alt="${pet.name}" class="pet-thumb btn-preview-pet-photo" data-pet-id="${pet.id}" style="cursor: zoom-in;" title="Click to view full photo of ${pet.name}" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=150&q=80'" />
                      <div class="pet-meta">
                        <span class="pet-name">${pet.name}</span>
                        <span class="pet-sub">${pet.species || 'Dog'} · ${pet.breed || 'Mixed'} (${pet.gender || 'Unknown'})</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                      <span class="mono-tag" style="font-weight: 700;">${pet.rfidTag || 'NO TAG'}</span>
                      <span style="font-size: 10px; font-family: var(--font-mono); color: var(--ink-muted);">${pet.microchipNo || 'No Microchip'}</span>
                    </div>
                  </td>
                  <td>
                    <select class="status-select status-${pet.status}" data-pet-id="${pet.id}">
                      <option value="safe" ${pet.status === 'safe' ? 'selected' : ''}>Safe</option>
                      <option value="impounded" ${pet.status === 'impounded' ? 'selected' : ''}>Impounded</option>
                      <option value="reunited" ${pet.status === 'reunited' ? 'selected' : ''}>Reunited</option>
                      <option value="lost" ${pet.status === 'lost' ? 'selected' : ''}>Lost / Missing</option>
                    </select>
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column;">
                      <span style="font-weight: 600; color: var(--ink-primary);">${pet.owner ? pet.owner.name : 'Unknown Guardian'}</span>
                      <span style="font-size: 11px; color: var(--ink-muted); font-family: var(--font-mono);">${pet.owner ? pet.owner.phone : 'No Phone'}</span>
                    </div>
                  </td>
                  <td>
                    <span style="font-family: var(--font-mono); font-size: 11px; color: var(--ink-muted);">${pet.registeredDate || 'N/A'}</span>
                  </td>
                  <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 6px;">
                      <button class="chip btn-edit-pet" data-pet-id="${pet.id}" title="Inspect & Edit Pet">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        Edit
                      </button>
                      <button class="chip btn-delete-pet" data-pet-id="${pet.id}" style="color: var(--color-red);" title="Delete Pet">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Section 2: Community Stray & Sighting Reports -->
      <div class="table-container">
        <div class="table-toolbar">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; font-size: 13px; color: var(--ink-primary);">Community Stray & Sighting Reports</span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            <div class="table-search" style="height: 30px; font-size: 11.5px; box-sizing: border-box;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--ink-muted); flex-shrink: 0;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" id="report-search-input" placeholder="Search reports by species, breed, location, finder..." value="${this.reportSearchQuery || ''}" style="font-size: 11.5px;" />
              ${this.reportSearchQuery ? `<button id="btn-clear-report-search" style="border:none;background:transparent;cursor:pointer;color:var(--ink-muted);font-size:12px;padding:0 2px;">&times;</button>` : ''}
            </div>

            <div class="table-filters" style="box-sizing: border-box;">
              <button class="filter-pill ${this.reportFilter === 'all' ? 'active' : ''}" data-report-filter="all">All</button>
              <button class="filter-pill ${this.reportFilter === 'active_sighting' ? 'active' : ''}" data-report-filter="active_sighting">Active Sightings</button>
              <button class="filter-pill ${this.reportFilter === 'under_review' ? 'active' : ''}" data-report-filter="under_review">Under Review</button>
              <button class="filter-pill ${this.reportFilter === 'shelter_intake' ? 'active' : ''}" data-report-filter="shelter_intake">Shelter Intake</button>
              <button class="filter-pill ${this.reportFilter === 'resolved' ? 'active' : ''}" data-report-filter="resolved">Resolved</button>
            </div>
          </div>
        </div>

        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Reported Animal & Photo</th>
                <th>Found Location & Pin</th>
                <th>Report Status / RFID</th>
                <th>Finder & Contact Details</th>
                <th>Reported Time</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${displayReports.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 36px 24px; color: var(--ink-muted);">
                    <div style="font-weight: 700; color: var(--ink-primary); font-size: 13.5px; margin-bottom: 4px;">No Stray or Sighting Reports Found</div>
                    <div style="font-size: 12px; max-width: 480px; margin: 0 auto; line-height: 1.5; color: var(--ink-muted);">
                      There are currently no active stray animal reports or community sightings. Reports submitted by citizens via the Pet Owner Portal or Community Map will appear here in real-time.
                    </div>
                  </td>
                </tr>
              ` : displayReports.map(r => {
                const photoSrc = r.photoUrl || r.photo || (r.species === 'Cat' ? 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150' : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150');
                const finderNotes = r.comments || r.finderNotes || r.notes || '';
                return `
                  <tr data-report-id="${r.id}">
                    <td>
                      <div class="pet-cell">
                        <img src="${photoSrc}" alt="${r.species || 'Pet'}" class="pet-thumb btn-preview-report-photo" data-report-id="${r.id}" style="cursor: zoom-in;" title="Click to view full photo" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150'" />
                        <div class="pet-meta">
                          <span class="pet-name" style="display: flex; align-items: center; gap: 6px;">
                            ${r.breed || (r.species ? r.species + ' (Stray)' : 'Unregistered Animal')}
                            <span class="status-pill status-impounded" style="font-size: 8.5px; padding: 1px 5px; font-weight: 700;">UNREGISTERED</span>
                          </span>
                          <span class="pet-sub">${r.species || 'Dog'} · <code style="font-family: var(--font-mono); font-size: 10px;">${r.id}</code></span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style="display: flex; flex-direction: column; gap: 3px;">
                        <div style="font-weight: 600; color: var(--ink-primary); display: flex; align-items: center; gap: 4px;">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--brand-terracotta); flex-shrink: 0;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px;" title="${r.location || 'Metro Manila'}">${r.location || 'Metro Manila'}</span>
                        </div>
                        ${r.coords && Array.isArray(r.coords) ? `<span style="font-size: 10px; font-family: var(--font-mono); color: var(--ink-muted);">GPS: [${Number(r.coords[0]).toFixed(4)}, ${Number(r.coords[1]).toFixed(4)}]</span>` : ''}
                      </div>
                    </td>
                    <td>
                      <div style="display: flex; flex-direction: column; gap: 3px;">
                        <div>
                          <span class="status-pill ${r.status === 'registered_promoted' ? 'status-safe' : 'status-impounded'}" style="font-size: 9.5px; padding: 2px 7px;">
                            ${r.status === 'registered_promoted' ? 'Promoted to Registry' : (r.status === 'resolved' ? 'Resolved' : (r.status === 'under_review' ? 'Under Review' : (r.status === 'shelter_intake' ? 'Shelter Intake' : 'Sighting / Found')))}
                          </span>
                        </div>
                        <div>
                          ${r.rfidTag ? `<span class="mono-tag" style="font-weight: 700; font-size: 9.5px;">${r.rfidTag}</span>` : '<span style="font-size: 10px; color: var(--ink-muted); font-family: var(--font-mono);">No RFID Collar</span>'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-weight: 600; color: var(--ink-primary);">${r.reporterName || r.finderName || 'Community Good Samaritan'}</span>
                        <span style="font-size: 11px; color: var(--ink-muted); font-family: var(--font-mono);">${r.reporterPhone || r.finderPhone || 'No contact phone'}</span>
                        ${finderNotes ? `
                          <span style="font-size: 10.5px; color: var(--ink-secondary); max-width: 210px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${finderNotes}">
                            "${finderNotes}"
                          </span>
                        ` : ''}
                      </div>
                    </td>
                    <td>
                      <span style="font-family: var(--font-mono); font-size: 11px; color: var(--ink-muted);">
                        ${r.timestamp ? new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (r.createdAt ? new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A')}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 6px;">
                        <button class="chip btn-edit-report" data-report-id="${r.id}" title="Inspect & Edit Report">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                          Edit
                        </button>
                        <button class="chip btn-promote-report" data-report-id="${r.id}" style="color: var(--color-green);" title="Convert & Register as Official Pet">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                          Register
                        </button>
                        <button class="chip btn-delete-report" data-report-id="${r.id}" style="color: var(--color-red);" title="Delete Report">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.attachEventListeners(container);
  },

  attachEventListeners(container) {
    const store = window.adminStore;

    // Registered Pet Sub-Filter Buttons
    container.querySelectorAll('[data-pet-filter]').forEach(pill => {
      pill.addEventListener('click', (e) => {
        this.currentFilter = e.currentTarget.getAttribute('data-pet-filter');
        this.render(container);
      });
    });

    // Unregistered Report Sub-Filter Buttons
    container.querySelectorAll('[data-report-filter]').forEach(pill => {
      pill.addEventListener('click', (e) => {
        this.reportFilter = e.currentTarget.getAttribute('data-report-filter');
        this.render(container);
      });
    });

    // Pet Search input
    const petSearchInput = container.querySelector('#pet-search-input');
    if (petSearchInput) {
      petSearchInput.addEventListener('input', (e) => {
        this.petSearchQuery = e.target.value;
        this.render(container);
      });
    }

    const clearPetSearch = container.querySelector('#btn-clear-pet-search');
    if (clearPetSearch) {
      clearPetSearch.addEventListener('click', () => {
        this.petSearchQuery = '';
        this.render(container);
      });
    }

    // Report Search input
    const reportSearchInput = container.querySelector('#report-search-input');
    if (reportSearchInput) {
      reportSearchInput.addEventListener('input', (e) => {
        this.reportSearchQuery = e.target.value;
        this.render(container);
      });
    }

    const clearReportSearch = container.querySelector('#btn-clear-report-search');
    if (clearReportSearch) {
      clearReportSearch.addEventListener('click', () => {
        this.reportSearchQuery = '';
        this.render(container);
      });
    }

    // Refresh reports button
    container.querySelector('#btn-refresh-reports')?.addEventListener('click', () => {
      store.syncFromBackend().then(() => {
        window.adminApp.showToast('Synchronized live reports from PawTrack Hub', 'success');
        this.render(container);
      });
    });

    // Add Report Button
    container.querySelector('#btn-add-report')?.addEventListener('click', () => {
      this.openReportEditorModal(null);
    });

    // Edit Report Button
    container.querySelectorAll('.btn-edit-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const reportId = e.currentTarget.getAttribute('data-report-id');
        const report = store.getSightingById ? store.getSightingById(reportId) : null;
        if (report) this.openReportDrawer(report);
      });
    });

    // Delete Report Button
    container.querySelectorAll('.btn-delete-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const reportId = e.currentTarget.getAttribute('data-report-id');
        const report = store.getSightingById ? store.getSightingById(reportId) : null;
        if (report) this.confirmDeleteReport(report);
      });
    });

    // Promote / Register Report as Pet
    container.querySelectorAll('.btn-promote-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const reportId = e.currentTarget.getAttribute('data-report-id');
        const report = store.getSightingById ? store.getSightingById(reportId) : null;
        if (report) this.openPromoteReportModal(report);
      });
    });

    // Preview Report Photo Modal
    container.querySelectorAll('.btn-preview-report-photo').forEach(thumb => {
      thumb.addEventListener('click', (e) => {
        const reportId = e.currentTarget.getAttribute('data-report-id');
        const report = store.getSightingById ? store.getSightingById(reportId) : null;
        if (report) {
          const photo = report.photoUrl || report.photo || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600';
          window.adminApp.openModalContent(`
            <div style="text-align: center; padding: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--ink-primary);">${report.species || 'Stray Pet'} — Found Pet Report Photo</h3>
                <button class="btn btn-sm btn-secondary" onclick="window.adminApp.closeModal()">&times;</button>
              </div>
              <div style="max-height: 480px; overflow: hidden; border-radius: 10px; background: #1c1917; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                <img src="${photo}" alt="${report.species}" style="max-width: 100%; max-height: 480px; object-fit: contain;" />
              </div>
              <div style="font-size: 12px; color: var(--ink-muted); font-family: var(--font-mono);">
                Location: ${report.location || 'Metro Manila'} · Reported by: ${report.reporterName || report.finderName || 'Good Samaritan'} (${report.reporterPhone || report.finderPhone || 'No phone'})
              </div>
            </div>
          `);
        }
      });
    });

    // Registered Pet: Status quick dropdown change
    container.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const petId = e.target.getAttribute('data-pet-id');
        const newStatus = e.target.value;
        store.updatePetStatus(petId, newStatus);
        window.adminApp.showToast(`Updated status to ${newStatus.toUpperCase()}`, 'success');
      });
    });

    // Add Pet button
    container.querySelector('#btn-add-pet')?.addEventListener('click', () => {
      this.openPetEditorModal(null);
    });

    // Edit pet button
    container.querySelectorAll('.btn-edit-pet').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const petId = e.currentTarget.getAttribute('data-pet-id');
        const pet = store.getPetById(petId);
        if (pet) this.openPetDrawer(pet);
      });
    });

    // Delete pet button (trash icon)
    container.querySelectorAll('.btn-delete-pet').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const petId = e.currentTarget.getAttribute('data-pet-id');
        const pet = store.getPetById(petId);
        if (pet) {
          this.confirmDeletePet(pet);
        }
      });
    });

    // Click pet thumbnail to preview full photo in modal
    container.querySelectorAll('.btn-preview-pet-photo').forEach(thumb => {
      thumb.addEventListener('click', (e) => {
        const petId = e.currentTarget.getAttribute('data-pet-id');
        const pet = store.getPetById(petId);
        if (pet) {
          window.adminApp.openModalContent(`
            <div style="text-align: center; padding: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--ink-primary);">${pet.name} — Full Photo</h3>
                <button class="btn btn-sm btn-secondary" onclick="window.adminApp.closeModal()">&times;</button>
              </div>
              <div style="max-height: 480px; overflow: hidden; border-radius: 10px; background: #1c1917; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                <img src="${pet.photoUrl}" alt="${pet.name}" style="max-width: 100%; max-height: 480px; object-fit: contain;" />
              </div>
              <div style="font-size: 12px; color: var(--ink-muted); font-family: var(--font-mono);">
                RFID: ${pet.rfidTag || 'None'} · ${pet.species} (${pet.breed}) · Registered Guardian: ${pet.owner ? pet.owner.name : 'Unknown'}
              </div>
            </div>
          `);
        }
      });
    });
  },

  // ==========================================
  // UNREGISTERED REPORT DRAWER, MODAL & ACTIONS
  // ==========================================

  openReportDrawer(report) {
    const photo = report.photoUrl || report.photo || (report.species === 'Cat' ? 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150' : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150');
    const drawerHtml = `
      <div class="drawer-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${photo}" class="pet-thumb" style="width: 38px; height: 38px; object-fit: cover;" />
          <div>
            <div class="drawer-title">Edit Report: ${report.species || 'Stray'}</div>
            <span class="mono-tag" style="font-size: 9.5px;">${report.id}</span>
          </div>
        </div>
        <button class="icon-btn-subtle" id="drawer-close-btn">&times;</button>
      </div>
      <div class="drawer-body">
        <form id="drawer-report-form" class="form-grid">
          <div class="form-group">
            <label class="form-label">Species *</label>
            <select class="form-control" name="species" required>
              <option value="Dog" ${report.species === 'Dog' ? 'selected' : ''}>Dog</option>
              <option value="Cat" ${report.species === 'Cat' ? 'selected' : ''}>Cat</option>
              <option value="Other" ${report.species === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Breed / Appearance</label>
            <input type="text" class="form-control" name="breed" value="${report.breed || ''}" placeholder="e.g. Golden Retriever / Aspin" />
          </div>
          <div class="form-group form-full">
            <label class="form-label">Found Location *</label>
            <input type="text" class="form-control" name="location" value="${report.location || ''}" placeholder="Street, Barangay, City landmark" required />
          </div>
          <div class="form-group">
            <label class="form-label">Latitude (GPS)</label>
            <input type="number" step="any" class="form-control" name="lat" value="${report.coords && report.coords[0] ? report.coords[0] : 14.6500}" />
          </div>
          <div class="form-group">
            <label class="form-label">Longitude (GPS)</label>
            <input type="number" step="any" class="form-control" name="lng" value="${report.coords && report.coords[1] ? report.coords[1] : 121.0400}" />
          </div>
          <div class="form-group">
            <label class="form-label">RFID Collar Tag (if detected)</label>
            <input type="text" class="form-control" name="rfidTag" value="${report.rfidTag || ''}" placeholder="RFID-..." style="font-family: var(--font-mono); font-weight: 700;" />
          </div>
          <div class="form-group">
            <label class="form-label">Report Status</label>
            <select class="form-control" name="status" style="font-weight: 700;">
              <option value="active_sighting" ${report.status === 'active_sighting' || !report.status ? 'selected' : ''}>Active Sighting / Found</option>
              <option value="under_review" ${report.status === 'under_review' ? 'selected' : ''}>Under Municipal Review</option>
              <option value="shelter_intake" ${report.status === 'shelter_intake' ? 'selected' : ''}>Transferred to Shelter</option>
              <option value="resolved" ${report.status === 'resolved' || report.status === 'registered_promoted' ? 'selected' : ''}>Resolved / Claimed</option>
            </select>
          </div>
          <div class="form-group form-full">
            <label class="form-label">Photo URL</label>
            <input type="url" class="form-control" name="photoUrl" value="${report.photoUrl || report.photo || ''}" placeholder="https://..." />
          </div>

          <div class="form-full" style="border-top: 1px solid var(--border-light); padding-top: 12px; margin-top: 4px;">
            <b style="font-size: 12px; color: var(--ink-primary); display: block; margin-bottom: 10px;">Finder & Good Samaritan Contact Information</b>
          </div>
          <div class="form-group">
            <label class="form-label">Finder Name</label>
            <input type="text" class="form-control" name="reporterName" value="${report.reporterName || report.finderName || ''}" placeholder="e.g. Carlos Dalisay" />
          </div>
          <div class="form-group">
            <label class="form-label">Finder Contact Phone</label>
            <input type="text" class="form-control" name="reporterPhone" value="${report.reporterPhone || report.finderPhone || ''}" placeholder="+63 9..." />
          </div>
          <div class="form-group form-full">
            <label class="form-label">Finder Observations & Notes</label>
            <textarea class="form-control" name="comments" rows="3" placeholder="Notes on animal condition, collar, behavior, specific street corner...">${report.comments || report.finderNotes || report.notes || ''}</textarea>
          </div>
        </form>
      </div>
      <div class="drawer-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <button class="btn btn-danger" id="drawer-delete-report-btn">Delete Report</button>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" id="drawer-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="drawer-save-report-btn">Save Changes</button>
        </div>
      </div>
    `;

    const drawer = window.adminApp.openDrawer(drawerHtml);

    drawer.querySelector('#drawer-close-btn')?.addEventListener('click', () => window.adminApp.closeDrawer());
    drawer.querySelector('#drawer-cancel-btn')?.addEventListener('click', () => window.adminApp.closeDrawer());

    drawer.querySelector('#drawer-delete-report-btn')?.addEventListener('click', () => {
      window.adminApp.closeDrawer();
      this.confirmDeleteReport(report);
    });

    drawer.querySelector('#drawer-save-report-btn')?.addEventListener('click', () => {
      const form = drawer.querySelector('#drawer-report-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const formData = new FormData(form);
      const lat = parseFloat(formData.get('lat')) || 14.6500;
      const lng = parseFloat(formData.get('lng')) || 121.0400;

      const updatedReport = {
        ...report,
        species: formData.get('species'),
        breed: formData.get('breed'),
        location: formData.get('location'),
        coords: [lat, lng],
        rfidTag: (formData.get('rfidTag') || '').trim(),
        status: formData.get('status'),
        photoUrl: formData.get('photoUrl'),
        photo: formData.get('photoUrl'),
        reporterName: formData.get('reporterName'),
        finderName: formData.get('reporterName'),
        reporterPhone: formData.get('reporterPhone'),
        finderPhone: formData.get('reporterPhone'),
        comments: formData.get('comments'),
        finderNotes: formData.get('comments'),
        lastUpdated: new Date().toISOString()
      };

      window.adminStore.saveSighting(updatedReport);
      window.adminApp.closeDrawer();
      window.adminApp.showToast(`Updated report ${updatedReport.id} successfully`, 'success');
      const container = document.getElementById('view-container');
      if (container) this.render(container);
    });
  },

  confirmDeleteReport(report) {
    const modalHtml = `
      <div class="modal-header">
        <div class="nock-card-title" style="color: var(--color-red); display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete Unregistered Report
        </div>
        <button class="icon-btn-subtle" id="del-report-close">&times;</button>
      </div>
      <div class="modal-body" style="padding: 20px; font-size: 13px; line-height: 1.5; color: var(--ink-secondary); display: flex; flex-direction: column; gap: 14px;">
        <p style="margin: 0; font-size: 13.5px; color: var(--ink-primary);">
          Are you sure you want to delete report <code style="font-family: var(--font-mono); color: var(--brand-terracotta); background: rgba(194, 65, 12, 0.08); padding: 2px 6px; border-radius: 4px;">${report.id}</code> (${report.species} found at ${report.location || 'Unknown'})?
        </p>
        <div style="padding: 12px 16px; background: var(--bg-card-subtle); border: 1px solid var(--border-main); border-radius: var(--radius-md); font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
          <div><b>Species & Breed:</b> ${report.species} · ${report.breed || 'Unknown'}</div>
          <div><b>Location Found:</b> ${report.location || 'Metro Manila'}</div>
          <div><b>Reported By:</b> ${report.reporterName || report.finderName || 'Good Samaritan'} (${report.reporterPhone || report.finderPhone || 'No phone'})</div>
          ${(report.comments || report.finderNotes || report.notes) ? `<div><b>Notes:</b> "${report.comments || report.finderNotes || report.notes}"</div>` : ''}
        </div>
        <p style="font-size: 11.5px; color: var(--ink-muted); margin: 0; line-height: 1.45;">
          This will remove the stray pet report from the community incident map and admin records.
        </p>
      </div>
      <div class="modal-footer" style="justify-content: flex-end; gap: 8px;">
        <button class="btn btn-secondary" id="del-report-cancel">Cancel</button>
        <button class="btn btn-danger" id="del-report-confirm">Delete Report</button>
      </div>
    `;

    const modal = window.adminApp.openModalContent(modalHtml);

    modal.querySelector('#del-report-close')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#del-report-cancel')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#del-report-confirm')?.addEventListener('click', () => {
      window.adminStore.deleteSighting(report.id);
      window.adminApp.closeModal();
      window.adminApp.showToast(`Report "${report.id}" deleted successfully`, 'warning');
      const container = document.getElementById('view-container');
      if (container) this.render(container);
    });
  },

  openReportEditorModal(initialData = null) {
    const isEdit = !!initialData;
    const reportId = initialData?.id || ('SIGHT-' + Date.now().toString().slice(-6));

    const modalHtml = `
      <div class="modal-header">
        <div class="nock-card-title">${isEdit ? 'Edit Stray Pet Report' : 'Log New Found Stray Pet Report'}</div>
        <button class="icon-btn-subtle" id="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="modal-report-form" class="form-grid">
          <div class="form-group">
            <label class="form-label">Species *</label>
            <select class="form-control" name="species" required>
              <option value="Dog" ${initialData?.species === 'Dog' ? 'selected' : ''}>Dog</option>
              <option value="Cat" ${initialData?.species === 'Cat' ? 'selected' : ''}>Cat</option>
              <option value="Other" ${initialData?.species === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Breed / Appearance</label>
            <input type="text" class="form-control" name="breed" value="${initialData?.breed || ''}" placeholder="e.g. Golden Retriever / Aspin" />
          </div>
          <div class="form-group form-full">
            <label class="form-label">Found Location *</label>
            <input type="text" class="form-control" name="location" value="${initialData?.location || ''}" placeholder="e.g. Tomas Morato Ave cor. Scout Gandia, QC" required />
          </div>
          <div class="form-group">
            <label class="form-label">Latitude</label>
            <input type="number" step="any" class="form-control" name="lat" value="${initialData?.coords?.[0] || 14.6500}" />
          </div>
          <div class="form-group">
            <label class="form-label">Longitude</label>
            <input type="number" step="any" class="form-control" name="lng" value="${initialData?.coords?.[1] || 121.0400}" />
          </div>
          <div class="form-group">
            <label class="form-label">RFID Collar Tag (if detected)</label>
            <input type="text" class="form-control" name="rfidTag" value="${initialData?.rfidTag || ''}" placeholder="RFID-..." style="font-family: var(--font-mono); font-weight: 700;" />
          </div>
          <div class="form-group">
            <label class="form-label">Photo URL</label>
            <input type="url" class="form-control" name="photoUrl" value="${initialData?.photoUrl || initialData?.photo || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500'}" />
          </div>

          <div class="form-full" style="border-top: 1px solid var(--border-light); padding-top: 12px; margin-top: 4px;">
            <b style="font-size: 12px; color: var(--ink-primary); display: block; margin-bottom: 10px;">Finder Information</b>
          </div>
          <div class="form-group">
            <label class="form-label">Finder Name</label>
            <input type="text" class="form-control" name="reporterName" value="${initialData?.reporterName || initialData?.finderName || ''}" placeholder="Finder's name" />
          </div>
          <div class="form-group">
            <label class="form-label">Finder Contact Phone</label>
            <input type="text" class="form-control" name="reporterPhone" value="${initialData?.reporterPhone || initialData?.finderPhone || ''}" placeholder="+63 9..." />
          </div>
          <div class="form-group form-full">
            <label class="form-label">Notes & Situation</label>
            <textarea class="form-control" name="comments" rows="3" placeholder="Condition, collar color, exact landmark...">${initialData?.comments || initialData?.finderNotes || initialData?.notes || ''}</textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-btn">${isEdit ? 'Save Changes' : 'Submit Found Report'}</button>
      </div>
    `;

    const modal = window.adminApp.openModalContent(modalHtml);

    modal.querySelector('#modal-close-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#modal-cancel-btn')?.addEventListener('click', () => window.adminApp.closeModal());

    modal.querySelector('#modal-submit-btn')?.addEventListener('click', () => {
      const form = modal.querySelector('#modal-report-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const formData = new FormData(form);
      const lat = parseFloat(formData.get('lat')) || 14.6500;
      const lng = parseFloat(formData.get('lng')) || 121.0400;

      const newReport = {
        id: reportId,
        species: formData.get('species'),
        breed: formData.get('breed'),
        location: formData.get('location'),
        coords: [lat, lng],
        rfidTag: (formData.get('rfidTag') || '').trim(),
        status: 'active_sighting',
        photoUrl: formData.get('photoUrl'),
        photo: formData.get('photoUrl'),
        reporterName: formData.get('reporterName') || 'Community Good Samaritan',
        finderName: formData.get('reporterName') || 'Community Good Samaritan',
        reporterPhone: formData.get('reporterPhone'),
        finderPhone: formData.get('reporterPhone'),
        comments: formData.get('comments'),
        finderNotes: formData.get('comments'),
        timestamp: initialData?.timestamp || new Date().toISOString(),
        reportType: 'found'
      };

      window.adminStore.saveSighting(newReport);
      window.adminApp.closeModal();
      window.adminApp.showToast(`Logged report ${newReport.id} successfully`, 'success');
      const container = document.getElementById('view-container');
      if (container) this.render(container);
    });
  },

  openPromoteReportModal(report) {
    const suggestedName = `Found ${report.species || 'Pet'}` + (report.breed ? ` (${report.breed})` : '');
    const initialData = {
      name: suggestedName,
      species: report.species || 'Dog',
      breed: report.breed || 'Mixed',
      rfidTag: report.rfidTag || ('RFID-' + Math.floor(100000 + Math.random() * 900000)),
      photoUrl: report.photoUrl || report.photo || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80',
      ownerName: report.reporterName || report.finderName || 'Pending Guardian Confirmation',
      ownerPhone: report.reporterPhone || report.finderPhone || '+63 917 000 0000',
      medicalNotes: `Promoted from stray report ${report.id}. Found at ${report.location || 'Metro Manila'}. Finder notes: ${report.comments || report.finderNotes || 'None'}.`
    };

    this.openPetEditorModal(initialData, report.id);
  },

  // ==========================================
  // REGISTERED PET DRAWER, MODAL & ACTIONS
  // ==========================================

  confirmDeletePet(pet) {
    const modalHtml = `
      <div class="modal-header">
        <div class="nock-card-title" style="color: var(--color-red); display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete Pet Record
        </div>
        <button class="icon-btn-subtle" id="del-pet-close">&times;</button>
      </div>
      <div class="modal-body" style="padding: 20px; font-size: 13px; line-height: 1.5; color: var(--ink-secondary); display: flex; flex-direction: column; gap: 14px;">
        <p style="margin: 0; font-size: 13.5px; color: var(--ink-primary);">
          Are you sure you want to delete <b>"${pet.name}"</b> (ID: <code style="font-family: var(--font-mono); color: var(--brand-terracotta); background: rgba(194, 65, 12, 0.08); padding: 2px 6px; border-radius: 4px;">${pet.id}</code>) from the municipal database?
        </p>
        <div style="padding: 12px 16px; background: var(--bg-card-subtle); border: 1px solid var(--border-main); border-radius: var(--radius-md); font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
          <div><b>Species/Breed:</b> ${pet.species} · ${pet.breed || 'Mixed'}</div>
          <div><b>RFID Collar:</b> <span class="mono-tag" style="font-size: 10px; padding: 1px 6px;">${pet.rfidTag || 'None'}</span></div>
          <div><b>Owner:</b> ${pet.owner ? pet.owner.name : 'Unknown'} (${pet.owner ? pet.owner.phone : 'No phone'})</div>
        </div>
        <p style="font-size: 11.5px; color: var(--ink-muted); margin: 0; line-height: 1.45;">
          This will remove the pet's registration profile and instantly release its RFID collar back into inventory.
        </p>
      </div>
      <div class="modal-footer" style="justify-content: flex-end; gap: 8px;">
        <button class="btn btn-secondary" id="del-pet-cancel">Cancel</button>
        <button class="btn btn-danger" id="del-pet-confirm">Delete Pet</button>
      </div>
    `;

    const modal = window.adminApp.openModalContent(modalHtml);

    modal.querySelector('#del-pet-close')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#del-pet-cancel')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#del-pet-confirm')?.addEventListener('click', () => {
      window.adminStore.deletePet(pet.id);
      window.adminApp.closeModal();
      window.adminApp.showToast(`Pet "${pet.name}" deleted from registry`, 'warning');
      const container = document.getElementById('view-container');
      if (container) this.render(container);
    });
  },

  openPetDrawer(pet) {
    const drawerHtml = `
      <div class="drawer-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${pet.photoUrl || ''}" class="pet-thumb" style="width: 38px; height: 38px;" />
          <div>
            <div class="drawer-title">Edit Pet: ${pet.name}</div>
            <span class="mono-tag" style="font-size: 9.5px;">${pet.id}</span>
          </div>
        </div>
        <button class="icon-btn-subtle" id="drawer-close-btn">&times;</button>
      </div>
      <div class="drawer-body">
        <form id="drawer-pet-form" class="form-grid">
          <div class="form-group">
            <label class="form-label">Pet Name</label>
            <input type="text" class="form-control" name="name" value="${pet.name || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Species</label>
            <select class="form-control" name="species">
              <option value="Dog" ${pet.species === 'Dog' ? 'selected' : ''}>Dog</option>
              <option value="Cat" ${pet.species === 'Cat' ? 'selected' : ''}>Cat</option>
              <option value="Other" ${pet.species === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Breed</label>
            <input type="text" class="form-control" name="breed" value="${pet.breed || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Color / Coat</label>
            <input type="text" class="form-control" name="color" value="${pet.color || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Gender</label>
            <select class="form-control" name="gender">
              <option value="Male" ${pet.gender === 'Male' ? 'selected' : ''}>Male</option>
              <option value="Female" ${pet.gender === 'Female' ? 'selected' : ''}>Female</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Age & Weight</label>
            <div style="display: flex; gap: 6px;">
              <input type="text" class="form-control" name="age" placeholder="e.g. 3 years" value="${pet.age || ''}" />
              <input type="text" class="form-control" name="weight" placeholder="e.g. 12 kg" value="${pet.weight || ''}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">RFID Collar Tag</label>
            <input type="text" class="form-control" name="rfidTag" value="${pet.rfidTag || ''}" style="font-family: var(--font-mono); font-weight: 700;" />
          </div>
          <div class="form-group">
            <label class="form-label">Microchip No. (ISO 11784/11785)</label>
            <input type="text" class="form-control" name="microchipNo" value="${pet.microchipNo || ''}" style="font-family: var(--font-mono);" />
          </div>
          <div class="form-group form-full">
            <label class="form-label">Photo URL</label>
            <input type="url" class="form-control" name="photoUrl" value="${pet.photoUrl || ''}" placeholder="https://..." />
          </div>
          <div class="form-group form-full">
            <label class="form-label">Status Mode</label>
            <select class="form-control" name="status" style="font-weight: 700;">
              <option value="safe" ${pet.status === 'safe' ? 'selected' : ''}>Safe (At Home)</option>
              <option value="impounded" ${pet.status === 'impounded' ? 'selected' : ''}>Impounded (Shelter Care)</option>
              <option value="reunited" ${pet.status === 'reunited' ? 'selected' : ''}>Reunited (Returned)</option>
              <option value="lost" ${pet.status === 'lost' ? 'selected' : ''}>Lost (Missing Alert)</option>
            </select>
          </div>
          <div class="form-group form-full">
            <label class="form-label">Medical & Dietary Notes</label>
            <textarea class="form-control" name="medicalNotes">${pet.medicalNotes || ''}</textarea>
          </div>

          <div class="form-full" style="border-top: 1px solid var(--border-light); padding-top: 12px; margin-top: 4px;">
            <b style="font-size: 12px; color: var(--ink-primary); display: block; margin-bottom: 10px;">Owner Contact Information</b>
          </div>
          <div class="form-group">
            <label class="form-label">Owner Full Name</label>
            <input type="text" class="form-control" name="ownerName" value="${pet.owner ? pet.owner.name : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Emergency Phone</label>
            <input type="text" class="form-control" name="ownerPhone" value="${pet.owner ? pet.owner.phone : ''}" />
          </div>
          <div class="form-group form-full">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-control" name="ownerEmail" value="${pet.owner ? pet.owner.email : ''}" />
          </div>
          <div class="form-group form-full">
            <label class="form-label">Home Address</label>
            <input type="text" class="form-control" name="ownerAddress" value="${pet.owner ? pet.owner.address : ''}" />
          </div>
        </form>
      </div>
      <div class="drawer-footer" style="display: flex; justify-content: space-between; align-items: center;">
        <button class="btn btn-danger" id="drawer-delete-btn">Delete Pet</button>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" id="drawer-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="drawer-save-btn">Save Changes</button>
        </div>
      </div>
    `;

    const drawer = window.adminApp.openDrawer(drawerHtml);

    drawer.querySelector('#drawer-close-btn')?.addEventListener('click', () => window.adminApp.closeDrawer());
    drawer.querySelector('#drawer-cancel-btn')?.addEventListener('click', () => window.adminApp.closeDrawer());

    drawer.querySelector('#drawer-delete-btn')?.addEventListener('click', () => {
      window.adminApp.closeDrawer();
      this.confirmDeletePet(pet);
    });

    drawer.querySelector('#drawer-save-btn')?.addEventListener('click', () => {
      const form = drawer.querySelector('#drawer-pet-form');
      const formData = new FormData(form);

      const updatedPet = {
        id: pet.id,
        name: formData.get('name'),
        species: formData.get('species'),
        breed: formData.get('breed'),
        color: formData.get('color'),
        gender: formData.get('gender'),
        age: formData.get('age'),
        weight: formData.get('weight'),
        rfidTag: formData.get('rfidTag'),
        microchipNo: formData.get('microchipNo'),
        photoUrl: formData.get('photoUrl'),
        status: formData.get('status'),
        medicalNotes: formData.get('medicalNotes'),
        owner: {
          name: formData.get('ownerName'),
          phone: formData.get('ownerPhone'),
          email: formData.get('ownerEmail'),
          address: formData.get('ownerAddress')
        },
        registeredDate: pet.registeredDate
      };

      window.adminStore.savePet(updatedPet);
      window.adminApp.closeDrawer();
      window.adminApp.showToast(`Successfully updated ${updatedPet.name}`, 'success');
      const container = document.getElementById('view-container');
      if (container) this.render(container);
    });
  },

  openPetEditorModal(initialData = null, linkedSightingId = null) {
    const isEdit = !!(initialData && initialData.id && !linkedSightingId);
    const defaultRfid = initialData?.rfidTag || ('RFID-' + Math.floor(100000 + Math.random() * 900000));
    const defaultChip = initialData?.microchipNo || ('98514100' + Math.floor(1000000 + Math.random() * 9000000));

    const modalHtml = `
      <div class="modal-header">
        <div class="nock-card-title">${isEdit ? 'Edit Pet Profile' : (linkedSightingId ? 'Register Found Pet into Official Registry' : 'Register New Pet into Municipal Gateway')}</div>
        <button class="icon-btn-subtle" id="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="modal-pet-form" class="form-grid">
          <div class="form-group">
            <label class="form-label">Pet Name *</label>
            <input type="text" class="form-control" name="name" value="${initialData?.name || ''}" placeholder="e.g. Charlie" required />
          </div>
          <div class="form-group">
            <label class="form-label">Species</label>
            <select class="form-control" name="species">
              <option value="Dog" ${initialData?.species === 'Dog' ? 'selected' : ''}>Dog</option>
              <option value="Cat" ${initialData?.species === 'Cat' ? 'selected' : ''}>Cat</option>
              <option value="Other" ${initialData?.species === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Breed</label>
            <input type="text" class="form-control" name="breed" value="${initialData?.breed || ''}" placeholder="e.g. Beagle" />
          </div>
          <div class="form-group">
            <label class="form-label">Color / Coat</label>
            <input type="text" class="form-control" name="color" value="${initialData?.color || ''}" placeholder="e.g. Tri-color" />
          </div>
          <div class="form-group">
            <label class="form-label">Gender</label>
            <select class="form-control" name="gender">
              <option value="Male" ${initialData?.gender === 'Male' ? 'selected' : ''}>Male</option>
              <option value="Female" ${initialData?.gender === 'Female' ? 'selected' : ''}>Female</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Assigned RFID Tag</label>
            <input type="text" class="form-control" name="rfidTag" value="${defaultRfid}" style="font-family: var(--font-mono); font-weight: 700;" />
          </div>
          <div class="form-group">
            <label class="form-label">ISO Microchip No.</label>
            <input type="text" class="form-control" name="microchipNo" value="${defaultChip}" style="font-family: var(--font-mono);" />
          </div>
          <div class="form-group">
            <label class="form-label">Initial Status</label>
            <select class="form-control" name="status" style="font-weight: 700;">
              <option value="safe" ${initialData?.status === 'safe' || !initialData ? 'selected' : ''}>SAFE (Home)</option>
              <option value="impounded" ${initialData?.status === 'impounded' ? 'selected' : ''}>IMPOUNDED</option>
              <option value="reunited" ${initialData?.status === 'reunited' ? 'selected' : ''}>REUNITED</option>
              <option value="lost" ${initialData?.status === 'lost' ? 'selected' : ''}>LOST</option>
            </select>
          </div>
          <div class="form-group form-full">
            <label class="form-label">Photo URL</label>
            <input type="url" class="form-control" name="photoUrl" value="${initialData?.photoUrl || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80'}" />
          </div>

          <div class="form-full" style="border-top: 1px solid var(--border-light); padding-top: 12px; margin-top: 4px;">
            <b style="font-size: 12px; color: var(--ink-primary); display: block; margin-bottom: 10px;">Owner Contact Information</b>
          </div>
          <div class="form-group">
            <label class="form-label">Owner Full Name *</label>
            <input type="text" class="form-control" name="ownerName" value="${initialData?.owner?.name || initialData?.ownerName || ''}" placeholder="Full name" required />
          </div>
          <div class="form-group">
            <label class="form-label">Emergency Contact Phone *</label>
            <input type="text" class="form-control" name="ownerPhone" value="${initialData?.owner?.phone || initialData?.ownerPhone || ''}" placeholder="+63 9..." required />
          </div>
          <div class="form-group form-full">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-control" name="ownerEmail" value="${initialData?.owner?.email || ''}" placeholder="owner@email.com" />
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-btn">${isEdit ? 'Save Changes' : 'Complete Registration'}</button>
      </div>
    `;

    const modal = window.adminApp.openModalContent(modalHtml);

    modal.querySelector('#modal-close-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#modal-cancel-btn')?.addEventListener('click', () => window.adminApp.closeModal());

    modal.querySelector('#modal-submit-btn')?.addEventListener('click', () => {
      const form = modal.querySelector('#modal-pet-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const formData = new FormData(form);

      const newPet = {
        id: isEdit ? initialData.id : ('pet-' + Date.now()),
        name: formData.get('name'),
        species: formData.get('species'),
        breed: formData.get('breed'),
        color: formData.get('color'),
        gender: formData.get('gender'),
        rfidTag: formData.get('rfidTag'),
        microchipNo: formData.get('microchipNo'),
        photoUrl: formData.get('photoUrl'),
        status: formData.get('status'),
        medicalNotes: initialData?.medicalNotes || 'Newly registered in municipal database.',
        owner: {
          name: formData.get('ownerName'),
          phone: formData.get('ownerPhone'),
          email: formData.get('ownerEmail'),
          address: 'Metro Manila'
        },
        registeredDate: initialData?.registeredDate || new Date().toISOString().split('T')[0]
      };

      window.adminStore.savePet(newPet);

      // If promoted from an unregistered report, update the report status as well
      if (linkedSightingId) {
        const sighting = window.adminStore.getSightingById ? window.adminStore.getSightingById(linkedSightingId) : null;
        if (sighting) {
          sighting.status = 'registered_promoted';
          sighting.matchedPetId = newPet.id;
          window.adminStore.saveSighting(sighting);
        }
      }

      window.adminApp.closeModal();
      window.adminApp.showToast(`Registered pet "${newPet.name}" with tag ${newPet.rfidTag}`, 'success');
      const container = document.getElementById('view-container');
      if (container) this.render(container);
    });
  }
};
