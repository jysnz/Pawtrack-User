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
  selectedDateRange: '30d', // 'all' | 'today' | '7d' | '30d' | 'custom'. Opens on the last 30 days: old cases are history, not today's hotspots
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

  // ----- The facility's scope: its city (and, for a sub-facility, the barangays it covers) -----
  // The map and every figure on this page describe only that area.
  scope() {
    const store = window.adminStore;
    const f = store && typeof store.getActiveFacility === 'function' ? store.getActiveFacility() : null;
    if (!f) return null;
    const b = f.cityBounds;
    const ok = b && ['north', 'south', 'east', 'west'].every(k => Number.isFinite(+b[k]));
    let bounds = ok ? { north: +b.north, south: +b.south, east: +b.east, west: +b.west } : null;
    let fromPin = false;
    if (!bounds) {
      // No city boundary saved for this facility: its scope is the area around where it stands (about 5 km each way).
      // A main facility's scope also covers its sub-facilities.
      const R = 0.045;
      const subs = (store.getShelters() || []).filter(s => s.parentId === f.id);
      const pts = [f, ...subs].filter(s => Number.isFinite(+s.lat) && Number.isFinite(+s.lng) && s.lat !== null && s.lng !== null);
      if (pts.length) {
        bounds = {
          north: Math.max(...pts.map(s => +s.lat)) + R, south: Math.min(...pts.map(s => +s.lat)) - R,
          east: Math.max(...pts.map(s => +s.lng)) + R, west: Math.min(...pts.map(s => +s.lng)) - R
        };
        fromPin = true;
      }
    }
    // A sub-facility's map is the barangays it covers: their areas, once looked up, replace the area around its pin
    const names = Array.isArray(f.coverage) ? f.coverage.map(x => String(x || '').trim()).filter(Boolean) : [];
    if (f.parentId && names.length && this._brgyBounds && this._brgyBounds.key === `${f.city}|${names.join('|')}`) {
      bounds = this._brgyBounds.bounds;
      fromPin = false;
    }
    return {
      facility: f,
      city: f.city || '',
      bounds,
      fromPin,
      barangays: Array.isArray(f.coverage) ? f.coverage.map(x => String(x || '').trim()).filter(Boolean) : []
    };
  },

  isQuezonCity(scope) {
    return !scope || !scope.city || /quezon|\bqc\b/i.test(scope.city);
  },

  scopeLabel(scope) {
    if (!scope) return 'Quezon City';
    if (scope.barangays.length || scope.fromPin) return `${scope.facility.name}'s area`;
    return scope.city || `${scope.facility.name}'s area`;
  },

  inScope(inc, scope) {
    if (!scope) return true;
    const b = scope.bounds;
    if (b && !(inc.lat >= b.south && inc.lat <= b.north && inc.lng >= b.west && inc.lng <= b.east)) return false;
    if (scope.barangays.length && !inc.needsGeo) {
      const norm = (t) => String(t || '').toLowerCase().replace(/^barangay\s+|^brgy\.?\s+/, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      const hay = norm(`${inc.location} ${inc.barangay}`);
      return scope.barangays.some(name => { const n = norm(name); return n && hay.includes(n); });
    }
    return true;
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
        linkedToCase: !!s.missing_report_id,
        location: s.location || '',
        photoUrl: s.photoUrl || '',
        contact: s.reporterName || 'Community report',
        phone: '',
        lat: +s.coords[0], lng: +s.coords[1],
        ts: this.toTs(s.dateTimeSeen || s.createdAt)
      }));
    });

    const scope = this.scope();
    return list.filter(i => this.inScope(i, scope));
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
    const sc = this.scope();
    const cityLabel = sc && !this.isQuezonCity(sc) ? sc.city : null;
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
          city: cityLabel || (district === 'Outside QC' ? 'Outside Quezon City' : `Quezon City (${district})`),
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
    return this.selectedDateRange !== '30d' || this.selectedAnimal !== 'all' || this.selectedStatus !== 'all'
      || this.selectedDistrict !== 'all' || !!(this.searchQuery && this.searchQuery.trim());
  },

  // Builds the page shell once; later calls only refresh the data so the map is not rebuilt on every filter change.
  render(container) {
    // An account that has not joined or created a facility has nothing to show here yet: only the way in, no map
    const store = window.adminStore;
    const account = store && typeof store.currentAdmin === 'function' ? store.currentAdmin() : null;
    if (account && typeof store.hasFacility === 'function' && !store.hasFacility()) {
      window.AdminNoFacility.render(container, 'Heatmap', 'This map shows where animals are reported in your facility\'s area.');
      return;
    }
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
    // Arrived from the Reports page: fly to that report once the map is ready
    const want = this._pendingFly;
    if (want) {
      this._pendingFly = null;
      let tries = 0;
      const go = () => {
        if (!document.getElementById('hm-root')) return;
        if (this.gmap || this.mapInstance) {
          this.flyToIncident(want.lat, want.lng, want.id);
          // The page resets its scroll position after the view swaps in, so bring the map into view again once that has settled
          [150, 500].forEach(ms => setTimeout(() => document.getElementById('heatmap-map-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), ms));
          return;
        }
        if (++tries < 40) setTimeout(go, 250);
      };
      go();
    }
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
            <div class="subtitle"><span id="hm-subtitle-text">Where lost and stray animals are being reported across Quezon City, live from the database</span></div>
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
            <select id="select-range-filter" class="hm-select" aria-label="Period">
              ${[['all', 'All time'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days']].map(([v, l]) => `<option value="${v}" ${this.selectedDateRange === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="hm-field">
            <span class="hm-label">Animal</span>
            <select id="select-animal-filter" class="hm-select" aria-label="Animal">
              ${[['all', 'All animals'], ['dog', 'Dogs'], ['cat', 'Cats'], ['other', 'Other']].map(([v, l]) => `<option value="${v}" ${this.selectedAnimal === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
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
          <div class="hm-field" id="hm-brgy-field" hidden>
            <span class="hm-label">Barangay</span>
            <select id="select-barangay-filter" class="hm-select" aria-label="Go to a barangay"></select>
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
                <select id="select-layer" class="hm-layer-select" aria-label="Map type">
                  ${[['roadmap', 'Map'], ['satellite', 'Satellite'], ['terrain', 'Terrain']].map(([v, l]) => `<option value="${v}" ${this.selectedLayer === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
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

    // The page describes the facility's own area only
    const scope = this.scope();
    const sub = root.querySelector('#hm-subtitle-text');
    if (sub) sub.textContent = `Where lost and stray animals are being reported in ${this.scopeLabel(scope)}, live from the database`;
    // Districts are a Quezon City idea: other cities have none to filter by
    const dsField = root.querySelector('#select-district-filter') && root.querySelector('#select-district-filter').closest('.hm-field');
    const showDistricts = this.isQuezonCity(scope) && !(scope && scope.barangays.length);
    if (dsField) dsField.hidden = !showDistricts;
    if (!showDistricts && this.selectedDistrict !== 'all') this.selectedDistrict = 'all';

    if (scope && scope.facility.parentId && scope.barangays.length) this.loadBarangayBounds();
    // A sub-facility that covers several barangays gets a dropdown to move the map between them
    const brgyField = root.querySelector('#hm-brgy-field');
    const brgySel = root.querySelector('#select-barangay-filter');
    if (brgyField && brgySel) {
      const list = scope ? scope.barangays : [];
      brgyField.hidden = list.length < 2;
      const key = list.join('|');
      if (brgySel.dataset.key !== key) {
        brgySel.dataset.key = key;
        brgySel.innerHTML = `<option value="">All covered barangays</option>${list.map(n => `<option value="${this.esc(n)}">${this.esc(n)}</option>`).join('')}`;
        this.selectedBarangay = '';
      }
      brgySel.value = this.selectedBarangay || '';
    }

    // Toolbar state
    const rg = root.querySelector('#select-range-filter'); if (rg) rg.value = this.selectedDateRange;
    const an = root.querySelector('#select-animal-filter'); if (an) an.value = this.selectedAnimal;
    const ly = root.querySelector('#select-layer'); if (ly) ly.value = this.selectedLayer;
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



    this.initLeafletMap(filtered);
  },

  bindEvents(root) {
    const rerender = () => { this.currentPage = 1; this.refresh(); };

    root.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('#btn-reset-heatmap-filters')) {
        Object.assign(this, { selectedDateRange: '30d', selectedAnimal: 'all', selectedStatus: 'all', selectedDistrict: 'all', searchQuery: '', currentPage: 1 });
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
      if (e.target.id === 'select-layer') {
        this.selectedLayer = e.target.value;
        if (this.gmap) this.gmap.setMapTypeId(this.googleMapType()); else this.initLeafletMap(this.getFilteredIncidents());
        return;
      }
      if (e.target.id === 'select-range-filter') { this.selectedDateRange = e.target.value; rerender(); }
      if (e.target.id === 'select-animal-filter') { this.selectedAnimal = e.target.value; rerender(); }
      if (e.target.id === 'select-status-filter') { this.selectedStatus = e.target.value; rerender(); }
      else if (e.target.id === 'select-district-filter') { this.selectedDistrict = e.target.value; rerender(); }
      else if (e.target.id === 'select-barangay-filter') { this.selectedBarangay = e.target.value; this.goToBarangay(e.target.value); }
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
        colorScheme: (google.maps.ColorScheme ? (document.documentElement.getAttribute('data-theme') === 'dark' ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT) : undefined),
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
    // Found pets are resolved and do not heat the map; a sighting of an already reported pet is the same case, so it counts little.
    const weight = (i) => {
      const base = i.status === 'lost' ? 0.6 : i.status === 'sighting' ? (i.linkedToCase ? 0.15 : 0.45) : 0;
      const ageDays = i.ts ? (Date.now() - i.ts) / 86400000 : 30;
      return base * Math.max(0.55, 1 - (ageDays / 90) * 0.45);
    };
    if (!this.heatOverlay) this.heatOverlay = this.createHeatOverlay(this.gmap);
    // Heat points snap to a ~110 m grid: hotspots read the same, but the layer does not reveal an exact home-adjacent spot
    this.heatOverlay.setPoints(incidents.map(i => ({ lat: Math.round(i.lat * 1000) / 1000, lng: Math.round(i.lng * 1000) / 1000, w: weight(i) })).filter(p => p.w > 0));
    this.heatOverlay.setVisible(this.showHeat);

    this.applyScopeToMap();
    this.fitToIncidents(incidents);
    return true;
  },

  // A zoom level that shows the whole scope, worked out from its size (not from the map's pixels)
  scopeZoom(b) {
    const span = Math.max(b.north - b.south, b.east - b.west, 0.005);
    return Math.max(9, Math.min(16, Math.floor(Math.log2(360 / span))));
  },

  // Frames the map on the scope. Centre and zoom are set first, so the map can never be left showing the whole world
  // (fitBounds on a map that has no size yet zooms all the way out); fitBounds then refines it once the map has a size.
  frameScope(b, tries = 0) {
    const g = this.gmap;
    if (!g || !b) return;
    const center = { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 };
    const guess = this.scopeZoom(b);
    g.setCenter(center);
    g.setZoom(guess);
    const el = g.getDiv();
    if (el && el.clientWidth > 50 && el.clientHeight > 50) {
      g.fitBounds(b, 20);
      google.maps.event.addListenerOnce(g, 'idle', () => {
        if (g.getZoom() < guess - 2) { g.setCenter(center); g.setZoom(guess); }
      });
    } else if (tries < 24) {
      setTimeout(() => { if (this.gmap === g) this.frameScope(b, tries + 1); }, 250); // the page is still laying out
    }
  },

  // Looks a barangay up (Google, else OpenStreetMap) -> { lat, lng, viewport } or null. Remembered.
  async lookupBarangay(name, city) {
    this._brgyCache = this._brgyCache || {};
    const query = `${name}, ${city ? city + ', ' : ''}Philippines`;
    if (this._brgyCache[query]) return this._brgyCache[query];
    let spot = null;
    try {
      await window.PawGoogleMaps.load();
      const { Geocoder } = await google.maps.importLibrary('geocoding');
      const { results } = await new Geocoder().geocode({ address: query, region: 'ph' });
      if (results && results[0]) {
        const loc = results[0].geometry.location;
        spot = { lat: loc.lat(), lng: loc.lng(), viewport: results[0].geometry.viewport ? results[0].geometry.viewport.toJSON() : null };
      }
    } catch (e) { /* fall through to the other lookup */ }
    if (!spot) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
        const hit = (await res.json())[0];
        if (hit) spot = { lat: +hit.lat, lng: +hit.lon, viewport: null };
      } catch (e) { /* offline */ }
    }
    if (spot) this._brgyCache[query] = spot;
    return spot;
  },

  // Works out the area of all the barangays a sub-facility covers, then redraws the page limited to it
  async loadBarangayBounds() {
    const f = window.adminStore && window.adminStore.getActiveFacility && window.adminStore.getActiveFacility();
    if (!f || !f.parentId) return;
    const names = (f.coverage || []).map(x => String(x || '').trim()).filter(Boolean);
    if (!names.length) return;
    const key = `${f.city}|${names.join('|')}`;
    if ((this._brgyBounds && this._brgyBounds.key === key) || this._brgyLoading === key) return;
    this._brgyLoading = key;
    const spots = (await Promise.all(names.map(n => this.lookupBarangay(n, f.city)))).filter(Boolean);
    this._brgyLoading = null;
    if (!spots.length) return;
    const pad = 0.012;
    const b = { north: -90, south: 90, east: -180, west: 180 };
    spots.forEach((s) => {
      const v = s.viewport || { north: s.lat + pad, south: s.lat - pad, east: s.lng + pad, west: s.lng - pad };
      b.north = Math.max(b.north, v.north); b.south = Math.min(b.south, v.south); b.east = Math.max(b.east, v.east); b.west = Math.min(b.west, v.west);
    });
    this._brgyBounds = { key, bounds: b };
    this._scopeKey = '';
    if (window.adminApp && window.adminApp.currentRoute === 'heatmap') window.adminApp.renderView('heatmap');
  },

  // Moves the map to a covered barangay. The place is looked up once (Google, else OpenStreetMap) and remembered.
  async goToBarangay(name) {
    if (!this.gmap) return;
    if (!name) { this._noFitUntil = 0; this._fitKey = ''; return this.fitToIncidents(this.getFilteredIncidents(), true); }
    const scope = this.scope();
    this._brgyCache = this._brgyCache || {};
    const query = `${name}, ${scope && scope.city ? scope.city + ', ' : ''}Philippines`;
    let spot = this._brgyCache[query];
    if (!spot) {
      try {
        await window.PawGoogleMaps.load();
        const { Geocoder } = await google.maps.importLibrary('geocoding');
        const { results } = await new Geocoder().geocode({ address: query, region: 'ph' });
        if (results && results[0]) {
          const loc = results[0].geometry.location;
          spot = { lat: loc.lat(), lng: loc.lng(), viewport: results[0].geometry.viewport ? results[0].geometry.viewport.toJSON() : null };
        }
      } catch (e) { /* fall through to the other lookup */ }
      if (!spot) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
          const hit = (await res.json())[0];
          if (hit) spot = { lat: +hit.lat, lng: +hit.lon, viewport: null };
        } catch (e) { /* offline */ }
      }
      if (spot) this._brgyCache[query] = spot;
    }
    if (!spot) { window.adminApp && window.adminApp.showToast(`Could not find ${name} on the map.`, 'warning'); return; }
    this._noFitUntil = Date.now() + 8000; // a re-render must not undo the move
    if (spot.viewport) this.gmap.fitBounds(spot.viewport, 20); else { this.gmap.panTo({ lat: spot.lat, lng: spot.lng }); this.gmap.setZoom(15); }
  },

  // Keeps the map inside the facility's scope (its city or the area around it); nothing is drawn on the map for it
  applyScopeToMap() {
    if (!this.gmap) return;
    const scope = this.scope();
    const key = scope && scope.bounds ? `${scope.facility.id}|${JSON.stringify(scope.bounds)}` : 'none';
    if (this._scopeKey === key && this._scopeMap === this.gmap) return;
    this._scopeKey = key;
    this._scopeMap = this.gmap;
    if (this._scopeRect) { this._scopeRect.setMap(null); this._scopeRect = null; }
    if (!scope || !scope.bounds) { this.gmap.setOptions({ restriction: null, minZoom: null }); return; }
    // No zooming out past the scope: the world view is never reachable
    this.gmap.setOptions({ restriction: { latLngBounds: scope.bounds, strictBounds: false }, minZoom: Math.max(8, this.scopeZoom(scope.bounds) - 3) });
    this._fitKey = ''; // frame the new scope
  },

  // Frames the map around the reports in view (or the chosen district when there are none).
  // Skipped right after a deliberate "fly to", and when the set of reports has not changed.
  fitToIncidents(incidents, force = false) {
    if (!this.gmap) return;
    const key = incidents.map(i => i.id).sort().join('|') + '#' + this.selectedDistrict + '#' + (this._scopeKey || '');
    if (!force && (key === this._fitKey || Date.now() < this._noFitUntil)) { this._fitKey = key; return; }
    this._fitKey = key;
    const sc = this.scope();
    // The map is based on the facility's scope: always framed on it, whatever the reports are
    if (sc && sc.bounds) { this.frameScope(sc.bounds); return; }
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
        <div class="infowindow-details-list">
          <div class="infowindow-row"><span class="row-key">Status:</span><span class="row-val"><strong class="status-val-lost">${this.esc(inc.status.toUpperCase())}</strong></span></div>
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

    const sc = this.scope();
    this.mapInstance = L.map(mapElement, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      attributionControl: false
    });
    // Keep the fallback map inside the facility's scope too
    if (sc && sc.bounds && typeof L.latLngBounds === 'function') {
      const lb = L.latLngBounds([sc.bounds.south, sc.bounds.west], [sc.bounds.north, sc.bounds.east]);
      this.mapInstance.setMaxBounds(lb.pad(0.1));
      this.mapInstance.setMinZoom(Math.max(8, this.scopeZoom(sc.bounds) - 3));
      this.mapInstance.setView([(sc.bounds.north + sc.bounds.south) / 2, (sc.bounds.east + sc.bounds.west) / 2], this.scopeZoom(sc.bounds));
      setTimeout(() => { try { this.mapInstance && this.mapInstance.invalidateSize(); } catch (e) {} }, 300);
    }


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
    const heatPoints = incidents.filter(inc => inc.status !== 'found')
      .map(inc => [Math.round(inc.lat * 1000) / 1000, Math.round(inc.lng * 1000) / 1000, inc.status === 'lost' ? 0.95 : (inc.linkedToCase ? 0.25 : 0.7)]);

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
              <div class="infowindow-id">${this.esc(inc.name)} (${this.esc(inc.id)})</div>
              <div class="infowindow-species">${this.esc(inc.speciesTag)}</div>
            </div>
            <button class="infowindow-close-btn" onclick="window.HeatmapView.mapInstance.closePopup()">✕</button>
          </div>

          <div class="infowindow-details-list">
          <div class="infowindow-row"><span class="row-key">Status:</span><span class="row-val"><strong class="status-val-lost">${this.esc(String(inc.status).toUpperCase())}</strong></span></div>
            <div class="infowindow-row">
              <span class="row-key">Location:</span>
              <span class="row-val">${this.esc(inc.location)}</span>
            </div>
            <div class="infowindow-row">
              <span class="row-key">District:</span>
              <span class="row-val">${this.esc(inc.district)}</span>
            </div>
            <div class="infowindow-row">
              <span class="row-key">Contact:</span>
              <span class="row-val">${this.esc(inc.contact)} (${this.esc(inc.phone)})</span>
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
          <div style="font-size: 10px; font-weight: 800; font-family: var(--font-mono); color: #ea580c; text-transform: uppercase; margin-bottom: 2px;">${this.esc(tag)}</div>
          <div style="font-size: 13.5px; font-weight: 800; color: #111827; line-height: 1.25;">${this.esc(title)}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${this.esc(subtitle)}</div>
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
      document.getElementById('heatmap-map-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
};
