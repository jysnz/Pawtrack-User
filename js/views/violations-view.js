/**
 * PawTrack Violations (owner app)
 * One row per violation from the Quezon City Veterinary Code (Ordinance SP-2505, S-2016) and SP-2990, S-2020,
 * with its fine on the row. Tap a row for the full detail: the section, the fine for every offense and the other
 * violations under the same section. The data (js/violations-data.js) is shared with the admin console, and is public,
 * so signed-out visitors can open this page too. A reference list: nothing here is stored.
 *
 * The detail sheet is added to <body> (so no page layout can trap or hide it) and takes one history entry: the Back
 * button closes it instead of leaving the page.
 */
class ViolationsView {
  constructor() {
    this.query = '';
    this.filter = 'all';   // 'all' | 'ladder' | 'flat' | 'none'
    this.openId = null;
    this.container = null;

    // Back closes the sheet
    window.addEventListener('popstate', (e) => {
      if (this.openId && !(e.state && e.state.vlOpen)) this.closeSheet(false);
    });
    // Leaving the page closes it too
    window.addEventListener('hashchange', () => {
      if (window.location.hash !== '#fines') this.closeSheet(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.openId) this.closeSheet(true);
    });
  }

  data() { return window.PawViolations; }

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------------------------------------------------------------- list
  penaltyHtml(p) {
    const D = this.data();
    const pen = p.penalty;
    if (pen.kind === 'ladder') {
      return `<div class="vl-ladder">${pen.steps.map((amt, i) => `
        <div class="vl-step"><span class="vl-step-name">${D.OFFENSES[i]}</span><b class="vl-step-amt">${D.peso(amt)}</b></div>`).join('')}</div>`;
    }
    if (pen.kind === 'flat') {
      return `<div class="vl-flat"><b class="vl-step-amt">${D.peso(pen.amount)}</b>${(pen.extras || []).map((x) => `<span class="vl-tag">${this.esc(x)}</span>`).join('')}</div>`;
    }
    return '<div class="vl-none">Not stated on the notice</div>';
  }

  rowHtml(r) {
    const D = this.data();
    return `
      <button type="button" class="vl-row" data-id="${this.esc(r.id)}" aria-haspopup="dialog">
        <span class="vl-row-main">
          <span class="vl-row-name">${this.esc(r.name)}</span>
          <span class="vl-row-sub"><b>${this.esc(r.provision.ref)}</b> &middot; ${this.esc(r.provision.title)}</span>
        </span>
        <span class="vl-row-fine vl-fine-${r.provision.penalty.kind}">${this.esc(D.fineLabel(r.provision))}</span>
        <svg class="vl-row-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </button>`;
  }

  listHtml() {
    const list = this.data().filter(this.query, this.filter);
    const total = this.data().rows.length;
    const status = list.length === total ? `${total} violations` : `${list.length} of ${total} violations`;
    return `
      <div class="vl-count" aria-live="polite">${status}</div>
      ${list.length
        ? `<div class="vl-rows">${list.map((r) => this.rowHtml(r)).join('')}</div>`
        : `<div class="vl-empty">No violation matches &ldquo;${this.esc(this.query)}&rdquo;. Try a section number, a fine or a word like &ldquo;leash&rdquo;.</div>`}`;
  }

  render(container) {
    this.container = container || document.getElementById('app-viewport');
    if (!this.container) return;
    const filters = [['all', 'All'], ['ladder', 'Fine rises per offense'], ['flat', 'One fine'], ['none', 'No fine stated']];
    this.container.innerHTML = `
      <div class="vl-page">
        <div class="view-header">
          <div class="view-title-group">
            <a href="#settings" class="vl-back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg> Settings</a>
            <h1>Violations</h1>
            <div class="view-subtitle">What pet owners can be fined for under the Quezon City Veterinary Code (SP-2505, S-2016) and SP-2990, S-2020. Tap a violation to see its fine and details.</div>
          </div>
        </div>

        <div class="vl-notice" role="note">
          <b>Notice of violation</b>
          <span>A person who violates these provisions is directed to report to the City Veterinary Department for appropriate action.</span>
        </div>

        <div class="vl-toolbar">
          <label class="vl-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="search" id="vl-search" placeholder="Search a section, violation or fine" value="${this.esc(this.query)}" autocomplete="off" aria-label="Search violations" />
          </label>
          <label class="vl-select">
            <span class="vl-select-label">Fine</span>
            <select id="vl-filter" aria-label="Filter by fine">
              ${filters.map(([k, label]) => `<option value="${k}"${this.filter === k ? ' selected' : ''}>${label}</option>`).join('')}
            </select>
          </label>
        </div>

        <div id="vl-results">${this.listHtml()}</div>
      </div>`;
    this.bind();
    this.syncSheet();
  }

  bind() {
    const results = this.container.querySelector('#vl-results');
    const refresh = () => { if (results) results.innerHTML = this.listHtml(); };
    const input = this.container.querySelector('#vl-search');
    if (input) input.addEventListener('input', () => { this.query = input.value; refresh(); });
    const filterSelect = this.container.querySelector('#vl-filter');
    if (filterSelect) filterSelect.addEventListener('change', () => { this.filter = filterSelect.value; refresh(); });
    // One handler for every row, so rows redrawn by a search or filter still work
    if (results) results.addEventListener('click', (e) => {
      const row = e.target.closest('.vl-row');
      if (row) this.openSheet(row.dataset.id);
    });
  }

  // ---------------------------------------------------------------- detail sheet
  sheetHtml(r) {
    const D = this.data();
    const p = r.provision;
    const others = D.siblings(r);
    return `
      <div class="vl-sheet" role="dialog" aria-modal="true" aria-labelledby="vl-sheet-title">
        <div class="vl-sheet-top">
          <span class="vl-ref">${this.esc(p.ref)}</span>
          <button type="button" class="vl-sheet-close" id="vl-sheet-close" aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
        </div>
        <h2 class="vl-sheet-title" id="vl-sheet-title">${this.esc(r.name)}</h2>
        <p class="vl-sheet-sub">${r.listed ? `Under ${this.esc(p.ref)}: ${this.esc(p.title)}` : this.esc(p.ref)}<br>Ordinance ${this.esc(p.ordinance)}${p.ordinance === 'SP-2505, S-2016' ? ' (Quezon City Veterinary Code)' : ''}</p>
        <div class="vl-penalty">
          <div class="vl-penalty-label">${p.penalty.kind === 'ladder' ? 'Fine per offense' : 'Fine'}</div>
          ${this.penaltyHtml(p)}
          <p class="vl-penalty-note">${this.esc(D.fineExplained(p))}</p>
        </div>
        ${p.note ? `<p class="vl-note">${this.esc(p.note)}</p>` : ''}
        ${others.length ? `
          <div class="vl-also">
            <div class="vl-penalty-label">Also under ${this.esc(p.ref)}</div>
            <ul>${others.map((o) => `<li><button type="button" class="vl-also-btn" data-id="${this.esc(o.id)}">${this.esc(o.name)}</button></li>`).join('')}</ul>
          </div>` : ''}
        <p class="vl-sheet-foot">A person who violates this is directed to report to the City Veterinary Department for appropriate action.</p>
      </div>`;
  }

  // Makes the sheet on screen match openId (none, or one violation)
  syncSheet() {
    let wrap = document.getElementById('vl-sheet-wrap');
    const row = this.openId ? this.data().byId(this.openId) : null;
    if (!row) {
      if (wrap) wrap.remove();
      document.body.classList.remove('vl-sheet-open');
      return;
    }
    const fresh = !wrap;
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'vl-sheet-wrap';
      wrap.className = 'vl-sheet-wrap';
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap) { this.closeSheet(true); return; } // a tap on the dim area around the sheet
        if (e.target.closest('#vl-sheet-close')) { this.closeSheet(true); return; }
        const also = e.target.closest('.vl-also-btn');
        if (also) { this.openId = also.dataset.id; this.syncSheet(); const body = wrap.querySelector('.vl-sheet'); if (body) body.scrollTop = 0; }
      });
      document.body.appendChild(wrap);
    }
    wrap.innerHTML = this.sheetHtml(row);
    document.body.classList.add('vl-sheet-open');
    const close = wrap.querySelector('#vl-sheet-close');
    if (close && fresh) close.focus({ preventScroll: true });
  }

  openSheet(id) {
    if (!this.data().byId(id)) return;
    this.openId = id;
    this._returnTo = id;
    // One history entry, so the phone's Back button closes the sheet
    try { history.pushState({ vlOpen: id }, '', window.location.href); } catch (e) { /* ignore */ }
    this.syncSheet();
  }

  // fromUser: closed with the button, a tap outside or Esc, so the history entry made on open is taken back too
  closeSheet(fromUser) {
    if (!this.openId) return;
    this.openId = null;
    if (fromUser) { try { if (history.state && history.state.vlOpen) history.back(); } catch (e) { /* ignore */ } }
    this.syncSheet();
    if (this._returnTo && this.container) {
      const back = this.container.querySelector(`.vl-row[data-id="${this._returnTo}"]`);
      if (back) back.focus({ preventScroll: true });
    }
    this._returnTo = null;
  }
}

window.violationsView = new ViolationsView();
