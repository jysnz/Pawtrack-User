/**
 * Test: Impounded Pets page (public view) and its Filipino / English strings.
 * - the English and Filipino dictionaries have the same impounded.* keys
 * - the page's own logic: who is in holding, who is closing soon, search matching, safe photo URLs, escaping
 * Run: node tests/test-impounded-i18n.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('Starting PawTrack Impounded view test suite...');

// ---- 1. i18n: same keys in English and Filipino ----
const i18nSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n.js'), 'utf8');
const keysIn = (text) => new Set((text.match(/'impounded\.[A-Za-z]+'/g) || []).map((k) => k.slice(1, -1)));
const enStart = i18nSrc.indexOf("'impounded.title'");
const filStart = i18nSrc.indexOf("'impounded.title'", enStart + 1);
assert(enStart > 0 && filStart > enStart, 'both language dictionaries define impounded.title');
const enBlock = i18nSrc.slice(enStart, filStart);
const filBlock = i18nSrc.slice(filStart);
const en = keysIn(enBlock);
const fil = keysIn(filBlock);
assert(en.size >= 30, `English has the impounded.* strings (found ${en.size})`);
const missingInFil = [...en].filter((k) => !fil.has(k));
assert(missingInFil.length === 0, `Filipino is missing: ${missingInFil.join(', ')}`);
console.log(`[PASS] ${en.size} impounded.* keys exist in both English and Filipino`);

// ---- 2. the page's logic (loaded without a browser) ----
const sandbox = {
  window: { addEventListener() {}, location: { hash: '#impound' }, history: {}, pawStore: null },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  console
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'views', 'impound-view.js'), 'utf8') + '\nthis.__View = ImpoundView;', sandbox);
const view = new sandbox.__View();

const hoursFromNow = (h) => new Date(Date.now() + h * 3600e3).toISOString();
assert(view.isHolding({ status: 'active_impounded' }) && view.isHolding({ status: 'active' }), 'active animals are in holding');
assert(!view.isHolding({ status: 'claimed' }) && !view.isHolding({ status: 'transferred' }), 'claimed or transferred animals are not in holding');
console.log('[PASS] holding status');

assert(view.hoursLeft({ claimDeadline: hoursFromNow(10) }) === 10, 'hoursLeft counts the hours to the claim deadline');
assert(view.hoursLeft({ claimDeadline: 'not a date' }) === null, 'a bad deadline gives no hours');
assert(view.closingSoon({ status: 'active_impounded', claimDeadline: hoursFromNow(10) }) === true, 'under 24 h left is closing soon');
assert(view.closingSoon({ status: 'active_impounded', claimDeadline: hoursFromNow(40) }) === false, '40 h left is not closing soon');
assert(view.closingSoon({ status: 'active_impounded', claimDeadline: hoursFromNow(-3) }) === false, 'a passed deadline is not "closing soon"');
assert(view.closingSoon({ status: 'claimed', claimDeadline: hoursFromNow(5) }) === false, 'a released animal is never closing soon');
console.log('[PASS] claim window math');

assert(view.matches('', ['x']) === true, 'an empty search matches everything');
assert(view.matches('max retr', ['Max', 'Golden Retriever']) === true, 'every word must appear somewhere');
assert(view.matches('max cat', ['Max', 'Golden Retriever']) === false, 'a word that is nowhere fails the match');
console.log('[PASS] search matching');

assert(view.speciesOf({ species: 'Dog' }) === 'Dog' && view.speciesOf({ species: 'Cat' }) === 'Cat' && view.speciesOf({ species: 'Rabbit' }) === 'Other', 'species buckets');
assert(view.safePhoto('https://x/y.jpg') === 'https://x/y.jpg' && view.safePhoto('javascript:alert(1)') === '' && view.safePhoto('http://x/y.jpg') === '', 'only https photos are used');
assert(view.esc('<img src=x onerror=1>"\'&') === '&lt;img src=x onerror=1&gt;&quot;&#39;&amp;', 'text is escaped before it goes into the page');
console.log('[PASS] photo and text safety');

console.log('\nAll Impounded view tests passed.');
