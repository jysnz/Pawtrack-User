// City matching for the barangay lookup, and the city bounds check.
// Run: node admin/tests/test-facility-city-coverage.js
global.window = global;
let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + x : ''}`); if (!ok) failed++; };
const { norm } = require('../js/psgc.js');
check('"City of Manila" and "Manila" match', norm('City of Manila') === norm('Manila'));
check('"Quezon City" and "quezon city" match', norm('Quezon City') === norm('quezon CITY'));
check('accents and punctuation are ignored', norm('Biñan City') === 'binan' && norm('Sto. Tomas') === 'sto tomas');
check('different cities do not match', norm('San Jose') !== norm('San Juan'));

const FF = require('../js/facility-form.js');
const b = { north: 14.8, south: 14.55, east: 121.15, west: 121.0 };
check('a pin inside the city is accepted', FF.City.inBounds({ lat: 14.65, lng: 121.05 }, b));
check('a pin outside the city is refused', !FF.City.inBounds({ lat: 10.3, lng: 123.9 }, b));
check('no bounds means no limit', FF.City.inBounds({ lat: 10.3, lng: 123.9 }, null));
check('bounds are normalised and bad ones dropped', FF.City.norm({ north: '14.8', south: 14.55, east: 121.15, west: 121 }).north === 14.8 && FF.City.norm({ north: 'x' }) === null);
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
