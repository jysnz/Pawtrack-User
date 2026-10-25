/**
 * PawTrack Community Pet Sightings Board
 * Dedicated view for browsing, filtering, archiving, retrieving, and deleting
 * community-reported pet sightings. Integrates with the store, notification system,
 * incident map, and owner verification modal.
 */

class SightingsView {
  constructor() {
    this.currentFilter = 'all';      // 'all' | 'possible' | 'confirmed' | 'archived'
    this.currentSort   = 'newest';   // 'newest' | 'oldest' | 'confirmed_first'
    this.searchQuery   = '';
    this.selectedCommunity = 'all';

    if (typeof window !== 'undefined' && window.pawStore) {
      window.pawStore.subscribe((event) => {
        if (window.location.hash === '#sightings') {
          this.refresh();
        }
      });
    }
  }

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────
  render(container) {
    this.container = container || document.getElementById('app-viewport');
    if (!this.container) return;

    const t = (k, d) => (window.pawI18n ? window.pawI18n.t(k, d) : d);
    const sightings = window.pawStore ? (window.pawStore.getSightings() || []) : [];
    const stats = this._buildStats(sightings);

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Community Sighting Reports</h1>
          <div class="view-subtitle">
            All community-reported pet sightings. Owners can verify matches, archive old reports, or retrieve and delete archived sightings.
          </div>
        </div>
        <div style="display:flex; gap:0.65rem; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-primary btn-sm" onclick="window.reportManager ? window.reportManager.openSightingModal() : null">
            <i data-lucide="eye"></i> Report Pet Sighting
          </button>
          <button class="btn ${this.currentFilter === 'archived' ? 'btn-primary' : 'btn-outline'} btn-sm" id="sightings-header-archived-btn" onclick="window.sightingsView.setFilter('${this.currentFilter === 'archived' ? 'all' : 'archived'}')" title="${this.currentFilter === 'archived' ? 'Active Sightings' : 'Archived Sightings'} (${stats.archived})" aria-label="${this.currentFilter === 'archived' ? 'Active Sightings' : 'Archived Sightings'}">
            <i data-lucide="archive"></i>
          </button>
          <button class="btn btn-outline btn-sm" onclick="window.location.hash='#owner'; setTimeout(() => document.getElementById('incident-map-section')?.scrollIntoView({behavior:'smooth'}), 150);" title="View on Map" aria-label="View on Map">
            <i data-lucide="map"></i>
          </button>
        </div>
      </div>

      <!-- Filters & Search (pill counts double as the status summary) -->
      <div class="glass-card sightings-filter-bar">
        <!-- Search -->
        <div style="flex:1; min-width:220px;">
          <input
            type="text"
            id="sightings-search-input"
            placeholder="Search by location, breed, reporter name…"
            value="${this._esc(this.searchQuery)}"
            oninput="window.sightingsView.handleSearch(this.value)"
            style="width:100%;"
          />
        </div>

        <!-- Status filter pills -->
        <div id="sightings-filter-pills" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          ${this._filterPill('all',       'All Active', stats.active,    this.currentFilter === 'all')}
          ${this._filterPill('possible',  'Possible',   stats.possible,  this.currentFilter === 'possible')}
          ${this._filterPill('confirmed', 'Confirmed',  stats.confirmed, this.currentFilter === 'confirmed')}
          ${this._filterPill('archived',  'Archived',   stats.archived,  this.currentFilter === 'archived')}
        </div>

        <!-- Sort -->
        <div style="display:flex; align-items:center; gap:0.5rem; min-width:160px;">
          <label for="sightings-sort-select" style="font-size:0.76rem; color:var(--text-muted); white-space:nowrap; flex-shrink:0;">Sort</label>
          <select id="sightings-sort-select" class="form-control" style="padding:7px 10px; font-size:0.8rem;" onchange="window.sightingsView.setSort(this.value)">
            <option value="newest"          ${this.currentSort === 'newest'          ? 'selected' : ''}>Newest First</option>
            <option value="oldest"          ${this.currentSort === 'oldest'          ? 'selected' : ''}>Oldest First</option>
            <option value="confirmed_first" ${this.currentSort === 'confirmed_first' ? 'selected' : ''}>Confirmed First</option>
          </select>
        </div>
      </div>

      <!-- Sighting Cards Grid -->
      <div id="sightings-grid" style="margin-bottom: 2.5rem;">
        ${this._renderGrid(sightings)}
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: this.container });
  }

  refresh() {
    const container = this.container || document.getElementById('app-viewport');
    if (container && window.location.hash === '#sightings') {
      this.render(container);
    }
  }

  // ─────────────────────────────────────────────────
  // FILTER / SEARCH / SORT HANDLERS
  // ─────────────────────────────────────────────────
  setFilter(f) {
    this.currentFilter = f;
    this.refresh();
  }

  handleSearch(val) {
    this.searchQuery = val;
    this._refreshGrid();
  }

  setCommunity(val) {
    this.selectedCommunity = val;
    this._refreshGrid();
  }

  setSort(val) {
    this.currentSort = val;
    this._refreshGrid();
  }

  _refreshGrid() {
    const grid = document.getElementById('sightings-grid');
    if (!grid) return;
    const sightings = window.pawStore.getSightings();
    grid.innerHTML = this._renderGrid(sightings);
    if (window.lucide) window.lucide.createIcons({ root: grid });
  }

  // ─────────────────────────────────────────────────
  // ARCHIVE, RETRIEVE & DELETE ACTIONS
  // ─────────────────────────────────────────────────
  archiveSighting(sightingId) {
    if (!sightingId || !window.pawStore) return;
    const updated = window.pawStore.archiveSighting(sightingId);
    if (updated) {
      if (window.notifManager) {
        window.notifManager.showToast('Sighting report moved to Archive.', 'info', 3500);
      }
      this.refresh();
    }
  }

  retrieveSighting(sightingId) {
    if (!sightingId || !window.pawStore) return;
    const restored = window.pawStore.retrieveSighting(sightingId);
    if (restored) {
      if (window.notifManager) {
        window.notifManager.showToast('Sighting report retrieved and restored to active board.', 'success', 3500);
      }
      this.refresh();
    }
  }

  deleteSighting(sightingId) {
    if (!sightingId || !window.pawStore) return;
    const confirmDelete = window.confirm('Are you sure you want to permanently delete this sighting report? This action cannot be undone.');
    if (!confirmDelete) return;

    const deleted = window.pawStore.deleteSighting(sightingId);
    if (deleted) {
      if (window.notifManager) {
        window.notifManager.showToast('Sighting report permanently deleted.', 'danger', 3500);
      }
      this.refresh();
    }
  }

  // ─────────────────────────────────────────────────
  // DATA HELPERS
  // ─────────────────────────────────────────────────
  _buildStats(sightings) {
    const active = sightings.filter(s => s.status !== 'dismissed' && s.status !== 'archived');
    return {
      total:     sightings.length,
      active:    active.length,
      possible:  active.filter(s => s.status === 'possible_sighting').length,
      confirmed: active.filter(s => s.status === 'confirmed_sighting').length,
      archived:  sightings.filter(s => s.status === 'dismissed' || s.status === 'archived').length,
      linked:    active.filter(s => !!s.missing_report_id).length,
    };
  }

  _filteredSorted(sightings) {
    let list = [...sightings];

    // Status filter
    if (this.currentFilter === 'all') {
      list = list.filter(s => s.status !== 'dismissed' && s.status !== 'archived');
    } else if (this.currentFilter === 'possible') {
      list = list.filter(s => s.status === 'possible_sighting');
    } else if (this.currentFilter === 'confirmed') {
      list = list.filter(s => s.status === 'confirmed_sighting');
    } else if (this.currentFilter === 'archived' || this.currentFilter === 'dismissed') {
      list = list.filter(s => s.status === 'dismissed' || s.status === 'archived');
    }

    // Community filter
    if (this.selectedCommunity !== 'all') {
      const sel = this.selectedCommunity.toLowerCase();
      const districtKeywords = {
        'district 1': ['district 1', 'd1', 'la loma', 'sfdm', 'san francisco del monte', 'project 6', 'banawe', 'sto. domingo', 'project 7', 'balingasa', 'veterans village', 'del monte', 'siena', 'calavite'],
        'district 2': ['district 2', 'd2', 'commonwealth', 'batasan', 'payatas', 'holy spirit', 'bagong silangan', 'litex', 'lupang pangako', 'bf homes qc'],
        'district 3': ['district 3', 'd3', 'cubao', 'katipunan', 'loyola', 'eastwood', 'anonas', 'kamias', 'project 2', 'project 3', 'project 4', 'matandang balara', 'old balara', 'blue ridge', 'socorro', 'quirino', 'libis'],
        'district 4': ['district 4', 'd4', 'diliman', 'tomas morato', 'timog', 'south triangle', 'new manila', 'kamuning', 'teachers village', 'maginhawa', 'sikatuna', 'phil-am', 'west avenue', 'central', 'krus na ligas', 'up campus', 'quezon memorial circle', 'city hall', 'scout'],
        'district 5': ['district 5', 'd5', 'novaliches', 'fairview', 'lagro', 'gulod', 'san bartolome', 'bagbag', 'sta. lucia', 'greater lagro', 'regalado'],
        'district 6': ['district 6', 'd6', 'tandang sora', 'balintawak', 'culiat', 'talipapa', 'sangandaan', 'pasong tamo', 'baesa', 'sauyo']
      };

      list = list.filter(s => {
        const itemCommunity = (s.community || '').toLowerCase();
        const itemLocation = (s.location || '').toLowerCase();
        const combined = `${itemCommunity} ${itemLocation}`;
        if (itemCommunity === sel || combined.includes(sel)) return true;

        for (const [dKey, keywords] of Object.entries(districtKeywords)) {
          if (sel.includes(dKey)) {
            return keywords.some(kw => combined.includes(kw));
          }
        }
        return combined.includes(sel);
      });
    }

    // Search
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s =>
        (s.location     || '').toLowerCase().includes(q) ||
        (s.breed        || '').toLowerCase().includes(q) ||
        (s.reporterName || '').toLowerCase().includes(q) ||
        (s.community    || '').toLowerCase().includes(q) ||
        (s.comments     || '').toLowerCase().includes(q)
      );
    }

    // Sort
    if (this.currentSort === 'newest') {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (this.currentSort === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else if (this.currentSort === 'confirmed_first') {
      const rank = s => s.status === 'confirmed_sighting' ? 0 : s.status === 'possible_sighting' ? 1 : 2;
      list.sort((a, b) => rank(a) - rank(b) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return list;
  }

  // ─────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────
  _filterPill(filter, label, count, active) {
    return `
      <button
        type="button"
        class="btn btn-sm sightings-filter-pill ${active ? 'btn-primary active' : 'btn-outline'}"
        data-filter="${filter}"
        onclick="window.sightingsView.setFilter('${filter}')"
      >${label} <span style="opacity:0.7;">(${count})</span></button>
    `;
  }

  _communityOptions(sightings) {
    const qcDistricts = [
      'District 1 (La Loma / SFDM / Project 6)',
      'District 2 (Commonwealth / Batasan / Payatas)',
      'District 3 (Cubao / Katipunan / Loyola / Eastwood)',
      'District 4 (Diliman / Tomas Morato / UP / New Manila)',
      'District 5 (Novaliches / Fairview / Lagro)',
      'District 6 (Tandang Sora / Balintawak / Culiat)'
    ];

    const set = new Set(qcDistricts);
    sightings.forEach(s => { 
      if (s.community && !s.community.includes('National Capital Region')) set.add(s.community); 
    });
    if (window.pawStore) {
      window.pawStore.getPets().forEach(p => { 
        if (p.community && !p.community.includes('National Capital Region')) set.add(p.community); 
      });
    }
    const opts = ['<option value="all">All QC Districts</option>'];
    Array.from(set).forEach(c => {
      opts.push(`<option value="${this._esc(c)}" ${this.selectedCommunity === c ? 'selected' : ''}>${c}</option>`);
    });
    return opts.join('');
  }

  _renderGrid(sightings) {
    const list = this._filteredSorted(sightings);

    if (list.length === 0) {
      const isArchivedView = this.currentFilter === 'archived' || this.currentFilter === 'dismissed';
      return `
        <div class="sightings-empty-state glass-card">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            ${isArchivedView 
              ? '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'
              : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="3" x2="21" y2="21"/>'
            }
          </svg>
          <h3>${isArchivedView ? 'No archived sightings' : 'No sightings found'}</h3>
          <p>${isArchivedView ? 'You have no archived sighting reports.' : 'No active sighting reports match the current filters. Try a different filter or report a sighting!'}</p>
          ${isArchivedView ? `
            <button class="btn btn-outline" onclick="window.sightingsView.setFilter('all')">
              <i data-lucide="arrow-left"></i> Back to Active Sightings
            </button>
          ` : ''}
        </div>
      `;
    }

    return `
      <div class="sightings-cards-grid">
        ${list.map(s => this._renderCard(s)).join('')}
      </div>
    `;
  }

  _renderCard(s) {
    const isConfirmed = s.status === 'confirmed_sighting';
    const isArchived  = s.status === 'dismissed' || s.status === 'archived';
    const isPossible  = s.status === 'possible_sighting';

    const statusColor  = isConfirmed ? '#16a34a' : isPossible ? '#ea9d1e' : '#b85410';
    const statusLabel  = isConfirmed ? 'Confirmed Sighting' : isPossible ? 'Possible Sighting' : 'Archived';
    const statusBg     = isConfirmed ? 'rgba(22,163,74,0.12)' : isPossible ? 'rgba(234,157,30,0.12)' : 'rgba(184,84,16,0.12)';
    const statusBorder = isConfirmed ? 'rgba(22,163,74,0.3)'  : isPossible ? 'rgba(234,157,30,0.3)'  : 'rgba(184,84,16,0.3)';

    const timeAgo = this._timeAgo(s.dateTimeSeen || s.createdAt);
    const photo   = s.photoUrl || s.photo || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=400&q=80';

    // Look up linked pet
    let linkedPetHtml = '';
    if (s.petId || s.missing_report_id) {
      let pet = s.petId ? window.pawStore.getPetById(s.petId) : null;
      if (!pet && s.missing_report_id) {
        const rep = window.pawStore.getMissingReportById(s.missing_report_id);
        if (rep) pet = window.pawStore.getPetById(rep.petId);
      }
      if (pet) {
        linkedPetHtml = `
          <div class="sighting-card-linked-pet">
            <img src="${this._esc(pet.photoUrl)}" alt="${this._esc(pet.name)}" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=80&q=80'" />
            <div>
              <div style="font-size:0.7rem; color:var(--primary); font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Linked Missing Pet</div>
              <div style="font-size:0.85rem; font-weight:700; color:var(--text-main);">${this._esc(pet.name)}</div>
              <div style="font-size:0.72rem; color:var(--text-muted);">${this._esc(pet.breed || '')} · NFC: ${this._esc(pet.nfcTag || 'N/A')}</div>
            </div>
          </div>
        `;
      }
    }

    // Action buttons
    let actionHtml = '';
    if (isArchived) {
      // Archived actions: Retrieve & Delete
      actionHtml = `
        <button class="btn btn-success btn-sm" style="flex:1; background:#16a34a; border-color:#16a34a; color:#ffffff; display:flex; align-items:center; gap:5px; justify-content:center;" onclick="window.sightingsView.retrieveSighting('${this._esc(s.id)}')">
          <i data-lucide="rotate-ccw"></i> Retrieve
        </button>
        <button class="btn btn-outline btn-sm" style="color:#ef4444; border-color:rgba(239,68,68,0.35); display:flex; align-items:center; gap:5px; justify-content:center;" onclick="window.sightingsView.deleteSighting('${this._esc(s.id)}')" title="Permanently delete this sighting">
          <i data-lucide="trash-2"></i> Delete
        </button>
      `;
    } else if (isPossible) {
      actionHtml = `
        <button class="btn btn-primary btn-sm" style="flex:1; background:#16a34a; border-color:#16a34a; display:flex; align-items:center; gap:5px; justify-content:center;" onclick="window.notifManager.openSightingVerificationModal('${this._esc(s.id)}')">
          <i data-lucide="shield-check"></i> Verify Sighting
        </button>
        <button class="btn btn-outline btn-sm" onclick="window.sightingsView.archiveSighting('${this._esc(s.id)}')" title="Archive this sighting" style="display:flex; align-items:center; gap:5px;">
          <i data-lucide="archive"></i> Archive
        </button>
      `;
    } else if (isConfirmed) {
      actionHtml = `
        <span class="btn btn-sm" style="flex:1; background:rgba(22,163,74,0.1); color:#16a34a; border:1px solid rgba(22,163,74,0.3); cursor:default; display:flex; align-items:center; gap:5px; justify-content:center;">
          <i data-lucide="check-circle-2"></i> Owner Confirmed
        </span>
        <button class="btn btn-outline btn-sm" onclick="window.sightingsView.archiveSighting('${this._esc(s.id)}')" title="Archive this sighting" style="display:flex; align-items:center; gap:5px;">
          <i data-lucide="archive"></i> Archive
        </button>
      `;
    }

    return `
      <div class="sighting-card glass-card ${isArchived ? 'sighting-card-dismissed' : ''}">
        <!-- Photo -->
        <div class="sighting-card-photo-wrap" onclick="window.pawApp && window.pawApp.openLightbox('${this._esc(photo)}', '${this._esc(s.breed || 'Spotted Pet')}', 'Community Sighting Evidence · ${this._esc(s.location || '')}')">
          <img src="${this._esc(photo)}" alt="Sighting photo" class="sighting-card-photo" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=400&q=80'" />
          <!-- Status badge over photo -->
          <span class="sighting-card-status-badge" style="background:${statusBg}; color:${statusColor}; border-color:${statusBorder};">
            ${statusLabel}
          </span>
        </div>

        <!-- Body -->
        <div class="sighting-card-body">
          <!-- Breed + time -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem; gap:0.5rem;">
            <div>
              <div style="font-size:1rem; font-weight:800; color:var(--text-main); line-height:1.2;">${this._esc(s.breed || 'Spotted Pet')}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${this._esc(s.species || 'Animal')}</div>
            </div>
            <span style="font-size:0.72rem; color:var(--text-muted); white-space:nowrap; flex-shrink:0;">${timeAgo}</span>
          </div>

          <!-- Location -->
          <div class="sighting-card-detail-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>${this._esc(s.location || 'Location not specified')}</span>
          </div>

          <!-- Date/Time -->
          <div class="sighting-card-detail-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${s.dateTimeSeen ? new Date(s.dateTimeSeen).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently spotted'}</span>
          </div>

          <!-- Reporter -->
          <div class="sighting-card-detail-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>
            <span>${this._esc(s.reporterName || 'Community Good Samaritan')}</span>
            ${s.reporterPhone && s.reporterPhone !== '+63 9XX XXX XXXX' ? `<span style="color:var(--primary); font-size:0.72rem; margin-left:4px;">${this._esc(s.reporterPhone)}</span>` : ''}
          </div>

          <!-- Notes (truncated) -->
          ${(s.comments || s.notes) ? `
            <div class="sighting-card-notes">
              "${this._esc((s.comments || s.notes || '').substring(0, 90))}${(s.comments || s.notes || '').length > 90 ? '…' : ''}"
            </div>
          ` : ''}

          <!-- Linked pet banner -->
          ${linkedPetHtml}

          <!-- Actions -->
          <div style="display:flex; gap:0.5rem; margin-top:0.85rem; flex-wrap:wrap; align-items:center;">
            ${actionHtml}
            <button class="btn btn-outline btn-sm" onclick="window.location.hash='#owner'; setTimeout(() => { if (window.publicView) window.publicView.focusPetOnMap('${s.id}'); document.getElementById('incident-map-section')?.scrollIntoView({behavior:'smooth'}); }, 150);" title="View on Incident Map" style="padding:6px 10px;">
              <i data-lucide="map-pin"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────
  _timeAgo(value) {
    if (!value) return 'Unknown time';
    const mins = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
    if (mins < 60)   return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24)    return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;');
  }

  // ─────────────────────────────────────────────────
  // OWNER / PET MANAGEMENT DELEGATION
  // ─────────────────────────────────────────────────
  openRegisterModal(prefillNfc) {
    if (window.ownerView) {
      window.ownerView.openRegisterModal(prefillNfc);
    }
  }

  openOwnerGuideModal() {
    if (window.ownerView) {
      window.ownerView.openOwnerGuideModal();
    }
  }

  markPetSafe(petId) {
    if (window.ownerView) {
      window.ownerView.markPetSafe(petId);
    }
  }

  showPendingFinderInfo(petId) {
    if (window.ownerView) {
      window.ownerView.showPendingFinderInfo(petId);
    }
  }

  showDigitalTagPass(petId) {
    if (window.ownerView) {
      window.ownerView.showDigitalTagPass(petId);
    }
  }

  openReportLostModal(petId) {
    if (window.ownerView) {
      window.ownerView.openReportLostModal(petId);
    }
  }

  renderPetCard(pet) {
    if (window.ownerView) {
      return window.ownerView.renderPetCard(pet);
    }
    return '';
  }
}

window.sightingsView = new SightingsView();
