/**
 * PawTrack Admin — Municipal Impoundment & Shelter Holding Operations
 * Active 72h countdown clocks, cage assignments, extensions, fee clearing, and release processing
 */

// Final outcomes for a closed impound case (status 'active_impounded' means still in holding)
window.IMPOUND_OUTCOMES = {
  claimed: { label: 'Reunited with owner', pill: 'status-safe', color: 'var(--color-green)' },
  forfeited: { label: 'Unclaimed / forfeited', pill: 'status-impounded', color: 'var(--color-amber)' },
  transferred: { label: 'Transferred', pill: 'status-reunited', color: 'var(--color-blue)' },
  deceased: { label: 'Deceased in holding', pill: 'status-lost', color: 'var(--color-red)' }
};

window.ImpoundmentsView = {
  currentTab: 'active',
  // The facility being viewed is the console-wide active facility (remembered across refreshes, shared by every page)
  get facilityFilter() { return (window.adminStore && window.adminStore.getActiveFacilityId()) || 'all'; },
  set facilityFilter(id) { if (window.adminStore) window.adminStore.setActiveFacility(id); },
  setFacility(id) { this.facilityFilter = id; },
  pendingIntake: false,    // open the Scan & intake dialog as soon as the page has drawn
  query: '',               // the search that is applied (set by the Search button or Enter)
  speciesFilter: 'all',    // 'all' | 'Dog' | 'Cat' | 'Other'
  periodFilter: 'all',     // when the animal was taken in: 'all' | 'today' | '7d' | '30d'
  deadlineFilter: 'all',   // claim window: 'all' | 'overdue' | 'soon' (due within 24 hours)
  _listed: [],             // the rows currently shown (what Export CSV saves)

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // Opens the page and then the Scan & intake dialog (from the Dashboard and the command palette)
  requestIntake() {
    this.pendingIntake = true;
    if (window.adminApp && window.adminApp.currentRoute === 'impoundments') window.adminApp.renderView('impoundments');
    else window.location.hash = '#impoundments';
  },

  // Opens the page showing one facility's pets (tapped on the Facilities page)
  showFacility(id, tab) {
    this.setFacility(id);
    this.currentTab = tab || 'active';
    this.query = '';
    if (window.adminApp && window.adminApp.currentRoute === 'impoundments') window.adminApp.renderView('impoundments');
    else window.location.hash = '#impoundments';
  },

  // Shown until the admin has added the one facility they run
  renderNoFacility(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Impoundments</h1>
          <div class="subtitle"><span>Animals in the 72-hour holding window</span></div>
        </div>
      </div>
      <div class="nock-card tm-empty">
        <h2>Set up your impound facility</h2>
        <p>Impoundments belong to the facility you work for, and each account belongs to one. Register yours and you become its manager, or join with the invite code your manager shares.</p>
        <div class="tm-empty-actions">
          <button class="btn btn-primary" id="imp-add-facility">Register your facility</button>
          <button class="btn btn-secondary" id="imp-join-facility">Join with invite code</button>
        </div>
      </div>`;
    const reload = () => window.adminApp.renderView('impoundments');
    container.querySelector('#imp-add-facility').addEventListener('click', () => window.SheltersView.openShelterModal(null, { onCreated: reload }));
    container.querySelector('#imp-join-facility').addEventListener('click', () => window.SheltersView.openJoinModal({ onJoined: reload }));
  },

  render(container) {
    const store = window.adminStore;
    // Each admin runs one facility: this page lists that facility's animals only
    const mine = store.getMyShelter();
    const allMine = store.getMyImpoundments();

    if (!mine) return this.renderNoFacility(container);

    // A main facility also sees its sub-facilities' pets, and can narrow the list to one of them
    const subs = store.getSubFacilities();
    const treeIds = typeof store.getMyFacilityIds === 'function' ? store.getMyFacilityIds() : [];
    const facilityIds = treeIds.length ? treeIds : [mine.id, ...subs.map(x => x.id)];
    // One facility at a time (a sub-facility is a facility like any other); fall back to the account's own when none/unknown is remembered
    if (!facilityIds.includes(this.facilityFilter)) this.facilityFilter = facilityIds.includes(mine.id) ? mine.id : facilityIds[0];
    const impoundments = allMine.filter(i => i.shelterId === this.facilityFilter);
    // Transfers waiting at a facility are shown with that facility only (all of them when no facility is picked)
    const incoming = store.getIncomingTransfers().filter(t => t.transferToId === this.facilityFilter);
    const myId = store.myShelterId();
    const isManager = store.isFacilityManager();
    const shelterName = (id) => (store.getShelters().find(x => x.id === id) || {}).name || 'the main facility';

    let filtered = impoundments;
    if (this.currentTab === 'active') {
      filtered = impoundments.filter(i => i.status === 'active_impounded');
    } else if (this.currentTab === 'closed') {
      filtered = impoundments.filter(i => window.IMPOUND_OUTCOMES[i.status]);
    }
    const q = this.query.trim().toLowerCase();
    const hl = (v) => window.PawSearch.highlight(v, this.query);
    if (q) {
      filtered = filtered.filter(i => window.PawSearch.matches(q, [i.petName, i.rfidTag, i.cageNumber, i.species, i.breed, i.shelterName, i.impoundLocation, i.location]));
    }
    // Filters (they combine with the tab and the search)
    const now = Date.now();
    const asTime = (v) => { const t = v ? new Date(v).getTime() : NaN; return Number.isFinite(t) ? t : null; };
    if (this.speciesFilter !== 'all') {
      filtered = filtered.filter(i => (['Dog', 'Cat'].includes(i.species) ? i.species : 'Other') === this.speciesFilter);
    }
    if (this.periodFilter !== 'all') {
      const since = this.periodFilter === 'today' ? new Date().setHours(0, 0, 0, 0) : now - (this.periodFilter === '7d' ? 7 : 30) * 86400000;
      filtered = filtered.filter(i => { const t = asTime(i.intakeDate); return t != null && t >= since; });
    }
    if (this.deadlineFilter !== 'all') {
      filtered = filtered.filter(i => {
        if (i.status !== 'active_impounded') return false;
        const d = asTime(i.claimDeadline);
        if (d == null) return false;
        return this.deadlineFilter === 'overdue' ? d < now : (d >= now && d - now < 86400000);
      });
    }
    const filtersOn = this.speciesFilter !== 'all' || this.periodFilter !== 'all' || this.deadlineFilter !== 'all' || !!q;
    this._listed = filtered;

    const counts = {
      all: impoundments.length,
      active: impoundments.filter(i => i.status === 'active_impounded').length,
      claimed: impoundments.filter(i => i.status === 'claimed').length,
    };

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Impoundments</h1>
          <div class="subtitle">
            <span>Animals in the 72-hour holding window at ${this.esc(shelterName(this.facilityFilter))}</span>
          </div>
        </div>
        <div class="view-header-actions">
          <a href="#shelters" class="btn btn-secondary" id="btn-facilities">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>
            Facilities
          </a>
          <button class="btn btn-primary" id="btn-intake-modal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 12h16"/></svg>
            Scan &amp; intake
          </button>
        </div>
      </div>

      ${facilityIds.length > 1 ? `
      <div class="imp-scope" role="status">
        <span class="imp-scope-ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg></span>
        <div class="imp-scope-text">
          <small>Viewing facility</small>
          <b>${this.esc(shelterName(this.facilityFilter))}${(() => { const f = store.getShelters().find(x => x.id === this.facilityFilter); return f && f.parentId ? ` <em class="imp-scope-tag">Sub of ${this.esc(shelterName(f.parentId))}</em>` : ''; })()}</b>
        </div>
      </div>` : ''}

      <!-- Quick Status Strip -->
      <div class="kpi-grid kpi-grid-3">
        <div class="kpi-card">
          <div class="kpi-label">In Holding Now</div>
          <div class="kpi-body">
            <div>
              <div class="kpi-value">${counts.active} Cases</div>
              <div class="kpi-delta neutral">Within the 72-hour window</div>
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Claimed by Owners</div>
          <div class="kpi-body">
            <div>
              <div class="kpi-value">${counts.claimed} Claims</div>
              <div class="kpi-delta neutral">Released after verification</div>
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Closed Cases</div>
          <div class="kpi-body">
            <div>
              <div class="kpi-value">${counts.all - counts.active} Closed</div>
              <div class="kpi-delta neutral">Released, forfeited or transferred</div>
            </div>
          </div>
        </div>
      </div>

      ${incoming.length ? `
      <div class="nock-card imp-incoming" role="region" aria-label="Incoming transfers">
        <div class="nock-card-head">
          <span class="nock-card-title">Incoming transfers <span class="dash-count">${incoming.length}</span></span>
          <span class="nock-card-right">Not collected in time, moved here from a sub-facility</span>
        </div>
        <ul class="imp-incoming-list">
          ${incoming.map(t => `
            <li>
              ${t.photoUrl ? `<img class="imp-in-img" src="${this.esc(t.photoUrl)}" alt="" loading="lazy" />` : '<span class="imp-in-img imp-in-ph" aria-hidden="true">🐾</span>'}
              <div class="imp-in-text"><b>${this.esc(t.petName || 'Unidentified animal')}</b><span>From ${this.esc(shelterName(t.originShelterId))} · sent ${t.transferStartedAt ? new Date(t.transferStartedAt).toLocaleDateString() : ''}</span></div>
              <button class="btn btn-sm btn-primary btn-confirm-arrival" data-impound-id="${this.esc(t.id)}">Confirm arrival</button>
            </li>`).join('')}
        </ul>
      </div>` : ''}

      <!-- Table Section -->
      <div class="table-container">
        <div class="table-toolbar">
          ${facilityIds.length > 1 ? `<label class="imp-facility-filter"><span class="hm-label">Facility</span>
            <select id="imp-facility-select" class="hm-select">
              ${facilityIds.map(id => `<option value="${this.esc(id)}" ${this.facilityFilter === id ? 'selected' : ''}>${this.esc(shelterName(id))}</option>`).join('')}
            </select></label>` : ''}
          <div class="table-filters imp-tabs-field">
            <label class="hm-label" for="imp-tab">Show</label>
            <select id="imp-tab" class="hm-select">
              ${[['active', 'Active Holding'], ['closed', 'Closed Cases'], ['all', 'Full History']].map(([v, l]) => `<option value="${v}" ${this.currentTab === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="imp-tools">
            <form id="imp-search-form" class="imp-search" role="search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" id="imp-search" placeholder="Pet, tag, cage or breed  ( / )" value="${this.esc(this.query)}" aria-label="Search impounded pets" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="imp-suggest" aria-autocomplete="list" />
              <button type="button" class="rp-clear-x" id="imp-clear-x" aria-label="Clear search" ${this.query ? '' : 'hidden'}>×</button>
              <button type="submit" class="btn btn-primary btn-sm" id="imp-search-btn">Search</button>
              <div class="rp-suggest" id="imp-suggest" role="listbox" hidden></div>
            </form>
          </div>
          <div class="imp-filterbar">
            ${[
              ['imp-species', 'Animal', this.speciesFilter, [['all', 'All animals'], ['Dog', 'Dogs'], ['Cat', 'Cats'], ['Other', 'Other']]],
              ['imp-period', 'Taken in', this.periodFilter, [['all', 'Any time'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days']]],
              ['imp-deadline', 'Claim window', this.deadlineFilter, [['all', 'Any'], ['overdue', 'Past deadline'], ['soon', 'Due within 24h']]]
            ].map(([id, label, cur, opts]) => `
              <div class="hm-field"><label class="hm-label" for="${id}">${label}</label>
                <select id="${id}" class="hm-select">${opts.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}
            ${filtersOn ? '<button type="button" class="btn btn-secondary btn-sm" id="imp-clear-filters">Clear filters</button>' : ''}
            <div class="imp-resultbar">
              <span class="imp-count" aria-live="polite">${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}</span>
              <button type="button" class="btn btn-secondary btn-sm imp-export-btn" id="imp-export" ${filtered.length ? '' : 'disabled'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>Export CSV
              </button>
            </div>
          </div>
        </div>

        <div class="data-table-wrapper">
          <table class="data-table imp-table">
            <thead>
              <tr>
                <th>Pet</th>
                <th>Facility & Cage</th>
                <th>Taken in</th>
                <th>Claim window (72h)</th>
                <th>Penalty</th>
                <th>Notes</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="7" class="imp-empty" style="text-align: center; padding: 48px 24px; color: var(--ink-muted);">
                    <div style="font-weight: 700; color: var(--ink-primary); font-size: 14px; margin-bottom: 4px;">No animals in holding</div>
                    <div style="font-size: 12px; max-width: 480px; margin: 0 auto; line-height: 1.5; color: var(--ink-muted);">
                      Tap “Scan &amp; intake” when an animal arrives at the facility.
                    </div>
                  </td>
                </tr>
              ` : filtered.map(imp => {
                const deadlineMs = new Date(imp.claimDeadline).getTime();
                const nowMs = Date.now();
                const diffHours = Math.round((deadlineMs - nowMs) / (3600 * 1000));
                const isExpired = diffHours <= 0;
                const windowMs = deadlineMs - new Date(imp.intakeDate).getTime();
                const pct = windowMs > 0 ? Math.max(0, Math.min(100, Math.round(((deadlineMs - nowMs) / windowMs) * 100))) : 0;
                const tone = pct <= 25 ? 'is-low' : pct <= 50 ? 'is-mid' : '';
                const outcome = window.IMPOUND_OUTCOMES[imp.status];
                const tstat = imp.transferStatus;
                const transferNote = tstat === 'pending' ? `<span class="status-pill status-impounded" title="Not collected in time: being moved to the main facility">Moving to ${this.esc(shelterName(imp.transferToId))}</span>`
                  : tstat === 'not_arrived' ? '<span class="status-pill status-lost" title="The main facility reported that this pet did not arrive">Did not arrive</span>'
                  : tstat === 'received' ? `<span class="status-pill status-reunited">Moved from ${this.esc(shelterName(imp.originShelterId))}</span>` : '';
                const ticket = store.getTicketForImpound(imp.id);
                const mineToCollect = !!ticket && ticket.payeeShelterId === myId;
                const penaltyCell = !ticket ? '<span class="mono-tag">—</span>'
                  : ticket.status === 'unpaid' ? `<span class="status-pill status-lost">PHP ${this.esc(ticket.amount)} unpaid</span><div class="imp-tk">${this.esc(ticket.ticketNo)}</div>${mineToCollect ? `<div class="imp-tk-actions"><button class="btn btn-sm btn-secondary btn-ticket-pay" data-ticket-id="${this.esc(ticket.id)}">Record payment</button>${isManager ? `<button class="btn btn-sm btn-secondary btn-ticket-waive" data-ticket-id="${this.esc(ticket.id)}">Waive</button>` : ''}</div>` : `<div class="imp-tk">Pay to ${this.esc(shelterName(ticket.payeeShelterId))}</div>`}`
                  : ticket.status === 'paid' ? `<span class="status-pill status-safe">Paid</span><div class="imp-tk">${this.esc(ticket.ticketNo)}${ticket.reference ? ' · ' + this.esc(ticket.reference) : ''}</div>`
                  : `<span class="status-pill status-reunited" title="${this.esc(ticket.waivedReason)}">Waived</span><div class="imp-tk">${this.esc(ticket.ticketNo)}</div>`;

                return `
                  <tr data-impound-id="${imp.id}">
                    <td class="imp-c-pet" data-label="Pet">
                      <div class="pet-cell">
                        <img src="${this.esc(/^https:\/\//.test(imp.photoUrl || '') ? imp.photoUrl : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=150&q=80')}" class="pet-thumb" alt="" />
                        <div class="pet-meta">
                          <span class="pet-name">${hl(imp.petName || 'Unidentified Pet')}</span>
                          <span class="mono-tag imp-tag">${hl(imp.rfidTag || 'NO TAG')}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Facility &amp; cage">
                      <div class="imp-fac">
                        <b>${this.esc(imp.shelterName || 'Municipal Shelter')}</b>
                        <span class="imp-cage"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/></svg>${hl(imp.cageNumber || 'No cage yet')}</span>
                      </div>
                    </td>
                    <td data-label="Taken in">
                      <div class="imp-when">
                        <b>${new Date(imp.intakeDate).toLocaleDateString()}</b>
                        <span>${new Date(imp.intakeDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td data-label="Claim window">
                      ${transferNote}
                      ${outcome ? `
                        <div class="imp-claim">
                          <span class="status-pill ${outcome.pill}">${outcome.label}</span>
                          <span class="imp-claim-by">${imp.closedAt || imp.claimedAt ? new Date(imp.closedAt || imp.claimedAt).toLocaleDateString() : 'Case closed'}</span>
                        </div>
                      ` : isExpired ? `
                        <div class="imp-claim">
                          <span class="status-pill status-lost">Overdue by ${Math.abs(diffHours)}h</span>
                          <i class="imp-bar is-low" aria-hidden="true"><u style="width:100%"></u></i>
                          <span class="imp-claim-by">Was due ${new Date(imp.claimDeadline).toLocaleDateString()} ${new Date(imp.claimDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ` : `
                        <div class="imp-claim">
                          <span class="status-pill status-impounded">${diffHours}h left</span>
                          <i class="imp-bar ${tone}" aria-hidden="true"><u style="width:${pct}%"></u></i>
                          <span class="imp-claim-by">Claim by ${new Date(imp.claimDeadline).toLocaleDateString()} ${new Date(imp.claimDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      `}
                    </td>
                    <td data-label="Penalty">${penaltyCell}</td>
                    <td data-label="Notes">
                      <div class="imp-note" title="${this.esc(imp.healthCondition || '')}">${this.esc(imp.healthCondition || 'No condition issues noted upon intake.')}</div>
                      <span class="imp-officer"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>${this.esc(imp.intakeOfficer || 'ACO Officer')}</span>
                    </td>
                    <td class="imp-c-actions" style="text-align: right;">
                      <div class="imp-actions" style="display: flex; justify-content: flex-end; gap: 6px;">
                        ${!outcome ? `
                          <button class="btn btn-sm chip-green btn-claim-impound" data-impound-id="${imp.id}" ${ticket && ticket.status === 'unpaid' ? `disabled title="Penalty ticket ${this.esc(ticket.ticketNo)} is unpaid. Record the payment (or waive it) first."` : 'title="Hand the pet back to its owner and close the case"'}>
                            Release to owner
                          </button>
                          <button class="btn btn-sm btn-secondary btn-extend-deadline" data-impound-id="${imp.id}" title="Give the owner 24 more hours to claim">
                            +24h
                          </button>
                        ` : ''}
                        <button class="btn btn-sm btn-secondary btn-edit-impound imp-ico" data-impound-id="${imp.id}" title="Edit this case" aria-label="Edit this case">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
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

    this.attachEvents(container);
    if (this.pendingIntake) {
      this.pendingIntake = false;
      this.openIntakeModal({ facilityId: this.facilityFilter });
    }
  },

  // The main facility answers: did the pet that was sent from a sub-facility really arrive?
  openArrivalModal(imp) {
    const store = window.adminStore;
    const esc = (v) => this.esc(v);
    const from = (store.getShelters().find(x => x.id === imp.originShelterId) || {}).name || 'a sub-facility';
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Confirm arrival: ${esc(imp.petName || 'Unidentified animal')}</div>
        <button class="icon-btn-subtle" id="arr-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 12.5px; color: var(--ink-secondary); line-height: 1.55; margin-bottom: 14px;">${esc(imp.petName || 'This animal')} was not collected from <b>${esc(from)}</b> within its holding window and was sent to your facility. Please confirm whether it really arrived.</p>
        <form id="arrival-form" class="form-grid" novalidate>
          <div class="form-group form-full">
            <div class="imp-choice" role="radiogroup" aria-label="Did the pet arrive?">
              <label><input type="radio" name="arrived" value="yes" checked /> <span>Yes, it arrived</span></label>
              <label><input type="radio" name="arrived" value="no" /> <span>No, it has not arrived</span></label>
            </div>
          </div>
          <div class="form-group form-full" id="arr-cage-group">
            <label class="form-label" for="arr-cage">Cage number *</label>
            <input type="text" class="form-control" id="arr-cage" name="cage" placeholder="e.g. Cage 12" />
          </div>
          <div class="form-group form-full">
            <label class="form-label" for="arr-notes">Notes</label>
            <textarea class="form-control" id="arr-notes" name="notes" maxlength="500" placeholder="Condition on arrival, or what happened if it did not arrive"></textarea>
          </div>
        </form>
        <div class="fm-error" id="arr-error" role="alert" hidden></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="arr-cancel">Cancel</button>
        <button class="btn btn-primary" id="arr-save">Save</button>
      </div>`);
    const form = modal.querySelector('#arrival-form');
    const err = modal.querySelector('#arr-error');
    const arrived = () => form.elements.arrived.value === 'yes';
    const sync = () => { modal.querySelector('#arr-cage-group').hidden = !arrived(); };
    form.addEventListener('change', sync);
    sync();
    modal.querySelector('#arr-close')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#arr-cancel')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#arr-save')?.addEventListener('click', async () => {
      const cage = form.elements.cage.value.trim();
      if (arrived() && !cage) { err.textContent = 'Enter the cage the pet is in.'; err.hidden = false; form.elements.cage.focus(); return; }
      err.hidden = true;
      const btn = modal.querySelector('#arr-save');
      btn.disabled = true; btn.textContent = 'Saving…';
      const ok = await store.confirmTransferArrival(imp.id, arrived(), cage, form.elements.notes.value.trim());
      if (!ok) { btn.disabled = false; btn.textContent = 'Save'; return; }
      window.adminApp.closeModal();
      window.adminApp.showToast(arrived() ? `${imp.petName || 'The pet'} is now in your facility.` : 'Recorded: the pet did not arrive.', arrived() ? 'success' : 'warning');
    });
  },

  // Record that the owner paid a penalty ticket, or waive it
  openTicketModal(ticket, mode) {
    const store = window.adminStore;
    const esc = (v) => this.esc(v);
    const pay = mode === 'pay';
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">${pay ? 'Record payment' : 'Waive penalty'}: ${esc(ticket.ticketNo)}</div>
        <button class="icon-btn-subtle" id="tk-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 12.5px; color: var(--ink-secondary); line-height: 1.55; margin-bottom: 14px;">Penalty of <b>PHP ${esc(ticket.amount)}</b> for <b>${esc(ticket.petName)}</b>, a missing pet that was impounded. ${pay ? 'Enter the receipt or reference number once the owner has paid.' : 'The owner will no longer have to pay, and the pet can be released. Only do this with a good reason.'}</p>
        <div class="form-group">
          <label class="form-label" for="tk-input">${pay ? 'Receipt / reference number' : 'Reason *'}</label>
          ${pay ? '<input type="text" class="form-control" id="tk-input" maxlength="120" placeholder="e.g. OR-004512" />' : '<textarea class="form-control" id="tk-input" maxlength="300" placeholder="Why is the penalty being waived?"></textarea>'}
        </div>
        <div class="fm-error" id="tk-error" role="alert" hidden></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="tk-cancel">Cancel</button>
        <button class="btn btn-primary" id="tk-save">${pay ? 'Mark as paid' : 'Waive penalty'}</button>
      </div>`);
    modal.querySelector('#tk-close')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#tk-cancel')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#tk-save')?.addEventListener('click', async () => {
      const val = modal.querySelector('#tk-input').value.trim();
      const err = modal.querySelector('#tk-error');
      if (!pay && val.length < 3) { err.textContent = 'Give a reason for waiving the penalty.'; err.hidden = false; return; }
      const btn = modal.querySelector('#tk-save');
      btn.disabled = true;
      const ok = pay ? await store.recordTicketPayment(ticket.id, val) : await store.waiveTicket(ticket.id, val);
      if (!ok) { btn.disabled = false; return; }
      window.adminApp.closeModal();
      window.adminApp.showToast(pay ? 'Payment recorded. The owner was notified.' : 'Penalty waived.', 'success');
    });
  },

  attachEvents(container) {
    const store = window.adminStore;

    // Tabs
    container.querySelector('#imp-tab')?.addEventListener('change', (e) => {
      this.currentTab = e.target.value;
      this.render(container);
    });

    // Intake modal trigger
    container.querySelector('#btn-intake-modal')?.addEventListener('click', () => {
      this.openIntakeModal();
    });

    // Claim / Release button
    container.querySelectorAll('.btn-claim-impound').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-impound-id');
        const imp = store.getImpoundmentById(id);
        if (!imp) return;
        const ok = await window.adminApp.confirmDialog({
          title: `Release ${imp.petName || 'this pet'} to its owner?`,
          message: 'The case is closed and the pet is marked safe again. Check the owner\'s ID before handing the pet over.',
          confirmLabel: 'Release to owner'
        });
        if (!ok) return;
        if (store.claimImpoundment(id, (store.currentAdmin() || {}).full_name || 'Admin Officer')) {
          window.adminApp.showToast(`${imp.petName || 'The pet'} was released to its owner.`, 'success');
        }
        this.render(container);
      });
    });

    // Search box: suggestions, keyboard, clear button and "/" are shared with the other pages (search-box.js)
    window.PawSearch.attach({
      form: container.querySelector('#imp-search-form'),
      input: container.querySelector('#imp-search'),
      box: container.querySelector('#imp-suggest'),
      clearBtn: container.querySelector('#imp-clear-x'),
      current: () => this.query,
      suggestions: (typed) => window.PawSearch.suggest(typed, store.getMyImpoundments().flatMap(i => [[i.petName, 'Pet'], [i.rfidTag, 'Tag'], [i.cageNumber, 'Cage'], [i.breed, 'Breed']])),
      apply: (value) => { this.query = value; this.render(container); }
    });
    [['#imp-species', 'speciesFilter'], ['#imp-period', 'periodFilter'], ['#imp-deadline', 'deadlineFilter']].forEach(([sel, key]) => {
      container.querySelector(sel)?.addEventListener('change', (e) => { this[key] = e.target.value; this.render(container); });
    });
    container.querySelector('#imp-clear-filters')?.addEventListener('click', () => {
      Object.assign(this, { query: '', speciesFilter: 'all', periodFilter: 'all', deadlineFilter: 'all' });
      this.render(container);
    });
    container.querySelector('#imp-export')?.addEventListener('click', () => this.exportCsv(this._listed));

    if (window.adminApp) window.adminApp.updateFacilityChip();
    container.querySelector('#imp-facility-select')?.addEventListener('change', (e) => {
      this.setFacility(e.target.value);
      this.render(container);
    });

    container.querySelectorAll('.btn-confirm-arrival').forEach(btn => btn.addEventListener('click', () => {
      const imp = store.getImpoundmentById(btn.getAttribute('data-impound-id'));
      if (imp) this.openArrivalModal(imp);
    }));
    container.querySelectorAll('.btn-ticket-pay').forEach(btn => btn.addEventListener('click', () => {
      const t = store.getTickets().find(x => x.id === btn.getAttribute('data-ticket-id'));
      if (t) this.openTicketModal(t, 'pay');
    }));
    container.querySelectorAll('.btn-ticket-waive').forEach(btn => btn.addEventListener('click', () => {
      const t = store.getTickets().find(x => x.id === btn.getAttribute('data-ticket-id'));
      if (t) this.openTicketModal(t, 'waive');
    }));

    // Extend 24h button
    container.querySelectorAll('.btn-extend-deadline').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-impound-id');
        store.extendImpoundDeadline(id, 24);
        window.adminApp.showToast('The owner has 24 more hours to claim.', 'success');
        this.render(container);
      });
    });

    // Edit button
    container.querySelectorAll('.btn-edit-impound').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-impound-id');
        const imp = store.getImpoundmentById(id);
        if (imp) this.openEditModal(imp);
      });
    });

    // Tapping a pet's row opens its edit page (the buttons inside a row keep doing their own thing)
    container.querySelectorAll('tr[data-impound-id]').forEach(tr => {
      tr.classList.add('is-clickable');
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button, a, input, select, textarea, label')) return;
        const imp = store.getImpoundmentById(tr.getAttribute('data-impound-id'));
        if (imp) this.openEditModal(imp);
      });
    });
  },

  exportCsv(list) {
    const cell = (v) => { const t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const rows = [['Pet', 'Species', 'Breed', 'Tag', 'Facility', 'Cage', 'Intake', 'Claim deadline', 'Status', 'Closed']];
    list.forEach(i => rows.push([i.petName, i.species, i.breed, i.rfidTag, i.shelterName, i.cageNumber, i.intakeDate, i.claimDeadline, (window.IMPOUND_OUTCOMES[i.status] || {}).label || 'In holding', i.closedAt || '']));
    const blob = new Blob([rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `impoundments-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    window.adminApp.showToast(`Exported ${list.length} ${list.length === 1 ? 'pet' : 'pets'}.`, 'success');
  },

  // The Scan & intake dialog: tap an NFC tag and the form fills itself in (see intake-modal.js)
  openIntakeModal(opts) {
    if (window.IntakeModal) window.IntakeModal.open(opts || {});
  },

  openEditModal(imp) {
    const modalHtml = `
      <div class="modal-header">
        <div class="nock-card-title">Edit case: ${this.esc(imp.petName)}</div>
        <button class="icon-btn-subtle" id="edit-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="edit-impound-form" class="form-grid">
          <div class="form-group">
            <label class="form-label">Pet Name</label>
            <input type="text" class="form-control" name="petName" value="${this.esc(imp.petName)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">RFID Tag</label>
            <input type="text" class="form-control" name="rfidTag" value="${this.esc(imp.rfidTag)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Cage number</label>
            <input type="text" class="form-control" name="cageNumber" value="${this.esc(imp.cageNumber)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Case status</label>
            <select class="form-control" name="status">
              <option value="active_impounded" ${imp.status === 'active_impounded' ? 'selected' : ''}>In holding</option>
              ${Object.entries(window.IMPOUND_OUTCOMES).map(([value, o]) => `
                <option value="${value}" ${imp.status === value ? 'selected' : ''}>${o.label}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group form-full">
            <label class="form-label">Health Status Notes</label>
            <textarea class="form-control" name="healthCondition">${this.esc(imp.healthCondition)}</textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="edit-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="edit-save-btn">Save Changes</button>
      </div>
    `;

    const modal = window.adminApp.openModalContent(modalHtml);

    modal.querySelector('#edit-close-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#edit-cancel-btn')?.addEventListener('click', () => window.adminApp.closeModal());

    modal.querySelector('#edit-save-btn')?.addEventListener('click', () => {
      const form = modal.querySelector('#edit-impound-form');
      const formData = new FormData(form);

      const chosen = formData.get('status');
      // Build on the case as it is NOW: someone else may have released or moved it while this dialog was open
      const latest = (window.adminStore.getImpoundments ? window.adminStore.getImpoundments() : []).find((i) => i.id === imp.id) || imp;
      const status = chosen === imp.status ? latest.status : chosen; // untouched status field keeps whatever it is now
      const updated = {
        ...latest,
        petName: formData.get('petName'),
        rfidTag: formData.get('rfidTag'),
        cageNumber: formData.get('cageNumber'),
        status,
        closedAt: status === latest.status ? latest.closedAt : (window.IMPOUND_OUTCOMES[status] ? new Date().toISOString() : null),
        healthCondition: formData.get('healthCondition')
      };

      window.adminStore.saveImpoundment(updated);
      window.adminApp.closeModal();
      window.adminApp.showToast(`Updated impound case ${imp.id}`, 'success');
      window.adminApp.renderView('impoundments');
    });
  }
};
