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
            <b>${esc(s.name)} <em class="${s.sub ? 'is-sub' : ''}">${s.sub ? `Sub of ${esc(s.parentName || 'the main facility')}` : 'Main'}</em></b>
            <span>${esc(detail || 'No address on file')}</span>
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
      <div class="nock-card shm-flist" aria-label="Your facilities">
        ${list.length ? list.map(row).join('') : '<div class="shm-list-empty">Facilities you add will appear here.</div>'}
      </div>`;

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
            <select class="form-control" name="type">
              ${types.map(t => `<option value="${esc(t)}" ${t === currentType ? 'selected' : ''}>${esc(t)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">City / municipality *</label>
            <input type="text" class="form-control" name="city" value="${val('city')}" placeholder="e.g. Quezon City" required />
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
            <div id="fm-map" class="fm-map"><div class="shm-fallback">Loading map…</div></div>
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
    let pinTouched = hasPin;                 // the person (or a saved pin) decided where it goes: typing the address must not move it
    let addressAuto = false;                 // the address text was filled in from the pin, so a new pin may replace it
    let lastLookup = (initial && initial.address) || '';
    let locating = false;

    const showError = (msg) => {
      errorEl.textContent = msg;
      errorEl.hidden = !msg;
      if (msg) errorEl.scrollIntoView({ block: 'nearest' });
    };
    const setStatus = (pin, note) => {
      statusEl.classList.toggle('is-set', !!pin);
      statusEl.textContent = pin
        ? `Pin set at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}${note ? ' · ' + note : ''}`
        : 'No pin yet. Click the map, or type the address and press "Find on map".';
    };
    setStatus(hasPin ? { lat: +initial.lat, lng: +initial.lng } : null);

    const closeDialog = () => {
      if (picker) picker.destroy();
      window.adminApp.closeModal();
    };
    modal.querySelector('#shelter-close-btn')?.addEventListener('click', closeDialog);
    modal.querySelector('#shelter-cancel-btn')?.addEventListener('click', closeDialog);

    // The pin was moved by hand: name the place under it when the address is empty or was filled in earlier
    const onPick = async (pos) => {
      pinTouched = true;
      showError('');
      setStatus(pos);
      if (!picker || !picker.canGeocode) return;
      const place = await picker.reverse(pos);
      if (!place) return;
      let filled = false;
      if (!addressInput.value.trim() || addressAuto) { addressInput.value = place.address; addressAuto = true; lastLookup = place.address; filled = true; }
      if (!cityInput.value.trim() && place.city) cityInput.value = place.city;
      if (filled) setStatus(pos, 'address filled in from the pin, edit it if it is not exact');
    };

    // Type the address, then place the pin from it
    const locate = async () => {
      const text = addressInput.value.trim();
      if (!text || locating || !picker || !picker.canGeocode) { if (!text) addressInput.focus(); return; }
      locating = true;
      locateBtn.disabled = true;
      locateBtn.textContent = 'Finding…';
      const city = cityInput.value.trim();
      const found = await picker.geocode(`${text}${city && !text.toLowerCase().includes(city.toLowerCase()) ? ', ' + city : ''}, Philippines`);
      locating = false;
      locateBtn.disabled = false;
      locateBtn.textContent = 'Find on map';
      if (!found) {
        showError('We could not find that address. Check the spelling, or click the map to place the pin yourself.');
        return;
      }
      showError('');
      lastLookup = text;
      addressAuto = false;
      pinTouched = false;
      picker.setPin({ lat: found.lat, lng: found.lng }, 17);
      if (!city && found.city) cityInput.value = found.city;
      setStatus({ lat: found.lat, lng: found.lng }, 'from the address, drag it if it is not exact');
    };

    locateBtn.addEventListener('click', locate);
    addressInput.addEventListener('input', () => { addressAuto = false; });
    addressInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); locate(); } });
    // Leaving the field with a new address places the pin for them, unless they already placed it themselves
    addressInput.addEventListener('blur', () => {
      const text = addressInput.value.trim();
      if (picker && picker.canGeocode && !pinTouched && text && text !== lastLookup) locate();
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
      if (!modal.isConnected) p.destroy();
    });

    saveBtn?.addEventListener('click', () => {
      showError('');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const hoursError = hoursCtl.validate();
      if (hoursError) { showError(hoursError); return; }
      const isSubNow = chooseType ? !!typeBox.checked : asSub;
      if (retype && typeBox.checked && !parentSel.value) { showError('Choose the main facility this sub-facility belongs to.'); parentSel.focus(); return; }
      if (chooseType && isSubNow && !parentSel.value) { showError('Choose the main facility this sub-facility belongs to.'); parentSel.focus(); return; }
      const pin = picker && picker.getPin();
      if (!pin) {
        showError('Place the pin on the map: click the facility\'s exact location, or type its address and press "Find on map".');
        return;
      }

      // A new facility without a photo gets one gentle prompt; saving again goes ahead without it
      if (!isEdit && !photoCtl.has() && !photoNudged) {
        photoNudged = true;
        photoCtl.nudge(true);
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      const formData = new FormData(form);

      const shelterData = {
        id: initial ? initial.id : 'sh-' + Date.now(),
        name: formData.get('name'),
        type: formData.get('type') || types[0],
        city: formData.get('city') || '',
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
        // The facility exists now, so its photo can be stored in its own folder
        let photoFailed = false;
        if (photoCtl.blob() || photoCtl.removed()) {
          saveBtn.textContent = 'Saving photo…';
          photoFailed = (await store.setFacilityPhoto(dbId, photoCtl.blob())) === null;
        }
        closeDialog();
        if (photoFailed) window.adminApp.showToast('The facility was saved, but its photo could not be uploaded. Edit the facility to try again.', 'warning', 6000);
        window.adminApp.showToast(isEdit ? `Updated "${shelterData.name}"` : (chooseType ? !isSubNow : asMain) ? `Added main facility "${shelterData.name}". You manage it and can add its sub-facilities.` : isSubNow ? `Added sub-facility "${shelterData.name}". Share its invite code with its employees.` : `Registered "${shelterData.name}". You are its manager.`, 'success');
        if (typeof opts.onCreated === 'function' && !isEdit) opts.onCreated(dbId);
      });
    });
  }
};
