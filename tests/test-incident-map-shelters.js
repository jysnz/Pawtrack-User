const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== Running Test: Incident Map Shelter Pins (Icon-Only + Hover Info) ===\n');

const publicViewJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'views', 'public-view.js'), 'utf8');
const componentsCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'components.css'), 'utf8');

// 1. Check shelter icon-only marker implementation
// Shelter pins are built by pinIcon({ kind: 'shelter' }): an icon only, the name is never printed on the map
assert(publicViewJs.includes("this.pinIcon({ kind: 'shelter'"), 'public-view.js must build shelter markers with pinIcon({ kind: \'shelter\' })');
assert(publicViewJs.includes("shelter:   { color: MAP_COLORS.shelter"), 'pinIcon must define the shelter pin');
assert(!publicViewJs.includes('<span class="map-pin-label">Shelter:'), 'public-view.js must NOT render persistent label inside shelter icon');
console.log('[PASS] Shelter markers are configured as icon-only pins.');

// 2. Check hover tooltip binding
assert(publicViewJs.includes('.bindTooltip(tooltipContent'), 'public-view.js must bind hover tooltip to shelter markers');
assert(publicViewJs.includes("className: 'shelter-hover-tooltip'"), 'public-view.js must apply shelter-hover-tooltip class');
assert(publicViewJs.includes('shelter-tooltip-title'), 'Hover tooltip must contain shelter title element');
assert(publicViewJs.includes('shelter-tooltip-phone'), 'Hover tooltip must contain shelter phone element');
assert(publicViewJs.includes('shelter-tooltip-title">${this.escapeHtml(s.name)}') && publicViewJs.includes('shelter-tooltip-addr">${this.escapeHtml(s.address)}') && publicViewJs.includes('Hotline: ${this.escapeHtml(s.phone)}'), 'Hover tooltip must escape the facility name, address and phone (admins type them)');
console.log('[PASS] Shelter markers bind rich hover tooltip with title, address, and hotline.');

// 3. Check CSS styling for icon pin and tooltip
assert(componentsCss.includes('.shelter-icon-pin {'), 'components.css must define .shelter-icon-pin');
assert(componentsCss.includes('.leaflet-tooltip.shelter-hover-tooltip'), 'components.css must define .shelter-hover-tooltip');
assert(componentsCss.includes('.shelter-icon-pin:hover'), 'components.css must include hover micro-interaction for shelter pin');
console.log('[PASS] CSS definitions for .shelter-icon-pin and .shelter-hover-tooltip verified.');

console.log('\n=== All Incident Map Shelter Icon & Hover Tests Passed! ===\n');
