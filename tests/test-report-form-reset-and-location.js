/**
 * Report a missing pet: the form starts blank every time, "Use my current location" explains failures,
 * and placeholders look different from typed values.
 * Run: node tests/test-report-form-reset-and-location.js
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'report-manager.js'), 'utf8');
const pets = fs.readFileSync(path.join(__dirname, '..', 'css', 'pets.css'), 'utf8');
const components = fs.readFileSync(path.join(__dirname, '..', 'css', 'components.css'), 'utf8');

let failed = 0;
const check = (name, ok, extra) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${!ok && extra !== undefined ? ' -> ' + extra : ''}`); if (!ok) failed++; };

// Pull the real methods out of the file and run them against a small fake page
const locateSrc = src.slice(src.indexOf('  // Shows (or, with no title'), src.indexOf('  createPinIcon() {'));
const resetSrc = src.slice(src.indexOf('  // A new report starts blank'), src.indexOf("  prepareForm(type = 'missing'"));
const Manager = new Function(`return class T {\n${locateSrc}\n${resetSrc}\n}`)();

const realSetTimeout = global.setTimeout;
global.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, ms >= 4000 ? 5 : ms, ...a); // the 13 s / 18 s watchdogs run in a few ms

function fakeEl(extra = {}) {
  const parts = { strong: { textContent: '' }, span: { textContent: '' } };
  return Object.assign({
    className: '', style: {}, disabled: false, parts,
    classList: { toggle() {}, remove() {}, add() {} },
    setAttribute() {}, remove() { if (this.parent) this.parent.box = null; },
    set innerHTML(v) { this._html = v; },
    querySelector(sel) { return parts[sel] || { textContent: '' }; }
  }, extra);
}
function setup({ secure = true, geo = 'present', permission = null, positions = [] } = {}) {
  const parent = { box: null, querySelector() { return this.box; } };
  const btn = fakeEl({ parentElement: parent, insertAdjacentElement(_w, el) { el.parent = parent; parent.box = el; }, querySelector() { return { textContent: '' }; } });
  const calls = [];
  const toasts = [];
  global.window = { isSecureContext: secure, notifManager: { showToast: (m, k) => toasts.push({ m, k }) } };
  global.document = { getElementById: (id) => (id === 'report-use-location-btn' ? btn : null), createElement: () => fakeEl() };
  Object.defineProperty(global, 'navigator', { configurable: true, writable: true, value: {
    geolocation: geo === 'present' ? { getCurrentPosition(ok, bad, opts) {
      calls.push(opts);
      const next = positions.shift();
      if (!next) return; // never answers
      if (next.error) bad({ code: next.error }); else ok({ coords: next });
    } } : undefined,
    permissions: permission ? { query: async () => ({ state: permission }) } : undefined
  } });
  const m = new Manager();
  const jumped = [];
  m.reverseGeocode = async () => 'Somewhere, Quezon City';
  m.jumpToLocation = (...a) => jumped.push(a);
  return { m, parent, calls, toasts, jumped };
}
const errorOf = (t) => t.parent.box && t.parent.box.parts.strong.textContent;

(async () => {
  let t = setup({ secure: false });
  await t.m.useMyLocation('report');
  check('a non-https page explains why location is unavailable', /secure page/.test(errorOf(t) || ''), errorOf(t));
  check('...without asking the browser', t.calls.length === 0);

  t = setup({ geo: 'none' });
  await t.m.useMyLocation('report');
  check('a browser with no location support says so', /cannot share/.test(errorOf(t) || ''), errorOf(t));

  t = setup({ permission: 'denied' });
  await t.m.useMyLocation('report');
  check('a site blocked in the browser is reported straight away, with how to fix it', /blocked/.test(errorOf(t) || '') && /Permissions/.test(t.parent.box.parts.span.textContent), errorOf(t));
  check('...and the browser is not asked again', t.calls.length === 0);

  t = setup({ positions: [{ error: 1 }] });
  await t.m.useMyLocation('report');
  check('denying the prompt shows the blocked message', /blocked/.test(errorOf(t) || ''), errorOf(t));
  check('...and does not retry', t.calls.length === 1);

  t = setup({ positions: [{ error: 3 }, { latitude: 14.6, longitude: 121.0, accuracy: 80 }] });
  await t.m.useMyLocation('report');
  check('a GPS timeout falls back to a coarse fix and still locates the person', t.jumped.length === 1 && !t.parent.box, errorOf(t));
  check('the first try is high accuracy, the second is not', t.calls.length === 2 && t.calls[0].enableHighAccuracy === true && t.calls[1].enableHighAccuracy === false);

  t = setup({ positions: [{ error: 2 }, { error: 2 }] });
  await t.m.useMyLocation('report');
  check('when both tries fail, a clear error stays under the button', /could not find/.test(errorOf(t) || ''), errorOf(t));
  check('...and a toast says it too', t.toasts.some(x => x.k === 'warning'));

  t = setup({ positions: [] }); // the browser never answers at all
  await t.m.useMyLocation('report');
  check('a browser that never answers ends in a timeout message, not a stuck button', /taking too long/.test(errorOf(t) || ''), errorOf(t));

  t = setup({ positions: [{ error: 2 }, { error: 2 }, { latitude: 14.6, longitude: 121.0, accuracy: 20 }] });
  await t.m.useMyLocation('report');
  const shown = !!t.parent.box;
  await t.m.useMyLocation('report');
  check('a later success removes the old error', shown && !t.parent.box && t.jumped.length === 1);

  t = setup({ positions: [{ latitude: 14.6, longitude: 121.0, accuracy: 5000 }] });
  await t.m.useMyLocation('report');
  check('a very rough fix is flagged as approximate', t.toasts.some(x => /approximate/.test(x.m)), JSON.stringify(t.toasts));

  // ---- the form starts blank ----
  let resetCalled = 0, hidden = 0, suggestionsHidden = 0, errorsCleared = 0, markerAt = null, viewAt = null;
  const form = { reset() { resetCalled++; } };
  const clearBtn = { style: {} };
  const badge = { textContent: 'old' };
  const chips = [{ classList: { remove() { hidden++; } } }];
  global.document = {
    getElementById: (id) => ({ 'report-pet-form': form, 'report-search-clear-btn': clearBtn, 'report-pinned-coords-badge': badge }[id] || null),
    querySelectorAll: () => chips
  };
  const m = new Manager();
  m.clearFieldErrors = () => { errorsCleared++; };
  m.hideSuggestions = () => { suggestionsHidden++; };
  m.pinnedLat = 14.1; m.pinnedLng = 120.1; m.pinChosen = true;
  m.map = { setView: (at, z) => { viewAt = [at, z]; } };
  m.marker = { setLatLng: (at) => { markerAt = at; } };
  m.resetReportForm();
  check('the form is reset', resetCalled === 1);
  check('old validation errors, suggestions and zone chips are cleared', errorsCleared === 1 && suggestionsHidden === 1 && hidden === 1);
  check('the search box clear button is hidden', clearBtn.style.display === 'none');
  check('the pin goes back to the starting spot', m.pinnedLat === 14.65 && m.pinnedLng === 121.04 && badge.textContent === '14.65000, 121.04000');
  check('a map still on screen moves its pin back too', JSON.stringify(markerAt) === '[14.65,121.04]' && viewAt && viewAt[1] === 13);

  check('opening the form always resets it first', /this\.pinChosen = false;[^\n]*\n\s*this\.resetReportForm\(\);/.test(src));

  // ---- placeholders ----
  check('report-page placeholders are italic and lighter than typed text', /#report-pet-modal\.report-page \.form-control::placeholder[\s\S]*?font-style: italic/.test(pets));
  check('typed values are upright and full colour', /input\.form-control:not\(:placeholder-shown\)[\s\S]*?font-style: normal/.test(pets));
  check('phones get a lighter placeholder still', /@media \(max-width: 768px\) \{\s*\/\*[^*]*\*\/\s*#report-pet-modal\.report-page \.form-control::placeholder/.test(pets));
  check('the location error box is styled', /\.use-location-error \{/.test(components));

  // ---- phone layout: the page cannot paint over the app header, and text areas fit their placeholder ----
  check('the report page is its own stacking context, so map layers (z-index up to 1100) stay under the header (z-index 100)',
    /#report-pet-modal\.report-page \{[^}]*position: relative;[^}]*z-index: 0;[^}]*isolation: isolate;/.test(pets));
  check('the old position: static rule that let the map escape is gone', !/#report-pet-modal\.report-page \{[^}]*position: static/.test(pets));
  check('phones get a taller floor for the text areas', /@media \(max-width: 640px\) \{\s*#report-pet-modal\.report-page \.report-form-column textarea\.form-control[\s\S]*?min-height: 7\.5rem/.test(pets));

  const fitSrc = src.slice(src.indexOf('  fitReportTextareas() {'), src.indexOf('  scheduleFit() {'));
  const Fit = new Function(`return class F {\n${fitSrc}\n}`)();
  const made = [];
  const area = (placeholder, width, scroll) => ({
    placeholder, clientWidth: width, clientHeight: 82, scrollHeight: scroll, style: {},
    _need: placeholder.length > 60 ? 100 : 60 // pretend the placeholder wraps to more lines when it is long
  });
  const areas = [area('x'.repeat(96), 292, 82), area('short', 292, 82), area('x'.repeat(96), 0, 0), area('typed', 292, 220)];
  global.document = {
    getElementById: (id) => (id === 'report-pet-modal' ? { querySelectorAll: () => areas } : null),
    createElement: () => { const el = { style: {}, setAttribute() {}, remove() {}, getBoundingClientRect() { return { height: el.textContent.length > 60 ? 96 : 56 }; } }; made.push(el); return el; },
    body: { appendChild() {} }
  };
  global.getComputedStyle = () => ({ borderTopWidth: '1px', borderBottomWidth: '1px', fontFamily: 'Outfit', fontSize: '14.4px', letterSpacing: 'normal', lineHeight: '1.45', paddingTop: '9px', paddingRight: '12px', paddingBottom: '9px', paddingLeft: '12px' });
  new Fit().fitReportTextareas();
  check('a long placeholder gets a box tall enough for it (placeholder + borders + a little room)', parseInt(areas[0].style.minHeight, 10) >= 96 + 2, areas[0].style.minHeight);
  check('a short placeholder still keeps the 84px floor', areas[1].style.minHeight === '84px', areas[1].style.minHeight);
  check('a hidden text area is left alone until it is shown', areas[2].style.minHeight === undefined);
  check('typing past the box makes it grow with the text', areas[3].style.height === `${220 + 2}px`, areas[3].style.height);
  check('the measuring copy uses the same width and italic type as the placeholder', made[0] && /width:292px/.test(made[0].style.cssText) && /font-style:italic/.test(made[0].style.cssText));
  check('the fit runs when a page opens, a field appears, the window resizes and fonts load',
    /manager\.scheduleFit\(\)/.test(src) && /this\.scheduleFit\(\);\s*\n/.test(src) && /addEventListener\('resize', \(\) => this\.scheduleFit\(\)\)/.test(src) && /document\.fonts\.ready\.then/.test(src));

  check('text areas are measured again whenever a web font finishes loading, not only when the first batch is ready',
    /document\.fonts\.addEventListener\('loadingdone', \(\) => this\.scheduleFit\(\)\)/.test(src));
  check('and after the phone is rotated', /addEventListener\('orientationchange'/.test(src));
  check('browsers that support it size text areas natively (field-sizing: content), so nothing can fall out of date',
    /@supports \(field-sizing: content\) \{[\s\S]*?textarea\.form-control[\s\S]*?field-sizing: content;/.test(pets));

  global.setTimeout = realSetTimeout;
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
