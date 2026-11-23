/**
 * PawTrack Admin: Claims
 * Owners claim an impounded animal from the owner app. This page lists the claims made on the animals held by the
 * facility being viewed. Tapping a claim opens its details (the animal, the owner, the photo of the owner with the pet)
 * with the Accept and Reject buttons. The owner is emailed the result: accepted means "come to the facility and print
 * the Digital NFC card from My Pets", rejected means the claim was not approved.
 */
window.ClaimsView = {
  filter: 'pending', // 'pending' | 'accepted' | 'rejected' | 'all'

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  ago(value) {
    const t = new Date(value).getTime();
    if (!t) return '';
    const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  },

  when(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  },

  // Only the claims on animals held by the facility being viewed
  claimsHere() {
    const store = window.adminStore;
    const active = store.getActiveFacilityId ? store.getActiveFacilityId() : null;
    const byId = new Map((store.getImpoundments() || []).map((i) => [String(i.id), i]));
    return store.getClaims()
      .map((c) => ({ c, imp: byId.get(String(c.impoundId)) }))
      .filter((x) => x.imp && (!active || x.imp.shelterId === active));
  },

  safePhoto(url) { return /^https:\/\//.test(url || '') ? url : ''; },

  render(container) {
    const store = window.adminStore;
    this._container = container;
    if (window.AdminNoFacility && store.currentAdmin() && !store.hasFacility()) {
      return window.AdminNoFacility.render(container, 'Claims', 'This page lists the claims owners make on the animals your facility holds.');
    }
    const here = this.claimsHere();
    const facility = store.getActiveFacility ? store.getActiveFacility() : null;
    const counts = { pending: 0, accepted: 0, rejected: 0 };
    here.forEach(({ c }) => { if (counts[c.status] != null) counts[c.status] += 1; });
    const shown = here.filter(({ c }) => this.filter === 'all' || c.status === this.filter);
    const tab = (key, label, n) => `<button type="button" class="clm-tab ${this.filter === key ? 'is-active' : ''}" data-claim-filter="${key}">${label}<b>${n}</b></button>`;
    const stat = (n, label, tone) => `<div class="clm-stat ${tone}"><b>${n}</b><span>${label}</span></div>`;
    const pill = { pending: ['is-wait', 'Waiting for you'], accepted: ['is-ok', 'Accepted'], rejected: ['is-no', 'Rejected'] };

    const row = ({ c, imp }) => {
      const photo = this.safePhoto(imp.photoUrl);
      const p = pill[c.status] || ['', c.status];
      return `
        <button type="button" class="clm-row ${c.status === 'pending' ? 'is-new' : ''}" data-claim-open="${this.esc(c.id)}" aria-label="Open the claim on ${this.esc(imp.petName || 'the animal')} by ${this.esc(c.name)}">
          <span class="clm-thumb">${photo ? `<img src="${this.esc(photo)}" alt="" loading="lazy" />` : '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 10.5c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-6 2c1.38 0 2.5-1.12 2.5-2.5S7.38 7.5 6 7.5 3.5 8.62 3.5 10s1.12 2.5 2.5 2.5zm12 0c1.38 0 2.5-1.12 2.5-2.5S19.38 7.5 18 7.5s-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zM12 12c-2.76 0-5 2.24-5 5 0 2.21 1.79 4 4 4 1.1 0 2-.9 2-2 0 1.1.9 2 2 2 2.21 0 4-1.79 4-4 0-2.76-2.24-5-5-5z"/></svg>'}</span>
          <span class="clm-main">
            <b>${this.esc(imp.petName || 'Unidentified animal')}</b>
            <span>${this.esc([imp.species, imp.breed].filter(Boolean).join(' · ') || 'Animal')}${imp.kennel || imp.cageNumber ? ' · ' + this.esc(imp.kennel || imp.cageNumber) : ''}</span>
          </span>
          <span class="clm-who"><span class="clm-label">Claimed by</span><b>${this.esc(c.name)}</b><span>${this.esc(this.ago(c.createdAt))}</span></span>
          ${c.photo ? '<span class="clm-has-photo" title="Photo with the pet attached"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span>' : '<span></span>'}
          <span class="clm-pill ${p[0]}">${p[1]}</span>
          <svg class="clm-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>`;
    };

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <div class="dash-eyebrow">${this.esc(facility ? facility.name : 'Owners')}</div>
          <h1>Claims</h1>
          <div class="subtitle"><span>Owners who say an animal held here is theirs. Tap a claim to review it; the owner is emailed the result.</span></div>
        </div>
      </div>
      <div class="clm-stats">
        ${stat(counts.pending, 'Waiting for a decision', 'is-wait')}
        ${stat(counts.accepted, 'Accepted', 'is-ok')}
        ${stat(counts.rejected, 'Rejected', 'is-no')}
      </div>
      <div class="clm-tabs" role="tablist" aria-label="Claim status">${tab('pending', 'Waiting', counts.pending)}${tab('accepted', 'Accepted', counts.accepted)}${tab('rejected', 'Rejected', counts.rejected)}${tab('all', 'All', here.length)}</div>
      <div class="clm-list">
        ${shown.length ? shown.map(row).join('') : `
          <div class="clm-empty">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
            <b>${this.filter === 'pending' ? 'No claims waiting' : 'Nothing here'}</b>
            <span>${this.filter === 'pending' ? 'When an owner claims an animal held by this facility, it appears here.' : 'Claims with this status will be listed here.'}</span>
          </div>`}
      </div>`;

    container.querySelectorAll('[data-claim-filter]').forEach((b) => b.addEventListener('click', () => { this.filter = b.dataset.claimFilter; this.render(container); }));
    container.querySelectorAll('[data-claim-open]').forEach((b) => b.addEventListener('click', () => this.openClaim(b.dataset.claimOpen)));
  },

  // The claim's details: the animal, the owner, the photo they sent, and the decision
  openClaim(id) {
    const store = window.adminStore;
    const found = this.claimsHere().find(({ c }) => c.id === id);
    if (!found) return;
    const { c, imp } = found;
    const photo = this.safePhoto(imp.photoUrl);
    const decided = c.status !== 'pending';
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Claim on ${this.esc(imp.petName || 'an animal')}</div>
        <button class="icon-btn-subtle" id="clm-x" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body clm-modal">
        <div class="clm-compare">
          <figure>
            ${photo ? `<img src="${this.esc(photo)}" alt="The animal" />` : '<div class="clm-noimg">No photo</div>'}
            <figcaption>The animal held here</figcaption>
          </figure>
          <figure>
            ${c.photo ? `<img src="${this.esc(c.photo)}" alt="The owner with the pet" />` : '<div class="clm-noimg">No photo was added</div>'}
            <figcaption>${this.esc(c.name)} with the pet</figcaption>
          </figure>
        </div>
        <dl class="clm-facts">
          <div><dt>Animal</dt><dd>${this.esc([imp.petName || 'Unidentified', imp.species, imp.breed].filter(Boolean).join(' · '))}</dd></div>
          <div><dt>Kennel</dt><dd>${this.esc(imp.kennel || imp.cageNumber || 'Not set')}</dd></div>
          <div><dt>Claimed by</dt><dd>${this.esc(c.name)}</dd></div>
          <div><dt>Email</dt><dd>${this.esc(c.email)}</dd></div>
          <div><dt>Phone</dt><dd>${this.esc(c.phone || 'Not given')}</dd></div>
          <div><dt>Sent</dt><dd>${this.esc(this.when(c.createdAt))}</dd></div>
          ${decided ? `<div><dt>${c.status === 'accepted' ? 'Accepted' : 'Rejected'}</dt><dd>${this.esc(this.when(c.decidedAt))}</dd></div>` : ''}
          ${decided && c.status === 'rejected' && c.note ? `<div><dt>Reason</dt><dd>${this.esc(c.note)}</dd></div>` : ''}
        </dl>
        ${c.message ? `<p class="clm-msg"><b>How they know it is theirs</b>${this.esc(c.message)}</p>` : ''}
        ${c.status === 'rejected' ? '' : ''}
      </div>
      <div class="modal-footer">
        ${decided
          ? '<button class="btn btn-secondary" id="clm-close">Close</button>'
          : '<button class="btn btn-secondary" id="clm-reject">Reject</button><button class="btn btn-primary" id="clm-accept">Accept claim</button>'}
      </div>`);
    modal.querySelector('#clm-x').addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#clm-close')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#clm-reject')?.addEventListener('click', () => this.askReject(id));
    modal.querySelector('#clm-accept')?.addEventListener('click', (e) => { e.currentTarget.disabled = true; window.adminApp.closeModal(); this.decide(id, 'accepted'); });
    modal.querySelectorAll('.clm-compare img').forEach((img) => img.addEventListener('click', () => window.open(img.src, '_blank', 'noopener')));
  },

  // A reason is optional but goes into the owner's email
  askReject(id) {
    const claim = window.adminStore.getClaims().find((c) => c.id === id);
    if (!claim) return;
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Reject this claim?</div>
        <button class="icon-btn-subtle" id="claim-x" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size:12.5px; color:var(--ink-muted); margin:0 0 12px; line-height:1.5;">${this.esc(claim.name)} will be emailed that the claim was not approved. You can add a reason for them.</p>
        <div class="form-group form-full">
          <label class="form-label" for="claim-reason">Reason <span style="font-weight:500;color:var(--ink-muted);">(optional)</span></label>
          <textarea class="form-control" id="claim-reason" rows="3" maxlength="300" placeholder="e.g. The description does not match the animal."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="claim-cancel">Back</button>
        <button class="btn btn-danger" id="claim-confirm">Reject claim</button>
      </div>`);
    modal.querySelector('#claim-x').addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#claim-cancel').addEventListener('click', () => this.openClaim(id));
    modal.querySelector('#claim-confirm').addEventListener('click', async (e) => {
      const note = modal.querySelector('#claim-reason').value.trim();
      e.currentTarget.disabled = true;
      window.adminApp.closeModal();
      await this.decide(id, 'rejected', note);
    });
  },

  async decide(id, status, note) {
    const store = window.adminStore;
    const claim = store.getClaims().find((c) => c.id === id);
    // The row leaves the "Waiting" tab once decided: let it slide out first instead of vanishing
    const row = this.filter === 'pending' ? document.querySelector(`[data-claim-open="${CSS.escape(id)}"]`) : null;
    const reduced = window.AdminMotion && window.AdminMotion.reducedMotion && window.AdminMotion.reducedMotion();
    if (row && !reduced) {
      row.classList.add('is-leaving');
      await new Promise((r) => setTimeout(r, 170));
    }
    const result = await store.decideClaim(id, status, note || '');
    if (!result.ok) { if (row) row.classList.remove('is-leaving'); return; }
    const accepted = status === 'accepted';
    window.adminApp.showDialog({
      tone: accepted ? 'success' : 'info',
      title: accepted ? 'Claim accepted' : 'Claim rejected',
      message: result.emailed
        ? `${claim ? claim.name : 'The owner'} was emailed the result.${accepted ? ' They will print their Digital NFC card and come to the facility.' : ''}`
        : `The decision was saved, but the email to ${claim ? claim.name : 'the owner'} could not be sent. Contact them directly.`,
      rows: [['Owner', claim && claim.name], ['Email', claim && claim.email]],
      actions: [{ label: 'Done', primary: true }]
    });
  }
};
