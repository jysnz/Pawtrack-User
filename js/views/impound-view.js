/**
 * PawTrack Impoundments (owner app)
 * Step 1: the list of impound facilities, with search and filters.
 * Step 2: tap a facility to see every animal it holds (or released), with search and filters.
 * The data is public (the same lists the map already uses), so this page is open to signed-out visitors too.
 *
 * Motion is plain CSS (entrance stagger, hover/press feedback, smooth expand, shimmer skeletons) plus a tiny
 * count-up for the numbers; everything is switched off for people who prefer reduced motion.
 */

class ImpoundView {
  constructor() {
    this.facilityId = null;
    try { this.facilityId = sessionStorage.getItem('pawtrack_impound_facility') || null; } catch (e) { /* private mode */ }

    // facility list
    this.fQuery = '';
    this.fSort = 'name';         // 'name' | 'pets'
    // pets of one facility
    this.pQuery = '';
    this.pStatus = 'holding';    // 'holding' | 'soon' | 'released' | 'all'
    this.pSpecies = 'all';       // 'all' | 'Dog' | 'Cat' | 'Other'
    this.pSort = 'newest';       // 'newest' | 'closing' | 'name'
    this.expanded = new Set();
    this.container = null;
    this.enter = true;           // play the entrance animation on the next draw (page opened / switched), not on every filter tap
    this.fresh = false;          // a filter or sort changed: soft fade the results

    // Browser Back from a facility returns to the facility list instead of leaving the page
    window.addEventListener('popstate', (e) => {
      if (window.location.hash === '#impound' && this.facilityId && !(e.state && e.state.ipFacility)) {
        this.clearFacility();
        this.enter = true;
        this.render(this.container || document.getElementById('app-viewport'));
      }
    });
    // "/" jumps to the search box, like the admin console
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || window.location.hash !== '#impound') return;
      const t = e.target;
      if (t && (t.matches('input, textarea, select') || t.isContentEditable)) return;
      const input = document.querySelector('.ip-search input');
      if (input) { e.preventDefault(); input.focus(); }
    });
  }

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------------------------------------------------------------- data
  shelters() { return (window.pawStore && window.pawStore.getShelters()) || []; }
  impounds() { return (window.pawStore && window.pawStore.getImpoundments()) || []; }
  isHolding(i) { return i.status === 'active_impounded' || i.status === 'active'; }
  speciesOf(i) { return ['Dog', 'Cat'].includes(i.species) ? i.species : 'Other'; }
  safePhoto(url) { return /^https:\/\//.test(url || '') ? url : ''; }
  reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  matches(query, fields) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    const hay = fields.map((f) => String(f || '').toLowerCase()).join(' ');
    return q.split(/\s+/).every((w) => hay.includes(w));
  }
  hoursLeft(i) {
    const t = new Date(i.claimDeadline).getTime();
    return Number.isFinite(t) ? Math.round((t - Date.now()) / 3600000) : null;
  }
  closingSoon(i) { const h = this.hoursLeft(i); return this.isHolding(i) && h != null && h > 0 && h <= 24; }
  fmtDateTime(v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  scrollTop() {
    try { window.scrollTo({ top: 0, behavior: this.reduced() ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
  }

  clearFacility() {
    this.facilityId = null;
    try { sessionStorage.removeItem('pawtrack_impound_facility'); } catch (e) { /* ignore */ }
  }

  open(id) {
    this.facilityId = id;
    try { sessionStorage.setItem('pawtrack_impound_facility', id); } catch (e) { /* ignore */ }
    try { window.history.pushState({ ipFacility: id }, '', '#impound'); } catch (e) { /* ignore */ }
    this.pQuery = ''; this.pStatus = 'holding'; this.pSpecies = 'all'; this.pSort = 'newest'; this.expanded.clear();
    this.enter = true;
    this.render(this.container);
    this.scrollTop();
  }

  back() {
    // use the browser's history so Back and this button agree
    if (window.history.state && window.history.state.ipFacility) { window.history.back(); return; }
    this.clearFacility();
    this.enter = true;
    this.render(this.container);
    this.scrollTop();
  }

  // Count-up for the big numbers (instant when motion is reduced, or when the number did not change)
  countUp(el, to) {
    if (!el) return;
    const from = Number(el.dataset.v);
    el.dataset.v = String(to);
    if (this.reduced() || !Number.isFinite(from) || from === to) { el.textContent = String(to); return; }
    const start = performance.now(), dur = 520;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (p < 1 && el.isConnected) requestAnimationFrame(tick); else el.textContent = String(to);
    };
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- shell
  render(container) {
    this.container = container || document.getElementById('app-viewport');
    if (!this.container) return;
    // A store update must not wipe what someone is typing in the search box, or collapse an open page
    const a = document.activeElement;
    if (a && this.container.contains(a) && a.matches && a.matches('.ip-search input')) return;

    const facility = this.facilityId ? this.shelters().find((s) => s.id === this.facilityId) : null;
    if (this.facilityId && !facility && (window.pawStore && window.pawStore.syncStatus) !== 'connecting') this.clearFacility();
    const mode = facility ? 'pets' : 'facilities';

    // Same page again (a background store update): refresh the numbers and the list only, no re-animation
    if (this.container.querySelector('.ip-page') && this.mode === mode && (mode === 'facilities' || (this.facility && this.facility.id === facility.id))) {
      this.facility = facility;
      mode === 'pets' ? this.drawPets() : this.drawFacilities();
      return;
    }

    this.mode = mode;
    this.facility = facility;
    // sticky toolbars sit under the app's own sticky header
    const header = document.querySelector('.app-header');
    this.container.style.setProperty('--ip-top', `${header ? header.offsetHeight : 0}px`);
    this.enter = true;   // a freshly opened page animates in
    mode === 'pets' ? this.renderPetsShell() : this.renderFacilitiesShell();
  }

  searchBox(id, placeholder, value) {
    return `
      <label class="ip-search" for="${id}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="search" id="${id}" placeholder="${this.esc(placeholder)}" value="${this.esc(value)}" autocomplete="off" aria-label="${this.esc(placeholder)}" />
        <kbd class="ip-kbd" aria-hidden="true">/</kbd>
        <button type="button" class="ip-search-clear" id="${id}-clear" aria-label="Clear search" ${value ? '' : 'hidden'}>&times;</button>
      </label>`;
  }

  select(id, label, current, options) {
    return `<label class="ip-select"><span>${label}</span><select id="${id}">${options.map(([v, l]) => `<option value="${v}" ${current === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  }

  stat(id, label, tone) {
    return `<div class="ip-stat ${tone || ''}"><b id="${id}" data-v="0">0</b><span>${label}</span></div>`;
  }

  skeletons(n) {
    return `<div class="ip-grid" aria-hidden="true">${Array.from({ length: n }, () => '<div class="ip-skel"><i class="ip-skel-cover"></i><div><i class="ip-skel-line w60"></i><i class="ip-skel-line w90"></i><i class="ip-skel-line w40"></i></div></div>').join('')}</div>`;
  }

  // ---------------------------------------------------------------- step 1: facilities
  renderFacilitiesShell() {
    this.container.innerHTML = `
      <div class="ip-page ip-in">
        <div class="view-header">
          <div class="view-title-group">
            <h1>Impoundments</h1>
            <div class="view-subtitle">Animal facilities that hold lost and stray pets. Tap a facility to see the animals it has.</div>
          </div>
        </div>
        <div class="ip-stats">
          ${this.stat('ip-s1', 'Facilities')}
          ${this.stat('ip-s2', 'Animals in holding', 'is-primary')}
          ${this.stat('ip-s3', 'Closing within 24h', 'is-warn')}
        </div>
        <div class="ip-sticky">
          <div class="ip-toolbar">
            ${this.searchBox('ip-fsearch', 'Search a facility, address or city', this.fQuery)}
            ${this.select('ip-fsort', 'Sort', this.fSort, [['name', 'Name A to Z'], ['pets', 'Most animals']])}
          </div>
        </div>
        <div class="ip-summary" id="ip-summary" aria-live="polite"></div>
        <div id="ip-results"></div>
      </div>`;
    const input = this.container.querySelector('#ip-fsearch');
    const clear = this.container.querySelector('#ip-fsearch-clear');
    input.addEventListener('input', () => { this.fQuery = input.value; clear.hidden = !input.value; this.drawFacilities(); });
    clear.addEventListener('click', () => { this.fQuery = ''; input.value = ''; clear.hidden = true; input.focus(); this.drawFacilities(); });
    this.container.querySelector('#ip-fsort').addEventListener('change', (e) => { this.fSort = e.target.value; this.fresh = true; this.drawFacilities(); });
    this.drawFacilities();
  }

  drawFacilities() {
    const shelters = this.shelters();
    const impounds = this.impounds();
    const holdingBy = {};
    impounds.filter((i) => this.isHolding(i)).forEach((i) => { holdingBy[i.shelterId] = (holdingBy[i.shelterId] || 0) + 1; });
    const totalHolding = Object.values(holdingBy).reduce((n, v) => n + v, 0);
    this.countUp(this.container.querySelector('#ip-s1'), shelters.length);
    this.countUp(this.container.querySelector('#ip-s2'), totalHolding);
    this.countUp(this.container.querySelector('#ip-s3'), impounds.filter((i) => this.closingSoon(i)).length);

    const searched = shelters.filter((s) => this.matches(this.fQuery, [s.name, s.address, s.city, s.phone]));

    let list = searched;
    list = list.slice().sort((a, b) => this.fSort === 'pets'
      ? (holdingBy[b.id] || 0) - (holdingBy[a.id] || 0) || String(a.name).localeCompare(String(b.name))
      : String(a.name).localeCompare(String(b.name)));

    this.container.querySelector('#ip-summary').textContent = shelters.length ? `Showing ${list.length} of ${shelters.length} ${shelters.length === 1 ? 'facility' : 'facilities'}` : '';

    const out = this.container.querySelector('#ip-results');
    if (!shelters.length) {
      const loading = window.pawStore && window.pawStore.syncStatus === 'connecting';
      out.innerHTML = loading ? this.skeletons(6) : this.emptyState('No facilities yet', 'Impound facilities appear here once they register.');
      return;
    }
    if (!list.length) {
      out.innerHTML = this.emptyState('No facilities match', 'Try a different search, or choose "All facilities".');
      return;
    }
    this.paint(out, `<div class="ip-grid">${list.map((s, n) => this.facilityCard(s, holdingBy[s.id] || 0, n)).join('')}</div>`);
    out.querySelectorAll('.ip-fac').forEach((card) => {
      const go = () => this.open(card.dataset.id);
      card.addEventListener('click', go);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  // Puts new results in; entrance animation only when the page was just opened, a soft fade for filter changes
  paint(out, html) {
    out.innerHTML = html;
    out.classList.remove('is-enter', 'is-fresh');
    if (this.reduced()) { this.enter = false; this.fresh = false; return; }
    void out.offsetWidth;
    if (this.enter) { out.classList.add('is-enter'); this.enter = false; this.fresh = false; }
    else if (this.fresh) { out.classList.add('is-fresh'); this.fresh = false; }
  }

  emptyState(title, text, action) {
    return `<div class="ip-empty">
      <svg class="ip-empty-ic" width="46" height="46" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 10.5c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-6 2c1.38 0 2.5-1.12 2.5-2.5S7.38 7.5 6 7.5 3.5 8.62 3.5 10s1.12 2.5 2.5 2.5zm12 0c1.38 0 2.5-1.12 2.5-2.5S19.38 7.5 18 7.5s-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zM12 12c-2.76 0-5 2.24-5 5 0 2.21 1.79 4 4 4 1.1 0 2-.9 2-2 0 1.1.9 2 2 2 2.21 0 4-1.79 4-4 0-2.76-2.24-5-5-5z"/></svg>
      <b>${this.esc(title)}</b><p>${this.esc(text)}</p>${action || ''}</div>`;
  }

  facilityCard(s, held, n) {
    const photo = this.safePhoto(s.photoUrl);
    const cap = Number(s.capacity) || 0;
    const pct = cap ? Math.min(100, Math.round((held / cap) * 100)) : 0;
    const tone = cap && held >= cap ? 'is-full' : pct >= 80 ? 'is-high' : '';
    return `
      <div class="ip-fac" role="button" tabindex="0" data-id="${this.esc(s.id)}" style="--i:${Math.min(n, 11)}" aria-label="Open the animals at ${this.esc(s.name)}">
        <div class="ip-fac-cover ${photo ? '' : 'is-empty'}">
          ${photo ? `<img src="${this.esc(photo)}" alt="" loading="lazy" />` : '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>'}
          <span class="ip-fac-count ${held ? '' : 'is-zero'}">${held} in holding</span>
        </div>
        <div class="ip-fac-body">
          <h3>${this.esc(s.name)}</h3>
          <p class="ip-fac-addr">${this.esc(s.address || 'No address on file')}</p>
          <div class="ip-fac-meta">
            ${s.hours ? `<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>${this.esc(s.hours)}</span>` : ''}
            ${s.phone ? `<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>${this.esc(s.phone)}</span>` : ''}
          </div>
          ${cap ? `<div class="ip-cap"><div class="ip-cap-top"><span>Capacity</span><b>${held} / ${cap}</b></div><i class="ip-bar ${tone}"><u style="width:${pct}%"></u></i></div>` : ''}
          <span class="ip-fac-go">View animals <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- step 2: the animals of one facility
  renderPetsShell() {
    const s = this.facility;
    const directions = Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.lat},${s.lng}`)}` : '';
    const tel = String(s.phone || '').replace(/[^\d+]/g, '');
    this.container.innerHTML = `
      <div class="ip-page ip-in">
        <button type="button" class="ip-back" id="ip-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          All facilities
        </button>
        <div class="ip-head">
          <div class="ip-head-main">
            <h1>${this.esc(s.name)}</h1>
            <p>${this.esc(s.address || 'No address on file')}</p>
            ${s.hours ? `<p class="ip-head-hours">Open ${this.esc(s.hours)}</p>` : ''}
          </div>
          <div class="ip-head-actions">
            ${tel ? `<a class="btn btn-outline btn-sm" href="tel:${this.esc(tel)}">Call</a>` : ''}
            ${directions ? `<a class="btn btn-primary btn-sm" href="${this.esc(directions)}" target="_blank" rel="noopener">Directions</a>` : ''}
          </div>
        </div>
        <div class="ip-stats">
          ${this.stat('ip-s1', 'In holding now', 'is-primary')}
          ${this.stat('ip-s2', 'Closing within 24h', 'is-warn')}
          ${this.stat('ip-s3', 'Records in total')}
        </div>
        <div class="ip-note">Think one of these animals is yours? Contact the facility before the claim window ends and bring a valid ID and proof that the pet is yours.</div>
        <div class="ip-sticky">
          <div class="ip-toolbar">
            ${this.searchBox('ip-psearch', 'Search by name, breed or kennel', this.pQuery)}
            <label class="ip-select"><span>Status</span><select id="ip-pstatus"></select></label>
            <label class="ip-select"><span>Species</span><select id="ip-pspecies"></select></label>
            ${this.select('ip-psort', 'Sort', this.pSort, [['newest', 'Newest first'], ['closing', 'Claim window ending soon'], ['name', 'Name A to Z']])}
          </div>
        </div>
        <div class="ip-summary" id="ip-summary" aria-live="polite"></div>
        <div id="ip-results"></div>
      </div>`;
    this.container.querySelector('#ip-back').addEventListener('click', () => this.back());
    const input = this.container.querySelector('#ip-psearch');
    const clear = this.container.querySelector('#ip-psearch-clear');
    input.addEventListener('input', () => { this.pQuery = input.value; clear.hidden = !input.value; this.drawPets(); });
    clear.addEventListener('click', () => { this.pQuery = ''; input.value = ''; clear.hidden = true; input.focus(); this.drawPets(); });
    this.container.querySelector('#ip-psort').addEventListener('change', (e) => { this.pSort = e.target.value; this.fresh = true; this.drawPets(); });
    this.container.querySelector('#ip-pstatus').addEventListener('change', (e) => { this.pStatus = e.target.value; this.fresh = true; this.drawPets(); });
    this.container.querySelector('#ip-pspecies').addEventListener('change', (e) => { this.pSpecies = e.target.value; this.fresh = true; this.drawPets(); });
    this.drawPets();
  }

  drawPets() {
    if (!this._claimsLoaded) { this._claimsLoaded = true; this.loadClaims(); } // which animals this person already claimed
    const all = this.impounds().filter((i) => i.shelterId === this.facilityId);
    const holdingAll = all.filter((i) => this.isHolding(i));
    this.countUp(this.container.querySelector('#ip-s1'), holdingAll.length);
    this.countUp(this.container.querySelector('#ip-s2'), holdingAll.filter((i) => this.closingSoon(i)).length);
    this.countUp(this.container.querySelector('#ip-s3'), all.length);

    // counts follow the search and the species filter, so each pill says how many it would show
    const statusOf = (k, i) => k === 'all' ? true : k === 'holding' ? this.isHolding(i) : k === 'soon' ? this.closingSoon(i) : !this.isHolding(i);
    const base = (ignore) => all.filter((i) =>
      this.matches(this.pQuery, [i.petName, i.breed, i.species, i.kennel || i.cageNumber, i.healthCondition, i.impoundLocation || i.location]) &&
      (ignore === 'species' || this.pSpecies === 'all' || this.speciesOf(i) === this.pSpecies) &&
      (ignore === 'status' || statusOf(this.pStatus, i)));
    const forStatus = base('status');
    const sc = { holding: forStatus.filter((i) => statusOf('holding', i)).length, soon: forStatus.filter((i) => statusOf('soon', i)).length, released: forStatus.filter((i) => statusOf('released', i)).length, all: forStatus.length };
    const fill = (sel, options, current) => {
      const html = options.map(([v, l, c]) => `<option value="${v}" ${current === v ? 'selected' : ''}>${l} (${c})</option>`).join('');
      if (sel.innerHTML !== html) sel.innerHTML = html;
    };
    fill(this.container.querySelector('#ip-pstatus'), [['holding', 'In holding', sc.holding], ['soon', 'Closing soon', sc.soon], ['released', 'Released', sc.released], ['all', 'All', sc.all]], this.pStatus);
    const forSpecies = base('species');
    const spc = { all: forSpecies.length, Dog: forSpecies.filter((i) => this.speciesOf(i) === 'Dog').length, Cat: forSpecies.filter((i) => this.speciesOf(i) === 'Cat').length, Other: forSpecies.filter((i) => this.speciesOf(i) === 'Other').length };
    fill(this.container.querySelector('#ip-pspecies'), [['all', 'All animals', spc.all], ['Dog', 'Dogs', spc.Dog], ['Cat', 'Cats', spc.Cat], ['Other', 'Other', spc.Other]], this.pSpecies);

    let list = base();
    list = list.slice().sort((a, b) => {
      if (this.pSort === 'name') return String(a.petName).localeCompare(String(b.petName));
      if (this.pSort === 'closing') {
        const ha = this.isHolding(a) ? (this.hoursLeft(a) ?? 1e9) : 1e12, hb = this.isHolding(b) ? (this.hoursLeft(b) ?? 1e9) : 1e12;
        return ha - hb;
      }
      return new Date(b.intakeDate).getTime() - new Date(a.intakeDate).getTime();
    });

    this.container.querySelector('#ip-summary').textContent = all.length ? `Showing ${list.length} of ${all.length}` : '';

    const out = this.container.querySelector('#ip-results');
    if (!all.length) {
      out.innerHTML = this.emptyState('No animals recorded here yet', 'When this facility takes in an animal, it will show up on this page.');
      return;
    }
    if (!list.length) {
      out.innerHTML = this.emptyState('No animals match', 'Try a different search or filter.', '<button type="button" class="btn btn-outline btn-sm" id="ip-reset">Reset filters</button>');
      out.querySelector('#ip-reset').addEventListener('click', () => {
        this.pQuery = ''; this.pStatus = 'all'; this.pSpecies = 'all'; this.fresh = true;
        const input = this.container.querySelector('#ip-psearch'); input.value = '';
        this.container.querySelector('#ip-psearch-clear').hidden = true;
        this.drawPets();
      });
      return;
    }
    this.paint(out, `<div class="ip-grid ip-grid-pets">${list.map((i, n) => this.petCard(i, n)).join('')}</div>`);
    out.querySelectorAll('.ip-more').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (this.expanded.has(id)) this.expanded.delete(id); else this.expanded.add(id);
      const open = this.expanded.has(id);
      b.closest('.ip-pet').classList.toggle('is-open', open);
      b.setAttribute('aria-expanded', String(open));
      b.querySelector('span').textContent = open ? 'Hide details' : 'Details';
    }));
    out.querySelectorAll('.ip-pet-photo-btn').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.lightbox(b.dataset.src, b.dataset.name); }));
    // Tapping an animal opens its details and the claim button
    out.querySelectorAll('.ip-pet').forEach((card) => {
      card.classList.add('is-tappable');
      card.addEventListener('click', (e) => {
        if (e.target.closest('.ip-more, .ip-pet-photo-btn')) return;
        this.openPet(card.dataset.id);
      });
    });
  }

  petCard(i, n) {
    const photo = this.safePhoto(i.photoUrl);
    const holding = this.isHolding(i);
    const h = this.hoursLeft(i);
    let claim = '';
    if (holding && h != null) {
      if (h <= 0) claim = '<span class="ip-chip is-late">Claim window ended</span>';
      else claim = `<span class="ip-chip ${h <= 24 ? 'is-soon' : 'is-ok'}">${h >= 48 ? `${Math.floor(h / 24)} days left to claim` : `${h}h left to claim`}</span>`;
    }
    const status = holding ? '' : `<span class="ip-chip is-done">${i.status === 'claimed' ? 'Returned to owner' : 'Released'}</span>`;
    const open = this.expanded.has(i.id);
    const name = i.petName || 'Unidentified animal';
    const kennel = i.kennel || i.cageNumber;
    const where = i.impoundLocation || i.location;
    const icon = this.speciesOf(i) === 'Cat' ? '🐈' : this.speciesOf(i) === 'Dog' ? '🐕' : '🐾';
    return `
      <article class="ip-pet ${open ? 'is-open' : ''} ${this.closingSoon(i) ? 'is-urgent' : ''}" data-id="${this.esc(i.id)}" style="--i:${Math.min(n, 11)}">
        ${photo
          ? `<button type="button" class="ip-pet-photo ip-pet-photo-btn" data-src="${this.esc(photo)}" data-name="${this.esc(name)}" aria-label="View a larger photo of ${this.esc(name)}"><img src="${this.esc(photo)}" alt="" loading="lazy" /></button>`
          : `<div class="ip-pet-photo is-empty"><span aria-hidden="true">${icon}</span></div>`}
        <div class="ip-pet-body">
          <div class="ip-pet-top">
            <h3>${this.esc(name)}</h3>
            ${kennel ? `<span class="ip-kennel">${this.esc(kennel)}</span>` : ''}
          </div>
          <p class="ip-pet-sub">${this.esc([i.species, i.breed].filter(Boolean).join(' · ') || 'Animal')}</p>
          <div class="ip-pet-chips">${claim}${status}${this.claimChip(i.id)}</div>
          <p class="ip-pet-note">${this.esc(i.healthCondition || 'No health notes recorded.')}</p>
          <div class="ip-pet-more-wrap"><dl class="ip-pet-more">
            <div><dt>Taken in</dt><dd>${this.esc(this.fmtDateTime(i.intakeDate) || 'Unknown')}</dd></div>
            ${holding ? `<div><dt>Claim by</dt><dd>${this.esc(this.fmtDateTime(i.claimDeadline) || 'Unknown')}</dd></div>` : ''}
            ${where ? `<div><dt>Found at</dt><dd>${this.esc(where)}</dd></div>` : ''}
          </dl></div>
          <button type="button" class="ip-more" data-id="${this.esc(i.id)}" aria-expanded="${open}"><span>${open ? 'Hide details' : 'Details'}</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
        </div>
      </article>`;
  }

  // ---------------------------------------------------------------- claiming an animal
  client() { return (window.pawApp && window.pawApp.supabase) || null; }

  // What this person has already claimed: { impoundId: 'pending' | 'accepted' | 'rejected' }
  async loadClaims() {
    const user = window.pawStore && window.pawStore.getGoogleUser();
    const sb = this.client();
    this.claims = this.claims || {};
    if (!user || !user.id || !sb) return;
    const { data, error } = await sb.from('impound_claims').select('impound_id, status, created_at').eq('claimant_id', user.id).order('created_at', { ascending: true });
    if (error) return;
    const next = {};
    (data || []).forEach((c) => { next[c.impound_id] = c.status; });
    const changed = JSON.stringify(next) !== JSON.stringify(this.claims);
    this.claims = next;
    if (changed && this.facilityId && this.container && this.container.querySelector('#ip-results')) this.drawPets();
  }

  claimChip(id) {
    const status = this.claims && this.claims[id];
    if (!status) return '';
    const label = { pending: 'Claim sent', accepted: 'Claim accepted', rejected: 'Claim not approved' }[status];
    return `<span class="ip-chip ${status === 'accepted' ? 'is-ok' : status === 'rejected' ? 'is-late' : 'is-soon'}">${label}</span>`;
  }

  openPet(id) {
    const i = this.impounds().find((x) => String(x.id) === String(id));
    if (!i) return;
    this.loadClaims().then(() => { if (this.petModalId === id) this.renderPetModal(i); });
    this.petModalId = id;
    let overlay = document.getElementById('ip-pet-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'ip-pet-modal';
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) this.closePetModal(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('active')) this.closePetModal(); });
      document.body.appendChild(overlay);
    }
    this.renderPetModal(i);
    window.notifManager.openModal('ip-pet-modal');
  }

  closePetModal() {
    this.petModalId = null;
    window.notifManager.closeModal('ip-pet-modal');
  }

  renderPetModal(i, step = 'details') {
    const overlay = document.getElementById('ip-pet-modal');
    if (!overlay) return;
    const photo = this.safePhoto(i.photoUrl);
    const holding = this.isHolding(i);
    const user = window.pawStore.getGoogleUser();
    const shelter = this.shelters().find((s) => s.id === i.shelterId) || {};
    const status = this.claims && this.claims[i.id];
    const name = i.petName || 'Unidentified animal';
    const h = this.hoursLeft(i);
    const expired = holding && h != null && h <= 0;
    let action;
    if (!holding) action = '<p class="ip-claim-note">This animal is no longer in holding.</p>';
    else if (status === 'pending') action = '<p class="ip-claim-note is-pending"><b>Claim sent.</b> The facility will review it and email you the result.</p>';
    else if (status === 'accepted') action = '<p class="ip-claim-note is-ok"><b>Your claim was accepted.</b> Go to the facility and print your Digital NFC card from My Pets.</p><button type="button" class="btn btn-primary" id="ip-go-pets">Open My Pets</button>';
    else if (expired) action = '<p class="ip-claim-note">The claim window for this animal has ended. Contact the facility.</p>';
    else if (!user || !user.id) action = '<button type="button" class="btn btn-primary" id="ip-login">Log in to claim</button>';
    else action = `<button type="button" class="btn btn-primary" id="ip-claim"><i data-lucide="heart-handshake"></i> This is my pet, claim it</button>${status === 'rejected' ? '<p class="ip-claim-note is-late">Your earlier claim was not approved. You can send a new one.</p>' : ''}`;

    const rows = [
      ['Species', [i.species, i.breed].filter(Boolean).join(' · ')],
      ['Kennel', i.kennel || i.cageNumber],
      ['Taken in', this.fmtDateTime(i.intakeDate)],
      holding ? ['Claim by', this.fmtDateTime(i.claimDeadline)] : null,
      ['Found at', i.impoundLocation || i.location],
      ['Health', i.healthCondition],
      ['Held at', shelter.name || i.shelterName],
      ['Facility phone', shelter.phone]
    ].filter((r) => r && r[1]);

    if (step === 'form') {
      overlay.innerHTML = `
        <div class="modal-box ip-pet-modal" role="dialog" aria-modal="true" aria-labelledby="ip-claim-title">
          <div class="modal-header"><h3 id="ip-claim-title">Claim ${this.esc(name)}</h3><button type="button" class="btn-outline btn-sm" id="ip-x" aria-label="Close">&times;</button></div>
          <form class="modal-body ip-claim-form" id="ip-claim-form" novalidate>
            <p class="ip-claim-note">Tell the facility how to reach you and how you know this is your pet. They review every claim before releasing an animal.</p>
            <div class="vax-field" id="ipc-phone-field"><label for="ipc-phone">Your mobile number *</label><input id="ipc-phone" inputmode="tel" maxlength="20" value="${this.esc((user && user.phone) || '')}" placeholder="0917 123 4567" /><span class="vax-error">Enter a valid Philippine mobile number.</span></div>
            <div class="vax-field" id="ipc-msg-field"><label for="ipc-msg">How do you know it's yours? <span class="vax-opt">(optional)</span></label><textarea id="ipc-msg" maxlength="600" rows="4" placeholder="Name, markings, collar, where it was lost..."></textarea></div>
            <div class="vax-msg" id="ipc-error" role="alert" hidden></div>
            <div class="modal-footer ip-claim-actions"><button type="button" class="btn btn-outline" id="ip-back">Back</button><button type="submit" class="btn btn-primary" id="ip-send">Send claim</button></div>
          </form>
        </div>`;
      overlay.querySelector('#ip-x').addEventListener('click', () => this.closePetModal());
      overlay.querySelector('#ip-back').addEventListener('click', () => this.renderPetModal(i));
      overlay.querySelector('#ip-claim-form').addEventListener('submit', (e) => { e.preventDefault(); this.sendClaim(i); });
      return;
    }

    overlay.innerHTML = `
      <div class="modal-box ip-pet-modal" role="dialog" aria-modal="true" aria-labelledby="ip-pet-title">
        <div class="modal-header"><h3 id="ip-pet-title">${this.esc(name)}</h3><button type="button" class="btn-outline btn-sm" id="ip-x" aria-label="Close">&times;</button></div>
        <div class="modal-body">
          ${photo ? `<img class="ip-pet-modal-photo" src="${this.esc(photo)}" alt="${this.esc(name)}" />` : '<div class="ip-pet-modal-photo is-empty"><i data-lucide="paw-print"></i></div>'}
          <dl class="ip-pet-modal-rows">${rows.map(([k, v]) => `<div><dt>${this.esc(k)}</dt><dd>${this.esc(v)}</dd></div>`).join('')}</dl>
          <div class="ip-claim-box">${action}</div>
        </div>
      </div>`;
    overlay.querySelector('#ip-x').addEventListener('click', () => this.closePetModal());
    overlay.querySelector('#ip-claim')?.addEventListener('click', () => this.renderPetModal(i, 'form'));
    overlay.querySelector('#ip-login')?.addEventListener('click', () => { this.closePetModal(); if (window.pawApp && window.pawApp.openLoginDialog) window.pawApp.openLoginDialog(); });
    overlay.querySelector('#ip-go-pets')?.addEventListener('click', () => { this.closePetModal(); window.location.hash = '#pets'; });
    if (window.lucide) window.lucide.createIcons({ root: overlay });
  }

  async sendClaim(i) {
    const overlay = document.getElementById('ip-pet-modal');
    const user = window.pawStore.getGoogleUser();
    const sb = this.client();
    const phoneBox = overlay.querySelector('#ipc-phone');
    const phone = phoneBox.value.replace(/[\s\-().]/g, '');
    const ok = /^(\+?63|0)9\d{9}$/.test(phone);
    overlay.querySelector('#ipc-phone-field').classList.toggle('has-error', !ok);
    if (!ok) { phoneBox.focus(); return; }
    const err = overlay.querySelector('#ipc-error');
    err.hidden = true;
    const btn = overlay.querySelector('#ip-send');
    btn.disabled = true;
    const { error } = await sb.from('impound_claims').insert({
      impound_id: i.id,
      claimant_id: user.id,
      claimant_name: user.name || 'PawTrack guardian',
      claimant_email: user.email,
      claimant_phone: phone,
      message: overlay.querySelector('#ipc-msg').value.trim() || null
    });
    if (error) {
      btn.disabled = false;
      err.textContent = error.code === '23505' ? 'You already sent a claim for this animal. The facility will email you its decision.' : `Could not send your claim: ${error.message}`;
      err.hidden = false;
      return;
    }
    this.claims = { ...(this.claims || {}), [i.id]: 'pending' };
    this.closePetModal();
    this.drawPets();
    window.notifManager.showDialog({
      tone: 'success',
      title: 'Claim sent',
      message: 'The facility will review your claim. You will get an email when it is accepted or rejected.',
      rows: [['Animal', i.petName || 'Unidentified animal'], ['Facility', i.shelterName], ['Your phone', phone]],
      actions: [{ label: 'Done', primary: true }]
    });
  }

  // ---------------------------------------------------------------- photo viewer
  lightbox(src, name) {
    if (!/^https:\/\//.test(src || '')) return;
    document.querySelectorAll('.ip-lightbox').forEach((n) => n.remove());
    const previous = document.activeElement;
    const box = document.createElement('div');
    box.className = 'ip-lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', `Photo of ${name}`);
    box.innerHTML = `<button type="button" class="ip-lightbox-close" aria-label="Close photo">&times;</button><figure><img src="${this.esc(src)}" alt="Photo of ${this.esc(name)}" /><figcaption>${this.esc(name)}</figcaption></figure>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add('is-open'));
    const close = () => {
      document.removeEventListener('keydown', onKey);
      box.classList.remove('is-open');
      setTimeout(() => box.remove(), this.reduced() ? 0 : 200);
      if (previous && previous.focus) previous.focus();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('.ip-lightbox-close')) close(); });
    box.querySelector('.ip-lightbox-close').focus();
  }
}

window.impoundView = new ImpoundView();
