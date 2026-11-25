/**
 * PawTrack Admin: Rehabilitation
 * The flow:
 *   1. On Impoundments an unclaimed animal has a "Rehabilitate" button. It first asks what will happen to the animal
 *      current condition of the animal (overall, what applies, a note) and will not start until the admin has answered.
 *   2. Confirming puts the animal on this page, in rehabilitation.
 *   3. Here its checklist (medical care, behavior & handling, final clearance) is worked through. The step an animal
 *      is in follows the checklist by itself, so there is nothing to "advance".
 *   4. When every required check is done the admin sets the animal as rehabilitated: it is then ready for adoption.
 * The same module offers the Care guide for any animal: openCareGuide(impoundId).
 */
window.RehabView = {
  pendingOpen: null, // a case to open as soon as the page is drawn (set after "Rehabilitate" is confirmed)
  stageTab: 'all',   // which stage the In rehabilitation list shows: 'all' or a stage key

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  safePhoto(url) { return /^https:\/\//.test(url || '') ? url : ''; },
  days(from) {
    const t = new Date(from).getTime();
    return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : 0;
  },
  when(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { dateStyle: 'medium' });
  },

  // Stock pictures for dogs and cats only: no honest stand-in exists for the other species, which keep their icon
  STOCK: {
    Dog: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=300&q=70',
    Cat: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=300&q=70'
  },

  // The animal's current condition, asked before rehabilitation starts
  OVERALL: [
    { key: 'stable', label: 'Stable', hidden: true, hint: '' }, // only for older cases: it is not offered when starting
    { key: 'vet_soon', label: 'Needs a vet soon', hint: 'Something is wrong, but it is not an emergency.' },
    { key: 'critical', label: 'Critical', hint: 'Needs a vet today: severe injury, trouble breathing, collapse or heavy bleeding.' }
  ],
  TAGS: [
    { key: 'healthy', short: 'Healthy', hidden: true, label: 'Healthy, no visible problems' }, // only for older cases
    { key: 'injured', short: 'Injured', label: 'Injured (wounds, limping, a fracture)' },
    { key: 'sick', short: 'Sick', label: 'Sick (cough, discharge, vomiting, diarrhea)' },
    { key: 'underweight', short: 'Underweight', label: 'Underweight or malnourished' },
    { key: 'parasites', short: 'Parasites or skin problems', label: 'Fleas, ticks, mites or skin problems' },
    { key: 'pregnant', short: 'Pregnant or nursing', label: 'Pregnant or nursing' },
    { key: 'young', short: 'Very young', label: 'Very young (a baby animal)' },
    { key: 'senior', short: 'Senior', label: 'Senior' },
    { key: 'calm', short: 'Calm', label: 'Friendly and calm' },
    { key: 'fearful', short: 'Fearful', label: 'Fearful or shy' },
    { key: 'aggressive', short: 'Aggressive', label: 'Aggressive or bites' }
  ],
  overallOf(key) { return this.OVERALL.find((o) => o.key === key) || this.OVERALL[0]; },
  tagLabel(key) { return (this.TAGS.find((t) => t.key === key) || { short: key }).short; },

  // One line for a condition: "Needs a vet soon: Injured, Underweight"
  conditionText(cond) {
    if (!cond) return '';
    const tags = (cond.tags || []).map((t) => this.tagLabel(t));
    return `${this.overallOf(cond.overall).label}${tags.length ? `: ${tags.join(', ')}` : ''}`;
  },

  // The question "what is its current condition?", as radio cards, check boxes and a note; nothing is chosen up front
  conditionChooser(cond) {
    // an older case may carry "stable" or "healthy", which are no longer offered: the admin answers again
    const c = cond ? { ...cond, overall: cond.overall === 'stable' ? '' : cond.overall, tags: (cond.tags || []).filter((t) => t !== 'healthy') } : { overall: '', tags: [], note: '' };
    return `
      <fieldset class="rh-fs">
        <legend class="rh-legend">Overall <em>choose one</em></legend>
        <div class="rh-plans" role="radiogroup" aria-label="Overall condition">
          ${this.OVERALL.filter((o) => !o.hidden).map((o) => `
            <label class="rh-plan is-${o.key}">
              <input type="radio" name="rh-overall" value="${o.key}" ${c.overall === o.key ? 'checked' : ''} />
              <span><b>${this.esc(o.label)}</b><small>${this.esc(o.hint)}</small></span>
            </label>`).join('')}
        </div>
      </fieldset>
      <fieldset class="rh-fs">
        <legend class="rh-legend">What applies <em>tick all that do</em></legend>
        <div class="rh-tags">
          ${this.TAGS.filter((t) => !t.hidden).map((t) => `
            <label class="rh-tag"><input type="checkbox" name="rh-tag" value="${t.key}" ${(c.tags || []).includes(t.key) ? 'checked' : ''} /><span>${this.esc(t.label)}</span></label>`).join('')}
        </div>
      </fieldset>
      <div class="form-group form-full">
        <label class="form-label" for="rh-cond-note">Anything else the team should know <span style="font-weight:500;color:var(--ink-muted);">(optional)</span></label>
        <textarea class="form-control" id="rh-cond-note" rows="2" maxlength="500" placeholder="e.g. Limps on the left hind leg, drinks a lot of water.">${this.esc(c.note || '')}</textarea>
      </div>
      <p class="rh-crit" id="rh-crit" hidden>This animal needs a vet today. You can still start rehabilitation, but get a vet to see it first.</p>`;
  },

  // Keeps { overall, tags, note } up to date; calls onChange(state, isValid) after every change
  bindConditionChooser(modal, init, onChange) {
    const state = { overall: init && init.overall && init.overall !== 'stable' ? init.overall : '', tags: ((init && init.tags) || []).filter((t) => t !== 'healthy'), note: ((init && init.note) || '').trim() };
    const crit = modal.querySelector('#rh-crit');
    const valid = () => !!state.overall && state.tags.length > 0;
    const fire = () => { if (crit) crit.hidden = state.overall !== 'critical'; onChange(state, valid()); };
    modal.querySelectorAll('input[name="rh-overall"]').forEach((r) => r.addEventListener('change', () => { state.overall = r.value; fire(); }));
    modal.querySelectorAll('input[name="rh-tag"]').forEach((box) => box.addEventListener('change', () => {
      const on = box.checked;
      if (on) {
        // calm excludes fearful and aggressive, and the other way round
        if (box.value === 'calm') state.tags = state.tags.filter((t) => t !== 'fearful' && t !== 'aggressive');
        if (box.value === 'fearful' || box.value === 'aggressive') state.tags = state.tags.filter((t) => t !== 'calm');
        if (!state.tags.includes(box.value)) state.tags.push(box.value);
        modal.querySelectorAll('input[name="rh-tag"]').forEach((o) => { o.checked = state.tags.includes(o.value); });
      } else {
        state.tags = state.tags.filter((t) => t !== box.value);
      }
      fire();
    }));
    const note = modal.querySelector('#rh-cond-note');
    if (note) note.addEventListener('input', () => { state.note = note.value.trim(); onChange(state, valid()); });
    fire();
    return state;
  },

  // The picture of the animal: the one taken at intake, else its registered pet's photo, else a stand-in by species
  photoOf(imp) {
    if (this.safePhoto(imp.photoUrl)) return { url: imp.photoUrl, stock: false };
    const store = window.adminStore;
    const pet = imp.petId && store.getPets ? (store.getPets() || []).find((p) => String(p.id) === String(imp.petId)) : null;
    if (pet && this.safePhoto(pet.photoUrl)) return { url: pet.photoUrl, stock: false };
    const species = window.PawSpecies ? window.PawSpecies.normalize(imp.species) : imp.species;
    return this.STOCK[species] ? { url: this.STOCK[species], stock: true } : null;
  },

  thumb(imp, cls = 'rh-thumb') {
    const photo = this.photoOf(imp);
    const icon = window.PawSpecies ? window.PawSpecies.icon(imp.species) : '🐾';
    return `<span class="${cls}${photo && photo.stock ? ' is-stock' : ''}"${photo && photo.stock ? ' title="Sample photo: no picture of this animal is on file yet"' : ''}>${photo ? `<img src="${this.esc(photo.url)}" alt="${this.esc(imp.petName || 'Animal')}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('i'),{textContent:'${icon}'}))" />` : `<i aria-hidden="true">${icon}</i>`}</span>`;
  },

  // The animals of the facility being viewed (all of the account's facilities when none is chosen)
  scope() {
    const store = window.adminStore;
    const active = store.getActiveFacilityId ? store.getActiveFacilityId() : null;
    return (store.getMyImpoundments() || []).filter((i) => !active || i.shelterId === active);
  },

  // Unclaimed animals that can start: formally forfeited, or still held but past their claim deadline
  isCandidate(imp, now = Date.now()) {
    if (imp.status === 'forfeited') return true;
    const deadline = new Date(imp.claimDeadline).getTime();
    return imp.status === 'active_impounded' && Number.isFinite(deadline) && deadline < now && !imp.transferStatus;
  },

  // Called by the Impoundments page: show the animal's case on this page
  goTo(caseId) {
    this.pendingOpen = caseId;
    if ((window.location.hash || '').replace('#', '').split('/')[0] === 'rehab' && this._container) this.render(this._container);
    else window.location.hash = '#rehab';
  },

  render(container) {
    const store = window.adminStore;
    const CG = window.CareGuidelines;
    this._container = container;
    if (window.AdminNoFacility && store.currentAdmin() && !store.hasFacility()) {
      return window.AdminNoFacility.render(container, 'Rehabilitation', 'This page prepares the unclaimed animals your facility holds for adoption.');
    }
    const facility = store.getActiveFacility ? store.getActiveFacility() : null;
    const mine = this.scope();
    const byId = new Map(mine.map((i) => [i.id, i]));
    const cases = store.getRehabCases().map((c) => ({ c, imp: byId.get(c.impoundId) })).filter((x) => x.imp);
    const caseIds = new Set(cases.map((x) => x.c.impoundId));
    const candidates = mine.filter((i) => !caseIds.has(i.id) && this.isCandidate(i));
    const stages = CG.STAGES;
    const inStage = (key) => cases.filter((x) => x.c.stage === key);
    const working = cases.filter((x) => x.c.stage !== 'ready' && x.c.stage !== 'withdrawn');
    const withdrawn = inStage('withdrawn');
    const rehabilitated = inStage('ready');
    // undefined means the first sync has not finished: do not claim the database lacks the update before we know
    const ready_ok = store.rehabReady !== false;

    const stat = (n, label, tone) => `<div class="rh-stat ${tone}"><b>${n}</b><span>${label}</span></div>`;

    const candidate = (imp) => `
      <div class="rh-cand">
        ${this.thumb(imp, 'rh-thumb rh-thumb-lg')}
        <span class="rh-cand-main">
          <b>${this.esc(imp.petName || 'Unidentified animal')}</b>
          <small>${this.esc([imp.species, imp.breed].filter(Boolean).join(' · '))} · ${imp.status === 'forfeited' ? 'Forfeited' : `Claim window ended ${this.days(imp.claimDeadline)}d ago`}</small>
        </span>
        <button type="button" class="btn btn-sm btn-secondary" data-care-guide="${this.esc(imp.id)}">Care guide</button>
        <button type="button" class="btn btn-sm btn-primary" data-rehab-start="${this.esc(imp.id)}" ${ready_ok ? '' : 'disabled title="The database needs the rehabilitation update first"'}>Rehabilitate</button>
      </div>`;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <div class="dash-eyebrow">${this.esc(facility ? facility.name : 'Your facility')}</div>
          <h1>Rehabilitation</h1>
          <div class="subtitle"><span>Animals being prepared for adoption. Work through each checklist, then set the animal as rehabilitated.</span></div>
        </div>
      </div>
      ${ready_ok ? '' : `
      <div class="rh-notice" role="status"><b>Rehabilitation tracking is not switched on yet.</b> The database needs the rehabilitation update. Until then you can read the care guide for any animal, but you cannot start a case.</div>`}
      <div class="rh-stats">
        ${stat(working.length, 'In rehabilitation', 'is-work')}
        ${stat(rehabilitated.length, 'Rehabilitated', 'is-ok')}
        ${stat(candidates.length, 'Waiting to start', 'is-wait')}
      </div>

      <header class="dash-section"><span class="dash-sec-no" aria-hidden="true">1</span><h2>In rehabilitation</h2><p>Open an animal to work through its checks</p></header>
      <div id="rh-live">${this.liveHtml(cases.filter((x) => x.c.stage !== 'withdrawn'))}</div>

      <header class="dash-section"><span class="dash-sec-no" aria-hidden="true">2</span><h2>Waiting to start</h2><p>Unclaimed animals past their claim window</p></header>
      <div class="rh-cands">
        ${candidates.length ? candidates.map(candidate).join('') : `<div class="rh-empty"><b>Nobody is waiting</b><span>Animals whose claim window has ended without an owner appear here.</span></div>`}
      </div>

      ${withdrawn.length ? `
      <header class="dash-section"><span class="dash-sec-no" aria-hidden="true">3</span><h2>Withdrawn</h2><p>Taken out of rehabilitation, with a reason</p></header>
      <div class="rh-cands">
        ${withdrawn.map(({ c, imp }) => `
          <button type="button" class="rh-cand rh-cand-btn" data-rehab-open="${this.esc(c.id)}">
            ${this.thumb(imp)}
            <span class="rh-cand-main"><b>${this.esc(imp.petName || 'Unidentified animal')}</b><small>${this.esc(c.withdrawnReason || 'No reason recorded')}</small></span>
          </button>`).join('')}
      </div>` : ''}`;

    this.bindLive(container);
    container.querySelectorAll('[data-rehab-open]').forEach((b) => b.addEventListener('click', () => this.openCase(b.dataset.rehabOpen)));
    container.querySelectorAll('[data-care-guide]').forEach((b) => b.addEventListener('click', () => this.openCareGuide(b.dataset.careGuide)));
    container.querySelectorAll('[data-rehab-start]').forEach((b) => b.addEventListener('click', () => this.askStart(b.dataset.rehabStart)));

    // Straight after "Rehabilitate" is confirmed: open the animal's checklist
    if (this.pendingOpen) {
      const id = this.pendingOpen;
      this.pendingOpen = null;
      this.openCase(id);
    }
  },

  // ----- the In rehabilitation section: stage tabs and one list of cards -----
  STAGE_CHIP: { medical: 'Medical', behavior: 'Behavior', clearance: 'Clearance', ready: 'Rehabilitated' },
  SEVERITY: { critical: 0, vet_soon: 1, stable: 2 },

  // Urgent animals first, then those that have waited longest; finished ones last, newest first
  sortLive(list) {
    const sev = (x) => (this.SEVERITY[(x.c.condition && x.c.condition.overall) || 'stable'] ?? 2);
    return list.slice().sort((a, b) => {
      const fa = a.c.stage === 'ready', fb = b.c.stage === 'ready';
      if (fa !== fb) return fa ? 1 : -1;
      if (fa) return (new Date(b.c.readyAt).getTime() || 0) - (new Date(a.c.readyAt).getTime() || 0);
      return sev(a) - sev(b) || (new Date(a.c.startedAt).getTime() || 0) - (new Date(b.c.startedAt).getTime() || 0);
    });
  },

  card({ c, imp }) {
    const CG = window.CareGuidelines;
    const pr = CG.progress(c, imp.species);
    const finished = c.stage === 'ready';
    const sev = (c.condition && c.condition.overall) || 'stable';
    const name = imp.petName || 'Unidentified animal';
    const sub = [imp.species, imp.breed].filter(Boolean).join(' · ');
    const first = finished ? null : CG.missingRequired(c, imp.species)[0];
    const stageLabel = (CG.STAGES.find((s) => s.key === c.stage) || {}).label || '';
    const next = finished ? `Rehabilitated on ${this.when(c.readyAt)}`
      : first ? `Next: <b>${this.esc(first.label)}</b>` : '<b>Every check is done.</b> Ready to mark as rehabilitated';
    return `
      <button type="button" class="rhc ${finished ? 'is-ready' : ''} is-sev-${this.esc(sev)}" data-rehab-open="${this.esc(c.id)}" aria-label="${this.esc(`${name}, ${stageLabel}, ${pr.done} of ${pr.total} checks done. Open`)}">
        ${this.thumb(imp, 'rh-thumb rh-thumb-card')}
        <span class="rhc-body">
          <span class="rhc-top">
            <b class="rhc-name" title="${this.esc(name)}">${this.esc(name)}</b>
            <span class="rhc-chip is-st-${this.esc(c.stage)}">${this.esc(this.STAGE_CHIP[c.stage] || stageLabel)}</span>
          </span>
          <span class="rhc-sub">${this.esc(sub || 'Animal')} · day ${this.days(c.startedAt) + 1}</span>
          ${!finished && sev !== 'stable' ? `<span class="rhc-flag is-${this.esc(sev)}">${this.esc(this.overallOf(sev).label)}</span>` : ''}
          <span class="rhc-prog" aria-hidden="true"><span class="rh-bar"><u style="width:${pr.pct}%"></u></span><em>${pr.done}/${pr.total}</em></span>
          <span class="rhc-next">${next}</span>
        </span>
        <svg class="rhc-go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </button>`;
  },

  liveHtml(live) {
    const CG = window.CareGuidelines;
    this._live = live;
    if (!live.length) {
      return `<div class="rh-empty"><b>No animal is in rehabilitation yet</b><span>Use the Rehabilitate button on the Impoundments page, or in the list below, for an animal nobody claimed.</span></div>`;
    }
    const count = (key) => (key === 'all' ? live.length : live.filter((x) => x.c.stage === key).length);
    if (this.stageTab !== 'all' && !CG.STAGES.some((s) => s.key === this.stageTab)) this.stageTab = 'all';
    const tabs = [{ key: 'all', label: 'All' }, ...CG.STAGES.map((s) => ({ key: s.key, label: this.STAGE_CHIP[s.key] === 'Medical' ? 'Medical care' : s.label }))];
    const shown = this.sortLive(this.stageTab === 'all' ? live : live.filter((x) => x.c.stage === this.stageTab));
    const tabLabel = (tabs.find((t) => t.key === this.stageTab) || tabs[0]).label.toLowerCase();
    return `
      <label class="rh-filter">
        <span class="rh-filter-label">Show</span>
        <span class="rh-filter-wrap">
          <select class="rh-filter-select" data-rh-filter aria-label="Show animals by step">
            ${tabs.map((t) => `<option value="${t.key}" ${this.stageTab === t.key ? 'selected' : ''}>${this.esc(t.label)} (${count(t.key)})</option>`).join('')}
          </select>
        </span>
      </label>
      <div class="rh-tabs2" role="tablist" aria-label="Show animals by step">
        ${tabs.map((t) => `<button type="button" class="rh-tab" role="tab" data-rh-tab="${t.key}" aria-selected="${this.stageTab === t.key}"><span>${this.esc(t.label)}</span><em>${count(t.key)}</em></button>`).join('')}
      </div>
      ${shown.length
        ? `<div class="rhc-grid" role="list">${shown.map((x) => `<div role="listitem">${this.card(x)}</div>`).join('')}</div>`
        : `<div class="rh-empty"><b>Nobody in ${this.esc(tabLabel)} right now</b><span>Animals move here by themselves as their checks are done.</span></div>`}`;
  },

  // The chips (tablet, desktop) and the dropdown (phone) both set the step; only the section is redrawn, so the page does not jump
  bindLive(container) {
    const host = container.querySelector('#rh-live');
    if (!host) return;
    const choose = (key, focusSel) => {
      this.stageTab = key;
      host.innerHTML = this.liveHtml(this._live || []);
      this.bindLive(container);
      host.querySelectorAll('[data-rehab-open]').forEach((b) => b.addEventListener('click', () => this.openCase(b.dataset.rehabOpen)));
      host.querySelector(focusSel)?.focus({ preventScroll: true });
    };
    host.querySelectorAll('[data-rh-tab]').forEach((tab) => tab.addEventListener('click', () => choose(tab.dataset.rhTab, '.rh-tab[aria-selected="true"]')));
    host.querySelectorAll('[data-rh-filter]').forEach((sel) => sel.addEventListener('change', () => choose(sel.value, '.rh-filter-select')));
  },

  // ----- "Rehabilitate": first ask the animal's current condition, then start -----
  askStart(impoundId) {
    const store = window.adminStore;
    const imp = (store.getImpoundments() || []).find((i) => i.id === impoundId);
    if (!imp) return;
    const name = this.esc(imp.petName || 'this animal');
    const where = this.esc(imp.shelterName || 'your facility');
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header rh-modal-head">
        ${this.thumb(imp, 'rh-thumb rh-thumb-lg')}
        <div class="rh-modal-title">
          <div class="nock-card-title">Rehabilitate ${this.esc(imp.petName || 'this animal')}?</div>
          <small>${this.esc([imp.species, imp.breed].filter(Boolean).join(' · '))}</small>
        </div>
        <button class="icon-btn-subtle" id="rha-x" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body rh-modal">
        <div class="rh-panel">
          <p class="rh-q"><b>What is ${name}'s current condition?</b><span>Look at the animal now and answer first. It shapes its care guide and which checks apply.</span></p>
          ${this.conditionChooser(null)}
          <ul class="rh-after">
            <li>${name} then moves to the Rehabilitation page, where you work through its medical care, behavior and final clearance.</li>
            <li>It stays at ${where}. If its owner turns up, you can still release it to them.</li>
            <li>You can withdraw it from rehabilitation at any time, with a reason.</li>
          </ul>
        </div>
      </div>
      <div class="modal-footer">
        <span class="rh-foot-hint" id="rha-hint" role="status">Choose the overall condition</span>
        <button class="btn btn-secondary" id="rha-cancel">Cancel</button>
        <button class="btn btn-primary" id="rha-go" disabled>Start rehabilitation</button>
      </div>`);
    modal.querySelector('#rha-x').addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#rha-cancel').addEventListener('click', () => window.adminApp.closeModal());
    const go = modal.querySelector('#rha-go');
    const hint = modal.querySelector('#rha-hint');
    const state = this.bindConditionChooser(modal, null, (st, ok) => {
      go.disabled = !ok;
      if (hint) hint.textContent = ok ? this.conditionText(st) : (!st.overall ? 'Choose the overall condition' : 'Tick at least one that applies');
    });
    go.addEventListener('click', async () => {
      if (!state.overall || !state.tags.length) return;
      go.disabled = true;
      go.textContent = 'Starting…';
      const created = await store.startRehab(impoundId, { overall: state.overall, tags: state.tags, note: state.note });
      if (!created) { go.disabled = false; go.textContent = 'Start rehabilitation'; return; }
      window.adminApp.closeModal();
      window.adminApp.showToast(`${imp.petName || 'The animal'} is now in rehabilitation.`, 'success', 2600);
      this.goTo(created.id);
    });
  },

  // Update the condition of an animal that is still in rehabilitation
  askCondition(caseId) {
    const store = window.adminStore;
    const c = store.getRehabCases().find((x) => x.id === caseId);
    if (!c) return;
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Update the current condition</div>
        <button class="icon-btn-subtle" id="rhp-x" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body rh-modal"><div class="rh-panel">${this.conditionChooser(c.condition)}</div></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="rhp-back">Back</button>
        <button class="btn btn-primary" id="rhp-save">Save</button>
      </div>`);
    const save = modal.querySelector('#rhp-save');
    const state = this.bindConditionChooser(modal, c.condition, (st, ok) => { save.disabled = !ok; });
    modal.querySelector('#rhp-x').addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#rhp-back').addEventListener('click', () => this.openCase(caseId));
    save.addEventListener('click', () => {
      if (!state.overall || !state.tags.length) return;
      store.saveRehab(caseId, { condition: { overall: state.overall, tags: state.tags, note: state.note } });
      this.openCase(caseId);
    });
  },

  // ----- the care guide for any animal -----
  openCareGuide(impoundId) {
    const imp = (window.adminStore.getImpoundments() || []).find((i) => i.id === impoundId);
    if (!imp) return;
    const rec = window.CareGuidelines.recommend(imp);
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Care guide: ${this.esc(imp.petName || 'Unidentified animal')}</div>
        <button class="icon-btn-subtle" id="cg-x" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body rh-modal">${window.CareGuidelines.renderHtml(rec)}</div>
      <div class="modal-footer"><button class="btn btn-primary" id="cg-ok">Done</button></div>`);
    modal.querySelector('#cg-x').addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#cg-ok').addEventListener('click', () => window.adminApp.closeModal());
  },

  // ----- one animal in rehabilitation: a single checklist, grouped by step -----
  openCase(caseId, panel = 'checklist') {
    const store = window.adminStore;
    const CG = window.CareGuidelines;
    const c = store.getRehabCases().find((x) => x.id === caseId);
    const imp = c && (store.getImpoundments() || []).find((i) => i.id === c.impoundId);
    if (!c || !imp) return;
    const keepScroll = this._keepScroll || 0, keepFocus = this._keepFocus, nudge = this._nudge;
    this._keepScroll = 0; this._keepFocus = null; this._nudge = null;

    const withdrawn = c.stage === 'withdrawn';
    const finished = c.stage === 'ready';
    const editable = !withdrawn && !finished;
    const done = c.checklist || {};
    const tick = (k) => !!(done[k] && done[k].done);
    const sections = CG.WORKING.map((key, i) => {
      const st = CG.STAGES.find((s) => s.key === key);
      const items = CG.checklist(imp.species, key, c.condition);
      const req = items.filter((it) => it.required);
      return { st, no: i + 1, items, req, got: req.filter((it) => tick(it.key)).length };
    });
    const missing = CG.missingRequired(c, imp.species);
    const allRequired = missing.length === 0;
    const pr = CG.progress(c, imp.species);
    const note = (c.notes && (c.notes.general || '')) || '';
    const condText = this.conditionText(c.condition);

    const row = (it) => `
      <li class="${tick(it.key) ? 'is-done' : ''}" data-rh-row="${this.esc(it.key)}">
        <label>
          <input type="checkbox" data-rh-item="${this.esc(it.key)}" ${tick(it.key) ? 'checked' : ''} ${editable ? '' : 'disabled'} />
          <span class="rh-item-text"><b>${this.esc(it.label)}${it.required ? '' : ' <em>optional</em>'}</b><small>${this.esc(it.hint)}</small></span>
          ${tick(it.key) && done[it.key].at ? `<time>${this.esc(this.when(done[it.key].at))}</time>` : ''}
        </label>
      </li>`;

    let body;
    if (panel === 'guide') {
      body = CG.renderHtml(CG.recommend(imp, { condition: c.condition }));
    } else if (withdrawn) {
      body = `
        <div class="rh-banner is-withdrawn"><b>Withdrawn from rehabilitation</b><span>${this.esc(c.withdrawnReason || 'No reason recorded.')}</span></div>
        <p class="rh-help">The animal is not being rehabilitated. If things have changed, put it back and carry on with the checks you already did.</p>`;
    } else {
      body = `
        <div class="rh-planbar is-${this.esc((c.condition && c.condition.overall) || 'stable')}"><span>Condition</span><b>${this.esc(condText)}${c.condition && c.condition.note ? `<small>${this.esc(c.condition.note)}</small>` : ''}</b>${editable ? '<button type="button" class="rh-link" id="rh-cond-change">Update</button>' : ''}</div>
        ${finished ? `<div class="rh-banner is-ready"><b>Rehabilitated</b><span>Set on ${this.esc(this.when(c.readyAt))}. Every check was done, so ${this.esc(imp.petName || 'this animal')} is ready to be listed for adoption.</span></div>` : `
        <div class="rh-progress ${allRequired ? 'is-complete' : ''}" role="status">
          <div class="rh-progress-top"><b>${allRequired ? 'Every required check is done' : `${pr.done} of ${pr.total} required checks done`}</b><span>${pr.pct}%</span></div>
          <span class="rh-bar" aria-hidden="true"><u style="width:${pr.pct}%"></u></span>
        </div>`}
        ${sections.map((sec) => `
          <section class="rh-stage">
            <h4 class="rh-stage-head"><span class="rh-col-no">${sec.no}</span><b>${this.esc(sec.st.label)}</b><em class="${sec.got === sec.req.length ? 'is-ok' : ''}">${sec.got} of ${sec.req.length}</em></h4>
            <ul class="rh-list">${sec.items.map(row).join('')}</ul>
          </section>`).join('')}
        <div class="form-group form-full rh-note">
          <label class="form-label" for="rh-note">Notes</label>
          <textarea class="form-control" id="rh-note" rows="3" maxlength="1500" placeholder="Findings, treatments given, behavior seen..." ${editable ? '' : 'disabled'}>${this.esc(note)}</textarea>
        </div>`;
    }

    const blocked = !allRequired;
    const footer = withdrawn
      ? '<button class="btn btn-secondary" id="rh-close">Close</button><button class="btn btn-primary" id="rh-restore">Put back in rehabilitation</button>'
      : finished
        ? '<button class="btn btn-secondary" id="rh-close">Close</button><button class="btn btn-secondary" id="rh-reopen">Reopen rehabilitation</button>'
        : `<span class="rh-foot-hint ${blocked ? '' : 'is-ok'}" role="status">${blocked ? `${missing.length} required ${missing.length === 1 ? 'check' : 'checks'} left` : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>Ready to set as rehabilitated'}</span>
           <button class="btn btn-secondary" id="rh-withdraw">Withdraw</button>
           <button class="btn btn-primary${blocked ? ' is-blocked' : ''}" id="rh-done" aria-disabled="${blocked}">Mark as rehabilitated</button>`;

    const stageNow = CG.STAGES.find((s) => s.key === c.stage);
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header rh-modal-head">
        ${this.thumb(imp, 'rh-thumb rh-thumb-lg')}
        <div class="rh-modal-title">
          <div class="nock-card-title">${this.esc(imp.petName || 'Unidentified animal')}</div>
          <small>${this.esc([imp.species, imp.breed].filter(Boolean).join(' · '))} · day ${this.days(c.startedAt) + 1}${withdrawn ? '' : ` · ${this.esc(stageNow ? stageNow.label : '')}`}</small>
        </div>
        <button class="icon-btn-subtle" id="rh-x" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body rh-modal">
        ${withdrawn && panel !== 'guide' ? '' : `<div class="rh-tabs" role="tablist"><button type="button" class="${panel === 'checklist' ? 'is-active' : ''}" data-rh-panel="checklist" role="tab">Checklist</button><button type="button" class="${panel === 'guide' ? 'is-active' : ''}" data-rh-panel="guide" role="tab">Care guide</button></div>`}
        <div class="rh-panel">${body}</div>
      </div>
      <div class="modal-footer">${footer}</div>`);

    const panelEl = modal.querySelector('.rh-panel');
    if (panelEl && keepScroll) panelEl.scrollTop = keepScroll;
    if (keepFocus) modal.querySelector(`[data-rh-item="${CSS.escape(keepFocus)}"]`)?.focus({ preventScroll: true });
    if (nudge) {
      const target = modal.querySelector(`[data-rh-row="${CSS.escape(nudge)}"]`);
      if (target) {
        target.scrollIntoView({ block: 'center' });
        target.classList.add('is-nudge');
        target.querySelector('input')?.focus({ preventScroll: true });
      }
    }
    const again = (p = panel) => this.openCase(caseId, p);
    modal.querySelector('#rh-x').addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#rh-close')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelectorAll('[data-rh-panel]').forEach((b) => b.addEventListener('click', () => again(b.dataset.rhPanel)));

    // Ticking saves at once, and the step follows the checklist
    modal.querySelectorAll('[data-rh-item]').forEach((box) => box.addEventListener('change', () => {
      const next = { ...(c.checklist || {}) };
      if (box.checked) next[box.dataset.rhItem] = { done: true, at: new Date().toISOString() }; else delete next[box.dataset.rhItem];
      const stage = CG.derivedStage({ checklist: next }, imp.species);
      this._keepScroll = panelEl ? panelEl.scrollTop : 0;
      this._keepFocus = box.dataset.rhItem;
      store.saveRehab(caseId, { checklist: next, ...(stage !== c.stage ? { stage } : {}) });
      again('checklist');
    }));
    modal.querySelector('#rh-note')?.addEventListener('change', (e) => {
      store.saveRehab(caseId, { notes: { ...(c.notes || {}), general: e.target.value.trim() } });
    });

    modal.querySelector('#rh-done')?.addEventListener('click', () => {
      // Not allowed yet: instead of doing nothing, take the person to what is missing
      if (blocked) {
        this._nudge = missing[0] && missing[0].key;
        window.adminApp.showToast(`${missing.length} required ${missing.length === 1 ? 'check is' : 'checks are'} still to do.`, 'info', 2600);
        again('checklist');
        return;
      }
      const typed = modal.querySelector('#rh-note');
      if (typed && typed.value.trim() !== note) store.saveRehab(caseId, { notes: { ...(c.notes || {}), general: typed.value.trim() } });
      window.adminApp.confirmDialog({
        title: 'Set as rehabilitated?',
        message: `${imp.petName || 'This animal'} has passed every check and will be ready to be listed for adoption.`,
        confirmLabel: 'Mark as rehabilitated'
      }).then(async (ok) => {
        if (!ok) { again('checklist'); return; }
        const saved = await store.finishRehab(caseId);
        if (saved) window.adminApp.showToast(`${imp.petName || 'The animal'} is rehabilitated and ready for adoption.`, 'success', 3200);
        again('checklist');
      });
    });
    modal.querySelector('#rh-reopen')?.addEventListener('click', () => { store.saveRehab(caseId, { stage: 'clearance' }); again('checklist'); });
    modal.querySelector('#rh-restore')?.addEventListener('click', () => { store.saveRehab(caseId, { stage: CG.derivedStage(c, imp.species) }); again('checklist'); });
    modal.querySelector('#rh-cond-change')?.addEventListener('click', () => this.askCondition(caseId));
    modal.querySelector('#rh-withdraw')?.addEventListener('click', () => this.askWithdraw(caseId));
  },

  askWithdraw(caseId) {
    const store = window.adminStore;
    const c = store.getRehabCases().find((x) => x.id === caseId);
    if (!c) return;
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Withdraw from rehabilitation?</div>
        <button class="icon-btn-subtle" id="rhw-x" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size:12.5px; color:var(--ink-muted); margin:0 0 12px; line-height:1.5;">The animal stops being rehabilitated and will not be listed for adoption. Say why, so the next person knows (for example a medical or behavior reason).</p>
        <div class="form-group form-full">
          <label class="form-label" for="rhw-reason">Reason *</label>
          <textarea class="form-control" id="rhw-reason" rows="3" maxlength="500" placeholder="e.g. The vet found a condition that cannot be treated here."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="rhw-back">Back</button>
        <button class="btn btn-danger" id="rhw-ok">Withdraw</button>
      </div>`);
    modal.querySelector('#rhw-x').addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#rhw-back').addEventListener('click', () => this.openCase(caseId));
    modal.querySelector('#rhw-ok').addEventListener('click', () => {
      const reason = modal.querySelector('#rhw-reason').value.trim();
      if (!reason) { modal.querySelector('#rhw-reason').focus(); window.adminApp.showToast('Please give a reason.', 'warning', 2500); return; }
      store.saveRehab(caseId, { stage: 'withdrawn', withdrawnReason: reason });
      this.openCase(caseId);
    });
  }
};
