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

  rowHtml(v) {
    const D = window.PawViolations;
    const row = D && D.byId(v.ruleId);
    const section = row ? row.provision.ref : 'Section 35';
    const name = row ? row.name : 'Unregistered / no microchips';
    return `
      <article class="mv-card">
        <div class="mv-card-top">
          <span class="vl-ref">${this.esc(section)}</span>
          <span class="mv-date">${this.esc(this.date(v.createdAt))}</span>
        </div>
        <h3 class="mv-name">${this.esc(name)}</h3>
        <p class="mv-reason">${this.esc(v.reason)}</p>
        <div class="mv-meta">
          <span class="mv-offense">${this.esc(window.nfcReminders.ordinal(v.offense))} offense</span>
          <b class="mv-fine">${this.esc(D ? D.peso(v.fine) : v.fine)}</b>
        </div>
      </article>`;
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
    const user = window.pawStore.getGoogleUser();
    if (!user || !user.name) {
      container.innerHTML = `
        <div class="view-header"><div class="view-title-group"><h1>Violations</h1></div></div>
        <div class="vl-empty">Sign in to see your violations.</div>`;
      return;
    }
    const R = window.nfcReminders;
    const list = R ? R.violations() : [];
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

    container.querySelectorAll('[data-link-pet]').forEach((btn) => {
      btn.addEventListener('click', () => R.linkNow(btn.dataset.linkPet));
    });
  }
}

window.myViolationsView = new MyViolationsView();
