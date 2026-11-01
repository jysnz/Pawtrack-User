/**
 * PawTrack Notification System & Facebook-Style Dropdown
 */

class NotificationManager {
  constructor() {
    this.activeCategory = 'others'; // 'others' | 'priority'
    this.initToastContainer();
  }

  isPriority(n) {
    if (!n) return false;
    if (n.category === 'priority' || n.isPriority === true) return true;
    if (n.type === 'impound_alert' || (n.title && n.title.toUpperCase().includes('IMPOUND'))) return true;
    if (n.type === 'missing' && n.title && n.title.toUpperCase().includes('EMERGENCY')) return true;
    return false;
  }

  // The signed-in guardian's notifications (only about their own pets); a store without that filter lists all
  myNotifications() {
    const store = window.pawStore;
    if (!store) return [];
    return typeof store.getMyNotifications === 'function' ? store.getMyNotifications() : store.getNotifications();
  }

  // When the panel opens on a tab with nothing unread but the other tab has unread alerts, show that tab
  pickCategoryWithUnread() {
    const notifs = this.myNotifications();
    const unread = (priority) => notifs.some(n => !n.read && this.isPriority(n) === priority);
    const onPriority = this.activeCategory === 'priority';
    if (!unread(onPriority) && unread(!onPriority)) this.activeCategory = onPriority ? 'others' : 'priority';
  }

  setCategory(category) {
    this.activeCategory = (category === 'priority') ? 'priority' : 'others';
    this.renderNotifDropdown();
  }

  initToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    this.toastContainer = container;
  }

  showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'danger') icon = 'alert-triangle';
    if (type === 'warning') icon = 'alert-circle';

    toast.innerHTML = `
      <div style="font-size: 1.1rem; display:flex; align-items:center; flex-shrink:0;">
        <i data-lucide="${icon}"></i>
      </div>
      <div style="flex:1;">
        <div style="font-size:0.875rem; font-weight:500;">${message}</div>
      </div>
      <button style="color:var(--text-muted); font-size:1.1rem; line-height:1; padding:4px;" onclick="this.parentElement.remove()" aria-label="Close">&times;</button>
    `;

    this.toastContainer.appendChild(toast);
    if (window.lucide) window.lucide.createIcons({ root: toast });

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  renderNotifDropdown() {
    const listElem = document.getElementById('notif-dropdown-list');
    const countBadge = document.getElementById('notif-dropdown-count');
    const bellBadge = document.getElementById('notif-count-badge');
    const priorityTabBtn = document.getElementById('notif-tab-priority');
    const othersTabBtn = document.getElementById('notif-tab-others');
    const priorityBadge = document.getElementById('notif-badge-priority');
    const othersBadge = document.getElementById('notif-badge-others');

    if (!listElem) return;

    const notifs = this.myNotifications();
    const unreadCount = notifs.filter(n => !n.read).length;

    // Filter Priority (Official Impound Alerts) vs Others (Good Samaritan matches, sightings, general)
    const priorityNotifs = notifs.filter(n => this.isPriority(n));
    const othersNotifs = notifs.filter(n => !this.isPriority(n));

    const priorityUnread = priorityNotifs.filter(n => !n.read).length;
    const othersUnread = othersNotifs.filter(n => !n.read).length;

    if (countBadge) {
      countBadge.textContent = unreadCount;
      countBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
    if (bellBadge) {
      bellBadge.textContent = unreadCount;
      bellBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }

    // Update Category Tab active state & badges
    if (priorityTabBtn && othersTabBtn) {
      if (this.activeCategory === 'priority') {
        priorityTabBtn.classList.add('active');
        othersTabBtn.classList.remove('active');
      } else {
        othersTabBtn.classList.add('active');
        priorityTabBtn.classList.remove('active');
      }
    }

    if (priorityBadge) {
      priorityBadge.textContent = priorityUnread;
      priorityBadge.style.display = priorityUnread > 0 ? 'inline-block' : 'none';
      if (priorityUnread > 0) {
        priorityBadge.className = 'fb-notif-tab-badge badge-priority';
      }
    }

    if (othersBadge) {
      othersBadge.textContent = othersUnread;
      othersBadge.style.display = othersUnread > 0 ? 'inline-block' : 'none';
      if (othersUnread > 0) {
        othersBadge.className = 'fb-notif-tab-badge badge-others';
      }
    }

    const currentList = this.activeCategory === 'priority' ? priorityNotifs : othersNotifs;
    const t = window.t || ((k, fallback) => fallback || k);

    if (currentList.length === 0) {
      if (this.activeCategory === 'priority') {
        listElem.innerHTML = `
          <div style="text-align:center; padding: 2.2rem 1.2rem; color:var(--text-muted);">
            <div style="margin-bottom: 0.6rem; opacity: 0.6;">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ea9d1e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto;">
                <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
                <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
                <circle cx="12" cy="12" r="2"/>
                <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
                <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/>
              </svg>
            </div>
            <div style="font-weight:700; font-size: 0.92rem; color:var(--text-main);">${t('notif.noPriority', 'No Priority Alerts')}</div>
            <div style="font-size:0.75rem; margin-top:0.3rem; color:var(--text-muted); line-height:1.4;">${t('notif.noPriorityDesc', 'Official municipal shelter intake and impoundment notices will appear here.')}</div>
          </div>
        `;
      } else {
        listElem.innerHTML = `
          <div style="text-align:center; padding: 2.2rem 1.2rem; color:var(--text-muted);">
            <div style="margin-bottom: 0.6rem; opacity: 0.4;">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto;">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div style="font-weight:700; font-size: 0.92rem; color:var(--text-main);">${t('notif.noOthers', 'No Other Notifications')}</div>
            <div style="font-size:0.75rem; margin-top:0.3rem; color:var(--text-muted); line-height:1.4;">${t('notif.noOthersDesc', 'Good Samaritan finder reports, community sightings, and updates will appear here.')}</div>
          </div>
        `;
      }
    } else {
      listElem.innerHTML = currentList.map(n => {
        const isPriorityItem = this.isPriority(n);
        const isFoundMatch = n.type === 'pet_found_match' || (n.title && n.title.toUpperCase().includes('FOUND'));
        const isRead = Boolean(n.read);

        let cardClass = 'fb-notif-item';
        if (isRead) {
          cardClass += ' read-item';
        } else if (isFoundMatch) {
          cardClass += ' unread-match notif-match-card';
        } else {
          cardClass += ' unread-standard';
        }

        const iconLetter = isFoundMatch ? 'F' : n.type === 'impound_alert' ? 'S' : n.type === 'reunited' ? 'R' : 'A';
        const iconBg = isRead 
          ? 'rgba(255, 255, 255, 0.08)' 
          : isFoundMatch 
            ? 'rgba(34, 197, 94, 0.2)' 
            : isPriorityItem 
              ? 'rgba(234, 157, 30, 0.25)' 
              : 'rgba(234, 157, 30, 0.15)';
        const iconColor = isRead 
          ? 'var(--text-dim, #94a3b8)' 
          : isFoundMatch 
            ? '#22c55e' 
            : 'var(--primary)';
        const titleColor = isRead 
          ? 'var(--text-muted, #cbd5e1)' 
          : isFoundMatch 
            ? '#22c55e' 
            : 'var(--text-main)';
        const badgeBg = isFoundMatch ? '#22c55e' : 'var(--primary, #ea9d1e)';
        const badgeText = isFoundMatch ? t('notif.foundTag', 'FOUND') : t('notif.newTag', 'NEW');

        return `
          <div class="${cardClass}" onclick="window.notifManager.handleNotifClick('${n.id}')" title="${isRead ? 'Already read · Click to view details' : 'Unread · Click to view details'}">
            <span class="notif-avatar-icon" style="display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; background:${iconBg}; color:${iconColor}; font-size:0.75rem; font-weight:800; flex-shrink:0; margin-top:2px;">
              ${iconLetter}
            </span>
            <div style="flex:1; min-width:0; overflow:hidden;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                <strong class="notif-title-text" style="font-size:0.82rem; color:${titleColor}; word-break:break-word; overflow-wrap:anywhere;">${n.title}</strong>
                ${!isRead 
                  ? `<span style="font-size:0.6rem; font-weight:700; background:${badgeBg}; color:#ffffff; border-radius:99px; padding:1px 6px; flex-shrink:0; letter-spacing:0.02em;">${badgeText}</span>` 
                  : `<span class="notif-read-check-icon" title="Read" style="font-size:0.65rem; color:var(--text-dim, #94a3b8); display:inline-flex; align-items:center; gap:2px; opacity:0.75;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>`}
              </div>
              <p class="notif-msg-text" style="font-size:0.76rem; color:${isRead ? 'var(--text-dim, #94a3b8)' : 'var(--text-muted)'}; margin:4px 0 6px; line-height:1.4; word-break:break-word; overflow-wrap:anywhere;">${n.message}</p>
              
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span style="font-size:0.68rem; font-family:monospace; color:var(--text-dim);">${new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                ${n.nfcTag ? `
                  <span class="notif-nfc-pill" style="font-size:0.66rem; font-family:var(--font-mono); font-weight:700; color:${isRead ? 'var(--text-dim, #94a3b8)' : isFoundMatch ? '#22c55e' : 'var(--primary)'}; background:${isRead ? 'rgba(255,255,255,0.04)' : isFoundMatch ? 'rgba(34,197,94,0.12)' : 'rgba(234,157,30,0.12)'}; padding:1px 6px; border-radius:4px; border:1px solid ${isRead ? 'rgba(255,255,255,0.1)' : isFoundMatch ? 'rgba(34,197,94,0.3)' : 'rgba(234,157,30,0.3)'};">NFC: ${n.nfcTag}</span>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  handleNotifClick(notifId) {
    if (window.pawStore) {
      window.pawStore.markNotificationRead(notifId);
    }
    const notifs = window.pawStore ? window.pawStore.getNotifications() : [];
    const notif = notifs.find(n => String(n.id) === String(notifId));
    if (!notif) return;

    if (!notif.read) {
      notif.read = true;
      localStorage.setItem('pawtrack_notifications', JSON.stringify(notifs));
    }
    this.renderNotifDropdown();
    if (window.pawApp && window.pawApp.updateNotifBadge) {
      window.pawApp.updateNotifBadge();
    }

    // Close notification dropdown panel so it doesn't obstruct the modal
    const notifDropdown = document.getElementById('notif-dropdown-panel');
    if (notifDropdown) notifDropdown.style.display = 'none';
    const userDropdown = document.getElementById('user-account-dropdown');
    if (userDropdown) userDropdown.style.display = 'none';

    if (notif.caseId) {
      this.openReunionCase(notif.caseId);
    } else if (notif.claimId && window.sightingsView) {
      window.sightingsView.openClaimDetail(notif.claimId);
    } else if (notif.type === 'sighting_verification' || notif.sightingId) {
      // The same Verify dialog as the Verify button on a post: the alert is matched to the sighting it is about
      const sighting = this.findSightingForNotification(notif);
      this.openSightingFromNotification(sighting, notif);
    } else if (notif.type === 'pet_found_match' || notif.finderPhone || (notif.title && notif.title.includes('FOUND YOUR PET'))) {
      this.showFinderInfo(notif);
    } else if (notif.type === 'impound_alert' && notif.impoundData) {
      this.showSmsSimulation(notif.impoundData);
    } else if (notif.coords) {
      window.location.hash = '#owner';
      setTimeout(() => {
        if (window.publicView && window.publicView.map) {
          window.publicView.map.flyTo([notif.coords.lat, notif.coords.lng], 16, { duration: 0.8 });
        }
        document.getElementById('incident-map-section')?.scrollIntoView({behavior:'smooth'});
      }, 250);
    }
  }

  // An alert from the database says which pet was seen, not which sighting. The sighting is the one posted closest
  // in time to the alert, for that pet's report or at that same place (an old alert can outlive its report).
  findSightingForNotification(notif) {
    const store = window.pawStore;
    if (!store) return null;
    if (notif.sightingId) return store.getSightingById(notif.sightingId) || null;
    const all = store.getSightings() || [];
    const report = notif.missingReportId ? store.getMissingReportById(notif.missingReportId) : null;
    const loc = String(notif.location || '').trim();
    const byReport = all.filter((s) => (notif.missingReportId && String(s.missing_report_id) === String(notif.missingReportId))
      || (report && report.petId && String(s.petId) === String(report.petId)));
    const byPlace = loc ? all.filter((s) => String(s.location || '').trim() === loc || String(s.location || '').startsWith(loc.slice(0, 24))) : [];
    const pool = byReport.length ? byReport : byPlace;
    if (!pool.length) return null;
    const at = new Date(notif.timestamp).getTime() || Date.now();
    const time = (s) => new Date(s.createdAt || s.dateTimeSeen || 0).getTime() || 0;
    return pool.slice().sort((a, b) => Math.abs(time(a) - at) - Math.abs(time(b) - at))[0];
  }

  // A sighting alert opens the Verify dialog; once the owner has confirmed, it opens the reunion steps instead
  async openSightingFromNotification(sighting, notif) {
    if (!sighting) {
      this.showToast('This sighting is no longer available. It may have been removed.', 'info', 4500);
      return;
    }
    if (sighting.status === 'confirmed_sighting') {
      const caseId = await window.pawStore.getCaseIdForSighting(sighting.id);
      if (caseId) { this.openReunionCase(caseId); return; }
    }
    this.openSightingVerificationModal(sighting.id);
  }

  // ---------- Reunion case: next steps after an owner confirms a sighting ----------
  async openReunionCase(caseId) {
    const d = await window.pawStore.getCaseDetails(caseId);
    if (!d || !document.getElementById('case-body')) {
      this.showToast('This reunion is not available any more.', 'info', 4000);
      return;
    }
    this.currentCaseId = caseId;
    this.renderReunionCase(d);
    this.openModal('reunion-case-modal');
  }

  renderReunionCase(d) {
    this.currentCase = d;
    const body = document.getElementById('case-body');
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const owner = d.role === 'owner';
    const pet = d.pet_name || 'the pet';
    const status = d.status;
    const ago = (v) => { if (!v) return ''; const m = Math.max(1, Math.round((Date.now() - new Date(v).getTime()) / 60000)); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
    const done = { connecting: 1, still_searching: 1, owner_marked: 2, disputed: 2, reunited: 4, not_mine: 0 }[status] ?? 1;
    const steps = [
      ['Confirmed', owner ? 'You confirmed it is your pet' : 'The owner confirmed it'],
      ['Contact', owner ? 'Call the finder' : 'The owner will call you'],
      ['Handover', `${pet} goes home`],
      ['Reunited', 'Both of you confirm']
    ];
    const stepper = status === 'not_mine' ? '' : `<ol class="rc-steps">${steps.map(([t, h], i) =>
      `<li class="${i < done ? 'is-done' : i === done ? 'is-active' : ''}"><span class="rc-dot">${i < done ? '&#10003;' : i + 1}</span><span class="rc-step-text"><b>${t}</b><small>${h}</small></span></li>`).join('')}</ol>`;

    const moved = !!d.moved_on_at;
    let banner = {
      connecting: owner ? 'Contact the finder to arrange the handover.' : 'The owner will contact you to collect the pet. Keep your phone nearby.',
      still_searching: 'You are still searching. This sighting stays on the map as a lead.',
      owner_marked: owner ? 'You marked the pet as found. Waiting for the finder to confirm that it went home.' : 'The owner says the pet is home. Please confirm below.',
      disputed: owner ? 'The finder says the pet did not go home. Please contact them.' : 'You said the pet did not go home. The owner has been told.',
      reunited: owner ? 'Reunion complete. Welcome home!' : 'Reunion complete. Thank you for helping this pet get home!',
      not_mine: owner ? 'Closed: you said this was not your pet.' : 'Closed: the owner checked and it was not their pet.'
    }[status] || '';
    if (moved && ['connecting', 'still_searching'].includes(status)) {
      banner = owner
        ? `${pet} moved on from this spot. We asked the finder and others who reported ${pet} to look nearby.`
        : `The owner says ${pet} left that spot. Did you see where it went?`;
    }
    const bannerCls = status === 'reunited' ? 'is-ok' : (status === 'disputed' || status === 'not_mine') ? 'is-bad' : 'is-wait';

    const showContact = !['reunited', 'not_mine'].includes(status);
    const tel = String(d.counterpart_phone || '').replace(/[^+\d]/g, '');
    const contact = showContact ? (d.counterpart_phone
      ? `<a class="cd-call" href="tel:${esc(tel)}"><span class="cd-call-icon"><i data-lucide="phone"></i></span><span class="cd-call-text"><small>Call ${esc(d.counterpart_name)}</small><strong>${esc(d.counterpart_phone)}</strong></span><span class="cd-call-go">Tap to call</span></a>`
      : `<p class="cd-nophone">${esc(d.counterpart_name)} did not leave a number yet. They can reach you on the number you gave.</p>`) : '';

    const movedTips = owner && d.moved_on_at && ['connecting', 'still_searching'].includes(status) ? `
      <div class="rc-tips"><h4>Search nearby</h4><ul>
        <li>Walk or drive the streets around that spot, calling ${esc(pet)} by name.</li>
        <li>Ask neighbours, guards and shop owners if they have seen ${esc(pet)}.</li>
        <li>Keep your phone on in case the finder or a neighbour calls.</li>
        <li>Check shelters and the Found a Pet list for new sightings.</li>
      </ul></div>` : '';
    const tips = movedTips || (owner && ['connecting', 'still_searching'].includes(status) ? `
      <div class="rc-tips"><h4>Meeting safely</h4><ul>
        <li>Meet in a public place, in daylight.</li>
        <li>Bring proof it is your pet: the Digital Pass, photos, or the vaccination card.</li>
        <li>Check the pet's condition before you leave, and never send money first.</li>
      </ul></div>` : '');

    let actions = '';
    if (owner && ['connecting', 'still_searching'].includes(status)) {
      actions = `<div class="rc-actions">
        <button type="button" class="btn btn-primary rc-primary" data-case="reunited"><i data-lucide="party-popper"></i> ${moved ? `${esc(pet)} was found` : 'We are reunited'}</button>
        <div class="rc-row">
          <button type="button" class="btn btn-outline btn-sm" data-case="notmine"><i data-lucide="x-circle"></i> Not my pet</button>
          ${d.moved_on_at ? '' : '<button type="button" class="btn btn-outline btn-sm" data-case="movedon"><i data-lucide="footprints"></i> It left that spot</button>'}
        </div></div>`;
    } else if (!owner && d.moved_on_at && ['connecting', 'still_searching'].includes(status)) {
      actions = `<div class="rc-actions"><button type="button" class="btn btn-primary rc-primary" data-case="newsighting"><i data-lucide="map-pin"></i> I saw where it went</button></div>`;
    } else if (!owner && status === 'owner_marked' && !d.finder_answer) {
      actions = `<div class="rc-actions"><div class="rc-row rc-row-2">
        <button type="button" class="btn btn-outline" data-case="no">Not yet</button>
        <button type="button" class="btn btn-primary" data-case="yes"><i data-lucide="check"></i> Yes, ${esc(pet)} went home</button>
      </div></div>`;
    }

    body.innerHTML = `
      <div class="rc">
        <section class="rc-pet">
          <img src="${esc(d.pet_photo || window.PET_PHOTO_PLACEHOLDER)}" alt="" onerror="this.src='${window.PET_PHOTO_PLACEHOLDER}'" />
          <div><small>${owner ? 'Your pet' : 'The pet you reported'}</small><strong>${esc(pet)}</strong>
            <span><i data-lucide="map-pin"></i> ${esc(String(d.location || '').replace(/\s*\([^()]*\)\s*$/, ''))}</span>
            ${d.moved_on_at ? '<em class="rc-moved">Pet moved on from this spot</em>' : ''}</div>
        </section>
        ${stepper}
        <div class="cd-status ${bannerCls === 'is-ok' ? 'is-reunited' : bannerCls === 'is-bad' ? 'is-discarded' : 'is-pending'}"><i data-lucide="${status === 'reunited' ? 'party-popper' : status === 'not_mine' || status === 'disputed' ? 'alert-circle' : 'clock'}"></i><span>${esc(banner)}</span></div>
        ${contact}
        ${tips}
        <ul class="cd-timeline"><li><span>Confirmed</span><b>${esc(ago(d.owner_confirmed_at))}</b></li>${d.owner_marked_at ? `<li><span>Marked found</span><b>${esc(ago(d.owner_marked_at))}</b></li>` : ''}${d.finder_answered_at ? `<li><span>Finder answered</span><b>${esc(ago(d.finder_answered_at))}</b></li>` : ''}</ul>
        ${actions}
      </div>`;
    if (!body.__caseBound) {
      body.__caseBound = true;
      body.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-case]');
        if (b) this.caseAction(b);
      });
    }
    if (window.lucide) window.lucide.createIcons({ root: body });
  }

  // Buttons on the case screen. Destructive answers ask for a second tap.
  async caseAction(btn) {
    const act = btn.dataset.case;
    const d = this.currentCase;
    const store = window.pawStore;
    if (!d) return;
    if ((act === 'notmine' || act === 'no') && btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      btn.dataset.label = btn.innerHTML;
      btn.textContent = 'Tap again to confirm';
      setTimeout(() => { if (btn.isConnected && btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.innerHTML = btn.dataset.label; } }, 4000);
      return;
    }
    if (act === 'newsighting') {
      // The finder reports where the pet went: Found a Pet with this missing pet chosen
      this.closeModal('reunion-case-modal');
      if (window.publicView && window.publicView.seenThisPet) window.publicView.seenThisPet(d.registered_pet_id || '', d.missing_report_id || '');
      return;
    }
    if (act === 'reunited') {
      // The owner shows the pet's condition and a photo together before the report closes
      this.closeModal('reunion-case-modal');
      if (window.publicView && window.publicView.openMarkFound) window.publicView.openMarkFound(d.registered_pet_id || d.missing_report_id);
      return;
    }
    btn.disabled = true;
    let res;
    let done = '';
    if (act === 'notmine') { res = await store.ownerCaseResponse(d.id, 'not_mine'); done = 'Closed. The finder was thanked and told.'; }
    else if (act === 'movedon') { res = await store.markSightingMovedOn(d.sighting_id); done = 'Noted. The finder and others who reported this pet were asked to look nearby.'; }
    else if (act === 'yes') { res = await store.finderConfirmHandover(d.id, true); done = 'Thank you! The owner was told.'; }
    else if (act === 'no') { res = await store.finderConfirmHandover(d.id, false); done = 'Thanks. The owner was told.'; }
    if (!res || !res.ok) {
      btn.disabled = false;
      this.showToast((res && res.error) || 'Could not save that. Please try again.', 'danger', 5000);
      return;
    }
    this.showToast(done, 'success', 4500);
    store.syncFromSupabase();
    const fresh = await store.getCaseDetails(d.id);
    if (fresh) this.renderReunionCase(fresh);
  }

  showFinderInfo(itemOrId) {
    let data = itemOrId;
    if (typeof itemOrId === 'string') {
      const notifs = window.pawStore ? window.pawStore.getNotifications() : [];
      data = notifs.find(n => String(n.id) === String(itemOrId));
      if (!data && window.pawStore) {
        const sightings = window.pawStore.getSightings() || [];
        data = sightings.find(s => String(s.id) === String(itemOrId));
      }
      if (!data && window.pawStore) {
        const cases = window.pawStore.getCases() || [];
        data = cases.find(c => String(c.id) === String(itemOrId) || String(c.petId) === String(itemOrId));
      }
    }
    if (!data) return;

    // Close notification dropdown panel and account dropdown
    const notifDropdown = document.getElementById('notif-dropdown-panel');
    if (notifDropdown) notifDropdown.style.display = 'none';
    const userDropdown = document.getElementById('user-account-dropdown');
    if (userDropdown) userDropdown.style.display = 'none';

    const modal = document.getElementById('finder-info-modal');
    if (!modal) return;

    // Mark notification read if matching
    const notifIdToMark = data.id || itemOrId;
    if (window.pawStore) {
      window.pawStore.markNotificationRead(notifIdToMark);
    }
    const notifs = window.pawStore ? window.pawStore.getNotifications() : [];
    const targetNotif = notifs.find(n => String(n.id) === String(notifIdToMark));
    if (targetNotif && !targetNotif.read) {
      targetNotif.read = true;
      localStorage.setItem('pawtrack_notifications', JSON.stringify(notifs));
    }
    this.renderNotifDropdown();

    // Look up pet info if available
    let pet = null;
    if (data.petId && window.pawStore) pet = window.pawStore.getPetById(data.petId);
    if (!pet && data.nfcTag && window.pawStore) pet = window.pawStore.getPetByNFC(data.nfcTag);
    if (!pet && data.title && window.pawStore) {
      const nameMatch = data.title.match(/"([^"]+)"/);
      if (nameMatch) {
        const pets = window.pawStore.getPets() || [];
        pet = pets.find(p => (p.name || '').toUpperCase() === nameMatch[1].toUpperCase());
      }
    }

    const petNameElem = document.getElementById('finder-pet-name');
    const petNfcElem = document.getElementById('finder-pet-nfc');
    const petPhotoElem = document.getElementById('finder-pet-photo');
    const sightingWrap = document.getElementById('finder-sighting-photo-wrap');
    const sightingImg = document.getElementById('finder-sighting-photo');
    const personNameElem = document.getElementById('finder-person-name');
    const personPhoneElem = document.getElementById('finder-person-phone');
    const callBtn = document.getElementById('finder-call-btn');
    const notesElem = document.getElementById('finder-notes-box');
    const locElem = document.getElementById('finder-location-name');
    const timeElem = document.getElementById('finder-timestamp');

    const displayName = pet ? pet.name : (data.petName || data.breed || 'Community Pet');
    const displayNfc = data.nfcTag || (pet ? pet.nfcTag : null);
    const photoSrc = (pet && pet.photoUrl) ? pet.photoUrl : (data.photoUrl || data.photo || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=300&q=80');
    const evidencePhoto = data.photoUrl || data.photo;
    
    let rawPhone = data.finderPhone || data.reporterPhone;
    if (!rawPhone && data.message) {
      const phoneMatch = data.message.match(/Contact:\s*(\+?[0-9\s-]+)/i);
      if (phoneMatch) rawPhone = phoneMatch[1].trim();
    }
    const phone = rawPhone || '+63 917 888 9999';
    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    let rawNotes = data.finderNotes || data.comments || data.notes;
    if (!rawNotes && data.message) {
      const msgNotesMatch = data.message.match(/Notes:\s*"?([^"]+)"?/i);
      if (msgNotesMatch) {
        rawNotes = msgNotesMatch[1].trim();
      } else {
        rawNotes = data.message;
      }
    }
    let cleanNotes = (rawNotes || 'Pet is safe with community finder.').trim();
    if (cleanNotes.startsWith('"') && cleanNotes.endsWith('"')) {
      cleanNotes = cleanNotes.slice(1, -1).trim();
    }

    let loc = data.location;
    if (!loc && data.message) {
      const locMatch = data.message.match(/near\s+([^.]+)\./i);
      if (locMatch) loc = locMatch[1].trim();
    }
    if (!loc) loc = 'Metro Manila, Philippines';

    if (petNameElem) petNameElem.textContent = displayName;
    if (petNfcElem) petNfcElem.textContent = displayNfc ? `NFC: ${displayNfc}` : 'NFC: Not Detected';
    if (petPhotoElem) petPhotoElem.src = photoSrc;

    if (sightingWrap && sightingImg) {
      if (evidencePhoto) {
        sightingImg.src = evidencePhoto;
        sightingWrap.style.display = 'block';
      } else {
        sightingWrap.style.display = 'none';
      }
    }

    if (personNameElem) personNameElem.textContent = data.finderName || data.reporterName || 'Community Good Samaritan';
    if (personPhoneElem) personPhoneElem.textContent = phone;
    if (callBtn) callBtn.href = `tel:${cleanPhone}`;
    if (notesElem) notesElem.textContent = `"${cleanNotes}"`;
    if (locElem) locElem.textContent = loc;
    if (timeElem) timeElem.textContent = data.timestamp ? new Date(data.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently Reported';

    this.lastFinderCoords = data.coords || [14.6500, 121.0400];

    const bodyContainer = modal.querySelector('.finder-modal-body');
    if (bodyContainer) bodyContainer.scrollTop = 0;

    modal.classList.add('active');
  }

  jumpToFinderLocation() {
    this.closeModal('finder-info-modal');
    window.location.hash = '#owner';
    if (this.lastFinderCoords && window.publicView) {
      setTimeout(() => {
        if (window.publicView && window.publicView.map) {
          window.publicView.map.flyTo(this.lastFinderCoords, 16, { duration: 0.8 });
        }
        document.getElementById('incident-map-section')?.scrollIntoView({behavior:'smooth'});
      }, 250);
    }
  }

  showSmsSimulation(data) {
    const modal = document.getElementById('sms-simulator-modal');
    if (!modal) return;

    const phoneElem = document.getElementById('sim-sms-phone');
    const timeElem = document.getElementById('sim-sms-time');
    const bodyElem = document.getElementById('sim-sms-body');

    if (phoneElem) phoneElem.innerText = data.ownerPhone || '+63 917 555 3829';
    if (timeElem) timeElem.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (bodyElem) {
      bodyElem.innerHTML = `
        <div style="font-weight:700; color:#ea9d1e; margin-bottom:6px; letter-spacing:0.02em;">OFFICIAL NOTICE: PET IMPOUNDMENT</div>
        Your registered pet <strong>"${data.petName}"</strong> (NFC: <code>${data.nfcTag}</code>) has been logged at <strong>${data.shelterName}</strong>.<br><br>
        <strong>Facility Address:</strong> ${data.shelterAddress}<br>
        <strong>Holding Bay:</strong> ${data.cageNumber || 'Bay 01'}<br>
        <strong>Claim Window:</strong> 72 Hours from intake.<br><br>
        Please present a Valid ID and Pet Vaccination Book upon claiming. Contact: ${data.shelterPhone || '+63 (2) 8988-4242'}.
      `;
    }

    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons({ root: modal });
  }

  showGmailPinSimulation(email) {
    this.showToast(`Verification PIN has been sent directly to your Gmail (${email || 'active account'}). Please check your primary inbox.`, 'info');
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
      if (window.lucide) window.lucide.createIcons({ root: modal });
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }

  // =========================================================
  // OWNER SIGHTING VERIFICATION METHODS
  // =========================================================

  openSightingVerificationModal(sightingIdOrData) {
    let sighting = null;
    if (typeof sightingIdOrData === 'object' && sightingIdOrData !== null) {
      sighting = sightingIdOrData;
    } else if (window.pawStore) {
      sighting = window.pawStore.getSightingById(sightingIdOrData);
      if (!sighting) {
        const sightings = window.pawStore.getSightings() || [];
        sighting = sightings.find(s => String(s.id) === String(sightingIdOrData) || String(s.missing_report_id) === String(sightingIdOrData));
      }
    }

    if (!sighting) {
      this.showToast('Sighting details not found or already archived.', 'info');
      return;
    }

    // Close notification panel if open
    const notifDropdown = document.getElementById('notif-dropdown-panel');
    if (notifDropdown) notifDropdown.style.display = 'none';

    // Find linked pet
    let pet = null;
    if (sighting.petId && window.pawStore) {
      pet = window.pawStore.getPetById(sighting.petId);
    }
    if (!pet && sighting.missing_report_id && window.pawStore) {
      const rep = window.pawStore.getMissingReportById(sighting.missing_report_id);
      if (rep && rep.petId) {
        pet = window.pawStore.getPetById(rep.petId);
      }
    }
    if (!pet && sighting.matchedPetId && window.pawStore) {
      pet = window.pawStore.getPetById(sighting.matchedPetId);
    }
    if (!pet && window.pawStore) {
      // Fallback to active missing pet
      const lostPets = window.pawStore.getPets().filter(p => p.status === 'lost');
      if (lostPets.length > 0) pet = lostPets[0];
    }

    // Populate hidden fields
    const hiddenSightingId = document.getElementById('verification-sighting-id');
    const hiddenPetId = document.getElementById('verification-pet-id');
    if (hiddenSightingId) hiddenSightingId.value = sighting.id;
    if (hiddenPetId) hiddenPetId.value = pet ? pet.id : (sighting.petId || '');

    // Status Pill
    const statusDot = document.getElementById('verification-status-dot');
    const statusBadge = document.getElementById('verification-status-badge');
    const timeElapsed = document.getElementById('verification-time-elapsed');

    const isConfirmed = sighting.status === 'confirmed_sighting';
    if (statusDot) statusDot.style.background = isConfirmed ? '#22c55e' : '#ea9d1e';
    if (statusBadge) {
      statusBadge.textContent = isConfirmed ? 'CONFIRMED SIGHTING' : 'POSSIBLE SIGHTING';
      statusBadge.style.background = isConfirmed ? 'rgba(34,197,94,0.15)' : 'rgba(234,157,30,0.15)';
      statusBadge.style.color = isConfirmed ? '#16a34a' : '#ea9d1e';
      statusBadge.style.borderColor = isConfirmed ? 'rgba(34,197,94,0.3)' : 'rgba(234,157,30,0.3)';
    }

    // Compute relative time
    if (timeElapsed && sighting.dateTimeSeen) {
      const diffMs = Date.now() - new Date(sighting.dateTimeSeen).getTime();
      const diffMins = Math.max(1, Math.round(diffMs / 60000));
      if (diffMins < 60) {
        timeElapsed.textContent = `Reported ${diffMins}m ago`;
      } else {
        const diffHours = Math.round(diffMins / 60);
        timeElapsed.textContent = `Reported ${diffHours}h ago`;
      }
    }

    // Populate Left Column: Registered Pet Profile
    const verifyRegPhoto = document.getElementById('verify-reg-photo');
    const verifyRegName = document.getElementById('verify-reg-name');
    const verifyRegBreed = document.getElementById('verify-reg-breed');
    const verifyRegColor = document.getElementById('verify-reg-color');
    const verifyRegNfc = document.getElementById('verify-reg-nfc');
    const verifyRegLastSeen = document.getElementById('verify-reg-last-seen');
    const verifyRegCommunity = document.getElementById('verify-reg-community');

    if (pet) {
      if (verifyRegPhoto) verifyRegPhoto.src = pet.photoUrl;
      if (verifyRegName) verifyRegName.textContent = pet.name;
      if (verifyRegBreed) verifyRegBreed.textContent = `${pet.species || 'Dog'} · ${pet.breed || 'Breed'}`;
      if (verifyRegColor) verifyRegColor.textContent = `${pet.gender || 'Unknown'} · ${pet.color || 'Standard markings'}`;
      if (verifyRegNfc) verifyRegNfc.textContent = pet.nfcTag ? `NFC: ${pet.nfcTag}` : 'No NFC recorded';
      if (verifyRegLastSeen) verifyRegLastSeen.textContent = pet.lastSeenLocation || (pet.owner ? pet.owner.address : 'Metro Manila');
      if (verifyRegCommunity) verifyRegCommunity.textContent = pet.community || (pet.owner ? pet.owner.address : 'Philam Homes, QC');
    } else {
      if (verifyRegPhoto) verifyRegPhoto.src = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=400&q=80';
      if (verifyRegName) verifyRegName.textContent = sighting.breed || 'Registered Pet';
      if (verifyRegBreed) verifyRegBreed.textContent = `${sighting.species || 'Dog'} · ${sighting.breed || 'Mixed'}`;
      if (verifyRegColor) verifyRegColor.textContent = sighting.color || 'Observed coat color';
      if (verifyRegNfc) verifyRegNfc.textContent = 'NFC verification pending';
      if (verifyRegLastSeen) verifyRegLastSeen.textContent = 'Community Alert';
      if (verifyRegCommunity) verifyRegCommunity.textContent = 'Metro Manila';
    }

    // Populate Right Column: Sighting Report
    const verifySightPhoto = document.getElementById('verify-sight-photo');
    const verifySightLocation = document.getElementById('verify-sight-location');
    const verifySightDatetime = document.getElementById('verify-sight-datetime');
    const verifySightReporter = document.getElementById('verify-sight-reporter');
    const verifySightPhone = document.getElementById('verify-sight-phone');
    const verifySightNotes = document.getElementById('verify-sight-notes');

    const photoSrc = sighting.photoUrl || sighting.photo || (pet ? pet.photoUrl : '');
    if (verifySightPhoto) verifySightPhoto.src = photoSrc;
    if (verifySightLocation) verifySightLocation.textContent = sighting.location || 'Reported landmark';
    if (verifySightDatetime) {
      verifySightDatetime.textContent = sighting.dateTimeSeen 
        ? new Date(sighting.dateTimeSeen).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : 'Recently reported';
    }

    // Everything the finder filled in: kind of pet and assumed breed, place name and description, condition
    const verifySightBreed = document.getElementById('verify-sight-breed');
    if (verifySightBreed) verifySightBreed.textContent = [sighting.species, window.pawStore.sightingBreed(sighting)].filter(Boolean).join(' · ') || 'Not specified';

    // The finder's place description is saved in brackets after the place name: "Place name (near the park gate)"
    const placeMatch = String(sighting.location || '').match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (placeMatch && verifySightLocation) verifySightLocation.textContent = placeMatch[1] || sighting.location;
    const descRow = document.getElementById('verify-sight-placedesc-row');
    const descEl = document.getElementById('verify-sight-placedesc');
    if (descRow && descEl) {
      descEl.textContent = placeMatch ? placeMatch[2] : '';
      descRow.hidden = !(placeMatch && placeMatch[2].trim());
    }
    this.showVerificationMap(sighting);

    if (verifySightReporter) verifySightReporter.textContent = sighting.reporterName || 'Community Good Samaritan';
    if (verifySightPhone) verifySightPhone.textContent = sighting.reporterPhone || '+63 9XX XXX XXXX';
    const rawNotes = String(sighting.comments || sighting.notes || '').trim();
    const condition = rawNotes.match(/^pet condition:\s*([\s\S]*)$/i);
    const notesLabel = document.getElementById('verify-sight-notes-label');
    if (notesLabel) notesLabel.textContent = condition ? 'Pet condition:' : 'Finder Observations / Notes:';
    if (verifySightNotes) verifySightNotes.textContent = `"${condition ? condition[1] : (rawNotes || 'Spotted moving in area.')}"`;

    this.openModal('sighting-verification-modal');
  }

  // Small map with a pin where the finder found the pet (hidden when the report has no coordinates)
  async showVerificationMap(sighting) {
    const el = document.getElementById('verify-sight-map');
    if (!el) return;
    const lat = sighting.coords ? Number(sighting.coords[0]) : Number(sighting.lat);
    const lng = sighting.coords ? Number(sighting.coords[1]) : Number(sighting.lng);
    if (this.verifyMap) { try { this.verifyMap.remove(); } catch (e) {} this.verifyMap = null; }
    el.innerHTML = '';
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { el.hidden = true; return; }
    el.hidden = false;
    try { await window.PawMapsReady; } catch (e) { /* the map is optional */ }
    if (!window.L || !document.getElementById('verify-sight-map') || el.hidden) { el.hidden = true; return; }
    this.verifyMap = window.L.map(el, { scrollWheelZoom: false, zoomControl: true, doubleClickZoom: false }).setView([lat, lng], 16);
    window.L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(this.verifyMap);
    window.L.marker([lat, lng], {
      icon: window.L.divIcon({
        className: 'verify-pin',
        html: '<div style="width:20px;height:20px;border-radius:50%;background:#ba3820;border:3px solid #fff;transform:translate(-50%,-50%);box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>',
        iconSize: [0, 0], iconAnchor: [0, 0]
      })
    }).addTo(this.verifyMap);
    setTimeout(() => this.verifyMap && this.verifyMap.invalidateSize(), 250);
  }

  async handleVerificationDecision(isMatch) {
    const hiddenSightingId = document.getElementById('verification-sighting-id');
    const sightingId = hiddenSightingId ? hiddenSightingId.value : null;

    if (!sightingId) {
      this.closeModal('sighting-verification-modal');
      return;
    }

    if (isMatch) {
      if (window.pawStore) {
        window.pawStore.confirmSighting(sightingId);
      }
      const yesBtn = document.getElementById('verify-decision-yes-btn');
      if (yesBtn) yesBtn.disabled = true;
      // The database confirms it, opens the reunion case and tells the finder
      const result = window.pawStore ? await window.pawStore.confirmSightingRpc(sightingId) : { ok: false };
      if (yesBtn) yesBtn.disabled = false;
      this.showToast('Confirmed as your pet. The finder has been told.', 'success', 5000);

      // Update in-modal badge
      const statusBadge = document.getElementById('verification-status-badge');
      if (statusBadge) {
        statusBadge.textContent = 'CONFIRMED SIGHTING';
        statusBadge.style.background = 'rgba(34,197,94,0.15)';
        statusBadge.style.color = '#16a34a';
        statusBadge.style.borderColor = 'rgba(34,197,94,0.3)';
      }
      const statusDot = document.getElementById('verification-status-dot');
      if (statusDot) statusDot.style.background = '#22c55e';

      const confirmed = window.pawStore.getSightingById(sightingId) || {};
      const rep = confirmed.missing_report_id ? window.pawStore.getMissingReportById(confirmed.missing_report_id) : null;
      const reunionPetId = (rep && (rep.petId || rep.id)) || confirmed.petId || null;

      setTimeout(() => {
        this.closeModal('sighting-verification-modal');
        if (window.publicView && window.location.hash === '#map') {
          window.publicView.render(document.getElementById('app-viewport'));
        }
        if (window.ownerView && window.location.hash === '#owner') {
          window.ownerView.render(document.getElementById('app-viewport'));
        }
        if (result.ok && result.caseId) {
          this.openReunionCase(result.caseId); // next steps: call the finder, meet safely, mark reunited
        } else if (reunionPetId && window.publicView && window.publicView.openMarkFound) {
          window.publicView.openMarkFound(reunionPetId);
        }
        if (window.sightingsView && window.location.hash === '#sightings') window.sightingsView.refresh();
      }, 600);
    } else {
      if (window.pawStore) {
        window.pawStore.dismissSighting(sightingId);
      }
      this.showToast("Sighting dismissed. Pin archived from the active map to prevent clutter.", 'info', 4500);
      this.closeModal('sighting-verification-modal');

      if (window.publicView && window.location.hash === '#map') {
        window.publicView.render(document.getElementById('app-viewport'));
      }
      if (window.ownerView && window.location.hash === '#owner') {
        window.ownerView.render(document.getElementById('app-viewport'));
      }
    }
  }
}

window.notifManager = new NotificationManager();
