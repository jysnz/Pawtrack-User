const fs = require('fs');
const path = require('path');

function testHeatmapIntegration() {
  console.log('--- Verifying Heatmap Analysis Full Panoramic GIS Dashboard ---');
  
  const rootDir = path.resolve(__dirname, '..');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const adminAppJs = fs.readFileSync(path.join(rootDir, 'js', 'admin-app.js'), 'utf8');
  const heatmapViewJs = fs.readFileSync(path.join(rootDir, 'js', 'views', 'heatmap-view.js'), 'utf8');
  const componentsCss = fs.readFileSync(path.join(rootDir, 'css', 'components.css'), 'utf8');

  const checks = [
    { name: 'Heatmap Analysis in Sidebar Navigation', ok: indexHtml.includes('data-route="heatmap"') },
    { name: 'Leaflet CSS in index.html', ok: indexHtml.includes('leaflet@1.9.4/dist/leaflet.css') },
    { name: 'Leaflet JS in index.html', ok: indexHtml.includes('leaflet@1.9.4/dist/leaflet.js') },
    { name: 'heatmap-view.js Script in index.html', ok: indexHtml.includes('js/views/heatmap-view.js') },
    { name: 'Router validRoutes includes heatmap', ok: adminAppJs.includes("'heatmap'") },
    { name: 'renderView handles heatmap route', ok: adminAppJs.includes("case 'heatmap':") },
    { name: 'HeatmapView object exists in heatmap-view.js', ok: heatmapViewJs.includes('window.HeatmapView =') },
    { name: 'Header Actions: Reset Filters & Log Lost Pet Pin', ok: heatmapViewJs.includes('btn-reset-heatmap-filters') && heatmapViewJs.includes('btn-log-lost-pin') },
    { name: 'Top KPI Cards (Active Lost Pets, Dogs, Cats, Hotspot)', ok: heatmapViewJs.includes('heatmap-kpi-row') && heatmapViewJs.includes('Active Lost Pets') && heatmapViewJs.includes('Batasan Hills') },
    { name: 'Dual-Row Filter Toolbar (Date range, Layer, Animal, Status, District, Search)', ok: heatmapViewJs.includes('range-pill') && heatmapViewJs.includes('select-map-layer') && heatmapViewJs.includes('animal-pill') && heatmapViewJs.includes('select-status-filter') && heatmapViewJs.includes('heatmap-search-input') },
    { name: 'Interactive Map Viewport & Intensity Legend', ok: heatmapViewJs.includes('pawtrack-leaflet-map') && heatmapViewJs.includes('map-floating-legend') },
    { name: 'Fullscreen trigger button on Map', ok: heatmapViewJs.includes('btn-map-fullscreen') && heatmapViewJs.includes('map-fullscreen-mode') },
    { name: 'Side-by-Side Map and Top Hotspots Layout Row', ok: heatmapViewJs.includes('heatmap-map-hotspots-row') && heatmapViewJs.includes('heatmap-hotspots-card') },
    { name: 'Custom InfoWindow popup card with edit/view action', ok: heatmapViewJs.includes('pawtrack-infowindow-card') && heatmapViewJs.includes('btn-edit-location') },
    { name: 'Top Lost Pet Hotspots & Reports Over Time Histogram', ok: heatmapViewJs.includes('Top Lost Pet Hotspots') && heatmapViewJs.includes('Lost Pet Reports Over Time') && heatmapViewJs.includes('trend-bars-layout') },
    { name: 'Location & Sector Analysis Metric Strip', ok: heatmapViewJs.includes('location-sector-strip-card') && heatmapViewJs.includes('TOTAL PLOTTED INCIDENTS') },
    { name: 'Instant Landmark Geocoding (Ever Gotesco, Batasan, Sandiganbayan)', ok: heatmapViewJs.includes('Ever Gotesco Commonwealth') && heatmapViewJs.includes('landmarksDirectory') },
    { name: 'Direct Location Redirection Method & Auto-suggestions', ok: heatmapViewJs.includes('directToLocationOrLandmark') && heatmapViewJs.includes('getSearchSuggestions') && heatmapViewJs.includes('heatmap-search-suggestions') },
    { name: 'Quezon City 6 Legislative Districts Mapping (Districts 1 to 6)', ok: heatmapViewJs.includes('qcDistricts') && heatmapViewJs.includes('District 1') && heatmapViewJs.includes('District 2') && heatmapViewJs.includes('District 3') && heatmapViewJs.includes('District 4') && heatmapViewJs.includes('District 5') && heatmapViewJs.includes('District 6') },
    { name: 'Automatic Map District Redirection & flyToDistrict method', ok: heatmapViewJs.includes('flyToDistrict') && heatmapViewJs.includes('select-district-filter') },
    { name: 'CSS styles for autocomplete dropdown and highlighted search pin', ok: componentsCss.includes('.search-suggestions-dropdown') && componentsCss.includes('.pawtrack-search-pin-marker') },
    { name: 'CSS styles for side-by-side row, fullscreen mode, KPI cards, and tables', ok: componentsCss.includes('.heatmap-map-hotspots-row') && componentsCss.includes('.map-fullscreen-mode') && componentsCss.includes('.heatmap-kpi-row') && componentsCss.includes('.location-sector-strip-card') && componentsCss.includes('.heatmap-table-card') },
  ];

  let allPassed = true;
  checks.forEach(c => {
    if (c.ok) {
      console.log(`✓ PASS: ${c.name}`);
    } else {
      console.error(`✗ FAIL: ${c.name}`);
      allPassed = false;
    }
  });

  if (allPassed) {
    console.log('\nAll verification checks PASSED successfully!');
    process.exit(0);
  } else {
    console.error('\nSome verification checks failed.');
    process.exit(1);
  }
}

testHeatmapIntegration();

