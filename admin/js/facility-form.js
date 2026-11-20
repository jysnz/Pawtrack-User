/**
 * PawTrack Admin — facility form widgets
 *
 *   FacilityForm.phone   Philippine phone numbers: a fixed +63 prefix and digits only
 *   FacilityForm.hours   operating hours chosen from day chips and time dropdowns (nothing to type)
 *   FacilityForm.MapPicker   choose the facility's location: click the map or drag the pin, or look an address up
 *
 * The phone and hours helpers are plain functions so they can be tested without a browser.
 */
(function () {
  'use strict';

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ==========================================================================
  // Phone: +63 is always there, so the field only holds the digits after it.
  //   mobile    10 digits starting with 9           917 123 4567
  //   landline  8-10 digits including the area code  2 8123 4567
  // ==========================================================================
  const phone = {
    // Digits after +63, whatever was typed or pasted ("+63 917 123 4567", "0917 123 4567", "917...")
    digits(raw) {
      let d = String(raw == null ? '' : raw).replace(/\D/g, '');
      if (d.startsWith('63') && d.length > 10) d = d.slice(2); // a pasted international number
      if (d.startsWith('0')) d = d.slice(1);                    // the national trunk prefix
      return d.slice(0, 10);
    },

    isValid(d) {
      return d === '' || /^9\d{9}$/.test(d) || /^[2-8]\d{7,9}$/.test(d);
    },

    message: 'Enter a mobile number (10 digits starting with 9) or a landline with its area code.',

    toStored(d) {
      return d ? '+63' + d : '';
    },

    // "+639171234567" -> "+63 917 123 4567"
    format(stored) {
      const d = phone.digits(stored);
      if (!d) return String(stored || '');
      if (/^9\d{9}$/.test(d)) return `+63 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
      if (d.length === 9 && d[0] === '2') return `+63 2 ${d.slice(1, 5)} ${d.slice(5)}`;
      if (d.length >= 8) return `+63 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`.trim();
      return `+63 ${d}`;
    },

    // The input shows only the digits; anything else typed or pasted is dropped on the spot
    bind(input) {
      const check = () => input.setCustomValidity(phone.isValid(input.value) ? '' : phone.message);
      // A typed letter or symbol never lands in the box. Pasted or autofilled text is cleaned by the input handler below.
      input.addEventListener('beforeinput', (e) => {
        if (e.inputType === 'insertText' && e.data && e.data.length === 1 && /\D/.test(e.data)) e.preventDefault();
      });
      input.addEventListener('input', () => {
        const clean = phone.digits(input.value);
        if (input.value !== clean) input.value = clean;
        check();
      });
      check();
    }
  };

  // ==========================================================================
  // Operating hours: one or more schedules. Each schedule is a set of days with its own opening and closing times
  // (or 24 hours). A day that is in no schedule is closed, and is saved as such:
  //   "Mon-Fri: 8:00 AM - 5:00 PM; Sat: 8:00 AM - 12:00 PM; Sun: Closed"
  // ==========================================================================
  const hours = {
    // 12:00 AM ... 11:30 PM in half-hour steps
    TIMES: Array.from({ length: 48 }, (_, i) => {
      const h = Math.floor(i / 2), m = i % 2 ? 30 : 0;
      return { v: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
    }).map((t) => ({ ...t, label: hoursTimeLabel(t.v) })),

    defaultRow() {
      return { days: [0, 1, 2, 3, 4], open: '08:00', close: '17:00', allDay: false };
    },

    defaultModel() {
      return { rows: [hours.defaultRow()] };
    },

    // [0,1,2,3,4] -> "Mon-Fri", [0,2,4] -> "Mon, Wed, Fri", all seven -> "Daily"
    daysLabel(days) {
      const s = [...new Set(days)].sort((a, b) => a - b);
      if (!s.length) return '';
      if (s.length === 7) return 'Daily';
      const runs = [];
      let start = s[0], prev = s[0];
      for (let i = 1; i <= s.length; i++) {
        if (i < s.length && s[i] === prev + 1) { prev = s[i]; continue; }
        runs.push([start, prev]);
        start = s[i]; prev = s[i];
      }
      return runs.map(([a, b]) => (b - a >= 2 ? `${DAYS[a]}-${DAYS[b]}` : (b > a ? `${DAYS[a]}, ${DAYS[b]}` : DAYS[a]))).join(', ');
    },

    rowText(row) {
      return row.allDay ? 'Open 24 hours' : `${hoursTimeLabel(row.open)} - ${hoursTimeLabel(row.close)}`;
    },

    // The text that is saved and shown to everyone
    format(model) {
      const rows = (model.rows || []).filter((r) => r.days.length).slice().sort((a, b) => Math.min(...a.days) - Math.min(...b.days));
      if (!rows.length) return '';
      const parts = rows.map((r) => `${hours.daysLabel(r.days)}: ${hours.rowText(r)}`);
      const covered = new Set(rows.flatMap((r) => r.days));
      const closed = DAYS.map((_, i) => i).filter((i) => !covered.has(i));
      if (closed.length) parts.push(`${hours.daysLabel(closed)}: Closed`);
      return parts.join('; ');
    },

    // Reads that text back into the pickers; null for older free-typed text
    parse(text) {
      const raw = String(text || '').trim();
      if (!raw) return null;
      const to24 = (h, mi, ap) => `${String((Number(h) % 12) + (ap === 'PM' ? 12 : 0)).padStart(2, '0')}:${mi}`;
      const rows = [];
      const seen = new Set();
      for (const group of raw.split(';')) {
        const m = /^(.+?):\s*(Open 24 hours|Closed|(\d{1,2}):(\d{2}) (AM|PM)\s*-\s*(\d{1,2}):(\d{2}) (AM|PM))$/.exec(group.trim());
        if (!m) return null;
        const days = parseDays(m[1]);
        if (!days || days.some((d) => seen.has(d))) return null;
        days.forEach((d) => seen.add(d));
        if (m[2] === 'Closed') continue; // closed days are simply the ones no schedule covers
        rows.push(m[2] === 'Open 24 hours'
          ? { days, open: '08:00', close: '17:00', allDay: true }
          : { days, open: to24(m[3], m[4], m[5]), close: to24(m[6], m[7], m[8]), allDay: false });
      }
      return rows.length ? { rows } : null;
    },

    // null when fine, otherwise what to tell the person
    validate(model) {
      const rows = model.rows || [];
      if (!rows.some((r) => r.days.length)) return 'Choose at least one open day.';
      if (rows.some((r) => !r.days.length)) return 'Choose the days for every schedule, or remove the empty one.';
      const seen = new Set();
      for (const r of rows) {
        for (const d of r.days) {
          if (seen.has(d)) return `${DAYS[d]} is in more than one schedule.`;
          seen.add(d);
        }
      }
      for (const r of rows) {
        if (!r.allDay && r.close <= r.open) return `The closing time must be after the opening time${rows.length > 1 ? ` (${hours.daysLabel(r.days)})` : ''}.`;
      }
      return null;
    },

    rowsHtml(rows) {
      const times = (selected) => {
        // keep an unusual saved time selectable
        const list = hours.TIMES.some((t) => t.v === selected) ? hours.TIMES : [...hours.TIMES, { v: selected, label: hoursTimeLabel(selected) }].sort((a, b) => a.v.localeCompare(b.v));
        return list.map((t) => `<option value="${t.v}" ${selected === t.v ? 'selected' : ''}>${t.label}</option>`).join('');
      };
      return rows.map((row, i) => {
        const others = new Set(rows.flatMap((r, j) => (j === i ? [] : r.days)));
        return `
          <div class="fm-row" data-row="${i}" role="group" aria-label="${rows.length > 1 ? `Schedule ${i + 1}` : 'Opening schedule'}">
            <div class="fm-row-head">
              <span class="fm-row-title">${rows.length > 1 ? `Schedule ${i + 1}` : 'Open on'}</span>
              ${rows.length > 1 ? `<button type="button" class="fm-row-remove" data-remove="${i}" aria-label="Remove schedule ${i + 1}">&times;</button>` : ''}
            </div>
            <div class="fm-days">
              ${DAYS.map((d, k) => {
                const taken = others.has(k);
                return `<label class="fm-day ${taken ? 'is-taken' : ''}" ${taken ? 'title="Used in another schedule"' : ''}><input type="checkbox" value="${k}" ${row.days.includes(k) ? 'checked' : ''} ${taken ? 'disabled' : ''} /><span>${d}</span></label>`;
              }).join('')}
            </div>
            <div class="fm-times">
              <select class="form-control fm-open" aria-label="Opening time" ${row.allDay ? 'disabled' : ''}>${times(row.open)}</select>
              <span>to</span>
              <select class="form-control fm-close" aria-label="Closing time" ${row.allDay ? 'disabled' : ''}>${times(row.close)}</select>
              <label class="fm-24h"><input type="checkbox" class="fm-allday" ${row.allDay ? 'checked' : ''} /> Open 24 hours</label>
            </div>
          </div>`;
      }).join('');
    },

    fieldHtml(model) {
      return `
        <div class="fm-hours" id="fm-hours">
          <div class="fm-rows" id="fm-rows">${hours.rowsHtml(model.rows)}</div>
          <button type="button" class="btn btn-secondary btn-sm fm-add-row" id="fm-add-row">+ Add different hours for other days</button>
          <div class="fm-hours-preview" id="fm-hours-preview" aria-live="polite"></div>
        </div>`;
    },

    // Wires the widget inside `root`; returns { read, validate, value }
    bind(root) {
      const rowsEl = root.querySelector('#fm-rows');
      const addBtn = root.querySelector('#fm-add-row');
      const preview = root.querySelector('#fm-hours-preview');

      const read = () => ({
        rows: Array.from(rowsEl.querySelectorAll('.fm-row')).map((el) => ({
          days: Array.from(el.querySelectorAll('.fm-day input:checked')).map((c) => Number(c.value)),
          open: el.querySelector('.fm-open').value,
          close: el.querySelector('.fm-close').value,
          allDay: el.querySelector('.fm-allday').checked
        }))
      });

      const refresh = () => {
        const model = read();
        const rowEls = rowsEl.querySelectorAll('.fm-row');
        rowEls.forEach((el, i) => {
          // a day that belongs to another schedule can't be picked here
          const others = new Set(model.rows.flatMap((r, j) => (j === i ? [] : r.days)));
          el.querySelectorAll('.fm-day').forEach((label) => {
            const input = label.querySelector('input');
            const taken = others.has(Number(input.value));
            input.disabled = taken;
            label.classList.toggle('is-taken', taken);
          });
          el.querySelectorAll('.fm-open, .fm-close').forEach((s) => { s.disabled = model.rows[i].allDay; });
        });
        addBtn.disabled = model.rows.flatMap((r) => r.days).length >= 7;
        const err = hours.validate(model);
        preview.textContent = err || hours.format(model);
        preview.classList.toggle('is-error', !!err);
      };

      const draw = (model) => { rowsEl.innerHTML = hours.rowsHtml(model.rows); refresh(); };

      rowsEl.addEventListener('change', refresh);
      rowsEl.addEventListener('click', (e) => {
        const remove = e.target.closest('[data-remove]');
        if (!remove) return;
        const model = read();
        model.rows.splice(Number(remove.getAttribute('data-remove')), 1);
        draw(model);
        const first = rowsEl.querySelector('.fm-day input:not(:disabled)');
        if (first) first.focus();
      });
      addBtn.addEventListener('click', () => {
        const model = read();
        const used = new Set(model.rows.flatMap((r) => r.days));
        const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !used.has(d));
        if (!free.length) return;
        const last = model.rows[model.rows.length - 1];
        model.rows.push({ days: [free[0]], open: last ? last.open : '08:00', close: last ? last.close : '17:00', allDay: false });
        draw(model);
        const added = rowsEl.lastElementChild;
        if (added) { added.classList.add('is-new'); added.scrollIntoView({ block: 'nearest' }); }
        const openSelect = added && added.querySelector('.fm-open');
        if (openSelect) openSelect.focus();
      });

      refresh();
      return { read, validate: () => hours.validate(read()), value: () => hours.format(read()) };
    }
  };

  function hoursTimeLabel(v) {
    const [h, m] = String(v).split(':').map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  function parseDays(label) {
    const text = String(label).trim();
    if (/^daily$/i.test(text)) return [0, 1, 2, 3, 4, 5, 6];
    const idx = (name) => DAYS.findIndex((d) => d.toLowerCase() === name.trim().toLowerCase());
    const out = new Set();
    for (const token of text.split(',')) {
      const range = /^(\w{3})\s*-\s*(\w{3})$/.exec(token.trim());
      if (range) {
        const a = idx(range[1]), b = idx(range[2]);
        if (a < 0 || b < 0 || b < a) return null;
        for (let i = a; i <= b; i++) out.add(i);
      } else {
        const i = idx(token);
        if (i < 0) return null;
        out.add(i);
      }
    }
    return out.size ? [...out].sort((a, b) => a - b) : null;
  }

  // ==========================================================================
  // Map picker: click the map or drag the pin to choose the exact spot. With Google Maps it can also look an
  // address up and name the place under a pin; with the fallback map the pin is placed by hand.
  // ==========================================================================
  const MapPicker = (function () {
    const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 };
    const toLL = (p) => (p && typeof p.lat === 'function' ? { lat: p.lat(), lng: p.lng() } : { lat: Number(p.lat), lng: Number(p.lng) });
    const cityOf = (result) => {
      const comps = (result && result.address_components) || [];
      for (const type of ['locality', 'administrative_area_level_2', 'administrative_area_level_1']) {
        const c = comps.find((x) => x.types.includes(type));
        if (c) return c.long_name;
      }
      return '';
    };

    async function googleImpl(el, start, onPick) {
      const libs = await window.PawGoogleMaps.load();
      const { Map, AdvancedMarkerElement } = libs;
      const { Geocoder } = await google.maps.importLibrary('geocoding');
      el.innerHTML = '';
      const map = new Map(el, {
        center: start || DEFAULT_CENTER,
        zoom: start ? 17 : 11,
        colorScheme: (google.maps.ColorScheme ? (document.documentElement.getAttribute('data-theme') === 'dark' ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT) : undefined),
        mapId: window.PawGoogleMaps.mapId || 'DEMO_MAP_ID',
        gestureHandling: 'greedy',
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        clickableIcons: false
      });
      const geocoder = new Geocoder();
      let marker = null;
      let pin = null;
      let limit = null;   // the city's bounds, once chosen

      const place = (pos) => {
        pin = { lat: pos.lat, lng: pos.lng };
        if (!marker) {
          const content = document.createElement('div');
          content.className = 'shm-gpin is-mine';
          content.innerHTML = '<span></span>';
          marker = new AdvancedMarkerElement({ map, position: pin, content, gmpDraggable: true, title: 'Facility location (drag to adjust)' });
          marker.addListener('dragend', () => { pin = toLL(marker.position); onPick(pin); });
        } else {
          marker.position = pin;
        }
      };
      map.addListener('click', (e) => { place(toLL(e.latLng)); onPick(pin); });
      if (start) place(start);
      setTimeout(() => { google.maps.event.trigger(map, 'resize'); if (pin) map.setCenter(pin); }, 350);

      return {
        engine: 'google',
        canGeocode: true,
        setPin(pos, zoom = 17) { place(pos); map.panTo(pin); map.setZoom(zoom); },
        getPin: () => (pin ? { ...pin } : null),
        clearPin() { if (marker) marker.map = null; marker = null; pin = null; },
        // Limit the map to a city: it cannot be panned or zoomed out of it, and address lookups favour it
        setBounds(b) {
          limit = b || null;
          map.setOptions({ restriction: limit ? { latLngBounds: limit, strictBounds: true } : null, minZoom: limit ? 10 : null });
          if (limit) map.fitBounds(limit, 0);
        },
        // Draw the chosen barangays (GeoJSON features) and frame them
        setAreas(features, fit = true) {
          map.data.forEach((f) => map.data.remove(f));
          if (!features || !features.length) return;
          map.data.addGeoJson({ type: 'FeatureCollection', features });
          map.data.setStyle((f) => (f.getGeometry().getType() === 'Point'
            ? { icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#c2410c', fillOpacity: 0.35, strokeColor: '#c2410c', strokeWeight: 2 }, clickable: false }
            : { fillColor: '#c2410c', fillOpacity: 0.22, strokeColor: '#c2410c', strokeWeight: 2, clickable: false }));
          const box = new google.maps.LatLngBounds();
          map.data.forEach((f) => f.getGeometry().forEachLatLng((ll) => box.extend(ll)));
          if (fit && !box.isEmpty()) map.fitBounds(box, 40);
        },
        async geocode(address) {
          try {
            const { results } = await geocoder.geocode({ address, region: 'PH', ...(limit ? { bounds: limit } : {}) });
            const r = results && results[0];
            return r ? { ...toLL(r.geometry.location), address: r.formatted_address, city: cityOf(r) } : null;
          } catch (e) { return null; }
        },
        async reverse(pos) {
          try {
            const { results } = await geocoder.geocode({ location: pos });
            const r = results && results[0];
            return r ? { address: r.formatted_address, city: cityOf(r) } : null;
          } catch (e) { return null; }
        },
        destroy() { try { if (marker) marker.map = null; } catch (e) { /* already gone */ } }
      };
    }

    function leafletImpl(el, start, onPick) {
      if (typeof L === 'undefined') {
        el.innerHTML = '<div class="shm-fallback">The map could not load. Check your connection and reload the page.</div>';
        return { engine: 'none', canGeocode: false, setPin() {}, clearPin() {}, setBounds() {}, setAreas() {}, getPin: () => null, geocode: async () => null, reverse: async () => null, destroy() {} };
      }
      el.innerHTML = '';
      const map = L.map(el, { center: start ? [start.lat, start.lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], zoom: start ? 17 : 11 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
      }).addTo(map);
      let marker = null;
      let areaLayer = null;
      let limit = null;   // the city's bounds, once chosen
      const place = (pos) => {
        if (!marker) {
          marker = L.marker([pos.lat, pos.lng], {
            draggable: true,
            title: 'Facility location (drag to adjust)',
            icon: L.divIcon({ className: 'shm-pin is-mine', html: '<span></span>', iconSize: [30, 38], iconAnchor: [15, 34] })
          }).addTo(map);
          marker.on('dragend', () => { const p = marker.getLatLng(); onPick({ lat: p.lat, lng: p.lng }); });
        } else {
          marker.setLatLng([pos.lat, pos.lng]);
        }
      };
      map.on('click', (e) => { const pos = { lat: e.latlng.lat, lng: e.latlng.lng }; place(pos); onPick(pos); });
      if (start) place(start);
      setTimeout(() => map.invalidateSize(), 350);

      return {
        engine: 'leaflet',
        canGeocode: true,   // OpenStreetMap (Nominatim) address lookup
        setPin(pos, zoom = 17) { place(pos); map.setView([pos.lat, pos.lng], zoom); },
        getPin() { if (!marker) return null; const p = marker.getLatLng(); return { lat: p.lat, lng: p.lng }; },
        clearPin() { if (marker) marker.remove(); marker = null; },
        setBounds(b) {
          limit = b || null;
          if (!b) { map.setMaxBounds(null); map.setMinZoom(0); return; }
          const box = L.latLngBounds([b.south, b.west], [b.north, b.east]);
          map.setMaxBounds(box.pad(0.02));
          map.options.maxBoundsViscosity = 1;
          map.fitBounds(box);
          map.setMinZoom(Math.max(0, map.getZoom() - 1));
        },
        setAreas(features, fit = true) {
          if (areaLayer) { map.removeLayer(areaLayer); areaLayer = null; }
          if (!features || !features.length) return;
          const style = { color: '#c2410c', weight: 2, fillColor: '#c2410c', fillOpacity: 0.22 };
          areaLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
            style: () => style, interactive: false,
            pointToLayer: (_f, ll) => L.circleMarker(ll, { ...style, radius: 9, fillOpacity: 0.35 })
          }).addTo(map);
          const box = areaLayer.getBounds();
          if (fit && box.isValid()) map.fitBounds(box, { padding: [30, 30] });
        },
        // Address -> point. The full text is tried first, then with the leading parts (house no., street) dropped,
        // since OpenStreetMap often knows the barangay but not the exact street. At least "area, city, country" is
        // kept, so a fallback never lands on the bare city centre. The city is only a preference (not a filter): a
        // match outside it is still returned when nothing inside is found, so the form can say the address is
        // not in the city instead of quietly pinning somewhere else.
        async geocode(address) {
          const box = limit ? `&viewbox=${limit.west},${limit.north},${limit.east},${limit.south}` : '';
          const parts = String(address).split(',').map((x) => x.trim()).filter(Boolean);
          let outside = null;
          for (let i = 0; i <= Math.min(2, parts.length - 3) || i === 0; i++) {
            try {
              const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=ph' + box + '&q=' + encodeURIComponent(parts.slice(i).join(', ')));
              const hit = res.ok ? (await res.json())[0] : null;
              if (hit) {
                const found = { lat: Number(hit.lat), lng: Number(hit.lon), address: hit.display_name, city: '', places: hit.address ? ['city', 'town', 'municipality', 'city_district', 'county', 'state_district'].map((k) => hit.address[k]).filter(Boolean) : [] };
                if (!limit || (found.lat >= limit.south && found.lat <= limit.north && found.lng >= limit.west && found.lng <= limit.east)) return found;
                outside = outside || found;
              }
            } catch (e) { return outside; }
            await new Promise((r) => setTimeout(r, 1100));   // Nominatim allows one request a second
          }
          return outside;
        },
        async reverse(pos) {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${pos.lat}&lon=${pos.lng}`);
            const hit = res.ok ? await res.json() : null;
            return hit && hit.display_name ? { address: hit.display_name, city: '' } : null;
          } catch (e) { return null; }
        },
        destroy() { try { map.remove(); } catch (e) { /* already gone */ } }
      };
    }

    // create(el, { lat, lng, onPick(pos), onEngine(picker) }) -> picker
    async function create(el, opts) {
      const start = Number.isFinite(Number(opts.lat)) && Number.isFinite(Number(opts.lng)) && opts.lat !== '' && opts.lat != null
        ? { lat: Number(opts.lat), lng: Number(opts.lng) } : null;
      const onPick = (pos) => { if (opts.onPick) opts.onPick(pos); };

      const api = {};
      let impl = null;
      const use = (next) => {
        impl = next;
        api.engine = next.engine;
        api.canGeocode = next.canGeocode;
        if (opts.onEngine) opts.onEngine(api);
      };
      api.setBounds = (b) => { api._bounds = b || null; if (impl) impl.setBounds(b); };
      api.setAreas = (f, fit) => { api._areas = f || null; if (impl) impl.setAreas(f, fit); };
      ['setPin', 'clearPin', 'getPin', 'geocode', 'reverse', 'destroy'].forEach((m) => { api[m] = (...a) => impl[m](...a); });

      try {
        if (window.PawGoogleMaps && await window.PawGoogleMaps.isConfigured()) {
          use(await googleImpl(el, start, onPick));
          // A site the key does not allow only gets an error panel from Google: switch to the fallback map when it shows
          if (typeof MutationObserver === 'function') {
            const watcher = new MutationObserver(() => {
              if (!el.querySelector('.gm-err-container')) return;
              watcher.disconnect();
              const pin = api.getPin();
              impl.destroy();
              use(leafletImpl(el, pin, onPick));
              if (api._bounds) impl.setBounds(api._bounds);
              if (api._areas) impl.setAreas(api._areas);
            });
            watcher.observe(el, { childList: true, subtree: true });
            setTimeout(() => watcher.disconnect(), 15000);
          }
          return api;
        }
      } catch (err) {
        console.warn('[FacilityForm] Google Maps is unavailable, using the fallback map:', err && err.message);
      }
      use(leafletImpl(el, start, onPick));
      return api;
    }

    return { create };
  })();


  // ==========================================================================
  // City: pick the facility's city (Google search, or OpenStreetMap when Google is off). The result carries the
  // city's bounds, which limit the map and the pin.
  // ==========================================================================
  const City = (function () {
    const round = (n) => Math.round(n * 1e6) / 1e6;
    const norm = (b) => (b && [b.north, b.south, b.east, b.west].every((x) => Number.isFinite(+x))
      ? { north: round(+b.north), south: round(+b.south), east: round(+b.east), west: round(+b.west) } : null);
    const inBounds = (pin, b) => !b || !pin || (pin.lat >= b.south && pin.lat <= b.north && pin.lng >= b.west && pin.lng <= b.east);
    const googleOn = async () => !!(window.PawGoogleMaps && await window.PawGoogleMaps.isConfigured().catch(() => false));

    // Look a city up by name -> { name, placeId, bounds } or null
    async function resolve(text, province) {
      const q = [String(text || '').trim(), province].filter(Boolean).join(', ');
      if (!q) return null;
      try {
        if (await googleOn()) {
          await window.PawGoogleMaps.load();
          const { Geocoder } = await google.maps.importLibrary('geocoding');
          const { results } = await new Geocoder().geocode({ address: q, region: 'PH', componentRestrictions: { country: 'PH' } });
          const r = (results || []).find((x) => x.types.some((t) => ['locality', 'administrative_area_level_2', 'administrative_area_level_1'].includes(t))) || (results || [])[0];
          if (!r) return null;
          const v = r.geometry.viewport && r.geometry.viewport.toJSON();
          return { name: String(text || '').trim() || (r.address_components && r.address_components[0] && r.address_components[0].long_name) || q, placeId: r.place_id || '', bounds: norm(v) };
        }
        const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=' + encodeURIComponent(q));
        const hit = res.ok ? (await res.json())[0] : null;
        if (!hit || !hit.boundingbox) return null;
        const [south, north, west, east] = hit.boundingbox.map(Number);
        return { name: String(text || '').trim() || String(hit.display_name || q).split(',')[0].trim(), placeId: hit.osm_id ? 'osm:' + hit.osm_type + ':' + hit.osm_id : '', bounds: norm({ north, south, east, west }) };
      } catch (e) { return null; }
    }

    // Wire a text box: suggestions while typing (Google), a lookup on leaving the box otherwise.
    // onChange(cityOrNull) fires with the chosen city, or null while the text no longer matches one.
    function attach(input, onChange) {
      let chosen = null;
      let psgcList = null;     // the PSGC city list, once loaded (suggestions come from it)
      let regionCode = '';     // the region picked first: only its cities are offered
      const inRegion = (c) => !!regionCode && c.regionCode === regionCode;
      // Our own list under the box (a <datalist> only shows matches for the typed text, and not at all on many phones)
      const panel = document.createElement('div');
      panel.className = 'fm-city-panel';
      panel.setAttribute('role', 'listbox');
      panel.hidden = true;
      if (input.parentNode) { input.parentNode.style.position = 'relative'; input.parentNode.appendChild(panel); }
      const closePanel = () => { panel.hidden = true; };
      const renderPanel = () => {
        if (!psgcList || !regionCode || input.readOnly || input.disabled) { closePanel(); return; }
        const q = input.value.trim().toLowerCase();
        const all = psgcList.filter(inRegion);
        // the box already holds the chosen city: show the whole region, not just that one
        const rows = !q || (chosen && q === chosen.name.toLowerCase()) ? all : all.filter((c) => c.label.toLowerCase().includes(q));
        panel.innerHTML = rows.length
          ? rows.map((c) => `<button type="button" class="fm-city-opt" role="option" data-code="${esc(c.code)}">${esc(c.name)}${c.province ? `<span>${esc(c.province)}</span>` : ''}</button>`).join('')
          : '<div class="fm-city-empty">No city in this region matches.</div>';
        panel.hidden = false;
        panel.scrollTop = 0;
      };
      const fillList = () => { if (!panel.hidden) renderPanel(); };
      const set = (c) => { chosen = c; onChange(c); };
      // A pick from the PSGC list: keep its code, then look up the city's limits for the map
      const pickListed = async (c) => {
        const base = { name: c.name, placeId: 'psgc:' + c.code, province: c.province, bounds: null };
        input.value = c.name;
        set(base);
        const found = await resolve(c.name, c.province);
        if (chosen && chosen.placeId === base.placeId && found && found.bounds) set({ ...base, bounds: found.bounds });
      };
      (async () => {
        try {
          if (window.PSGC) {
            psgcList = await window.PSGC.cities();
            fillList();
            return;
          }
        } catch (e) { psgcList = null; /* offline or blocked: fall back to searching by name below */ }
        try {
          if (!(await googleOn())) return;
          await window.PawGoogleMaps.load();
          const { Autocomplete } = await google.maps.importLibrary('places');
          const ac = new Autocomplete(input, { types: ['(cities)'], componentRestrictions: { country: 'ph' }, fields: ['name', 'place_id', 'geometry'] });
          ac.addListener('place_changed', () => {
            const pl = ac.getPlace();
            if (!pl || !pl.geometry) return;
            const v = pl.geometry.viewport ? pl.geometry.viewport.toJSON() : null;
            input.value = pl.name || input.value;
            set({ name: pl.name || input.value, placeId: pl.place_id || '', bounds: norm(v) });
          });
        } catch (e) { /* no suggestions: the lookup below still works */ }
      })();
      // keep the box focused while a row is pressed, then pick it
      panel.addEventListener('mousedown', (e) => e.preventDefault());
      panel.addEventListener('click', (e) => {
        const btn = e.target.closest('.fm-city-opt');
        const c = btn && psgcList && psgcList.find((x) => x.code === btn.dataset.code);
        if (c) { closePanel(); pickListed(c); }
      });
      input.addEventListener('focus', renderPanel);
      input.addEventListener('click', renderPanel);
      input.addEventListener('blur', () => setTimeout(closePanel, 200));
      input.addEventListener('input', () => {
        renderPanel();
        const typed = input.value.trim();
        const listed = psgcList && psgcList.find((c) => inRegion(c) && c.label.toLowerCase() === typed.toLowerCase());
        if (listed) { pickListed(listed); return; }
        if (chosen && typed !== chosen.name) set(null);
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
      input.addEventListener('blur', async () => {
        const text = input.value.trim();
        if (!text || (chosen && chosen.name === text)) return;
        await new Promise((r) => setTimeout(r, 250));   // let a clicked suggestion land first
        if (chosen && chosen.name === input.value.trim()) return;
        // Typed without picking: use it only when exactly one listed city has that name
        const same = psgcList ? psgcList.filter((x) => inRegion(x) && x.name.toLowerCase() === text.toLowerCase()) : [];
        if (same.length === 1) { pickListed(same[0]); return; }
        if (psgcList) return;                            // several share the name (or none): the person must pick one from the list
        const c = await resolve(text);
        if (c && input.value.trim() === text) { input.value = c.name; set(c); }
      });
      // Choose the region whose cities are offered; the list is ready once the PSGC data has loaded
      const setRegion = (code) => { regionCode = code || ''; fillList(); };
      return { current: () => chosen, setRegion, cityFor: (c) => (psgcList && c ? psgcList.find((x) => ('psgc:' + x.code) === c.placeId) || psgcList.find((x) => x.name.toLowerCase() === String(c.name).toLowerCase()) : null), set: (c) => { chosen = c; if (c) input.value = c.name; onChange(c); } };
    }

    return { resolve, attach, inBounds, norm };
  })();

  window.FacilityForm = { phone, hours, MapPicker, City, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.FacilityForm;
})();
