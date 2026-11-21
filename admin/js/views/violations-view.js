/**
 * PawTrack Admin: Violations
 * One row per violation (Ordinance SP-2505, S-2016 and SP-2990, S-2020), with the fine on the row.
 * Tap a row for the full detail: the section, how the fine works for every offense, and the other violations under it.
 * The open violation is in the address (#violations/<id>), so Back closes it and a link opens it.
 * The data is shared with the owner app (../js/violations-data.js). A reference list: nothing here is stored or issued.
 */
window.ViolationsView = {
  query: '',
  filter: 'all', // 'all' | 'ladder' | 'flat' | 'none'

  data() { return window.PawViolations; },

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // The violation named in the address, if any
  openRow() {
    const raw = (window.adminApp && window.adminApp.routeParam) || '';
    let id = raw;
    try { id = decodeURIComponent(raw); } catch (e) { /* keep as is */ }
    return id ? this.data().byId(id) : null;
  },

  visible() { return this.data().filter(this.query, this.filter); },

  renderPenalty(p) {
    const D = this.data();
    const pen = p.penalty;
    if (pen.kind === 'ladder') {
      return `<div class="vio-ladder">${pen.steps.map((amt, i) => `
        <div class="vio-step"><span class="vio-step-name">${D.OFFENSES[i]}</span><b class="vio-step-amt">${D.peso(amt)}</b></div>`).join('')}</div>`;
    }
    if (pen.kind === 'flat') {
      return `<div class="vio-flat"><b class="vio-step-amt">${D.peso(pen.amount)}</b>${(pen.extras || []).map(x => `<span class="vio-tag">${this.esc(x)}</span>`).join('')}</div>`;
    }
    return '<div class="vio-none">Not stated on the notice</div>';
  },

  renderRow(r) {
    const D = this.data();
    const kind = r.provision.penalty.kind;
    return `
      <a class="vio-row" href="#violations/${encodeURIComponent(r.id)}" data-id="${this.esc(r.id)}">
        <span class="vio-row-main">
          <span class="vio-row-name">${this.esc(r.name)}</span>
          <span class="vio-row-sub"><b>${this.esc(r.provision.ref)}</b> &middot; ${this.esc(r.provision.title)}</span>
        </span>
        <span class="vio-row-fine vio-fine-${kind}">${this.esc(D.fineLabel(r.provision))}</span>
        <svg class="vio-row-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </a>`;
  },

  renderSheet(r) {
    const D = this.data();
    const p = r.provision;
    const others = D.siblings(r);
    return `
      <div class="vio-sheet-wrap" id="vio-sheet-wrap">
        <div class="vio-sheet" role="dialog" aria-modal="true" aria-labelledby="vio-sheet-title">
          <div class="vio-sheet-top">
            <span class="vio-ref">${this.esc(p.ref)}</span>
            <button type="button" class="vio-sheet-close" id="vio-sheet-close" aria-label="Close">&times;</button>
          </div>
          <h2 class="vio-sheet-title" id="vio-sheet-title">${this.esc(r.name)}</h2>
          <p class="vio-sheet-sub">${r.listed ? `Under ${this.esc(p.ref)}: ${this.esc(p.title)}` : this.esc(p.ref)}<br>Ordinance ${this.esc(p.ordinance)}${p.ordinance === 'SP-2505, S-2016' ? ' (Quezon City Veterinary Code)' : ''}</p>
          <div class="vio-penalty">
            <div class="vio-penalty-label">${p.penalty.kind === 'ladder' ? 'Fine per offense' : 'Fine'}</div>
            ${this.renderPenalty(p)}
            <p class="vio-penalty-note">${this.esc(D.fineExplained(p))}</p>
          </div>
          ${p.note ? `<p class="vio-note">${this.esc(p.note)}</p>` : ''}
          ${others.length ? `
            <div class="vio-also">
              <div class="vio-penalty-label">Also under ${this.esc(p.ref)}</div>
              <ul>${others.map(o => `<li><a href="#violations/${encodeURIComponent(o.id)}">${this.esc(o.name)}</a></li>`).join('')}</ul>
            </div>` : ''}
          <p class="vio-sheet-foot">A person who violates this is directed to report to the City Veterinary Department for appropriate action.</p>
        </div>
      </div>`;
  },

  renderList() {
    const list = this.visible();
    const total = this.data().rows.length;
    const status = list.length === total ? `${total} violations` : `${list.length} of ${total} violations`;
    return `
      <div class="vio-count" aria-live="polite">${status}</div>
      ${list.length
        ? `<div class="vio-rows">${list.map(r => this.renderRow(r)).join('')}</div>`
        : `<div class="vio-empty">No violation matches &ldquo;${this.esc(this.query)}&rdquo;. Try a section number, a fine or a word like &ldquo;leash&rdquo;.</div>`}`;
  },

  render(container) {
    const filters = [['all', 'All'], ['ladder', 'Fine rises per offense'], ['flat', 'One fine'], ['none', 'No fine stated']];
    const open = this.openRow();
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Violations</h1>
          <div class="subtitle">
            <span>Quezon City Veterinary Code (SP-2505, S-2016) and SP-2990, S-2020. Tap a violation for its fine and details.</span>
          </div>
        </div>
      </div>

      <div class="vio-notice" role="note">
        <b>Notice of violation</b>
        <span>The person is directed to report to the City Veterinary Department for appropriate action for violating the provisions below.</span>
      </div>

      <div class="vio-toolbar">
        <div class="vio-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="vio-search" placeholder="Search a section, violation or fine" value="${this.esc(this.query)}" autocomplete="off" aria-label="Search violations" />
        </div>
        <label class="vio-select">
          <span class="vio-select-label">Fine</span>
          <select id="vio-filter" aria-label="Filter by fine">
            ${filters.map(([k, label]) => `<option value="${k}"${this.filter === k ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
      </div>

      <div id="vio-results">${this.renderList()}</div>
      ${open ? this.renderSheet(open) : ''}
    `;

    const results = container.querySelector('#vio-results');
    const refresh = () => { if (results) results.innerHTML = this.renderList(); };
    const input = container.querySelector('#vio-search');
    if (input) input.addEventListener('input', () => { this.query = input.value; refresh(); });
    const filterSelect = container.querySelector('#vio-filter');
    if (filterSelect) filterSelect.addEventListener('change', () => { this.filter = filterSelect.value; refresh(); });

    // The detail sheet: close with the button, a tap outside it, or Esc; focus goes in, and back to the row on close
    const wrap = container.querySelector('#vio-sheet-wrap');
    if (wrap) {
      this._returnTo = open.id;
      const close = () => { window.location.hash = '#violations'; };
      wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
      const x = wrap.querySelector('#vio-sheet-close');
      if (x) { x.addEventListener('click', close); x.focus({ preventScroll: true }); }
    } else if (this._returnTo) {
      const back = container.querySelector(`.vio-row[data-id="${this._returnTo}"]`);
      this._returnTo = null;
      if (back) back.focus({ preventScroll: true });
    }
    if (!this._escBound && typeof document !== 'undefined') {
      this._escBound = true;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('vio-sheet-wrap')) window.location.hash = '#violations';
      });
    }
  }
};
