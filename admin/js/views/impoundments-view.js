/**
 * PawTrack Admin — Municipal Impoundment & Shelter Holding Operations
 * Active 72h countdown clocks, cage assignments, extensions, fee clearing, and release processing
 */

// Final outcomes for a closed impound case (status 'active_impounded' means still in holding)
window.IMPOUND_OUTCOMES = {
  claimed: { label: 'Reunited with owner', pill: 'status-safe', color: 'var(--color-green)' },
  forfeited: { label: 'Unclaimed / forfeited', pill: 'status-impounded', color: 'var(--color-amber)' },
  transferred: { label: 'Transferred', pill: 'status-reunited', color: 'var(--color-blue)' },
  deceased: { label: 'Deceased in holding', pill: 'status-lost', color: 'var(--color-red)' },
  euthanized: { label: 'Euthanized', pill: 'status-euthanized', color: '#57534e' }
};

window.ImpoundmentsView = {
  currentTab: 'active',
  // The facility being viewed is the console-wide active facility (remembered across refreshes, shared by every page)
  get facilityFilter() { return (window.adminStore && window.adminStore.getActiveFacilityId()) || 'all'; },
  set facilityFilter(id) { if (window.adminStore) window.adminStore.setActiveFacility(id); },
  setFacility(id) { this.facilityFilter = id; },
  pendingIntake: false,    // open the Scan & intake dialog as soon as the page has drawn
  query: '',               // the search that is applied (set by the Search button or Enter)
  speciesFilter: 'all',    // 'all' or a species key from js/species.js
  periodFilter: 'all',     // when the animal was taken in: 'all' | 'today' | '7d' | '30d'
  deadlineFilter: 'all',   // claim window: 'all' | 'overdue' | 'soon' (due within 24 hours)
  _listed: [],             // the rows currently shown (what Export CSV saves)
  filtersOpen: false,      // the filter panel on a phone

  // Why an animal nobody claimed may be euthanized. Also the options of the dialog.
  EUTH_REASONS: [
    { key: 'untreatable', label: 'Severe illness or injury that cannot be treated', hint: 'On a veterinarian\'s advice.' },
    { key: 'dangerous', label: 'Dangerous behavior that cannot be managed safely', hint: 'It is a risk to people or to other animals.' },
    { key: 'contagious', label: 'Contagious disease that puts other animals at risk', hint: 'It cannot be isolated or treated here.' },
    { key: 'other', label: 'Another reason', hint: 'Explain it below.' }
  ],

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
    // Same fallback as the Claims, Dashboard and Heatmap pages
    window.AdminNoFacility.render(container, 'Impoundments', 'This page lists the animals in the 72-hour holding window at your facility.');
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
      filtered = filtered.filter(i => window.PawSpecies.normalize(i.species) === this.speciesFilter);
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

    // ---- numbers for the summary tiles (the whole facility, whatever tab or filter is on) ----
    const holding = impoundments.filter(i => i.status === 'active_impounded');
    const overdueN = holding.filter(i => { const d = asTime(i.claimDeadline); return d != null && d < now; }).length;
    const soonN = holding.filter(i => { const d = asTime(i.claimDeadline); return d != null && d >= now && d - now < 86400000; }).length;
    const closedN = impoundments.length - holding.length;
    const filterCount = [this.speciesFilter, this.periodFilter, this.deadlineFilter].filter(v => v !== 'all').length;

    const fmtDate = (v) => { const t = asTime(v); return t == null ? '' : new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); };
    const fmtDateTime = (v) => { const t = asTime(v); return t == null ? '' : new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
    // "5h" up to two days, then "3 days"
    const span = (hours) => { const h = Math.abs(hours); return h >= 48 ? `${Math.floor(h / 24)} days` : `${h}h`; };
    const icon = (path) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    const ICONS = {
      release: icon('<path d="M20 6 9 17l-5-5"/>'),
      cage: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>'),
      clock: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
      heart: icon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
      edit: icon('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
      euth: icon('<path d="M12 3v18"/><path d="M5 8h14"/><path d="M5 8l-2 6a3 3 0 0 0 4 0L5 8z"/><path d="M19 8l-2 6a3 3 0 0 0 4 0l-2-6z"/>'),
      more: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
      file: icon('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>')
    };

    // Plain information, not controls: the tabs below are the filters
    const tile = (label, n, tone) => `<div class="ic-stat ${tone}"><b>${n}</b><span>${label}</span></div>`;

    // ---- one animal ----
    const card = (imp) => {
      const deadlineMs = asTime(imp.claimDeadline);
      const intakeMs = asTime(imp.intakeDate);
      const open = imp.status === 'active_impounded';
      const diffHours = deadlineMs == null ? null : Math.round((deadlineMs - now) / 3600000);
      const expired = open && diffHours != null && diffHours <= 0;
      const windowMs = deadlineMs != null && intakeMs != null ? deadlineMs - intakeMs : 0;
      const pct = windowMs > 0 ? Math.max(0, Math.min(100, Math.round(((deadlineMs - now) / windowMs) * 100))) : 0;
      const tone = pct <= 25 ? 'is-low' : pct <= 50 ? 'is-mid' : '';
      const outcome = window.IMPOUND_OUTCOMES[imp.status];
      const name = imp.petName || 'Unidentified Pet';
      const tstat = imp.transferStatus;
      const transferNote = tstat === 'pending' ? `<span class="status-pill status-impounded" title="Not collected in time: being moved to the main facility">Moving to ${this.esc(shelterName(imp.transferToId))}</span>`
        : tstat === 'not_arrived' ? '<span class="status-pill status-lost" title="The main facility reported that this pet did not arrive">Did not arrive</span>'
        : tstat === 'received' ? `<span class="status-pill status-reunited">Moved from ${this.esc(shelterName(imp.originShelterId))}</span>` : '';
      const ticket = store.getTicketForImpound ? store.getTicketForImpound(imp.id) : null;
      const unpaid = !!ticket && ticket.status === 'unpaid';
      const mineToCollect = !!ticket && ticket.payeeShelterId === myId;
      const penalty = !ticket ? ''
        : ticket.status === 'unpaid' ? `<span class="status-pill status-lost">PHP ${this.esc(ticket.amount)} unpaid</span><span class="ic-tk">${this.esc(ticket.ticketNo)}</span>${mineToCollect ? `<button class="btn btn-sm btn-secondary btn-ticket-pay" data-ticket-id="${this.esc(ticket.id)}">Record payment</button>${isManager ? `<button class="btn btn-sm btn-secondary btn-ticket-waive" data-ticket-id="${this.esc(ticket.id)}">Waive</button>` : ''}` : `<span class="ic-tk">Pay to ${this.esc(shelterName(ticket.payeeShelterId))}</span>`}`
        : ticket.status === 'paid' ? `<span class="status-pill status-safe">Penalty paid</span><span class="ic-tk">${this.esc(ticket.ticketNo)}${ticket.reference ? ' · ' + this.esc(ticket.reference) : ''}</span>`
        : `<span class="status-pill status-reunited" title="${this.esc(ticket.waivedReason)}">Penalty waived</span><span class="ic-tk">${this.esc(ticket.ticketNo)}</span>`;

      // Rehabilitation and euthanasia: only for animals nobody claimed
      const rehabCase = store.getRehabForImpound ? store.getRehabForImpound(imp.id) : null;
      const canRehab = !rehabCase && window.RehabView && window.RehabView.isCandidate(imp) && store.rehabReady !== false;
      const euthBlock = store.euthanasiaBlock ? store.euthanasiaBlock(imp) : 'Not available.';
      const euthShown = open || imp.status === 'forfeited';

      const statusPill = outcome ? `<span class="status-pill ${outcome.pill}">${outcome.label}</span>`
        : expired ? '<span class="status-pill status-lost">Unclaimed</span>'
        : diffHours == null ? '' : `<span class="status-pill status-impounded">${span(diffHours)} left</span>`;

      let windowHtml;
      if (imp.status === 'euthanized') {
        const e = imp.euthanasia || {};
        windowHtml = `<div class="ic-window is-euth"><span class="ic-wl">Euthanized</span><b>${this.esc(fmtDateTime(e.at || imp.closedAt) || 'Date not recorded')}</b><small>${this.esc((this.EUTH_REASONS.find(r => r.key === e.reason) || {}).label || '')}</small></div>`;
      } else if (outcome) {
        windowHtml = `<div class="ic-window"><span class="ic-wl">Case closed</span><b>${this.esc(outcome.label)}</b><small>${this.esc(fmtDate(imp.closedAt || imp.claimedAt) || '')}</small></div>`;
      } else if (expired) {
        windowHtml = `<div class="ic-window is-late"><span class="ic-wl">Claim period over</span><b>Overdue by ${span(diffHours)}</b><i class="imp-bar is-low" aria-hidden="true"><u style="width:100%"></u></i><small>Was due ${this.esc(fmtDateTime(imp.claimDeadline))}</small></div>`;
      } else {
        windowHtml = `<div class="ic-window"><span class="ic-wl">Claim period</span><b>${deadlineMs == null ? 'No deadline' : 'Claim by ' + this.esc(fmtDateTime(imp.claimDeadline))}</b>${deadlineMs == null ? '' : `<i class="imp-bar ${tone}" aria-hidden="true"><u style="width:${pct}%"></u></i>`}</div>`;
      }

      const releaseAttrs = unpaid ? `disabled title="Penalty ticket ${this.esc(ticket.ticketNo)} is unpaid. Record the payment (or waive it) first."` : 'title="Hand the pet back to its owner and close the case"';
      let primary = '';
      let releaseInMenu = open;
      if (imp.status === 'euthanized') {
        primary = `<button type="button" class="btn btn-sm btn-secondary btn-euth-record" data-impound-id="${imp.id}" title="Who, why and when">${ICONS.file}Euthanasia record</button>`;
      } else if (rehabCase) {
        primary = `<button class="btn btn-sm btn-secondary btn-open-rehab" data-rehab-case="${rehabCase.id}" title="Open its rehabilitation">${rehabCase.stage === 'ready' ? 'Rehabilitated' : rehabCase.stage === 'withdrawn' ? 'Rehab withdrawn' : 'In rehabilitation'}</button>`;
      } else if (canRehab) {
        primary = `<button class="btn btn-sm chip-green btn-start-rehab" data-impound-id="${imp.id}" title="Prepare this animal for adoption">Rehabilitate</button>`;
      } else if (open) {
        primary = `<button class="btn btn-sm chip-green btn-claim-impound" data-impound-id="${imp.id}" ${releaseAttrs}>${ICONS.release}Release to owner</button>`;
        releaseInMenu = false;
      }

      const item = (cls, ico, label, attrs = '', sub = '') => `<button type="button" role="menuitem" class="ic-mi ${cls}" data-impound-id="${imp.id}" ${attrs}>${ico}<span><b>${label}</b>${sub ? `<small>${this.esc(sub)}</small>` : ''}</span></button>`;
      const menu = [
        releaseInMenu ? item('btn-claim-impound', ICONS.release, 'Release to owner', releaseAttrs) : '',
        open ? item('btn-extend-deadline', ICONS.clock, '+24h to claim', 'title="Give the owner 24 more hours to claim"') : '',
        item('btn-care-guide', ICONS.heart, 'Care guide', 'title="Care guide for this animal"'),
        item('btn-edit-impound', ICONS.edit, imp.status === 'euthanized' ? 'View case' : 'Edit case', 'title="Edit this case"'),
        euthShown ? `<div class="ic-sep" role="separator"></div>${item('btn-euthanize is-danger', ICONS.euth, 'Euthanize', euthBlock ? `aria-disabled="true" data-reason="${this.esc(euthBlock)}"` : 'title="Record the euthanasia of an animal nobody claimed"', euthBlock)}` : ''
      ].join('');

      const hasExtra = !!transferNote || !!penalty;
      return `
        <li class="ic-card ${imp.status === 'euthanized' ? 'is-euth' : outcome ? 'is-closed' : expired ? 'is-late' : (diffHours != null && diffHours < 24 ? 'is-soon' : '')}" data-impound-id="${imp.id}">
          <div class="ic-main" role="button" tabindex="0" aria-label="Open the case of ${this.esc(name)}" data-impound-id="${imp.id}">
            <img src="${this.esc(/^https:\/\//.test(imp.photoUrl || '') ? imp.photoUrl : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=150&q=80')}" class="ic-thumb" alt="" loading="lazy" />
            <div class="ic-id">
              <div class="ic-title"><b class="ic-name" title="${this.esc(name)}">${hl(name)}</b>${statusPill}</div>
              <div class="ic-sub">${this.esc(window.PawSpecies.icon(imp.species))} ${this.esc([imp.species, imp.breed].filter(Boolean).join(' · '))}</div>
              <div class="ic-meta">
                <span class="mono-tag imp-tag">${hl(imp.rfidTag || 'NO TAG')}</span>
                <span class="ic-chip">${ICONS.cage}${hl(imp.cageNumber || 'No cage yet')}</span>
                <span class="ic-chip">${this.esc(imp.shelterName || 'Municipal Shelter')}</span>
                <span class="ic-chip">In since ${this.esc(fmtDate(imp.intakeDate))}</span>
              </div>
            </div>
          </div>
          ${windowHtml}
          <div class="ic-actions">
            ${primary}
            <div class="ic-more">
              <button type="button" class="btn btn-sm btn-secondary ic-more-btn" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${this.esc(name)}">${ICONS.more}</button>
              <div class="ic-menu" role="menu" aria-label="Actions for ${this.esc(name)}" hidden>${menu}</div>
            </div>
          </div>
          ${hasExtra ? `<div class="ic-extra">${transferNote}${penalty}</div>` : ''}
          <p class="ic-note" title="${this.esc(imp.healthCondition || '')}">${this.esc(imp.healthCondition || 'No condition issues noted upon intake.')} <span class="imp-officer">· ${this.esc(imp.intakeOfficer || 'ACO Officer')}</span></p>
        </li>`;
    };

    const emptyTitle = filtersOn ? 'No animals match' : this.currentTab === 'closed' ? 'No closed cases yet' : this.currentTab === 'all' ? 'No animals yet' : 'No animals in holding';
    const emptyText = filtersOn ? 'Try a different search, or clear the filters.' : this.currentTab === 'closed' ? 'Animals leave holding when they are released, transferred, rehabilitated or euthanized.' : 'Tap “Scan & intake” when an animal arrives at the facility.';

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

      <div class="ic-stats" role="group" aria-label="Summary">
        ${tile('In holding', holding.length, '')}
        ${tile('Claim period over', overdueN, overdueN ? 'is-danger' : '')}
        ${tile('Due in 24 hours', soonN, soonN ? 'is-warn' : '')}
        ${tile('Closed cases', closedN, '')}
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

      <div class="ic-toolbar">
        <div class="ic-seg" role="tablist" aria-label="Show">
          ${[['active', 'In holding', holding.length], ['closed', 'Closed', closedN], ['all', 'All', impoundments.length]].map(([v, l, n]) => `<button type="button" role="tab" class="ic-seg-btn" data-imp-tab="${v}" aria-selected="${this.currentTab === v}"><span>${l}</span><em>${n}</em></button>`).join('')}
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
        <button type="button" class="btn btn-secondary ic-filter-toggle" id="imp-filters-toggle" aria-expanded="${this.filtersOpen}" aria-controls="imp-filter-panel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4"/></svg>
          Filters${filterCount ? ` <em>${filterCount}</em>` : ''}
        </button>
      </div>

      <div class="ic-filter-panel${this.filtersOpen ? ' is-open' : ''}" id="imp-filter-panel">
        ${facilityIds.length > 1 ? `<label class="imp-facility-filter"><span class="hm-label">Facility</span>
          <select id="imp-facility-select" class="hm-select">
            ${facilityIds.map(id => `<option value="${this.esc(id)}" ${this.facilityFilter === id ? 'selected' : ''}>${this.esc(shelterName(id))}</option>`).join('')}
          </select></label>` : ''}
        ${[
          ['imp-species', 'Animal', this.speciesFilter, window.PawSpecies.filterOptions('all')],
          ['imp-period', 'Taken in', this.periodFilter, [['all', 'Any time'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days']]],
          ['imp-deadline', 'Claim window', this.deadlineFilter, [['all', 'Any'], ['overdue', 'Past deadline'], ['soon', 'Due within 24h']]]
        ].map(([id, label, cur, opts]) => `
          <div class="hm-field"><label class="hm-label" for="${id}">${label}</label>
            <select id="${id}" class="hm-select">${opts.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}
        ${filtersOn ? '<button type="button" class="btn btn-secondary btn-sm" id="imp-clear-filters">Clear filters</button>' : ''}
      </div>

      <div class="ic-resultbar">
        <span class="imp-count" aria-live="polite">${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}</span>
        <button type="button" class="btn btn-secondary btn-sm imp-export-btn" id="imp-export" ${filtered.length ? '' : 'disabled'}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>Export CSV
        </button>
      </div>

      ${filtered.length === 0 ? `
        <div class="ic-empty imp-empty"><b>${emptyTitle}</b><span>${emptyText}</span></div>
      ` : `<ul class="ic-list">${filtered.map(card).join('')}</ul>`}
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

    // Tabs and the filter panel on a phone
    container.querySelectorAll('[data-imp-tab]').forEach(btn => btn.addEventListener('click', () => {
      this.currentTab = btn.getAttribute('data-imp-tab');
      this.render(container);
    }));
    container.querySelector('#imp-filters-toggle')?.addEventListener('click', (e) => {
      this.filtersOpen = !this.filtersOpen;
      e.currentTarget.setAttribute('aria-expanded', String(this.filtersOpen));
      container.querySelector('#imp-filter-panel')?.classList.toggle('is-open', this.filtersOpen);
    });
    this.bindMenus(container);

    // Euthanasia: the dialog for an animal nobody claimed, and the record of one that was
    container.querySelectorAll('.btn-euthanize').forEach(btn => btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-disabled') === 'true') { window.adminApp.showToast(btn.getAttribute('data-reason') || 'This animal cannot be euthanized right now.', 'info', 4200); return; }
      const imp = store.getImpoundmentById(btn.getAttribute('data-impound-id'));
      if (imp) this.openEuthanizeModal(imp);
    }));
    container.querySelectorAll('.btn-euth-record').forEach(btn => btn.addEventListener('click', () => {
      const imp = store.getImpoundmentById(btn.getAttribute('data-impound-id'));
      if (imp) this.openEuthanasiaRecord(imp);
    }));

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

    // Rehabilitate: the prompt says what will happen, then the animal moves to the Rehabilitation page
    container.querySelectorAll('.btn-start-rehab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.RehabView) window.RehabView.askStart(e.currentTarget.getAttribute('data-impound-id'));
      });
    });
    container.querySelectorAll('.btn-open-rehab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.RehabView) window.RehabView.goTo(e.currentTarget.getAttribute('data-rehab-case'));
      });
    });

    // Care guide: the standard care protocol for this animal's species and condition
    container.querySelectorAll('.btn-care-guide').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (window.RehabView) window.RehabView.openCareGuide(e.currentTarget.getAttribute('data-impound-id'));
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

    // Tapping the animal's photo or name opens its case
    container.querySelectorAll('.ic-main').forEach(el => {
      const open = () => { const imp = store.getImpoundmentById(el.getAttribute('data-impound-id')); if (imp) this.openEditModal(imp); };
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  },

  // The "More" menu of each card: a popover on a computer, a bottom sheet on a phone
  bindMenus(container) {
    const close = () => container.querySelectorAll('.ic-more.is-open').forEach(m => {
      m.classList.remove('is-open');
      const menu = m.querySelector('.ic-menu'); if (menu) menu.hidden = true;
      m.querySelector('.ic-more-btn')?.setAttribute('aria-expanded', 'false');
    });
    container.querySelectorAll('.ic-more-btn').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrap = btn.closest('.ic-more');
      const wasOpen = wrap.classList.contains('is-open');
      close();
      if (wasOpen) return;
      const menu = wrap.querySelector('.ic-menu');
      wrap.classList.add('is-open');
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      const r = btn.getBoundingClientRect();
      menu.classList.toggle('is-up', window.innerHeight - r.bottom < menu.offsetHeight + 16 && r.top > menu.offsetHeight + 16);
      menu.querySelector('.ic-mi:not([disabled])')?.focus({ preventScroll: true });
    }));
    container.querySelectorAll('.ic-menu').forEach(menu => {
      menu.addEventListener('click', () => close());
      menu.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const items = [...menu.querySelectorAll('.ic-mi:not([disabled])')];
        const at = items.indexOf(document.activeElement);
        items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
      });
    });
    if (this._menuOff) { this._menuOff(); this._menuOff = null; }
    if (typeof document === 'undefined' || !document.addEventListener) return;
    const onDoc = (e) => { if (!e.target.closest || !e.target.closest('.ic-more')) close(); };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const open = container.querySelector('.ic-more.is-open');
      if (open) { open.querySelector('.ic-more-btn')?.focus(); close(); }
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    this._menuOff = () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  },

  // ----- Euthanasia of an animal nobody claimed during its claim period -----
  openEuthanizeModal(imp) {
    const store = window.adminStore;
    const blocked = store.euthanasiaBlock(imp);
    if (blocked) { window.adminApp.showToast(blocked, 'info', 4200); return; }
    const name = (imp.petName || '').trim();
    const word = name || 'EUTHANIZE';
    const deadline = new Date(imp.claimDeadline).getTime();
    const over = Number.isFinite(deadline) ? Math.max(0, Math.floor((Date.now() - deadline) / 86400000)) : null;
    const nowLocal = (() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); })();
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Euthanize ${this.esc(name || 'this animal')}?</div>
        <button class="icon-btn-subtle" id="eu-x" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body eu-body">
        <div class="eu-warn" role="alert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4M12 17h.01"/></svg>
          <div><b>This is permanent.</b><span>It cannot be undone, and the record cannot be changed afterwards.</span></div>
        </div>
        <dl class="eu-facts">
          <div><dt>Animal</dt><dd>${this.esc([imp.petName || 'Unidentified', imp.species, imp.breed].filter(Boolean).join(' · '))}</dd></div>
          <div><dt>Claim period</dt><dd>Ended ${this.esc(new Date(imp.claimDeadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))}${over != null ? ` (${over === 0 ? 'today' : over + (over === 1 ? ' day ago' : ' days ago')})` : ''}</dd></div>
          <div><dt>Owner claims</dt><dd>None waiting</dd></div>
        </dl>
        <form id="eu-form" class="eu-form" novalidate>
          <fieldset class="eu-fs">
            <legend>Why? <em>choose one</em></legend>
            <div class="eu-reasons" role="radiogroup" aria-label="Reason">
              ${this.EUTH_REASONS.map(r => `<label class="eu-reason"><input type="radio" name="reason" value="${r.key}" /><span><b>${this.esc(r.label)}</b><small>${this.esc(r.hint)}</small></span></label>`).join('')}
            </div>
          </fieldset>
          <div class="form-group form-full">
            <label class="form-label" for="eu-notes" id="eu-notes-label">Notes <span class="eu-opt">(optional)</span></label>
            <textarea class="form-control" id="eu-notes" name="notes" rows="2" maxlength="1000" placeholder="What the veterinarian found, or what happened."></textarea>
          </div>
          <div class="eu-grid">
            <div class="form-group">
              <label class="form-label" for="eu-vet">Veterinarian *</label>
              <input type="text" class="form-control" id="eu-vet" name="vet" maxlength="120" autocomplete="off" placeholder="Full name" />
            </div>
            <div class="form-group">
              <label class="form-label" for="eu-license">License no. <span class="eu-opt">(optional)</span></label>
              <input type="text" class="form-control" id="eu-license" name="license" maxlength="60" autocomplete="off" />
            </div>
            <div class="form-group form-full">
              <label class="form-label" for="eu-at">Performed on *</label>
              <input type="datetime-local" class="form-control" id="eu-at" name="at" value="${nowLocal}" max="${nowLocal}" />
            </div>
          </div>
          <label class="eu-check"><input type="checkbox" name="humane" /><span>A licensed veterinarian performs, or has performed, this euthanasia humanely.</span></label>
          <div class="form-group form-full">
            <label class="form-label" for="eu-confirm">Type <b class="eu-word">${this.esc(word)}</b> to confirm *</label>
            <input type="text" class="form-control" id="eu-confirm" name="confirm" autocomplete="off" autocapitalize="off" spellcheck="false" />
          </div>
        </form>
        <div class="fm-error" id="eu-error" role="alert" hidden></div>
      </div>
      <div class="modal-footer">
        <span class="eu-hint" id="eu-hint" role="status"></span>
        <button class="btn btn-secondary" id="eu-cancel">Cancel</button>
        <button class="btn btn-danger" id="eu-save" disabled>Euthanize</button>
      </div>`);
    const form = modal.querySelector('#eu-form');
    const save = modal.querySelector('#eu-save');
    const hint = modal.querySelector('#eu-hint');
    const val = () => ({
      reason: (form.querySelector('input[name="reason"]:checked') || {}).value || '',
      notes: form.elements.notes.value.trim(), vet: form.elements.vet.value.trim(), license: form.elements.license.value.trim(),
      at: form.elements.at.value, humane: form.elements.humane.checked, confirm: form.elements.confirm.value.trim()
    });
    // Says what is still missing, in the order a person fills it in
    const missing = (d) => !d.reason ? 'Choose a reason'
      : (d.reason === 'other' && d.notes.length < 5) ? 'Explain the reason'
      : d.vet.length < 2 ? 'Enter the veterinarian'
      : !d.at ? 'Enter when it was done'
      : !d.humane ? 'Confirm it is done humanely'
      : d.confirm.toLowerCase() !== word.toLowerCase() ? `Type ${word} to confirm` : '';
    const sync = () => {
      const d = val();
      const lab = modal.querySelector('#eu-notes-label');
      if (lab) lab.innerHTML = d.reason === 'other' ? 'Explain the reason *' : 'Notes <span class="eu-opt">(optional)</span>';
      const m = missing(d);
      save.disabled = !!m;
      if (hint) hint.textContent = m;
    };
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);
    sync();
    modal.querySelector('#eu-x')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#eu-cancel')?.addEventListener('click', () => window.adminApp.closeModal());
    save.addEventListener('click', async () => {
      const d = val();
      if (missing(d)) return;
      const when = new Date(d.at);
      if (Number.isNaN(when.getTime()) || when.getTime() > Date.now() + 5 * 60000) {
        const err = modal.querySelector('#eu-error'); err.textContent = 'The time cannot be in the future.'; err.hidden = false; return;
      }
      save.disabled = true; save.textContent = 'Saving…';
      const ok = await store.euthanizeImpoundment(imp.id, { reason: d.reason, notes: d.notes, vet: d.vet, license: d.license, at: when.toISOString() });
      if (!ok) { save.textContent = 'Euthanize'; sync(); return; }
      window.adminApp.closeModal();
      window.adminApp.showToast(`Euthanasia recorded for ${name || 'the animal'}.`, 'success');
      window.adminApp.renderView('impoundments');
    });
  },

  // What was recorded: read only, with a PDF to keep
  openEuthanasiaRecord(imp) {
    const e = imp.euthanasia || {};
    const reason = (this.EUTH_REASONS.find(r => r.key === e.reason) || {}).label || 'Not recorded';
    const when = (v) => { const t = v ? new Date(v) : null; return t && !Number.isNaN(t.getTime()) ? t.toLocaleString([], { dateStyle: 'long', timeStyle: 'short' }) : 'Not recorded'; };
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Euthanasia record: ${this.esc(imp.petName || 'Unidentified animal')}</div>
        <button class="icon-btn-subtle" id="er-x" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body eu-body">
        <div class="eu-seal"><b>Euthanized</b><span>${this.esc(when(e.at || imp.closedAt))}</span></div>
        <dl class="eu-facts">
          <div><dt>Animal</dt><dd>${this.esc([imp.petName || 'Unidentified', imp.species, imp.breed].filter(Boolean).join(' · '))}</dd></div>
          <div><dt>Tag</dt><dd>${this.esc(imp.rfidTag || 'No tag')}</dd></div>
          <div><dt>Facility</dt><dd>${this.esc(imp.shelterName || '')}${imp.cageNumber ? ' · ' + this.esc(imp.cageNumber) : ''}</dd></div>
          <div><dt>Taken in</dt><dd>${this.esc(when(imp.intakeDate))}</dd></div>
          <div><dt>Claim period ended</dt><dd>${this.esc(when(imp.claimDeadline))}</dd></div>
          <div><dt>Reason</dt><dd>${this.esc(reason)}</dd></div>
          <div><dt>Veterinarian</dt><dd>${this.esc(e.vet || 'Not recorded')}${e.license ? ` <small>(License ${this.esc(e.license)})</small>` : ''}</dd></div>
          ${e.notes ? `<div><dt>Notes</dt><dd>${this.esc(e.notes)}</dd></div>` : ''}
        </dl>
        <p class="rh-help">A recorded euthanasia is final. It cannot be changed or undone.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="er-close">Close</button>
        <button class="btn btn-primary" id="er-pdf">Download PDF</button>
      </div>`);
    modal.querySelector('#er-x')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#er-close')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#er-pdf')?.addEventListener('click', () => this.downloadEuthanasiaPdf(imp));
  },

  downloadEuthanasiaPdf(imp) {
    const JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) { window.adminApp.showToast('The PDF tool could not load. Check your connection and try again.', 'error'); return; }
    const e = imp.euthanasia || {};
    const reason = (this.EUTH_REASONS.find(r => r.key === e.reason) || {}).label || 'Not recorded';
    const clean = (t) => String(t == null ? '' : t).replace(/[^\x20-\x7E]/g, '-');
    const when = (v) => { const t = v ? new Date(v) : null; return t && !Number.isNaN(t.getTime()) ? t.toLocaleString([], { dateStyle: 'long', timeStyle: 'short' }) : 'Not recorded'; };
    const doc = new JsPDF({ unit: 'pt', format: 'a4' });
    const M = 48; let y = 64;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(194, 65, 12); doc.text('PAWTRACK  |  IMPOUNDMENT', M, y); y += 26;
    doc.setFontSize(22); doc.setTextColor(28, 25, 23); doc.text('Euthanasia record', M, y); y += 14;
    doc.setDrawColor(226, 223, 220); doc.line(M, y, 595 - M, y); y += 26;
    const rows = [
      ['Animal', [imp.petName || 'Unidentified', imp.species, imp.breed].filter(Boolean).join(' / ')],
      ['Tag', imp.rfidTag || 'No tag'],
      ['Facility', [imp.shelterName, imp.cageNumber].filter(Boolean).join(' / ')],
      ['Taken in', when(imp.intakeDate)],
      ['Claim period ended', when(imp.claimDeadline)],
      ['Euthanized on', when(e.at || imp.closedAt)],
      ['Reason', reason],
      ['Veterinarian', [e.vet, e.license ? 'License ' + e.license : ''].filter(Boolean).join(', ') || 'Not recorded'],
      ['Notes', e.notes || '-']
    ];
    rows.forEach(([k, val]) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(110, 104, 99); doc.text(clean(k).toUpperCase(), M, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(28, 25, 23);
      const lines = doc.splitTextToSize(clean(val), 595 - M * 2 - 140);
      doc.text(lines, M + 140, y); y += Math.max(1, lines.length) * 15 + 8;
    });
    y += 40;
    doc.setDrawColor(120, 113, 108);
    doc.line(M, y, M + 200, y); doc.line(M + 260, y, M + 460, y); y += 14;
    doc.setFontSize(9); doc.setTextColor(110, 104, 99);
    doc.text('Veterinarian signature', M, y); doc.text('Facility officer signature', M + 260, y);
    doc.setFontSize(8); doc.text('Generated by PawTrack. A recorded euthanasia cannot be changed.', M, 800);
    doc.save(`euthanasia-record-${clean(imp.petName || 'animal').replace(/\s+/g, '-').toLowerCase()}.pdf`);
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
        ${/^https:\/\//.test(imp.photoUrl || '') ? `<div class="imp-edit-photo"><img src="${this.esc(imp.photoUrl)}" alt="Photo of ${this.esc(imp.petName)}" /></div>` : '<div class="imp-edit-photo is-empty">No photo was added for this animal</div>'}
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
            <select class="form-control" name="status" ${imp.status === 'euthanized' ? 'disabled title="A euthanasia record cannot be changed"' : ''}>
              <option value="active_impounded" ${imp.status === 'active_impounded' ? 'selected' : ''}>In holding</option>
              ${Object.entries(window.IMPOUND_OUTCOMES).filter(([value]) => value !== 'euthanized' || imp.status === 'euthanized').map(([value, o]) => `
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
        <button class="btn btn-danger" id="edit-delete-btn" style="margin-right:auto;">Delete</button>
        <button class="btn btn-secondary" id="edit-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="edit-save-btn">Save Changes</button>
      </div>
    `;

    const modal = window.adminApp.openModalContent(modalHtml);

    modal.querySelector('#edit-close-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#edit-cancel-btn')?.addEventListener('click', () => window.adminApp.closeModal());

    modal.querySelector('#edit-delete-btn')?.addEventListener('click', async () => {
      // Close this dialog first so the confirmation is not stacked on top of it
      window.adminApp.closeModal();
      const ok = await window.adminApp.confirmDialog({
        title: 'Delete this impound case?',
        message: `${imp.petName || 'This animal'} (case ${imp.id}) will be removed for good, together with its penalty tickets and any claims on it. This cannot be undone.`,
        confirmLabel: 'Delete case',
        danger: true
      });
      if (!ok) { this.openEditModal(imp); return; }
      if (window.adminStore.deleteImpoundment(imp.id)) {
        window.adminApp.showToast(`Deleted impound case ${imp.id}`, 'success');
        window.adminApp.renderView('impoundments');
      }
    });

    modal.querySelector('#edit-save-btn')?.addEventListener('click', () => {
      const form = modal.querySelector('#edit-impound-form');
      const formData = new FormData(form);

      const chosen = formData.get('status') || imp.status; // a disabled field sends nothing
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
