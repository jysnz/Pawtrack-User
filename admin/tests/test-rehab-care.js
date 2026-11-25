// Multi-species support, the care guidelines engine and the rehabilitation page.
// Run: node admin/tests/test-rehab-care.js
const path = require('path');
global.window = global;
global.document = { addEventListener() {} };
require(path.join(__dirname, '..', '..', 'js', 'species.js'));
require(path.join(__dirname, '..', 'js', 'care-guidelines.js'));
require(path.join(__dirname, '..', 'js', 'views', 'rehab-view.js'));
const S = window.PawSpecies, CG = window.CareGuidelines, RV = window.RehabView;

let failed = 0;
const check = (name, ok, extra) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${!ok && extra !== undefined ? ' -> ' + String(extra).slice(0, 200) : ''}`); if (!ok) failed++; };

// ---- species ----
check('seven species, Other last', S.KEYS.join() === 'Dog,Cat,Bird,Rabbit,Small mammal,Reptile,Other', S.KEYS.join());
check('known keys stay as they are', S.normalize('Bird') === 'Bird' && S.normalize('Small mammal') === 'Small mammal');
check('free text is read: parrot, kuneho, hamster, gecko, aso, pusa', [S.normalize('Parrot'), S.normalize('kuneho'), S.normalize('Hamster'), S.normalize('gecko'), S.normalize('Aso'), S.normalize('Pusa')].join() === 'Bird,Rabbit,Small mammal,Reptile,Dog,Cat');
check('anything else is Other, empty uses the fallback', S.normalize('Axolotl') === 'Other' && S.normalize('', 'Dog') === 'Dog' && S.normalize(null) === 'Other');
check('filters list every species with plural wording', S.filterOptions('all').length === 8 && S.filterOptions('all')[1][1] === 'Dogs' && S.filterOptions('all')[3][1] === 'Birds');
const mix = S.count([{ species: 'Dog' }, { species: 'Dog' }, { species: 'Parrot' }, { species: 'Cat' }]);
check('counts group by species', mix.map((m) => `${m.key}:${m.n}`).join() === 'Dog:2,Cat:1,Bird:1', mix.map((m) => `${m.key}:${m.n}`).join());

// ---- care guidelines ----
const HOUR = 3600 * 1000;
const base = { petName: 'Test', status: 'active_impounded', intakeDate: new Date(Date.now() - 30 * HOUR).toISOString(), claimDeadline: new Date(Date.now() + 40 * HOUR).toISOString() };
S.KEYS.forEach((k) => {
  const rec = CG.recommend({ ...base, species: k });
  check(`${k}: a full protocol (six sections, all filled)`, rec.sections.length === 6 && rec.sections.every((s) => s.items.length > 0), rec.sections.map((s) => s.items.length).join());
});
const hurt = CG.recommend({ ...base, species: 'Dog', healthCondition: 'Limping, bleeding from the front leg' });
check('an injured animal gets an urgent alert first', hurt.alerts[0].level === 'critical' && /vet today/i.test(hurt.alerts[0].title), JSON.stringify(hurt.alerts[0]));
const sickCat = CG.recommend({ ...base, species: 'Cat', healthCondition: 'sneezing, eye discharge' });
check('a sick animal is told to be isolated', sickCat.alerts.some((a) => a.id === 'illness' && /isolate/i.test(a.title)));
const kitten = CG.recommend({ ...base, species: 'Cat', petName: 'Kitten' });
check('a very young animal gets the warmth and feeding alert', kitten.alerts.some((a) => a.id === 'young'));
check('a healthy dog has no animal-specific alert', CG.recommend({ ...base, species: 'Dog' }).alerts.length === 0);
check('a bird must be checked for protected wildlife', CG.recommend({ ...base, species: 'Bird' }).alerts.some((a) => a.id === 'wildlife'));
const fresh = CG.recommend({ ...base, species: 'Dog', intakeDate: new Date(Date.now() - 2 * HOUR).toISOString() });
check('first 24 hours: intake phase and its alert', fresh.phase.key === 'intake' && fresh.alerts.some((a) => /First 24 hours/.test(a.title)));
const closing = CG.recommend({ ...base, species: 'Dog', claimDeadline: new Date(Date.now() + 5 * HOUR).toISOString() });
check('window closing soon is flagged', closing.phase.key === 'closing');
const overdue = CG.recommend({ ...base, species: 'Dog', claimDeadline: new Date(Date.now() - 5 * HOUR).toISOString() });
check('past the claim window it points to rehabilitation', overdue.phase.key === 'overdue' && overdue.alerts.some((a) => /rehabilitation/i.test(a.detail)));
const long = CG.recommend({ ...base, species: 'Dog', intakeDate: new Date(Date.now() - 9 * 24 * HOUR).toISOString() });
check('a long stay asks for enrichment', long.alerts.some((a) => /Held for 9 days/.test(a.title)));
const order = CG.recommend({ ...base, species: 'Dog', healthCondition: 'old, thin, bleeding' }).alerts.map((a) => a.level);
check('alerts are sorted most urgent first', order.join() === [...order].sort((a, b) => ({ critical: 0, high: 1, routine: 2 }[a] - { critical: 0, high: 1, routine: 2 }[b])).join(), order.join());
const html = CG.renderHtml(hurt);
const critical = CG.recommend({ ...base, species: 'Dog' }, { condition: { overall: 'critical', tags: ['injured'], note: '' } });
check('a critical condition tops the alerts', critical.alerts[0].level === 'critical' && /Critical condition/.test(critical.alerts[0].title) && critical.alerts.some((a) => a.id === 'injury'), JSON.stringify(critical.alerts.map((a) => a.id)));
check('a "needs a vet soon" condition raises an important alert', CG.recommend({ ...base, species: 'Dog' }, { condition: { overall: 'vet_soon', tags: ['underweight'], note: '' } }).alerts.some((a) => a.id === 'cond-vet' && a.level === 'high'));
check('the recorded tags drive the same rules as the intake note', CG.recommend({ ...base, species: 'Cat' }, { condition: { overall: 'stable', tags: ['aggressive'], note: '' } }).alerts.some((a) => a.id === 'aggressive'));
check('the guide renders and escapes text', /For this animal/.test(html) && /Call the vet if/.test(html) && !/<script/i.test(CG.renderHtml(CG.recommend({ ...base, species: 'Dog', healthCondition: '<script>x</script> injured' }))));

// ---- rehabilitation stages ----
check('three working stages, then rehabilitated', CG.STAGE_KEYS.join() === 'medical,behavior,clearance,ready' && CG.STAGES[3].label === 'Rehabilitated');
const keys = (sp, st) => CG.checklist(sp, st).map((i) => i.key);
check('dogs, cats and rabbits are sterilized; birds are not', keys('Dog', 'medical').includes('medical.sterilize') && keys('Rabbit', 'medical').includes('medical.sterilize') && !keys('Bird', 'medical').includes('medical.sterilize'));
check('birds are quarantined, reptiles get a heat check', keys('Bird', 'medical').includes('medical.quarantine') && keys('Reptile', 'medical').includes('medical.husbandry'));
check('the ready stage has no checklist', CG.checklist('Dog', 'ready').length === 0);
check('every checklist key is unique and prefixed by its stage', CG.STAGE_KEYS.every((st) => { const k = keys('Dog', st); return new Set(k).size === k.length && k.every((x) => x.startsWith(st + '.')); }));
check('the vet exam, parasites and temperament are in the remaining stages', keys('Dog', 'medical').includes('medical.exam') && keys('Dog', 'medical').includes('medical.parasite') && keys('Dog', 'behavior').includes('behavior.temperament'));

const tickList = (list) => Object.fromEntries(list.map((i) => [i.key, { done: true, at: new Date().toISOString() }]));
const required = (sp, st) => CG.checklist(sp, st).filter((i) => i.required);
const dogTotal = ['medical', 'behavior', 'clearance'].reduce((n, st) => n + required('Dog', st).length, 0);
check('a new case is at 0% with every required check open', CG.progress({ stage: 'medical', checklist: {} }, 'Dog').pct === 0 && CG.missingRequired({ checklist: {} }, 'Dog').length === dogTotal);
check('the stage follows the checklist: medical, then behavior, then clearance', CG.derivedStage({ checklist: {} }, 'Dog') === 'medical'
  && CG.derivedStage({ checklist: tickList(required('Dog', 'medical')) }, 'Dog') === 'behavior'
  && CG.derivedStage({ checklist: tickList([...required('Dog', 'medical'), ...required('Dog', 'behavior')]) }, 'Dog') === 'clearance');
const everything = tickList(['medical', 'behavior', 'clearance'].flatMap((st) => required('Dog', st)));
check('with every required check done nothing is missing and progress is 100%', CG.missingRequired({ checklist: everything }, 'Dog').length === 0 && CG.progress({ stage: 'clearance', checklist: everything }, 'Dog').pct === 100);
check('unticking an early check moves the stage back', CG.derivedStage({ checklist: { ...everything, 'medical.exam': undefined } }, 'Dog') === 'medical');
check('optional items never block', required('Dog', 'behavior').every((i) => i.required) && CG.checklist('Dog', 'behavior').some((i) => !i.required) && CG.missingRequired({ checklist: everything }, 'Dog').length === 0);
check('an injured animal needs every check, including treatment', CG.missingRequired({ checklist: {}, condition: { overall: 'vet_soon', tags: ['injured'], note: '' } }, 'Dog').length === dogTotal);
check('ready is 100%', CG.progress({ stage: 'ready', checklist: {} }, 'Dog').pct === 100);

// ---- the page and the flow ----
const imp = (id, extra) => ({ id, shelterId: 'S1', shelterName: 'Main Shelter', petName: 'Pet ' + id, species: 'Dog', status: 'forfeited', intakeDate: new Date(Date.now() - 10 * 86400000).toISOString(), claimDeadline: new Date(Date.now() - 7 * 86400000).toISOString(), ...extra });
const impounds = [imp('a'), imp('b', { species: 'Bird' }), imp('c', { status: 'active_impounded', claimDeadline: new Date(Date.now() + 86400000).toISOString() }), imp('d', { species: 'Rabbit' }), imp('e', { species: 'Cat' })];
const cases = [
  { id: 'r1', impoundId: 'd', shelterId: 'S1', stage: 'medical', checklist: {}, notes: {}, startedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'r2', impoundId: 'e', shelterId: 'S1', stage: 'ready', checklist: {}, notes: {}, startedAt: new Date(Date.now() - 20 * 86400000).toISOString(), readyAt: new Date().toISOString() }
];
let started = null, startedCond = null;
window.location = { hash: '#impoundments' };
window.adminStore = {
  currentAdmin: () => ({ id: 'u' }), hasFacility: () => true, rehabReady: true,
  getActiveFacilityId: () => 'S1', getActiveFacility: () => ({ id: 'S1', name: 'Main Shelter' }),
  getMyImpoundments: () => impounds, getImpoundments: () => impounds, getRehabCases: () => cases, getPets: () => [],
  startRehab: async (id, cond) => { started = id; startedCond = cond; const c = { id: 'new', impoundId: id, shelterId: 'S1', stage: 'medical', checklist: {}, notes: {}, condition: cond, startedAt: new Date().toISOString() }; cases.push(c); return c; },
  saveRehab: (id, patch) => { const c = cases.find((x) => x.id === id); if (patch.condition) c.condition = patch.condition; if (patch.checklist) c.checklist = patch.checklist; if (patch.stage) c.stage = patch.stage; if (patch.notes) c.notes = patch.notes; },
  finishRehab: async (id) => { cases.find((x) => x.id === id).stage = 'ready'; return true; }
};

// a stand-in dialog that remembers the handlers the page attaches
let dlg = '', handlers = {}, closed = 0, toasts = [];
const stub = (sel) => ({ addEventListener: (ev, fn) => { handlers[sel + ':' + ev] = fn; }, focus() {}, value: '', scrollTop: 0, scrollIntoView() {}, classList: { add() {} }, querySelector: () => null, set disabled(v) {}, set textContent(v) {} });
let cache = {};
const fakeModal = {
  querySelector: (sel) => cache[sel] || (cache[sel] = stub(sel)),
  querySelectorAll: (sel) => sel === '[data-rh-item]' ? [...dlg.matchAll(/data-rh-item="([^"]+)"/g)].map((m) => { const o = stub('item:' + m[1]); o.dataset = { rhItem: m[1] }; o.checked = true; return o; }) : sel === 'input[name="rh-overall"]' ? [...dlg.matchAll(/name="rh-overall" value="(\w+)"/g)].map((m) => { const o = stub('overall:' + m[1]); o.value = m[1]; return o; })
    : sel === 'input[name="rh-tag"]' ? [...dlg.matchAll(/name="rh-tag" value="(\w+)"/g)].map((m) => { const o = stub('tag:' + m[1]); o.value = m[1]; o.checked = true; return o; }) : []
};
window.adminApp = { openModalContent: (h) => { dlg = h; handlers = {}; cache = {}; return fakeModal; }, closeModal: () => { closed++; }, showToast: (m) => toasts.push(m), confirmDialog: async () => true };
global.CSS = { escape: (x) => x };

const tabHandlers = {};
let filterStub = null, filterHandler = null;
const host = {
  h: null,
  get innerHTML() { return this.h !== null ? this.h : ((container.innerHTML.match(/<div id="rh-live">([\s\S]*)<\/div>\s*<header class="dash-section"><span class="dash-sec-no" aria-hidden="true">2/) || [])[1] || ''); },
  set innerHTML(v) { this.h = v; },
  querySelectorAll(sel) { if (sel === '[data-rh-filter]') { filterStub = { value: '', addEventListener: (ev, fn) => { filterHandler = fn; } }; return [filterStub]; } return sel === '[data-rh-tab]' ? [...this.innerHTML.matchAll(/data-rh-tab="(\w+)"/g)].map((m) => ({ dataset: { rhTab: m[1] }, addEventListener: (ev, fn) => { tabHandlers[m[1]] = fn; } })) : []; },
  querySelector: () => ({ focus() {} })
};
const container = { _i: '', get innerHTML() { return this._i; }, set innerHTML(v) { this._i = v; host.h = null; }, querySelectorAll: () => [], querySelector: (sel) => (sel === '#rh-live' ? host : null) };
RV.render(container);
const out = container.innerHTML;
check('forfeited animals are listed as waiting to start', /Pet a/.test(out) && /Pet b/.test(out));
check('an animal still inside its claim window is not a candidate', !/Pet c/.test(out));
check('animals already on the track are not offered again', !/data-rehab-start="d"/.test(out) && !/data-rehab-start="e"/.test(out));
check('a step filter replaces the columns: All, the three steps and Rehabilitated, with counts', ['all', 'medical', 'behavior', 'clearance', 'ready'].every((k) => new RegExp(`data-rh-tab="${k}"`).test(out)) && ['Medical care', 'Behavior &amp; handling', 'Final clearance', 'Rehabilitated'].every((l) => out.includes(l)) && !/Assessment/.test(out) && !/rh-board/.test(out));
check('the tab counts are right: 2 in all, 1 in medical care, 1 rehabilitated', /data-rh-tab="all"[^>]*><span>All<\/span><em>2<\/em>/.test(out) && /data-rh-tab="medical"[^>]*><span>Medical care<\/span><em>1<\/em>/.test(out) && /data-rh-tab="ready"[^>]*><span>Rehabilitated<\/span><em>1<\/em>/.test(out));
check('a card shows the next check to do, and the finished one its date', /Next: <b>Veterinary exam and body condition score<\/b>/.test(out) && /Rehabilitated on /.test(out));
check('every card is one button with a spoken summary', /aria-label="Pet d, Medical care, 0 of \d+ checks done\. Open"/.test(out));
check('pets in rehabilitation come before the waiting list', out.indexOf('In rehabilitation</h2>') > 0 && out.indexOf('In rehabilitation</h2>') < out.indexOf('Waiting to start</h2>'));
check('the rabbit and the cat are listed', /data-rehab-open="r1"/.test(out) && /data-rehab-open="r2"/.test(out));
check('the counts: 1 in rehabilitation, 1 rehabilitated, 2 waiting', /<b>1<\/b><span>In rehabilitation/.test(out) && /<b>1<\/b><span>Rehabilitated<\/span>/.test(out) && /<b>2<\/b><span>Waiting to start/.test(out));
check('the button on a waiting animal says Rehabilitate', /data-rehab-start="a"[^>]*>Rehabilitate</.test(out));

// "Rehabilitate" asks first: what is the animal's current condition?
RV.askStart('a');
check('the prompt asks for the animal\'s current condition', /What is Pet a's current condition\?/.test(dlg) && /role="radiogroup"/.test(dlg));
check('overall condition has two choices, never "stable", and none is chosen', ['vet_soon', 'critical'].every((k) => new RegExp(`name="rh-overall" value="${k}" `).test(dlg)) && !/value="stable"/.test(dlg) && !/name="rh-overall"[^>]*checked/.test(dlg));
check('the "what applies" list covers problems and behavior, and never offers "healthy"', !/value="healthy"/.test(dlg) && ['injured', 'sick', 'underweight', 'parasites', 'pregnant', 'young', 'senior', 'calm', 'fearful', 'aggressive'].every((k) => new RegExp(`name="rh-tag" value="${k}"`).test(dlg)));
check('Start rehabilitation is disabled until it is answered', /id="rha-go" disabled/.test(dlg) && /Choose the overall condition/.test(dlg));
check('the prompt also says where the animal stays and that it can be withdrawn', /stays at Main Shelter/.test(dlg) && /withdraw it from rehabilitation/.test(dlg));
(async () => {
  await handlers['#rha-go:click']();
  check('clicking Start with no answer does nothing', started === null);
  handlers['overall:vet_soon:change']();
  await handlers['#rha-go:click']();
  check('an overall answer alone is not enough: something must apply', started === null);
  handlers['tag:calm:change']();
  handlers['tag:aggressive:change']();
  handlers['tag:injured:change']();
  cache['#rh-cond-note'].value = 'Limps on the left hind leg';
  handlers['#rh-cond-note:input']();
  await handlers['#rha-go:click']();
  check('with the answers it starts and heads to the Rehabilitation page', started === 'a' && closed >= 1 && window.location.hash === '#rehab' && RV.pendingOpen === 'new', JSON.stringify({ started, startedCond, closed, hash: window.location.hash }));
  check('calm and aggressive exclude each other, and the note is kept', JSON.stringify(startedCond.tags) === '["aggressive","injured"]' && startedCond.overall === 'vet_soon' && startedCond.note === 'Limps on the left hind leg', JSON.stringify(startedCond));
  RV.render(container); // the page draws, then opens the case
  check('the new case opens straight away on its checklist', /Pet a/.test(dlg) && /Mark as rehabilitated/.test(dlg) && RV.pendingOpen === null);
  check('the case shows its condition, with a way to update it', /Condition<\/span>/.test(dlg) && /Needs a vet soon: Aggressive, Injured/.test(dlg) && /Limps on the left hind leg/.test(dlg) && /id="rh-cond-change"/.test(dlg));
  check('the button is blocked and the footer says how many checks are left', /aria-disabled="true"/.test(dlg) && new RegExp(`${dogTotal} required checks left`).test(dlg), dlg.match(/\d+ required checks? left/));
  check('the checklist is grouped by step with counts', /Medical care<\/b><em[^>]*>0 of 6/.test(dlg) && /Behavior &amp; handling/.test(dlg) && /Final clearance/.test(dlg));

  // tick everything, one box at a time, as a person would
  const c = cases.find((x) => x.id === 'new');
  const seen = [];
  for (const key of CG.missingRequired(c, 'Dog').map((i) => i.key)) {
    RV.openCase('new');
    const before = c.stage;
    // the page reads checked from the box: our stand-in boxes are all "checked", so it saves a tick for this key
    await handlers['item:' + key + ':change']();
    if (c.stage !== before) seen.push(c.stage);
  }
  check('the step advanced by itself: behavior, then clearance', seen.join() === 'behavior,clearance', seen.join());
  RV.openCase('new');
  check('with everything ticked the button unblocks and the footer turns ready', /aria-disabled="false"/.test(dlg) && /Ready to set as rehabilitated/.test(dlg));
  await handlers['#rh-done:click']();
  await new Promise((r) => setTimeout(r, 5));
  check('marking it rehabilitated sets the stage and shows the banner', cases.find((x) => x.id === 'new').stage === 'ready' && /is-ready/.test(dlg) && /Reopen rehabilitation/.test(dlg) && toasts.some((t) => /rehabilitated and ready for adoption/.test(t)), toasts.join('|'));

  RV.openCase('r1');
  const rabbit = cases.find((x) => x.id === 'r1');
  rabbit.condition = { overall: 'stable', tags: ['healthy'], note: '' };
  RV.askCondition('r1');
  check('an older case that was "stable and healthy" is asked again: nothing is preselected and Save is off', !/name="rh-overall"[^>]*checked/.test(dlg) && !/name="rh-tag"[^>]*checked/.test(dlg));
  handlers['overall:critical:change']();
  handlers['tag:sick:change']();
  handlers['#rhp-save:click']();
  check('the condition can be updated while in rehabilitation', rabbit.condition.overall === 'critical' && JSON.stringify(rabbit.condition.tags) === '["sick"]', JSON.stringify(rabbit.condition));
  RV.openCase('r1', 'guide');
  check('the care guide uses the condition: critical and sick alerts appear', /Critical condition: a vet must see it today/.test(dlg) && /Signs of illness/.test(dlg));

  // blocked click leads to what is missing
  const c2 = { id: 'r3', impoundId: 'a', shelterId: 'S1', stage: 'medical', checklist: {}, notes: {}, startedAt: new Date().toISOString() };
  cases.push(c2);
  RV.openCase('r3');
  await handlers['#rh-done:click']();
  check('clicking the blocked button does not finish it, and says what is left', c2.stage === 'medical' && toasts.some((t) => /still to do/.test(t)));

  // tabs redraw only the section
  RV.stageTab = 'all';
  RV.render(container);
  tabHandlers['ready']();
  check('the Rehabilitated tab shows only the rehabilitated animal', /data-rehab-open="r2"/.test(host.innerHTML) && !/data-rehab-open="r1"/.test(host.innerHTML) && /aria-selected="true"[^>]*><span>Rehabilitated/.test(host.innerHTML));
  tabHandlers['behavior']();
  check('an empty step says so and what happens next', /Nobody in behavior &amp; handling right now/.test(host.innerHTML) && /move here by themselves/.test(host.innerHTML));
  check('on a phone the same filter is a dropdown with counts', /<select class="rh-filter-select" data-rh-filter/.test(host.innerHTML) && /<option value="medical" [^>]*>Medical care \(\d+\)<\/option>/.test(host.innerHTML) && /<option value="all" selected>All \(2\)<\/option>/.test(out));
  host.h = null; RV.stageTab = 'all'; RV.render(container);
  filterStub.value = 'ready';
  filterHandler();
  check('choosing from the dropdown filters the list the same way', /data-rehab-open="r2"/.test(host.innerHTML) && !/data-rehab-open="r1"/.test(host.innerHTML) && /<option value="ready" selected>/.test(host.innerHTML), host.innerHTML.slice(0, 200));
  tabHandlers['all']();
  RV.stageTab = 'all';

  // ---- worst case data: long names, markup, no name, no photo, no condition, one-letter names, 60 animals ----
  const savedCases = cases.splice(0, cases.length), savedImps = impounds.splice(0, impounds.length);
  const worst = [
    { name: 'Aleksandra Wiśniewska-Kowalczyk the Third of Northwind Industries Holdings', breed: 'Cavalier King Charles Spaniel × Miniature Poodle (Cavoodle) mix', cond: { overall: 'stable', tags: ['healthy'], note: '' } },
    { name: '<img src=x onerror=alert(1)>', breed: '"><script>alert(1)</script>', cond: { overall: 'critical', tags: ['injured'], note: '' } },
    { name: 'Jo', breed: '', cond: { overall: 'vet_soon', tags: ['sick'], note: '' } },
    { name: '🐶 Biscuit', breed: 'Aspin', cond: null },
    { name: '', breed: undefined, cond: { overall: 'stable', tags: ['calm'], note: '' }, species: 'Axolotl' }
  ];
  worst.forEach((w, i) => {
    impounds.push({ id: 'w' + i, shelterId: 'S1', shelterName: 'Main Shelter', petName: w.name, species: w.species || 'Dog', breed: w.breed, status: 'forfeited', photoUrl: '', intakeDate: new Date().toISOString(), claimDeadline: new Date(Date.now() - 86400000).toISOString() });
    cases.push({ id: 'wc' + i, impoundId: 'w' + i, shelterId: 'S1', stage: 'medical', checklist: {}, notes: {}, condition: w.cond || undefined, startedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString() });
  });
  for (let i = 0; i < 55; i++) {
    impounds.push({ id: 'm' + i, shelterId: 'S1', petName: 'Dog ' + i, species: 'Dog', status: 'forfeited', claimDeadline: new Date(Date.now() - 86400000).toISOString() });
    cases.push({ id: 'mc' + i, impoundId: 'm' + i, shelterId: 'S1', stage: 'medical', checklist: {}, notes: {}, condition: { overall: 'stable', tags: ['healthy'], note: '' }, startedAt: new Date().toISOString() });
  }
  let worstOut = '';
  try { RV.stageTab = 'all'; RV.render(container); worstOut = container.innerHTML; } catch (e) { worstOut = 'THREW ' + e.message; }
  check('60 animals with awkward data draw without an error', !/^THREW/.test(worstOut), worstOut.slice(0, 120));
  check('the full long name is kept for a tooltip, the card clips it with CSS', worstOut.includes('title="Aleksandra Wiśniewska-Kowalczyk the Third of Northwind Industries Holdings"') && /\.rhc-name \{[^}]*text-overflow: ellipsis/.test(require('fs').readFileSync(path.join(__dirname, '..', 'css', 'polish.css'), 'utf8')));
  check('markup in a name or breed is escaped, never run', !/<img src=x/.test(worstOut) && !/<script>alert/.test(worstOut) && /&lt;img src=x onerror=alert\(1\)&gt;/.test(worstOut));
  check('a missing name reads "Unidentified animal", an unknown species still shows', /Unidentified animal/.test(worstOut) && /Axolotl/.test(worstOut));
  check('a one-letter-ish name and an emoji name are fine', /<b class="rhc-name" title="Jo">Jo<\/b>/.test(worstOut) && /🐶 Biscuit/.test(worstOut));
  check('a case with no condition (an older row) does not break the card', /is-sev-stable/.test(worstOut));
  check('the tab count says 60', /data-rh-tab="all"[^>]*><span>All<\/span><em>60<\/em>/.test(worstOut));
  const order = [...worstOut.matchAll(/class="rhc [^"]*is-sev-(\w+)"/g)].map((m) => m[1]);
  check('urgent animals come first: critical, then needs a vet, then the rest', order[0] === 'critical' && order[1] === 'vet_soon' && order.slice(2).every((x) => x === 'stable'), order.slice(0, 4).join());
  check('a worrying condition is flagged on the card', /rhc-flag is-critical">Critical/.test(worstOut) && /rhc-flag is-vet_soon">Needs a vet soon/.test(worstOut));
  cases.splice(0, cases.length, ...savedCases); impounds.splice(0, impounds.length, ...savedImps);
  RV.render(container);

  window.adminStore.rehabReady = false;
  RV.render(container);
  check('without the database update, starting is disabled and the page explains why', /not switched on yet/.test(container.innerHTML) && /data-rehab-start="b"[^>]*disabled/.test(container.innerHTML));
  check('a long-overdue active animal is a candidate, a transferring one is not', RV.isCandidate(imp('x', { status: 'active_impounded' })) === true && RV.isCandidate(imp('y', { status: 'active_impounded', transferStatus: 'pending' })) === false);

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
