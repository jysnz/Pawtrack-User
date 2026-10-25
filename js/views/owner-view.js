/**
 * PawTrack Pet Owner View
 */

class OwnerView {
  constructor() {
    this.timerInterval = null;
  }

  render(container) {
    const t = (k, d) => (window.pawI18n ? window.pawI18n.t(k, d) : d);
    const pets = window.pawStore.getPets();
    const impoundedPet = pets.find(p => p.status === 'impounded');
    const activeImpoundment = impoundedPet ? window.pawStore.getActiveImpoundmentForPet(impoundedPet.id) : null;

    let heroLeftHtml = '';
    if (impoundedPet && activeImpoundment) {
      heroLeftHtml = `
        <div class="impound-alert-banner">
          <div class="impound-alert-header">
            <div class="alert-title-tag">
              <i data-lucide="alert-triangle" style="width:22px; height:22px; color:var(--danger); flex-shrink:0;"></i>
              <div>
                <div style="font-weight:700;">${t('owner.heroImpoundTitle', 'IMPOUNDMENT NOTICE')}: "${impoundedPet.name.toUpperCase()}" RECORDED</div>
                <div style="font-size:0.78rem; font-weight:400; color:var(--text-muted);">NFC Tag: ${impoundedPet.nfcTag} · Intake Officer: ${activeImpoundment.intakeOfficer || 'Animal Control Personnel'}</div>
              </div>
            </div>
            <div class="countdown-timer-box">
              <i data-lucide="clock" style="color:var(--danger); width:16px; height:16px;"></i>
              <div>
                <div style="font-size:0.62rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">${t('owner.heroClaimWindow', 'Holding Period Left')}</div>
                <div class="timer-digits" id="holding-countdown-display">Calculating...</div>
              </div>
            </div>
          </div>

          <div class="impound-details-grid">
            <div class="detail-item">
              <span class="detail-label">Holding Facility</span>
              <span class="detail-value">${activeImpoundment.shelterName}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Facility Address</span>
              <span class="detail-value">${activeImpoundment.shelterAddress}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Kennel / Cage ID</span>
              <span class="detail-value" style="color:var(--primary); font-weight:700;">${activeImpoundment.cageNumber}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Impound Location</span>
              <span class="detail-value">${activeImpoundment.impoundLocation || activeImpoundment.shelterAddress || 'Metro Manila Facility'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Health & Notes</span>
              <span class="detail-value" style="font-size:0.82rem;">${activeImpoundment.healthCondition || 'Healthy, vaccinated status verified.'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Hotline</span>
              <span class="detail-value" style="color:var(--primary); font-weight:700;">${activeImpoundment.shelterPhone}</span>
            </div>
          </div>

          <div class="claim-checklist">
            <h4><i data-lucide="shield-alert" style="width:15px; height:15px;"></i> Mandatory Claiming Documentation:</h4>
            <ul>
              <li><i data-lucide="check" style="width:13px; height:13px;"></i> Valid Government Issued ID</li>
              <li><i data-lucide="check" style="width:13px; height:13px;"></i> Pet Registration / Vaccination Book</li>
              <li><i data-lucide="check" style="width:13px; height:13px;"></i> NFC Tag Verification Proof</li>
              <li><i data-lucide="check" style="width:13px; height:13px;"></i> Standard Daily Care Fee</li>
            </ul>
            <div style="margin-top: 0.85rem; display:flex; gap:0.65rem; flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" onclick="window.ownerView.openDirections('${activeImpoundment.shelterAddress}')">
                <i data-lucide="navigation"></i> ${t('owner.heroDirectionsBtn', 'Directions')}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.ownerView.simulateClaim('${activeImpoundment.id}', '${impoundedPet.name}')">
                <i data-lucide="check-circle-2"></i> ${t('owner.heroRedeemBtn', 'Confirm Claim')}
              </button>
              <button class="btn btn-outline btn-sm" onclick="window.notifManager.showSmsSimulation({
                ownerPhone: '${impoundedPet.owner ? impoundedPet.owner.phone : '+63 917 555 3829'}',
                petName: '${impoundedPet.name}',
                nfcTag: '${impoundedPet.nfcTag}',
                shelterName: '${activeImpoundment.shelterName}',
                shelterAddress: '${activeImpoundment.shelterAddress}',
                shelterPhone: '${activeImpoundment.shelterPhone}',
                cageNumber: '${activeImpoundment.cageNumber}'
              })">
                <i data-lucide="smartphone"></i> View SMS Alert
              </button>
            </div>
          </div>
        </div>
      `;
    }

    const hasImpound = Boolean(impoundedPet && activeImpoundment);
    const layoutClass = hasImpound ? 'owner-hero-layout impound-active' : 'owner-hero-layout status-active';
    const statsGridClass = hasImpound ? 'stats-sidebar-col-1' : 'stats-sidebar-grid-2x2';

    const alertCount = pets.filter(p => p.status === 'lost' || p.status === 'impounded').length;
    const safeCount = pets.filter(p => p.status === 'safe' || p.status === 'reunited').length;
    const showAlerts = "if (window.publicView) window.publicView.setFilter('lost'); document.getElementById('incident-map-section')?.scrollIntoView({behavior:'smooth'});";

    // Compact summary strip (shown when no impoundment notice needs the hero space)
    const summaryHtml = `
      <div class="owner-summary glass-card">
        <div class="owner-summary-status ${alertCount > 0 ? 'is-alert' : ''}">
          <span class="owner-summary-dot"></span>
          <div>
            <div class="owner-summary-title">${alertCount > 0
              ? `${alertCount} ${alertCount === 1 ? t('owner.summaryAlertOne', 'pet needs attention') : t('owner.summaryAlertMany', 'pets need attention')}`
              : t('owner.summarySafe', 'All your pets are safe')}</div>
            <div class="owner-summary-sub">${t('owner.heroSheltersConnected', '3 Municipal Shelters Connected')}</div>
          </div>
        </div>
        <div class="owner-summary-stats">
          <button type="button" class="owner-summary-stat" onclick="window.location.hash='#sightings';" title="${t('owner.statTotalPets', 'Total Registered Pets')}">
            <span class="owner-summary-value">${pets.length}</span>
            <span class="owner-summary-label">${t('owner.summaryPets', 'Pets')}</span>
          </button>
          <button type="button" class="owner-summary-stat ${alertCount > 0 ? 'is-alert' : ''}" onclick="${showAlerts}" title="${t('owner.statActiveAlerts', 'Active Alerts / In Recovery')}">
            <span class="owner-summary-value">${alertCount}</span>
            <span class="owner-summary-label">${t('owner.summaryAlerts', 'Missing / Impounded')}</span>
          </button>
          <button type="button" class="owner-summary-stat" onclick="window.location.hash='#sightings';" title="${t('owner.statSafePets', 'Safe / Reunited')}">
            <span class="owner-summary-value">${safeCount}</span>
            <span class="owner-summary-label">${t('owner.statSafePets', 'Safe / Reunited')}</span>
          </button>
          <button type="button" class="owner-summary-stat" onclick="window.location.hash='#hardware'" title="${t('owner.statActiveNfc', 'Active NFC Transponders')}">
            <span class="owner-summary-value">${pets.filter(p => p.nfcTag).length}</span>
            <span class="owner-summary-label">${t('owner.summaryTags', 'NFC Tags')}</span>
          </button>
        </div>
      </div>
    `;

    const heroHtml = hasImpound ? `
      <!-- Hero Layout: Impoundment Notice on Left, Stat Categories on Right -->
      <div class="${layoutClass}">
        <div style="height:100%;">
          ${heroLeftHtml}
        </div>
        <div class="${statsGridClass}">
          ${this.renderHeroStatCards(pets, t, showAlerts)}
        </div>
      </div>
    ` : summaryHtml;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>${t('owner.title', 'Pet Owner Portal')}</h1>
          <div class="view-subtitle">${t('owner.subtitle', 'Monitor registered pets, manage NFC tags, and receive immediate impoundment notifications.')}</div>
        </div>
        <div style="display:flex; gap:0.6rem; align-items:center; width:auto;">
          <button class="btn-help-circle" id="owner-guide-header-btn" onclick="window.ownerView.openOwnerGuideModal()" title="${t('owner.guideBtnTitle', 'Owner System Guide: What to do Before, During & After')}" aria-label="Owner System Guide">
            <i data-lucide="help-circle"></i>
          </button>
          <button class="btn btn-primary" onclick="window.ownerView.openRegisterModal()">
            <i data-lucide="plus-circle"></i> ${t('owner.regBtn', 'Register Pet')}
          </button>
        </div>
      </div>

      ${heroHtml}

      <!-- Incident Map Section (Moved to Home) -->
      <div id="incident-map-section" class="home-map-section">
        <div class="home-section-header">
          <div>
            <h2 id="incident-map-heading">${t('map.title', 'Missing & Found Pets Near You')}</h2>
            <div class="home-section-sub">${t('map.subtitle', 'Tap a pet to see where it was last seen.')}</div>
          </div>
          <div class="home-section-actions">
            <button class="btn btn-outline btn-sm" onclick="window.publicView ? window.publicView.openFoundPetModal() : null">
              <i data-lucide="eye"></i> ${t('map.reportStrayBtn', 'Report Found Pet')}
            </button>
            <button class="btn btn-outline btn-sm" onclick="window.reportManager ? window.reportManager.openSightingModal() : null">
              <i data-lucide="map-pin"></i> Report Sighting
            </button>
          </div>
        </div>

        <!-- Search & Filters -->
        <div class="home-search-panel glass-card">
          <div class="home-search-row">
            <input type="text" id="public-search-input" placeholder="${t('map.searchPh', 'Search by pet name, breed, or barangay...')}" value="${window.publicView ? window.publicView.searchQuery : ''}" oninput="window.publicView ? window.publicView.handleSearch(this.value) : null" />
            <button type="button" class="btn btn-outline btn-sm" onclick="window.publicView ? window.publicView.openPhotoMatchModal() : null" title="Upload a photo and let AI compare it with all missing pets">
              <i data-lucide="camera"></i> <span>Search by Photo</span>
            </button>
          </div>
          <div id="public-filter-btn-group" class="home-filter-chips">
            ${window.publicView ? window.publicView.renderFilterButtons() : ''}
          </div>
        </div>

        <!-- Map & List Layout -->
        <div class="map-layout-grid">
          <!-- Sidebar Cards List -->
          <div class="map-sidebar-list" id="public-pets-list">
            ${window.publicView ? window.publicView.renderFilteredList(pets) : ''}
          </div>

          <!-- Interactive Leaflet Map with Google Maps Styled Controls & Directions HUD -->
          <div class="glass-card" style="position:relative; overflow:hidden; min-height:520px; padding:0;">
            <div id="public-map-container" style="min-height:520px;"></div>

            <!-- Google Maps Layer Switcher Floating Dock -->
            <div class="gmap-layer-dock" id="gmap-layer-dock">
              <button type="button" class="gmap-layer-btn ${window.publicView && window.publicView.currentMapType === 'roadmap' ? 'active' : ''}" onclick="window.publicView ? window.publicView.setMapLayer('roadmap') : null" title="Roadmap View (Default Street Network)">
                <span>Map</span>
              </button>
              <button type="button" class="gmap-layer-btn ${window.publicView && window.publicView.currentMapType === 'satellite' ? 'active' : ''}" onclick="window.publicView ? window.publicView.setMapLayer('satellite') : null" title="Satellite / Actual Photographic Aerial View">
                <span>Satellite</span>
              </button>
              <button type="button" class="gmap-layer-btn ${window.publicView && window.publicView.currentMapType === 'hybrid' ? 'active' : ''}" onclick="window.publicView ? window.publicView.setMapLayer('hybrid') : null" title="Hybrid View (Satellite + Street Labels)">
                <span>Hybrid</span>
              </button>
              <button type="button" class="gmap-layer-btn ${window.publicView && window.publicView.currentMapType === 'dark' ? 'active' : ''}" onclick="window.publicView ? window.publicView.setMapLayer('dark') : null" title="Dark Theme Style">
                <span>Dark</span>
              </button>
            </div>

            <!-- Quick Navigation & View Control Tools -->
            <div class="gmap-quick-tools">
              <button type="button" class="gmap-tool-btn" onclick="window.publicView ? window.publicView.locateMe() : null" title="Recenter to My Location (GPS)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
              </button>
              <button type="button" class="gmap-tool-btn" onclick="window.publicView ? window.publicView.fitAllIncidents() : null" title="Fit View to All Active Incidents">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
              </button>
            </div>

            <!-- Container for Directions & Actual Place Drawer -->
            <div id="gmap-directions-hud-container"></div>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: container });

    if (window.publicView) {
      const shelters = window.pawStore ? window.pawStore.getShelters() : [];
      setTimeout(() => window.publicView.initMap(pets, shelters), 100);
    }

    if (activeImpoundment) {
      this.startCountdownTimer(activeImpoundment.claimDeadline);
    }
  }

  // Stat cards shown beside the impoundment notice
  renderHeroStatCards(pets, t, showAlerts) {
    return `
          <div class="stat-card glass-card" data-label="${t('owner.statTotalPets', 'Total Registered Pets')}" title="Click to view all registered pets in Sightings" style="cursor:pointer;" onclick="window.location.hash='#sightings';">
            <div class="stat-icon" style="background:linear-gradient(135deg, #ea9d1e, #b85410); color:#180d07;">
              <i data-lucide="shield-check"></i>
            </div>
            <div class="stat-info">
              <div class="stat-value">${pets.length}</div>
              <div class="stat-label">${t('owner.statTotalPets', 'Total Registered Pets')}</div>
            </div>
          </div>

          <div class="stat-card glass-card" data-label="${t('owner.statActiveNfc', 'Active NFC Transponders')}" title="Click to view hardware transponder specs" style="cursor:pointer;" onclick="window.location.hash='#hardware'">
            <div class="stat-icon" style="background:linear-gradient(135deg, #b85410, #54280e); color:#ffffff;">
              <i data-lucide="radio"></i>
            </div>
            <div class="stat-info">
              <div class="stat-value">${pets.filter(p => p.nfcTag).length}</div>
              <div class="stat-label">${t('owner.statActiveNfc', 'Active NFC Transponders')}</div>
            </div>
          </div>

          <div class="stat-card glass-card" data-label="${t('owner.statActiveAlerts', 'Active Alerts / In Recovery')}" title="Click to view active recovery alerts on Incident Map" style="cursor:pointer;" onclick="${showAlerts}">
            <div class="stat-icon" style="background:linear-gradient(135deg, #ba3820, #54280e); color:#ffffff;">
              <i data-lucide="alert-circle"></i>
            </div>
            <div class="stat-info">
              <div class="stat-value">${pets.filter(p => p.status === 'lost' || p.status === 'impounded').length}</div>
              <div class="stat-label">${t('owner.statActiveAlerts', 'Active Alerts / In Recovery')}</div>
            </div>
          </div>

          <div class="stat-card glass-card" data-label="${t('owner.statSafePets', 'Safe / Reunited Pets')}" title="Click to view registered safe & reunited pets in Sightings" style="cursor:pointer;" onclick="window.location.hash='#sightings';">
            <div class="stat-icon" style="background:linear-gradient(135deg, #54280e, #241208); color:#ea9d1e;">
              <i data-lucide="check-circle-2"></i>
            </div>
            <div class="stat-info">
              <div class="stat-value">${pets.filter(p => p.status === 'safe' || p.status === 'reunited').length}</div>
              <div class="stat-label">${t('owner.statSafePets', 'Safe / Reunited')}</div>
            </div>
          </div>
    `;
  }

  renderPetCard(pet) {
    const t = (k, d) => (window.pawI18n ? window.pawI18n.t(k, d) : d);
    let badgeClass = 'badge-safe';
    let badgeText = t('owner.statusSafe', 'Safe');

    // Check if a community founder submitted a Found report matching this pet's NFC
    const sightings = window.pawStore ? (window.pawStore.getSightings() || []) : [];
    const cleanPetNfc = (pet.nfcTag || '').trim().toUpperCase();
    const matchingSighting = sightings.find(s => 
      (cleanPetNfc && s.nfcTag && s.nfcTag.trim().toUpperCase() === cleanPetNfc) ||
      (s.matchedPetId && s.matchedPetId === pet.id)
    );

    if (matchingSighting) {
      badgeClass = 'badge-pending';
      badgeText = t('owner.statusPending', 'Found (Pending)');
    } else if (pet.status === 'lost') {
      badgeClass = 'badge-lost';
      badgeText = t('owner.statusLost', 'Missing / Lost');
    } else if (pet.status === 'impounded') {
      badgeClass = 'badge-impounded';
      badgeText = t('owner.statusImpounded', 'Impounded');
    } else if (pet.status === 'reunited') {
      badgeClass = 'badge-reunited';
      badgeText = t('owner.statusReunited', 'Reunited');
    }

    const safePetName = (pet.name || 'Pet').replace(/'/g, "\\'");
    const safeCaption = `${pet.breed} · ${pet.species} | NFC: ${pet.nfcTag}`.replace(/'/g, "\\'");

    return `
      <div class="pet-card glass-card ${matchingSighting ? 'pet-card-matched-pending' : ''}">
        <div class="pet-card-image-wrap" onclick="window.pawApp.openLightbox('${pet.photoUrl}', '${safePetName}', '${safeCaption}')" title="Click to view full photo of ${safePetName}" style="cursor:zoom-in;">
          <img src="${pet.photoUrl || window.PET_PHOTO_PLACEHOLDER}" alt="${pet.name}" class="pet-card-img" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80'" />
          <div class="pet-img-zoom-hint">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
            <span>${t('owner.viewFullPhoto', 'View Full Photo')}</span>
          </div>
          <div class="pet-badge-pos">
            <span class="badge ${badgeClass}">
              <span class="badge-dot"></span> ${badgeText}
            </span>
          </div>
        </div>

        <div class="pet-card-body">
          <div class="pet-card-header">
            <div>
              <h3 class="pet-name">${pet.name}</h3>
              <div class="pet-meta">${pet.breed} · ${pet.gender} · ${pet.species}</div>
            </div>
            <div style="text-align:right;">
              <span class="badge badge-outline" style="font-family:var(--font-mono); font-size:0.75rem;">${pet.nfcTag}</span>
            </div>
          </div>

          ${matchingSighting ? `
            <!-- Pending Founder Sighting Banner (Visible strictly to registered owner with matching NFC) -->
            <div class="pending-founder-banner">
              <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                <span class="pending-pulse-dot"></span>
                <div style="font-size:0.76rem; font-weight:700; color:#ea9d1e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${t('owner.founderFoundAlert', 'Founder Located Your Pet')}
                </div>
              </div>
              <button type="button" class="pending-btn-pill" onclick="window.ownerView.showPendingFinderInfo('${pet.id}')" title="${t('owner.viewFinderInfoTitle', 'View Founder Contact & Sighting Details')}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>${t('owner.btnPending', 'Pending')}</span>
              </button>
            </div>
          ` : ''}

          <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem; background:var(--bg-surface); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <strong>Medical / ID Notes:</strong> ${pet.medicalNotes || 'Standard vaccination profile recorded.'}
          </div>

          <div class="pet-card-actions">
            ${matchingSighting ? `
              <button class="btn btn-pending-action btn-sm" style="flex:1; min-width:0; color:#ffffff !important; display:flex; align-items:center; justify-content:center; gap:5px;" onclick="window.ownerView.showPendingFinderInfo('${pet.id}')" title="${t('owner.viewFinderInfoTitle', 'View Founder Contact & Sighting Details')}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>${t('owner.btnPending', 'Pending')}</span>
              </button>
              <button class="btn btn-primary btn-sm" style="flex-shrink:0; background: #16a34a; border-color: #16a34a; color:#ffffff !important; display:flex; align-items:center; gap:4px;" onclick="window.ownerView.markPetSafe('${pet.id}')" title="Reunited and Safe at Home">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>${t('owner.btnMarkSafe', 'Mark Safe')}</span>
              </button>
            ` : pet.status === 'lost' ? `
              <button class="btn btn-primary btn-sm" style="flex:1; min-width:0; background: #16a34a; border-color: #16a34a; color:#ffffff !important; display:flex; align-items:center; justify-content:center; gap:5px;" onclick="window.ownerView.markPetSafe('${pet.id}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>${t('owner.btnMarkSafe', 'Mark Safe')}</span>
              </button>
              <button class="btn btn-outline btn-sm" style="color: #dc2626; border-color: #dc2626; flex-shrink:0; display:flex; align-items:center; gap:4px;" onclick="document.getElementById('incident-map-section')?.scrollIntoView({behavior:'smooth'});" title="View on Map">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>Map</span>
              </button>
            ` : pet.status === 'impounded' ? `
              <button class="btn btn-danger btn-sm" style="flex:1; min-width:0; color:#ffffff !important; display:flex; align-items:center; justify-content:center; gap:5px;" onclick="window.location.hash='#owner'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>Impound Details</span>
              </button>
            ` : `
              <button class="btn btn-danger btn-sm" style="flex:1; min-width:0; color:#ffffff !important; display:flex; align-items:center; justify-content:center; gap:5px;" onclick="window.ownerView.openReportLostModal('${pet.id}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>${t('owner.btnReportLost', 'Report Missing')}</span>
              </button>
            `}
            <button class="btn btn-outline btn-sm" style="flex-shrink:0; display:flex; align-items:center; gap:4px;" onclick="window.ownerView.showDigitalTagPass('${pet.id}')" title="View Digital NFC & QR Tag Pass">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="5" height="5" x="3" y="3" rx="1"/>
                <rect width="5" height="5" x="16" y="3" rx="1"/>
                <rect width="5" height="5" x="3" y="16" rx="1"/>
                <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                <path d="M21 21v.01"/>
                <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                <path d="M3 12h.01"/>
                <path d="M12 3h.01"/>
                <path d="M12 16v.01"/>
                <path d="M16 12h1"/>
                <path d="M21 12v.01"/>
                <path d="M12 21v-1"/>
              </svg>
              <span>${t('owner.btnDigitalPass', 'Tag Pass')}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  startCountdownTimer(deadlineStr) {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const updateDisplay = () => {
      const displayElem = document.getElementById('holding-countdown-display');
      if (!displayElem) {
        clearInterval(this.timerInterval);
        return;
      }

      const diff = new Date(deadlineStr).getTime() - Date.now();
      if (diff <= 0) {
        displayElem.innerText = '00:00:00 (EXPIRED)';
        displayElem.style.color = 'var(--danger)';
        clearInterval(this.timerInterval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      displayElem.innerText = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    updateDisplay();
    this.timerInterval = setInterval(updateDisplay, 1000);
  }

  openRegisterModal(prefillNfc = null) {
    if (!window.pawStore.isLoggedIn()) {
      const onetap = document.getElementById('google-onetap-prompt');
      if (onetap) onetap.style.display = 'block';
      const warningModal = document.getElementById('google-required-modal');
      if (warningModal) warningModal.style.display = 'flex';
      if (window.notifManager) {
        window.notifManager.showToast('Google Login Required: Please sign in to register pets.', 'warning', 3500);
      }
      return;
    }
    const modal = document.getElementById('register-pet-modal');
    const form = document.getElementById('register-pet-form');
    if (form) {
      if (prefillNfc) {
        form.dataset.prefillNfc = prefillNfc;
      } else {
        delete form.dataset.prefillNfc;
      }
    }
    if (modal) modal.classList.add('active');
  }

  openReportLostModal(petId) {
    if (window.reportManager) {
      window.reportManager.openReportModal('missing', petId);
      return;
    }

    const pet = window.pawStore.getPetById(petId);
    if (!pet) return;

    const modal = document.getElementById('report-lost-modal');
    const form = document.getElementById('report-lost-form');
    const petIdInput = document.getElementById('report-lost-pet-id');
    const petNameDisplay = document.getElementById('report-lost-pet-name');
    const locationInput = document.getElementById('report-lost-location');

    if (form) form.dataset.petId = pet.id;
    if (petIdInput) petIdInput.value = pet.id;
    if (petNameDisplay) petNameDisplay.textContent = pet.name || 'Pet';
    if (locationInput) locationInput.value = pet.lastSeenLocation || 'Quezon City, Metro Manila';

    if (modal) {
      modal.classList.add('active');
      if (window.lucide) window.lucide.createIcons({ root: modal });
    }
  }

  markPetSafe(petId) {
    window.pawStore.updatePetStatus(petId, 'safe');

    // Also resolve any active cases for this pet to synchronize with Admin Portal
    if (window.pawStore) {
      const cases = window.pawStore.getCases() || [];
      const activeCase = cases.find(c => c.petId === petId && c.status !== 'reunited');
      if (activeCase) {
        activeCase.status = 'reunited';
        activeCase.lastUpdated = new Date().toISOString();
        if (!Array.isArray(activeCase.timeline)) activeCase.timeline = [];
        activeCase.timeline.unshift({
          timestamp: new Date().toISOString(),
          type: 'reunited',
          title: 'Pet Reunited & Safe at Home',
          location: 'Home / Safe',
          notes: 'Guardian confirmed pet is safely recovered.'
        });
        window.pawStore.saveCase(activeCase);
      }
    }

    if (window.notifManager) {
      window.notifManager.showToast('Pet status updated to Safe at Home', 'success');
    }
    if (window.location.hash === '#sightings' && window.sightingsView) {
      window.sightingsView.refresh();
    } else {
      this.render(document.getElementById('app-viewport'));
    }
  }

  showPendingFinderInfo(petId) {
    const pet = window.pawStore ? window.pawStore.getPetById(petId) : null;
    if (!pet) return;

    const sightings = window.pawStore ? (window.pawStore.getSightings() || []) : [];
    const cleanPetNfc = (pet.nfcTag || '').trim().toUpperCase();
    const match = sightings.find(s => 
      (cleanPetNfc && s.nfcTag && s.nfcTag.trim().toUpperCase() === cleanPetNfc) ||
      (s.matchedPetId && s.matchedPetId === pet.id)
    );

    if (match) {
      const finderData = {
        id: match.id,
        petId: pet.id,
        petName: pet.name,
        breed: pet.breed || match.breed,
        species: pet.species || match.species,
        nfcTag: pet.nfcTag,
        photoUrl: match.photoUrl || match.photo || pet.photoUrl,
        finderName: match.reporterName || 'Community Good Samaritan',
        finderPhone: match.reporterPhone || '+63 9XX XXX XXXX',
        finderNotes: match.comments || match.notes || 'Pet is safe with community finder.',
        location: match.location || 'Metro Manila',
        coords: match.coords || [14.6500, 121.0400],
        timestamp: match.timestamp || match.createdAt || new Date().toISOString()
      };
      if (window.notifManager) {
        window.notifManager.showFinderInfo(finderData);
      }
    } else {
      const notifs = window.pawStore ? (window.pawStore.getNotifications() || []) : [];
      const notifMatch = notifs.find(n => (n.petId === pet.id || (cleanPetNfc && n.nfcTag && n.nfcTag.toUpperCase() === cleanPetNfc)) && n.type === 'pet_found_match');
      if (notifMatch && window.notifManager) {
        window.notifManager.showFinderInfo(notifMatch);
      } else if (window.notifManager) {
        window.notifManager.showToast('No active pending founder reports for this pet.', 'info');
      }
    }
  }

  simulateClaim(impoundId, petName) {
    const modal = document.getElementById('claiming-verification-modal');
    if (modal) {
      modal.dataset.impoundId = impoundId;
      modal.dataset.petName = petName;
      const petNameEl = document.getElementById('claim-doc-pet-name');
      if (petNameEl) petNameEl.textContent = petName;
      modal.classList.add('active');
      if (window.lucide) window.lucide.createIcons({ root: modal });
    } else {
      if (confirm(`Confirm physical redemption and release of pet "${petName}"?`)) {
        window.pawStore.claimImpoundment(impoundId);
        window.notifManager.showToast(`Pet "${petName}" has been successfully claimed and released`, 'success');
      }
    }
  }

  openDirections(address) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  }

  showDigitalTagPass(petId) {
    const pet = window.pawStore.getPetById(petId);
    if (!pet) return;

    const modal = document.getElementById('digital-pass-modal');
    const passBody = document.getElementById('digital-pass-content');

    passBody.innerHTML = `
      <div style="text-align:center; padding:0.5rem 0;">
        <div style="width:84px; height:84px; border-radius:50%; overflow:hidden; margin:0 auto 1rem; border:3px solid var(--primary); box-shadow:var(--shadow-md); cursor:pointer;" onclick="window.pawApp.openLightbox('${pet.photoUrl}', '${(pet.name || 'Pet').replace(/'/g, "\\'")}', '${pet.breed} · ${pet.species}')" title="Click to view full photo">
          <img src="${pet.photoUrl || window.PET_PHOTO_PLACEHOLDER}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=150&q=80'" />
        </div>
        <h3 style="font-size:1.4rem; margin-bottom:0.25rem;">${pet.name}</h3>
        <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1.25rem;">${pet.breed} · ${pet.gender} · ${pet.species}</div>

        <div style="background:var(--bg-surface-elevated); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-glass); margin-bottom:1.25rem; text-align:left;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span style="color:var(--text-muted); font-size:0.8rem;">NFC Transponder ID</span>
            <strong style="color:var(--primary); font-family:monospace;">${pet.nfcTag}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span style="color:var(--text-muted); font-size:0.8rem;">ISO 11784 Microchip</span>
            <strong style="font-family:monospace; font-size:0.8rem;">${pet.microchipNo}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span style="color:var(--text-muted); font-size:0.8rem;">Registered Guardian</span>
            <strong>${pet.owner.name}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--text-muted); font-size:0.8rem;">Emergency Contact</span>
            <strong style="color:var(--primary); font-weight:700;">${pet.owner.phone}</strong>
          </div>
        </div>

        <div style="background:#ffffff; padding:1rem; border-radius:var(--radius-md); display:inline-block; margin-bottom:1rem; box-shadow:var(--shadow-sm);">
          <div style="font-family:monospace; font-weight:900; font-size:1.15rem; color:#180d07; letter-spacing:2px; border:2px dashed #180d07; padding:0.6rem 1.2rem; border-radius:var(--radius-sm);">
            * ${pet.nfcTag} *
          </div>
          <div style="font-size:0.65rem; color:#666; margin-top:0.4rem; text-transform:uppercase;">13.56 MHz NFC Encoded</div>
        </div>

        <div style="font-size:0.75rem; color:var(--text-muted); line-height:1.4;">
          Scannable by all Quezon City & Metro Manila Municipal Animal Control Handheld Transponders.
        </div>
      </div>
    `;

    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons({ root: modal });
  }

  openOwnerGuideModal() {
    const modal = document.getElementById('owner-guide-modal');
    if (modal) {
      this.filterGuidePhase('all');
      modal.classList.add('active');
      if (window.lucide) window.lucide.createIcons({ root: modal });
    }
  }

  filterGuidePhase(phase) {
    const navBtns = document.querySelectorAll('.owner-guide-nav .guide-nav-btn');
    navBtns.forEach(btn => {
      if (btn.dataset.phase === phase) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const sections = {
      before: document.getElementById('guide-phase-before'),
      during: document.getElementById('guide-phase-during'),
      after: document.getElementById('guide-phase-after')
    };

    if (phase === 'all') {
      Object.values(sections).forEach(sec => {
        if (sec) sec.style.display = 'block';
      });
    } else {
      Object.entries(sections).forEach(([key, sec]) => {
        if (sec) {
          sec.style.display = (key === phase) ? 'block' : 'none';
        }
      });
    }
  }
}

window.ownerView = new OwnerView();
