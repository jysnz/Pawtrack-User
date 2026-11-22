/**
 * PawTrack Admin — Facilities
 * The facilities this account owns or works at: its main facility (or facilities) and their sub-facilities.
 * Managers of a main facility add main and sub facilities from here; each row can be edited and has its team.
 */

window.SheltersView = {
  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // The facilities this account owns (its own, and for a main facility its sub-facilities), main ones first
  // with their sub-facilities right after them. `mine` marks the facility this account belongs to.
  collect() {
    const store = window.adminStore;
    const ids = typeof store.getMyFacilityIds === 'function' ? store.getMyFacilityIds() : [];
    const mineId = store.myShelterId();
    const all = store.getShelters();
    const holding = store.getImpoundments().filter(i => i.status === 'active_impounded');
    const own = all.filter(s => ids.includes(s.id) || (!!mineId && s.id === mineId));
    const byName = (a, b) => String(a.name).localeCompare(String(b.name));
    const decorate = (s) => ({ ...s, mine: !!mineId && s.id === mineId, sub: !!s.parentId, parentName: s.parentId ? ((all.find(p => p.id === s.parentId) || {}).name || '') : '', holding: holding.filter(i => i.shelterId === s.id).length });
    const mains = own.filter(s => !s.parentId).sort(byName);
    const subs = own.filter(s => s.parentId);
    return [
      ...mains.flatMap(m => [m, ...subs.filter(s => s.parentId === m.id).sort(byName)]),
      ...subs.filter(s => !mains.some(m => m.id === s.parentId)).sort(byName)
    ].map(decorate);
  },

  plus() {
    return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  },

  render(container) {
    const store = window.adminStore;
    const list = this.collect();
    const esc = (v) => this.esc(v);
    const member = store.hasFacility();
    const manager = store.isFacilityManager();
    const canAdd = manager && store.isMainFacility();
    const managed = typeof store.getManagedShelterIds === 'function' ? store.getManagedShelterIds() : [];
    const mainCount = list.filter(s => !s.sub).length;
    const subCount = list.length - mainCount;
    const subtitle = list.length
      ? [`${mainCount} main ${mainCount === 1 ? 'facility' : 'facilities'}`, subCount ? `${subCount} sub-${subCount === 1 ? 'facility' : 'facilities'}` : ''].filter(Boolean).join(' and ')
      : 'No facilities yet';

    const actions = !member
      ? `<button class="btn btn-secondary" id="btn-join-facility">Join with invite code</button>
         <button class="btn btn-primary" id="btn-add-facility">${this.plus()}Register your facility</button>`
      : manager
        ? (canAdd ? `<button class="btn btn-primary" id="btn-add-main">${this.plus()}Add facility</button>` : '')
        : '<button class="btn btn-secondary" id="btn-leave-facility">Leave facility</button>';

    // The facility whose pets were last opened (matches the sidebar chip)
    const viewingId = (store.getActiveFacilityId && store.getActiveFacilityId()) || '';
    const row = (s) => {
      const photo = /^https:\/\//.test(s.photoUrl || '') ? s.photoUrl : '';
      const cap = Number(s.capacity) || 0;
      const canManage = manager && managed.includes(s.id);
      const detail = [s.address, s.phone ? (window.FacilityForm ? window.FacilityForm.phone.format(s.phone) : s.phone) : ''].filter(Boolean).join(' · ');
      return `
        <div class="shm-frow ${s.sub ? 'is-sub' : ''} ${viewingId === s.id ? 'is-viewing' : ''}" data-id="${esc(s.id)}" role="link" tabindex="0" aria-label="Open the pets at ${esc(s.name)}"${viewingId === s.id ? ' aria-current="true"' : ''}>
          <span class="shm-frow-thumb ${photo ? '' : 'is-empty'}">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" />` : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>'}</span>
          <div class="shm-frow-main">
            ${s.sub ? `<small class="shm-frow-subtag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3v8a4 4 0 0 0 4 4h10"/><path d="m15 11 4 4-4 4"/></svg><span class="shm-subtag-text">Sub-facility of <strong>${esc(s.parentName || 'the main facility')}</strong></span></small>` : ''}
            <b>${esc(s.name)} <em class="${s.sub ? 'is-sub' : ''}">${s.sub ? 'Sub' : 'Main'}</em></b>
            <span class="shm-frow-addr">${esc(s.address || 'No address on file')}</span>
            ${s.sub && s.coverage && s.coverage.length ? `<span class="shm-frow-cover"><b>Covers:</b> ${esc(s.coverage.slice(0, 4).join(', '))}${s.coverage.length > 4 ? ` +${s.coverage.length - 4} more` : ''}</span>` : ''}
            ${s.phone ? `<span class="shm-frow-phone">${esc(window.FacilityForm ? window.FacilityForm.phone.format(s.phone) : s.phone)}</span>` : ''}
          </div>
          <div class="shm-frow-stat">
            <span><b>${s.holding}</b>${cap ? ` of ${cap}` : ''} in holding</span>
            ${cap ? `<i class="shm-frow-bar ${s.holding >= cap ? 'is-full' : s.holding / cap >= 0.8 ? 'is-high' : ''}" aria-hidden="true"><u style="width:${Math.min(100, Math.round((s.holding / cap) * 100))}%"></u></i>` : ''}
          </div>
          <svg class="shm-frow-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          <div class="shm-frow-actions">
            ${canManage ? `<button type="button" class="btn btn-sm btn-secondary" data-team="${esc(s.id)}">Team &amp; code</button><button type="button" class="btn btn-sm btn-secondary shm-ico" data-edit="${esc(s.id)}" title="Edit ${esc(s.name)}" aria-label="Edit ${esc(s.name)}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button><button type="button" class="btn btn-sm btn-secondary shm-ico shm-del" data-del="${esc(s.id)}" title="Delete ${esc(s.name)}" aria-label="Delete ${esc(s.name)}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>` : ''}
          </div>
        </div>`;
    };

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Facilities</h1>
          <div class="subtitle"><span>${esc(subtitle)}</span></div>
        </div>
        <div class="view-header-actions" id="shm-actions">${actions}</div>
      </div>
      <div id="shm-note">${member ? this.subNote(store) : `<div class="shm-note"><b>You are not part of a facility yet.</b> Register your impound facility and you become its manager, or join your colleagues' facility with the invite code your manager shares. Then you can log intakes from Impoundments.</div>`}</div>
      <div class="shm-fgroups" aria-label="Your facilities">
        ${list.length ? list.reduce((groups, s) => { if (!s.sub || !groups.length) groups.push([]); groups[groups.length - 1].push(s); return groups; }, []).map(g => `<div class="nock-card shm-flist">${g.map(row).join('')}</div>`).join('') : `
          <section class="nofac nofac-inline" aria-labelledby="shm-empty-title">
            <div class="nofac-mark" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/><path d="M12 9v2"/></svg></div>
            <h2 class="nofac-title" id="shm-empty-title">No facilities yet</h2>
            <p class="nofac-sub">${member ? 'Facilities you add will appear here, with their sub-facilities underneath.' : 'Facilities appear here once you register yours or join a team. Each one gets its own pets, map and claims.'}</p>
            ${member ? '' : `<div class="nofac-options">
              <article class="nofac-option"><span class="nofac-option-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span><h3>Register a facility</h3><p>You are the first from your team. Add its name, address, area and official email.</p><button type="button" class="btn btn-primary btn-sm" data-empty-act="register">Register facility</button></article>
              <article class="nofac-option"><span class="nofac-option-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><h3>Join your team</h3><p>Ask your facility manager for the invite code and enter it here.</p><button type="button" class="btn btn-secondary btn-sm" data-empty-act="join">Join with a code</button></article>
            </div>`}
          </section>`}
      </div>`;

    container.querySelectorAll('[data-empty-act]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.emptyAct === 'join') this.openJoinModal(); else this.openShelterModal(null);
    }));
    container.querySelector('#btn-add-facility')?.addEventListener('click', () => this.openShelterModal(null));
    container.querySelector('#btn-join-facility')?.addEventListener('click', () => this.openJoinModal());
    // One dialog for both kinds: a checkbox says whether the new facility is a sub-facility, and of which main facility
    container.querySelector('#btn-add-main')?.addEventListener('click', () => this.openShelterModal(null, { chooseType: true }));
    container.querySelector('#btn-leave-facility')?.addEventListener('click', async () => {
      const ok = await window.adminApp.confirmDialog({ title: 'Leave your facility?', message: 'You will lose access to its impoundments until you join again.', confirmLabel: 'Leave facility', danger: true });
      if (ok && await store.leaveFacility()) window.adminApp.showToast('You left the facility.', 'info');
    });
    // A facility opens its pets on the Impoundments page
    container.querySelectorAll('.shm-frow').forEach(r => {
      const open = () => {
        const f = list.find(x => x.id === r.getAttribute('data-id'));
        if (f && window.ImpoundmentsView) window.ImpoundmentsView.showFacility(f.id, f.holding > 0 ? 'active' : 'all');
      };
      r.addEventListener('click', (e) => { if (!e.target.closest('button')) open(); });
      r.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); open(); } });
    });
    container.querySelectorAll('[data-team]').forEach(b => b.addEventListener('click', () => {
      const s = list.find(x => x.id === b.getAttribute('data-team'));
      if (s) this.openTeamModal(s.id, s.name);
    }));
    container.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const s = list.find(x => x.id === b.getAttribute('data-del'));
      if (s) this.openDeleteModal(s);
    }));
    container.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
      const s = list.find(x => x.id === b.getAttribute('data-edit'));
      if (s) this.openShelterModal(s);
    }));
  },

  // Deleting a facility: first say what it affects (or what blocks it), then require a typed phrase
  async openDeleteModal(facility) {
    const store = window.adminStore;
    const esc = (v) => this.esc(v);
    if (!store.getManagedShelterIds().includes(facility.id)) {
      window.adminApp.showToast('Only the facility manager can delete a facility.', 'warning');
      return;
    }
    const kind = facility.sub ? 'sub-facility' : 'facility';
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Delete ${kind}</div>
        <button class="icon-btn-subtle" id="del-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body" id="del-body"><div class="shm-list-empty">Checking ${esc(facility.name)}…</div></div>
      <div class="modal-footer" id="del-foot"><button class="btn btn-secondary" id="del-cancel-btn">Cancel</button></div>
    `);
    const close = () => window.adminApp.closeModal();
    modal.querySelector('#del-close-btn')?.addEventListener('click', close);
    modal.querySelector('#del-cancel-btn')?.addEventListener('click', close);

    const info = await store.facilityDeletePreview(facility.id);
    if (!info) { close(); return; }
    const n = (v) => Number(v) || 0;
    const plural = (c, one, many) => `${c} ${c === 1 ? one : many}`;
    const body = modal.querySelector('#del-body');
    const foot = modal.querySelector('#del-foot');

    const blockers = [
      n(info.in_holding) && `${plural(n(info.in_holding), 'animal is', 'animals are')} still in holding here. Release, claim or move ${n(info.in_holding) === 1 ? 'it' : 'them'} first.`,
      n(info.pending_transfers) && `${plural(n(info.pending_transfers), 'transfer is', 'transfers are')} waiting to be confirmed. Settle ${n(info.pending_transfers) === 1 ? 'it' : 'them'} first.`,
      n(info.unpaid_tickets) && `${plural(n(info.unpaid_tickets), 'penalty ticket is', 'penalty tickets are')} unpaid. Collect or waive ${n(info.unpaid_tickets) === 1 ? 'it' : 'them'} first.`
    ].filter(Boolean);

    if (blockers.length) {
      body.innerHTML = `
        <div class="del-box is-blocked" role="alert">
          <b>${esc(info.name)} can't be deleted yet</b>
          <ul>${blockers.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>`;
      foot.innerHTML = '<button class="btn btn-secondary" id="del-ok-btn">Close</button>';
      foot.querySelector('#del-ok-btn')?.addEventListener('click', close);
      return;
    }

    const phrase = `delete ${info.name}`;
    const norm = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const effects = [
      `<b>${esc(info.name)}</b>, its invite code and its settings are permanently deleted.`,
      n(info.sub_facilities) && `${plural(n(info.sub_facilities), 'sub-facility', 'sub-facilities')} (${(info.subs || []).map(esc).join(', ')}) will not be deleted. ${n(info.sub_facilities) === 1 ? 'It becomes a main facility' : 'They become main facilities'}, and you keep managing ${n(info.sub_facilities) === 1 ? 'it' : 'them'}.`,
      n(info.past_records) && `${plural(n(info.past_records), 'finished impound record', 'finished impound records')} of this ${kind}, with their penalty tickets, are deleted too.`,
      n(info.members) && `${plural(n(info.members), 'team member', 'team members')} will no longer belong to it${info.is_sub ? '' : ' and can join or register a facility again'}.`,
      'This cannot be undone.'
    ].filter(Boolean);
    body.innerHTML = `
      <div class="del-box" role="alert">
        <b>Delete ${esc(info.name)}?</b>
        <ul>${effects.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
      <label class="form-label" for="del-phrase" style="margin-top:16px;display:block;">To confirm, type <code class="del-phrase">${esc(phrase)}</code></label>
      <input type="text" class="form-control" id="del-phrase" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(phrase)}" aria-describedby="del-hint" />
      <p class="trm-opt" id="del-hint" style="margin:6px 0 0;">Capital letters and extra spaces don't matter.</p>`;
    foot.innerHTML = `<button class="btn btn-secondary" id="del-cancel-btn">Cancel</button>
      <button class="btn btn-delete" id="del-go-btn" disabled>Delete ${kind}</button>`;
    foot.querySelector('#del-cancel-btn')?.addEventListener('click', close);

    const input = body.querySelector('#del-phrase');
    const go = foot.querySelector('#del-go-btn');
    input.addEventListener('input', () => { go.disabled = norm(input.value) !== norm(phrase); });
    const run = async () => {
      if (go.disabled) return;
      go.disabled = true; input.disabled = true; go.textContent = 'Deleting…';
      const done = await store.deleteFacility(facility.id);
      if (!done) { input.disabled = false; go.textContent = `Delete ${kind}`; go.disabled = norm(input.value) !== norm(phrase); return; }
      close();
      window.adminApp.showToast(`Deleted "${info.name}".`, 'success');
      window.adminApp.renderView('shelters');
    };
    go.addEventListener('click', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    input.focus({ preventScroll: true });
  },

  // Join an existing facility with the invite code its manager shares (you join as staff)
  openJoinModal(opts = {}) {
    const store = window.adminStore;
    if (store.hasFacility()) {
      window.adminApp.showToast('Your account already belongs to a facility.', 'warning');
      return;
    }

    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Join your facility</div>
        <button class="icon-btn-subtle" id="join-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 12px; color: var(--ink-muted); margin-bottom: 12px; line-height: 1.5;">Ask your facility's manager for the invite code (Shelters &rarr; Team &amp; invite code) and enter it here. You will join as staff and work with the facility's impoundments.</p>
        <form id="join-form" class="form-grid">
          <div class="form-group form-full">
            <label class="form-label" for="join-code">Invite code</label>
            <input type="text" class="form-control" id="join-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16" required placeholder="e.g. 3F9A1C7B2D" style="font-family: var(--font-mono); letter-spacing: 0.12em; text-transform: uppercase;" />
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="join-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="join-submit-btn">Join facility</button>
      </div>
    `);

    const form = modal.querySelector('#join-form');
    const submit = modal.querySelector('#join-submit-btn');
    modal.querySelector('#join-close-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#join-cancel-btn')?.addEventListener('click', () => window.adminApp.closeModal());

    const join = async () => {
      if (!form.checkValidity()) { form.reportValidity(); return; }
      submit.disabled = true;
      submit.textContent = 'Joining…';
      const ok = await store.joinFacility(new FormData(form).get('code'), (id) => {
      });
      if (!ok) {
        submit.disabled = false;
        submit.textContent = 'Join facility';
        return;
      }
      window.adminApp.closeModal();
      window.adminApp.showToast('You joined the facility as staff.', 'success');
      if (typeof opts.onJoined === 'function') opts.onJoined();
    };
    submit.addEventListener('click', join);
    form.addEventListener('submit', (e) => { e.preventDefault(); join(); });
  },

  // A sub-facility employee is told where uncollected pets go
  subNote(store) {
    const main = store.getMainFacility();
    return main ? `<div class="shm-note is-info"><b>You work in a sub-facility of ${this.esc(main.name)}.</b> You manage only this sub-facility's pets. A pet nobody collects within its holding window is moved to ${this.esc(main.name)}, which confirms when it arrives.</div>` : '';
  },

  // Main facility manager: the sub-facilities, their invite codes and employees
  openSubFacilitiesModal() {
    const store = window.adminStore;
    const esc = (v) => this.esc(v);
    if (!(store.isFacilityManager() && store.isMainFacility())) {
      window.adminApp.showToast('Only the main facility\'s manager can manage sub-facilities.', 'warning');
      return;
    }
    const subs = store.getSubFacilities();
    const holding = store.getImpoundments().filter(i => i.status === 'active_impounded');
    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Sub-facilities</div>
        <button class="icon-btn-subtle" id="subs-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 12px; color: var(--ink-muted); margin-bottom: 12px; line-height: 1.5;">A sub-facility is a smaller shelter that belongs to ${esc((store.getMyShelter() || {}).name || 'your facility')}. Its employees join with the sub-facility's own invite code and manage only its pets. Pets nobody collects within the holding window move here, and you confirm when they arrive.</p>
        ${subs.length ? `<div class="shm-subs">${subs.map(sf => `
          <div class="shm-sub-row" data-id="${esc(sf.id)}">
            <div class="shm-team-who">
              <b>${esc(sf.name)}</b>
              <span>${store.getMainFacilities().length > 1 ? esc(((store.getShelters().find(p => p.id === sf.parentId)) || {}).name || '') + ' · ' : ''}${esc(sf.address || 'No address')} · ${holding.filter(i => i.shelterId === sf.id).length} in holding</span>
            </div>
            <div class="shm-team-actions">
              <button class="btn btn-sm btn-secondary" data-sub-team="${esc(sf.id)}">Team &amp; code</button>
              <button class="btn btn-sm btn-secondary" data-sub-edit="${esc(sf.id)}">Edit</button>
            </div>
          </div>`).join('')}</div>` : '<div class="shm-list-empty">No sub-facilities yet.</div>'}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="subs-done-btn">Done</button>
        <button class="btn btn-primary" id="subs-add-btn">Add a sub-facility</button>
      </div>`);
    modal.querySelector('#subs-close-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#subs-done-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#subs-add-btn')?.addEventListener('click', () => this.openShelterModal(null, { asSub: true, onCreated: () => this.openSubFacilitiesModal() }));
    modal.querySelectorAll('[data-sub-team]').forEach(b => b.addEventListener('click', () => {
      const sf = subs.find(x => x.id === b.getAttribute('data-sub-team'));
      if (sf) this.openTeamModal(sf.id, sf.name);
    }));
    modal.querySelectorAll('[data-sub-edit]').forEach(b => b.addEventListener('click', () => {
      const sf = subs.find(x => x.id === b.getAttribute('data-sub-edit'));
      if (sf) this.openShelterModal(sf);
    }));
  },

  // Manager: the invite code, and who is on the team (of their facility, or of one of its sub-facilities)
  async openTeamModal(shelterId, shelterName) {
    const store = window.adminStore;
    const esc = (v) => this.esc(v);
    if (!store.isFacilityManager() || (shelterId && !store.getManagedShelterIds().includes(shelterId))) {
      window.adminApp.showToast('Only the facility manager can manage the team.', 'warning');
      return;
    }

    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title">Team &amp; invite code${shelterName ? ' · ' + esc(shelterName) : ''}</div>
        <button class="icon-btn-subtle" id="team-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body" id="team-body"><div class="shm-list-empty">Loading your team…</div></div>
      <div class="modal-footer"><button class="btn btn-secondary" id="team-done-btn">Done</button></div>
    `);
    modal.querySelector('#team-close-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#team-done-btn')?.addEventListener('click', () => window.adminApp.closeModal());

    const me = store.currentAdminId();
    const body = modal.querySelector('#team-body');

    const draw = async () => {
      const [team, code] = await Promise.all([store.getFacilityTeam(shelterId), store.getInviteCode(shelterId)]);
      const managers = team.filter(m => m.facility_role === 'manager').length;
      body.innerHTML = `
        <div class="shm-invite">
          <div>
            <span class="form-label">Invite code</span>
            <code id="invite-code">${esc(code || 'Not available')}</code>
            <small>Approved admins who enter this code join as staff. Create a new code to stop the old one working.</small>
          </div>
          <div class="shm-invite-actions">
            <button class="btn btn-sm btn-secondary" id="copy-code" ${code ? '' : 'disabled'}>Copy</button>
            <button class="btn btn-sm btn-secondary" id="new-code">New code</button>
          </div>
        </div>
        <div class="shm-team-title">Team (${team.length})</div>
        <div class="shm-team">
          ${team.map(m => {
            const self = m.id === me;
            const isManager = m.facility_role === 'manager';
            return `
              <div class="shm-team-row" data-id="${esc(m.id)}">
                <div class="shm-team-who">
                  <b>${esc(m.full_name)}${self ? ' <em>You</em>' : ''}</b>
                  <span>${esc([m.position, m.email].filter(Boolean).join(' · '))}</span>
                </div>
                <span class="shm-role ${isManager ? 'is-manager' : ''}">${isManager ? 'Manager' : 'Staff'}</span>
                <div class="shm-team-actions">
                  ${isManager
                    ? (self && managers < 2 ? '' : `<button class="btn btn-sm btn-secondary" data-act="staff">Make staff</button>`)
                    : `<button class="btn btn-sm btn-secondary" data-act="manager">Make manager</button>`}
                  ${self ? '' : `<button class="btn btn-sm btn-danger" data-act="remove">Remove</button>`}
                </div>
              </div>`;
          }).join('')}
        </div>`;
    };

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'copy-code') {
        const code = body.querySelector('#invite-code')?.textContent || '';
        try { await navigator.clipboard.writeText(code); window.adminApp.showToast('Invite code copied.', 'success', 1600); }
        catch (err) { window.adminApp.showToast('Select the code and copy it manually.', 'warning'); }
      } else if (btn.id === 'new-code') {
        const ok = await window.adminApp.confirmDialog({ title: 'Create a new invite code?', message: 'The current code stops working right away. Anyone who has not joined yet will need the new one.', confirmLabel: 'Create new code' });
        if (ok && await store.rotateInvite(shelterId)) { window.adminApp.showToast('New invite code created.', 'success', 1800); draw(); }
      } else if (btn.dataset.act) {
        const row = btn.closest('.shm-team-row');
        const id = row && row.getAttribute('data-id');
        const name = row ? row.querySelector('b').firstChild.textContent.trim() : 'this person';
        let done = false;
        if (btn.dataset.act === 'remove') {
          const ok = await window.adminApp.confirmDialog({ title: `Remove ${name}?`, message: 'They lose access to this facility\'s impoundments right away. They can rejoin with an invite code.', confirmLabel: 'Remove', danger: true });
          if (ok) done = await store.removeStaff(id);
        } else {
          done = await store.setStaffRole(id, btn.dataset.act);
        }
        if (done) draw();
      }
    });

    draw();
  },

  // Register the admin's facility (initial = null) or edit it (initial = their facility).
  // Where it is comes from a pin on the map; the address is typed, or filled in from the pin.
  openShelterModal(initial = null, opts = {}) {
    const store = window.adminStore;
    const FF = window.FacilityForm;
    const esc = (v) => this.esc(v);
    const isEdit = !!initial;
    const chooseType = !!opts.chooseType && !isEdit;   // one dialog for both: a checkbox says whether it is a sub-facility
    const asSub = !!opts.asSub && !isEdit;
    const asMain = (!!opts.asMain || chooseType) && !isEdit && !asSub;
    const mains = store.getMainFacilities();
    // Edit: a manager can switch the facility between main and sub-facility
    const hasKids = isEdit && store.getShelters().some(x => x.parentId === initial.id);
    const retypeMains = isEdit ? mains.filter(m => m.id !== initial.id) : [];
    const retype = isEdit && store.getManagedShelterIds().includes(initial.id);
    const retypeBlock = !initial || !retype ? '' : (hasKids
      ? 'Move or delete its sub-facilities first.'
      : (!initial.parentId && !retypeMains.length ? 'Add another main facility first.' : ''));
    const submitLabel = isEdit ? 'Save changes' : chooseType ? 'Add main facility' : asSub ? 'Add sub-facility' : asMain ? 'Add main facility' : 'Register facility';

    if (asSub && !(store.isFacilityManager() && store.isMainFacility())) {
      window.adminApp.showToast('Only the main facility\'s manager can add a sub-facility.', 'warning');
      return;
    }
    if (asMain && !(store.isFacilityManager() && store.isMainFacility())) {
      window.adminApp.showToast('Only the manager of a main facility can add another main facility.', 'warning');
      return;
    }
    if (!isEdit && !asSub && !asMain && store.hasFacility()) {
      window.adminApp.showToast('Your account already belongs to a facility.', 'warning');
      return;
    }
    if (isEdit && !(store.isFacilityManager() && store.getManagedShelterIds().includes(initial.id))) {
      window.adminApp.showToast('Only the facility manager can edit its details.', 'warning');
      return;
    }

    const types = [
      'Municipal LGU Pound', 'Municipal LGU Facility', 'Non-Profit Animal Welfare Sanctuary', 'Non-Profit Rescue Clinic & Sanctuary',
      'Animal Welfare Hospital & Sanctuary', 'Spay/Neuter & Animal Welfare Center', 'Private Animal Rescue Sanctuary'
    ];
    const currentType = (initial && initial.type) || types[0];
    // A type that is not in the list (typed in earlier via "Others") opens in the text field
    const customType = !types.includes(currentType);
    const val = (key, fallback = '') => esc(initial && initial[key] != null && initial[key] !== '' ? initial[key] : fallback);

    const hasPin = !!initial && Number.isFinite(+initial.lat) && Number.isFinite(+initial.lng);
    const parsedHours = initial ? FF.hours.parse(initial.hours) : null;
    const legacyHours = initial && initial.hours && !parsedHours ? initial.hours : '';
    const phoneDigits = initial ? FF.phone.digits(initial.phone) : '';

    const modal = window.adminApp.openModalContent(`
      <div class="modal-header">
        <div class="nock-card-title" id="fm-title">${isEdit ? (initial.parentId ? 'Edit sub-facility' : 'Edit your facility') : chooseType ? 'Add a main facility' : asSub ? 'Add a sub-facility' : asMain ? 'Add another main facility' : 'Register your impound facility'}</div>
        <button class="icon-btn-subtle" id="shelter-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        ${isEdit ? '' : chooseType ? '' : asMain ? '<p style="font-size: 12px; color: var(--ink-muted); margin-bottom: 12px; line-height: 1.5;">A main facility is a facility of its own, with its own invite code and its own sub-facilities. You will manage it alongside the ones you already run.</p>' : asSub ? '<p style="font-size: 12px; color: var(--ink-muted); margin-bottom: 12px; line-height: 1.5;">A sub-facility belongs to your facility. Its employees join with their own invite code and manage only its pets. Pets nobody collects within the holding window move to your facility.</p>' : '<p style="font-size: 12px; color: var(--ink-muted); margin-bottom: 12px; line-height: 1.5;">You will be this facility\'s manager. Your colleagues can then join it with an invite code, and every intake and impoundment is recorded against it. Each account belongs to one facility.</p>'}
        <form id="shelter-form" class="form-grid" novalidate>
          <div class="form-group form-full">
            <label class="form-label">Facility name *</label>
            <input type="text" class="form-control" name="name" value="${val('name')}" placeholder="e.g. Quezon City Animal Care & Adoption Facility" required />
          </div>
          ${retype ? `<div class="form-group form-full fm-type">
            <label class="fm-check" for="fm-is-sub"><input type="checkbox" id="fm-is-sub" name="isSub" ${initial.parentId ? 'checked' : ''} ${retypeBlock && !initial.parentId ? 'disabled' : ''} /><span><b>This is a sub-facility</b><small>${retypeBlock && !initial.parentId ? esc(retypeBlock) : initial.parentId ? 'Untick to make it a main facility of its own. You keep managing it.' : 'Tick to move it under one of your other main facilities.'}</small></span></label>
            <div class="fm-type-parent" id="fm-parent-wrap" ${initial.parentId ? '' : 'hidden'}>
              <label class="form-label" for="fm-parent">Main facility of this sub-facility *</label>
              <select class="form-control" id="fm-parent" name="parentId"><option value="">Select the main facility</option>${(initial.parentId ? mains : retypeMains).map(m => `<option value="${esc(m.id)}" ${initial.parentId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
            </div>
          </div>` : ''}
          ${chooseType ? `<div class="form-group form-full fm-type">
            <label class="fm-check" for="fm-is-sub"><input type="checkbox" id="fm-is-sub" name="isSub" /><span><b>This is a sub-facility</b><small>Leave this unchecked to add a main facility. A sub-facility belongs to one of your main facilities.</small></span></label>
            <div class="fm-type-parent" id="fm-parent-wrap" hidden>
              <label class="form-label" for="fm-parent">Main facility of this sub-facility *</label>
              <select class="form-control" id="fm-parent" name="parentId"><option value="">Select the main facility</option>${mains.map(m => `<option value="${esc(m.id)}" ${mains.length === 1 ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
            </div>
          </div>` : ''}
          <div class="form-group form-full">
            <label class="form-label">Facility photo <span class="fm-sub">${isEdit ? '' : 'recommended'}</span></label>
            ${window.FacilityPhoto.fieldHtml(initial && initial.photoUrl)}
          </div>
          ${asSub && mains.length > 1 ? `<div class="form-group form-full">
            <label class="form-label">Belongs to main facility *</label>
            <select class="form-control" name="parentId" required>${mains.map(m => `<option value="${esc(m.id)}" ${opts.parentId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
          </div>` : ''}
          <div class="form-group">
            <label class="form-label">Facility type</label>
            <select class="form-control" name="type" id="fm-type" ${customType ? 'hidden disabled' : ''}>
              ${types.map(t => `<option value="${esc(t)}" ${t === currentType ? 'selected' : ''}>${esc(t)}</option>`).join('')}
              <option value="__other__">Others…</option>
            </select>
            <div class="fm-address-row" id="fm-type-other-wrap" ${customType ? '' : 'hidden'}>
              <input type="text" class="form-control" id="fm-type-other" name="typeOther" maxlength="80" value="${customType ? esc(currentType) : ''}" placeholder="Type the facility type" autocomplete="off" ${customType ? 'required' : 'disabled'} />
              <button type="button" class="btn btn-secondary" id="fm-type-back">Back to list</button>
            </div>
          </div>
          <div class="form-group" id="fm-region-wrap">
            <label class="form-label" for="fm-region">Region *</label>
            <select class="form-control" id="fm-region" disabled><option value="">Loading regions…</option></select>
          </div>
          <div class="form-group form-full" id="fm-city-wrap">
            <label class="form-label" for="fm-city">City / municipality *</label>
            <input type="text" class="form-control" id="fm-city" name="city" value="${val('city')}" placeholder="Search for a city" autocomplete="off" required />
            <div class="fm-hint" id="fm-city-hint"></div>
          </div>
          <div class="form-group form-full" id="fm-coverage-wrap" hidden>
            <label class="form-label">Barangays covered * <span class="fm-sub">The areas inside the main facility's city that this sub-facility serves</span></label>
            <div class="fm-cov" id="fm-cov"></div>
            <div class="fm-hint" id="fm-cov-hint" aria-live="polite"></div>
          </div>

          <div class="form-group form-full">
            <label class="form-label" for="fm-paper-address">Address on paper ${isEdit ? '' : '*'} <span class="fm-sub">As it is written on the facility's official papers</span></label>
            <input type="text" class="form-control" id="fm-paper-address" name="paperAddress" value="${val('paperAddress')}" maxlength="300" placeholder="e.g. Unit 2, City Hall Compound, Elliptical Rd, Diliman, Quezon City 1100" autocomplete="off" ${isEdit ? '' : 'required'} />
          </div>
          <div class="form-group form-full">
            <label class="form-label" for="fm-address">Physical address *</label>
            <div class="fm-address-row">
              <input type="text" class="form-control" id="fm-address" name="address" value="${val('address')}" placeholder="House/building no., street, barangay, city" autocomplete="off" required />
              <button type="button" class="btn btn-secondary" id="fm-locate">Find on map</button>
            </div>
          </div>
          <div class="form-group form-full">
            <label class="form-label">Pin the facility on the map * <span class="fm-sub">Click the map or drag the pin to the exact spot</span></label>
            <div class="fm-map-box is-locked" id="fm-map-box">
              <div id="fm-map" class="fm-map"><div class="shm-fallback">Loading map…</div></div>
              <div class="fm-map-lock" id="fm-map-lock"><span>Choose the city first</span></div>
            </div>
            <div class="fm-pin-status" id="fm-pin-status" aria-live="polite"></div>
            <div class="fm-hint" id="fm-map-hint" hidden></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="fm-phone">Contact phone</label>
            <div class="fm-phone-row">
              <span class="fm-phone-prefix" aria-hidden="true">+63</span>
              <input type="tel" class="form-control" id="fm-phone" name="phone" inputmode="numeric" autocomplete="off" maxlength="10" value="${esc(phoneDigits)}" placeholder="917 123 4567" aria-describedby="fm-phone-hint" />
            </div>
            <div class="fm-hint" id="fm-phone-hint">Numbers only. Mobile: 10 digits starting with 9. Landline: include the area code.</div>
          </div>
          <div class="form-group">
            <label class="form-label">Official email</label>
            <input type="email" class="form-control" name="email" value="${val('email')}" placeholder="e.g. shelter@city.gov.ph" />
          </div>
          <div class="form-group">
            <label class="form-label">Daily holding fee</label>
            <input type="text" class="form-control" name="fee" value="${val('fee')}" placeholder="e.g. PHP 500 / day" />
          </div>
          <div class="form-group">
            <label class="form-label">Kennel capacity</label>
            <input type="number" class="form-control" name="capacity" value="${val('capacity', 50)}" min="1" max="500" />
          </div>
          ${isEdit && !initial.parentId && store.penaltyReady ? `<div class="form-group form-full">
            <label class="form-label">Penalty for a missing pet (PHP)</label>
            <input type="number" class="form-control" name="penaltyPhp" value="${esc(initial.penaltyPhp != null ? initial.penaltyPhp : 500)}" min="0" max="1000000" step="50" />
            <div class="fm-hint">Charged to the owner when a missing pet is impounded at this facility or any of its sub-facilities. Enter 0 to turn penalties off.</div>
          </div>` : ''}

          <div class="form-group form-full">
            <label class="form-label">Operating hours</label>
            ${FF.hours.fieldHtml(parsedHours || FF.hours.defaultModel())}
            ${legacyHours ? `<div class="fm-hint">Previously entered as "${esc(legacyHours)}". Choosing hours here replaces it.</div>` : ''}
          </div>
          <div class="form-group form-full">
            <label class="form-label">Officer in charge / head veterinarian</label>
            <input type="text" class="form-control" name="officerInCharge" value="${val('officerInCharge')}" placeholder="e.g. Dr. Fernando Gomez, DVM" />
          </div>
        </form>
        <div class="fm-error" id="fm-error" role="alert" hidden></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="shelter-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="shelter-save-btn">${submitLabel}</button>
      </div>
    `);

    const form = modal.querySelector('#shelter-form');
    const addressInput = form.elements.address;
    const cityInput = form.elements.city;
    const statusEl = modal.querySelector('#fm-pin-status');
    const errorEl = modal.querySelector('#fm-error');
    const locateBtn = modal.querySelector('#fm-locate');
    const saveBtn = modal.querySelector('#shelter-save-btn');
    const typeBox = (chooseType || retype) ? form.elements.isSub : null;
    const parentWrap = modal.querySelector('#fm-parent-wrap');
    const parentSel = modal.querySelector('#fm-parent');
    const titleEl = modal.querySelector('#fm-title');
    const currentLabel = () => (chooseType ? (typeBox.checked ? 'Add sub-facility' : 'Add main facility') : submitLabel);
    // Ticking the box asks which main facility it belongs to; leaving it unticked adds a main facility
    const applyType = () => {
      if (!chooseType && !retype) return;
      const sub = !!typeBox.checked;
      parentWrap.hidden = !sub;
      parentSel.required = sub;
      if (!chooseType) { if (sub && !parentSel.value) parentSel.focus({ preventScroll: true }); return; }
      if (titleEl) titleEl.textContent = sub ? 'Add a sub-facility' : 'Add a main facility';
      if (!saveBtn.disabled) saveBtn.textContent = currentLabel();
      if (sub && !parentSel.value) parentSel.focus({ preventScroll: true });
    };
    typeBox?.addEventListener('change', applyType);
    applyType();

    if (!isEdit && form.elements.name && typeof form.elements.name.focus === 'function') setTimeout(() => form.elements.name.focus({ preventScroll: true }), 60);
    const photoCtl = window.FacilityPhoto.bind(modal);
    let photoNudged = false;
    FF.phone.bind(form.elements.phone);
    const hoursCtl = FF.hours.bind(modal.querySelector('#fm-hours'));

    let picker = null;
    // ----- City: the chosen city limits the map and the pin -----
    const cityHint = modal.querySelector('#fm-city-hint');
    const mapBox = modal.querySelector('#fm-map-box');
    const covWrap = modal.querySelector('#fm-coverage-wrap');
    const covEl = modal.querySelector('#fm-cov');
    const covHint = modal.querySelector('#fm-cov-hint');
    const subNow = () => ((chooseType || retype) ? !!typeBox.checked : (isEdit ? !!initial.parentId : asSub));
    const covSel = new Set(initial && Array.isArray(initial.coverage) ? initial.coverage : []);
    let cityInfo = initial && initial.city ? { name: initial.city, placeId: initial.cityPlaceId || '', bounds: initial.cityBounds || null } : null;
    const outsideCity = (pin) => !!(cityInfo && cityInfo.bounds && pin && !FF.City.inBounds(pin, cityInfo.bounds));
    const parentFacility = () => {
      const f = form.elements.parentId;
      const id = (f && f.value) || opts.parentId || (mains[0] && mains[0].id);
      return store.getShelters().find(x => x.id === id) || null;
    };

    // Barangays: tick the ones this sub-facility covers (typed by hand when the list cannot be loaded)
    let covToken = 0;
    const covValue = () => {
      const t = covEl.querySelector('#fm-cov-text');
      return t ? [...new Set(t.value.split(/[,\n]/).map(x => x.trim()).filter(Boolean))] : [...covSel];
    };
    // Outline the ticked barangays on the map (looked up one at a time, remembered afterwards)
    const MAX_DRAWN = 30;
    const shapeCache = new Map();
    let drawToken = 0;
    let drawTimer = null;
    const drawAreas = () => {
      clearTimeout(drawTimer);
      drawTimer = setTimeout(async () => {
        const token = ++drawToken;
        if (!picker || !picker.setAreas) return;
        if (!cityInfo || !subNow()) { picker.setAreas(null); return; }
        const all = covValue();
        const names = all.slice(0, MAX_DRAWN);
        const city = cityInfo;
        const keyOf = (n) => city.name + '|' + n;
        const have = () => names.map(n => shapeCache.get(keyOf(n))).filter(Boolean);
        if (!names.length) { picker.setAreas(null); return; }
        picker.setAreas(have(), false);
        for (const n of names) {
          if (shapeCache.has(keyOf(n)) || !window.PSGC) continue;
          covHint.textContent = `Outlining ${n} on the map…`;
          const f = await window.PSGC.shapeFor(n, city.name, city.bounds);
          if (token !== drawToken || !modal.isConnected) return;
          shapeCache.set(keyOf(n), f || null);
          picker.setAreas(have(), false);
        }
        picker.setAreas(have(), true);
        const missed = names.filter(n => !shapeCache.get(keyOf(n))).length;
        covHint.textContent = `${all.length} ${all.length === 1 ? 'barangay' : 'barangays'} selected`
          + (over(all) ? `. The map shows the first ${MAX_DRAWN}.` : '')
          + (missed ? `. ${missed} could not be outlined on the map.` : '');
      }, 350);
    };
    const over = (all) => all.length > MAX_DRAWN;
    const renderCoverage = (list) => {
      if (!list) {
        covEl.innerHTML = `<textarea class="form-control" id="fm-cov-text" rows="2" placeholder="Type the barangays, separated by commas">${esc([...covSel].join(', '))}</textarea>`;
        covHint.textContent = 'We could not load the barangay list for this city, so type the names.';
        covEl.querySelector('#fm-cov-text').addEventListener('change', drawAreas);
        drawAreas();
        return;
      }
      const names = [...new Set([...list, ...covSel])];
      // A searchable dropdown: type in the box to filter, tick barangays, chips show what is chosen
      covEl.innerHTML = `<div class="fm-dd" id="fm-dd">
          <div class="fm-dd-field">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" id="fm-cov-q" placeholder="Search or choose barangays" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="fm-dd-panel" aria-label="Search barangays" />
            <button type="button" class="fm-dd-toggle" id="fm-dd-toggle" aria-label="Show the barangay list" tabindex="-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
          </div>
          <div class="fm-dd-panel" id="fm-dd-panel" role="listbox" aria-multiselectable="true" hidden>
            <div class="fm-dd-actions"><button type="button" class="fm-dd-link" id="fm-cov-all">Select all shown</button><button type="button" class="fm-dd-link" id="fm-cov-none">Clear</button></div>
            <div class="fm-cov-list">${names.map(n => `<label class="fm-cov-item"><input type="checkbox" value="${esc(n)}" ${covSel.has(n) ? 'checked' : ''} /><span>${esc(n)}</span></label>`).join('')}<div class="fm-dd-empty" hidden>No barangay matches</div></div>
          </div>
        </div>
        <div class="fm-chips" id="fm-chips" aria-label="Chosen barangays"></div>`;
      const dd = covEl.querySelector('#fm-dd');
      const q = covEl.querySelector('#fm-cov-q');
      const panel = covEl.querySelector('#fm-dd-panel');
      const items = [...covEl.querySelectorAll('.fm-cov-item')];
      const empty = covEl.querySelector('.fm-dd-empty');
      const chips = covEl.querySelector('#fm-chips');
      const setOpen = (open) => { panel.hidden = !open; q.setAttribute('aria-expanded', String(open)); dd.classList.toggle('is-open', open); };
      const filter = () => {
        const term = q.value.trim().toLowerCase();
        let shown = 0;
        items.forEach(li => { const hit = !term || li.textContent.toLowerCase().includes(term); li.hidden = !hit; if (hit) shown++; });
        empty.hidden = shown > 0;
      };
      const renderChips = () => {
        chips.innerHTML = [...covSel].map(n => `<span class="fm-chip">${esc(n)}<button type="button" data-rm="${esc(n)}" aria-label="Remove ${esc(n)}">&times;</button></span>`).join('');
      };
      const count = () => {
        covHint.textContent = covSel.size ? `${covSel.size} of ${names.length} barangays selected` : 'Select at least one barangay.';
        renderChips();
        drawAreas();
      };
      q.addEventListener('focus', () => setOpen(true));
      q.addEventListener('input', () => { setOpen(true); filter(); });
      q.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { setOpen(false); e.stopPropagation(); }
        // Enter picks the first match so a barangay can be added without the mouse
        if (e.key === 'Enter') {
          e.preventDefault();
          const first = items.find(li => !li.hidden);
          if (first) { const box = first.firstElementChild; box.checked = !box.checked; box.checked ? covSel.add(box.value) : covSel.delete(box.value); count(); }
        }
      });
      covEl.querySelector('#fm-dd-toggle').addEventListener('click', () => { setOpen(panel.hidden); if (!panel.hidden) q.focus(); });
      panel.addEventListener('change', (e) => {
        if (e.target.matches('input[type=checkbox]')) { e.target.checked ? covSel.add(e.target.value) : covSel.delete(e.target.value); count(); }
      });
      chips.addEventListener('click', (e) => {
        const rm = e.target.closest('[data-rm]');
        if (!rm) return;
        covSel.delete(rm.dataset.rm);
        const box = items.map(li => li.firstElementChild).find(b => b.value === rm.dataset.rm);
        if (box) box.checked = false;
        count();
      });
      covEl.querySelector('#fm-cov-all').addEventListener('click', () => { items.filter(li => !li.hidden).forEach(li => { li.firstElementChild.checked = true; covSel.add(li.firstElementChild.value); }); count(); });
      covEl.querySelector('#fm-cov-none').addEventListener('click', () => { items.forEach(li => { li.firstElementChild.checked = false; }); covSel.clear(); count(); });
      // Click anywhere else to close the list
      const away = (e) => { if (!dd.isConnected) { document.removeEventListener('mousedown', away); return; } if (!dd.contains(e.target)) setOpen(false); };
      document.addEventListener('mousedown', away);
      count();
    };
    const refreshCoverage = () => {
      covWrap.hidden = !subNow();
      if (covWrap.hidden) return;
      if (!cityInfo) { covEl.innerHTML = '<div class="fm-hint">Choose the main facility first: its city decides the barangay list.</div>'; covHint.textContent = ''; return; }
      const token = ++covToken;
      covEl.innerHTML = '<div class="fm-hint">Loading barangays…</div>';
      covHint.textContent = '';
      const code = /^psgc:/.test(cityInfo.placeId || '') ? cityInfo.placeId.slice(5) : '';
      const lookup = !window.PSGC ? Promise.resolve(null) : code ? window.PSGC.barangaysByCode(code) : window.PSGC.barangaysFor(cityInfo.name);
      lookup.then((list) => { if (token === covToken && modal.isConnected) renderCoverage(list); });
    };

    const applyCity = (c) => {
      const changed = (c && c.name) !== (cityInfo && cityInfo.name);
      cityInfo = c && c.name ? c : null;
      mapBox.classList.toggle('is-locked', !cityInfo);
      cityHint.textContent = cityInfo
        ? (cityInfo.bounds ? `The map and the pin are limited to ${cityInfo.name}${cityInfo.province ? ', ' + cityInfo.province : ''}.` : `We could not find the limits of ${cityInfo.name}, so the map is not limited.`)
        : (subNow() ? 'A sub-facility is in its main facility\'s city.' : 'Pick a city from the list. The map will be limited to it.');
      if (picker && picker.setBounds) picker.setBounds(cityInfo && cityInfo.bounds);
      if (changed && !subNow() && picker && picker.setAreas) picker.setAreas(null);
      // A different city (or none, after the region changed) means the old pin and address no longer apply
      if (changed && picker && picker.getPin && picker.getPin()) {
        picker.clearPin();
        pinTouched = false;
        setStatus(null);
        addressInput.value = '';
        addressAuto = false;
        lastLookup = '';
        if (errMsg.startsWith('The pin is outside')) showError('');
      }
      const pin = picker && picker.getPin();
      if (cityInfo && pin && outsideCity(pin)) showError(`The pin is outside ${cityInfo.name}. Click inside the city to move it.`, mapBox);
      else if (errMsg.startsWith('The pin is outside')) showError('');
      if (changed) refreshCoverage();
    };
    const cityCtl = FF.City.attach(cityInput, applyCity);

    // Region first: the city list only offers the cities of the chosen region. A sub-facility takes its main
    // facility's city, so it skips the region. If the region list can't load, the city box works as before.
    const regionSel = modal.querySelector('#fm-region');
    const regionWrap = modal.querySelector('#fm-region-wrap');
    let regionsFailed = false;
    const syncCityLock = () => {
      const locked = !regionsFailed && !subNow() && !regionSel.value;
      cityInput.disabled = locked;
      cityInput.placeholder = locked ? 'Choose a region first' : 'Search for a city';
      regionWrap.hidden = regionsFailed || subNow();
      // A sub-facility has no region step: its facility type and its city share one row
      modal.querySelector('#fm-city-wrap')?.classList.toggle('form-full', !subNow());
    };
    regionSel.addEventListener('change', () => {
      cityCtl.setRegion(regionSel.value);
      cityInput.value = ''; cityCtl.set(null);
      syncCityLock();
      if (regionSel.value) cityInput.focus();
    });
    if (window.PSGC) {
      Promise.all([window.PSGC.regions(), window.PSGC.cities()]).then(([regions, cities]) => {
        if (!modal.isConnected) return;
        regionSel.innerHTML = '<option value="">Select a region</option>' + regions.map(r => `<option value="${esc(r.code)}">${esc(r.label)}</option>`).join('');
        regionSel.disabled = false;
        const own = cityInfo && (cities.find(c => cityInfo.placeId === 'psgc:' + c.code) || cities.find(c => c.name.toLowerCase() === String(cityInfo.name).toLowerCase()));
        if (own && own.regionCode) { regionSel.value = own.regionCode; cityCtl.setRegion(own.regionCode); }
        syncCityLock();
      }).catch(() => { regionsFailed = true; syncCityLock(); });
    } else { regionsFailed = true; }
    // A sub-facility is always in its main facility's city
    const syncParentCity = () => {
      const sub = subNow();
      cityInput.readOnly = sub;
      cityInput.classList.toggle('is-readonly', sub);
      syncCityLock();
      if (!sub) { refreshCoverage(); return; }
      const parent = parentFacility();
      if (!parent || !parent.city) { cityInput.value = ''; cityCtl.set(null); refreshCoverage(); return; }
      cityCtl.set({ name: parent.city, placeId: parent.cityPlaceId || '', bounds: parent.cityBounds || null });
      if (!parent.cityBounds) FF.City.resolve(parent.city).then(c => { if (c && modal.isConnected && cityInfo && cityInfo.name === parent.city) cityCtl.set({ ...c, name: parent.city }); });
      refreshCoverage();
    };
    typeBox?.addEventListener('change', syncParentCity);
    form.elements.parentId?.addEventListener('change', syncParentCity);
    if (cityInfo && !cityInfo.bounds && !subNow()) FF.City.resolve(cityInfo.name).then(c => { if (c && modal.isConnected && cityInfo && cityInfo.name === initial.city) cityCtl.set({ ...c, name: initial.city }); });

    let pinTouched = hasPin;                 // the person (or a saved pin) decided where it goes: typing the address must not move it
    let addressAuto = false;                 // the address text was filled in from the pin, so a new pin may replace it
    let lastLookup = (initial && initial.address) || '';
    let locating = false;

    // An error goes right under the field it is about (pass that field as `field`); without one it shows at the bottom
    let errMsg = '';
    const showError = (msg, field) => {
      errMsg = msg || '';
      modal.querySelectorAll('.fm-inline-error').forEach(n => n.remove());
      errorEl.textContent = '';
      errorEl.hidden = true;
      if (!msg) return;
      const group = field && field.closest ? field.closest('.form-group') : null;
      let box = errorEl;
      if (group) {
        box = document.createElement('div');
        box.className = 'fm-error fm-inline-error';
        box.setAttribute('role', 'alert');
        group.appendChild(box);
      }
      box.textContent = msg;
      box.hidden = false;
      box.scrollIntoView({ block: 'nearest' });
    };
    const hoursEl = modal.querySelector('#fm-hours');
    // The pin position is shown by the pin itself; no "Pin set at …" line under the map
    const setStatus = (pin) => { statusEl.classList.toggle('is-set', !!pin); statusEl.textContent = ''; statusEl.hidden = true; };
    setStatus(hasPin ? { lat: +initial.lat, lng: +initial.lng } : null);

    // Start-up for the city rules (after showError exists)
    applyCity(cityInfo);
    syncParentCity();

    const closeDialog = () => {
      if (picker) picker.destroy();
      window.adminApp.closeModal();
    };
    // Closing without saving asks first (X, Cancel, clicking outside and Escape); saving closes straight away
    const confirmClose = () => window.adminApp.confirmDialog({
      title: 'Close without saving?',
      message: isEdit ? 'Your changes to this facility will be lost.' : 'The details you entered for this facility will be lost.',
      confirmLabel: 'Discard and close',
      cancelLabel: 'Keep editing',
      danger: true
    });
    if (window.adminApp.setModalGuard) window.adminApp.setModalGuard(confirmClose);
    const askClose = async () => { if (!window.adminApp.confirmDialog || await confirmClose()) closeDialog(); };
    modal.querySelector('#shelter-close-btn')?.addEventListener('click', askClose);
    modal.querySelector('#shelter-cancel-btn')?.addEventListener('click', askClose);

    // The pin was moved by hand: name the place under it when the address is empty or was filled in earlier
    const onPick = async (pos) => {
      pinTouched = true;
      showError('');
      setStatus(pos);
      if (outsideCity(pos)) { showError(`That spot is outside ${cityInfo.name}. Click inside the city.`, mapBox); return; }
      if (!picker || !picker.canGeocode) return;
      const place = await picker.reverse(pos);
      if (!place) return;
      let filled = false;
      if (!addressInput.value.trim() || addressAuto) { addressInput.value = place.address; addressAuto = true; lastLookup = place.address; filled = true; }
      if (filled) setStatus(pos, 'address filled in from the pin, edit it if it is not exact');
    };

    // Type the address, then place the pin from it
    // checkOnly: the pin was placed by hand, so only check that the address is in the city; do not move the pin
    const locate = async (checkOnly = false) => {
      const text = addressInput.value.trim();
      if (!text || locating || !picker || !picker.canGeocode) { if (!text) addressInput.focus(); return; }
      if (!cityInfo) { showError('Choose the city first, then find the address.', cityInput); cityInput.focus(); return; }
      locating = true;
      locateBtn.disabled = true;
      locateBtn.textContent = 'Finding…';
      const found = await picker.geocode(`${text}, Philippines`);
      locating = false;
      locateBtn.disabled = false;
      locateBtn.textContent = 'Find on map';
      // The map box can be missing or too loose, so also compare the city/town OpenStreetMap names for the address
      const wanted = window.PSGC ? window.PSGC.norm(cityInfo.name) : '';
      const wrongPlace = !!(found && wanted && found.places && found.places.length && !found.places.some(p => window.PSGC.norm(p) === wanted));
      if (found && (outsideCity(found) || wrongPlace)) {
        showError(`That address is not inside ${cityInfo.name}. Check it, or click the map inside the city.`, addressInput);
        return;
      }
      if (!found) {
        showError('We could not find that address. Check the spelling, or click the map to place the pin yourself.', addressInput);
        return;
      }
      showError('');
      lastLookup = text;
      if (checkOnly) return;
      addressAuto = false;
      pinTouched = false;
      picker.setPin({ lat: found.lat, lng: found.lng }, 17);
      setStatus({ lat: found.lat, lng: found.lng }, 'from the address, drag it if it is not exact');
    };

    locateBtn.addEventListener('click', () => locate());
    addressInput.addEventListener('input', () => { addressAuto = false; });
    addressInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); locate(); } });
    // Leaving the field with a new address places the pin for them. If they already placed the pin themselves it
    // stays where it is, but the address is still checked against the city.
    addressInput.addEventListener('blur', () => {
      const text = addressInput.value.trim();
      if (picker && picker.canGeocode && text && text !== lastLookup) locate(pinTouched);
    });

    FF.MapPicker.create(modal.querySelector('#fm-map'), {
      lat: hasPin ? +initial.lat : null,
      lng: hasPin ? +initial.lng : null,
      onPick,
      onEngine: (p) => {
        locateBtn.hidden = !p.canGeocode;
        const hint = modal.querySelector('#fm-map-hint');
        hint.hidden = p.canGeocode;
        hint.textContent = p.canGeocode ? '' : 'Address lookup is not available on this map, so click the map to place the pin at the facility.';
      }
    }).then((p) => {
      picker = p;
      if (!modal.isConnected) { p.destroy(); return; }
      if (cityInfo && cityInfo.bounds && p.setBounds) p.setBounds(cityInfo.bounds);
      if (subNow() && covValue().length) drawAreas();
    });

    // Facility type: "Others…" swaps the dropdown for a text field; "Back to list" swaps it back
    const typeSel = modal.querySelector('#fm-type');
    const typeOtherWrap = modal.querySelector('#fm-type-other-wrap');
    const typeOther = modal.querySelector('#fm-type-other');
    const showTypeText = on => {
      typeSel.hidden = on; typeSel.disabled = on;
      typeOtherWrap.hidden = !on; typeOther.disabled = !on; typeOther.required = on;
      if (on) { typeOther.focus(); }
      else { if (typeSel.value === '__other__') typeSel.value = types.includes(currentType) ? currentType : types[0]; typeSel.focus(); }
    };
    typeSel.addEventListener('change', () => { if (typeSel.value === '__other__') showTypeText(true); });
    modal.querySelector('#fm-type-back').addEventListener('click', () => showTypeText(false));

    saveBtn?.addEventListener('click', async () => {
      showError('');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (!typeOther.disabled && !typeOther.value.trim()) { showError('Type the facility type, or go back to the list.', typeOther); typeOther.focus(); return; }
      const hoursError = hoursCtl.validate();
      if (hoursError) { showError(hoursError, hoursEl); return; }
      const isSubNow = chooseType ? !!typeBox.checked : asSub;
      if (retype && typeBox.checked && !parentSel.value) { showError('Choose the main facility this sub-facility belongs to.', parentSel); parentSel.focus(); return; }
      if (chooseType && isSubNow && !parentSel.value) { showError('Choose the main facility this sub-facility belongs to.', parentSel); parentSel.focus(); return; }
      if (!subNow() && !regionsFailed && !regionSel.value) { showError('Choose the region first, then pick the city.', regionSel); regionSel.focus(); return; }
      if (!cityInfo) { showError('Pick the facility\'s city from the list first.', cityInput); cityInput.focus(); return; }
      if (!isEdit && !String(form.elements.paperAddress.value || '').trim()) { showError('Enter the address as it is written on the facility\'s official papers.', form.elements.paperAddress); form.elements.paperAddress.focus(); return; }
      if (subNow() && !covValue().length) { showError('Choose at least one barangay this sub-facility covers.', covEl); covEl.scrollIntoView({ block: 'center' }); return; }
      const pin = picker && picker.getPin();
      if (pin && outsideCity(pin)) { showError(`The pin is outside ${cityInfo.name}. Move it inside the city.`, mapBox); return; }
      if (!pin) {
        showError('Place the pin on the map: click the facility\'s exact location, or type its address and press "Find on map".', mapBox);
        return;
      }

      // A new facility without a photo gets one gentle prompt; saving again goes ahead without it
      if (!isEdit && !photoCtl.has() && !photoNudged) {
        photoNudged = true;
        photoCtl.nudge(true);
        return;
      }

      // A new facility's official email is confirmed with an emailed code before the facility is registered
      const officialEmail = String(new FormData(form).get('email') || '').trim().toLowerCase();
      if (!isEdit && officialEmail) {
        saveBtn.disabled = true;
        const confirmed = await window.adminApp.verifyEmailCode({
          email: officialEmail,
          title: 'Confirm the facility email',
          intro: 'Before this facility is registered, confirm that its official email is yours.'
        });
        saveBtn.disabled = false;
        if (!confirmed) { showError('Confirm the official email with the code we send to register the facility.'); return; }
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      const formData = new FormData(form);

      const shelterData = {
        id: initial ? initial.id : 'sh-' + Date.now(),
        name: formData.get('name'),
        type: (typeOther.disabled ? formData.get('type') : String(formData.get('typeOther') || '').trim()) || types[0],
        city: cityInfo.name,
        cityPlaceId: cityInfo.placeId || '',
        cityBounds: cityInfo.bounds || null,
        coverage: subNow() ? covValue() : undefined,
        address: String(formData.get('address') || '').trim(),
        phone: FF.phone.toStored(FF.phone.digits(formData.get('phone'))),
        email: formData.get('email'),
        fee: formData.get('fee'),
        capacity: parseInt(formData.get('capacity'), 10) || 50,
        occupied: initial ? initial.occupied : 0,
        hours: hoursCtl.value(),
        officerInCharge: formData.get('officerInCharge') || '',
        lat: pin.lat,
        lng: pin.lng,
        holdingPeriodDays: initial && initial.holdingPeriodDays ? initial.holdingPeriodDays : 3,
        photoUrl: initial ? (initial.photoUrl || '') : undefined,
        asSub: isSubNow,
        asMain: chooseType ? !isSubNow : asMain,
        parentId: isSubNow ? (formData.get('parentId') || (mains[0] && mains[0].id) || undefined) : undefined,
        penaltyPhp: form.elements.penaltyPhp ? form.elements.penaltyPhp.value : null
      };

      // Stay in the dialog until the database answers, so a refusal doesn't throw the typed details away
      store.saveShelter(shelterData, async (dbId) => {
        if (!dbId) {
          saveBtn.disabled = false;
          saveBtn.textContent = currentLabel();
          return;
        }
        // Edit: apply a change of type (main <-> sub-facility) once the details are saved
        if (retype) {
          const want = typeBox.checked ? parentSel.value : null;
          if ((initial.parentId || null) !== (want || null)) {
            saveBtn.textContent = 'Changing type…';
            if (!(await store.setFacilityParent(initial.id, want))) {
              saveBtn.disabled = false;
              saveBtn.textContent = currentLabel();
              showError('Your changes were saved, but the facility type was not changed.');
              return;
            }
          }
        }
        // The address on paper is saved with the facility (it is a separate column)
        const paperValue = String(new FormData(form).get('paperAddress') || '').trim();
        if (paperValue && typeof store.setFacilityPaperAddress === 'function') await store.setFacilityPaperAddress(dbId, paperValue);
        // The facility exists now, so its photo can be stored in its own folder
        let photoFailed = false;
        if (photoCtl.blob() || photoCtl.removed()) {
          saveBtn.textContent = 'Saving photo…';
          photoFailed = (await store.setFacilityPhoto(dbId, photoCtl.blob())) === null;
        }
        closeDialog();
        if (photoFailed) window.adminApp.showToast('The facility was saved, but its photo could not be uploaded. Edit the facility to try again.', 'warning', 6000);
        const isMainNow = (chooseType ? !isSubNow : asMain);
        if (isEdit) {
          window.adminApp.showToast(`Updated "${shelterData.name}"`, 'success');
        } else if (isSubNow) {
          // A sub-facility gets a dialog: what was registered, where it works, and the next step
          const mainName = ((mains || []).find(m => m.id === shelterData.parentId) || {}).name || '';
          window.adminApp.showDialog({
            tone: 'success',
            title: 'Sub-facility registered',
            message: `${shelterData.name} is now part of your network. Share its invite code so its employees can join.`,
            rows: [
              ['Sub-facility', shelterData.name],
              ['Main facility', mainName],
              ['City', shelterData.city],
              ['Barangays covered', (shelterData.coverage || []).join(', ')]
            ],
            actions: [{ label: 'Done', primary: true }]
          });
        } else {
          window.adminApp.showToast(isMainNow ? `Added main facility "${shelterData.name}". You manage it and can add its sub-facilities.` : `Registered "${shelterData.name}". You are its manager.`, 'success');
        }
        // Show the new facility's data right away (every page redraws for it)
        if (!isEdit && typeof store.setActiveFacility === 'function') store.setActiveFacility(dbId);
        if (typeof opts.onCreated === 'function' && !isEdit) opts.onCreated(dbId);
      });
    });
  }
};
