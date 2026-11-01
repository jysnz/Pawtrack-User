/**
 * Google Maps adapter for PawTrack's maps.
 *
 * The public map, the report pin map and the sighting pin map were written against Leaflet's API
 * (L.map, L.marker, L.divIcon, L.polyline, ...). This file provides that same small API on top of the
 * Google Maps JavaScript API, so those maps render with Google Maps without rewriting their code.
 *
 * Boot sequence:
 *   1. Load Google Maps with the key from the public-config Edge Function (see js/google-maps.js).
 *   2. On success, window.L is replaced by this adapter (Leaflet stays at window.LeafletOriginal).
 *   3. If no key is set or loading fails, Leaflet stays in place and the maps keep working as before.
 *
 * Map code awaits `window.PawMapsReady` before it creates a map.
 *
 * Needs a vector Map ID (GOOGLE_MAPS_MAP_ID) for advanced markers and the dark theme.
 * Without one, Google's DEMO_MAP_ID is used so markers still work during development.
 */
(function () {
  window.LeafletOriginal = window.L;

  window.PawMapsReady = (async () => {
    try {
      if (!window.PawGoogleMaps || !(await window.PawGoogleMaps.isConfigured())) return false;
      const libs = await window.PawGoogleMaps.load();
      await google.maps.importLibrary('core');
      window.L = buildAdapter(libs);
      document.documentElement.classList.add('google-maps-active');
      return true;
    } catch (err) {
      console.warn('[Maps] Using Leaflet instead of Google Maps:', err.message);
      return false;
    }
  })();

  // Escape dismisses the phone bottom sheet
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.pt-sheet').forEach(el => el.remove());
  });

  // Google reports a rejected key (wrong referrer, API not enabled, billing off) through this global
  window.gm_authFailure = () => {
    console.error('[Maps] Google rejected the API key. Check the key restrictions, the enabled APIs and billing in Google Cloud Console.');
    if (window.notifManager) window.notifManager.showToast('Google Maps rejected the API key. Check the key settings in Google Cloud.', 'danger', 6000);
  };

  function buildAdapter(libs) {
    const toLL = (v) => {
      if (Array.isArray(v)) return { lat: +v[0], lng: +v[1] };
      if (v && typeof v.lat === 'function') return { lat: v.lat(), lng: v.lng() };
      return { lat: +v.lat, lng: +(v.lng !== undefined ? v.lng : v.lon) };
    };

    class Bounds {
      constructor(points) {
        this._g = new google.maps.LatLngBounds();
        (points || []).forEach(p => this._g.extend(toLL(p)));
      }
      extend(p) { this._g.extend(toLL(p)); return this; }
      isValid() { return !this._g.isEmpty(); }
    }

    class Layer {
      addTo(map) { map.addLayer(this); return this; }
      remove() { if (this._map) this._map.removeLayer(this); return this; }
    }

    class Marker extends Layer {
      constructor(ll, opts = {}) {
        super();
        this._ll = toLL(ll);
        this._opts = opts;
        this._handlers = [];
        this._popupHtml = null;
        this._tipHtml = null;
        this._tipClass = '';
      }

      // Leaflet puts the icon's anchor point on the coordinate. Advanced markers put the bottom centre of
      // their content there, so the content is a zero-size box and the icon is offset inside it.
      _buildContent() {
        const icon = this._opts.icon || {};
        const anchor = icon.iconAnchor || [0, 0];
        const box = document.createElement('div');
        box.style.cssText = 'position:relative;width:0;height:0;';
        const inner = document.createElement('div');
        inner.className = icon.className || '';
        inner.style.cssText = `position:absolute;left:${-anchor[0]}px;top:${-anchor[1]}px;width:max-content;`;
        inner.innerHTML = icon.html || '<div style="width:14px;height:14px;border-radius:50%;background:#ba3820;border:2px solid #fff;transform:translate(-50%,-50%)"></div>';
        box.appendChild(inner);
        if (this._opts.opacity != null) inner.style.opacity = String(this._opts.opacity);
        this._anchorY = anchor[1];

        box.addEventListener('mouseenter', () => this._showTooltip());
        box.addEventListener('mouseleave', () => this._hideTooltip());
        return box;
      }

      _attach(map) {
        this._map = map;
        if (!this._g) {
          this._g = new libs.AdvancedMarkerElement({
            position: this._ll,
            content: this._buildContent(),
            gmpDraggable: !!this._opts.draggable,
            gmpClickable: true,
            zIndex: 1000 + (this._opts.zIndexOffset || 0)
          });
          this._g.addEventListener('gmp-click', () => {
            if (this._popupHtml) this.openPopup();
            this._handlers.filter(h => h.type === 'click').forEach(h => h.fn({ target: this }));
          });
          this._g.addListener('dragstart', () => {
            this._handlers.filter(h => h.type === 'dragstart').forEach(h => h.fn({ target: this }));
          });
          this._g.addListener('dragend', () => {
            this._ll = toLL(this._g.position);
            this._handlers.filter(h => h.type === 'dragend').forEach(h => h.fn({ target: this, latlng: this._ll }));
          });
        }
        this._g.map = map._g;
      }

      _detach() {
        this._hideTooltip();
        if (this._map && this._map._popupOwner === this) this._map.closePopup();
        if (this._g) this._g.map = null;
        this._map = null;
      }

      setLatLng(ll) {
        this._ll = toLL(ll);
        if (this._g) this._g.position = this._ll;
        return this;
      }

      getLatLng() { return { lat: this._ll.lat, lng: this._ll.lng }; }

      setIcon(icon) {
        this._opts.icon = icon;
        if (this._g) this._g.content = this._buildContent();
        return this;
      }

      on(type, fn) { this._handlers.push({ type, fn }); return this; }

      bindPopup(html) { this._popupHtml = html; return this; }

      bindTooltip(html, opts = {}) {
        this._tipHtml = html;
        this._tipClass = opts.className || '';
        return this;
      }

      // On phones the popup becomes a bottom sheet: an info window is too small and clips the details
      _openSheet() {
        const map = this._map;
        map.closePopup();
        const sheet = document.createElement('div');
        sheet.className = 'pt-sheet';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-label', 'Details');
        sheet.innerHTML = '<div class="pt-sheet-handle" aria-hidden="true"></div>'
          + '<button type="button" class="pt-sheet-close" aria-label="Close">&times;</button>'
          + this._popupHtml;
        sheet.querySelector('.pt-sheet-close').addEventListener('click', () => map.closePopup());
        // Starting an action (directions, report) hands the screen back to the map or the next dialog
        sheet.addEventListener('click', (e) => {
          if (e.target.closest('.pt-btn')) setTimeout(() => map.closePopup(), 0);
        });
        document.body.appendChild(sheet);
        requestAnimationFrame(() => sheet.classList.add('is-open'));
        map._sheet = sheet;
        map._popupOwner = this;

        // Keep the pin visible above the sheet
        map._g.panTo(this._ll);
        setTimeout(() => { if (map._sheet === sheet) map._g.panBy(0, Math.round(sheet.offsetHeight / 2)); }, 350);
        return this;
      }

      openPopup() {
        if (!this._popupHtml || !this._map || !this._g) return this;
        if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) return this._openSheet();
        const map = this._map;
        this._hideTooltip();
        const el = document.createElement('div');
        el.className = 'pt-popup';
        el.innerHTML = this._popupHtml;
        if (!map._info) {
          map._info = new libs.InfoWindow({ maxWidth: 320 });
          map._info.addListener('closeclick', () => { map._popupOwner = null; });
        }
        map._info.setOptions({ pixelOffset: new google.maps.Size(0, -(this._anchorY || 0)) });
        map._info.setContent(el);
        map._info.open({ map: map._g, anchor: this._g });
        map._popupOwner = this;
        return this;
      }

      _showTooltip() {
        if (!this._tipHtml || !this._map || this._map._popupOwner === this) return;
        const map = this._map;
        if (!map._tip) map._tip = new libs.InfoWindow({ headerDisabled: true, disableAutoPan: true });
        const el = document.createElement('div');
        el.className = `pt-tooltip ${this._tipClass}`;
        el.innerHTML = this._tipHtml;
        map._tip.setOptions({ pixelOffset: new google.maps.Size(0, -((this._anchorY || 0) + 4)) });
        map._tip.setContent(el);
        map._tip.open({ map: map._g, anchor: this._g, shouldFocus: false });
      }

      _hideTooltip() {
        if (this._map && this._map._tip) this._map._tip.close();
      }
    }

    class Polyline extends Layer {
      constructor(coords, opts = {}) {
        super();
        this._path = (coords || []).map(toLL);
        this._opts = opts;
      }
      _attach(map) {
        this._map = map;
        if (!this._g) {
          const o = this._opts;
          const dash = o.dashArray ? String(o.dashArray).split(/[ ,]+/).map(Number).filter(Boolean) : null;
          const options = {
            path: this._path,
            strokeColor: o.color || '#3b82f6',
            strokeOpacity: dash ? 0 : (o.opacity != null ? o.opacity : 1),
            strokeWeight: o.weight || 3,
            clickable: false
          };
          if (dash) {
            options.icons = [{
              icon: { path: 'M 0,-1 0,1', strokeOpacity: o.opacity != null ? o.opacity : 1, strokeWeight: o.weight || 3, scale: Math.max(1, dash[0] / 2) },
              offset: '0',
              repeat: `${dash[0] + (dash[1] || dash[0])}px`
            }];
          }
          this._g = new libs.Polyline(options);
        }
        this._g.setMap(map._g);
      }
      _detach() {
        if (this._g) this._g.setMap(null);
        this._map = null;
      }
      getBounds() { return new Bounds(this._path); }
    }

    class Circle extends Layer {
      constructor(ll, opts = {}) {
        super();
        this._ll = toLL(ll);
        this._opts = opts;
      }
      _attach(map) {
        this._map = map;
        if (!this._g) {
          const o = this._opts;
          this._g = new libs.Circle({
            center: this._ll,
            radius: o.radius || 100,
            strokeColor: o.color || '#3b82f6',
            strokeOpacity: o.opacity != null ? o.opacity : 1,
            strokeWeight: o.weight || 2,
            fillColor: o.fillColor || o.color || '#3b82f6',
            fillOpacity: o.fillOpacity != null ? o.fillOpacity : 0.2,
            clickable: false
          });
        }
        this._g.setMap(map._g);
      }
      _detach() {
        if (this._g) this._g.setMap(null);
        this._map = null;
      }
    }

    // Tile layers only pick the base map style: roadmap, satellite, hybrid or dark
    class TileLayer extends Layer {
      constructor(url) {
        super();
        this._kind = /World_Imagery/i.test(url) ? 'satellite'
          : /lyrs=y/i.test(url) ? 'hybrid'
          : /dark_all/i.test(url) ? 'dark'
          : /light_all/i.test(url) ? 'light'
          : 'roadmap';
      }
      on() { return this; }
      _attach(map) { this._map = map; map._setKind(this._kind); }
      _detach() { this._map = null; }
    }

    const allMaps = new Set();
    const appIsDark = () => document.documentElement.getAttribute('data-theme') !== 'light';

    // Switching the app between light and dark re-themes every open street map
    new MutationObserver(() => allMaps.forEach(m => m._syncTheme()))
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    class GMap {
      constructor(target, opts = {}) {
        this._el = typeof target === 'string' ? document.getElementById(target) : target;
        this._opts = opts;
        this._layers = new Set();
        this._handlers = [];
        this._kind = 'roadmap';
        this._center = { lat: 14.63, lng: 121.04 };
        this._zoom = 12;
        this._build(this._wantDark());
        allMaps.add(this);
      }

      // The street map follows the app theme; satellite and hybrid stay as photographs
      _wantDark() {
        return this._kind === 'dark' || (this._kind === 'roadmap' && appIsDark());
      }

      _syncTheme() {
        if (!this._el || !this._el.isConnected) { allMaps.delete(this); return; }
        const dark = this._wantDark();
        if (dark !== this._dark) this._build(dark);
      }

      _build(dark) {
        if (this._g) {
          this._center = this._g.getCenter().toJSON();
          this._zoom = this._g.getZoom();
        }
        this._dark = dark;
        this._el.innerHTML = '';
        this._info = null;
        this._tip = null;
        this._g = new libs.Map(this._el, {
          center: this._center,
          zoom: this._zoom,
          mapId: window.PawGoogleMaps.mapId || 'DEMO_MAP_ID',
          colorScheme: dark ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
          mapTypeId: this._typeId(),
          gestureHandling: 'greedy',
          disableDefaultUI: true,
          zoomControl: this._opts.zoomControl !== false,
          zoomControlOptions: { position: google.maps.ControlPosition.LEFT_TOP },
          clickableIcons: false,
          disableDoubleClickZoom: this._opts.doubleClickZoom === false,
          draggableCursor: this._opts.cursor || null,
          draggingCursor: 'grabbing'
        });
        this._g.addListener('click', (e) => {
          this.closePopup();
          const latlng = toLL(e.latLng);
          this._handlers.filter(h => h.type === 'click').forEach(h => h.fn({ latlng }));
        });
        // Pointer movement over the map, for pins that follow the cursor
        this._g.addListener('mousemove', (e) => {
          const latlng = toLL(e.latLng);
          this._handlers.filter(h => h.type === 'mousemove').forEach(h => h.fn({ latlng }));
        });
        this._g.addListener('mouseout', () => {
          this._handlers.filter(h => h.type === 'mouseout').forEach(h => h.fn({}));
        });
        // Zoom changed (Leaflet's 'zoomend'), used to re-spread pins that overlap on screen
        this._g.addListener('zoom_changed', () => {
          this._handlers.filter(h => h.type === 'zoomend').forEach(h => h.fn({}));
        });
        // The user dragging the map (turn-by-turn stops following their position)
        this._g.addListener('dragstart', () => {
          this._handlers.filter(h => h.type === 'dragstart').forEach(h => h.fn({}));
        });
        this._layers.forEach(layer => layer._attach(this));
      }

      _typeId() {
        return this._kind === 'satellite' ? 'satellite' : this._kind === 'hybrid' ? 'hybrid' : 'roadmap';
      }

      _setKind(kind) {
        this._kind = kind;
        const dark = this._wantDark();
        if (dark !== this._dark) this._build(dark); // the colour scheme can only be set when the map is created
        else this._g.setMapTypeId(this._typeId());
      }

      getZoom() { return this._g.getZoom(); }

      setView(ll, zoom) {
        this._g.setCenter(toLL(ll));
        if (zoom != null) this._g.setZoom(zoom);
        return this;
      }

      flyTo(ll, zoom) {
        if (zoom != null) this._g.setZoom(zoom);
        this._g.panTo(toLL(ll));
        return this;
      }

      fitBounds(bounds, opts = {}) {
        const pad = opts.padding || [0, 0];
        this._g.fitBounds(bounds._g, { left: pad[0], right: pad[0], top: pad[1], bottom: pad[1] });
        if (opts.maxZoom) {
          google.maps.event.addListenerOnce(this._g, 'idle', () => {
            if (this._g.getZoom() > opts.maxZoom) this._g.setZoom(opts.maxZoom);
          });
        }
        return this;
      }

      invalidateSize() {
        google.maps.event.trigger(this._g, 'resize');
        return this;
      }

      addLayer(layer) {
        this._layers.add(layer);
        layer._attach(this);
        return this;
      }

      removeLayer(layer) {
        if (!layer) return this;
        this._layers.delete(layer);
        layer._detach();
        return this;
      }

      hasLayer(layer) { return this._layers.has(layer); }

      on(type, fn) {
        this._handlers.push({ type, fn });
        return this;
      }

      off(type, fn) {
        this._handlers = this._handlers.filter(h => !(h.type === type && h.fn === fn));
        return this;
      }

      closePopup() {
        if (this._sheet) {
          this._sheet.remove();
          this._sheet = null;
        }
        if (this._info) this._info.close();
        this._popupOwner = null;
        return this;
      }

      remove() {
        this.closePopup();
        this._layers.forEach(layer => layer._detach());
        this._layers.clear();
        this._handlers = [];
        this._el.innerHTML = '';
      }
    }

    return {
      map: (target, opts) => new GMap(target, opts),
      marker: (ll, opts) => new Marker(ll, opts),
      divIcon: (opts) => ({ ...opts }),
      polyline: (coords, opts) => new Polyline(coords, opts),
      circle: (ll, opts) => new Circle(ll, opts),
      tileLayer: (url, opts) => new TileLayer(url, opts),
      latLngBounds: (points) => new Bounds(points)
    };
  }
})();
