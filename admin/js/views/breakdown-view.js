/**
 * PawTrack Admin — Facility Breakdown
 * Which animals the signed-in account's own impound facility (and its sub-facilities) takes in: species, breed, age,
 * how cases end, and which facility received them. Only that facility's impoundments are counted; registry-wide pets,
 * missing reports and community sightings are not shown here.
 * Charts are plain SVG / CSS (no libraries) so they follow the admin theme.
 */

window.BreakdownView = {
  filter: 'all', // 'all' or a species key from js/species.js

  speciesMeta: {
    ...Object.fromEntries(window.PawSpecies.LIST.map((s) => [s.key, { label: s.plural, short: s.plural, color: s.color }])),
    Unknown: { label: 'Not recorded', short: 'Unknown', color: 'var(--ink-subtle)' }
  },

  ageBrackets: [
    { key: 'baby', label: 'Under 1 yr', long: 'Baby animal (under 1 yr)', color: 'var(--color-amber)' },
    { key: 'young', label: '1–3 yrs', long: 'Young (1–3 yrs)', color: 'var(--brand-terracotta)' },
    { key: 'adult', label: '4–7 yrs', long: 'Adult (4–7 yrs)', color: 'var(--color-blue)' },
    { key: 'senior', label: '8+ yrs', long: 'Senior (8+ yrs)', color: 'var(--color-purple)' },
    { key: 'unknown', label: 'Not recorded', long: 'Age not recorded', color: 'var(--ink-subtle)' }
  ],

  normalizeSpecies(value) {
    if (!String(value || '').trim()) return 'Unknown';
    return window.PawSpecies.normalize(value);
  },

  normalizeBreed(value) {
    const b = String(value || '').trim();
    if (!b) return null;
    return b.replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  },

  // Ages are free text ("3 years", "6 months", "2 taon"); a bare number is read as years.
  ageBracket(value) {
    const s = String(value || '').toLowerCase();
    const m = s.match(/(\d+(?:\.\d+)?)\s*(month|mo|buwan|week|wk|linggo|year|yr|taon)?/);
    if (!m) return 'unknown';
    const n = parseFloat(m[1]);
    const unit = m[2] || 'year';
    let years = n;
    if (/^(month|mo|buwan)/.test(unit)) years = n / 12;
    else if (/^(week|wk|linggo)/.test(unit)) years = n / 52;
    if (years < 1) return 'baby';
    if (years <= 3) return 'young';
    if (years <= 7) return 'adult';
    return 'senior';
  },

  esc(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  toTime(v) {
    if (v == null || v === '') return null;
    const t = typeof v === 'number' ? v : new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
  },

  // The account's facilities: its own, plus its sub-facilities for a main facility
  tree(store) {
    const all = typeof store.getShelters === 'function' ? store.getShelters() : [];
    // One facility at a time: the one chosen in the sidebar
    const activeId = typeof store.getActiveFacilityId === 'function' ? store.getActiveFacilityId() : null;
    const ids = activeId ? [activeId] : (typeof store.getMyFacilityIds === 'function' ? store.getMyFacilityIds() : []);
    const list = all.filter(s => ids.includes(s.id));
    const me = typeof store.getMyShelter === 'function' ? store.getMyShelter() : null;
    return list.length ? list : (me ? [me] : []);
  },

  // One record per animal this facility (or a sub-facility) took in. A linked pet record only fills in missing details.
  collectCases(store) {
    const activeId = typeof store.getActiveFacilityId === 'function' ? store.getActiveFacilityId() : null;
    const mine = (typeof store.getMyImpoundments === 'function' ? (store.getMyImpoundments() || []) : []).filter(i => !activeId || i.shelterId === activeId);
    const linked = mine.filter(i => i.petId);
    const petById = linked.length && typeof store.getPets === 'function'
      ? Object.fromEntries((store.getPets() || []).filter(p => linked.some(i => i.petId === p.id)).map(p => [p.id, p]))
      : {};
    return mine.map(i => {
      const pet = petById[i.petId] || {};
      return {
        shelterId: i.shelterId,
        registered: !!i.petId,
        species: i.species || pet.species,
        breed: i.breed || pet.breed,
        age: i.age || pet.age,
        identified: !!(i.rfidTag || pet.microchipNo || pet.rfidTag),
        date: this.toTime(i.intakeDate),
        impound: i
      };
    });
  },

  // ---------- Chart helpers ----------

  emptyState(text) {
    return `<div class="breakdown-empty">${text}</div>`;
  },

  // The same tap-to-read-the-formula button as the Dashboard (see ActivationView.INFO)
  info(key) {
    return `<button type="button" class="dash-info" data-info="${key}" aria-label="What does this show?" title="What does this show?">i</button>`;
  },

  sec(title, note) {
    return `<header class="dd-sec"><h2>${title}</h2>${note ? `<p>${note}</p>` : ''}</header>`;
  },

  card(title, right, body, opts = {}) {
    return `
      <section class="nock-card bd-card ${opts.cls || ''}">
        <div class="nock-card-head">
          <span class="nock-card-title">${title}${opts.info ? this.info(opts.info) : ''}</span>
          <span class="nock-card-right">${right || ''}</span>
        </div>
        ${body}
      </section>`;
  },

  // One bar split by species, with a legend: the first thing the Breakdown says about who the animals are
  ribbon(rows, total) {
    const shown = rows.filter(r => r.count > 0);
    const spoken = shown.map(r => `${r.label} ${Math.round((r.count / total) * 100)}%`).join(', ');
    return `
      <div class="bd-ribbon-wrap">
        <p class="bd-ribbon-title">Species${this.info('bdSpecies')}</p>
        <div class="bd-ribbon" role="img" aria-label="Species: ${this.esc(spoken)}">
          ${shown.map(r => `<u style="flex:${r.count}; background:${r.color}" title="${this.esc(r.label)}: ${r.count} (${Math.round((r.count / total) * 100)}%)"></u>`).join('')}
        </div>
        <ul class="bd-ribbon-key">
          ${shown.map(r => `<li><i style="background:${r.color}"></i><b>${this.esc(r.label)}</b><span>${r.count}</span><em>${Math.round((r.count / total) * 100)}%</em></li>`).join('')}
        </ul>
      </div>`;
  },

  // rows: [{label, count, color, hint?}]. Ring with the total in the middle plus a legend.
  donut(rows, centerLabel) {
    const total = rows.reduce((a, r) => a + r.count, 0);
    if (!total) return this.emptyState('Nothing to chart yet.');
    let offset = 25; // start at 12 o'clock
    const segs = rows.filter(r => r.count > 0).map(r => {
      const pct = (r.count / total) * 100;
      const seg = `<circle class="bd-donut-seg" cx="21" cy="21" r="15.9155" fill="none" stroke-width="5.5" style="stroke:${r.color}" stroke-dasharray="${Math.max(pct - 0.6, 0.1).toFixed(2)} ${(100 - pct + 0.6).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"><title>${this.esc(r.label)}: ${r.count} (${Math.round(pct)}%)</title></circle>`;
      offset -= pct;
      return seg;
    }).join('');
    return `
      <div class="bd-donut-wrap">
        <div class="bd-donut">
          <svg viewBox="0 0 42 42" role="img" aria-label="${this.esc(centerLabel)} breakdown">
            <circle cx="21" cy="21" r="15.9155" fill="none" stroke-width="5.5" class="bd-donut-track"/>
            ${segs}
          </svg>
          <div class="bd-donut-center"><b>${total}</b><span>${this.esc(centerLabel)}</span></div>
        </div>
        <ul class="bd-legend">
          ${rows.map(r => `
            <li class="${r.count ? '' : 'is-zero'}">
              <i style="background:${r.color}"></i>
              <span class="bd-legend-label">${this.esc(r.label)}</span>
              <span class="bd-legend-val"><b>${r.count}</b><em>${Math.round((r.count / total) * 100)}%</em></span>
            </li>`).join('')}
        </ul>
      </div>`;
  },

  // Vertical columns. rows: [{label, count, color}]
  columns(rows) {
    const max = Math.max(...rows.map(r => r.count), 1);
    const total = rows.reduce((a, r) => a + r.count, 0);
    return `
      <div class="bd-cols">
        ${rows.map(r => `
          <div class="bd-col" title="${this.esc(r.label)}: ${r.count} (${total ? Math.round(r.count / total * 100) : 0}%)">
            <div class="bd-col-plot">
              <span class="bd-col-val">${r.count || ''}</span>
              <div class="bd-col-bar" style="height:${r.count ? Math.max((r.count / max) * 100, 4) : 0}%; background:${r.color}"></div>
            </div>
            <span class="bd-col-label">${this.esc(r.label)}</span>
          </div>`).join('')}
      </div>`;
  },

  // Horizontal progress rows. rows: [{label, count, color, hint?}]
  hbars(rows, total) {
    const max = Math.max(...rows.map(r => r.count), 1);
    return `<div class="bd-hbars">${rows.map(r => {
      const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
      return `
        <div class="bd-hbar">
          <div class="bd-hbar-head">
            <span>${this.esc(r.label)}${r.hint ? `<small>${this.esc(r.hint)}</small>` : ''}</span>
            <span><b>${r.count}</b><em>${pct}%</em></span>
          </div>
          <div class="bd-track"><div class="bd-fill" style="width:${r.count ? Math.max((r.count / max) * 100, 3) : 0}%; background:${r.color}"></div></div>
        </div>`;
    }).join('')}</div>`;
  },

  // ---------- Render ----------

  renderNoFacility(container) {
    container.innerHTML = `
      <div class="bd-page dash-pro">
        <div class="view-header"><div class="view-header-titles"><h1>Breakdown</h1>
          <div class="subtitle"><span>Which animals your facility takes in, and how their cases end</span></div></div></div>
        <div class="nock-card tm-empty">
          <h2>Set up your impound facility</h2>
          <p>The breakdown describes the animals your own facility takes in. Register a facility, or join one with an invite code, to see it.</p>
          <div class="tm-empty-actions"><a href="#shelters" class="btn btn-primary">Go to Facilities</a></div>
        </div>
      </div>`;
  },

  render(container) {
    this._container = container;
    const store = window.adminStore;
    const mineShelter = (typeof store.getActiveFacility === 'function' ? store.getActiveFacility() : null) || (typeof store.getMyShelter === 'function' ? store.getMyShelter() : null);
    if (!mineShelter) return this.renderNoFacility(container);
    const tree = this.tree(store);
    const hasSubs = tree.length > 1;
    const allCases = this.collectCases(store);
    const f = this.filter;
    const inFilter = (species) => f === 'all' || this.normalizeSpecies(species) === f;
    const cases = allCases.filter(c => inFilter(c.species));
    const total = cases.length;

    // --- Species & breed ---
    const speciesCounts = { ...Object.fromEntries(window.PawSpecies.KEYS.map((k) => [k, 0])), Unknown: 0 };
    const breedStats = {};
    cases.forEach(c => {
      const species = this.normalizeSpecies(c.species);
      speciesCounts[species]++;
      const breed = this.normalizeBreed(c.breed);
      if (!breed) return;
      const key = `${species}|${breed}`;
      breedStats[key] = breedStats[key] || { breed, species, count: 0, unidentified: 0 };
      breedStats[key].count++;
      if (!c.identified) breedStats[key].unidentified++;
    });
    const speciesRows = Object.entries(speciesCounts)
      .filter(([key, count]) => count > 0 || key === 'Dog' || key === 'Cat')
      .map(([key, count]) => ({ label: this.speciesMeta[key].label, color: this.speciesMeta[key].color, count }));
    const breeds = Object.values(breedStats).sort((a, b) => b.count - a.count);
    const topBreeds = breeds.slice(0, 5);
    const topBreed = breeds[0];
    const topSpecies = Object.entries(speciesCounts).filter(([k]) => k !== 'Unknown').sort((a, b) => b[1] - a[1])[0];

    // --- Identification ---
    const identified = cases.filter(c => c.identified).length;
    const unidentified = total - identified;
    const unidentifiedPct = total ? Math.round((unidentified / total) * 100) : 0;

    // --- Age ---
    const ageCounts = Object.fromEntries(this.ageBrackets.map(b => [b.key, 0]));
    cases.forEach(c => { ageCounts[this.ageBracket(c.age)]++; });
    const ageRows = this.ageBrackets.map(b => ({ label: b.label, color: b.color, count: ageCounts[b.key] }));

    // --- Outcome (impound cases) ---
    const impoundments = cases.map(c => c.impound);
    const outcomes = window.IMPOUND_OUTCOMES || {};
    const closed = impoundments.filter(i => outcomes[i.status]);
    const stillHolding = impoundments.filter(i => i.status === 'active_impounded');
    const pastWindow = stillHolding.filter(i => new Date(i.claimDeadline).getTime() < Date.now()).length;
    const outcomeRows = Object.entries(outcomes).map(([status, meta]) => ({
      label: meta.label, color: meta.color, count: closed.filter(i => i.status === status).length
    }));
    const reunitedCount = closed.filter(i => i.status === 'claimed').length;
    const reunitedPct = closed.length ? Math.round((reunitedCount / closed.length) * 100) : null;

    // --- Reporting source ---
    // With sub-facilities: which facility received each animal. Otherwise: pets with a PawTrack record vs unregistered animals.
    const FAC_COLORS = ['var(--brand-terracotta)', 'var(--color-blue)', 'var(--color-amber)', 'var(--color-purple)', 'var(--color-green)'];
    const sourceRows = hasSubs
      ? tree.map((sh, idx) => ({ label: sh.name, hint: sh.parentId ? 'Sub-facility' : 'Main facility', color: FAC_COLORS[idx % FAC_COLORS.length], count: cases.filter(c => c.shelterId === sh.id).length }))
      : [
          { label: 'Registered pets', hint: 'Has a PawTrack pet record, so the guardian can be alerted', color: 'var(--brand-terracotta)', count: cases.filter(c => c.registered).length },
          { label: 'Unregistered animals', hint: 'Strays or animals without a PawTrack record', color: 'var(--color-amber)', count: cases.filter(c => !c.registered).length }
        ];

    const filterLabel = f === 'all' ? 'all animals' : this.speciesMeta[f].short.toLowerCase();
    const animalWord = (n) => (n === 1 ? 'animal' : 'animals');
    const mainsMore = tree.filter(s => !s.parentId).length - 1;
    const subsN = tree.filter(s => s.parentId).length;
    const scopeLine = hasSubs ? `${mainsMore ? `${mainsMore} more main and ` : ''}${subsN} sub-${subsN === 1 ? 'facility' : 'facilities'}` : 'Main facility';

    // Penalty tickets of these animals (money, so it sits with how cases end)
    const caseIds = new Set(impoundments.map(i => i.id));
    const tickets = store.penaltyReady && typeof store.getTickets === 'function' ? (store.getTickets() || []).filter(t => caseIds.has(t.impoundId)) : [];
    const sumPhp = (list) => list.reduce((a, t) => a + (Number(t.amount) || 0), 0);
    const pen = tickets.length ? {
      unpaid: tickets.filter(t => t.status === 'unpaid').length, unpaidPhp: sumPhp(tickets.filter(t => t.status === 'unpaid')),
      paid: tickets.filter(t => t.status === 'paid').length, paidPhp: sumPhp(tickets.filter(t => t.status === 'paid')),
      waived: tickets.filter(t => t.status === 'waived').length
    } : null;
    const php = (n) => `PHP ${Number(n).toLocaleString('en-US')}`;

    // What the formula pop-ups use for their worked examples
    this._live = {
      total, unidentified, unidentifiedPct, closed: closed.length, released: reunitedCount, pen,
      withAge: total - ageCounts.unknown,
      topSpecies: topSpecies && topSpecies[1] ? { label: this.speciesMeta[topSpecies[0]].short, n: topSpecies[1] } : null
    };

    container.innerHTML = `
      <div class="bd-page dash-pro dd">
        <div class="view-header">
          <div class="view-header-titles">
            <h1>Breakdown</h1>
            <div class="subtitle"><span>Which animals your facility takes in, and how their cases end</span></div>
            <div class="dd-where"><b>${this.esc(mineShelter.name)}</b><span>${this.esc(scopeLine)}</span></div>
          </div>
          <div class="view-header-actions">
            <div class="hm-field">
              <label class="hm-label" for="bd-species">Animal</label>
              <select id="bd-species" class="hm-select" aria-label="Filter by species">
                ${window.PawSpecies.filterOptions('all').map(([v, l]) => `<option value="${v}" ${f === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <section class="dd-now dd-hero bd-now">
          <div class="dd-now-main">
            <p class="dd-lead"><b class="dd-big">${total}</b><span>${animalWord(total)} taken in${f === 'all' ? '' : `, ${filterLabel}`}</span></p>
          </div>
          <dl class="dd-facts">
            <div>
              <dt>Without a chip or tag${total ? this.info('bdChip') : ''}</dt>
              <dd>${total ? `${unidentifiedPct}%` : '—'}</dd>
              <small>${total ? `${unidentified} of ${total} ${total === 1 ? 'animal' : 'animals'}` : 'No intakes yet'}</small>
            </div>
          </dl>
          ${total ? this.ribbon(speciesRows, total) : ''}
        </section>

        ${this.sec('Ages and breeds', 'How old they are, and the breeds you see most')}
        <div class="bd-grid">
          ${this.card('Age', ageCounts.unknown ? `${total - ageCounts.unknown} of ${total} have an age` : '',
            total === 0 ? this.emptyState('No intakes recorded yet.') : this.columns(ageRows.filter(r => r.label !== 'Not recorded')),
            { cls: 'bd-span-5', info: 'bdAge' })}
          ${this.card('Breeds', topBreeds.length ? `The ${topBreeds.length} most common` : '',
            topBreeds.length === 0 ? this.emptyState('No breeds recorded on these intakes.') : `
              <table class="breakdown-table bd-table">
                <thead>
                  <tr><th>Breed</th><th class="bd-share-col"></th><th style="text-align:right">Animals</th><th style="text-align:right">No chip / tag</th></tr>
                </thead>
                <tbody>
                  ${topBreeds.map(b => `
                    <tr>
                      <td><b>${this.esc(b.breed)}</b><small class="bd-sub">${this.speciesMeta[b.species].short}</small></td>
                      <td class="bd-share-col"><div class="bd-track"><div class="bd-fill" style="width:${Math.max((b.count / topBreeds[0].count) * 100, 4)}%; background:${this.speciesMeta[b.species].color}"></div></div></td>
                      <td style="text-align:right"><b>${b.count}</b></td>
                      <td style="text-align:right">${Math.round((b.unidentified / b.count) * 100)}%</td>
                    </tr>`).join('')}
                </tbody>
              </table>`,
            { cls: 'bd-span-7', info: 'bdBreeds' })}
        </div>

        ${this.sec('Where they came from, and how their cases ended', 'The facility that took each animal in, and what happened next')}
        <div class="bd-grid">
          ${this.card(hasSubs ? 'Intakes by facility' : 'Registered or not', '',
            total === 0 ? this.emptyState('No intakes recorded yet.') : this.hbars(sourceRows, total),
            { cls: 'bd-span-6', info: 'bdSource' })}
          ${this.card('How cases end', closed.length ? `${closed.length} closed` : '',
            (closed.length === 0 ? this.emptyState('No impound cases have been closed yet.') : this.donut(outcomeRows, 'closed'))
              + (stillHolding.length > 0 ? `<div class="breakdown-note">${stillHolding.length} ${stillHolding.length === 1 ? 'case is' : 'cases are'} still in holding and not counted here.</div>` : ''),
            { cls: 'bd-span-6 bd-tall', info: 'bdOutcomes' })}
          ${pen ? this.card('Penalty tickets', '', `
            <div class="bd-pen">
              <dl>
                <div><dt>Unpaid</dt><dd>${pen.unpaid} <small>${php(pen.unpaidPhp)}</small></dd></div>
                <div><dt>Paid</dt><dd>${pen.paid} <small>${php(pen.paidPhp)}</small></dd></div>
                <div><dt>Waived</dt><dd>${pen.waived}</dd></div>
              </dl>
            </div>`, { cls: 'bd-span-6', info: 'bdPenalties' }) : ''}
        </div>
      </div>
    `;

    container.querySelectorAll('.dash-info').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.ActivationView) window.ActivationView.openInfo(btn.getAttribute('data-info'), this._live);
    }));
    container.querySelectorAll('#bd-species').forEach(sel => {
      sel.addEventListener('change', () => {
        this.filter = sel.value;
        this.render(container);
      });
    });
  }
};
