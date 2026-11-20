/* Cities and barangays from the Philippine Standard Geographic Code (PSGC) public API, plus the outline of a
   barangay (OpenStreetMap, via Nominatim) so the chosen areas can be drawn on the facility map.

   cities()                         -> [{ code, name, label, province, regionCode }]
   regions()                        -> [{ code, label }] every region, in PSGC order
   barangaysByCode(code)            -> ["Alicia", ...] or null
   barangaysFor(cityName)           -> same, found by city name (older facilities saved no code), or null
   shapeFor(barangay, city, bounds) -> a GeoJSON Feature, or null                                          */
(function () {
  'use strict';
  const BASE = 'https://psgc.gitlab.io/api';
  const CACHE_KEY = 'pawtrack_psgc_barangays_v2';
  const SHAPE_KEY = 'pawtrack_psgc_shapes_v1';
  const NCR = '130000000';
  let citiesPromise = null;
  let regionsPromise = null;

  // "City of Manila", "Manila City", "Cañete" and "Manila" should all match the same entry
  const norm = (v) => String(v || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(city of|municipality of|city|municipality)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; } };
  const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } };

  const getJson = async (path) => {
    const res = await fetch(BASE + path);
    if (!res.ok) throw new Error('PSGC ' + res.status);
    return res.json();
  };

  // Every city and municipality, with its province so "San Jose" can be told apart
  function cities() {
    if (!citiesPromise) {
      citiesPromise = Promise.all([getJson('/cities-municipalities.json'), getJson('/provinces.json')]).then(([list, provinces]) => {
        const prov = new Map(provinces.map((p) => [p.code, p.name]));
        return list.map((c) => {
          const province = prov.get(c.provinceCode) || (c.regionCode === NCR ? 'Metro Manila' : '');
          return { code: c.code, name: c.name, regionCode: c.regionCode || '', isCity: !!c.isCity, province, label: province ? `${c.name}, ${province}` : c.name };
        }).sort((a, b) => a.label.localeCompare(b.label, 'en'));
      }).catch((err) => { citiesPromise = null; throw err; });
    }
    return citiesPromise;
  }

  // The regions, so the city list can be narrowed to one before it is shown
  function regions() {
    if (!regionsPromise) {
      regionsPromise = getJson('/regions.json').then((list) => list
        .map((r) => ({ code: r.code, label: r.regionName && r.regionName !== r.name ? `${r.name} (${r.regionName})` : String(r.name || '') }))
        .sort((a, b) => a.code.localeCompare(b.code)))
        .catch((err) => { regionsPromise = null; throw err; });
    }
    return regionsPromise;
  }

  async function barangaysByCode(code) {
    if (!code) return null;
    const cache = read(CACHE_KEY);
    if (Array.isArray(cache[code]) && cache[code].length) return cache[code];
    try {
      const rows = await getJson('/cities-municipalities/' + code + '/barangays.json');
      const names = rows.map((b) => String(b.name || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
      if (!names.length) return null;
      cache[code] = names;
      write(CACHE_KEY, cache);
      return names;
    } catch (e) {
      return null;
    }
  }

  async function barangaysFor(cityName) {
    const key = norm(cityName);
    if (!key) return null;
    try {
      const list = await cities();
      const lower = String(cityName).trim().toLowerCase();
      // 1) the exact name ("Quezon City" is not the municipality "Quezon"), 2) the loose name, preferring cities when the text says "city"
      let hits = list.filter((c) => c.name.toLowerCase() === lower);
      if (!hits.length) hits = list.filter((c) => norm(c.name) === key);
      if (hits.length > 1 && /\bcity\b/i.test(cityName)) hits = hits.filter((c) => c.isCity);
      return hits.length === 1 ? barangaysByCode(hits[0].code) : null;   // still ambiguous: do not guess
    } catch (e) {
      return null;
    }
  }

  // ---- barangay outlines: one request a second at most (the service's usage rule), remembered on this device ----
  let queue = Promise.resolve();
  let lastCall = 0;
  const shapes = read(SHAPE_KEY);
  function shapeFor(barangay, city, bounds) {
    const key = norm(city) + '|' + norm(barangay);
    if (key in shapes) return Promise.resolve(shapes[key]);
    const job = queue.then(async () => {
      if (key in shapes) return shapes[key];
      const wait = lastCall + 1100 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCall = Date.now();
      try {
        const box = bounds ? `&viewbox=${bounds.west},${bounds.north},${bounds.east},${bounds.south}&bounded=1` : '';
        const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&polygon_geojson=1&polygon_threshold=0.0003'
          + box + '&q=' + encodeURIComponent(`${barangay}, ${city}`);
        const res = await fetch(url);
        if (!res.ok) return null;                       // not remembered: try again later
        const hit = (await res.json())[0];
        const feature = hit && hit.geojson ? { type: 'Feature', properties: { name: barangay }, geometry: hit.geojson } : null;
        shapes[key] = feature;
        write(SHAPE_KEY, shapes);
        return feature;
      } catch (e) {
        return null;
      }
    });
    queue = job.catch(() => null);
    return job;
  }

  window.PSGC = { cities, regions, barangaysByCode, barangaysFor, shapeFor, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.PSGC;
})();
