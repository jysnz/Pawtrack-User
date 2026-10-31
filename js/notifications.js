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

    if (notif.type === 'sighting_verification' || notif.sightingId) {
      this.openSightingVerificationModal(notif.sightingId || notif.id);
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
    const verifySightCoords = document.getElementById('verify-sight-coords');
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
    const coordsStr = sighting.coords 
      ? `${sighting.coords[0].toFixed(4)}, ${sighting.coords[1].toFixed(4)}`
      : (sighting.lat && sighting.lng ? `${sighting.lat.toFixed(4)}, ${sighting.lng.toFixed(4)}` : '14.6500, 121.0350');
    if (verifySightCoords) verifySightCoords.textContent = coordsStr;

    if (verifySightReporter) verifySightReporter.textContent = sighting.reporterName || 'Community Good Samaritan';
    if (verifySightPhone) verifySightPhone.textContent = sighting.reporterPhone || '+63 9XX XXX XXXX';
    if (verifySightNotes) verifySightNotes.textContent = `"${sighting.comments || sighting.notes || 'Spotted moving in area.'}"`;

    this.openModal('sighting-verification-modal');
  }

  handleVerificationDecision(isMatch) {
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
      this.showToast('YES! Sighting Confirmed as Your Pet! Location verified on Community Map.', 'success', 5500);

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

      setTimeout(() => {
        this.closeModal('sighting-verification-modal');
        if (window.publicView && window.location.hash === '#map') {
          window.publicView.render(document.getElementById('app-viewport'));
        }
        if (window.ownerView && window.location.hash === '#owner') {
          window.ownerView.render(document.getElementById('app-viewport'));
        }
      }, 900);
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
