/**
 * PawTrack Municipal Impound & 72-Hour Holding Bay View
 */

class ImpoundedView {
  constructor() {
    this.searchQuery = '';
    this.filterShelter = 'all';
    this.expandedShelters = new Set();
  }

  setFilterShelter(shelterId) {
    this.filterShelter = shelterId;
    const container = document.getElementById('app-viewport');
    if (container) this.render(container);
  }

  // Refresh only the card list so the search box keeps focus while typing
  handleSearch(e) {
    this.searchQuery = (e.target.value || '').toLowerCase().trim();
    const list = document.getElementById('impounded-list');
    if (!list) return;
    const active = window.pawStore.getImpoundments().filter(i => i.status === 'active_impounded' || i.status === 'active');
    list.innerHTML = this.renderList(active, window.pawStore.getPets());
  }

  toggleShelterExpand(shelterId, e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (this.expandedShelters.has(shelterId)) {
      this.expandedShelters.delete(shelterId);
    } else {
      this.expandedShelters.add(shelterId);
    }
    const container = document.getElementById('app-viewport');
    if (container) this.render(container);
  }

  formatHours(hoursStr) {
    if (!hoursStr) return '';
    const isFil = window.pawI18n && window.pawI18n.getLang() === 'fil';
    if (isFil) {
      return hoursStr
        .replace('Mon - Fri', 'Lunes - Biyernes')
        .replace('Mon - Sat', 'Lunes - Sabado');
    }
    return hoursStr;
  }

  render(container) {
    const t = (k, d) => (window.pawI18n ? window.pawI18n.t(k, d) : d);
    const pets = window.pawStore.getPets();
    const impoundments = window.pawStore.getImpoundments();
    const shelters = window.pawStore.getShelters();

    // Calculate metrics
    const activeImpoundments = impoundments.filter(i => i.status === 'active_impounded' || i.status === 'active');
    const claimedImpoundments = impoundments.filter(i => i.status === 'claimed');
    const urgentCount = activeImpoundments.filter(i => this.getHoursLeft(i).hoursLeft <= 24).length;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1 data-i18n="impounded.title">${t('impounded.title', 'Municipal Impound & 72-Hour Holding Bay')}</h1>
          <div class="view-subtitle" data-i18n="impounded.subtitle">
            ${t('impounded.subtitle', 'Real-time municipal animal shelter holding ledger, legal countdown monitor, and pet redemption gateway.')}
          </div>
        </div>
      </div>

      <!-- Compact Summary Strip -->
      <div class="owner-summary glass-card">
        <div class="owner-summary-status ${urgentCount > 0 ? 'is-alert' : ''}">
          <span class="owner-summary-dot"></span>
          <div>
            <div class="owner-summary-title">${urgentCount > 0
              ? `${urgentCount} with under 24h left to claim`
              : `${activeImpoundments.length} ${t('impounded.statActive', 'Animals in Holding Bay')}`}</div>
            <div class="owner-summary-sub">${shelters.length} ${t('impounded.statShelters', 'NCR Municipal Shelters Active')}</div>
          </div>
        </div>
        <div class="owner-summary-stats">
          <div class="owner-summary-stat" title="${t('impounded.statActiveTitle', 'Active Impounded Animals')}">
            <span class="owner-summary-value">${activeImpoundments.length}</span>
            <span class="owner-summary-label">${t('impounded.statActive', 'Animals in Holding Bay')}</span>
          </div>
          <div class="owner-summary-stat ${urgentCount > 0 ? 'is-alert' : ''}" title="Under 24 hours left">
            <span class="owner-summary-value">${urgentCount}</span>
            <span class="owner-summary-label">Urgent (&lt;24h)</span>
          </div>
          <div class="owner-summary-stat" title="${t('impounded.statClaimedTitle', 'Successfully Redeemed')}">
            <span class="owner-summary-value">${claimedImpoundments.length}</span>
            <span class="owner-summary-label">${t('impounded.statClaimedTitle', 'Successfully Redeemed')}</span>
          </div>
        </div>
      </div>

      <!-- Impounded Layout Grid: Left Sidebar (NCR Municipal Pound Facilities) + Right Main (Search, Filters & Animals) -->
      <div class="impounded-layout-grid">
        <!-- Left Side: NCR Municipal Pound Facilities -->
        <aside class="impounded-facilities-sidebar" style="display:flex; flex-direction:column; gap:0.9rem;">
          <div class="facilities-sidebar-header">
            <h2 style="font-size:1.15rem; font-weight:700; margin:0 0 4px; color:var(--text-main); display:flex; align-items:center; gap:8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 10a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v11H9z"/></svg>
              <span data-i18n="impounded.facilitiesTitle">${t('impounded.facilitiesTitle', 'NCR Municipal Pound Facilities')}</span>
            </h2>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:6px;" data-i18n="impounded.facilitiesSubtitle">
              ${t('impounded.facilitiesSubtitle', 'Official LGU animal welfare & holding centers')}
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.85rem;">
            ${shelters.map(s => {
              const isSelected = this.filterShelter === s.id;
              const isExpanded = this.expandedShelters.has(s.id);
              const count = activeImpoundments.filter(i => i.shelterId === s.id || (i.shelterName && i.shelterName.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]))).length;
              const petSuffix = count === 1 ? t('impounded.petSingular', 'Pet') : t('impounded.petPlural', 'Pets');
              const formattedHours = this.formatHours(s.hours);
              return `
                <div class="glass-card facility-sidebar-card ${isSelected ? 'active' : ''} ${isExpanded ? 'expanded' : ''}" onclick="window.impoundedView.setFilterShelter('${isSelected ? 'all' : s.id}')" style="padding:14px 16px; border-radius:12px; cursor:pointer; border:1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}; background:${isSelected ? 'rgba(194,65,12,0.1)' : 'var(--bg-surface-elevated, rgba(255,255,255,0.03))'};">
                  <!-- Semi-Minimized Header: Facility Title, Pet Count, and Dropdown Arrow Button -->
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:4px;">
                    <h4 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-main); line-height:1.35; flex:1;">${s.name}</h4>
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                      <span class="badge" style="background:${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.08)'}; color:${isSelected ? '#ffffff' : 'var(--text-muted)'}; font-size:10.5px; padding:2px 7px;">
                        ${count} ${petSuffix}
                      </span>
                      <button type="button" class="facility-expand-btn ${isExpanded ? 'expanded' : ''}" onclick="window.impoundedView.toggleShelterExpand('${s.id}', event)" title="${isExpanded ? t('impounded.collapseDetails', 'Show less') : t('impounded.expandDetails', 'Show more information')}" aria-label="Toggle facility details">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="facility-chevron-icon"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                    </div>
                  </div>

                  <!-- Location / Address Line -->
                  <p style="font-size:0.78rem; color:var(--text-muted); margin:0; line-height:1.35;">${s.address}</p>

                  <!-- Expandable Details Section (Dropdown on Arrow Click) -->
                  <div class="facility-details-dropdown ${isExpanded ? 'open' : ''}" style="${isExpanded ? 'display:block;' : 'display:none;'} font-size:0.75rem; color:var(--text-muted); line-height:1.6; border-top:1px solid var(--border-subtle); margin-top:10px; padding-top:8px;">
                    <div><strong>${t('impounded.phoneLabel', 'Phone:')}</strong> ${s.phone}</div>
                    <div><strong>${t('impounded.hoursLabel', 'Hours:')}</strong> ${formattedHours}</div>
                    <div><strong>${t('impounded.capacityLabel', 'Capacity:')}</strong> ${s.capacity} ${t('impounded.kennels', 'Kennels')} (${s.holdingPeriodDays}-${t('impounded.holdingWindow', 'Day Holding Window')})</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </aside>

        <!-- Right Side: Search & Impounded Animals Cards (facility filtering lives in the sidebar) -->
        <section class="impounded-main-content" style="display:flex; flex-direction:column; gap:1.25rem;">
          <div class="glass-card" style="padding:14px 18px; display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
            <div style="position:relative; flex:1; min-width:220px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="${t('impounded.searchPlaceholder', 'Search by pet name, NFC UID, or shelter...')}" value="${this.searchQuery}" oninput="window.impoundedView.handleSearch(event)" style="width:100%; padding-left:36px; height:38px; border-radius:var(--radius-full); font-size:0.85rem;" />
            </div>

            ${this.filterShelter !== 'all' ? `
              <button type="button" class="btn btn-sm btn-outline" onclick="window.impoundedView.setFilterShelter('all')" title="${t('impounded.filterAllFacilities', 'All Facilities')}">
                ${(shelters.find(s => s.id === this.filterShelter) || {}).name || this.filterShelter} &times;
              </button>
            ` : ''}
          </div>

          <div id="impounded-list">
            ${this.renderList(activeImpoundments, pets)}
          </div>
        </section>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: container });
  }

  filterList(activeImpoundments, pets) {
    let list = activeImpoundments;
    if (this.filterShelter !== 'all') {
      list = list.filter(i => i.shelterId === this.filterShelter || i.shelterName?.toLowerCase().includes(this.filterShelter.toLowerCase()));
    }
    if (this.searchQuery) {
      list = list.filter(i => {
        const pet = pets.find(p => p.id === i.petId);
        const name = (pet?.name || i.petName || '').toLowerCase();
        const tag = (i.nfcTag || pet?.nfcTag || '').toLowerCase();
        const shelter = (i.shelterName || '').toLowerCase();
        return name.includes(this.searchQuery) || tag.includes(this.searchQuery) || shelter.includes(this.searchQuery);
      });
    }
    return list;
  }

  getHoursLeft(imp) {
    const timeData = window.pawStore.getImpoundCountdownData ? window.pawStore.getImpoundCountdownData(imp.id) : null;
    return {
      hoursLeft: timeData ? timeData.hoursLeft : 58,
      percent: timeData ? timeData.percentElapsed : 20
    };
  }

  renderList(activeImpoundments, pets) {
    const t = (k, d) => (window.pawI18n ? window.pawI18n.t(k, d) : d);
    // Most urgent first so the animals closest to the claim deadline are seen first
    const filteredList = this.filterList(activeImpoundments, pets)
      .map(imp => ({ imp, ...this.getHoursLeft(imp) }))
      .sort((a, b) => a.hoursLeft - b.hoursLeft);

    if (filteredList.length === 0) {
      return `
        <div class="glass-card" style="padding:48px 24px; text-align:center; color:var(--text-muted);">
          <div style="width:56px; height:56px; border-radius:50%; background:rgba(22,163,74,0.12); color:#16a34a; display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
          </div>
          <h3 style="font-size:1.15rem; margin-bottom:6px; color:var(--text-main);" data-i18n="impounded.emptyTitle">${t('impounded.emptyTitle', 'No Impounded Animals in Selected Facility')}</h3>
          <p style="font-size:0.85rem; max-width:420px; margin:0 auto;" data-i18n="impounded.emptyDesc">${t('impounded.emptyDesc', 'All registered pets are currently safe at home or monitored under the municipal NFC grid.')}</p>
        </div>
      `;
    }

    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap:1.25rem;">
        ${filteredList.map(({ imp, hoursLeft, percent }) => {
          const pet = pets.find(p => p.id === imp.petId) || { name: imp.petName || 'Unknown Pet', breed: 'Domestic Companion', photoUrl: 'images/sample-pets/max.jpg' };
          const isUrgent = hoursLeft <= 24;

          return `
            <div class="glass-card" style="padding:20px; border:1px solid ${isUrgent ? 'rgba(239,68,68,0.35)' : 'var(--border-subtle)'}; display:flex; flex-direction:column; gap:14px; position:relative;">
              <div style="display:flex; gap:14px; align-items:flex-start;">
                <img src="${pet.photoUrl || 'images/sample-pets/max.jpg'}" alt="${pet.name}" style="width:68px; height:68px; border-radius:12px; object-fit:cover; border:2px solid var(--border-subtle);" />
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                    <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:var(--text-main);">${pet.name}</h3>
                    <span class="badge badge-impounded" style="font-size:10.5px;">${t('impounded.badgeImpounded', 'IMPOUNDED')}</span>
                  </div>
                  <div style="font-size:0.8rem; color:var(--text-muted);">${pet.breed || t('impounded.defaultBreed', 'Companion Pet')}</div>
                  <div style="font-size:0.75rem; font-family:var(--font-mono); color:var(--text-muted); margin-top:2px;">${imp.nfcTag}</div>
                </div>
              </div>

              <!-- 72-Hour Holding Window Progress -->
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; margin-bottom:6px;">
                  <span style="color:var(--text-muted); font-weight:600;">${t('impounded.holdingWindowHeader', '72-Hour Legal Holding Window:')}</span>
                  <strong style="color:${isUrgent ? '#ef4444' : '#ffd085'};">${hoursLeft} ${t('impounded.hoursRemaining', 'Hours Remaining')}</strong>
                </div>
                <div style="width:100%; height:8px; background:rgba(255,255,255,0.08); border-radius:99px; overflow:hidden;">
                  <div style="width:${percent}%; height:100%; background:${isUrgent ? '#ef4444' : 'var(--primary)'}; border-radius:99px; transition:width 0.3s ease;"></div>
                </div>
              </div>

              <!-- Intake Details -->
              <div style="font-size:0.8rem; line-height:1.55; color:var(--text-muted);">
                <div>${imp.shelterName || 'Quezon City Animal Care Facility'} · ${t('impounded.detailKennel', 'Kennel #')}${imp.cageNumber || 'B-04'}</div>
                <div>${t('impounded.detailDailyFee', 'Daily Pound Fee:')} ${t('impounded.dailyFeeRate', 'PHP 500 / day')}</div>
              </div>

              <!-- Action Buttons -->
              <div style="display:flex; gap:8px; margin-top:auto;">
                <button type="button" class="btn btn-primary btn-sm" style="flex:1;" onclick="window.ownerView ? window.ownerView.simulateClaim('${imp.id}', '${pet.name}') : null">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                  <span>${t('impounded.btnRedeemClaim', 'Redeem & Claim')}</span>
                </button>
                <a href="#owner" class="btn btn-outline btn-sm" onclick="setTimeout(() => { if (window.publicView) window.publicView.focusPetOnMap('${pet.id}'); document.getElementById('incident-map-section')?.scrollIntoView({behavior:'smooth'}); }, 150);" title="${t('impounded.btnViewMap', 'View Facility on Map')}" aria-label="${t('impounded.btnViewMap', 'View Facility on Map')}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
                </a>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

window.impoundedView = new ImpoundedView();
