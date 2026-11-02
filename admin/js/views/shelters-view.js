/**
 * PawTrack Admin — Municipal Shelters & Facilities Management
 * Comprehensive directory of known shelters, partnership status toggling, kennel capacity meters, and tariff schedules
 */

window.SheltersView = {
  currentFilter: 'all',
  searchQuery: '',

  render(container) {
    const store = window.adminStore;
    let shelters = store.getShelters();
    const impoundments = store.getImpoundments();

    // Calculate real live occupancy
    shelters.forEach(sh => {
      const activeHere = impoundments.filter(i => (i.shelterId === sh.id || i.shelterName === sh.name) && i.status === 'active_impounded').length;
      sh.occupied = Math.max(sh.occupied || 0, activeHere);
    });

    const totalCount = shelters.length;
    const partneredCount = shelters.filter(s => s.partnered === true).length;
    const nonPartneredCount = shelters.filter(s => !s.partnered).length;
    const qcCount = shelters.filter(s => (s.city && s.city.toLowerCase().includes('quezon')) || (s.address && s.address.toLowerCase().includes('quezon'))).length;
    const totalCapacity = shelters.reduce((acc, s) => acc + (s.capacity || 50), 0);
    const totalOccupied = shelters.reduce((acc, s) => acc + (s.occupied || 0), 0);
    const overallCapPercent = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    // Apply Filter
    let displayShelters = shelters;
    if (this.currentFilter === 'partnered') {
      displayShelters = displayShelters.filter(s => s.partnered === true);
    } else if (this.currentFilter === 'non_partnered') {
      displayShelters = displayShelters.filter(s => !s.partnered);
    } else if (this.currentFilter === 'quezon_city') {
      displayShelters = displayShelters.filter(s => (s.city && s.city.toLowerCase().includes('quezon')) || (s.address && s.address.toLowerCase().includes('quezon')));
    }

    // Apply Search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      displayShelters = displayShelters.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.type && s.type.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.officerInCharge && s.officerInCharge.toLowerCase().includes(q))
      );
    }

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Shelters</h1>
          <div class="subtitle">
            <span>Municipal pounds and partner shelters</span>
          </div>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-primary" id="btn-add-shelter">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add Shelter Facility
          </button>
        </div>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="kpi-grid" style="margin-bottom: 16px;">
        <div class="kpi-card">
          <div class="kpi-label">
            <span>Known Facilities</span>
          </div>
          <div class="kpi-body">
            <div>
              <div class="kpi-value">${totalCount} Total</div>
              <div class="kpi-delta neutral">${qcCount} in Quezon City</div>
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">
            <span>Partnered with Project</span>
          </div>
          <div class="kpi-body">
            <div>
              <div class="kpi-value" style="color: var(--color-green);">${partneredCount} Facilities</div>
              <div class="kpi-delta up">✓ Connected to PawTrack</div>
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">
            <span>Non-Partnered / External</span>
          </div>
          <div class="kpi-body">
            <div>
              <div class="kpi-value">${nonPartneredCount} Facilities</div>
              <div class="kpi-delta neutral">Independent / Municipal</div>
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">
            <span>Total Kennel Load</span>
          </div>
          <div class="kpi-body">
            <div>
              <div class="kpi-value">${totalOccupied} / ${totalCapacity}</div>
              <div class="kpi-delta ${overallCapPercent > 70 ? 'down' : 'up'}">${overallCapPercent}% occupied</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="table-container" style="margin-bottom: 16px;">
        <div class="table-toolbar" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 750; font-size: 13px; color: var(--ink-primary);">Facilities Directory</span>
            <span class="status-pill status-safe" style="font-size: 9px; padding: 1px 6px;">${displayShelters.length} Showing</span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <div class="table-search" style="width: 240px; max-width: 100%; height: 32px; font-size: 11.5px; box-sizing: border-box; margin: 0;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--ink-muted); flex-shrink: 0;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" id="shelter-search-input" placeholder="Search facilities by name, city, type..." value="${this.searchQuery || ''}" style="font-size: 11.5px; width: 100%; min-width: 0;" />
              ${this.searchQuery ? `<button id="btn-clear-shelter-search" style="border:none;background:transparent;cursor:pointer;color:var(--ink-muted);font-size:12px;padding:0 2px;">&times;</button>` : ''}
            </div>

            <div class="table-filters" style="box-sizing: border-box;">
              <button class="filter-pill ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All (${totalCount})</button>
              <button class="filter-pill ${this.currentFilter === 'partnered' ? 'active' : ''}" data-filter="partnered">Partnered (${partneredCount})</button>
              <button class="filter-pill ${this.currentFilter === 'non_partnered' ? 'active' : ''}" data-filter="non_partnered">Not Partnered (${nonPartneredCount})</button>
              <button class="filter-pill ${this.currentFilter === 'quezon_city' ? 'active' : ''}" data-filter="quezon_city">Quezon City (${qcCount})</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Facilities Grid -->
      <div class="facilities-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px;">
        ${displayShelters.length === 0 ? `
          <div class="nock-card" style="grid-column: 1 / -1; text-align: center; padding: 48px 24px; color: var(--ink-muted);">
            ${shelters.length === 0 ? `
              <div style="font-weight: 700; color: var(--ink-primary); font-size: 15px; margin-bottom: 4px;">No impound facility yet</div>
              <div style="font-size: 12px; max-width: 420px; margin: 0 auto 14px; line-height: 1.5; color: var(--ink-muted);">Facilities are stored in the database. Add the first shelter or pound and it will appear here, in the Shelter Terminal and in Impoundments.</div>
              <button class="btn btn-primary btn-sm" id="btn-add-shelter-empty">Add a shelter</button>
            ` : `
              <div style="font-weight: 700; color: var(--ink-primary); font-size: 14px; margin-bottom: 4px;">No Shelter Facilities Match Criteria</div>
              <div style="font-size: 12px; max-width: 420px; margin: 0 auto; line-height: 1.5; color: var(--ink-muted);">
                ${this.searchQuery ? `No records matched "${this.searchQuery}". Try clearing the search filter.` : 'No shelter facilities found under this filter.'}
              </div>
            `}
          </div>
        ` : displayShelters.map(sh => {
          const capPercent = Math.round(((sh.occupied || 0) / (sh.capacity || 50)) * 100);
          const isHigh = capPercent > 80;
          const isPartner = sh.partnered === true;

          return `
            <div class="nock-card" style="display: flex; flex-direction: column; justify-content: space-between; gap: 14px; border: 1px solid ${isPartner ? 'var(--color-green-border)' : 'var(--border-main)'};">
              <div>
                <!-- Card Header -->
                <div class="nock-card-head" style="margin-bottom: 10px;">
                  <div style="display: flex; align-items: flex-start; gap: 10px; min-width: 0;">
                    <span style="width: 28px; height: 28px; border-radius: 6px; background: ${isPartner ? 'var(--color-green-light)' : 'var(--bg-card-subtle)'}; border: 1px solid ${isPartner ? 'var(--color-green-border)' : 'var(--border-main)'}; display: grid; place-items: center; color: ${isPartner ? 'var(--color-green)' : 'var(--brand-terracotta)'}; flex-shrink: 0; margin-top: 1px;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </span>
                    <div style="display: flex; flex-direction: column; min-width: 0;">
                      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span class="nock-card-title" style="font-size: 13.5px; color: var(--ink-primary); line-height: 1.3;">${sh.name}</span>
                      </div>
                      <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px; flex-wrap: wrap;">
                        ${isPartner 
                          ? `<span class="status-pill status-safe" style="font-size: 9.5px; font-weight: 700; padding: 2px 7px;">🤝 Partnered Facility</span>` 
                          : `<span class="status-pill" style="font-size: 9.5px; font-weight: 600; padding: 2px 7px; background: var(--bg-card-subtle); color: var(--ink-muted); border: 1px solid var(--border-main);">⚪ Not Partnered</span>`}
                        <span class="mono-tag" style="font-size: 9px;">${sh.type || 'Municipal LGU'}</span>
                      </div>
                    </div>
                  </div>
                  <span class="mono-tag" style="font-size: 9px; flex-shrink: 0;">${sh.id}</span>
                </div>

                <!-- Facility Details -->
                <div style="display: flex; flex-direction: column; gap: 7px; font-size: 11.5px;">
                  <div style="color: var(--ink-muted); display: flex; align-items: flex-start; gap: 6px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--brand-terracotta); flex-shrink: 0; margin-top: 2px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span style="color: var(--ink-secondary);">${sh.address}</span>
                  </div>

                  <div style="display: flex; justify-content: space-between; color: var(--ink-secondary); font-size: 11px; flex-wrap: wrap; gap: 4px;">
                    <span><b>Tel:</b> ${sh.phone || 'N/A'}</span>
                    <span><b>Email:</b> ${sh.email || 'N/A'}</span>
                  </div>

                  <div style="display: flex; justify-content: space-between; color: var(--ink-muted); font-size: 11px; margin-top: 2px; flex-wrap: wrap; gap: 4px;">
                    <span><b>Hours:</b> ${sh.hours || 'Mon - Fri: 8:00 AM - 5:00 PM'}</span>
                    <span style="font-weight: 700; color: var(--brand-terracotta);">${sh.fee || 'PHP 500 / day'}</span>
                  </div>

                  ${sh.officerInCharge ? `
                    <div style="font-size: 10.5px; color: var(--ink-muted); font-family: var(--font-mono);">
                      OIC: ${sh.officerInCharge}
                    </div>
                  ` : ''}
                </div>

                <!-- Capacity Gauge -->
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-light);">
                  <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                    <span style="font-weight: 600; color: var(--ink-muted);">Kennel Occupancy</span>
                    <span style="font-family: var(--font-mono); font-weight: 700; color: ${isHigh ? 'var(--color-red)' : 'var(--color-green)'};">
                      ${sh.occupied || 0} / ${sh.capacity || 50} (${capPercent}%)
                    </span>
                  </div>
                  <div class="funnel-track">
                    <div class="funnel-fill" style="width: ${Math.min(capPercent, 100)}%; background: ${isHigh ? 'var(--color-red)' : (isPartner ? 'var(--color-green)' : 'var(--brand-terracotta)')};"></div>
                  </div>
                </div>
              </div>

              <!-- Card Actions Row -->
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; padding-top: 10px; border-top: 1px solid var(--border-light); flex-wrap: wrap;">
                <!-- Partnered Toggle Button -->
                <button class="btn btn-sm btn-partner-toggle ${isPartner ? 'is-partnered' : 'not-partnered'}" data-shelter-id="${sh.id}" style="${isPartner ? 'background: var(--color-green-light); border: 1px solid var(--color-green-border); color: var(--color-green); font-weight: 700;' : 'background: var(--bg-card-subtle); border: 1px solid var(--border-main); color: var(--ink-secondary); font-weight: 600;'} font-size: 11px; padding: 4px 9px;" title="Click to toggle partnership status">
                  ${isPartner ? '✓ Partnered with Project' : '+ Mark as Partnered'}
                </button>

                <div style="display: flex; gap: 6px;">
                  <button class="btn btn-sm btn-secondary btn-edit-shelter" data-shelter-id="${sh.id}">
                    Edit
                  </button>
                  <button class="btn btn-sm btn-danger btn-delete-shelter" data-shelter-id="${sh.id}">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.attachEvents(container);
  },

  attachEvents(container) {
    const store = window.adminStore;

    // Filter Buttons
    container.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentFilter = e.currentTarget.getAttribute('data-filter') || 'all';
        this.render(container);
      });
    });

    // Search Input
    const searchInput = container.querySelector('#shelter-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.render(container);
    });

    // Clear Search Button
    container.querySelector('#btn-clear-shelter-search')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.render(container);
    });

    // Add Shelter Button
    container.querySelector('#btn-add-shelter-empty')?.addEventListener('click', () => this.openShelterModal(null));
    container.querySelector('#btn-add-shelter')?.addEventListener('click', () => {
      this.openShelterModal(null);
    });

    // Partnered Toggle Button
    container.querySelectorAll('.btn-partner-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-shelter-id');
        const updated = store.toggleShelterPartner(id);
        if (updated) {
          window.adminApp.showToast(`${updated.name}: Set to ${updated.partnered ? '✓ Partnered with Project' : '⚪ Not Partnered'}`, updated.partnered ? 'success' : 'info', 2200);
          this.render(container);
        }
      });
    });

    // Edit Shelter Button
    container.querySelectorAll('.btn-edit-shelter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-shelter-id');
        const sh = store.getShelters().find(s => s.id === id);
        if (sh) this.openShelterModal(sh);
      });
    });

    // Delete Shelter Button
    container.querySelectorAll('.btn-delete-shelter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-shelter-id');
        if (confirm(`Remove this municipal facility record (${id})?`)) {
          store.deleteShelter(id);
          window.adminApp.showToast('Shelter facility removed', 'warning');
          this.render(container);
        }
      });
    });
  },

  // Looks up the coordinates of an address with Google (null when unavailable)
  async geocodeAddress(address) {
    try {
      if (!window.PawGoogleMaps || !(await window.PawGoogleMaps.isConfigured())) return null;
      const timeout = new Promise(resolve => setTimeout(() => resolve(null), 6000));
      const lookup = (async () => {
        await window.PawGoogleMaps.load();
        const { Geocoder } = await google.maps.importLibrary('geocoding');
        const { results } = await new Geocoder().geocode({ address, region: 'PH' });
        const loc = results && results[0] && results[0].geometry.location;
        return loc ? { lat: loc.lat(), lng: loc.lng() } : null;
      })().catch(() => null);
      return await Promise.race([lookup, timeout]);
    } catch (e) { return null; }
  },

  openShelterModal(initial = null, opts = {}) {
    const isEdit = !!initial;
    const store = window.adminStore;
    const isPartner = initial ? initial.partnered === true : true;

    const modalHtml = `
      <div class="modal-header">
        <div class="nock-card-title">${isEdit ? 'Edit Shelter Facility' : 'Add Known Shelter / Impound Facility'}</div>
        <button class="icon-btn-subtle" id="shelter-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="shelter-form" class="form-grid">
          <div class="form-group form-full">
            <label class="form-label">Facility Name *</label>
            <input type="text" class="form-control" name="name" value="${initial ? initial.name : ''}" placeholder="e.g. Quezon City Animal Care & Adoption Facility" required />
          </div>

          <div class="form-group">
            <label class="form-label">Facility Type</label>
            <select class="form-control" name="type">
              <option value="Municipal LGU Facility" ${initial && initial.type === 'Municipal LGU Facility' ? 'selected' : ''}>Municipal LGU Facility</option>
              <option value="Non-Profit Animal Welfare Sanctuary" ${initial && initial.type === 'Non-Profit Animal Welfare Sanctuary' ? 'selected' : ''}>Non-Profit Animal Welfare Sanctuary</option>
              <option value="Non-Profit Rescue Clinic & Sanctuary" ${initial && initial.type === 'Non-Profit Rescue Clinic & Sanctuary' ? 'selected' : ''}>Non-Profit Rescue Clinic & Sanctuary</option>
              <option value="Animal Welfare Hospital & Sanctuary" ${initial && initial.type === 'Animal Welfare Hospital & Sanctuary' ? 'selected' : ''}>Animal Welfare Hospital & Sanctuary</option>
              <option value="Spay/Neuter & Animal Welfare Center" ${initial && initial.type === 'Spay/Neuter & Animal Welfare Center' ? 'selected' : ''}>Spay/Neuter & Animal Welfare Center</option>
              <option value="Private Animal Rescue Sanctuary" ${initial && initial.type === 'Private Animal Rescue Sanctuary' ? 'selected' : ''}>Private Animal Rescue Sanctuary</option>
              <option value="Municipal LGU Pound" ${initial && initial.type === 'Municipal LGU Pound' ? 'selected' : ''}>Municipal LGU Pound</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Partnership with PawTrack Project</label>
            <select class="form-control" name="partnered">
              <option value="true" ${isPartner ? 'selected' : ''}>🤝 Partnered with Project</option>
              <option value="false" ${!isPartner ? 'selected' : ''}>⚪ Not Partnered (External Facility)</option>
            </select>
          </div>

          <div class="form-group form-full">
            <label class="form-label">City / Municipality Jurisdiction *</label>
            <input type="text" class="form-control" name="city" value="${initial && initial.city ? initial.city : ''}" placeholder="e.g. Quezon City (District 2), City of Manila, Pasig City" required />
          </div>

          <div class="form-group form-full">
            <label class="form-label">Physical Address *</label>
            <input type="text" class="form-control" name="address" value="${initial ? initial.address : ''}" placeholder="Street, Barangay, City" required />
          </div>

          <div class="form-group">
            <label class="form-label">Contact Phone</label>
            <input type="text" class="form-control" name="phone" value="${initial ? initial.phone : ''}" placeholder="e.g. +63 (2) 8123-4567" />
          </div>

          <div class="form-group">
            <label class="form-label">Official Email</label>
            <input type="email" class="form-control" name="email" value="${initial ? initial.email : ''}" placeholder="e.g. shelter@city.gov.ph" />
          </div>

          <div class="form-group">
            <label class="form-label">Daily Holding Tariff</label>
            <input type="text" class="form-control" name="fee" value="${initial ? initial.fee : ''}" placeholder="e.g. PHP 500 / day" />
          </div>

          <div class="form-group">
            <label class="form-label">Kennel Total Capacity</label>
            <input type="number" class="form-control" name="capacity" value="${initial ? initial.capacity : 50}" min="1" max="500" />
          </div>

          <div class="form-group form-full">
            <label class="form-label">Operating Schedule</label>
            <input type="text" class="form-control" name="hours" value="${initial ? initial.hours : ''}" placeholder="e.g. Mon - Fri: 8:00 AM - 5:00 PM" />
          </div>

          <div class="form-group form-full">
            <label class="form-label">Officer In Charge / Head Veterinarian</label>
            <input type="text" class="form-control" name="officerInCharge" value="${initial && initial.officerInCharge ? initial.officerInCharge : ''}" placeholder="Name of the officer or head veterinarian" placeholder="e.g. Dr. Fernando Gomez, DVM" />
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="shelter-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="shelter-save-btn">${isEdit ? 'Save Changes' : 'Create Facility'}</button>
      </div>
    `;

    const modal = window.adminApp.openModalContent(modalHtml);

    modal.querySelector('#shelter-close-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#shelter-cancel-btn')?.addEventListener('click', () => window.adminApp.closeModal());

    modal.querySelector('#shelter-save-btn')?.addEventListener('click', async () => {
      const form = modal.querySelector('#shelter-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const saveBtn = modal.querySelector('#shelter-save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      const formData = new FormData(form);
      const address = formData.get('address');

      // Pin the facility on the map from its address; keep the old pin when editing without an address change
      let coords = initial && initial.address === address && Number.isFinite(+initial.lat) ? { lat: +initial.lat, lng: +initial.lng } : null;
      if (!coords) coords = await this.geocodeAddress(`${address}, ${formData.get('city') || ''}, Philippines`);
      if (!coords && initial && Number.isFinite(+initial.lat)) coords = { lat: +initial.lat, lng: +initial.lng };
      if (!coords) coords = { lat: 14.676, lng: 121.0437 }; // Quezon City centre when the address cannot be located

      const shelterData = {
        id: initial ? initial.id : 'sh-' + Date.now(),
        name: formData.get('name'),
        type: formData.get('type') || 'Municipal LGU Facility',
        city: formData.get('city') || 'Quezon City',
        partnered: formData.get('partnered') === 'true',
        address,
        phone: formData.get('phone'),
        email: formData.get('email'),
        fee: formData.get('fee'),
        capacity: parseInt(formData.get('capacity'), 10) || 50,
        occupied: initial ? initial.occupied : 0,
        hours: formData.get('hours'),
        officerInCharge: formData.get('officerInCharge') || '',
        lat: coords.lat,
        lng: coords.lng,
        holdingPeriodDays: initial && initial.holdingPeriodDays ? initial.holdingPeriodDays : 3
      };

      window.adminApp.closeModal();
      window.adminApp.showToast(`Saved facility "${shelterData.name}"`, 'success');
      if (typeof opts.onCreated === 'function' && !isEdit) {
        store.saveShelter(shelterData, opts.onCreated);
      } else {
        store.saveShelter(shelterData);
        window.adminApp.renderView('shelters');
      }
    });
  }
};
