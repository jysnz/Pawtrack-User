/**
 * PawTrack Admin — Facility Breakdown
 * Which animals the signed-in account's own impound facility (and its sub-facilities) takes in: species, breed, age,
 * how cases end, and which facility received them. Only that facility's impoundments are counted; registry-wide pets,
 * missing reports and community sightings are not shown here.
 * Charts are plain SVG / CSS (no libraries) so they follow the admin theme.
 */

window.BreakdownView = {
  filter: 'all', // all | Dog | Cat | Other

  speciesMeta: {
    Dog: { label: 'Dogs (Aso)', short: 'Dogs', color: 'var(--brand-terracotta)' },
    Cat: { label: 'Cats (Pusa)', short: 'Cats', color: 'var(--color-blue)' },
    Other: { label: 'Other animals', short: 'Other', color: 'var(--color-purple)' },
    Unknown: { label: 'Not recorded', short: 'Unknown', color: 'var(--ink-subtle)' }
  },

  ageBrackets: [
    { key: 'baby', label: 'Under 1 yr', long: 'Puppy / kitten (under 1 yr)', color: 'var(--color-amber)' },
    { key: 'young', label: '1–3 yrs', long: 'Young (1–3 yrs)', color: 'var(--brand-terracotta)' },
    { key: 'adult', label: '4–7 yrs', long: 'Adult (4–7 yrs)', color: 'var(--color-blue)' },
    { key: 'senior', label: '8+ yrs', long: 'Senior (8+ yrs)', color: 'var(--color-purple)' },
    { key: 'unknown', label: 'Not recorded', long: 'Age not recorded', color: 'var(--ink-subtle)' }
  ],

  normalizeSpecies(value) {
    const s = String(value || '').toLowerCase();
    if (!s) return 'Unknown';
    if (/dog|aso|canine|puppy/.test(s)) return 'Dog';
    if (/cat|pusa|feline|kitten/.test(s)) return 'Cat';
    return 'Other';
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

  info(text) {
    return `<span class="bd-info" tabindex="0" aria-label="${this.esc(text)}" title="${this.esc(text)}">i</span>`;
  },

  card(title, right, body, opts = {}) {
    return `
      <section class="nock-card bd-card ${opts.cls || ''}">
        <div class="nock-card-head">
          <span class="nock-card-title">${title}${opts.help ? this.info(opts.help) : ''}</span>
          <span class="nock-card-right">${right || ''}</span>
        </div>
        ${body}
      </section>`;
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

  kpi(label, value, sub, tone) {
    return `
      <div class="kpi-card bd-kpi">
        <div class="kpi-label"><span>${label}</span></div>
        <div class="kpi-value">${value}</div>
        <div class="kpi-delta ${tone || 'neutral'}">${sub}</div>
      </div>`;
  },

  // ---------- Render ----------

  renderNoFacility(container) {
    container.innerHTML = `
      <div class="bd-page dash-pro">
        <div class="view-header"><div class="view-header-titles"><div class="dash-eyebrow bd-eyebrow">Insights</div><h1>Breakdown</h1>
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
    const speciesCounts = { Dog: 0, Cat: 0, Other: 0, Unknown: 0 };
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

    const chip = (key, label) => `<button class="${f === key ? 'active' : ''}" data-bd-filter="${key}" role="tab" aria-selected="${f === key}">${label}</button>`;
    const filterLabel = f === 'all' ? 'all animals' : this.speciesMeta[f].short.toLowerCase();

    container.innerHTML = `
      <div class="bd-page dash-pro">
        <div class="view-header">
          <div class="view-header-titles">
            <div class="dash-eyebrow bd-eyebrow">${this.esc(mineShelter.name)}${hasSubs ? ` + ${tree.filter(s => !s.parentId).length - 1 ? `${tree.filter(s => !s.parentId).length - 1} more main and ` : ''}${tree.filter(s => s.parentId).length} sub-${tree.filter(s => s.parentId).length === 1 ? 'facility' : 'facilities'}` : ''}</div>
            <h1>Breakdown</h1>
            <div class="subtitle"><span>Which animals your facility takes in, and how their cases end</span></div>
          </div>
          <div class="view-header-actions">
            <div class="dash-segmented" role="tablist" aria-label="Filter by species">
              ${chip('all', 'All')}${chip('Dog', 'Dogs')}${chip('Cat', 'Cats')}${chip('Other', 'Other')}
            </div>
          </div>
        </div>

        <div class="kpi-grid bd-kpis">
          ${this.kpi('Animals taken in', total, total ? `Showing ${filterLabel}` : 'No intakes yet', 'neutral')}
          ${this.kpi('Most affected', topSpecies && topSpecies[1] ? this.speciesMeta[topSpecies[0]].short : '—',
            topSpecies && topSpecies[1] ? `${Math.round((topSpecies[1] / total) * 100)}% of intakes` : 'No data', 'neutral')}
          ${this.kpi('Without chip or tag', total ? `${unidentifiedPct}%` : '—',
            total ? `${unidentified} of ${total} could not be identified` : 'No data', unidentifiedPct >= 50 ? 'down' : 'up')}
        </div>

        <div class="bd-section-label">Who your facility takes in</div>
        <div class="bd-grid">
          ${this.card('Species', '',
            total === 0 ? this.emptyState('No intakes recorded yet.') : this.donut(speciesRows, 'animals'),
            { cls: 'bd-span-6' })}
          ${this.card('Age', ageCounts.unknown ? `${total - ageCounts.unknown} of ${total} have an age` : '',
            total === 0 ? this.emptyState('No intakes recorded yet.') : this.columns(ageRows.filter(r => r.label !== 'Not recorded')),
            { cls: 'bd-span-6' })}
        </div>

        <div class="bd-section-label">How cases are handled</div>
        <div class="bd-grid">
          ${this.card('How impound cases end', closed.length ? `${closed.length} closed` : '',
            closed.length === 0 ? this.emptyState('No impound cases have been closed yet.') : this.donut(outcomeRows, 'closed')
              + (stillHolding.length > 0 ? `<div class="breakdown-note">${stillHolding.length} still in holding${pastWindow > 0 ? `, ${pastWindow} past the 72-hour window` : ''}.</div>` : ''),
            { cls: 'bd-span-6' })}
          ${this.card(hasSubs ? 'Intakes by facility' : 'Registered or not', '',
            total === 0 ? this.emptyState('No intakes recorded yet.') : this.hbars(sourceRows, total),
            { cls: 'bd-span-6' })}
        </div>

        <div class="bd-section-label">Where to focus</div>
        <div class="bd-grid">
          ${this.card('Breeds your facility takes in most', topBreeds.length ? `Top ${topBreeds.length}` : '',
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
            { cls: 'bd-span-12' })}
        </div>
      </div>
    `;

    container.querySelectorAll('[data-bd-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filter = btn.getAttribute('data-bd-filter');
        this.render(container);
      });
    });
  }
};
