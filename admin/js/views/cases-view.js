/**
 * PawTrack Admin — Cases & Analytics
 * Every missing-pet case in one list, with recovery numbers, the busiest areas, and each case's history.
 */

window.CasesView = {
  filter: 'all',
  query: '',

  statusMeta: {
    missing: { label: 'Missing', pill: 'status-lost', color: 'var(--color-red)' },
    sighted: { label: 'Sighted', pill: 'status-impounded', color: 'var(--color-amber)' },
    impounded: { label: 'In a shelter', pill: 'status-impounded', color: 'var(--color-amber)' },
    reunited: { label: 'Reunited', pill: 'status-safe', color: 'var(--color-green)' },
    safe: { label: 'Safe', pill: 'status-safe', color: 'var(--color-green)' }
  },

  stepKinds: { missing: 'Reported missing', sighted: 'Sighted', impounded: 'Taken to a shelter', reunited: 'Reunited', safe: 'Marked safe' },

  esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  when(v, withTime = true) {
    const d = new Date(v);
    if (isNaN(d)) return '';
    return withTime
      ? d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  },

  isClosed(c) {
    return c.status === 'reunited' || c.status === 'safe';
  },

  lastSeen(c) {
    const step = (c.timeline || []).find((x) => x.location);
    return step ? step.location : '';
  },

  // The area is the last two parts of an address, for example "Diliman, Quezon City"
  areaOf(loc) {
    return String(loc || '').split(',').map((x) => x.trim())
      .filter((x) => x && !/^(philippines|metro manila|ncr|national capital region)$/i.test(x))
      .slice(-2).join(', ');
  },

  hotspots(cases, store) {
    const groups = new Map();
    const add = (loc) => {
      const area = this.areaOf(loc);
      if (area) groups.set(area, (groups.get(area) || 0) + 1);
    };
    cases.forEach((c) => add(this.lastSeen(c)));
    store.getSightings().filter((s) => s.status !== 'dismissed').forEach((s) => add(s.location));
    store.getImpoundments().forEach((i) => add(i.foundLocation || i.location));
    const list = [...groups.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
    const max = list.length ? list[0][1] : 1;
    return list.map(([name, count]) => ({ name, count, percent: Math.round(count / max * 100) }));
  },

  render(container) {
    const store = window.adminStore;
    const all = store.getCases();
    const pets = store.getPets();
    const closed = all.filter((c) => this.isClosed(c));
    const open = all.length - closed.length;

    const recoveryRate = all.length ? Math.round(closed.length / all.length * 100) : 0;
    const spans = closed.map((c) => {
      const done = (c.timeline || []).find((x) => x.type === 'reunited');
      return (new Date((done && done.timestamp) || c.lastUpdated) - new Date(c.createdAt)) / 36e5;
    }).filter((h) => Number.isFinite(h) && h >= 0);
    const avgHours = spans.length ? Math.round(spans.reduce((n, h) => n + h, 0) / spans.length * 10) / 10 : null;
    const tagged = pets.filter((p) => p.rfidTag || p.nfcTag).length;
    const tagPercent = pets.length ? Math.round(tagged / pets.length * 100) : 0;

    const counts = { all: all.length };
    Object.keys(this.statusMeta).forEach((k) => { counts[k] = all.filter((c) => c.status === k).length; });
    const filters = [['all', 'All'], ['missing', 'Missing'], ['sighted', 'Sighted'], ['impounded', 'In a shelter'], ['reunited', 'Reunited']];

    const q = this.query.trim().toLowerCase();
    let rows = all.filter((c) => this.filter === 'all' || c.status === this.filter || (this.filter === 'reunited' && c.status === 'safe'));
    if (q) {
      rows = rows.filter((c) => [c.id, c.petName, this.lastSeen(c)].filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    rows = rows.slice().sort((a, b) => new Date(b.lastUpdated || b.createdAt) - new Date(a.lastUpdated || a.createdAt));

    const hot = this.hotspots(all, store);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Cases &amp; Analytics</h1>
          <div class="subtitle"><span>Every missing-pet case, how many ended with a reunion, and where pets go missing</span></div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Open cases</div>
          <div class="kpi-body"><div>
            <div class="kpi-value">${open}</div>
            <div class="kpi-delta neutral">${all.length} cases in total</div>
          </div></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Recovery rate</div>
          <div class="kpi-body"><div>
            <div class="kpi-value">${recoveryRate}%</div>
            <div class="kpi-delta neutral">${closed.length} of ${all.length} cases reunited</div>
          </div></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Average time to reunite</div>
          <div class="kpi-body"><div>
            <div class="kpi-value">${avgHours === null ? '&mdash;' : `${avgHours} hrs`}</div>
            <div class="kpi-delta neutral">${avgHours === null ? 'No reunions yet' : 'From report to reunion'}</div>
          </div></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Pets with an NFC tag</div>
          <div class="kpi-body"><div>
            <div class="kpi-value">${tagPercent}%</div>
            <div class="kpi-delta neutral">${tagged} with a tag, ${pets.length - tagged} without</div>
          </div></div>
        </div>
      </div>

      <div class="cv-grid">
        <div class="table-container cv-table">
          <div class="table-toolbar">
            <div class="table-filters">
              ${filters.map(([key, label]) => `<button class="filter-pill ${this.filter === key ? 'active' : ''}" data-filter="${key}">${label} (${key === 'reunited' ? counts.reunited + counts.safe : counts[key]})</button>`).join('')}
            </div>
            <div class="table-search">
              <input type="text" id="cases-search" placeholder="Search by pet, case ID or area" value="${this.esc(this.query)}" autocomplete="off" />
            </div>
          </div>
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Pet</th>
                  <th>Status</th>
                  <th>Last seen</th>
                  <th>Opened</th>
                  <th>Updates</th>
                  <th style="text-align: right;">Case</th>
                </tr>
              </thead>
              <tbody>
                ${rows.length ? rows.map((c) => this.rowHtml(c, pets)).join('') : `
                  <tr><td colspan="6" class="cv-empty">
                    <b>${all.length ? 'No cases match this filter' : 'No cases yet'}</b>
                    <span>${all.length ? 'Try another status or clear the search.' : 'A case opens when an owner reports a pet missing.'}</span>
                  </td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="nock-card cv-hot">
          <div class="nock-card-head"><div class="nock-card-title">Where pets go missing</div></div>
          ${hot.length ? `<ol class="cv-hot-list">${hot.map((h) => `
            <li>
              <div class="cv-hot-top"><span>${this.esc(h.name)}</span><b>${h.count}</b></div>
              <div class="cv-hot-bar"><i style="width:${h.percent}%"></i></div>
            </li>`).join('')}</ol>
            <div class="cv-hot-note">Counts missing reports, sightings and shelter intakes by area. The Heatmap page shows them on the map.</div>`
            : '<div class="cv-hot-note">No incidents with a location yet. Areas appear here as pets are reported.</div>'}
        </div>
      </div>
    `;

    this.attach(container);
  },

  rowHtml(c, pets) {
    const meta = this.statusMeta[c.status] || { label: c.status || 'Open', pill: 'status-impounded' };
    const pet = pets.find((p) => p.id === c.petId) || {};
    const photo = pet.photoUrl || (c.timeline || []).map((x) => x.photoUrl).find(Boolean) || '';
    const area = this.lastSeen(c);
    return `
      <tr>
        <td>
          <div class="pet-cell">
            ${photo ? `<img src="${this.esc(photo)}" class="pet-thumb" alt="" loading="lazy" />` : '<div class="pet-thumb"></div>'}
            <div class="pet-meta">
              <span class="pet-name">${this.esc(c.petName || pet.name || 'Unnamed pet')}</span>
              <span class="mono-tag" style="font-size: 9px; width: max-content; margin-top: 2px;">${this.esc(c.id)}</span>
            </div>
          </div>
        </td>
        <td><span class="status-pill ${meta.pill}">${this.esc(meta.label)}</span></td>
        <td><div class="cv-ellipsis" title="${this.esc(area)}">${this.esc(area || 'Unknown')}</div></td>
        <td>${this.esc(this.when(c.createdAt, false) || '—')}</td>
        <td>${(c.timeline || []).length}</td>
        <td style="text-align: right;"><button class="btn btn-sm btn-secondary" data-case="${this.esc(c.id)}">View case</button></td>
      </tr>`;
  },

  attach(container) {
    container.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      this.filter = b.dataset.filter;
      this.render(container);
    }));
    const search = container.querySelector('#cases-search');
    if (search) {
      search.addEventListener('input', () => {
        this.query = search.value;
        const pos = search.selectionStart;
        this.render(container);
        const next = container.querySelector('#cases-search');
        if (next) { next.focus(); next.setSelectionRange(pos, pos); }
      });
    }
    container.querySelectorAll('[data-case]').forEach((b) => b.addEventListener('click', () => this.openCase(b.dataset.case)));
  },

  // "Condition: x | y" notes (older ones start with the pinned coordinates) shown as labelled rows
  notesHtml(raw) {
    const text = String(raw || '').replace(/^Guardian reported missing with pinned coordinates \[[^\]]*\]\.?\s*(Notes:\s*)?/i, '').trim();
    if (!text) return '';
    const rows = text.split(/\s*\|\s*/).filter(Boolean).map((part) => {
      const m = part.match(/^(Condition|Notes?|Description)\s*:\s*(.+)$/i);
      return m ? [m[1].replace(/^notes?$/i, 'Notes'), m[2]] : ['Notes', part];
    });
    return `<dl class="cv-notes">${rows.map(([k, v]) => `<div><dt>${this.esc(k)}</dt><dd>${this.esc(v)}</dd></div>`).join('')}</dl>`;
  },

  openCase(id) {
    const store = window.adminStore;
    const c = store.getCases().find((x) => x.id === id);
    if (!c) return;
    const pet = store.getPetById(c.petId) || {};
    const meta = this.statusMeta[c.status] || { label: c.status || 'Open', pill: 'status-impounded', color: 'var(--ink-muted)' };
    const steps = Array.isArray(c.timeline) ? c.timeline : [];
    const phone = pet.owner && pet.owner.phone ? String(pet.owner.phone) : '';
    const photo = pet.photoUrl || steps.map((x) => x.photoUrl).find(Boolean) || '';
    const kind = (t) => this.stepKinds[t] || (String(t || 'update').charAt(0).toUpperCase() + String(t || 'update').slice(1));

    const box = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Case details &amp; history</div>
        <button class="btn btn-sm btn-secondary" id="case-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="cv-sum">
          ${photo ? `<img class="cv-sum-photo" src="${this.esc(photo)}" alt="" />` : ''}
          <div class="cv-sum-text">
            <h3>${this.esc(c.petName || pet.name || 'Unnamed pet')}</h3>
            <div>${this.esc([pet.species, pet.breed].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ') || 'Pet details not recorded')}</div>
            <div class="cv-sum-id">Case ${this.esc(c.id)}</div>
          </div>
          <span class="status-pill ${meta.pill}">${this.esc(meta.label)}</span>
        </div>

        <div class="cv-facts">
          <div><span>Owner</span><b>${this.esc((pet.owner && pet.owner.name) || 'Not recorded')}</b></div>
          <div><span>Owner contact</span>${phone ? `<a href="tel:${this.esc(phone.replace(/[^+\d]/g, ''))}">${this.esc(phone)}</a>` : '<b>Not provided</b>'}</div>
          <div><span>Last seen</span><b>${this.esc(this.lastSeen(c) || 'Unknown')}</b></div>
          <div><span>Case opened</span><b>${this.esc(this.when(c.createdAt) || 'Unknown')}</b></div>
        </div>

        <div class="cv-history-title">Case history <small>${steps.length} ${steps.length === 1 ? 'update' : 'updates'}, newest first</small></div>
        <ol class="cv-steps">
          ${steps.length ? steps.map((x, i) => `
            <li class="${i === 0 ? 'is-latest' : ''}">
              <div class="cv-step-head"><span>${this.esc(kind(x.type))}</span><time>${this.esc(this.when(x.timestamp))}</time></div>
              <div class="cv-step-title">${this.esc(x.title)}</div>
              ${x.location ? `<div class="cv-step-loc">${this.esc(x.location)}</div>` : ''}
              ${this.notesHtml(x.notes)}
              ${x.photoUrl ? `<img class="cv-step-photo" src="${this.esc(x.photoUrl)}" alt="Photo from this update" loading="lazy" />` : ''}
            </li>`).join('') : '<li><div class="cv-step-title">No updates yet.</div></li>'}
        </ol>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="case-done-btn">Close</button>
      </div>
    `);
    box.querySelector('#case-close-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    box.querySelector('#case-done-btn')?.addEventListener('click', () => window.adminApp.closeModal());
  }
};
