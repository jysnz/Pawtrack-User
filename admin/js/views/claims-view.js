/**
 * PawTrack Admin: Claims
 * Owners claim an impounded animal from the owner app. This page lists the claims made on the animals this
 * facility holds (and its sub-facilities'). Accepting a claim tells the owner by email to come to the facility and
 * print the Digital NFC card shown in their My Pets page; rejecting it tells them the claim was not approved.
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

  render(container) {
    const store = window.adminStore;
    if (window.AdminNoFacility && store.currentAdmin() && !store.hasFacility()) {
      return window.AdminNoFacility.render(container, 'Claims', 'This page lists the claims owners make on the animals your facility holds.');
    }
    const claims = (store.getClaims ? store.getClaims() : []);
    const impounds = store.getImpoundments ? store.getImpoundments() : [];
    const byId = new Map(impounds.map((i) => [String(i.id), i]));
    const counts = { pending: 0, accepted: 0, rejected: 0 };
    claims.forEach((c) => { if (counts[c.status] != null) counts[c.status] += 1; });
    const shown = claims.filter((c) => this.filter === 'all' || c.status === this.filter);
    const tab = (key, label) => `<button type="button" class="chip ${this.filter === key ? 'active' : ''}" data-claim-filter="${key}">${label}${key !== 'all' ? ` <b>${counts[key]}</b>` : ` <b>${claims.length}</b>`}</button>`;

    const card = (c) => {
      const imp = byId.get(String(c.impoundId)) || {};
      const photo = /^https:\/\//.test(imp.photoUrl || '') ? imp.photoUrl : '';
      const pill = { pending: ['status-impounded', 'Waiting'], accepted: ['status-safe', 'Accepted'], rejected: ['status-lost', 'Rejected'] }[c.status] || ['', c.status];
      return `
        <article class="claim-card" data-claim="${this.esc(c.id)}">
          <div class="claim-pet">
            ${photo ? `<img src="${this.esc(photo)}" alt="" />` : '<span class="claim-pet-noimg"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.5c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-6 2c1.38 0 2.5-1.12 2.5-2.5S7.38 7.5 6 7.5 3.5 8.62 3.5 10s1.12 2.5 2.5 2.5zm12 0c1.38 0 2.5-1.12 2.5-2.5S19.38 7.5 18 7.5s-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zM12 12c-2.76 0-5 2.24-5 5 0 2.21 1.79 4 4 4 1.1 0 2-.9 2-2 0 1.1.9 2 2 2 2.21 0 4-1.79 4-4 0-2.76-2.24-5-5-5z"/></svg></span>'}
            <div>
              <b>${this.esc(imp.petName || 'Unidentified animal')}</b>
              <span>${this.esc([imp.species, imp.breed].filter(Boolean).join(' · ') || 'Animal')}</span>
              <span>${this.esc(imp.shelterName || '')}${imp.kennel || imp.cageNumber ? ' · ' + this.esc(imp.kennel || imp.cageNumber) : ''}</span>
            </div>
          </div>
          <div class="claim-who">
            <span class="claim-label">Claimed by</span>
            <b>${this.esc(c.name)}</b>
            <span>${this.esc(c.email)}</span>
            <span>${this.esc(c.phone || 'No phone given')}</span>
            ${c.message ? `<p class="claim-msg">${this.esc(c.message)}</p>` : '<p class="claim-msg is-empty">No message.</p>'}
            <span class="claim-when">Sent ${this.esc(this.ago(c.createdAt))}</span>
          </div>
          <div class="claim-decide">
            <span class="status-pill ${pill[0]}">${pill[1]}</span>
            ${c.status === 'pending' ? `
              <div class="claim-btns">
                <button type="button" class="btn btn-primary btn-sm" data-claim-accept="${this.esc(c.id)}">Accept</button>
                <button type="button" class="btn btn-secondary btn-sm" data-claim-reject="${this.esc(c.id)}">Reject</button>
              </div>` : `<span class="claim-when">${c.decidedAt ? this.esc(this.ago(c.decidedAt)) : ''}${c.status === 'rejected' && c.note ? ' · ' + this.esc(c.note) : ''}</span>`}
          </div>
        </article>`;
    };

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <div class="dash-eyebrow">Owners</div>
          <h1>Claims</h1>
          <div class="subtitle"><span>Owners who say an animal in your care is theirs. Accept or reject each claim; the owner is emailed the result.</span></div>
        </div>
      </div>
      <div class="claim-tabs" role="tablist">${tab('pending', 'Waiting')}${tab('accepted', 'Accepted')}${tab('rejected', 'Rejected')}${tab('all', 'All')}</div>
      <div class="claim-list">
        ${shown.length ? shown.map(card).join('') : `
          <div class="claim-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
            <b>${this.filter === 'pending' ? 'No claims waiting' : 'Nothing here'}</b>
            <span>${this.filter === 'pending' ? 'When an owner claims an animal in your care, it appears here.' : 'Claims with this status will be listed here.'}</span>
          </div>`}
      </div>`;

    container.querySelectorAll('[data-claim-filter]').forEach((b) => b.addEventListener('click', () => { this.filter = b.dataset.claimFilter; this.render(container); }));
    container.querySelectorAll('[data-claim-accept]').forEach((b) => b.addEventListener('click', () => this.decide(b.dataset.claimAccept, 'accepted', b)));
    container.querySelectorAll('[data-claim-reject]').forEach((b) => b.addEventListener('click', () => this.askReject(b.dataset.claimReject)));
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
        <button class="btn btn-secondary" id="claim-cancel">Cancel</button>
        <button class="btn btn-danger" id="claim-confirm">Reject claim</button>
      </div>`);
    modal.querySelector('#claim-x').addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#claim-cancel').addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#claim-confirm').addEventListener('click', async (e) => {
      const note = modal.querySelector('#claim-reason').value.trim();
      e.currentTarget.disabled = true;
      window.adminApp.closeModal();
      await this.decide(id, 'rejected', null, note);
    });
  },

  async decide(id, status, button, note) {
    const store = window.adminStore;
    const claim = store.getClaims().find((c) => c.id === id);
    if (button) button.disabled = true;
    const result = await store.decideClaim(id, status, note || '');
    if (!result.ok) { if (button) button.disabled = false; return; }
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
