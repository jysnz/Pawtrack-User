/**
 * Google Maps JavaScript API loader.
 *
 * The API key and Map ID come from the Supabase secrets GOOGLE_MAPS_API_KEY and
 * GOOGLE_MAPS_MAP_ID through the public-config Edge Function, so nothing is hard-coded in the browser code.
 *
 *   const { Map, AdvancedMarkerElement } = await PawGoogleMaps.load();
 *   PawGoogleMaps.mapId   // Map ID (needed for AdvancedMarkerElement and cloud styling)
 *
 * load() rejects with a readable message when no key is configured, so callers can keep
 * using the existing Leaflet map until the key is set.
 */
(function () {
  let loading = null;
  let config = null;

  async function readConfig() {
    if (config) return config;
    try {
      const cfg = window.PAWTRACK_SUPABASE;
      const response = await fetch(`${cfg.url}/functions/v1/public-config`, { headers: { apikey: cfg.publishableKey } });
      const data = await response.json();
      config = (data && data.googleMaps) || {};
    } catch (err) {
      config = {};
    }
    return config;
  }

  const api = {
    mapId: '',

    async isConfigured() {
      return !!(await readConfig()).apiKey;
    },

    load() {
      if (loading) return loading;
      loading = (async () => {
        const { apiKey, mapId } = await readConfig();
        if (!apiKey) throw new Error('Google Maps is not configured. Set the GOOGLE_MAPS_API_KEY secret in Supabase.');
        api.mapId = String(mapId || '').replace(/^.*=/, '').trim();

        if (!(window.google && window.google.maps && window.google.maps.importLibrary)) {
          await new Promise((resolve, reject) => {
            window.__pawGoogleMapsReady = resolve;
            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey)
              + '&v=weekly&loading=async&callback=__pawGoogleMapsReady';
            script.onerror = () => reject(new Error('Google Maps failed to load. Check the API key and your connection.'));
            document.head.appendChild(script);
          });
        }

        const [maps, marker, places, routes] = await Promise.all([
          google.maps.importLibrary('maps'),
          google.maps.importLibrary('marker'),
          google.maps.importLibrary('places'),
          google.maps.importLibrary('routes')
        ]);
        return { ...maps, ...marker, ...places, ...routes };
      })().catch((err) => {
        loading = null; // allow a retry after fixing the key
        throw err;
      });
      return loading;
    }
  };

  window.PawGoogleMaps = api;
})();
