/**
 * PawTrack Admin — Missing Pet Breakdown & Segmentation
 * Who goes missing (species, breed, age), how impound cases end, and where reports come from
 */

window.BreakdownView = {
  speciesMeta: {
    Dog: { label: 'Dogs (Aso)', color: 'var(--brand-terracotta)' },
    Cat: { label: 'Cats (Pusa)', color: 'var(--color-blue)' },
    Other: { label: 'Other animals', color: 'var(--color-purple)' },
    Unknown: { label: 'Not recorded', color: 'var(--ink-subtle)' }
  },

  ageBrackets: [
    { key: 'baby', label: 'Puppy / kitten (under 1 yr)', color: 'var(--color-amber)' },
    { key: 'young', label: 'Young (1–3 yrs)', color: 'var(--brand-terracotta)' },
    { key: 'adult', label: 'Adult (4–7 yrs)', color: 'var(--color-blue)' },
    { key: 'senior', label: 'Senior (8+ yrs)', color: 'var(--color-purple)' },
    { key: 'unknown', label: 'Age not recorded', color: 'var(--ink-subtle)' }
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

  // One record per missing / found case, tagged with how it reached us.
  collectCases(store) {
    const pets = store.getPets();
    const petById = Object.fromEntries(pets.map(p => [p.id, p]));
    const cases = [];

    pets.filter(p => p.status === 'lost' || p.status === 'reunited').forEach(p => {
      cases.push({ source: 'self', species: p.species, breed: p.breed, age: p.age, identified: !!(p.microchipNo || p.rfidTag) });
    });

    store.getSightings().forEach(s => {
      cases.push({ source: 'community', species: s.species, breed: s.breed, age: s.age, identified: !!(s.microchipNo || s.rfidTag) });
    });

    store.getImpoundments().forEach(i => {
      const pet = petById[i.petId] || {};
      cases.push({
        source: 'facility',
        species: i.species || pet.species,
        breed: i.breed || pet.breed,
        age: i.age || pet.age,
        identified: !!(i.rfidTag || pet.microchipNo || pet.rfidTag)
      });
    });

    return cases;
  },

  barRows(rows, total) {
    return rows.map(r => {
      const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
      return `
        <div class="breakdown-row">
          <div class="breakdown-row-head">
            <span class="breakdown-row-label">${this.esc(r.label)}${r.hint ? `<span class="breakdown-row-hint">${this.esc(r.hint)}</span>` : ''}</span>
            <span class="breakdown-row-value"><b>${r.count}</b> · ${pct}%</span>
          </div>
          <div class="funnel-track"><div class="funnel-fill" style="width: ${pct}%; background: ${r.color};"></div></div>
        </div>
      `;
    }).join('');
  },

  emptyState(text) {
    return `<div class="breakdown-empty">${text}</div>`;
  },

  render(container) {
    const store = window.adminStore;
    const cases = this.collectCases(store);
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
    const topBreeds = Object.values(breedStats).sort((a, b) => b.count - a.count).slice(0, 6);
    const topBreed = topBreeds[0];

    // --- Age ---
    const ageCounts = Object.fromEntries(this.ageBrackets.map(b => [b.key, 0]));
    cases.forEach(c => { ageCounts[this.ageBracket(c.age)]++; });
    const ageRows = this.ageBrackets.map(b => ({ label: b.label, color: b.color, count: ageCounts[b.key] }));

    // --- Outcome (impound cases) ---
    const impoundments = store.getImpoundments();
    const outcomes = window.IMPOUND_OUTCOMES;
    const closed = impoundments.filter(i => outcomes[i.status]);
    const stillHolding = impoundments.filter(i => i.status === 'active_impounded');
    const pastWindow = stillHolding.filter(i => new Date(i.claimDeadline).getTime() < Date.now()).length;
    const outcomeRows = Object.entries(outcomes).map(([status, meta]) => ({
      label: meta.label,
      color: meta.color,
      count: closed.filter(i => i.status === status).length
    }));

    // --- Reporting source ---
    const sourceRows = this.sourceMeta.map(s => ({
      label: s.label,
      hint: s.hint,
      color: s.color,
      count: cases.filter(c => c.source === s.key).length
    }));

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Breakdown</h1>
          <div class="subtitle">
            <span>Which pets go missing, how impound cases end, and where reports come from</span>
          </div>
        </div>
        <div class="view-header-actions">
          <span class="breakdown-total"><b>${total}</b> case${total === 1 ? '' : 's'} counted</span>
        </div>
      </div>

      <div class="breakdown-grid">
        <!-- Species & Breed -->
        <div class="nock-card">
          <div class="nock-card-head">
            <span class="nock-card-title">By species &amp; breed</span>
            <span class="nock-card-right">${total} cases</span>
          </div>
          ${total === 0 ? this.emptyState('No missing, found or impounded pets recorded yet.') : `
            <div class="funnel-list">${this.barRows(speciesRows, total)}</div>

            <div class="breakdown-subhead">Breeds that go missing most</div>
            ${topBreeds.length === 0 ? this.emptyState('No breeds recorded on these cases.') : `
              <table class="breakdown-table">
                <thead>
                  <tr><th>Breed</th><th>Species</th><th style="text-align: right;">Cases</th><th style="text-align: right;">No chip / tag</th></tr>
                </thead>
                <tbody>
                  ${topBreeds.map(b => `
                    <tr>
                      <td>${this.esc(b.breed)}</td>
                      <td>${this.speciesMeta[b.species].label}</td>
                      <td style="text-align: right;"><b>${b.count}</b></td>
                      <td style="text-align: right;">${Math.round((b.unidentified / b.count) * 100)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              ${topBreed && topBreed.unidentified > 0 ? `
                <div class="breakdown-note">
                  ${topBreed.unidentified} of ${topBreed.count} missing ${this.esc(topBreed.breed)} cases had no microchip or RFID tag, a good target for the next microchipping drive.
                </div>
              ` : ''}
            `}
          `}
        </div>

        <!-- Age -->
        <div class="nock-card">
          <div class="nock-card-head">
            <span class="nock-card-title">By age bracket</span>
            <span class="nock-card-right">${total - ageCounts.unknown} with age recorded</span>
          </div>
          ${total === 0 ? this.emptyState('No cases to segment by age yet.') : `
            <div class="funnel-list">${this.barRows(ageRows, total)}</div>
            ${ageCounts.unknown > 0 ? `
              <div class="breakdown-note">
                Age is only known for registered pets and intakes where it was entered. Add it in the pet record or intake form to fill this in.
              </div>
            ` : ''}
          `}
        </div>

        <!-- Outcome -->
        <div class="nock-card">
          <div class="nock-card-head">
            <span class="nock-card-title">By outcome</span>
            <span class="nock-card-right">${closed.length} closed impound case${closed.length === 1 ? '' : 's'}</span>
          </div>
          ${closed.length === 0 ? this.emptyState('No impound cases have been closed yet. Set the outcome from Impoundments → Edit.') : `
            <div class="funnel-list">${this.barRows(outcomeRows, closed.length)}</div>
          `}
          ${stillHolding.length > 0 ? `
            <div class="breakdown-note">
              ${stillHolding.length} still in holding${pastWindow > 0 ? `, ${pastWindow} past the 72-hour window and awaiting a decision` : ''}.
            </div>
          ` : ''}
        </div>

        <!-- Reporting source -->
        <div class="nock-card">
          <div class="nock-card-head">
            <span class="nock-card-title">By reporting source</span>
            <span class="nock-card-right">${total} cases</span>
          </div>
          ${total === 0 ? this.emptyState('No reports received yet.') : `
            <div class="funnel-list">${this.barRows(sourceRows, total)}</div>
          `}
        </div>
      </div>
    `;
  }
};
