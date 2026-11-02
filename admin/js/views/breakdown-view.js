/**
 * PawTrack Admin — Missing Pet Breakdown & Segmentation
 * Who goes missing (species, breed, age), how impound cases end, and where reports come from.
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

  sourceMeta: [
    { key: 'community', label: 'Community sighting', hint: 'Found / stray reports from citizens', color: 'var(--color-blue)' },
    { key: 'self', label: 'Self-report', hint: 'Owner reported their own pet missing', color: 'var(--brand-terracotta)' },
    { key: 'facility', label: 'Facility intake', hint: 'Logged directly at a shelter or pound', color: 'var(--color-amber)' }
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

  // One record per missing / found case, tagged with how it reached us.
  collectCases(store) {
    const pets = store.getPets();
    const petById = Object.fromEntries(pets.map(p => [p.id, p]));
    const missingByPet = {};
    (store.getCases ? store.getCases() : []).forEach(c => { if (c.petId) missingByPet[c.petId] = c; });
    const cases = [];

    pets.filter(p => p.status === 'lost' || p.status === 'reunited').forEach(p => {
      const mc = missingByPet[p.id];
      cases.push({ source: 'self', species: p.species, breed: p.breed, age: p.age, identified: !!(p.microchipNo || p.rfidTag), date: this.toTime(mc && mc.createdAt) });
    });

    store.getSightings().forEach(s => {
      cases.push({ source: 'community', species: s.species, breed: s.breed, age: s.age, identified: !!(s.microchipNo || s.rfidTag), date: this.toTime(s.createdAt || s.timestamp) });
    });

    store.getImpoundments().forEach(i => {
      const pet = petById[i.petId] || {};
      cases.push({
        source: 'facility',
        species: i.species || pet.species,
        breed: i.breed || pet.breed,
        age: i.age || pet.age,
        identified: !!(i.rfidTag || pet.microchipNo || pet.rfidTag),
        date: this.toTime(i.intakeDate)
      });
    });

    return cases;
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

  render(container) {
    this._container = container;
    const store = window.adminStore;
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
    const impoundments = store.getImpoundments().filter(i => inFilter(i.species));
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
    const sourceRows = this.sourceMeta.map(s => ({
      label: s.label, hint: s.hint, color: s.color, count: cases.filter(c => c.source === s.key).length
    }));

    const chip = (key, label) => `<button class="${f === key ? 'active' : ''}" data-bd-filter="${key}" role="tab" aria-selected="${f === key}">${label}</button>`;
    const filterLabel = f === 'all' ? 'all animals' : this.speciesMeta[f].short.toLowerCase();

    container.innerHTML = `
      <div class="bd-page dash-pro">
        <div class="view-header">
          <div class="view-header-titles">
            <div class="dash-eyebrow bd-eyebrow">Insights</div>
            <h1>Breakdown</h1>
            <div class="subtitle"><span>Which pets go missing, how impound cases end, and where reports come from</span></div>
          </div>
          <div class="view-header-actions">
            <div class="dash-segmented" role="tablist" aria-label="Filter by species">
              ${chip('all', 'All')}${chip('Dog', 'Dogs')}${chip('Cat', 'Cats')}${chip('Other', 'Other')}
            </div>
          </div>
        </div>

        <div class="kpi-grid bd-kpis">
          ${this.kpi('Cases counted', total, total ? `Showing ${filterLabel}` : 'No cases yet', 'neutral')}
          ${this.kpi('Most affected', topSpecies && topSpecies[1] ? this.speciesMeta[topSpecies[0]].short : '—',
            topSpecies && topSpecies[1] ? `${Math.round((topSpecies[1] / total) * 100)}% of cases` : 'No data', 'neutral')}
          ${this.kpi('Without chip or tag', total ? `${unidentifiedPct}%` : '—',
            total ? `${unidentified} of ${total} could not be identified` : 'No data', unidentifiedPct >= 50 ? 'down' : 'up')}
        </div>

        <div class="bd-section-label">Who goes missing</div>
        <div class="bd-grid">
          ${this.card('Species', '',
            total === 0 ? this.emptyState('No cases recorded yet.') : this.donut(speciesRows, 'cases'),
            { cls: 'bd-span-6' })}
          ${this.card('Age', ageCounts.unknown ? `${total - ageCounts.unknown} of ${total} have an age` : '',
            total === 0 ? this.emptyState('No cases recorded yet.') : this.columns(ageRows.filter(r => r.label !== 'Not recorded')),
            { cls: 'bd-span-6' })}
        </div>

        <div class="bd-section-label">How cases are handled</div>
        <div class="bd-grid">
          ${this.card('How impound cases end', closed.length ? `${closed.length} closed` : '',
            closed.length === 0 ? this.emptyState('No impound cases have been closed yet.') : this.donut(outcomeRows, 'closed')
              + (stillHolding.length > 0 ? `<div class="breakdown-note">${stillHolding.length} still in holding${pastWindow > 0 ? `, ${pastWindow} past the 72-hour window` : ''}.</div>` : ''),
            { cls: 'bd-span-6' })}
          ${this.card('Where reports come from', '',
            total === 0 ? this.emptyState('No reports received yet.') : this.hbars(sourceRows, total),
            { cls: 'bd-span-6' })}
        </div>

        <div class="bd-section-label">Where to focus</div>
        <div class="bd-grid">
          ${this.card('Breeds that go missing most', topBreeds.length ? `Top ${topBreeds.length}` : '',
            topBreeds.length === 0 ? this.emptyState('No breeds recorded on these cases.') : `
              <table class="breakdown-table bd-table">
                <thead>
                  <tr><th>Breed</th><th class="bd-share-col"></th><th style="text-align:right">Cases</th><th style="text-align:right">No chip / tag</th></tr>
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
