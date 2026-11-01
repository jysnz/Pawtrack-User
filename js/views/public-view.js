/**
 * PawTrack Public Lost & Found Board and Interactive Incident Map
 * Features Google Maps-Style Multi-Layer View (Roadmap / Satellite / Hybrid),
 * Interactive Turn-by-Turn Navigation, and Real-World Actual Place / Street View Visualizer.
 */

// The one palette for everything on the map: pins, the legend, list section headers, popups and cards.
// Each situation has its own hue, so no two pins can be mistaken for each other.
const MAP_COLORS = {
  missing:   '#dc2626', // red
  lastSeen:  '#7c3aed', // violet
  sighting:  '#ea9d1e', // amber
  confirmed: '#16a34a', // green
  impounded: '#0891b2', // cyan
  shelter:   '#475569'  // slate
};
window.MAP_COLORS = MAP_COLORS;

// What each quick filter shows on the map; the Layers panel then fine-tunes it
const MAP_LAYER_PRESETS = {
  all:       { missing: true,  lastSeen: true,  sightings: true,  impounded: true,  shelters: true },
  lost:      { missing: true,  lastSeen: true,  sightings: false, impounded: false, shelters: false },
  lastseen:  { missing: false, lastSeen: true,  sightings: false, impounded: false, shelters: false },
  sighted:   { missing: false, lastSeen: false, sightings: true,  impounded: false, shelters: false },
  impounded: { missing: false, lastSeen: false, sightings: false, impounded: true,  shelters: true },
  mine:      { missing: true,  lastSeen: false, sightings: false, impounded: true,  shelters: false }
};

const MAP_LAYER_DEFS = [
  { key: 'missing',   label: 'Missing pets',        color: MAP_COLORS.missing },
  { key: 'lastSeen',  label: 'Last seen locations', color: MAP_COLORS.lastSeen },
  { key: 'sightings', label: 'Community sightings', color: MAP_COLORS.sighting },
  { key: 'impounded', label: 'Impounded pets',      color: MAP_COLORS.impounded },
  { key: 'shelters',  label: 'Shelters',            color: MAP_COLORS.shelter }
];

class PublicView {
  constructor() {
    this.map = null;
    this.currentFilter = 'all';
    this.mineOnly = false; // "My pets" filter: only the signed-in guardian's own pets
    this.searchQuery = '';
    this.petMarkers = {};
    this.shelterMarkers = [];
    this.sightingMarkers = [];
    this.lastSeenItems = [];
    this.layers = { ...MAP_LAYER_PRESETS.all };
    this.focusPoint = null; // {lat, lng, label}: set when a pin is tapped; the list then shows only what is there
    this.layersPanelOpen = window.innerWidth >= 768;
    this.currentMapType = 'roadmap'; // 'roadmap', 'satellite', 'hybrid', 'dark'
    this.selectedCommunity = 'all';
    this.currentTileLayer = null;
    this.activeRoute = null;
    this.routePolyline = null;
    this.routeGlowLine = null;
    this.navigator = new TurnByTurn(this);
    this.startMarker = null;
    this.userLocation = [14.6500, 121.0350]; // Default user GPS / Central NCR Command
  }

  formatSightingDate(value) {
    if (!value) return 'Not provided';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not provided';
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  render(container) {
    this.focusPoint = null;
    const t = (k, d) => (window.pawI18n ? window.pawI18n.t(k, d) : d);
    const pets = window.pawStore.getMapPets();
    const shelters = window.pawStore.getShelters();

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>${t('map.title', 'Community Recovery & Incident Map')}</h1>
          <div class="view-subtitle">${t('map.subtitle', 'Recorded landmark locations of missing pets, community sightings, verified AI matches, and shelter intake facilities.')}</div>
        </div>
        <div style="display:flex; gap:0.65rem; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-primary btn-sm" onclick="window.publicView.openFoundPetModal()">
            <i data-lucide="eye"></i> ${t('map.reportStrayBtn', 'Report Found Stray Pet')}
          </button>
          <button class="btn btn-outline btn-sm" onclick="window.reportManager.openSightingModal()">
            <i data-lucide="map-pin"></i> Report Pet Sighting
          </button>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="glass-card" style="padding:1rem 1.25rem; margin-bottom:1.5rem; display:flex; flex-wrap:wrap; gap:1rem; align-items:center; justify-content:space-between;">
        <div style="display:flex; gap:0.5rem; flex:1; min-width:260px;">
          <input type="text" id="public-search-input" placeholder="${t('map.searchPh', 'Search by pet name, breed, or barangay...')}" value="${this.searchQuery}" oninput="window.publicView.handleSearch(this.value)" />
          <button type="button" class="btn btn-outline btn-sm" onclick="window.publicView.openPhotoMatchModal()" title="Upload a photo and let AI compare it with all missing pets" style="display:flex; align-items:center; gap:0.4rem; white-space:nowrap;">
            <i data-lucide="camera"></i> Search by Photo
          </button>
        </div>

        <div id="public-filter-btn-group" style="display:flex; gap:0.45rem; flex-wrap:wrap;">
          ${this.renderFilterButtons()}
        </div>
      </div>

      <!-- Map & List Layout -->
      <div class="map-layout-grid">
        <!-- Sidebar Cards List -->
        <div class="map-sidebar-list" id="public-pets-list">
          ${this.renderFilteredList(pets)}
        </div>

        <!-- Interactive Leaflet Map with Google Maps Styled Controls & Directions HUD -->
        <div class="glass-card" style="position:relative; overflow:hidden; min-height:520px; padding:0;">
          <div id="public-map-container" style="min-height:520px;"></div>

          <!-- Quick Navigation & View Control Tools -->
          <div class="gmap-quick-tools">
            <button type="button" class="gmap-tool-btn" onclick="window.publicView.locateMe()" title="Recenter to My Location (GPS)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
            </button>
            <button type="button" class="gmap-tool-btn" onclick="window.publicView.fitAllIncidents()" title="Fit View to All Active Incidents">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            </button>
          </div>

          <!-- Layer selector: choose exactly what the map shows -->
          <div class="map-layers" id="map-layers">${this.renderLayersPanel()}</div>

          <!-- Legend: what each pin colour means -->
          ${this.renderMapLegend()}

          <!-- Container for Directions & Actual Place Drawer -->
          <div id="gmap-directions-hud-container"></div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: container });

    // Initialize Map with Pets, Shelters, and Community Sightings
    setTimeout(() => this.initMap(pets, shelters), 100);
  }

  renderMapLegend() {
    const items = [
      [MAP_COLORS.missing, 'Missing pet'],
      [MAP_COLORS.lastSeen, 'Last seen here'],
      [MAP_COLORS.sighting, 'Possible sighting'],
      [MAP_COLORS.confirmed, 'Confirmed sighting'],
      [MAP_COLORS.impounded, 'Impounded'],
      [MAP_COLORS.shelter, 'Shelter']
    ];
    return `
      <details class="map-legend" ${window.innerWidth >= 768 ? 'open' : ''}>
        <summary>Legend</summary>
        <ul>
          ${items.map(([color, label]) => `<li><span class="map-legend-dot" style="background:${color};"></span>${label}</li>`).join('')}
        </ul>
      </details>`;
  }

  renderFilterButtons() {
    const t = (k, d) => (window.pawI18n ? window.pawI18n.t(k, d) : d);
    const pets = window.pawStore.getMapPets();
    const sightings = window.pawStore.getSightings();
    const lostCount = pets.filter(p => p.status === 'lost').length;
    const sightedCount = sightings.length;
    const lastSeenCount = (this.lastSeenItems || []).length;
    const impoundedCount = pets.filter(p => p.status === 'impounded' || p.status === 'active_impounded').length;

    // Owners get a "My pets" filter for their own pets that are missing or impounded
    const mineCount = pets.filter(p => window.pawStore.isMyPet(p) && ['missing', 'impounded'].includes(this.layerFor(p))).length;
    const isMine = this.currentFilter === 'mine';
    const isAll = this.currentFilter === 'all';
    const isLost = this.currentFilter === 'lost';
    const isLastSeen = this.currentFilter === 'lastseen';
    const isSighted = this.currentFilter === 'sighted';
    const isImpounded = this.currentFilter === 'impounded';

    return `
      <button type="button" class="btn btn-sm ${isAll ? 'btn-primary active' : 'btn-outline'}" onclick="window.publicView.setFilter('all')">
        ${t('map.filterAll', 'All Records')} (${pets.length + sightings.length + lastSeenCount})
      </button>
      ${mineCount ? `<button type="button" class="btn btn-sm ${isMine ? 'btn-primary active' : 'btn-outline'}" onclick="window.publicView.setFilter('mine')" title="Only your own pets">
        ${t('map.filterMine', 'My Pets')} (${mineCount})
      </button>` : ''}
      <button type="button" class="btn btn-sm ${isLost ? 'btn-danger active' : 'btn-outline'}" onclick="window.publicView.setFilter('lost')">
        ${t('map.filterLost', 'Missing')} (${lostCount})
      </button>
      <button type="button" class="btn btn-sm ${isLastSeen ? 'btn-danger active' : 'btn-outline'}" onclick="window.publicView.setFilter('lastseen')" title="Where each missing pet was last seen">
        Last Seen (${lastSeenCount})
      </button>
      <button type="button" class="btn btn-sm ${isSighted ? 'btn-primary active' : 'btn-outline'}" onclick="window.publicView.setFilter('sighted')" style="${isSighted ? 'background:#ea9d1e; color:#180d07;' : ''}">
        ${t('map.filterSightings', 'Sightings')} (${sightedCount})
      </button>
      <button type="button" class="btn btn-sm ${isImpounded ? 'btn-secondary active' : 'btn-outline'}" onclick="window.publicView.setFilter('impounded')">
        ${t('map.filterImpounded', 'Impounded')} (${impoundedCount})
      </button>
    `;
  }

  renderCommunityOptions() {
    const qcDistricts = [
      'District 1 (La Loma / SFDM / Project 6)',
      'District 2 (Commonwealth / Batasan / Payatas)',
      'District 3 (Cubao / Katipunan / Loyola / Eastwood)',
      'District 4 (Diliman / Tomas Morato / UP / New Manila)',
      'District 5 (Novaliches / Fairview / Lagro)',
      'District 6 (Tandang Sora / Balintawak / Culiat)'
    ];

    const communities = new Set(qcDistricts);
    const user = window.pawStore && window.pawStore.getGoogleUser ? window.pawStore.getGoogleUser() : null;
    if (user && user.area && !user.area.includes('National Capital Region')) {
      communities.add(user.area);
    }
    window.pawStore.getPets().forEach(p => {
      if (p.community && !p.community.includes('National Capital Region')) communities.add(p.community);
      else if (p.owner && p.owner.community && !p.owner.community.includes('National Capital Region')) communities.add(p.owner.community);
    });
    window.pawStore.getSightings().forEach(s => {
      if (s.community && !s.community.includes('National Capital Region')) communities.add(s.community);
    });

    return ['<option value="all">All QC Districts</option>']
      .concat(Array.from(communities).map(c => `<option value="${c.replace(/"/g, '&quot;')}" ${this.selectedCommunity === c ? 'selected' : ''}>${c}</option>`))
      .join('');
  }

  setCommunity(community) {
    this.selectedCommunity = community || 'all';
    if (window.location.hash === '#owner' || !window.location.hash || window.location.hash === '') {
      if (window.ownerView) {
        window.ownerView.render(document.getElementById('app-viewport'));
      }
    } else {
      this.render(document.getElementById('app-viewport'));
    }
  }

  // "Breed • Gender" under a pet's name; a pet reported without registering says so instead of a gender
  petSubtitle(pet) {
    const kind = pet.unregistered ? (pet.reportedByOwner ? 'Not registered' : 'Not registered · Reported by someone else') : pet.gender;
    const looks = pet.unregistered && pet.description ? pet.description : pet.breed;
    return [looks, kind].filter(Boolean).join(' • '); // plain text: escaped where it is used
  }

  isInSelectedCommunity(item) {
    if (!this.selectedCommunity || this.selectedCommunity === 'all') return true;
    
    const sel = this.selectedCommunity.toLowerCase();
    const itemCommunity = (item.community || (item.owner && item.owner.community) || '').toLowerCase();
    const itemLocation = (item.location || item.lastSeenLocation || '').toLowerCase();
    const combined = `${itemCommunity} ${itemLocation}`;

    if (itemCommunity === sel || combined.includes(sel)) return true;

    const districtKeywords = {
      'district 1': ['district 1', 'd1', 'la loma', 'sfdm', 'san francisco del monte', 'project 6', 'banawe', 'sto. domingo', 'project 7', 'balingasa', 'veterans village', 'del monte', 'siena', 'calavite'],
      'district 2': ['district 2', 'd2', 'commonwealth', 'batasan', 'payatas', 'holy spirit', 'bagong silangan', 'litex', 'lupang pangako', 'bf homes qc'],
      'district 3': ['district 3', 'd3', 'cubao', 'katipunan', 'loyola', 'eastwood', 'anonas', 'kamias', 'project 2', 'project 3', 'project 4', 'matandang balara', 'old balara', 'blue ridge', 'socorro', 'quirino', 'libis'],
      'district 4': ['district 4', 'd4', 'diliman', 'tomas morato', 'timog', 'south triangle', 'new manila', 'kamuning', 'teachers village', 'maginhawa', 'sikatuna', 'phil-am', 'west avenue', 'central', 'krus na ligas', 'up campus', 'quezon memorial circle', 'city hall', 'scout'],
      'district 5': ['district 5', 'd5', 'novaliches', 'fairview', 'lagro', 'gulod', 'san bartolome', 'bagbag', 'sta. lucia', 'greater lagro', 'regalado'],
      'district 6': ['district 6', 'd6', 'tandang sora', 'balintawak', 'culiat', 'talipapa', 'sangandaan', 'pasong tamo', 'baesa', 'sauyo']
    };

    for (const [dKey, keywords] of Object.entries(districtKeywords)) {
      if (sel.includes(dKey)) {
        return keywords.some(kw => combined.includes(kw));
      }
    }

    return combined.includes(sel);
  }

  renderFilteredList(pets) {
    return this.focusBanner() + this.renderFilteredListBody(pets);
  }

  // Where an item sits on the map, as [lat, lng] (null when unknown)
  itemLatLng(item) {
    if (item.type === 'pet') {
      const m = this.petMarkers && this.petMarkers[item.data.id];
      if (m) { const ll = m.getLatLng(); return [ll.lat, ll.lng]; }
    } else if (item.type === 'lastseen') {
      const found = (this.lastSeenItems || []).find(i => i.row.id === item.data.id);
      if (found) return found.coords;
    } else if (item.type === 'sighting') {
      const found = (this.sightingMarkers || []).find(i => i.id === item.data.id);
      if (found) return found.coords;
    }
    return null;
  }

  focusBanner() {
    if (!this.focusPoint) return '';
    const count = this.focusCount || 0;
    return `
      <div class="map-focus-chip" role="status">
        <span><strong>${count}</strong> ${count === 1 ? 'record' : 'records'} at <strong>${this.escapeHtml(this.focusPoint.label)}</strong></span>
        <button type="button" onclick="window.publicView.clearFocus()">Show all</button>
      </div>`;
  }

  // A pin was tapped: the list narrows to the pets and records at that spot
  focusPlace(coords, label) {
    this.focusPoint = { lat: coords[0], lng: coords[1], label: label || 'this spot' };
    this.updateFilterUI(false);
    document.getElementById('public-pets-list')?.scrollTo({ top: 0 });
  }

  clearFocus() {
    if (!this.focusPoint) return;
    this.focusPoint = null;
    this.updateFilterUI(false);
  }

  renderFilteredListBody(pets) {
    const sightings = window.pawStore.getSightings();
    let items = [];

    // 1. Add Pet items
    pets.forEach(p => {
      if (!this.isInSelectedCommunity(p)) return;
      if (!this.layers[this.layerFor(p)]) return;
      if (this.mineOnly && !window.pawStore.isMyPet(p)) return;

      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchBreed = (p.breed || '').toLowerCase().includes(q);
        const matchLoc = (p.lastSeenLocation || '').toLowerCase().includes(q);
        if (!matchName && !matchBreed && !matchLoc) return;
      }

      items.push({ type: 'pet', data: p, date: p.lastSeenDate || p.createdAt || p.registeredDate });
    });

    // 2. Add Sighting items
    // 2a. Last seen locations of missing pets
    if (this.layers.lastSeen) {
      (this.lastSeenItems || []).forEach(item => {
        if (this.searchQuery) {
          const q = this.searchQuery.toLowerCase();
          const hay = [item.row.pet_name, item.row.breed, item.row.species, item.row.last_seen_location];
          if (!hay.some(v => (v || '').toLowerCase().includes(q))) return;
        }
        items.push({ type: 'lastseen', data: item.row, date: item.row.last_seen_at });
      });
    }

    // 2b. Sighting items
    if (this.layers.sightings) {
      sightings.forEach(s => {
        if (s.status === 'dismissed' || s.status === 'archived' || !this.isInSelectedCommunity(s)) return;
        if (this.searchQuery) {
          const q = this.searchQuery.toLowerCase();
          const matchBreed = (s.breed || '').toLowerCase().includes(q);
          const matchLoc = (s.location || '').toLowerCase().includes(q);
          const matchComments = (s.comments || '').toLowerCase().includes(q);
          if (!matchBreed && !matchLoc && !matchComments) return;
        }
        items.push({ type: 'sighting', data: s, date: s.createdAt || s.dateTimeSeen });
      });
    }

    if (this.focusPoint) {
      const f = this.focusPoint;
      items = items.filter(item => {
        const at = this.itemLatLng(item);
        return at && this.calculateDistance(f.lat, f.lng, at[0], at[1]) <= 0.06; // within about 60 m
      });
      this.focusCount = items.length;
    }

    if (items.length === 0) {
      return `
        <div class="glass-card" style="padding:2rem; text-align:center; color:var(--text-muted);">
          <i data-lucide="search-x" style="width:40px; height:40px; margin-bottom:0.75rem; opacity:0.5;"></i>
          <div>${Object.values(this.layers).some(Boolean) ? 'No records match the current layers and search.' : 'No layers selected. Turn one on in the Layers panel on the map.'}</div>
        </div>
      `;
    }

    const renderItem = (item) => {
      if (item.type === 'lastseen') {
        const r = item.data;
        return `
          <div class="glass-card last-seen-card" onclick="window.publicView.focusLastSeen('${r.id}')">
            <div class="last-seen-card-icon" aria-hidden="true"><span></span></div>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:2px;">
                <h4 style="font-size:0.95rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;">${this.escapeHtml(r.pet_name)}</h4>
                <span style="font-size:0.68rem; font-weight:700; color:${MAP_COLORS.lastSeen}; text-transform:uppercase; white-space:nowrap;">Last seen</span>
              </div>
              <div style="font-size:0.78rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(r.last_seen_location)}</div>
              <div style="font-size:0.72rem; color:var(--primary); font-weight:700;">${this.getTimeAgo(r.last_seen_at)} &middot; ${this.escapeHtml(r.species)}${r.breed ? ' &middot; ' + this.escapeHtml(r.breed) : ''}</div>
            </div>
          </div>
        `;
      }

      if (item.type === 'sighting') {
        const s = item.data;
        const sLat = (s.lat || 14.6360);
        const sLng = (s.lng || 121.0370);
        return `
          <div class="glass-card" style="padding:0.9rem; display:flex; flex-direction:column; gap:0.6rem; border-left:3px solid ${MAP_COLORS.sighting}; cursor:pointer;" onclick="window.publicView.focusCoordsOnMap(${sLat}, ${sLng}, 'Sighting: ${s.breed || 'Pet'}')">
            <div style="display:flex; gap:0.85rem; align-items:center;">
              <img src="${s.photoUrl || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=300&q=80'}" style="width:58px; height:58px; border-radius:var(--radius-md); object-fit:cover; border:2px solid #ea9d1e; flex-shrink:0; cursor:zoom-in;" onclick="event.stopPropagation(); window.pawApp.openLightbox('${s.photoUrl}', 'Community Pet Sighting', '${s.breed || 'Stray Pet'} · ${s.location}')" />
              <div style="flex:1; min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:2px;">
                  <h4 style="font-size:0.95rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;">${s.breed || 'Spotted Pet'}</h4>
                  <span class="badge" style="background:${MAP_COLORS.sighting}22; color:${MAP_COLORS.sighting}; border:1px solid ${MAP_COLORS.sighting}66; font-size:0.68rem; flex-shrink:0;">SIGHTED</span>
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px;">Location: ${s.location}</div>
                <div style="font-size:0.72rem; color:var(--primary); font-weight:700;">Seen: ${this.formatSightingDate(s.dateTimeSeen || s.createdAt)}</div>
              </div>
            </div>
            <div class="sighting-comment-clamp" style="font-size:0.76rem; color:var(--text-muted); border-top:1px solid var(--border-subtle); padding-top:6px;">
              <strong>Comments:</strong> ${s.comments || s.notes || 'No comments provided.'}
            </div>
            <div style="display:flex; gap:6px; border-top:1px solid var(--border-subtle); padding-top:6px;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${sLat},${sLng}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="flex:1; padding:4px 8px; font-size:0.75rem; justify-content:center; text-decoration:none;" onclick="event.stopPropagation();">
              <i data-lucide="map-pin"></i> Show Directions
            </a>
            </div>
          </div>
        `;
      }

      const pet = item.data;
      let statusColor = '#16a34a';
      let statusLabel = 'Safe';
      if (pet.status === 'lost') { statusColor = MAP_COLORS.missing; statusLabel = 'Missing'; }
      if (pet.status === 'impounded' || pet.status === 'active_impounded') { statusColor = MAP_COLORS.impounded; statusLabel = 'Impounded'; }
      if (pet.status === 'reunited') { statusColor = '#16a34a'; statusLabel = 'Reunited'; }

      const petCoordinates = {
        'pet-1': [14.6650, 121.0350],
        'pet-2': [14.6342, 121.0375],
        'pet-3': [14.5750, 121.0620],
        'pet-4': [14.5880, 121.0450]
      };
      const pCoords = petCoordinates[pet.id] || (pet.lastSeenCoords || [14.6400, 121.0500]);
      const mine = window.pawStore.isMyPet(pet);
      const tap = mine && pet.status === 'lost' ? `window.publicView.openMarkFound('${pet.id}')` : `window.publicView.focusPetOnMap('${pet.id}')`;

      return `
        <div class="glass-card" style="padding:0.9rem; display:flex; flex-direction:column; gap:0.6rem; cursor:pointer;" onclick="${tap}">
          <div style="display:flex; gap:0.85rem; align-items:center;">
            <img src="${pet.photoUrl || window.PET_PHOTO_PLACEHOLDER}" style="width:58px; height:58px; border-radius:var(--radius-md); object-fit:cover; border:2px solid ${statusColor}; flex-shrink:0; cursor:zoom-in;" onclick="event.stopPropagation(); window.pawApp.openLightbox('${this.jsArg(pet.photoUrl)}', '${this.jsArg(pet.name || 'Pet')}', '${this.jsArg(this.petSubtitle(pet))}')" title="Click to view full photo" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80'" />
            <div style="flex:1; min-width:0;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:2px;">
                <h4 style="font-size:0.95rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;">${this.escapeHtml(pet.name)}</h4>
                <span style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                  ${mine ? `<span class="pet-mine-tag">${pet.unregistered && !pet.reportedByOwner ? 'You reported' : 'Your pet'}</span>` : ''}
                  <span style="font-size:0.68rem; font-weight:700; color:${statusColor}; text-transform:uppercase; white-space:nowrap;">${statusLabel}</span>
                </span>
              </div>
              <div style="font-size:0.78rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(this.petSubtitle(pet))}</div>
            </div>
          </div>
          <div style="display:flex; gap:6px; border-top:1px solid var(--border-subtle); padding-top:6px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${pCoords[0]},${pCoords[1]}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="flex:1; padding:4px 8px; font-size:0.75rem; justify-content:center; text-decoration:none;" onclick="event.stopPropagation();">
              <i data-lucide="map-pin"></i> Show Directions
            </a>
          </div>
        </div>
      `;
    };

    // One section per kind of case, each with its own header, so the list is not mixed together
    const groupOf = (item) => item.type === 'lastseen' ? 'lastSeen' : item.type === 'sighting' ? 'sightings' : this.layerFor(item.data);
    const newest = (a, b) => new Date(b.date || 0) - new Date(a.date || 0);
    return MAP_LAYER_DEFS
      .filter(d => d.key !== 'shelters')
      .map(d => ({ def: d, list: items.filter(i => groupOf(i) === d.key).sort(newest) }))
      .filter(g => g.list.length)
      .map(g => `
        <section class="incident-section" aria-label="${g.def.label}">
          <h3 class="incident-section-header" style="--section:${g.def.color};">
            <span class="incident-section-title">${g.def.label}</span>
            <span class="incident-section-count">${g.list.length}</span>
          </h3>
          ${g.list.map(renderItem).join('')}
        </section>
      `).join('');
  }

  async initMap(pets, shelters) {
    await window.PawMapsReady; // Google Maps adapter (falls back to Leaflet when no key is set)
    const container = document.getElementById('public-map-container');
    if (!container || !window.L) return;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    // Initialize Leaflet Map Centered around Metro Manila
    this.map = window.L.map('public-map-container', {
      scrollWheelZoom: true,
      zoomControl: true
    }).setView([14.6300, 121.0400], 12);

    // Apply active tile layer (Roadmap default)
    this.setMapLayer(this.currentMapType || 'roadmap', false);
    this.map.on('click', () => this.clearFocus());
    this.map.on('zoomend', () => this.spreadOverlapping());

    this.petMarkers = {};
    this.shelterMarkers = [];
    const markerGroup = [];

    // Distinct coordinates per pet to avoid marker clustering
    const petCoordinates = {
      'pet-1': [14.6650, 121.0350], // Max - QC Timog/West Triangle
      'pet-2': [14.6342, 121.0375], // Luna - Tomas Morato
      'pet-3': [14.5750, 121.0620], // Rocky - Pasig Kapitolyo
      'pet-4': [14.5880, 121.0450]  // Mochi - Mandaluyong border
    };

    // Add Shelter / Facility Pins (Icon-only by default, info appears on hover, full details on click)
    shelters.forEach(s => {
      const shelterIcon = this.pinIcon({ kind: 'shelter', title: s.name });

      const tooltipContent = `
        <div class="shelter-hover-content">
          <div class="shelter-tooltip-header">Official Animal Facility</div>
          <div class="shelter-tooltip-title">${s.name}</div>
          <div class="shelter-tooltip-addr">${s.address}</div>
          <div class="shelter-tooltip-phone">Hotline: ${s.phone}</div>
          <div class="shelter-tooltip-hint">Click pin for directions & photos</div>
        </div>
      `;

      const sMarker = window.L.marker([s.lat, s.lng], { icon: shelterIcon })
        .addTo(this.map)
        .bindTooltip(tooltipContent, {
          direction: 'top',
          offset: [0, -18],
          className: 'shelter-hover-tooltip',
          opacity: 0.98
        })
        .bindPopup(`
        ${this.popupCard({
          badge: 'Animal facility',
          tone: MAP_COLORS.shelter,
          photo: s.photoUrl,
          placeholderIcon: 'building',
          title: s.name,
          rows: [
            { icon: 'pin', label: 'Address', value: s.address },
            { icon: 'phone', label: 'Hotline', value: s.phone }
          ],
          actions: `<button type="button" class="pt-btn pt-btn-primary" onclick="window.publicView.showDirections(${s.lat}, ${s.lng}, '${this.jsArg(s.name)}', '${this.jsArg(s.address)}', '${this.jsArg(s.photoUrl || '')}', 'shelter')">Directions</button>${this.popupMapsLink(s.lat, s.lng)}`
        })}
      `);

      this.shelterMarkers.push(sMarker);
      markerGroup.push([s.lat, s.lng]);
    });

    // Add Pet Pins with non-overlapping, well-spaced coordinates
    pets.forEach(p => {
      let coords = p.lastSeenCoords || petCoordinates[p.id] || [14.6400 + (Math.random() - 0.5) * 0.05, 121.0500 + (Math.random() - 0.5) * 0.05];
      if (!this.isInSelectedCommunity(p) || !this.layerFor(p)) return;

      let pinKind = 'safe';
      let statusDisplay = 'Safe';
      if (p.status === 'lost') {
        pinKind = 'missing';
        statusDisplay = 'Missing';
      } else if (p.status === 'impounded' || p.status === 'active_impounded') {
        pinKind = 'impounded';
        statusDisplay = 'Impounded';
      } else if (p.status === 'reunited') {
        pinKind = 'reunited';
        statusDisplay = 'Reunited';
      }

      const petPin = this.pinIcon({
        kind: pinKind,
        photo: p.photoUrl || window.PET_PHOTO_PLACEHOLDER,
        label: p.name,
        sub: statusDisplay
      });

      const marker = window.L.marker(coords, { icon: petPin })
        .addTo(this.map)
        .bindPopup(`
        ${this.popupCard({
          badge: statusDisplay,
          tone: p.status === 'lost' ? MAP_COLORS.missing : (p.status === 'impounded' || p.status === 'active_impounded') ? MAP_COLORS.impounded : MAP_COLORS.confirmed,
          photo: p.photoUrl || window.PET_PHOTO_PLACEHOLDER,
          title: p.name,
          subtitle: [p.breed, p.gender].filter(Boolean).join(' · '),
          rows: [
            { icon: 'pin', label: p.status === 'lost' ? 'Last seen at' : 'Location', value: p.lastSeenLocation, hint: p.lastSeenDate ? this.getTimeAgo(p.lastSeenDate) : '' }
          ],
          note: p.unregistered ? p.description : '',
          actions: `${p.status === 'lost' ? `${window.pawStore.isMyPet(p) ? `<button type="button" class="pt-btn pt-btn-primary" onclick="window.publicView.openMarkFound('${p.id}')">Mark as found</button>` : `<button type="button" class="pt-btn pt-btn-primary" onclick="window.reportManager.openSightingModal('${p.missingReportId || ''}', '${p.id}')">Seen this pet?</button>`}<button type="button" class="pt-btn pt-btn-ghost" onclick="window.publicView.showDirections(${coords[0]}, ${coords[1]}, '${this.jsArg(p.name)}', '${this.jsArg(p.lastSeenLocation || 'Metro Manila')}', '${this.jsArg(p.photoUrl)}', 'pet')">Directions</button>` : `<button type="button" class="pt-btn pt-btn-primary" onclick="window.publicView.showDirections(${coords[0]}, ${coords[1]}, '${this.jsArg(p.name)}', '${this.jsArg(p.lastSeenLocation || 'Metro Manila')}', '${this.jsArg(p.photoUrl)}', 'pet')">Directions</button>`}${this.popupMapsLink(coords[0], coords[1])}`
        })}
      `);

      marker.on('click', () => this.focusPlace(coords, p.name));
      this.petMarkers[p.id] = marker;
      markerGroup.push(coords);
    });

    // Add Community Sighting Pins (Pulsing Yellow Bubbles)
    this.sightingMarkers = [];
    const sightings = window.pawStore.getSightings();
    sightings.forEach(s => {
      if (s.status === 'dismissed' || s.status === 'archived' || !this.isInSelectedCommunity(s)) return;
      let sCoords = (s.lat && s.lng) ? [s.lat, s.lng] : [14.6360 + (Math.random() - 0.5) * 0.02, 121.0370 + (Math.random() - 0.5) * 0.02];
      const sightingPin = this.pinIcon({
        kind: s.status === 'confirmed_sighting' ? 'confirmed' : 'sighting',
        photo: s.photoUrl || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=120&q=80',
        label: s.status === 'confirmed_sighting' ? 'Confirmed sighting' : 'Possible sighting',
        sub: this.getTimeAgo(s.dateTimeSeen || s.createdAt)
      });

      const sMarker = window.L.marker(sCoords, { icon: sightingPin })
        .addTo(this.map)
        .bindPopup(`
        ${this.popupCard({
          badge: s.status === 'confirmed_sighting' ? 'Confirmed sighting' : 'Possible sighting',
          tone: s.status === 'confirmed_sighting' ? MAP_COLORS.confirmed : MAP_COLORS.sighting,
          photo: s.photoUrl,
          title: s.breed || 'Spotted pet',
          subtitle: this.getTimeAgo(s.dateTimeSeen || s.createdAt),
          rows: [
            { icon: 'pin', label: 'Location', value: s.location },
            { icon: 'clock', label: 'Date and time seen', value: this.formatSightingDate(s.dateTimeSeen || s.createdAt) },
            { icon: 'info', label: 'Status', value: s.status === 'confirmed_sighting' ? 'Confirmed by the registered guardian' : 'Awaiting owner verification' }
          ],
          note: s.comments || s.notes || '',
          actions: `<button type="button" class="pt-btn pt-btn-primary" onclick="window.publicView.showDirections(${sCoords[0]}, ${sCoords[1]}, '${this.jsArg(s.breed || 'Pet')}', '${this.jsArg(s.location)}', '${this.jsArg(s.photoUrl || '')}', 'sighting')">Directions</button>${this.popupMapsLink(sCoords[0], sCoords[1])}`
        })}
      `);

      sMarker.on('click', () => this.focusPlace(sCoords, s.location || s.breed || 'Sighting'));
      this.sightingMarkers.push({ id: s.id, marker: sMarker, data: s, coords: sCoords });
      markerGroup.push(sCoords);
    });

    // Connect sightings for the same missing report in chronological order.
    const sightingGroups = {};
    this.sightingMarkers.forEach(item => {
      const key = item.data.missing_report_id || item.data.petId;
      if (key) (sightingGroups[key] || (sightingGroups[key] = [])).push(item);
    });
    Object.values(sightingGroups).forEach(group => {
      if (group.length < 2) return;
      group.sort((a, b) => new Date(a.data.dateTimeSeen || a.data.createdAt) - new Date(b.data.dateTimeSeen || b.data.createdAt));
      window.L.polyline(group.map(item => item.coords), {
        color: '#16a34a', weight: 2, opacity: 0.75, dashArray: '7 7'
      }).addTo(this.map);
    });

    if (markerGroup.length > 0 && window.L.latLngBounds) {
      const bounds = window.L.latLngBounds(markerGroup);
      this.map.fitBounds(bounds, { padding: [40, 40] });
    }

    this.updateMapMarkers();
    this.loadLastSeenLocations();

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 250);
  }

  // "Last seen" pins for missing pets, read from the Supabase table missing_pet_last_seen
  async loadLastSeenLocations() {
    const map = this.map;
    const client = window.pawApp && window.pawApp.supabase;
    if (!map || !client || !window.L) return;

    const { data, error } = await client
      .from('missing_pet_last_seen')
      .select('*')
      .order('last_seen_at', { ascending: false });
    if (error) {
      console.warn('[Map] Could not load last seen locations:', error.message);
      return;
    }
    if (this.map !== map) return; // the map was rebuilt while the request was in flight


    this.lastSeenItems = (data || []).map(row => {
      const coords = [row.lat, row.lng];
      const ago = this.getTimeAgo(row.last_seen_at);

      const icon = this.pinIcon({
        kind: 'lastseen',
        photo: row.photo_url,
        label: row.pet_name,
        sub: `Last seen ${ago}`
      });

      const marker = window.L.marker(coords, { icon, zIndexOffset: 500 }).bindPopup(`
        ${this.popupCard({
          badge: 'Last seen here',
          tone: MAP_COLORS.lastSeen,
          photo: row.photo_url,
          title: row.pet_name,
          subtitle: `${row.species}${row.breed ? ' · ' + row.breed : ''}`,
          rows: [
            { icon: 'pin', label: 'Last seen at', value: row.last_seen_location },
            { icon: 'clock', label: 'When', value: this.formatSightingDate(row.last_seen_at), hint: ago }
          ],
          note: row.description,
          actions: `<button type="button" class="pt-btn pt-btn-primary" onclick="window.publicView.haveYouSeen('${row.id}')">Seen this pet?</button>${this.popupMapsLink(row.lat, row.lng)}`
        })}
      `);

      // Soft circle: the pet was somewhere around here, not exactly on the pin
      const area = window.L.circle(coords, {
        radius: 300, color: MAP_COLORS.lastSeen, weight: 1.5, opacity: 0.7, dashArray: '6 6', fillColor: MAP_COLORS.lastSeen, fillOpacity: 0.08
      });

      marker.on('click', () => this.focusPlace(coords, row.last_seen_location || row.pet_name));
      return { row, marker, area, coords };
    });

    this.updateFilterUI();
    this.spreadOverlapping();
  }

  // Pins at (nearly) the same place sit on top of each other and hide all but one. Pins that land within
  // PIN_GAP pixels of each other on screen are fanned out in a ring around their shared spot, with a thin
  // line back to the real location. Measured in screen pixels (Web Mercator at the current zoom), so it works
  // with Leaflet and Google Maps alike and re-runs on every zoom. Zoomed out past MIN_ZOOM the pins go back to
  // their true positions: a ring that size would be miles wide there and look like the pets are scattered.
  spreadOverlapping() {
    const map = this.map;
    if (!map || !window.L || typeof map.getZoom !== 'function') return;
    const PIN_GAP = 40;
    const MIN_ZOOM = 13;
    const scale = 256 * Math.pow(2, map.getZoom());
    const toPx = ({ lat, lng }) => {
      const sin = Math.sin(lat * Math.PI / 180);
      return { x: (lng + 180) / 360 * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
    };
    const toLatLng = ({ x, y }) => ({
      lat: 90 - 360 * Math.atan(Math.exp(((y / scale) - 0.5) * 2 * Math.PI)) / Math.PI,
      lng: x / scale * 360 - 180
    });

    const pins = [];
    const take = (marker) => {
      if (!marker || !map.hasLayer(marker)) return;
      if (!marker._trueLatLng) { const at = marker.getLatLng(); marker._trueLatLng = { lat: at.lat, lng: at.lng }; }
      pins.push(marker);
    };
    Object.values(this.petMarkers || {}).forEach(take);
    (this.sightingMarkers || []).forEach(item => take(item.marker));
    (this.lastSeenItems || []).forEach(item => take(item.marker));

    (this.spreadLayers || []).forEach(layer => map.removeLayer(layer));
    this.spreadLayers = [];

    const groups = [];
    pins.forEach(marker => {
      const px = toPx(marker._trueLatLng);
      const group = groups.find(g => Math.hypot(g.center.x - px.x, g.center.y - px.y) < PIN_GAP);
      if (group) group.pins.push(marker); else groups.push({ center: px, pins: [marker] });
    });

    // Zoomed out: pins stay on their true spots, and a stack shows how many pets are there.
    // Tapping the count zooms in far enough for the stack to fan out.
    if (map.getZoom() < MIN_ZOOM) {
      pins.forEach(marker => {
        const at = marker.getLatLng();
        if (at.lat !== marker._trueLatLng.lat || at.lng !== marker._trueLatLng.lng) marker.setLatLng(marker._trueLatLng);
      });
      // The count is of pets reported at the same spot (within about 30 m), not of every pin that happens to
      // overlap at this zoom: a pet a kilometre away can touch the stack zoomed out but is not "here"
      const SAME_SPOT_DEG = 0.0003;
      const spots = [];
      groups.forEach(({ pins: members }) => members.forEach(marker => {
        const at = marker._trueLatLng;
        const spot = spots.find(s => Math.abs(s.at.lat - at.lat) < SAME_SPOT_DEG && Math.abs(s.at.lng - at.lng) < SAME_SPOT_DEG);
        if (spot) spot.pins.push(marker); else spots.push({ at, pins: [marker] });
      }));
      spots.filter(s => s.pins.length > 1).forEach(({ pins: members }) => {
        const spot = members[0]._trueLatLng;
        const badge = window.L.marker([spot.lat, spot.lng], {
          // A 24px circle on the top-left of the 44x54 pin head (the pin's anchor is its bottom tip)
          icon: window.L.divIcon({ className: 'pin-stack-wrap', html: `<span class="pin-stack-count" title="${members.length} pets here. Tap to zoom in">${members.length}</span>`, iconSize: [24, 24], iconAnchor: [30, 62] }),
          zIndexOffset: 3000
        }).addTo(map);
        badge.on('click', () => map.setView([spot.lat, spot.lng], MIN_ZOOM + 2));
        this.spreadLayers.push(badge);
      });
      return;
    }

    groups.forEach(({ center, pins: members }) => {
      if (members.length === 1) {
        const only = members[0];
        const at = only.getLatLng();
        if (at.lat !== only._trueLatLng.lat || at.lng !== only._trueLatLng.lng) only.setLatLng(only._trueLatLng);
        return;
      }
      // Each pin carries a name label on its right (about 130px wide with the pin), so the ring is wide enough
      // that neighbours on the lower half do not cover each other's labels
      const radius = Math.max(80, (members.length * 70) / (2 * Math.PI));
      members.forEach((marker, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / members.length;
        const spot = toLatLng({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
        marker.setLatLng(spot);
        const line = window.L.polyline([[marker._trueLatLng.lat, marker._trueLatLng.lng], [spot.lat, spot.lng]], {
          color: '#64748b', weight: 1.5, opacity: 0.7, dashArray: '3 4', interactive: false
        }).addTo(map);
        this.spreadLayers.push(line);
      });
      // A small dot on the real location the fanned pins belong to
      const dot = window.L.circle([members[0]._trueLatLng.lat, members[0]._trueLatLng.lng], {
        radius: 1, color: '#64748b', weight: 2, opacity: 0.9, fillColor: '#ffffff', fillOpacity: 1, interactive: false
      }).addTo(map);
      this.spreadLayers.push(dot);
    });
  }

  // "Have you seen this pet?" on a last-seen record: open the sighting form pre-filled with that pet
  haveYouSeen(id) {
    const item = (this.lastSeenItems || []).find(i => i.row.id === id);
    if (!item || !window.reportManager) return;
    const r = item.row;
    this.map?.closePopup();
    window.reportManager.openSightingModal(null, null, {
      name: r.pet_name, breed: r.breed, photoUrl: r.photo_url,
      place: r.last_seen_location, lat: r.lat, lng: r.lng, seenAt: r.last_seen_at
    });
  }

  focusLastSeen(id) {
    const item = (this.lastSeenItems || []).find(i => i.row.id === id);
    if (!item || !this.map) return;
    if (!this.layers.lastSeen) this.toggleLayer('lastSeen');
    this.map.flyTo(item.coords, 16, { duration: 0.8 });
    setTimeout(() => item.marker.openPopup(), 850);
    document.getElementById('public-map-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Shows the last seen pins for the 'all' and 'lost' filters and for the current search; returns their coordinates
  applyLastSeenFilter() {
    const shown = [];
    (this.lastSeenItems || []).forEach(item => {
      let visible = this.layers.lastSeen;
      if (visible && this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        visible = [item.row.pet_name, item.row.breed, item.row.species, item.row.last_seen_location]
          .some(v => (v || '').toLowerCase().includes(q));
      }
      [item.marker, item.area].forEach(layer => {
        if (visible && !this.map.hasLayer(layer)) this.map.addLayer(layer);
        if (!visible && this.map.hasLayer(layer)) this.map.removeLayer(layer);
      });
      if (visible) shown.push(item.coords);
    });
    return shown;
  }

  // One pin family for every situation: a round head with a pointer, coloured by situation (the map legend names
  // each colour). Pins carry no text. Pets with a photo show it in the head; others show a small icon.
  // The anchor is the pointer tip.
  pinIcon({ kind, photo = '', title = '' }) {
    const kinds = {
      missing:   { color: MAP_COLORS.missing, pulse: true,  glyph: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>' },
      lastseen:  { color: MAP_COLORS.lastSeen, pulse: true,  glyph: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
      sighting:  { color: MAP_COLORS.sighting, pulse: false, glyph: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' },
      confirmed: { color: MAP_COLORS.confirmed, pulse: false, glyph: '<path d="M20 6 9 17l-5-5"/>' },
      impounded: { color: MAP_COLORS.impounded, pulse: false, glyph: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>' },
      safe:      { color: '#16a34a', pulse: false, glyph: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>' },
      reunited:  { color: '#16a34a', pulse: false, glyph: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>' },
      shelter:   { color: MAP_COLORS.shelter, pulse: false, glyph: '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/>' }
    };
    const k = kinds[kind] || kinds.safe;
    const e = (v) => this.escapeHtml(String(v ?? ''));
    const svg = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${k.glyph}</svg>`;

    const html = `
      <div class="pt-pin pt-pin--${kind}" style="--pin:${k.color};"${title ? ` title="${e(title)}" aria-label="${e(title)}"` : ''}>
        ${k.pulse ? '<span class="pt-pin-pulse"></span>' : ''}
        <span class="pt-pin-head">${photo ? `<img src="${e(photo)}" alt="" onerror="this.remove()" />` : svg(20)}</span>
      </div>
    `;
    return window.L.divIcon({
      className: 'custom-map-icon-wrap',
      html,
      iconSize: [44, 54],
      iconAnchor: [22, 54]
    });
  }

  // Shared look for every map popup: photo header with a status badge, key facts with icons, action buttons
  popupCard({ badge, tone = MAP_COLORS.missing, photo = '', placeholderIcon = 'paw', title, subtitle = '', rows = [], note = '', actions = '' }) {
    const e = (v) => this.escapeHtml(String(v ?? ''));
    const icons = {
      pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
      clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
      chip: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
      phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
      info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
      paw: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="4" cy="8" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.8 1.2c-.5-1.5-1.8-2.2-3.2-2.7a3 3 0 0 1-.7-5.3A5 5 0 0 1 9 10z"/>',
      building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>'
    };
    const svg = (name) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;

    const hero = photo
      ? `<img class="pt-card-hero-bg" src="${e(photo)}" alt="" aria-hidden="true" onerror="this.remove()" /><img class="pt-card-hero-img" src="${e(photo)}" alt="${e(title)}" onerror="this.remove()" />`
      : `<span class="pt-card-hero-icon">${svg(placeholderIcon).replace('width="15" height="15"', 'width="38" height="38"')}</span>`;
    const rowsHtml = rows.filter(r => r && r.value).map(r => `
      <li>
        <span class="pt-card-ico">${svg(r.icon)}</span>
        <span class="pt-card-row-text"><small>${e(r.label)}</small><strong${r.mono ? ' class="pt-mono"' : ''}>${e(r.value)}</strong>${r.hint ? `<em>${e(r.hint)}</em>` : ''}</span>
      </li>`).join('');

    return `
      <div class="pt-card" style="--tone:${tone};">
        <div class="pt-card-hero${photo ? ' is-zoomable' : ''}"${photo ? ` role="button" tabindex="0" title="View full photo" aria-label="View full photo of ${e(title)}" onclick="window.pawApp.openLightbox('${this.jsArg(photo)}', '${this.jsArg(title)}', '${this.jsArg(subtitle)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}"` : ''}>${hero}${photo ? '<span class="pt-card-zoom" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></span>' : ''}<span class="pt-card-badge">${e(badge)}</span></div>
        <div class="pt-card-body">
          <h4 class="pt-card-title">${e(title)}</h4>
          ${subtitle ? `<div class="pt-card-sub">${e(subtitle)}</div>` : ''}
          ${rowsHtml ? `<ul class="pt-card-rows">${rowsHtml}</ul>` : ''}
          ${note ? `<div class="pt-card-note">${e(note)}</div>` : ''}
          <div class="pt-card-actions">${actions}</div>
        </div>
      </div>
    `;
  }

  popupMapsLink(lat, lng) {
    return `<a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener" class="pt-btn pt-btn-icon" title="Open in Google Maps" aria-label="Open in Google Maps"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>`;
  }

  jsArg(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  getTimeAgo(value) {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(value || Date.now()).getTime()) / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
  }

  setMapLayer(type, notify = true) {
    if (!this.map || !window.L) return;
    this.currentMapType = type;

    // The dock offers only the opposite of the app theme; if the theme flips onto the chosen style, go back to the plain map
    if (!this._themeWatch) {
      this._themeWatch = new MutationObserver(() => {
        const light = document.documentElement.getAttribute('data-theme') === 'light';
        if ((light && this.currentMapType === 'light') || (!light && this.currentMapType === 'dark')) {
          this.setMapLayer('roadmap', false);
        }
      });
      this._themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    // Remove previous active tile layer
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    let tileUrl;
    let tileOptions = {
      maxZoom: 20,
      attribution: '&copy; Google Maps / OpenStreetMap contributors'
    };

    if (type === 'satellite') {
      // High-resolution Photographic Earth Imagery (Actual real place view)
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      tileOptions.attribution = '&copy; Esri World Imagery & Maxar Earth';
    } else if (type === 'hybrid') {
      // Real Satellite with Street Names & Border Overlays
      tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      tileOptions.attribution = '&copy; Google Maps Hybrid Imagery';
    } else if (type === 'dark') {
      // Night / Dark Roast Mode
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      tileOptions.attribution = '&copy; CARTO & OpenStreetMap';
    } else if (type === 'light') {
      // Light street map, offered while the app itself is in dark mode
      tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      tileOptions.attribution = '&copy; CARTO & OpenStreetMap';
    } else {
      // Default: Google Roadmap with business/landmark labels hidden (apistyle s.t:2 = POI) for a calmer map
      tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&apistyle=s.t%3A2%7Cp.v%3Aoff';
      tileOptions.attribution = '&copy; Google Maps';
    }

    this.currentTileLayer = window.L.tileLayer(tileUrl, tileOptions);
    this.currentTileLayer.on('tileerror', () => {
      // Safe fallback to CARTO Voyager if provider tile errors
      if (this.currentMapType !== 'fallback') {
        this.currentMapType = 'fallback';
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap & CARTO',
          maxZoom: 19
        }).addTo(this.map);
      }
    });

    this.currentTileLayer.addTo(this.map);

    // Update active button state on layer dock
    const dock = document.getElementById('gmap-layer-dock');
    if (dock) {
      dock.querySelectorAll('.gmap-layer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${type}'`));
      });
    }

    if (notify && window.notifManager) {
      const label = type === 'satellite' ? 'Actual Aerial Satellite View' : type === 'hybrid' ? 'Hybrid Street Imagery' : type === 'dark' ? 'Dark Theme' : type === 'light' ? 'Light Theme' : 'Google Roadmap';
      window.notifManager.showToast(`Switched map layer to ${label}`, 'info', 2000);
    }
  }

  // Asks the browser for the user's position when they tap Directions (free; the browser prompts once)
  getUserPosition() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve([pos.coords.latitude, pos.coords.longitude]),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  // Road route from the Google Routes library (one billed request per origin, destination and mode; repeats are cached).
  // Without Google Maps, or when the request fails, falls back to a straight line with a rough estimate.
  async fetchRoute(origin, dest, travelMode) {
    const language = window.pawI18n && window.pawI18n.getLang() === 'fil' ? 'fil' : 'en';
    const key = [origin[0].toFixed(4), origin[1].toFixed(4), dest[0].toFixed(5), dest[1].toFixed(5), travelMode, language].join('|');
    this.routeCache = this.routeCache || new Map();
    if (this.routeCache.has(key)) return this.routeCache.get(key);

    let result = null;
    if (window.google && window.google.maps && document.documentElement.classList.contains('google-maps-active')) {
      try {
        const { Route } = await google.maps.importLibrary('routes');
        const { routes } = await Route.computeRoutes({
          origin: { lat: origin[0], lng: origin[1] },
          destination: { lat: dest[0], lng: dest[1] },
          travelMode: { drive: 'DRIVING', walk: 'WALKING', transit: 'TRANSIT' }[travelMode] || 'DRIVING',
          language,
          fields: ['path', 'distanceMeters', 'durationMillis', 'legs']
        });
        const r = routes && routes[0];
        if (r && r.path && r.path.length > 1) {
          result = {
            path: r.path.map(p => [p.lat, p.lng]),
            distanceKm: r.distanceMeters / 1000,
            durationMin: Math.max(1, Math.round(r.durationMillis / 60000)),
            approximate: false,
            // Maneuvers for turn-by-turn: "instructions" says what to do at the START of each step
            steps: (r.legs || []).flatMap(leg => leg.steps || [])
              .filter(st => st.startLocation && st.endLocation)
              .map(st => ({
                text: String(st.instructions || '').split(/\r?\n/)[0].trim(), // extra lines are pass-by notes
                maneuver: st.maneuver || '',
                dist: st.distanceMeters || 0,
                start: [st.startLocation.lat, st.startLocation.lng],
                end: [st.endLocation.lat, st.endLocation.lng]
              }))
          };
        }
      } catch (err) {
        console.warn('[Directions] Routes request failed, showing a straight line instead:', err.message);
      }
    }

    if (!result) {
      const km = this.calculateDistance(origin[0], origin[1], dest[0], dest[1]);
      const kmh = { drive: 30, transit: 20, walk: 4.5 }[travelMode] || 30;
      return { path: [origin, dest], distanceKm: km, durationMin: Math.max(1, Math.round(km / kmh * 60)), approximate: true, steps: [] };
    }
    this.routeCache.set(key, result);
    return result;
  }

  // Draws (or redraws) the route line and frames it on the map
  drawRoute(route, travelMode) {
    if (this.routePolyline) this.map.removeLayer(this.routePolyline);
    if (this.routeGlowLine) this.map.removeLayer(this.routeGlowLine);

    this.routeGlowLine = window.L.polyline(route.path, {
      color: '#1e40af',
      weight: 8,
      opacity: 0.5,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    this.routePolyline = window.L.polyline(route.path, {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: travelMode === 'walk' || route.approximate ? '4, 8' : null
    }).addTo(this.map);

    if (!this.navigator.running) this.map.fitBounds(this.routePolyline.getBounds(), { padding: [60, 60], maxZoom: 16 });
  }

  // Start button: follow the guardian's live position and speak each turn
  startNavigation() {
    const a = this.activeRoute;
    if (!a || !a.route) return;
    this.navigator.start(a.route, { destLat: a.destLat, destLng: a.destLng, destName: a.destName, travelMode: a.travelMode });
  }

  formatDuration(min) {
    return min >= 60 ? `${Math.floor(min / 60)} hr ${min % 60} min` : `${min} min`;
  }

  // Directions open in Google Maps, which routes from the person's current location
  showDirections(destLat, destLng, destName, destAddress, destPhotoUrl, destType = 'shelter', travelMode = 'drive') {
    const lat = Number(destLat);
    const lng = Number(destLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (window.notifManager) window.notifManager.showToast('This place has no map position yet.', 'warning', 3500);
      return;
    }
    const mode = { drive: 'driving', walk: 'walking', transit: 'transit', bike: 'bicycling' }[travelMode] || 'driving';
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${mode}`, '_blank', 'noopener');
  }

  // The in-app route preview (no longer reached from the Directions buttons)
  async showRouteInApp(destLat, destLng, destName, destAddress, destPhotoUrl, destType = 'shelter', travelMode = 'drive') {
    if (!this.map || !window.L) return;

    const requestId = (this.routeRequestId = (this.routeRequestId || 0) + 1);
    this.navigator.stop();
    if (window.notifManager) window.notifManager.showToast('Getting your location…', 'info', 2000);

    const origin = await this.getUserPosition();
    if (requestId !== this.routeRequestId || !this.map) return; // a newer request replaced this one
    if (!origin) {
      if (window.notifManager) window.notifManager.showToast('Location access is needed for directions. Allow it in your browser and try again.', 'warning', 5000);
      return;
    }
    this.userLocation = origin;

    const route = await this.fetchRoute(origin, [destLat, destLng], travelMode);
    if (requestId !== this.routeRequestId || !this.map) return;

    this.activeRoute = {
      destLat,
      destLng,
      destName,
      destAddress: destAddress || 'Metro Manila, Philippines',
      destPhotoUrl: destPhotoUrl || (destType === 'shelter' ? 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=600&q=80' : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80'),
      destType,
      travelMode,
      route
    };

    const [startLat, startLng] = origin;
    const activeEta = this.formatDuration(route.durationMin);
    const activeDistance = route.distanceKm.toFixed(1) + ' km';

    if (this.startMarker) this.map.removeLayer(this.startMarker);
    this.drawRoute(route, travelMode);

    // Place Start Point pulsing marker
    const startIcon = window.L.divIcon({
      className: 'custom-map-icon-wrap',
      html: `
        <div style="position:relative; transform:translate(-50%, -50%); display:flex; align-items:center; justify-content:center;">
          <div style="width:28px; height:28px; border-radius:50%; background:rgba(59, 130, 246, 0.3); animation:pulse-dot 1.8s infinite;"></div>
          <div style="position:absolute; width:14px; height:14px; border-radius:50%; background:#2563eb; border:2.5px solid #ffffff; box-shadow:0 0 10px rgba(37, 99, 235, 0.8);"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });

    this.startMarker = window.L.marker([startLat, startLng], { icon: startIcon })
      .addTo(this.map)
      .bindPopup('<strong>Your Location</strong>');

    // Hands the same trip to the Google Maps app/site, where turn-by-turn navigation can be started
    const gmMode = { drive: 'driving', transit: 'transit', walk: 'walking' }[travelMode] || 'driving';
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${destLat},${destLng}&travelmode=${gmMode}&dir_action=navigate`;

    // In-app guidance needs real road steps (driving and walking); straight-line estimates and transit open Google Maps instead
    const canNavigate = !route.approximate && travelMode !== 'transit' && route.steps && route.steps.length > 0;

    const modeTab = (mode, label) => `
      <button type="button" class="gmap-mode-tab ${travelMode === mode ? 'active' : ''}" onclick="window.publicView.showRouteInApp(${destLat}, ${destLng}, '${this.jsArg(destName)}', '${this.jsArg(destAddress)}', '${this.jsArg(this.activeRoute.destPhotoUrl)}', '${destType}', '${mode}')">
        <span style="font-size:11px; font-weight:700;">${label}</span>
        ${travelMode === mode ? `<span style="font-size:10px; opacity:0.8;">${route.durationMin}m</span>` : ''}
      </button>`;

    const hudContainer = document.getElementById('gmap-directions-hud-container');
    if (hudContainer) {
      hudContainer.innerHTML = `
        <div class="gmap-nav-drawer" id="gmap-nav-drawer">
          <!-- Header -->
          <div class="gmap-nav-header">
            <div style="min-width:0;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                <span style="font-size:10.5px; font-weight:700; color:var(--primary); text-transform:uppercase; background:rgba(234,157,30,0.15); padding:2px 6px; border-radius:4px;">
                  ${destType === 'shelter' ? 'Official Animal Facility' : destType === 'sighting' ? 'Community Sighting' : 'Missing Pet Landmark'}
                </span>
              </div>
              <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${this.escapeHtml(destName)}
              </h3>
              <div style="font-size:0.78rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">
                ${this.escapeHtml(this.activeRoute.destAddress)}
              </div>
            </div>
            <button type="button" class="modal-close-squircle-btn" onclick="window.publicView.closeDirections()" style="width:28px; height:28px; min-width:28px; min-height:28px; border-radius:8px;" title="Close Directions">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="gmap-nav-body">
            <!-- Actual Real-World Place Photo Preview Card -->
            <div class="gmap-place-card">
              <img src="${this.escapeHtml(this.activeRoute.destPhotoUrl)}" class="gmap-place-img" alt="${this.escapeHtml(destName)}" onerror="this.src='https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=600&q=80'" />
              <div class="gmap-place-overlay">
                <span style="color:#ffffff; font-size:11px; font-weight:700; text-shadow:0 1px 4px rgba(0,0,0,0.8);">
                  Actual Place View
                </span>
                <button type="button" class="btn btn-primary btn-sm" style="padding:3px 8px; font-size:10.5px;" onclick="window.publicView.openStreetView(${destLat}, ${destLng})">
                  Street View 360° ↗
                </button>
              </div>
            </div>

            <!-- Travel Modes Switcher Bar -->
            <div class="gmap-modes-bar">
              ${modeTab('drive', 'Drive')}
              ${modeTab('transit', 'Transit')}
              ${modeTab('walk', 'Walk')}
            </div>

            <!-- ETA and Distance Summary Badge -->
            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(37,99,235,0.12); border:1px solid rgba(59,130,246,0.3); padding:8px 12px; border-radius:10px;">
              <div>
                <div style="font-size:1.15rem; font-weight:800; color:#38bdf8;">${activeEta}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${activeDistance} from your location${route.approximate ? ' (straight line, estimate only)' : ''}</div>
              </div>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.publicView.setMapLayer('satellite')" style="font-size:10.5px; padding:4px 8px;" title="Switch map to actual satellite photos">
                Satellite View
              </button>
            </div>

            <!-- Action Buttons -->
            <div class="gmap-nav-actions">
              ${canNavigate
                ? `<button type="button" class="btn btn-primary tbt-start-btn" onclick="window.publicView.startNavigation()">
                     <i data-lucide="navigation"></i><span>Start</span>
                   </button>
                   <a href="${mapsUrl}" target="_blank" rel="noopener" class="tbt-alt-link">Open in Google Maps ↗</a>`
                : `<a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-primary" style="width:100%; justify-content:center; text-decoration:none; box-shadow:0 4px 14px rgba(234,157,30,0.4);">
                     <span>Follow this route in Google Maps ↗</span>
                   </a>`}
              <button type="button" class="btn btn-outline btn-sm" onclick="window.publicView.closeDirections()" style="width:100%; justify-content:center;">
                Exit Navigation
              </button>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ root: hudContainer });
    }
  }

  closeDirections() {
    this.navigator.stop();
    this.routeRequestId = (this.routeRequestId || 0) + 1;
    if (this.routePolyline && this.map) this.map.removeLayer(this.routePolyline);
    if (this.routeGlowLine && this.map) this.map.removeLayer(this.routeGlowLine);
    if (this.startMarker && this.map) this.map.removeLayer(this.startMarker);

    this.routePolyline = null;
    this.routeGlowLine = null;
    this.startMarker = null;
    this.activeRoute = null;

    const hudContainer = document.getElementById('gmap-directions-hud-container');
    if (hudContainer) hudContainer.innerHTML = '';

    this.fitAllIncidents();
  }

  openStreetView(lat, lng) {
    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    window.open(url, '_blank');
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  locateMe() {
    if (!this.map) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.userLocation = [pos.coords.latitude, pos.coords.longitude];
          this.map.flyTo(this.userLocation, 15, { duration: 1 });
          if (window.notifManager) {
            window.notifManager.showToast('GPS Location acquired. Centered on map.', 'success', 2500);
          }
        },
        () => {
          this.map.flyTo(this.userLocation, 14, { duration: 1 });
          if (window.notifManager) {
            window.notifManager.showToast('Centered on Metro Manila Command Station.', 'info', 2500);
          }
        },
        { timeout: 5000 }
      );
    } else {
      this.map.flyTo(this.userLocation, 14, { duration: 1 });
    }
  }

  fitAllIncidents() {
    if (!this.map || !window.L) return;
    const visibleCoords = [];

    const pets = window.pawStore.getMapPets();
    pets.forEach(p => {
      const marker = this.petMarkers[p.id];
      if (marker && this.map.hasLayer(marker)) {
        visibleCoords.push(marker.getLatLng());
      }
    });

    if (this.sightingMarkers) {
      this.sightingMarkers.forEach(s => {
        if (s.marker && this.map.hasLayer(s.marker)) {
          visibleCoords.push(s.marker.getLatLng());
        }
      });
    }

    const shelters = window.pawStore.getShelters();
    shelters.forEach(s => {
      visibleCoords.push([s.lat, s.lng]);
    });

    if (visibleCoords.length > 0 && window.L.latLngBounds) {
      const bounds = window.L.latLngBounds(visibleCoords);
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }

  // "Mark as found" for the guardian's own missing pet: confirm, then take it off the missing map
  openMarkFound(petId) {
    const pet = window.pawStore.getMapPets().find(p => String(p.id) === String(petId));
    if (!pet || !window.pawStore.isMyPet(pet)) return;
    this.map?.closePopup();
    let modal = document.getElementById('mark-found-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'mark-found-modal';
      modal.addEventListener('mousedown', (e) => { if (e.target === modal) window.notifManager.closeModal('mark-found-modal'); });
      document.body.appendChild(modal);
    }
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const seen = pet.lastSeenDate ? this.getTimeAgo(pet.lastSeenDate) : '';
    modal.innerHTML = `
      <div class="modal-box mark-found-box" role="dialog" aria-modal="true" aria-labelledby="mark-found-title">
        <div class="modal-header">
          <h3 id="mark-found-title">Mark as found</h3>
          <button type="button" class="btn-outline btn-sm" onclick="window.notifManager.closeModal('mark-found-modal')" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body mark-found-body">
          <div class="mark-found-pet">
            <img src="${esc(pet.photoUrl || window.PET_PHOTO_PLACEHOLDER)}" alt="" />
            <div>
              <strong>${esc(pet.name)}</strong>
              <span>${esc([pet.unregistered && pet.description ? pet.description : pet.breed, pet.unregistered ? 'Not registered' : pet.gender].filter(Boolean).join(' · '))}</span>
              <span class="mark-found-seen"><i data-lucide="map-pin"></i>${esc(pet.lastSeenLocation || 'Last seen location not set')}${seen ? ` · ${esc(seen)}` : ''}</span>
            </div>
          </div>
          <p class="mark-found-question">${pet.unregistered && !pet.reportedByOwner ? `Is ${esc(pet.name)} found and safe?` : `Is ${esc(pet.name)} back home and safe?`}</p>
          <ul class="mark-found-effects">
            <li><i data-lucide="map-pin-off"></i><span>The missing alert comes off the map and the missing list.</span></li>
            <li><i data-lucide="check-circle-2"></i><span>The report is closed, so finders stop sending sightings.</span></li>
          </ul>
        </div>
        <div class="modal-footer mark-found-footer">
          <button type="button" class="btn btn-outline" onclick="window.notifManager.closeModal('mark-found-modal')">Not yet</button>
          <button type="button" class="btn btn-primary" id="mark-found-confirm" onclick="window.publicView.markFound('${esc(pet.id)}')"><i data-lucide="check"></i> Yes, mark as found</button>
        </div>
      </div>`;
    window.notifManager.openModal('mark-found-modal');
  }

  async markFound(petId) {
    const store = window.pawStore;
    const pet = store.getMapPets().find(p => String(p.id) === String(petId));
    if (!pet || !store.isMyPet(pet)) return;
    const btn = document.getElementById('mark-found-confirm');
    if (btn) btn.disabled = true;

    if (pet.unregistered) {
      // Exists only as its report: closing the report takes it off the map
      store.updateMissingReport(pet.missingReportId, { status: 'resolved', resolvedAt: new Date().toISOString() });
      store.resolveCasesForPet(pet.id, { missingReportId: pet.missingReportId });
    } else {
      // Registered pet: save the status where its tag page reads it, then on this device
      // (updatePetStatus also closes its cases and missing reports)
      const client = window.pawApp && window.pawApp.supabase;
      if (client && /^[0-9a-f-]{36}$/i.test(pet.id)) {
        const { error } = await client.from('registered_pets').update({ status: 'safe' }).eq('id', pet.id);
        if (error) {
          if (btn) btn.disabled = false;
          window.notifManager.showToast(`Could not mark ${pet.name} as found: ${error.message}`, 'error', 5000);
          return;
        }
      }
      store.updatePetStatus(pet.id, 'safe');
    }

    window.notifManager.closeModal('mark-found-modal');
    window.notifManager.showToast(`${pet.name} is marked as found. Glad they are home.`, 'success', 4000);
    if (this.currentFilter === 'mine' && !store.getMapPets().some(p => store.isMyPet(p) && ['missing', 'impounded'].includes(this.layerFor(p)))) {
      this.setFilter('all'); // nothing of yours is left to show
    }
    const viewport = document.getElementById('app-viewport');
    const view = window.pawApp && window.pawApp.views[window.pawApp.currentView];
    if (view && viewport) view.render(viewport);
  }

  focusPetOnMap(petId) {
    if (this.petMarkers && this.petMarkers[petId] && this.map) {
      const marker = this.petMarkers[petId];
      if (!this.map.hasLayer(marker)) {
        this.map.addLayer(marker);
      }
      this.map.setView(marker.getLatLng(), 15);
      marker.openPopup();
    }
  }

  focusCoordsOnMap(lat, lng, title) {
    if (this.map) {
      this.map.setView([lat, lng], 15);
      if (window.notifManager && title) {
        window.notifManager.showToast(`Focused on ${title}`, 'info', 1800);
      }
    }
  }

  layerFor(pet) {
    if (pet.status === 'lost') return 'missing';
    if (pet.status === 'impounded' || pet.status === 'active_impounded') return 'impounded';
    return null; // safe and reunited pets are not on the map or in its list (reunions are on the Sightings page)
  }

  layerCounts() {
    const pets = window.pawStore.getMapPets();
    const countBy = (key) => pets.filter(p => this.layerFor(p) === key).length;
    return {
      missing: countBy('missing'),
      lastSeen: (this.lastSeenItems || []).length,
      sightings: window.pawStore.getSightings().filter(x => x.status !== 'dismissed' && x.status !== 'archived').length,
      impounded: countBy('impounded'),
      shelters: window.pawStore.getShelters().length
    };
  }

  renderLayersPanel() {
    const counts = this.layerCounts();
    const active = MAP_LAYER_DEFS.filter(d => this.layers[d.key]).length;
    const rows = MAP_LAYER_DEFS.map(d => `
      <label class="map-layer-row">
        <input type="checkbox" ${this.layers[d.key] ? 'checked' : ''} onchange="window.publicView.toggleLayer('${d.key}')" />
        <span class="map-layer-swatch" style="--swatch:${d.color};"></span>
        <span class="map-layer-name">${d.label}</span>
        <span class="map-layer-count">${counts[d.key]}</span>
      </label>
    `).join('');

    return `
      <button type="button" class="map-layers-toggle" onclick="window.publicView.toggleLayersPanel()" aria-expanded="${this.layersPanelOpen}" aria-controls="map-layers-body">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
        <span>Layers</span>
        <span class="map-layers-badge">${active}/${MAP_LAYER_DEFS.length}</span>
      </button>
      <div class="map-layers-body" id="map-layers-body" ${this.layersPanelOpen ? '' : 'hidden'}>
        ${rows}
        <div class="map-layers-actions">
          <button type="button" onclick="window.publicView.setFilter('all')">Show all</button>
          <button type="button" onclick="window.publicView.setFilter('lost')">Missing only</button>
          <button type="button" onclick="window.publicView.setFilter('lastseen')">Last seen only</button>
        </div>
      </div>
    `;
  }

  toggleLayersPanel() {
    this.layersPanelOpen = !this.layersPanelOpen;
    this.refreshLayersPanel();
  }

  refreshLayersPanel() {
    const el = document.getElementById('map-layers');
    if (el) el.innerHTML = this.renderLayersPanel();
  }

  // One layer on or off; the quick filter highlights a preset only while the layers still match it
  toggleLayer(key) {
    this.layers[key] = !this.layers[key];
    const same = (a, b) => Object.keys(a).every(k => a[k] === b[k]);
    this.currentFilter = Object.keys(MAP_LAYER_PRESETS).filter(name => name !== 'mine' || this.mineOnly).find(name => same(this.layers, MAP_LAYER_PRESETS[name])) || 'custom';
    this.updateFilterUI(false);
  }

  setFilter(filter) {
    this.focusPoint = null;
    this.currentFilter = filter;
    this.mineOnly = filter === 'mine';
    this.layers = { ...(MAP_LAYER_PRESETS[filter] || MAP_LAYER_PRESETS.all) };
    this.updateFilterUI();
  }

  handleSearch(query) {
    this.focusPoint = null;
    this.searchQuery = query;
    this.updateFilterUI();
  }

  updateFilterUI(fit = true) {
    const btnGroup = document.getElementById('public-filter-btn-group');
    if (btnGroup) {
      btnGroup.innerHTML = this.renderFilterButtons();
    }

    const listElem = document.getElementById('public-pets-list');
    if (listElem) {
      listElem.innerHTML = this.renderFilteredList(window.pawStore.getMapPets());
      if (window.lucide) window.lucide.createIcons({ root: listElem });
    }

    this.refreshLayersPanel();
    this.updateMapMarkers(fit);
  }

  updateMapMarkers(fit = true) {
    if (!this.map || !this.petMarkers) return;
    const pets = window.pawStore.getMapPets();
    const visibleCoords = [];

    // Filter pet markers
    pets.forEach(p => {
      const marker = this.petMarkers[p.id];
      if (!marker) return;

      let isMatch = this.layers[this.layerFor(p)];
      if (isMatch && this.mineOnly) isMatch = window.pawStore.isMyPet(p);

      if (isMatch && this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchBreed = (p.breed || '').toLowerCase().includes(q);
        isMatch = matchName || matchBreed;
      }

      if (isMatch) {
        if (!this.map.hasLayer(marker)) {
          this.map.addLayer(marker);
        }
        visibleCoords.push(marker.getLatLng());
      } else {
        if (this.map.hasLayer(marker)) {
          this.map.removeLayer(marker);
        }
      }
    });

    // Filter community sighting markers
    if (this.sightingMarkers) {
      this.sightingMarkers.forEach(sItem => {
        let isMatch = this.layers.sightings;
        if (isMatch && this.searchQuery) {
          const q = this.searchQuery.toLowerCase();
          const matchBreed = (sItem.data.breed || '').toLowerCase().includes(q);
          const matchLoc = (sItem.data.location || '').toLowerCase().includes(q);
          isMatch = matchBreed || matchLoc;
        }

        if (isMatch) {
          if (!this.map.hasLayer(sItem.marker)) {
            this.map.addLayer(sItem.marker);
          }
          visibleCoords.push(sItem.marker.getLatLng());
        } else {
          if (this.map.hasLayer(sItem.marker)) {
            this.map.removeLayer(sItem.marker);
          }
        }
      });
    }

    visibleCoords.push(...this.applyLastSeenFilter());

    (this.shelterMarkers || []).forEach(marker => {
      const onMap = this.map.hasLayer(marker);
      if (this.layers.shelters && !onMap) this.map.addLayer(marker);
      if (!this.layers.shelters && onMap) this.map.removeLayer(marker);
      if (this.layers.shelters) visibleCoords.push(marker.getLatLng());
    });

    if (fit && visibleCoords.length > 0 && window.L.latLngBounds) {
      try {
        const bounds = window.L.latLngBounds(visibleCoords);
        this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch (e) {}
    }
    this.spreadOverlapping();
  }

  // =========================================================
  // AI PHOTO SEARCH (one Gemini call per search, local ranking)
  // =========================================================
  openPhotoMatchModal() {
    this.photoMatchImage = null;
    const preview = document.getElementById('photo-match-preview');
    const placeholder = document.getElementById('photo-match-placeholder');
    const results = document.getElementById('photo-match-results');
    const input = document.getElementById('photo-match-input');
    const runBtn = document.getElementById('photo-match-run-btn');
    if (preview) { preview.style.display = 'none'; preview.removeAttribute('src'); }
    if (placeholder) placeholder.style.display = '';
    if (results) results.innerHTML = '';
    if (input) input.value = '';
    if (runBtn) runBtn.disabled = true;
    window.notifManager.openModal('photo-match-modal');
  }

  handlePhotoMatchFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale before upload: smaller payload and fewer AI tokens per search
        const maxSide = 768;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        this.photoMatchImage = canvas.toDataURL('image/jpeg', 0.85);

        const preview = document.getElementById('photo-match-preview');
        const placeholder = document.getElementById('photo-match-placeholder');
        const results = document.getElementById('photo-match-results');
        const runBtn = document.getElementById('photo-match-run-btn');
        if (preview) { preview.src = this.photoMatchImage; preview.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
        if (results) results.innerHTML = '';
        if (runBtn) runBtn.disabled = false;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  async runPhotoMatch() {
    const results = document.getElementById('photo-match-results');
    const runBtn = document.getElementById('photo-match-run-btn');
    if (!this.photoMatchImage || !results) return;

    if (runBtn) runBtn.disabled = true;
    results.innerHTML = `<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:12px;">Analyzing photo...</div>`;

    try {
      const cfg = window.PAWTRACK_SUPABASE;
      const response = await fetch(`${cfg.url}/functions/v1/photo-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.publishableKey },
        body: JSON.stringify({ image: this.photoMatchImage })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);

      results.innerHTML = this.renderPhotoMatchResults(data.traits || {});
      if (window.lucide) window.lucide.createIcons({ root: results });
    } catch (err) {
      results.innerHTML = `<div style="font-size:13px; color:#ba3820; text-align:center; padding:12px;">Photo search failed: ${this.escapeHtml(err.message)}</div>`;
    } finally {
      if (runBtn) runBtn.disabled = false;
    }
  }

  renderPhotoMatchResults(traits) {
    if (traits.isPet === false) {
      return `<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:12px;">No pet was detected in this photo. Try a clearer photo of the animal.</div>`;
    }

    // Map the AI traits onto the sighting shape that runAiPetMatch() already scores
    const colors = (traits.colors || []).join(' ');
    const sighting = {
      species: traits.species && traits.species !== 'Unknown' ? traits.species : '',
      breed: traits.breed && traits.breed !== 'Unknown' ? traits.breed : '',
      color: [colors, traits.coatPattern || ''].join(' ').trim(),
      distinctMarkings: traits.distinctMarkings || '',
      comments: `${colors} ${traits.distinctMarkings || ''}`.trim()
    };
    const missingPets = window.pawStore.getMapPets().filter(p => p.status === 'lost');
    const matches = window.pawStore.runAiPetMatch(sighting, missingPets).slice(0, 5);
    const checkedLabel = `${missingPets.length} missing pet${missingPets.length === 1 ? '' : 's'}`;

    const summary = `
      <div style="background:var(--bg-surface, #23130a); border:1px solid var(--border-subtle, rgba(234, 157, 30, 0.2)); border-radius:10px; padding:10px 12px; font-size:12px; margin-bottom:10px;">
        <div style="font-weight:700; color:var(--text-main); margin-bottom:4px;">AI reading of your photo</div>
        <div style="color:var(--text-muted);">${this.escapeHtml(traits.summary || '')}</div>
        <div style="color:var(--text-muted); margin-top:4px;">
          <strong>${this.escapeHtml(traits.species || 'Unknown')}</strong> · ${this.escapeHtml(traits.breed || 'Unknown breed')} · ${this.escapeHtml((traits.colors || []).join(', ') || 'unknown colors')}
        </div>
      </div>
    `;

    if (matches.length === 0) {
      return summary + `<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:12px;">No missing pets look similar to this photo right now (${checkedLabel} checked).</div>`;
    }

    return summary + `
      <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">Top matches out of ${checkedLabel}:</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${matches.map(m => {
          const pet = m.pet;
          const scoreColor = m.confidenceScore >= 75 ? '#16a34a' : m.confidenceScore >= 55 ? '#ea9d1e' : '#ba3820';
          return `
            <div class="glass-card" style="padding:0.7rem; display:flex; gap:0.75rem; align-items:center; cursor:pointer;" onclick="window.notifManager.closeModal('photo-match-modal'); window.publicView.focusPetOnMap('${pet.id}')">
              <img src="${pet.photoUrl || window.PET_PHOTO_PLACEHOLDER}" style="width:52px; height:52px; border-radius:var(--radius-md); object-fit:cover; flex-shrink:0;" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80'" />
              <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:0.92rem;">${this.escapeHtml(pet.name || 'Unnamed pet')}</div>
                <div style="font-size:0.76rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(pet.breed || '')} · ${this.escapeHtml(pet.color || '')}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">Last seen: ${this.escapeHtml(pet.lastSeenLocation || 'Unknown')}</div>
              </div>
              <div style="font-weight:800; font-size:1.05rem; color:${scoreColor}; flex-shrink:0;">${m.confidenceScore}%</div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">Tap a match to view it on the map. Scores are estimates; always confirm with the owner.</div>
    `;
  }

  escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  openFoundPetModal() {
    if (window.reportManager) {
      window.reportManager.openReportModal('found');
    } else {
      const modal = document.getElementById('found-pet-modal');
      if (modal) modal.classList.add('active');
    }
  }
}

window.publicView = new PublicView();
