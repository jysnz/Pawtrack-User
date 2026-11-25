// Impoundments: the card layout and its menu, and euthanasia of an animal nobody claimed (rules, dialog, record).
// Run: node admin/tests/test-impoundments-euthanasia.js
const path = require('path');
const mem = {};
global.window = global;
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
global.document = { addEventListener() {}, removeEventListener() {}, hidden: false, createElement: () => ({}), getElementById: () => null };
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.BroadcastChannel = undefined;
global.CSS = { escape: (x) => x };

const toasts = [];
let rendered = [], closed = 0, modalHtml = '';
let handlers = {}, cache = {};
const stub = (sel) => ({ addEventListener: (ev, fn) => { handlers[sel + ':' + ev] = fn; }, focus() {}, value: '', checked: false, disabled: false, hidden: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [] });
const fakeModal = {
  querySelector: (sel) => cache[sel] || (cache[sel] = sel === '#eu-form' ? Object.assign(stub(sel), { elements: { notes: { value: '' }, vet: { value: '' }, license: { value: '' }, at: { value: '' }, humane: { checked: false }, confirm: { value: '' } } }) : stub(sel)),
  querySelectorAll: () => []
};
window.adminApp = {
  showToast: (m) => toasts.push(m), closeModal: () => { closed++; }, renderView: (r) => rendered.push(r), updateFacilityChip() {}, currentRoute: 'impoundments',
  openModalContent: (h) => { modalHtml = h; handlers = {}; cache = {}; return fakeModal; }, confirmDialog: async () => true
};

require(path.join(__dirname, '..', '..', 'js', 'species.js'));
const AdminStore = require(path.join(__dirname, '../js/admin-store.js'));
require(path.join(__dirname, '../js/search-box.js'));
require(path.join(__dirname, '../js/care-guidelines.js'));
require(path.join(__dirname, '../js/views/rehab-view.js'));
require(path.join(__dirname, '../js/views/impoundments-view.js'));

let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 220) : ''}`); if (!ok) failed++; };
const H = 3600e3;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const imp = (id, extra) => ({ id, shelterId: 'S1', shelterName: 'Main Shelter', petName: 'Pet ' + id, species: 'Dog', breed: 'Aspin', status: 'active_impounded', rfidTag: 'TAG-' + id, cageNumber: 'Cage 1', intakeDate: iso(-80 * H), claimDeadline: iso(-8 * H), photoUrl: '', healthCondition: '', ...extra });

(async () => {
  const store = new AdminStore();
  const imps = [
    imp('over'),                                                                 // claim period over, nobody came
    imp('inwin', { intakeDate: iso(-10 * H), claimDeadline: iso(30 * H) }),       // still inside the claim period
    imp('forf', { status: 'forfeited', claimDeadline: iso(-90 * H) }),
    imp('euth', { status: 'euthanized', closedAt: iso(-2 * H), euthanasia: { reason: 'untreatable', vet: 'Dr. Ana Reyes', license: 'PRC 12345', notes: 'Hind leg fracture', at: iso(-2 * H) } }),
    imp('rehab'),
    imp('claim', { status: 'claimed', closedAt: iso(-20 * H) }),
    imp('moving', { transferStatus: 'pending', transferToId: 'MAIN2' }),
    imp('wclaim')
  ];
  let claims = [{ id: 'c1', impoundId: 'wclaim', status: 'pending' }];
  let rehabCases = [{ id: 'r1', impoundId: 'rehab', stage: 'medical' }];
  store.getImpoundments = () => imps;
  store.getImpoundmentById = (id) => imps.find((i) => i.id === id);
  store.getMyImpoundments = () => imps;
  store.getClaims = () => claims;
  store.getRehabForImpound = (id) => rehabCases.find((c) => c.impoundId === id) || null;
  store.getTicketForImpound = () => null;
  store.syncFromSupabase = async () => true;
  window.adminStore = store;

  // ---------------- the rules ----------------
  const B = (id) => store.euthanasiaBlock(store.getImpoundmentById(id));
  check('an animal nobody claimed, past its claim period, may be euthanized', B('over') === '' && B('forf') === '');
  check('inside the claim period it may not, and the reason says when it opens', /Available after the claim period ends/.test(B('inwin')), B('inwin'));
  check('a closed case (claimed) may not', /never claimed/.test(B('claim')));
  check('an animal already euthanized may not be again', /Already euthanized/.test(B('euth')));
  check('an animal that is moving to another facility may not', /moved to another facility/.test(B('moving')));
  check('an animal with an owner claim waiting may not', /claim waiting/.test(B('wclaim')));
  check('an animal in rehabilitation may not, until it is withdrawn', /Withdraw it first/.test(B('rehab')));
  rehabCases = [{ id: 'r1', impoundId: 'rehab', stage: 'withdrawn' }];
  check('once withdrawn from rehabilitation it may', B('rehab') === '');
  rehabCases = [{ id: 'r1', impoundId: 'rehab', stage: 'medical' }];

  // ---------------- saving ----------------
  const UUID = '22222222-2222-4222-8222-222222222222';
  imps.push(imp(UUID, { petName: 'Rex' }));
  let calls = [], fail = false;
  store.waitForClient = async () => ({ from: (t) => ({ update: (payload) => ({ eq: async (col, id) => { calls.push({ t, payload, col, id }); return { error: fail ? { message: 'The claim period has not ended yet.' } : null }; } }) }) });
  const ok0 = await store.euthanizeImpoundment('inwin', { reason: 'untreatable', vet: 'Dr. A', at: iso(0) });
  check('a blocked animal is never sent to the database', ok0 === false && calls.length === 0);
  fail = true;
  const okFail = await store.euthanizeImpoundment(UUID, { reason: 'untreatable', vet: 'Dr. A', at: iso(-H) });
  check('if the database refuses, nothing changes on screen', okFail === false && store.getImpoundmentById(UUID).status === 'active_impounded' && toasts.some((t) => /claim period has not ended/.test(t)), JSON.stringify(toasts.slice(-2)));
  fail = false; calls = [];
  const at = iso(-30 * 60000);
  const ok = await store.euthanizeImpoundment(UUID, { reason: 'dangerous', vet: '  Dr. Ana Reyes ', license: ' PRC 1 ', notes: ' bit two staff ', at });
  const sent = calls[0] && calls[0].payload;
  check('the record is saved once, with who, why and when', ok === true && calls.length === 1 && calls[0].t === 'impounded_pets' && calls[0].col === 'id' && calls[0].id === UUID && sent.status === 'euthanized' && sent.euthanasia_reason === 'dangerous' && sent.euthanasia_vet === 'Dr. Ana Reyes' && sent.euthanasia_license === 'PRC 1' && sent.euthanasia_notes === 'bit two staff' && sent.euthanized_at === at && sent.closed_at === at, JSON.stringify(sent));
  const after = store.getImpoundmentById(UUID);
  check('afterwards the animal is euthanized, closed, with its record', after.status === 'euthanized' && after.closedAt === at && after.euthanasia.vet === 'Dr. Ana Reyes' && after.euthanasia.reason === 'dangerous');
  check('it cannot be euthanized twice', store.euthanasiaBlock(after) === 'Already euthanized.');
  check('the record is read back from the database row', store.fromImpoundRow({ id: 'x', shelter_id: 'S1', pet_name: 'A', species: 'Dog', status: 'euthanized', euthanasia_reason: 'contagious', euthanasia_vet: 'Dr. B', euthanasia_license: 'L', euthanasia_notes: 'n', euthanized_at: at, closed_at: at, intake_at: at, claim_deadline: at }, []).euthanasia.reason === 'contagious');

  // ---------------- the page ----------------
  const I = window.ImpoundmentsView;
  const MAIN = { id: 'S1', name: 'Main Shelter' };
  store.getMyShelter = () => MAIN; store.myShelterId = () => 'S1'; store.getSubFacilities = () => []; store.getMyFacilityIds = () => ['S1'];
  store.getIncomingTransfers = () => []; store.isFacilityManager = () => true; store.getShelters = () => [MAIN];
  store.getActiveFacilityId = () => 'S1'; store.setActiveFacility = () => {};
  const page = { _i: '', get innerHTML() { return this._i; }, set innerHTML(v) { this._i = v; }, querySelector: () => null, querySelectorAll: () => [] };
  I.currentTab = 'all'; I.query = ''; I.speciesFilter = 'all'; I.periodFilter = 'all'; I.deadlineFilter = 'all';
  I.render(page);
  const html = page.innerHTML;
  const cardOf = (id) => (html.match(new RegExp(`<li class="ic-card[^"]*" data-impound-id="${id}">[\\s\\S]*?</li>`)) || [''])[0];
  const over = cardOf('over'), inwin = cardOf('inwin'), forf = cardOf('forf'), euth = cardOf('euth'), reh = cardOf('rehab'), claimed = cardOf('claim');
  check('the table is gone: cards, tabs and tiles instead', /class="ic-list"/.test(html) && /class="ic-stats"/.test(html) && /class="ic-seg"/.test(html) && !/<table/.test(html));
  check('an unclaimed animal past its claim period leads with Rehabilitate', /btn-start-rehab/.test(over) && !/class="btn btn-sm chip-green btn-claim-impound/.test(over));
  check('and its menu offers Release, +24h, Care guide, Edit and an enabled Euthanize', /ic-mi btn-claim-impound/.test(over) && /btn-extend-deadline/.test(over) && /btn-care-guide/.test(over) && /btn-edit-impound/.test(over) && /btn-euthanize is-danger[^>]*title=/.test(over) && !/btn-euthanize[^>]*aria-disabled/.test(over), over.match(/btn-euthanize[^>]*>/));
  check('inside the claim period the lead action is Release to owner, and Euthanize is greyed with the reason', /btn btn-sm chip-green btn-claim-impound/.test(inwin) && /btn-euthanize[^>]*aria-disabled="true"[^>]*data-reason="Available after the claim period ends/.test(inwin) && /<small>Available after the claim period ends/.test(inwin));
  check('a forfeited animal can be rehabilitated or euthanized', /btn-start-rehab/.test(forf) && /btn-euthanize is-danger/.test(forf) && !/btn-euthanize[^>]*aria-disabled/.test(forf));
  check('an animal in rehabilitation shows that, and Euthanize says to withdraw first', /btn-open-rehab/.test(reh) && /aria-disabled="true"[^>]*data-reason="It is in rehabilitation/.test(reh));
  check('an euthanized animal has a visible Euthanasia record button and no way to euthanize or release', /btn-euth-record/.test(euth) && />\s*<svg[^>]*>[\s\S]*?<\/svg>Euthanasia record</.test(euth) && !/btn-euthanize/.test(euth) && !/btn-claim-impound/.test(euth) && /status-euthanized/.test(euth) && /Euthanized/.test(euth) && /View case/.test(euth), euth.slice(0, 200));
  check('a claimed animal has no euthanasia or rehabilitation actions', !/btn-euthanize/.test(claimed) && !/btn-start-rehab/.test(claimed));
  check('the summary tiles count in holding, claim period over, due in 24 hours and closed', /<b>5<\/b><span>In holding<\/span>/.test(html) && /<b>4<\/b><span>Claim period over<\/span>/.test(html) && /<b>0<\/b><span>Due in 24 hours<\/span>/.test(html) && /<b>4<\/b><span>Closed cases<\/span>/.test(html), html.match(/ic-stat[^>]*><b>\d+/g));
  check('the tiles are plain information: not buttons, nothing to tap', !/<button[^>]*ic-stat/.test(html) && !/data-imp-quick|aria-pressed/.test(html) && !/\.ic-stat[^{]*(cursor|:hover|:active|\.is-on)/.test(require('fs').readFileSync(path.join(__dirname, '..', 'css', 'polish.css'), 'utf8')));
  check('the tabs carry counts', /data-imp-tab="active"[^>]*><span>In holding<\/span><em>5<\/em>/.test(html) && /data-imp-tab="closed"[^>]*><span>Closed<\/span><em>4<\/em>/.test(html) && /data-imp-tab="all"[^>]*><span>All<\/span><em>9<\/em>/.test(html));
  check('the filters sit behind a button on a phone and are shown on a computer', /id="imp-filters-toggle"/.test(html) && /id="imp-filter-panel"/.test(html));
  check('Euthanized is a known outcome with its own pill', window.IMPOUND_OUTCOMES.euthanized.label === 'Euthanized' && window.IMPOUND_OUTCOMES.euthanized.pill === 'status-euthanized');
  I.currentTab = 'closed'; I.render(page);
  check('the Closed tab lists forfeited, euthanized and claimed cases only', /data-impound-id="forf"/.test(page.innerHTML) && /data-impound-id="euth"/.test(page.innerHTML) && /data-impound-id="claim"/.test(page.innerHTML) && !/data-impound-id="over"/.test(page.innerHTML));
  I.currentTab = 'all';

  // ---------------- the edit dialog cannot be used to euthanize ----------------
  I.openEditModal(store.getImpoundmentById('over'));
  check('the Edit dialog never offers Euthanized as a status', !/value="euthanized"/.test(modalHtml) && /value="claimed"/.test(modalHtml));
  I.openEditModal(store.getImpoundmentById('euth'));
  check('for an euthanized animal the status is shown and locked', /value="euthanized" selected/.test(modalHtml) && /name="status" disabled/.test(modalHtml));

  // ---------------- the euthanasia dialog ----------------
  toasts.length = 0;
  I.openEuthanizeModal(store.getImpoundmentById('inwin'));
  check('a blocked animal does not open the dialog, it explains', toasts.some((t) => /Available after the claim period ends/.test(t)));
  I.openEuthanizeModal(store.getImpoundmentById(UUID === after.id ? 'over' : 'over'));
  check('the dialog warns it is permanent and lists the facts', /This is permanent/.test(modalHtml) && /Owner claims<\/dt><dd>None waiting/.test(modalHtml) && /Claim period<\/dt><dd>Ended/.test(modalHtml));
  check('four reasons, nothing chosen, and the button starts disabled', (modalHtml.match(/name="reason" value="/g) || []).length === 4 && !/name="reason"[^>]*checked/.test(modalHtml) && /id="eu-save" disabled/.test(modalHtml));
  check('it asks for the vet, when, a humane confirmation and the animal\'s name', /Veterinarian \*/.test(modalHtml) && /Performed on \*/.test(modalHtml) && /performs, or has performed, this euthanasia humanely/.test(modalHtml) && /Type <b class="eu-word">Pet over<\/b> to confirm/.test(modalHtml));
  // fill it in, step by step
  const form = cache['#eu-form'], save = cache['#eu-save'], hint = cache['#eu-hint'];
  const radio = { value: '' };
  form.querySelector = (sel) => (/reason.*checked/.test(sel) && radio.value ? radio : null);
  form.elements = { notes: { value: '' }, vet: { value: '' }, license: { value: '' }, at: { value: new Date(Date.now() - 3600e3).toISOString().slice(0, 16) }, humane: { checked: false }, confirm: { value: '' } };
  const step = () => handlers['#eu-form:input']();
  step();
  check('nothing chosen: the hint says to choose a reason', save.disabled === true && hint.textContent === 'Choose a reason');
  radio.value = 'other'; step();
  check('"Another reason" needs an explanation', save.disabled && hint.textContent === 'Explain the reason');
  form.elements.notes.value = 'Unable to eat or drink'; step();
  check('then the veterinarian', save.disabled && hint.textContent === 'Enter the veterinarian');
  form.elements.vet.value = 'Dr. Ana Reyes'; step();
  check('then the humane confirmation', save.disabled && hint.textContent === 'Confirm it is done humanely');
  form.elements.humane.checked = true; step();
  check('then the typed name', save.disabled && hint.textContent === 'Type Pet over to confirm');
  form.elements.confirm.value = 'pet OVER'; step();
  check('typing the name (any case) unlocks the button', save.disabled === false && hint.textContent === '');
  closed = 0; rendered = []; toasts.length = 0; calls = [];
  // use a database-shaped id so the store accepts it
  const realOver = store.getImpoundmentById('over'); realOver.id = '33333333-3333-4333-8333-333333333333';
  I.openEuthanizeModal(realOver);
  const f2 = cache['#eu-form'], s2 = cache['#eu-save'];
  const r2 = { value: 'untreatable' };
  f2.querySelector = () => r2;
  f2.elements = { notes: { value: '' }, vet: { value: 'Dr. Ana Reyes' }, license: { value: '' }, at: { value: new Date(Date.now() - 3600e3).toISOString().slice(0, 16) }, humane: { checked: true }, confirm: { value: 'Pet over' } };
  handlers['#eu-form:input']();
  await handlers['#eu-save:click']();
  check('saving records it, closes the dialog, says so and redraws the page', calls.length === 1 && calls[0].payload.euthanasia_reason === 'untreatable' && closed >= 1 && toasts.some((t) => /Euthanasia recorded for Pet over/.test(t)) && rendered.includes('impoundments'), JSON.stringify({ calls: calls.length, closed, toasts, rendered }));
  check('the animal is now euthanized in the list', store.getImpoundmentById('33333333-3333-4333-8333-333333333333').status === 'euthanized');

  // ---------------- the record ----------------
  I.openEuthanasiaRecord(store.getImpoundmentById('euth'));
  check('the record shows who, why and when, read only, with a PDF button', /Euthanasia record: Pet euth/.test(modalHtml) && /Dr\. Ana Reyes/.test(modalHtml) && /License PRC 12345/.test(modalHtml) && /Severe illness or injury that cannot be treated/.test(modalHtml) && /Hind leg fracture/.test(modalHtml) && /Download PDF/.test(modalHtml) && /cannot be changed or undone/.test(modalHtml));

  // ---------------- worst case data ----------------
  const w = [
    imp('w1', { petName: 'Aleksandra Wiśniewska-Kowalczyk the Third of Northwind Industries Holdings', breed: 'Cavalier King Charles Spaniel × Miniature Poodle (Cavoodle) mix', healthCondition: 'x'.repeat(900) }),
    imp('w2', { petName: '<img src=x onerror=alert(1)>', breed: '"><script>alert(1)</script>', rfidTag: '<b>tag</b>' }),
    imp('w3', { petName: '' }),
    imp('w4', { petName: 'Jo', claimDeadline: null, intakeDate: null }),
    imp('w5', { petName: '🐶 Biscuit', species: 'Axolotl', status: 'euthanized', euthanasia: null, closedAt: null })
  ];
  imps.splice(0, imps.length, ...w);
  let out = '';
  try { I.currentTab = 'all'; I.render(page); out = page.innerHTML; } catch (e) { out = 'THREW ' + e.stack; }
  check('awkward data draws without an error', !/^THREW/.test(out), out.slice(0, 200));
  check('markup in names, tags and breeds is escaped', !/<img src=x/.test(out) && !/<script>alert/.test(out) && !/<b>tag<\/b>/.test(out) && /&lt;img src=x onerror=alert\(1\)&gt;/.test(out));
  check('the long name is kept whole for a tooltip and clipped by CSS', out.includes('title="Aleksandra Wiśniewska-Kowalczyk the Third of Northwind Industries Holdings"') && /\.ic-name \{[^}]*text-overflow: ellipsis/.test(require('fs').readFileSync(path.join(__dirname, '..', 'css', 'polish.css'), 'utf8')));
  check('a long note is clamped, and an unnamed animal reads Unidentified Pet', /\.ic-note \{[^}]*-webkit-line-clamp: 2/.test(require('fs').readFileSync(path.join(__dirname, '..', 'css', 'polish.css'), 'utf8')) && /Unidentified Pet/.test(out));
  check('an animal with no dates and an euthanized one with no record still draw', /No deadline/.test(out) && /Date not recorded/.test(out));
  store.getImpoundmentById('w3').petName = '';
  I.openEuthanizeModal(store.getImpoundmentById('w3'));
  check('an unnamed animal is confirmed by typing EUTHANIZE', /Type <b class="eu-word">EUTHANIZE<\/b> to confirm/.test(modalHtml));

  // the database migration says the same thing
  const sql = require('fs').readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261150_euthanasia.sql'), 'utf8');
  check('the database enforces the rules itself (claim period, claims, rehabilitation, final)', /claim period has not ended/.test(sql) && /impound_claims/.test(sql) && /rehab_cases/.test(sql) && /cannot be changed/.test(sql) && /euthanasia_complete/.test(sql));

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
