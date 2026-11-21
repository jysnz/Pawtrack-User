/**
 * PawTrack Violations (owner app): the signed-in owner's own violations.
 * A violation is recorded when a registered pet still has no NFC tag 7 days after it was first seen without one
 * (see js/nfc-reminders.js). Pets that are still inside their 7 days are listed too, with the days left.
 * The full list of violations and fines in the Quezon City Veterinary Code is a separate page, opened from Settings.
 */
class MyViolationsView {
  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  date(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  fineText(v) {
    const D = window.PawViolations;
    return Number(v.fine) > 0 ? (D ? D.peso(v.fine) : String(v.fine)) : 'No fine stated';
  }

  names(v) {
    const D = window.PawViolations;
    const row = D && D.byId(v.ruleId);
    return {
      section: v.section || (row ? row.provision.ref : 'Section 35'),
      name: v.ruleName || (row ? row.name : 'Unregistered / no microchips')
    };
  }

  rowHtml(v) {
    const { section, name } = this.names(v);
    return `
      <article class="mv-card mv-card-tap" role="button" tabindex="0" data-vid="${this.esc(v.id)}" aria-label="Open details: ${this.esc(name)}">
        <div class="mv-card-top">
          <span class="vl-ref">${this.esc(section)}</span>
          <span class="mv-date">${this.esc(this.date(v.createdAt))}</span>
        </div>
        <h3 class="mv-name">${this.esc(name)}</h3>
        <p class="mv-reason">${this.esc(v.reason)}${v.issuedBy ? ` <em>Recorded by ${this.esc(v.issuedBy)}.</em>` : ''}</p>
        <div class="mv-meta">
          <span class="mv-offense">${this.esc(window.nfcReminders.ordinal(v.offense))} offense</span>
          <b class="mv-fine">${this.esc(this.fineText(v))}</b>
        </div>
        <span class="mv-tap-hint">${v.shelterId ? 'Tap to see where to go' : 'Tap for details'} &rsaquo;</span>
      </article>`;
  }

  // The impoundment facility that recorded the violation, if the app knows it
  facilityOf(v) {
    if (!v.shelterId || !window.pawStore) return null;
    return (window.pawStore.getShelters() || []).find((s) => String(s.id) === String(v.shelterId)) || null;
  }

  sheetHtml(v) {
    const { section, name } = this.names(v);
    const f = this.facilityOf(v);
    const dial = (n) => String(n).replace(/[^\d+]/g, '');
    const line = (label, html) => `<div class="mv-info-row"><span>${label}</span><div>${html}</div></div>`;
    let prompt;
    if (v.shelterId) {
      // Directions go to the facility's pin on the map; the address is only the fallback when no pin was saved
      const lat = f ? parseFloat(f.lat) : NaN;
      const lng = f ? parseFloat(f.lng) : NaN;
      const maps = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
        : (f && f.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}` : '');
      prompt = `
        <div class="mv-go">
          <div class="mv-go-title">Please go to ${f ? this.esc(f.name) : 'the impoundment facility that recorded this'}</div>
          <p>Visit the facility to settle this violation. Bring a valid ID and your pet details.</p>
          ${f ? `
            ${f.address ? line('Address', this.esc(f.address)) : ''}
            ${f.hours ? line('Hours', this.esc(f.hours)) : ''}
            ${f.phone ? line('Phone', `<a href="tel:${this.esc(dial(f.phone))}">${this.esc(f.phone)}</a>`) : ''}
            ${f.email ? line('Email', `<a href="mailto:${this.esc(f.email)}">${this.esc(f.email)}</a>`) : ''}
            <div class="mv-go-actions">
              ${maps ? `<a class="btn btn-primary btn-sm" href="${this.esc(maps)}" target="_blank" rel="noopener">Get directions</a>` : ''}
              ${f.phone ? `<a class="btn btn-secondary btn-sm" href="tel:${this.esc(dial(f.phone))}">Call</a>` : ''}
            </div>` : '<p>Its contact details are not available right now. Check the Impound page for facilities near you.</p>'}
        </div>`;
    } else {
      prompt = `
        <div class="mv-go">
          <div class="mv-go-title">Please report to the City Veterinary Department</div>
          <p>A person who violates this is directed to report to the City Veterinary Department for appropriate action. Linking an NFC tag to your pet avoids further violations.</p>
        </div>`;
    }
    return `
      <div class="vl-sheet-wrap" id="mv-sheet-wrap">
        <div class="vl-sheet" role="dialog" aria-modal="true" aria-labelledby="mv-sheet-title">
          <div class="vl-sheet-top">
            <span class="vl-ref">${this.esc(section)}</span>
            <button type="button" class="vl-sheet-close" data-mv-close aria-label="Close">&times;</button>
          </div>
          <h2 class="vl-sheet-title" id="mv-sheet-title">${this.esc(name)}</h2>
          <p class="vl-sheet-sub">Recorded ${this.esc(this.date(v.createdAt))}${v.issuedBy ? ` by ${this.esc(v.issuedBy)}` : ''}</p>
          <div class="vl-penalty">
            ${line('Offense', this.esc(window.nfcReminders.ordinal(v.offense)))}
            ${line('Fine', `<b class="mv-fine">${this.esc(this.fineText(v))}</b>`)}
            ${v.petName ? line('Pet', this.esc(v.petName)) : ''}
            ${line('What happened', this.esc(v.reason))}
          </div>
          ${prompt}
        </div>
      </div>`;
  }

  openDetail(v) {
    this.closeDetail();
    const holder = document.createElement('div');
    holder.id = 'mv-sheet-holder';
    holder.innerHTML = this.sheetHtml(v);
    document.body.appendChild(holder);
    document.body.classList.add('vl-sheet-open');
    const wrap = holder.querySelector('#mv-sheet-wrap');
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-mv-close]')) this.closeDetail(); });
    this._onKey = (e) => { if (e.key === 'Escape') this.closeDetail(); };
    document.addEventListener('keydown', this._onKey);
    const x = holder.querySelector('[data-mv-close]');
    if (x) x.focus({ preventScroll: true });
  }

  closeDetail() {
    const holder = document.getElementById('mv-sheet-holder');
    if (holder) holder.remove();
    document.body.classList.remove('vl-sheet-open');
    if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
  }

  pendingHtml(p) {
    const left = p.daysLeft <= 0 ? 'due today' : p.daysLeft === 1 ? '1 day left' : `${p.daysLeft} days left`;
    return `
      <div class="mv-pending${p.daysLeft <= 1 ? ' is-urgent' : ''}">
        <div class="mv-pending-text">
          <b>${this.esc(p.petName)}</b>
          <span>No NFC tag yet &middot; ${this.esc(left)} (by ${this.esc(this.date(p.dueAt))})</span>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-link-pet="${this.esc(p.petId)}">Link NFC tag</button>
      </div>`;
  }

  render(container) {
    if (!container) return;
    this._container = container;
    const user = window.pawStore.getGoogleUser();
    if (!user || !user.name) {
      container.innerHTML = `
        <div class="view-header"><div class="view-title-group"><h1>Violations</h1></div></div>
        <div class="vl-empty">Sign in to see your violations.</div>`;
      return;
    }
    const R = window.nfcReminders;
    // Local ones (no NFC tag) plus the ones an admin recorded against this account
    const list = (R ? R.violations() : []).concat(this.remote || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const pending = R ? R.pending() : [];
    const total = list.reduce((a, v) => a + Number(v.fine || 0), 0);

    container.innerHTML = `
      <div class="vl-page">
        <div class="view-header">
          <div class="view-title-group">
            <h1>Violations</h1>
            <div class="view-subtitle">Violations recorded on your account. A pet with no NFC tag after ${R ? R.WINDOW_DAYS : 7} days is a Section 35 violation (Unregistered / no microchips).</div>
          </div>
        </div>

        ${pending.length ? `
          <section class="mv-section">
            <h2 class="mv-heading">Link a tag to avoid a violation</h2>
            ${pending.map((p) => this.pendingHtml(p)).join('')}
          </section>` : ''}

        <section class="mv-section">
          <h2 class="mv-heading">Your violations${list.length ? ` <span class="mv-count">${list.length}</span>` : ''}</h2>
          ${list.length ? `
            <div class="mv-total">Total fines recorded <b>${this.esc(window.PawViolations.peso(total))}</b></div>
            <div class="mv-list">${list.map((v) => this.rowHtml(v)).join('')}</div>
            <p class="mv-foot">A person who violates this is directed to report to the City Veterinary Department for appropriate action.</p>`
          : `<div class="vl-empty">You have no violations. Keep every pet's NFC tag linked to stay that way.</div>`}
        </section>
      </div>`;

    const byId = new Map(list.map((v) => [String(v.id), v]));
    container.querySelectorAll('.mv-card-tap').forEach((card) => {
      const open = () => { const v = byId.get(card.dataset.vid); if (v) this.openDetail(v); };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    container.querySelectorAll('[data-link-pet]').forEach((btn) => {
      btn.addEventListener('click', () => R.linkNow(btn.dataset.linkPet));
    });
    this.applyTarget(container, list);
    this.loadRemote(container, user);
  }

  // A tapped "VIOLATION" notification points here: scroll to that violation and flash it.
  // target is { id } (a local one) or { title, ts } (one an admin recorded: matched on its title and the time it was made).
  focusViolation(target) {
    this.target = target || null;
    const c = this._container;
    if (c && c.isConnected && c.querySelector('.vl-page')) this.render(c);
  }

  applyTarget(container, list) {
    const t = this.target;
    if (!t) return;
    let hit = null;
    if (t.id) hit = list.find((v) => String(v.id) === String(t.id)) || null;
    else if (t.title) {
      const want = String(t.title).replace(/^VIOLATION:\s*/i, '').trim().toLowerCase();
      const ts = new Date(t.ts).getTime();
      let best = Infinity;
      list.forEach((v) => {
        if (String(this.names(v).name).trim().toLowerCase() !== want) return;
        const gap = Math.abs(new Date(v.createdAt).getTime() - ts);
        const near = Number.isFinite(ts) ? gap : 0;
        if (near < best && near < 10 * 60 * 1000) { best = near; hit = v; }
      });
    }
    if (!hit) return; // maybe the list is still loading: loadRemote tries again
    const card = [...container.querySelectorAll('.mv-card-tap')].find((el) => el.dataset.vid === String(hit.id));
    if (!card) return;
    this.target = null;
    card.classList.add('mv-flash');
    setTimeout(() => card.classList.remove('mv-flash'), 3500);
    setTimeout(() => card.scrollIntoView({ block: 'center', behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 50);
  }

  // Violations an admin recorded against this account; the page redraws once if there are new ones
  async loadRemote(container, user) {
    const sb = window.pawStore.client();
    if (!sb || !user.id) { this.target = null; return; }
    const { data, error } = await sb.from('violations').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    if (error || !container.isConnected) { this.target = null; return; }
    const next = (data || []).map((v) => ({
      id: v.id, ruleId: v.rule_id, ruleName: v.rule_name, section: v.section, offense: v.offense, fine: v.fine_php,
      createdAt: v.created_at, reason: v.reason, issuedBy: v.issued_by_name || '', shelterId: v.shelter_id || '', petName: v.pet_name || ''
    }));
    if (JSON.stringify(next) === JSON.stringify(this.remote || [])) { this.target = null; return; }
    this.remote = next;
    this.render(container);
  }
}

window.myViolationsView = new MyViolationsView();
