/**
 * PawTrack Admin: Reports
 * Every missing-pet report and community sighting that has a map location, as a searchable, filterable list.
 * (It used to be the table under the Heatmap; "Locate" now opens the Heatmap on that report.)
 */
window.ReportsView = {
  query: '',         // the search that is applied (Search button or Enter)
  draft: '',         // what is typed in the box
  status: 'all',     // 'all' | 'lost' | 'sighting' | 'found'
  source: 'all',     // 'all' | 'owner' | 'community'
  animal: 'all',     // 'all' | 'dog' | 'cat' | 'other'
  period: 'all',     // 'all' | 'today' | '7d' | '30d'
  sortBy: 'date',    // 'date' | 'name' | 'location' | 'status'
  page: 1,
  pageSize: 10,

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  sourceOf(i) { return i.contact === 'Owner report' ? 'owner' : i.contact === 'Community report' ? 'community' : 'other'; },

  hl(text) { return window.PawSearch.highlight(text, this.query); },

  filtered(all) {
    const species = (i) => String(i.species || '').toLowerCase();
    let from = null;
    if (this.period === 'today') from = new Date().setHours(0, 0, 0, 0);
    else if (this.period === '7d' || this.period === '30d') from = Date.now() - (this.period === '7d' ? 7 : 30) * 86400000;
    const list = all.filter(i =>
      (this.status === 'all' || i.status === this.status) &&
      (this.source === 'all' || this.sourceOf(i) === this.source) &&
      (this.animal === 'all' || (this.animal === 'other' ? !['dog', 'cat'].includes(species(i)) : species(i) === this.animal)) &&
      (from == null || (i.ts != null && i.ts >= from)) &&
      window.PawSearch.matches(this.query, [i.name, i.breed, i.species, i.location, i.barangay, i.district, i.contact, i.status, i.id]));
    const by = {
      name: (a, b) => (a.name || '').localeCompare(b.name || ''),
      location: (a, b) => (a.barangay || a.location || '').localeCompare(b.barangay || b.location || ''),
      status: (a, b) => (a.status || '').localeCompare(b.status || ''),
      date: (a, b) => (b.ts || 0) - (a.ts || 0)
    };
    return list.sort(by[this.sortBy] || by.date);
  },

  // Opens the Heatmap and flies to the report
  locate(lat, lng, id) {
    if (window.HeatmapView) window.HeatmapView._pendingFly = { lat, lng, id };
    window.location.hash = '#heatmap';
  },

  render(container) {
    const H = window.HeatmapView;
    const all = H ? H.buildIncidents() : [];
    const list = this.filtered(all);
    const total = list.length;
    const totalPages = Math.max(Math.ceil(total / this.pageSize), 1);
    if (this.page > totalPages) this.page = totalPages;
    if (this.page < 1) this.page = 1;
    const start = (this.page - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, total);
    const rows = list.slice(start, end);
    const on = !!this.query.trim() || this.status !== 'all' || this.source !== 'all' || this.animal !== 'all' || this.period !== 'all';
    const pill = (s) => s === 'lost' ? 'status-lost' : s === 'found' ? 'status-safe' : 'status-pending';
    const select = (id, label, cur, opts) => `
      <div class="hm-field"><label class="hm-label" for="${id}">${label}</label>
        <select id="${id}" class="hm-select">${opts.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;

    // Counts for the status cards follow every filter except the status itself, so they double as quick filters
    const keepStatus = this.status; this.status = 'all';
    const base = this.filtered(all); this.status = keepStatus;
    const n = (st) => base.filter(i => i.status === st).length;
    const card = (key, label, value, sub, tone) => `
      <button type="button" class="kpi-card rp-kpi ${this.status === key ? 'is-active' : ''}" data-status="${key}" aria-pressed="${this.status === key}">
        <div class="kpi-label"><span>${label}</span></div>
        <div class="kpi-value hm-kpi-value">${value}</div>
        <div class="kpi-delta ${tone}">${sub}</div>
      </button>`;
    const chips = [
      this.query.trim() && ['Search', `\u201c${this.query.trim()}\u201d`, 'query'],
      this.source !== 'all' && ['Source', this.source === 'owner' ? 'Owner report' : 'Community report', 'source'],
      this.animal !== 'all' && ['Animal', { dog: 'Dogs', cat: 'Cats', other: 'Other' }[this.animal], 'animal'],
      this.period !== 'all' && ['Reported', { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days' }[this.period], 'period']
    ].filter(Boolean);

    container.innerHTML = `
      <div class="hm-page dash-pro" id="rp-root">
        <div class="view-header">
          <div class="view-header-titles">
            <div class="dash-eyebrow">Missing pets and sightings</div>
            <h1>Reports</h1>
            <div class="subtitle"><span>Every report with a map location across Quezon City, live from the database</span></div>
          </div>
          <div class="view-header-actions">
            ${on ? '<button type="button" class="chip" id="rp-clear">Reset filters</button>' : ''}
          </div>
        </div>

        <div class="kpi-grid hm-kpis rp-kpis" role="group" aria-label="Filter by status">
          ${card('all', 'All reports', base.length, 'Show everything', 'neutral')}
          ${card('lost', 'Lost', n('lost'), n('lost') ? 'Still missing' : 'None right now', n('lost') ? 'down' : 'up')}
          ${card('sighting', 'Sightings', n('sighting'), 'Spotted by the community', 'neutral')}
          ${card('found', 'Found', n('found'), 'Reunited or located', 'up')}
        </div>

        <div class="hm-toolbar rp-toolbar">
          <form id="rp-form" class="hm-field hm-field-search" role="search">
            <label class="hm-label" for="rp-input">Search</label>
            <div class="hm-tbl-search rp-searchbox">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" id="rp-input" placeholder="Name, breed, place or source  ( / )" value="${this.esc(this.draft)}" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="rp-suggest" aria-autocomplete="list" />
              <button type="button" class="rp-clear-x" id="rp-clear-x" aria-label="Clear search" ${this.draft ? '' : 'hidden'}>\u00d7</button>
              <button type="submit" class="btn btn-primary btn-sm">Search</button>
              <div class="rp-suggest" id="rp-suggest" role="listbox" hidden></div>
            </div>
          </form>
          <div class="hm-field"><span class="hm-label">Animal</span>
            <div class="dash-segmented" role="group" aria-label="Animal">
              ${[['all', 'All'], ['dog', 'Dogs'], ['cat', 'Cats'], ['other', 'Other']].map(([v, l]) => `<button type="button" class="rp-animal ${this.animal === v ? 'active' : ''}" data-v="${v}" aria-pressed="${this.animal === v}">${l}</button>`).join('')}
            </div></div>
          ${select('rp-source', 'Source', this.source, [['all', 'All sources'], ['owner', 'Owner report'], ['community', 'Community report']])}
          ${select('rp-period', 'Reported', this.period, [['all', 'Any time'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days']])}
          ${select('rp-sort', 'Sort by', this.sortBy, [['date', 'Newest'], ['name', 'Name'], ['location', 'Location'], ['status', 'Status']])}
        </div>

        ${chips.length ? `<div class="rp-chips" aria-label="Active filters">${chips.map(([k, v, key]) => `<button type="button" class="rp-chip" data-clear="${key}" title="Remove this filter"><span>${k}:</span> ${this.esc(v)} <i aria-hidden="true">\u00d7</i></button>`).join('')}</div>` : ''}

        <section class="nock-card hm-table-card">
          <div class="nock-card-head"><span class="nock-card-title" aria-live="polite">${total} ${total === 1 ? 'report' : 'reports'}${on ? ' match' : ''}</span></div>
          ${rows.length === 0 ? `
            <div class="hm-empty hm-empty-lg">
              <b>${all.length ? 'No reports match these filters' : 'No reports with a map location yet'}</b>
              ${all.length ? 'Try a wider period, or clear the filters.' : 'Missing-pet reports and sightings appear here as soon as they are filed.'}
            </div>` : `
          <div class="data-table-wrapper">
            <table class="nock-data-table hm-table">
              <thead><tr><th>Animal</th><th>Status</th><th>Location</th><th>Reported</th><th>Source</th><th></th></tr></thead>
              <tbody>
                ${rows.map(inc => `
                  <tr class="incident-table-row rp-row" data-lat="${inc.lat}" data-lng="${inc.lng}" data-id="${this.esc(inc.id)}" title="Show on the heatmap">
                    <td><div class="animal-cell">${H.photoHtml(inc)}<div class="animal-info"><span class="animal-name">${this.hl(inc.name)}</span><span class="animal-breed">${this.hl(inc.speciesTag)}</span></div></div></td>
                    <td><span class="status-pill ${pill(inc.status)}">${this.esc(inc.status.toUpperCase())}</span></td>
                    <td><div class="location-cell"><span class="loc-main">${this.hl(inc.barangay)}</span><span class="loc-sub">${this.hl(inc.district)}${inc.location && inc.location !== inc.barangay ? ' · ' + this.hl(inc.location) : ''}</span></div></td>
                    <td><div class="date-time-cell"><span class="date-main">${this.esc(inc.date)}</span><span class="time-sub">${this.esc(inc.time)}</span></div></td>
                    <td><span class="contact-name">${this.hl(inc.contact)}</span></td>
                    <td style="text-align:right"><button class="btn btn-xs btn-secondary rp-locate" data-lat="${inc.lat}" data-lng="${inc.lng}" data-id="${this.esc(inc.id)}" title="Show on the heatmap">Locate</button></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="table-pagination-footer">
            <div class="pagination-info">Showing <strong>${start + 1}</strong>–<strong>${end}</strong> of <strong>${total}</strong></div>
            ${totalPages > 1 ? `
              <div class="pagination-controls">
                <button class="page-btn page-nav-btn" data-page="${this.page - 1}" ${this.page === 1 ? 'disabled' : ''}>‹ Prev</button>
                <div class="page-numbers">${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `<button class="page-btn page-num-btn ${this.page === p ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}</div>
                <button class="page-btn page-nav-btn" data-page="${this.page + 1}" ${this.page === totalPages ? 'disabled' : ''}>Next ›</button>
              </div>` : ''}
          </div>`}
        </section>
      </div>`;

    const redraw = () => this.render(container);
    const f = (sel, fn) => container.querySelector(sel)?.addEventListener('change', (e) => { fn(e.target.value); this.page = 1; redraw(); });
    window.PawSearch.attach({
      form: container.querySelector('#rp-form'),
      input: container.querySelector('#rp-input'),
      box: container.querySelector('#rp-suggest'),
      clearBtn: container.querySelector('#rp-clear-x'),
      current: () => this.query,
      suggestions: (typed) => window.PawSearch.suggest(typed, all.flatMap(i => [[i.name, 'Pet'], [i.barangay, 'Place'], [i.breed, 'Breed']])),
      apply: (value) => { this.query = this.draft = value; this.page = 1; redraw(); }
    });
    container.querySelector('#rp-input').addEventListener('input', (e) => { this.draft = e.target.value; });
    f('#rp-source', v => { this.source = v; });
    f('#rp-period', v => { this.period = v; });
    f('#rp-sort', v => { this.sortBy = v; });
    container.querySelectorAll('.rp-kpi').forEach(b => b.addEventListener('click', () => { this.status = b.dataset.status; this.page = 1; redraw(); }));
    container.querySelectorAll('.rp-animal').forEach(b => b.addEventListener('click', () => { this.animal = b.dataset.v; this.page = 1; redraw(); }));
    container.querySelectorAll('.rp-chip').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.clear;
      if (k === 'query') this.query = this.draft = ''; else this[k] = 'all';
      this.page = 1; redraw();
    }));
    container.querySelectorAll('.rp-row').forEach(r => r.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      this.locate(parseFloat(r.dataset.lat), parseFloat(r.dataset.lng), r.dataset.id);
    }));
    container.querySelector('#rp-clear')?.addEventListener('click', () => {
      Object.assign(this, { query: '', draft: '', status: 'all', source: 'all', animal: 'all', period: 'all', page: 1 });
      redraw();
    });
    container.querySelectorAll('.page-btn[data-page]').forEach(b => b.addEventListener('click', () => {
      const n = parseInt(b.dataset.page, 10);
      if (n >= 1) { this.page = n; redraw(); }
    }));
    container.querySelectorAll('.rp-locate').forEach(b => b.addEventListener('click', () => this.locate(parseFloat(b.dataset.lat), parseFloat(b.dataset.lng), b.dataset.id)));
  }
};
