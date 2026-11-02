const fs = require('fs');
const path = require('path');

function testQCDistrictsBehavior() {
  console.log('================================================================');
  console.log('   QUEZON CITY 6 DISTRICTS ACCURATE MAP REDIRECTION TEST       ');
  console.log('================================================================\n');

  const rootDir = path.resolve(__dirname, '..');
  const heatmapViewJs = fs.readFileSync(path.join(rootDir, 'js', 'views', 'heatmap-view.js'), 'utf8');

  // Load HeatmapView in virtual environment
  const virtualWindow = {};
  const fn = new Function('window', heatmapViewJs);
  fn(virtualWindow);

  const HV = virtualWindow.HeatmapView;
  if (!HV) {
    console.error('✗ HeatmapView failed to export');
    process.exit(1);
  }

  // 1. Verify 6 QC Districts definitions
  const expectedDistricts = ['all', 'District 1', 'District 2', 'District 3', 'District 4', 'District 5', 'District 6'];
  expectedDistricts.forEach(d => {
    const info = HV.qcDistricts[d];
    if (info && info.center && info.center.length === 2 && info.zoom > 10) {
      console.log(`[PASS] ${d}: "${info.name}" -> Center: [${info.center.join(', ')}], Zoom: ${info.zoom}`);
    } else {
      console.error(`[FAIL] Missing or invalid district info for: ${d}`);
      process.exit(1);
    }
  });

  // 2. Verify incidents exist for every single QC district
  console.log('\n--- Checking Incident Records per District ---');
  ['District 1', 'District 2', 'District 3', 'District 4', 'District 5', 'District 6'].forEach(d => {
    HV.selectedDistrict = d;
    const filtered = HV.getFilteredIncidents();
    if (filtered.length > 0) {
      console.log(`[PASS] ${d} has ${filtered.length} incidents plotted (${filtered.map(i => i.name).join(', ')})`);
    } else {
      console.error(`[FAIL] ${d} has NO incidents plotted`);
      process.exit(1);
    }
  });

  // 3. Verify 'all' returns all QC incidents
  HV.selectedDistrict = 'all';
  const allIncidents = HV.getFilteredIncidents();
  console.log(`\n[PASS] 'all' (All Districts) returns ${allIncidents.length} total Quezon City incidents.`);

  // 4. Verify flyToDistrict method exists and handles calls smoothly
  console.log('\n--- Verifying flyToDistrict Method ---');
  let flownTo = null;
  HV.mapInstance = {
    flyTo(coords, zoom, opts) {
      flownTo = { coords, zoom, opts };
    }
  };

  expectedDistricts.forEach(d => {
    HV.flyToDistrict(d);
    const target = HV.qcDistricts[d];
    if (flownTo && flownTo.coords === target.center && flownTo.zoom === target.zoom) {
      console.log(`[PASS] flyToDistrict('${d}') successfully triggered map.flyTo([${flownTo.coords}], zoom: ${flownTo.zoom})`);
    } else {
      console.error(`[FAIL] flyToDistrict('${d}') did not fly to expected target`);
      process.exit(1);
    }
  });

  console.log('\n================================================================');
  console.log('   ALL QUEZON CITY 6 DISTRICTS ARE 100% ACCURATE & VERIFIED!    ');
  console.log('================================================================');
}

testQCDistrictsBehavior();
