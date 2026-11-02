/**
 * PawTrack Admin — Complete Heatmap Analysis & Lost Pet Cluster Intelligence Dashboard
 * Full Panoramic Google Maps GIS Telemetry, KPI Summary Cards, Multi-filter Toolbars,
 * Hotspot Rankings, Reports Over Time Chart, Sector Metrics Strip, and Incident Locations Table with Fly-to-Location.
 */

window.HeatmapView = {
  mapInstance: null,
  heatLayer: null,
  markersLayer: null,
  tileLayerInstance: null,

  // State filters
  selectedDateRange: 'all', // 'all' | 'today' | '7d' | '30d' | 'custom'
  selectedLayer: 'roadmap', // 'roadmap' | 'satellite' | 'terrain'
  selectedAnimal: 'all', // 'all' | 'dog' | 'cat' | 'other'
  selectedStatus: 'all', // 'all' | 'lost' | 'sighting' | 'found' | 'impounded'
  selectedDistrict: 'all', // 'all' | 'District 1' | 'District 2' | ...
  searchQuery: '',
  sortBy: 'date', // 'date' | 'name' | 'location' | 'status'
  currentPage: 1,
  pageSize: 8,
  searchLocationMarker: null,
  showHeat: true,
  showPins: true,
  gMarkerById: {},
  _noFitUntil: 0,
  _fitKey: '',

  // Quezon City 6 Legislative Districts Geographic Centers & Bounds
  qcDistricts: {
    'all': {
      name: 'All Districts (Quezon City)',
      center: [14.6760, 121.0550],
      zoom: 12.8,
      description: 'Whole Quezon City (Districts 1 to 6)'
    },
    'District 1': {
      name: 'District 1 (West QC)',
      center: [14.6480, 121.0180],
      zoom: 14.5,
      description: 'SFDM, Project 6/7/8, La Loma, Sto. Domingo, Bungad, Phil-Am, West Triangle'
    },
    'District 2': {
      name: 'District 2 (Northeast QC)',
      center: [14.6945, 121.0890],
      zoom: 14.0,
      description: 'Batasan Hills, Commonwealth, Holy Spirit, Payatas, Bagong Silangan'
    },
    'District 3': {
      name: 'District 3 (East QC)',
      center: [14.6320, 121.0720],
      zoom: 14.5,
      description: 'Cubao, Loyola Heights, Matandang Balara, Libis, Blue Ridge, Ugong Norte'
    },
    'District 4': {
      name: 'District 4 (Central & South QC)',
      center: [14.6380, 121.0340],
      zoom: 14.5,
      description: 'Diliman, UP Campus, Teachers Village, New Manila, South Triangle, Scout Area, Kamuning'
    },
    'District 5': {
      name: 'District 5 (Novaliches & Fairview)',
      center: [14.7150, 121.0450],
      zoom: 14.0,
      description: 'Novaliches Proper, Fairview, Greater Lagro, San Bartolome, Gulod, Bagbag'
    },
    'District 6': {
      name: 'District 6 (North Central QC)',
      center: [14.6780, 121.0480],
      zoom: 14.5,
      description: 'Tandang Sora, Sauyo, Talipapa, Culiat, Pasong Tamo, Baesa, Balintawak'
    }
  },

  // Quezon City Official Barangays by District
  // Landmark Directory for Instant Geocoding & Direct Search
  landmarksDirectory: [
    { name: 'Ever Gotesco Commonwealth', aliases: ['ever gotesco', 'ever', 'gotesco', 'ever commonwealth', 'ever mall'], lat: 14.6812, lng: 121.0825, desc: 'Commonwealth Ave, Batasan Hills, District 2, QC', type: 'mall' },
    { name: 'Batasang Pambansa Complex', aliases: ['batasan', 'batasan hills', 'batasang pambansa', 'batasan complex', 'congress'], lat: 14.6934, lng: 121.0954, desc: 'Batasan Hills, District 2, QC', type: 'government' },
    { name: 'Batasan Hills National High School', aliases: ['batasan school', 'batasan high school', 'batasan nhs'], lat: 14.6908, lng: 121.0995, desc: 'IBP Road, Batasan Hills, District 2, QC', type: 'school' },
    { name: 'Commonwealth Market', aliases: ['commonwealth', 'commonwealth ave', 'commonwealth market'], lat: 14.7046, lng: 121.0792, desc: 'Commonwealth, District 2, QC', type: 'market' },
    { name: 'Sandiganbayan Centennial Bldg', aliases: ['sandigan', 'sandiganbayan', 'sandigan market', 'centennial bldg'], lat: 14.6852, lng: 121.0788, desc: 'Commonwealth Ave, District 2, QC', type: 'government' },
    { name: 'SM City North EDSA', aliases: ['sm north', 'sm north edsa', 'sm city north edsa'], lat: 14.6565, lng: 121.0315, desc: 'Bago Bantay, District 1, QC', type: 'mall' },
    { name: 'Shopwise Commonwealth', aliases: ['shopwise', 'shopwise commonwealth', 'don antonio'], lat: 14.6750, lng: 121.0780, desc: 'Don Antonio Heights, Holy Spirit, District 2, QC', type: 'shopping' },
    { name: 'Holy Spirit Drive', aliases: ['holy spirit', 'holy spirit drive'], lat: 14.6865, lng: 121.0682, desc: 'Holy Spirit, District 2, QC', type: 'residential' },
    { name: 'Payatas / Lupang Pangako', aliases: ['payatas', 'lupang pangako', 'white mosque'], lat: 14.7118, lng: 121.1037, desc: 'Payatas, District 2, QC', type: 'residential' },
    { name: 'Bagong Silangan Barangay Hall', aliases: ['bagong silangan', 'silangan'], lat: 14.7081, lng: 121.1152, desc: 'Bagong Silangan, District 2, QC', type: 'barangay' },
    { name: 'Bagbag Novaliches', aliases: ['bagbag', 'novaliches', 'quirino hwy'], lat: 14.7005, lng: 121.0380, desc: 'Quirino Highway, Bagbag, District 5, QC', type: 'residential' },
    { name: 'UP Diliman Campus', aliases: ['up diliman', 'up', 'university of the philippines', 'diliman'], lat: 14.6538, lng: 121.0685, desc: 'UP Diliman, District 4, QC', type: 'university' },
    { name: 'SM City Fairview', aliases: ['fairview', 'sm fairview', 'sm city fairview'], lat: 14.7335, lng: 121.0583, desc: 'Quirino Hwy, Novaliches, District 5, QC', type: 'mall' },
    { name: 'Tandang Sora', aliases: ['tandang sora', 'ts', 'culiat'], lat: 14.6710, lng: 121.0450, desc: 'District 6, Quezon City', type: 'residential' },
    { name: 'Sauyo Road', aliases: ['sauyo', 'sauyo road'], lat: 14.6950, lng: 121.0420, desc: 'Sauyo, District 6, QC', type: 'residential' },
    { name: 'Doña Carmen Heights', aliases: ['dona carmen', 'doña carmen', 'dona carmen heights'], lat: 14.6980, lng: 121.0750, desc: 'Commonwealth Ave, District 2, QC', type: 'subdivision' },
    { name: 'Spring Valley Subdivision', aliases: ['spring valley', 'spring valley subdivision'], lat: 14.7020, lng: 121.0850, desc: 'Bagong Silangan, District 2, QC', type: 'subdivision' },
    { name: 'St. Peter Parish Church', aliases: ['st peter', 'st. peter', 'st peter church', 'st peter parish'], lat: 14.6830, lng: 121.0820, desc: 'Commonwealth Ave, District 2, QC', type: 'church' },
    { name: 'Quezon City Hall / Elliptical', aliases: ['qc hall', 'quezon city hall', 'elliptical road', 'circle'], lat: 14.6465, lng: 121.0494, desc: 'Diliman, District 4, Quezon City', type: 'landmark' },
    { name: 'Araneta City Cubao', aliases: ['cubao', 'araneta center', 'araneta city', 'gateway'], lat: 14.6210, lng: 121.0530, desc: 'Socorro, Cubao, District 3, QC', type: 'commercial' },
    { name: 'San Francisco del Monte', aliases: ['sfdm', 'san francisco del monte', 'del monte'], lat: 14.6480, lng: 121.0180, desc: 'SFDM, District 1, QC', type: 'residential' }
  ],

  // Incident Records Database (Strictly Quezon City)
  // Real incidents, built from Supabase (through the admin store): missing-pet reports and community sightings.
  // Impounded pets have no map coordinates, so they are not plotted here.
  incidentsData: [],

  toTs(v) {
    if (v == null || v === '') return null;
    const t = typeof v === 'number' ? v : new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
  },

  nearestDistrict(lat, lng) {
    let best = null, bestD = Infinity;
    Object.entries(this.qcDistricts).forEach(([key, d]) => {
      if (key === 'all') return;
      const dd = (d.center[0] - lat) ** 2 + (d.center[1] - lng) ** 2;
      if (dd < bestD) { bestD = dd; best = key; }
    });
    return bestD > 0.04 ? 'Outside QC' : best; // ~20 km from every district centre
  },

  // Google "Plus Codes" such as 7XXG+WXM are not place names, so they are removed from addresses
  stripPlusCode(text) {
    return String(text || '').replace(/\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/gi, ' ').replace(/\s{2,}/g, ' ');
  },

  geoKey(lat, lng) { return `${lat.toFixed(4)},${lng.toFixed(4)}`; },

  // A readable place name: the address text without codes or house numbers, else a looked-up
  // neighbourhood / street name for the coordinates, else the nearest known landmark or the district.
  placeName(location, lat, lng) {
    const parts = this.stripPlusCode(location).split(',').map(s => s.trim().replace(/^\d+[\w-]*\s+/, '')).filter(Boolean)
      .filter(s => !/^(quezon city|qc|metro manila|ncr|philippines|national capital region)$/i.test(s) && !/^\d+$/.test(s) && /[a-z]/i.test(s));
    if (parts[0]) return parts[0];
    const geo = this._geo && this._geo[this.geoKey(lat, lng)];
    if (geo) return geo;
    let best = null, bestD = Infinity;
    (this.landmarksDirectory || []).forEach(l => {
      const d = (l.lat - lat) ** 2 + (l.lng - lng) ** 2;
      if (d < bestD) { bestD = d; best = l; }
    });
    if (best && bestD < 0.0002) return `Near ${best.name}`; // about 1.5 km
    const district = this.nearestDistrict(lat, lng);
    return district === 'Outside QC' ? 'Outside Quezon City' : `${district}, Quezon City`;
  },

  // Looks up neighbourhood / street names for pins whose address only had a code (cached, runs once per pin)
  async resolveNames(list) {
    this._geo = this._geo || {};
    this._geoTried = this._geoTried || {};
    const pending = list.filter(i => i.needsGeo && !this._geoTried[this.geoKey(i.lat, i.lng)]);
    if (!pending.length || !window.PawGoogleMaps) return;
    let Geocoder;
    try {
      await window.PawGoogleMaps.load();
      ({ Geocoder } = await google.maps.importLibrary('geocoding'));
    } catch (e) { return; }
    const geocoder = new Geocoder();
    let found = false;
    for (const inc of pending.slice(0, 20)) {
      const key = this.geoKey(inc.lat, inc.lng);
      this._geoTried[key] = true;
      try {
        const { results } = await geocoder.geocode({ location: { lat: inc.lat, lng: inc.lng } });
        const pick = (types) => {
          for (const r of results) {
            const c = r.address_components.find(ac => types.some(t => ac.types.includes(t)));
            if (c && /[a-z]/i.test(c.long_name) && !/^[\d\s-]+$/.test(c.long_name)) return c.long_name;
          }
          return null;
        };
        const name = pick(['sublocality_level_1', 'sublocality', 'neighborhood']) || pick(['route']);
        if (name) { this._geo[key] = name; found = true; }
      } catch (e) { /* quota or network: keep the fallback name */ }
    }
    if (found && document.getElementById('pawtrack-leaflet-map')) this.render(document.getElementById('view-container'));
  },

  buildIncidents() {
    const store = window.adminStore;
    if (!store) return [];
    const list = [];
    const valid = (c) => Array.isArray(c) && Number.isFinite(+c[0]) && Number.isFinite(+c[1]) && c[0] !== null && c[1] !== null;
    const shape = (base) => {
      const ts = base.ts;
      const when = ts != null ? new Date(ts) : null;
      const hour = when ? when.getHours() : null;
      const species = base.species || 'Other';
      return {
        ...base,
        species,
        location: this.stripPlusCode(base.location).replace(/^[\s,]+/, '').trim() || '',
        speciesTag: base.breed ? `${species} · ${base.breed}` : species,
        district: this.nearestDistrict(base.lat, base.lng),
        barangay: this.placeName(base.location, base.lat, base.lng),
        needsGeo: !this.stripPlusCode(base.location).split(',').some(x => /[a-z]{3}/i.test(x.trim().replace(/^\d+[\w-]*\s+/, '')) && !/^(quezon city|qc|metro manila|ncr|philippines)$/i.test(x.trim())),
        city: 'Quezon City',
        date: when ? when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
        time: when ? when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
        hour,
        avatar: species === 'Dog' ? '🐕' : species === 'Cat' ? '🐈' : '🐾',
        color: base.status === 'lost' ? '#ea580c' : '#2563eb'
      };
    };

    (store.getCases ? store.getCases() : []).forEach(c => {
      if (!valid(c.coords)) return;
      list.push(shape({
        id: c.id,
        name: c.petName || 'Unnamed pet',
        species: c.species, breed: c.breed,
        status: c.status === 'reunited' ? 'found' : 'lost',
        location: c.location || '',
        photoUrl: c.photoUrl || '',
        contact: c.reportedByOwner ? 'Owner report' : 'Community report',
        phone: '',
        lat: +c.coords[0], lng: +c.coords[1],
        ts: this.toTs(c.createdAt)
      }));
    });

    (store.getSightings ? store.getSightings() : []).forEach(s => {
      if (s.status === 'dismissed' || s.status === 'archived') return;
      if (!valid(s.coords)) return;
      list.push(shape({
        id: s.id,
        name: `${s.species || 'Animal'} sighting`,
        species: s.species, breed: s.breed,
        status: 'sighting',
        location: s.location || '',
        photoUrl: s.photoUrl || '',
        contact: s.reporterName || 'Community report',
        phone: '',
        lat: +s.coords[0], lng: +s.coords[1],
        ts: this.toTs(s.dateTimeSeen || s.createdAt)
      }));
    });

    return list;
  },

  applyDateRange(list) {
    const r = this.selectedDateRange;
    if (!r || r === 'all') return list;
    const day = 86400000;
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const from = r === 'today' ? startOfToday.getTime() : Date.now() - (r === '7d' ? 7 : r === '30d' ? 30 : 0) * day;
    if (r !== 'today' && r !== '7d' && r !== '30d') return list;
    return list.filter(i => i.ts != null && i.ts >= from);
  },

  getFilteredIncidents() {
    let list = this.applyDateRange([...this.incidentsData]);

    if (this.selectedAnimal === 'dog') {
      list = list.filter(i => (i.species || '').toLowerCase() === 'dog');
    } else if (this.selectedAnimal === 'cat') {
      list = list.filter(i => (i.species || '').toLowerCase() === 'cat');
    } else if (this.selectedAnimal === 'other') {
      list = list.filter(i => !['dog', 'cat'].includes((i.species || '').toLowerCase()));
    }

    if (this.selectedStatus && this.selectedStatus !== 'all') {
      list = list.filter(i => (i.status || '').toLowerCase() === this.selectedStatus.toLowerCase());
    }

    if (this.selectedDistrict && this.selectedDistrict !== 'all' && this.selectedDistrict !== 'All Districts') {
      list = list.filter(i => i.district === this.selectedDistrict);
    }

    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(i =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.location && i.location.toLowerCase().includes(q)) ||
        (i.barangay && i.barangay.toLowerCase().includes(q)) ||
        (i.species && i.species.toLowerCase().includes(q)) ||
        (i.id && String(i.id).toLowerCase().includes(q)) ||
        (i.contact && i.contact.toLowerCase().includes(q))
      );
    }

    if (this.sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (this.sortBy === 'location') {
      list.sort((a, b) => (a.barangay || a.location || '').localeCompare(b.barangay || b.location || ''));
    } else if (this.sortBy === 'status') {
      list.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
    } else {
      list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }

    return list;
  },

  // Groups nearby incidents (about 1 km grid cells) and ranks them
  getHotspots(list) {
    const incidents = list || this.incidentsData;
    const cells = {};
    incidents.forEach(i => {
      const key = `${Math.round(i.lat / 0.01)}|${Math.round(i.lng / 0.01)}`;
      (cells[key] = cells[key] || []).push(i);
    });
    return Object.values(cells)
      .map(items => {
        const names = {};
        items.forEach(i => { names[i.barangay] = (names[i.barangay] || 0) + 1; });
        const name = Object.entries(names).sort((a, b) => b[1] - a[1])[0][0];
        const total = items.length;
        const district = items[0].district;
        const level = total >= 3 ? ['HIGH RISK', 'risk-high'] : total === 2 ? ['MODERATE RISK', 'risk-moderate'] : ['LOW RISK', 'risk-low'];
        return {
          barangay: name,
          city: district === 'Outside QC' ? 'Outside Quezon City' : `Quezon City (${district})`,
          dogs: items.filter(i => (i.species || '').toLowerCase() === 'dog').length,
          cats: items.filter(i => (i.species || '').toLowerCase() === 'cat').length,
          riskLevel: level[0], riskClass: level[1], totalReports: total,
          lat: items.reduce((a, i) => a + i.lat, 0) / total,
          lng: items.reduce((a, i) => a + i.lng, 0) / total
        };
      })
      .sort((a, b) => b.totalReports - a.totalReports)
      .slice(0, 10)
      .map((h, idx) => ({ ...h, rank: idx + 1 }));
  },

  // Busiest 4-hour window by time of report
  peakWindow(list) {
    const timed = list.filter(i => i.hour != null);
    if (!timed.length) return { range: 'No data yet', pill: 'N/A', desc: 'No timed reports in view' };
    let best = { start: 0, n: -1 };
    for (let s = 0; s < 24; s++) {
      const n = timed.filter(i => { const d = (i.hour - s + 24) % 24; return d < 4; }).length;
      if (n > best.n) best = { start: s, n };
    }
    const hr = (h) => { const hh = ((h % 24) + 24) % 24; return `${hh % 12 || 12}`; };
    const mer = (h) => (((h % 24) + 24) % 24) < 12 ? 'AM' : 'PM';
    const endH = best.start + 4;
    const fmtRange = mer(best.start) === mer(endH) ? `${hr(best.start)}–${hr(endH)} ${mer(endH)}` : `${hr(best.start)} ${mer(best.start)} – ${hr(endH)} ${mer(endH)}`;
    const mid = (best.start + 2) % 24;
    const pill = mid >= 5 && mid < 12 ? 'MORNING' : mid >= 12 && mid < 17 ? 'AFTERNOON' : mid >= 17 && mid < 21 ? 'EVENING' : 'NIGHT';
    return { range: fmtRange, pill, desc: `${best.n} of ${timed.length} reports in this window` };
  },

  filtersActive() {
    return this.selectedDateRange !== 'all' || this.selectedAnimal !== 'all' || this.selectedStatus !== 'all'
      || this.selectedDistrict !== 'all' || !!(this.searchQuery && this.searchQuery.trim());
  },

  // Builds the page shell once; later calls only refresh the data so the map is not rebuilt on every filter change.
  render(container) {
    this.incidentsData = this.buildIncidents();
    this.resolveNames(this.incidentsData);
    this._container = container;
    if (!container.querySelector('#hm-root')) {
      container.innerHTML = this.shellHtml();
      const root = container.querySelector('#hm-root');
      if (!root) return; // not a real page (e.g. a test container)
      this.bindEvents(root);
    }
    this.refresh();
  },

  shellHtml() {
    const seg = (cls, attr, items, current) => items.map(([v, label]) =>
      `<button class="${cls} ${current === v ? 'active' : ''}" ${attr}="${v}" role="tab" aria-selected="${current === v}">${label}</button>`).join('');
    return `
      <div class="hm-page dash-pro" id="hm-root">
        <div class="view-header">
          <div class="view-header-titles">
            <div class="dash-eyebrow">Geospatial insights</div>
            <h1>Heatmap</h1>
            <div class="subtitle"><span>Where lost and stray animals are being reported across Quezon City, live from the database</span></div>
          </div>
          <div class="view-header-actions">
            <button class="chip" id="btn-reset-heatmap-filters" hidden>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Reset filters
            </button>
          </div>
        </div>

        <div class="hm-toolbar">
          <div class="hm-field">
            <span class="hm-label">Period</span>
            <div class="dash-segmented" role="tablist" aria-label="Period">
              ${seg('range-pill', 'data-range', [['all', 'All time'], ['today', 'Today'], ['7d', '7 days'], ['30d', '30 days']], this.selectedDateRange)}
            </div>
          </div>
          <div class="hm-field">
            <span class="hm-label">Animal</span>
            <div class="dash-segmented" role="tablist" aria-label="Animal">
              ${seg('animal-pill', 'data-animal', [['all', 'All'], ['dog', 'Dogs'], ['cat', 'Cats'], ['other', 'Other']], this.selectedAnimal)}
            </div>
          </div>
          <div class="hm-field">
            <span class="hm-label">Status</span>
            <select id="select-status-filter" class="hm-select">
              <option value="all">All statuses</option>
              <option value="lost">Lost</option>
              <option value="sighting">Sighting</option>
              <option value="found">Found</option>
            </select>
          </div>
          <div class="hm-field">
            <span class="hm-label">District</span>
            <select id="select-district-filter" class="hm-select">
              <option value="all">All districts</option>
              ${[1, 2, 3, 4, 5, 6].map(n => `<option value="District ${n}">District ${n}</option>`).join('')}
            </select>
          </div>
          <div class="hm-field hm-field-search">
            <span class="hm-label">Search</span>
            <div class="filter-search-box hm-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" id="heatmap-search-input" placeholder="Place, landmark or pet name" autocomplete="off" />
              <div id="heatmap-search-suggestions" class="search-suggestions-dropdown hidden"></div>
            </div>
          </div>
        </div>

        <div class="kpi-grid hm-kpis" id="hm-kpis"></div>

        <div class="hm-main">
          <div class="hm-map-card" id="heatmap-map-card">
            <div id="pawtrack-leaflet-map" class="pawtrack-map-viewport"></div>
            <div class="hm-map-loading" id="hm-map-loading"><span class="hm-spinner"></span>Loading map…</div>

            <div class="hm-map-top">
              <div class="hm-map-top-left">
                <div class="dash-segmented hm-layer" role="tablist" aria-label="Map type">
                  ${seg('layer-btn', 'data-layer', [['roadmap', 'Map'], ['satellite', 'Satellite'], ['terrain', 'Terrain']], this.selectedLayer)}
                </div>
                <div class="dash-segmented hm-layer hm-toggles" aria-label="Map layers">
                  <button class="map-toggle ${this.showHeat ? 'active' : ''}" data-toggle="heat" title="Show or hide the heat glow">Heat</button>
                  <button class="map-toggle ${this.showPins ? 'active' : ''}" data-toggle="pins" title="Show or hide the pins">Pins</button>
                </div>
              </div>
              <div class="hm-map-top-right">
              <button class="hm-icon-btn" id="btn-map-recenter" title="Fit map to reports" aria-label="Fit map to reports">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
              </button>
              <button class="hm-icon-btn" id="btn-map-fullscreen" title="Toggle fullscreen" aria-label="Toggle fullscreen map">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                <span id="fullscreen-btn-text" class="hm-sr">Fullscreen</span>
              </button>
              </div>
            </div>

            <div class="hm-map-count" id="hm-map-count"></div>
            <div class="hm-legend">
              <div class="hm-legend-row"><span class="hm-legend-bar"></span></div>
              <div class="hm-legend-scale"><span>Fewer reports</span><span>More</span></div>
              <div class="hm-legend-dots"><span><i style="background:#ea580c"></i>Lost</span><span><i style="background:#2563eb"></i>Sighting</span><span><i style="background:#16a34a"></i>Found</span></div>
            </div>
          </div>

          <aside class="hm-hotspots nock-card">
            <div class="nock-card-head">
              <span class="nock-card-title">Top hotspots</span>
              <span class="nock-card-right">Most reports</span>
            </div>
            <div class="hm-hotspot-list" id="hm-hotspots-list"></div>
          </aside>
        </div>

        <section class="nock-card hm-table-card" id="hm-table-card"></section>
      </div>`;
  },

  refresh() {
    const root = document.getElementById('hm-root');
    if (!root) return;
    const filtered = this.getFilteredIncidents();
    const total = filtered.length;
    const hotspots = this.getHotspots(filtered);
    const lost = filtered.filter(i => i.status === 'lost');
    const dogs = lost.filter(i => (i.species || '').toLowerCase() === 'dog').length;
    const cats = lost.filter(i => (i.species || '').toLowerCase() === 'cat').length;
    const others = filtered.length - filtered.filter(i => i.status === 'lost').length;
    const top = hotspots[0];
    const peak = this.peakWindow(filtered);

    // Toolbar state
    root.querySelectorAll('.range-pill').forEach(b => b.classList.toggle('active', b.dataset.range === this.selectedDateRange));
    root.querySelectorAll('.animal-pill').forEach(b => b.classList.toggle('active', b.dataset.animal === this.selectedAnimal));
    root.querySelectorAll('.layer-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === this.selectedLayer));
    const st = root.querySelector('#select-status-filter'); if (st) st.value = this.selectedStatus;
    const ds = root.querySelector('#select-district-filter'); if (ds) ds.value = this.selectedDistrict;
    const si = root.querySelector('#heatmap-search-input'); if (si && document.activeElement !== si) si.value = this.searchQuery;
    root.querySelector('#btn-reset-heatmap-filters').hidden = !this.filtersActive();

    // KPIs
    const kpi = (label, value, sub, tone = 'neutral') => `
      <div class="kpi-card">
        <div class="kpi-label"><span>${label}</span></div>
        <div class="kpi-value hm-kpi-value">${value}</div>
        <div class="kpi-delta ${tone}">${sub}</div>
      </div>`;
    root.querySelector('#hm-kpis').innerHTML = [
      kpi('Reports in view', total, total ? `${lost.length} lost · ${others} sighting / found` : 'Nothing matches these filters'),
      kpi('Active lost pets', lost.length, lost.length ? `${dogs} ${dogs === 1 ? 'dog' : 'dogs'} · ${cats} ${cats === 1 ? 'cat' : 'cats'}` : 'None right now', lost.length ? 'down' : 'up'),
      kpi('Top hotspot', top ? this.esc(top.barangay) : '—', top ? `${top.totalReports} ${top.totalReports === 1 ? 'report' : 'reports'} · ${top.riskLevel.toLowerCase()}` : 'No hotspots yet'),
      kpi('Busiest time', total ? peak.range : '—', total ? peak.desc : 'No timed reports')
    ].join('');

    // Map caption
    root.querySelector('#hm-map-count').textContent = total ? `${total} ${total === 1 ? 'report' : 'reports'} plotted` : 'No reports to plot';

    // Hotspots
    root.querySelector('#hm-hotspots-list').innerHTML = hotspots.length ? hotspots.slice(0, 6).map(spot => `
      <button class="hotspot-row" data-fly data-lat="${spot.lat}" data-lng="${spot.lng}" title="Show ${this.esc(spot.barangay)} on the map">
        <span class="hotspot-rank">${spot.rank}</span>
        <span class="hotspot-info">
          <span class="hotspot-name">${this.esc(spot.barangay)}</span>
          <span class="hotspot-sub">${this.esc(spot.city)}</span>
          <span class="hm-hotspot-bar"><i style="width:${Math.round((spot.totalReports / hotspots[0].totalReports) * 100)}%"></i></span>
        </span>
        <span class="hotspot-stats">
          <span class="hotspot-count-label"><b>${spot.totalReports}</b> ${spot.totalReports === 1 ? 'report' : 'reports'}</span>
          <span class="risk-badge ${spot.riskClass}">${spot.riskLevel.replace(' RISK', '')}</span>
        </span>
      </button>`).join('')
      : `<div class="hm-empty"><b>No hotspots yet</b>Areas with reports will be ranked here.</div>`;

    // Table
    const totalPages = Math.max(Math.ceil(total / this.pageSize), 1);
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;
    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, total);
    const rows = filtered.slice(start, end);
    const pill = (s) => s === 'lost' ? 'status-lost' : s === 'found' ? 'status-safe' : 'status-pending';
    root.querySelector('#hm-table-card').innerHTML = `
      <div class="nock-card-head">
        <span class="nock-card-title">Reports <span class="hm-count">${total}</span></span>
        <label class="hm-sort">Sort by
          <select id="select-sort" class="hm-select hm-select-sm">
            ${[['date', 'Newest'], ['name', 'Name'], ['location', 'Location'], ['status', 'Status']].map(([v, l]) => `<option value="${v}" ${this.sortBy === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
      </div>
      ${rows.length === 0 ? `
        <div class="hm-empty hm-empty-lg">
          <b>${this.incidentsData.length ? 'No reports match these filters' : 'No reports with a map location yet'}</b>
          ${this.incidentsData.length ? 'Try a wider period, or reset the filters.' : 'Missing-pet reports and sightings appear here as soon as they are filed.'}
        </div>` : `
      <div class="data-table-wrapper">
        <table class="nock-data-table hm-table">
          <thead><tr><th>Animal</th><th>Status</th><th>Location</th><th>Reported</th><th>Source</th><th></th></tr></thead>
          <tbody>
            ${rows.map(inc => `
              <tr class="incident-table-row" data-fly data-lat="${inc.lat}" data-lng="${inc.lng}" data-id="${this.esc(inc.id)}">
                <td>
                  <div class="animal-cell">
                    ${this.photoHtml(inc)}
                    <div class="animal-info"><span class="animal-name">${this.esc(inc.name)}</span><span class="animal-breed">${this.esc(inc.speciesTag)}</span></div>
                  </div>
                </td>
                <td><span class="status-pill ${pill(inc.status)}">${this.esc(inc.status.toUpperCase())}</span></td>
                <td>
                  <div class="location-cell">
                    <span class="loc-main">${this.esc(inc.barangay)}</span>
                    <span class="loc-sub">${this.esc(inc.district)}${inc.location && inc.location !== inc.barangay ? ' · ' + this.esc(inc.location) : ''}</span>
                  </div>
                </td>
                <td><div class="date-time-cell"><span class="date-main">${this.esc(inc.date)}</span><span class="time-sub">${this.esc(inc.time)}</span></div></td>
                <td><span class="contact-name">${this.esc(inc.contact)}</span></td>
                <td style="text-align:right"><button class="btn btn-xs btn-secondary" data-fly data-lat="${inc.lat}" data-lng="${inc.lng}" title="${inc.lat.toFixed(5)}, ${inc.lng.toFixed(5)}">Locate</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-pagination-footer">
        <div class="pagination-info">Showing <strong>${start + 1}</strong>–<strong>${end}</strong> of <strong>${total}</strong></div>
        ${totalPages > 1 ? `
          <div class="pagination-controls">
            <button class="page-btn page-nav-btn" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>‹ Prev</button>
            <div class="page-numbers">${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `<button class="page-btn page-num-btn ${this.currentPage === p ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}</div>
            <button class="page-btn page-nav-btn" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>Next ›</button>
          </div>` : ''}
      </div>`}`;

    this.initLeafletMap(filtered);
  },

  bindEvents(root) {
    const rerender = () => { this.currentPage = 1; this.refresh(); };

    root.addEventListener('click', (e) => {
      const t = e.target;
      const range = t.closest('.range-pill');
      if (range) { this.selectedDateRange = range.dataset.range; return rerender(); }
      const animal = t.closest('.animal-pill');
      if (animal) { this.selectedAnimal = animal.dataset.animal; return rerender(); }
      const layer = t.closest('.layer-btn');
      if (layer) {
        this.selectedLayer = layer.dataset.layer;
        root.querySelectorAll('.layer-btn').forEach(b => b.classList.toggle('active', b === layer));
        if (this.gmap) this.gmap.setMapTypeId(this.googleMapType()); else this.initLeafletMap(this.getFilteredIncidents());
        return;
      }
      if (t.closest('#btn-reset-heatmap-filters')) {
        Object.assign(this, { selectedDateRange: 'all', selectedAnimal: 'all', selectedStatus: 'all', selectedDistrict: 'all', searchQuery: '', currentPage: 1 });
        if (this.searchLocationMarker && this.mapInstance) { try { this.mapInstance.removeLayer(this.searchLocationMarker); } catch (err) {} this.searchLocationMarker = null; }
        this.refresh();
        return;
      }
      const toggle = t.closest('.map-toggle');
      if (toggle) {
        if (toggle.dataset.toggle === 'heat') this.showHeat = !this.showHeat; else this.showPins = !this.showPins;
        return this.applyMapToggles();
      }
      if (t.closest('#btn-map-recenter')) { this._noFitUntil = 0; return this.fitToIncidents(this.getFilteredIncidents(), true); }
      if (t.closest('#btn-map-fullscreen')) return this.toggleFullscreen();
      const page = t.closest('[data-page]');
      if (page && !page.disabled) {
        const n = parseInt(page.dataset.page, 10);
        if (n >= 1) { this.currentPage = n; this.refresh(); root.querySelector('#hm-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        return;
      }
      const fly = t.closest('[data-fly]');
      if (fly) {
        const lat = parseFloat(fly.dataset.lat), lng = parseFloat(fly.dataset.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          root.querySelectorAll('.hotspot-row.active').forEach(r => r.classList.remove('active'));
          if (fly.classList.contains('hotspot-row')) fly.classList.add('active');
          this.flyToIncident(lat, lng, fly.dataset.id);
        }
      }
    });

    root.addEventListener('change', (e) => {
      if (e.target.id === 'select-status-filter') { this.selectedStatus = e.target.value; rerender(); }
      else if (e.target.id === 'select-district-filter') { this.selectedDistrict = e.target.value; rerender(); }
      else if (e.target.id === 'select-sort') { this.sortBy = e.target.value; this.refresh(); }
    });

    // Search with landmark / incident suggestions
    const input = root.querySelector('#heatmap-search-input');
    const dropdown = root.querySelector('#heatmap-search-suggestions');
    input.addEventListener('input', () => {
      this.searchQuery = input.value;
      rerender();
      const suggestions = this.getSearchSuggestions(input.value);
      if (!suggestions.length || !input.value.trim()) { dropdown.classList.add('hidden'); return; }
      dropdown.innerHTML = suggestions.map(s => `
        <div class="suggestion-item" data-lat="${s.lat}" data-lng="${s.lng}" data-title="${this.esc(s.title)}" data-subtitle="${this.esc(s.subtitle || '')}" data-id="${this.esc(s.id || '')}" data-type="${s.type}">
          <span class="suggestion-icon">${s.icon || '📍'}</span>
          <div class="suggestion-content"><span class="suggestion-title">${this.esc(s.title)}</span><span class="suggestion-sub">${this.esc(s.subtitle || '')}</span></div>
        </div>`).join('');
      dropdown.classList.remove('hidden');
    });
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (!item) return;
      const lat = parseFloat(item.dataset.lat), lng = parseFloat(item.dataset.lng);
      input.value = item.dataset.title;
      this.searchQuery = '';
      dropdown.classList.add('hidden');
      this.refresh();
      if (item.dataset.type === 'incident' && item.dataset.id) this.flyToIncident(lat, lng, item.dataset.id);
      else this.flyToLocationWithPin(lat, lng, item.dataset.title, item.dataset.subtitle, '📍 Landmark');
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      dropdown.classList.add('hidden');
      if (input.value.trim()) this.directToLocationOrLandmark(input.value.trim());
    });
    if (!this._docBound) {
      this._docBound = true;
      document.addEventListener('click', (e) => {
        const dd = document.getElementById('heatmap-search-suggestions');
        if (dd && !e.target.closest('.hm-search')) dd.classList.add('hidden');
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('heatmap-map-card')?.classList.contains('is-fullscreen')) this.toggleFullscreen();
      });
    }
  },

  toggleFullscreen() {
    const card = document.getElementById('heatmap-map-card');
    if (!card) return;
    const on = card.classList.toggle('is-fullscreen');
    document.body.classList.toggle('hm-no-scroll', on);
    const label = document.getElementById('fullscreen-btn-text');
    if (label) label.textContent = on ? 'Exit fullscreen' : 'Fullscreen';
    setTimeout(() => { if (this.mapInstance && this.mapInstance.invalidateSize) this.mapInstance.invalidateSize(); }, 150);
  },

  // Draws the map with Google Maps (key and Map ID come from the Supabase public-config function).
  // Falls back to the Leaflet map only if Google Maps cannot load.
  async initLeafletMap(incidents) {
    const el = document.getElementById('pawtrack-leaflet-map');
    if (!el) return;
    const token = (this._mapToken = (this._mapToken || 0) + 1);
    let ok = false;
    try {
      ok = await this.initGoogleMap(el, incidents, token);
    } catch (err) {
      console.warn('[Heatmap] Google Maps unavailable, using Leaflet:', err && err.message);
    }
    if (token !== this._mapToken) return;
    if (!ok) {
      this.gmap = null;
      this.initLeafletFallback(incidents);
    }
    const loading = document.getElementById('hm-map-loading');
    if (loading) loading.classList.add('is-hidden');
  },

  googleMapType() {
    return { roadmap: 'roadmap', satellite: 'hybrid', terrain: 'terrain' }[this.selectedLayer] || 'roadmap';
  },

  async initGoogleMap(el, incidents, token) {
    if (!window.PawGoogleMaps || !(await window.PawGoogleMaps.isConfigured())) return false;
    const libs = await window.PawGoogleMaps.load();
    if (token !== this._mapToken) return true;
    const { Map, InfoWindow, AdvancedMarkerElement } = libs;

    const reuse = this.gmap && this.gmap.getDiv() === el;
    if (!reuse) {
      if (this.mapInstance && this.mapInstance.remove) { try { this.mapInstance.remove(); } catch (e) {} }
      const district = (this.qcDistricts && this.qcDistricts[this.selectedDistrict]) || this.qcDistricts['all'];
      el.innerHTML = '';
      this.gmap = new Map(el, {
        center: { lat: district.center[0], lng: district.center[1] },
        zoom: district.zoom,
        mapId: window.PawGoogleMaps.mapId || 'DEMO_MAP_ID',
        mapTypeId: this.googleMapType(),
        gestureHandling: 'greedy',
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false,
        clickableIcons: false
      });
      this.infoWindow = new InfoWindow({ maxWidth: 330, headerDisabled: true });
      this.heatOverlay = null;
      this.gMarkers = [];
      this.searchLocationMarker = null;

      const gmap = this.gmap, info = this.infoWindow;
      this.mapInstance = {
        flyTo: ([lat, lng], zoom) => { gmap.panTo({ lat, lng }); if (zoom) gmap.setZoom(zoom); },
        invalidateSize: () => google.maps.event.trigger(gmap, 'resize'),
        closePopup: () => info.close(),
        removeLayer: (m) => { if (m) m.map = null; },
        remove: () => {}
      };
    } else {
      this.gmap.setMapTypeId(this.googleMapType());
    }

    // Markers: orange = lost, blue = sighting, green = found
    const STATUS_COLOR = { lost: '#ea580c', sighting: '#2563eb', found: '#16a34a' };
    (this.gMarkers || []).forEach(m => { m.map = null; });
    this.gMarkerById = {};
    this.gMarkers = incidents.map(inc => {
      const markerColor = STATUS_COLOR[inc.status] || '#2563eb';
      const ringColor = markerColor + '59';
      const content = document.createElement('div');
      content.className = 'pawtrack-map-marker';
      content.innerHTML = `
        <div class="marker-pulse-wrapper" style="--ring-color: ${ringColor}; --dot-color: ${markerColor};">
          <div class="marker-pulse-ring"></div>
          <div class="marker-center-dot" style="background: ${markerColor}; border: 2.5px solid #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.45);"></div>
        </div>`;
      const marker = new AdvancedMarkerElement({ map: this.showPins ? this.gmap : null, position: { lat: inc.lat, lng: inc.lng }, content, title: `${inc.name} · ${inc.status}` });
      marker.addListener('click', () => this.openIncidentPopup(inc, marker));
      this.gMarkerById[String(inc.id)] = marker;
      return marker;
    });

    // Heat layer (drawn on a canvas; Google's own HeatmapLayer has been retired).
    // Lost pets weigh most, and older reports fade so the map shows what is happening now.
    const weight = (i) => {
      const base = i.status === 'lost' ? 0.6 : i.status === 'sighting' ? 0.45 : 0.3;
      const ageDays = i.ts ? (Date.now() - i.ts) / 86400000 : 30;
      return base * Math.max(0.55, 1 - (ageDays / 90) * 0.45);
    };
    if (!this.heatOverlay) this.heatOverlay = this.createHeatOverlay(this.gmap);
    this.heatOverlay.setPoints(incidents.map(i => ({ lat: i.lat, lng: i.lng, w: weight(i) })));
    this.heatOverlay.setVisible(this.showHeat);

    this.fitToIncidents(incidents);
    return true;
  },

  // Frames the map around the reports in view (or the chosen district when there are none).
  // Skipped right after a deliberate "fly to", and when the set of reports has not changed.
  fitToIncidents(incidents, force = false) {
    if (!this.gmap) return;
    const key = incidents.map(i => i.id).sort().join('|') + '#' + this.selectedDistrict;
    if (!force && (key === this._fitKey || Date.now() < this._noFitUntil)) { this._fitKey = key; return; }
    this._fitKey = key;
    if (!incidents.length) {
      const d = (this.qcDistricts && this.qcDistricts[this.selectedDistrict]) || this.qcDistricts['all'];
      this.gmap.panTo({ lat: d.center[0], lng: d.center[1] });
      this.gmap.setZoom(d.zoom);
      return;
    }
    if (incidents.length === 1) {
      this.gmap.panTo({ lat: incidents[0].lat, lng: incidents[0].lng });
      this.gmap.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    incidents.forEach(i => bounds.extend({ lat: i.lat, lng: i.lng }));
    this.gmap.fitBounds(bounds, { top: 70, right: 60, bottom: 60, left: 60 });
    google.maps.event.addListenerOnce(this.gmap, 'idle', () => { if (this.gmap.getZoom() > 16) this.gmap.setZoom(16); });
  },

  openIncidentPopup(inc, marker) {
    if (!this.gmap || !this.infoWindow) return;
    this.infoWindow.setContent(this.incidentPopupHtml(inc));
    this.infoWindow.open({ map: this.gmap, anchor: marker });
  },

  applyMapToggles() {
    if (this.heatOverlay) this.heatOverlay.setVisible(this.showHeat);
    (this.gMarkers || []).forEach(m => { m.map = this.showPins ? this.gmap : null; });
    document.querySelectorAll('.map-toggle').forEach(b => b.classList.toggle('active', b.dataset.toggle === 'heat' ? this.showHeat : this.showPins));
  },

  // Pet photo (only https images from the database) with the species emoji as a fallback
  photoHtml(inc, cls = 'hm-photo') {
    const url = /^https:\/\//.test(inc.photoUrl || '') ? inc.photoUrl : '';
    const fallback = `<span class="${cls} ${cls}-empty" aria-hidden="true">${inc.avatar}</span>`;
    if (!url) return fallback;
    return `<img class="${cls}" src="${this.esc(url)}" alt="${this.esc(inc.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=this.dataset.fb" data-fb="${this.esc(fallback)}">`;
  },

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  incidentPopupHtml(inc) {
    return `
      <div class="pawtrack-infowindow-card">
        <div class="infowindow-header">
          <div>
            <div class="infowindow-id">${this.esc(inc.name)}</div>
            <div class="infowindow-species">${this.esc(inc.speciesTag)}</div>
          </div>
          <button class="infowindow-close-btn" onclick="window.HeatmapView.mapInstance.closePopup()">✕</button>
        </div>
        <div class="hm-popup-photo">${this.photoHtml(inc, 'hm-photo-lg')}</div>
        <div class="infowindow-status-banner">
          <span class="status-label">Status:</span>
          <strong class="status-val-lost">${this.esc(inc.status.toUpperCase())}</strong>
        </div>
        <div class="infowindow-details-list">
          <div class="infowindow-row"><span class="row-key">Location:</span><span class="row-val">${this.esc(inc.location || '—')}</span></div>
          <div class="infowindow-row"><span class="row-key">District:</span><span class="row-val">${this.esc(inc.district)}</span></div>
          <div class="infowindow-row"><span class="row-key">Reported:</span><span class="row-val">${this.esc(inc.date)} ${this.esc(inc.time)}</span></div>
          <div class="infowindow-row"><span class="row-key">Source:</span><span class="row-val">${this.esc(inc.contact)}</span></div>
          <div class="infowindow-row"><span class="row-key">Coords:</span><span class="row-val mono">${inc.lat.toFixed(4)}, ${inc.lng.toFixed(4)}</span></div>
        </div>
      </div>`;
  },

  // Canvas heat overlay on top of the Google map
  createHeatOverlay(map) {
    const GRADIENT = [[0.15, '#22c55e'], [0.45, '#eab308'], [0.72, '#f97316'], [1, '#ef4444']];
    const lut = (() => {
      const c = document.createElement('canvas'); c.width = 1; c.height = 256;
      const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, 256);
      GRADIENT.forEach(([stop, color]) => grad.addColorStop(stop, color));
      g.fillStyle = grad; g.fillRect(0, 0, 1, 256);
      return g.getImageData(0, 0, 1, 256).data;
    })();

    class HeatOverlay extends google.maps.OverlayView {
      constructor() {
        super();
        this.points = [];
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'position:absolute;pointer-events:none;';
        this.shade = document.createElement('canvas');
        this.setMap(map);
        this._idle = map.addListener('idle', () => this.draw());
      }
      setPoints(points) { this.points = points; this.draw(); }
      setVisible(v) { this.canvas.style.display = v ? '' : 'none'; }
      onAdd() { this.getPanes().overlayLayer.appendChild(this.canvas); }
      onRemove() { if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas); google.maps.event.removeListener(this._idle); }
      draw() {
        const proj = this.getProjection(); const bounds = map.getBounds();
        if (!proj || !bounds) return;
        const sw = proj.fromLatLngToDivPixel(bounds.getSouthWest());
        const ne = proj.fromLatLngToDivPixel(bounds.getNorthEast());
        const w = Math.max(Math.round(ne.x - sw.x), 1), h = Math.max(Math.round(sw.y - ne.y), 1);
        this.canvas.style.left = sw.x + 'px'; this.canvas.style.top = ne.y + 'px';
        this.canvas.width = w; this.canvas.height = h; this.shade.width = w; this.shade.height = h;

        const zoom = map.getZoom() || 12;
        // each report heats about 600 m around it, so the glow keeps its real-world size while zooming
        const centre = map.getCenter();
        const metresPerPx = 156543.03392 * Math.cos(((centre ? centre.lat() : 14.67) * Math.PI) / 180) / Math.pow(2, zoom);
        const r = Math.min(Math.max(600 / metresPerPx, 16), 160);
        const sctx = this.shade.getContext('2d');
        sctx.clearRect(0, 0, w, h);
        this.points.forEach(p => {
          const px = proj.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng));
          const x = px.x - sw.x, y = px.y - ne.y;
          if (x < -r || y < -r || x > w + r || y > h + r) return;
          const g = sctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(0,0,0,${Math.min(p.w, 1)})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          sctx.fillStyle = g; sctx.fillRect(x - r, y - r, r * 2, r * 2);
        });
        const img = sctx.getImageData(0, 0, w, h); const d = img.data;
        for (let i = 3; i < d.length; i += 4) {
          const a = d[i];
          if (a < 12) { d[i] = 0; continue; }
          const o = a * 4;
          d[i - 3] = lut[o]; d[i - 2] = lut[o + 1]; d[i - 1] = lut[o + 2]; d[i] = Math.min(255, a * 1.15);
        }
        const ctx = this.canvas.getContext('2d'); ctx.clearRect(0, 0, w, h); ctx.putImageData(img, 0, 0);
      }
    }
    return new HeatOverlay();
  },

  // Old Leaflet map, kept only as a fallback when Google Maps cannot load
  initLeafletFallback(incidents) {
    this.initLeafletMapLegacy(incidents);
  },

  initLeafletMapLegacy(incidents) {
    const mapElement = document.getElementById('pawtrack-leaflet-map');
    if (!mapElement) return;

    const currentDistrict = (this.qcDistricts && this.qcDistricts[this.selectedDistrict]) ? this.qcDistricts[this.selectedDistrict] : this.qcDistricts['all'];
    const defaultCenter = currentDistrict ? currentDistrict.center : [14.6760, 121.0550];
    const defaultZoom = currentDistrict ? currentDistrict.zoom : 12.8;

    if (this.mapInstance) {
      try { this.mapInstance.remove(); } catch (e) {}
      this.mapInstance = null;
    }

    if (typeof L === 'undefined') return;

    this.mapInstance = L.map(mapElement, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      attributionControl: false
    });


    // Layer URL mapping
    let tileUrl = 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    let subdomains = ['mt0', 'mt1', 'mt2', 'mt3'];

    if (this.selectedLayer === 'satellite') {
      tileUrl = 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}';
    } else if (this.selectedLayer === 'terrain') {
      tileUrl = 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
    } else if (this.selectedLayer === 'osm') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = ['a', 'b', 'c'];
    }

    this.tileLayerInstance = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: subdomains
    }).addTo(this.mapInstance);

    // Heatmap density cluster points
    const heatPoints = incidents.map(inc => [inc.lat, inc.lng, inc.status === 'lost' ? 0.95 : 0.7]);

    if (typeof L.heatLayer === 'function') {
      this.heatLayer = L.heatLayer(heatPoints, {
        radius: 46,
        blur: 30,
        maxZoom: 16,
        max: 1.0,
        gradient: {
          0.15: '#22c55e',
          0.45: '#eab308',
          0.72: '#f97316',
          1.00: '#ef4444'
        }
      }).addTo(this.mapInstance);
    }

    // Add Markers Layer
    this.markersLayer = L.layerGroup().addTo(this.mapInstance);

    incidents.forEach(inc => {
      const isBlue = inc.color === '#2563eb' || inc.status === 'found';
      const markerColor = isBlue ? '#2563eb' : '#ea580c';
      const ringColor = isBlue ? 'rgba(37, 99, 235, 0.35)' : 'rgba(234, 88, 12, 0.35)';

      const customIcon = L.divIcon({
        className: 'pawtrack-map-marker',
        html: `
          <div class="marker-pulse-wrapper" style="--ring-color: ${ringColor}; --dot-color: ${markerColor};">
            <div class="marker-pulse-ring"></div>
            <div class="marker-center-dot" style="background: ${markerColor}; border: 2.5px solid #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.45);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14]
      });

      const popupHtml = `
        <div class="pawtrack-infowindow-card">
          <div class="infowindow-header">
            <div>
              <div class="infowindow-id">${inc.name} (${inc.id})</div>
              <div class="infowindow-species">${inc.speciesTag}</div>
            </div>
            <button class="infowindow-close-btn" onclick="window.HeatmapView.mapInstance.closePopup()">✕</button>
          </div>

          <div class="infowindow-status-banner">
            <span class="status-label">Status:</span>
            <strong class="status-val-lost">${inc.status.toUpperCase()}</strong>
          </div>

          <div class="infowindow-details-list">
            <div class="infowindow-row">
              <span class="row-key">Location:</span>
              <span class="row-val">${inc.location}</span>
            </div>
            <div class="infowindow-row">
              <span class="row-key">District:</span>
              <span class="row-val">${inc.district}</span>
            </div>
            <div class="infowindow-row">
              <span class="row-key">Contact:</span>
              <span class="row-val">${inc.contact} (${inc.phone})</span>
            </div>
            <div class="infowindow-row">
              <span class="row-key">Coords:</span>
              <span class="row-val mono">${inc.lat.toFixed(4)}, ${inc.lng.toFixed(4)}</span>
            </div>
          </div>

        </div>
      `;

      const marker = L.marker([inc.lat, inc.lng], { icon: customIcon })
        .bindPopup(popupHtml, { maxWidth: 320, minWidth: 260, className: 'pawtrack-custom-infowindow-popup' });

      this.markersLayer.addLayer(marker);
    });

    setTimeout(() => {
      if (this.mapInstance) this.mapInstance.invalidateSize();
    }, 250);
  },

  getSearchSuggestions(rawQuery) {
    if (!rawQuery || rawQuery.trim().length < 1) return [];
    const q = rawQuery.trim().toLowerCase();
    const suggestions = [];

    // Check landmarks
    (this.landmarksDirectory || []).forEach(l => {
      const nameMatch = l.name.toLowerCase().includes(q);
      const aliasMatch = (l.aliases || []).some(a => a.toLowerCase().includes(q));
      if (nameMatch || aliasMatch) {
        suggestions.push({
          type: 'landmark',
          title: l.name,
          subtitle: l.desc,
          lat: l.lat,
          lng: l.lng,
          icon: '📍'
        });
      }
    });

    // Check incidents
    (this.incidentsData || []).forEach(inc => {
      const nameMatch = (inc.name || '').toLowerCase().includes(q);
      const locMatch = (inc.location || '').toLowerCase().includes(q);
      const bgMatch = (inc.barangay || '').toLowerCase().includes(q);
      if (nameMatch || locMatch || bgMatch) {
        suggestions.push({
          type: 'incident',
          title: `${inc.name} (${inc.species})`,
          subtitle: `${inc.barangay} · ${inc.location}`,
          lat: inc.lat,
          lng: inc.lng,
          id: inc.id,
          icon: (inc.species || '').toLowerCase() === 'cat' ? '🐈' : '🐕'
        });
      }
    });

    return suggestions.slice(0, 6);
  },

  directToLocationOrLandmark(rawQuery) {
    if (!rawQuery || !rawQuery.trim() || !this.mapInstance) return false;
    const q = rawQuery.trim().toLowerCase();

    // 1. Search in landmarks directory
    let matchedLandmark = (this.landmarksDirectory || []).find(l => {
      const nameMatch = l.name.toLowerCase().includes(q) || q.includes(l.name.toLowerCase());
      const aliasMatch = (l.aliases || []).some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()));
      return nameMatch || aliasMatch;
    });

    if (matchedLandmark) {
      this.flyToLocationWithPin(matchedLandmark.lat, matchedLandmark.lng, matchedLandmark.name, matchedLandmark.desc, '📍 Landmark');
      return true;
    }

    // 2. Search in incident records database
    let matchedIncident = (this.incidentsData || []).find(inc => {
      const nameMatch = (inc.name || '').toLowerCase().includes(q);
      const locMatch = (inc.location || '').toLowerCase().includes(q);
      const bgMatch = (inc.barangay || '').toLowerCase().includes(q);
      return nameMatch || locMatch || bgMatch;
    });

    if (matchedIncident) {
      this.flyToIncident(matchedIncident.lat, matchedIncident.lng, matchedIncident.id);
      return true;
    }

    // 3. Fallback: Check if user typed coordinates like "14.68, 121.08"
    const coordParts = q.split(/[\s,]+/);
    if (coordParts.length >= 2) {
      const lat = parseFloat(coordParts[0]);
      const lng = parseFloat(coordParts[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat > 10 && lat < 20 && lng > 115 && lng < 130) {
        this.flyToLocationWithPin(lat, lng, 'Target Coordinates', `${lat.toFixed(4)}, ${lng.toFixed(4)}`, '🎯 GPS');
        return true;
      }
    }

    if (window.adminApp && window.adminApp.showToast) {
      window.adminApp.showToast(`No exact landmark for "${rawQuery}". Filtered incidents shown.`, 'info', 2000);
    }
    return false;
  },

  flyToLocationWithPin(lat, lng, title, subtitle, tag = '📍') {
    this._noFitUntil = Date.now() + 1500;
    if (!this.mapInstance || isNaN(lat) || isNaN(lng)) return;

    this.mapInstance.flyTo([lat, lng], 16.5, {
      duration: 1.2,
      easeLinearity: 0.25
    });

    // Remove old search marker if any
    if (this.searchLocationMarker) {
      try { this.mapInstance.removeLayer(this.searchLocationMarker); } catch (e) {}
      this.searchLocationMarker = null;
    }

    if (this.gmap) {
      const content = document.createElement('div');
      content.innerHTML = `
        <div class="search-pin-pulse-wrapper">
          <div class="search-pin-pulse"></div>
          <div class="search-pin-badge"><span class="pin-icon">📍</span></div>
        </div>`;
      const marker = new google.maps.marker.AdvancedMarkerElement({ map: this.gmap, position: { lat, lng }, content, title });
      this.searchLocationMarker = marker;
      const html = `
        <div style="padding: 10px 12px; font-family: var(--font-sans); min-width: 200px;">
          <div style="font-size: 10px; font-weight: 800; font-family: var(--font-mono); color: #ea580c; text-transform: uppercase; margin-bottom: 2px;">${this.esc(tag)}</div>
          <div style="font-size: 13.5px; font-weight: 800; color: #111827; line-height: 1.25;">${this.esc(title)}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${this.esc(subtitle)}</div>
          <div style="font-size: 10px; font-family: var(--font-mono); color: #9ca3af; margin-top: 4px;">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</div>
        </div>`;
      this.infoWindow.setContent(html);
      this.infoWindow.open({ map: this.gmap, anchor: marker });
    } else if (typeof L !== 'undefined') {
      const pinIcon = L.divIcon({
        className: 'pawtrack-search-pin-marker',
        html: `
          <div class="search-pin-pulse-wrapper">
            <div class="search-pin-pulse"></div>
            <div class="search-pin-badge">
              <span class="pin-icon">📍</span>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });

      const popupHtml = `
        <div style="padding: 10px 12px; font-family: var(--font-sans); min-width: 200px;">
          <div style="font-size: 10px; font-weight: 800; font-family: var(--font-mono); color: #ea580c; text-transform: uppercase; margin-bottom: 2px;">${tag}</div>
          <div style="font-size: 13.5px; font-weight: 800; color: #111827; line-height: 1.25;">${title}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${subtitle}</div>
          <div style="font-size: 10px; font-family: var(--font-mono); color: #9ca3af; margin-top: 4px;">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</div>
        </div>
      `;

      this.searchLocationMarker = L.marker([lat, lng], { icon: pinIcon })
        .addTo(this.mapInstance)
        .bindPopup(popupHtml)
        .openPopup();
    }

    document.getElementById('heatmap-map-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  flyToDistrict(districtKey) {
    const districtInfo = (this.qcDistricts && this.qcDistricts[districtKey]) ? this.qcDistricts[districtKey] : this.qcDistricts['all'];
    if (!districtInfo) return;

    if (this.mapInstance && districtInfo.center) {
      this.mapInstance.flyTo(districtInfo.center, districtInfo.zoom, {
        duration: 1.2,
        easeLinearity: 0.25
      });
    }
  },

  flyToIncident(lat, lng, incidentId) {
    this._noFitUntil = Date.now() + 1500;
    if (this.mapInstance && !isNaN(lat) && !isNaN(lng)) {
      const marker = this.gMarkerById && this.gMarkerById[String(incidentId)];
      const inc = marker && (this.incidentsData || []).find(i => String(i.id) === String(incidentId));
      if (marker && inc) setTimeout(() => this.openIncidentPopup(inc, marker), 450);
      this.mapInstance.flyTo([lat, lng], 16, {
        duration: 1.2,
        easeLinearity: 0.25
      });

      // Scroll map into view smoothly
      document.getElementById('heatmap-map-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
};
