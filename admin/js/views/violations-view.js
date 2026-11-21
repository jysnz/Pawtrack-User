/**
 * PawTrack Admin: Violations
 * One row per violation (Ordinance SP-2505, S-2016 and SP-2990, S-2020), with the fine on the row.
 * Tap a row for the full detail: the section, how the fine works for every offense, and the other violations under it.
 * The open violation is in the address (#violations/<id>), so Back closes it and a link opens it.
 * The data is shared with the owner app (../js/violations-data.js).
 * "Record a violation" issues one to a person (adminStore.issueViolation); they are notified and see it in their app.
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

  issued: null, // { rows, missing } once loaded

  // A round profile picture; the initial on a colour shows when there is no picture or it fails to load
  avatar(p) {
    const name = String(p.full_name || p.email || '?').trim();
    let hue = 0;
    for (let i = 0; i < name.length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360;
    const initial = this.esc((name.replace(/^[^A-Za-z0-9]+/, '').charAt(0) || '?').toUpperCase());
    const pic = /^https:\/\//.test(p.avatar_url || '') ? `<img src="${this.esc(p.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />` : '';
    return `<span class="vio-avatar" style="background:hsl(${hue} 55% 42%);">${initial}${pic}</span>`;
  },

  fmtDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  },

  async loadIssued(container) {
    if (!window.adminStore || !window.adminStore.listViolations) return;
    this.issued = await window.adminStore.listViolations();
    const box = container.querySelector('#vio-issued');
    if (box) box.innerHTML = this.renderIssued();
  },

  renderIssued() {
    const D = this.data();
    const it = this.issued;
    if (!it) return '<div class="vio-empty">Loading&hellip;</div>';
    if (it.missing) return '<div class="vio-empty">Recording violations needs the latest database update (supabase/migrations/20261131_issued_violations.sql).</div>';
    if (!it.rows.length) return '<div class="vio-empty">No violation has been recorded against anyone yet.</div>';
    return `<div class="vio-rows">${it.rows.map((v) => `
      <div class="vio-row vio-issued-row">
        <span class="vio-row-main">
          <span class="vio-row-name">${this.esc(v.owner_name || 'Unknown person')} &middot; ${this.esc(v.rule_name)}</span>
          <span class="vio-row-sub"><b>${this.esc(v.section)}</b> &middot; offense ${this.esc(v.offense)}${v.pet_name ? ' &middot; ' + this.esc(v.pet_name) : ''} &middot; ${this.esc(this.fmtDate(v.created_at))}</span>
          <span class="vio-row-sub">${this.esc(v.reason)}</span>
        </span>
        <span class="vio-row-fine vio-fine-ladder">${this.esc(D.peso(v.fine_php))}</span>
      </div>`).join('')}</div>`;
  },

  // Record a violation against a person
  openRecord(container) {
    const D = this.data();
    const store = window.adminStore;
    const old = document.getElementById('vio-record-wrap');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.className = 'vio-sheet-wrap';
    wrap.id = 'vio-record-wrap';
    wrap.innerHTML = `
      <form class="vio-sheet vio-record" role="dialog" aria-modal="true" aria-labelledby="vio-rec-title" autocomplete="off">
        <div class="vio-sheet-top">
          <span class="vio-ref">New record</span>
          <button type="button" class="vio-sheet-close" data-close aria-label="Close">&times;</button>
        </div>
        <h2 class="vio-sheet-title" id="vio-rec-title">Record a violation</h2>
        <p class="vio-sheet-sub">The person is notified and sees it under Violations in their app.</p>

        <label class="vio-field" id="vio-rec-person-field"><span>Person</span>
          <input type="search" id="vio-rec-person" placeholder="Search, or type their registered email" />
        </label>
        <div class="vio-people" id="vio-rec-people"></div>
        <div class="vio-picked" id="vio-rec-picked" hidden></div>

        <label class="vio-field"><span>Violation</span>
          <select id="vio-rec-rule">${D.rows.filter((r) => r.listed).map((r) => `<option value="${this.esc(r.id)}">${this.esc(r.provision.ref)} &ndash; ${this.esc(r.name)}</option>`).join('')}</select>
        </label>
        <label class="vio-field"><span>Pet (optional)</span>
          <input type="text" id="vio-rec-pet" maxlength="120" placeholder="Name of the pet involved" />
        </label>
        <label class="vio-field"><span>What happened</span>
          <textarea id="vio-rec-reason" rows="3" maxlength="1000" placeholder="Describe what the person did"></textarea>
        </label>
        <p class="vio-penalty-note" id="vio-rec-fine"></p>
        <p class="vio-rec-error" id="vio-rec-error" role="alert" hidden></p>
        <div class="vio-rec-actions">
          <button type="button" class="btn btn-secondary" data-close>Cancel</button>
          <button type="submit" class="btn btn-primary" id="vio-rec-submit">Record violation</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);

    const $ = (sel) => wrap.querySelector(sel);
    let person = null;
    let timer = null;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });

    const ruleRow = () => D.byId($('#vio-rec-rule').value);
    const showFine = () => {
      const r = ruleRow();
      $('#vio-rec-fine').textContent = r ? `Fine: ${D.fineLabel(r.provision)}. ${D.fineExplained(r.provision)}` : '';
    };
    $('#vio-rec-rule').addEventListener('change', showFine);
    showFine();

    const pick = (p) => {
      person = p;
      $('#vio-rec-people').innerHTML = '';
      $('#vio-rec-person-field').hidden = true;
      const box = $('#vio-rec-picked');
      box.hidden = false;
      box.innerHTML = `${this.avatar(p)}<span class="vio-picked-text"><b>${this.esc(p.full_name || p.email)}</b><br><small>${this.esc(p.email || '')}</small></span><button type="button" class="btn btn-secondary btn-sm" id="vio-rec-change">Change</button>`;
      $('#vio-rec-change').addEventListener('click', () => {
        person = null;
        box.hidden = true;
        $('#vio-rec-person-field').hidden = false;
        $('#vio-rec-person').focus();
      });
    };
    $('#vio-rec-person').addEventListener('input', () => {
      clearTimeout(timer);
      const q = $('#vio-rec-person').value;
      const list = $('#vio-rec-people');
      if (q.trim().length < 2) { list.innerHTML = ''; return; }
      timer = setTimeout(async () => {
        const found = await store.findGuardians(q);
        if ($('#vio-rec-person').value !== q || !wrap.isConnected) return;
        list.innerHTML = found.length
          ? found.map((p, i) => `<button type="button" class="vio-person" data-i="${i}">${this.avatar(p)}<span class="vio-person-text"><b>${this.esc(p.full_name || '(no name)')}</b><small>${this.esc(p.email || '')}</small></span></button>`).join('')
          : '<div class="vio-empty">No one matches that.</div>';
        list.querySelectorAll('.vio-person').forEach((b) => b.addEventListener('click', () => pick(found[Number(b.dataset.i)])));
      }, 250);
    });

    $('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#vio-rec-error');
      const reason = $('#vio-rec-reason').value.trim();
      err.hidden = true;
      const typed = $('#vio-rec-person').value.trim();
      if (!person && !typed) { err.textContent = 'Choose the person first.'; err.hidden = false; return; }
      if (!reason) { err.textContent = 'Say what the person did.'; err.hidden = false; return; }
      const btn = $('#vio-rec-submit');
      btn.disabled = true;
      btn.textContent = 'Recording...';
      if (!person) {
        // An email (or name) was typed but not picked from the list: it must match someone registered in PawTrack
        const found = await store.findGuardians(typed);
        const t = typed.toLowerCase();
        const exact = found.filter((p) => (p.email || '').toLowerCase() === t);
        const byName = found.filter((p) => (p.full_name || '').toLowerCase() === t);
        const hit = exact.length === 1 ? exact[0] : (!exact.length && byName.length === 1 ? byName[0] : null);
        if (!hit) {
          err.textContent = found.length > 1 && !exact.length
            ? 'More than one person matches. Pick the right one from the list.'
            : 'That email or person does not exist in PawTrack. Check the email and try again.';
          err.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Record violation';
          return;
        }
        pick(hit);
      }
      const saved = await store.issueViolation({ ownerId: person.id, ownerName: person.full_name || person.email, row: ruleRow(), reason, petName: $('#vio-rec-pet').value.trim() });
      if (!saved) { btn.disabled = false; btn.textContent = 'Record violation'; return; }
      close();
      if (window.adminApp && window.adminApp.showToast) window.adminApp.showToast(`Violation recorded for ${person.full_name || person.email}: offense ${saved.offense}, fine ${D.peso(saved.fine_php)}. ${saved.emailed ? 'They were notified in the app and by email.' : 'They were notified in the app; the email could not be sent.'}`, saved.emailed ? 'success' : 'warning', 7000);
      this.loadIssued(container);
    });
    $('#vio-rec-person').focus();
  },

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
        <button type="button" class="btn btn-primary" id="vio-record-btn">Record a violation</button>
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
      <h2 class="vio-section-title">Recorded against people</h2>
      <div id="vio-issued">${this.renderIssued()}</div>
      ${open ? this.renderSheet(open) : ''}
    `;
    const recordBtn = container.querySelector('#vio-record-btn');
    if (recordBtn) recordBtn.addEventListener('click', () => this.openRecord(container));
    this.loadIssued(container);

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
