/**
 * PawTrack Admin — Notification & Broadcast Dispatch Center
 * Emergency broadcasts, urgent impound notice dispatch, and delivery status logs
 */

window.NotifsView = {
  render(container) {
    const store = window.adminStore;
    const notifs = store.getNotifications();
    const unreadCount = notifs.filter(n => !n.read).length;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Alerts</h1>
          <div class="subtitle">
            <span>Messages sent to registered pet owners</span>
          </div>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary" id="btn-mark-all-read">
            Mark All Read
          </button>
          <button class="btn btn-primary" id="btn-compose-broadcast">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            Dispatch Broadcast
          </button>
        </div>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="kpi-grid kpi-grid-2">
        <div class="kpi-card">
          <div class="kpi-label">Active Alerts</div>
          <div class="kpi-body">
            <div>
              <div class="kpi-value">${notifs.length} Sent</div>
              <div class="kpi-delta neutral">Total system notifications</div>
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Unread by Owners</div>
          <div class="kpi-body">
            <div>
              <div class="kpi-value">${unreadCount} Pending</div>
              <div class="kpi-delta ${unreadCount > 0 ? 'down' : 'up'}">${unreadCount} unread items</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Notification Feed List -->
      <div class="table-container">
        <div class="table-toolbar">
          <span style="font-size: 12px; font-weight: 700; color: var(--ink-primary);">Dispatched Alerts Feed</span>
        </div>

        <div style="display: flex; flex-direction: column; padding: 6px 0;">
          ${notifs.length === 0 ? `
            <div style="text-align: center; padding: 40px; color: var(--ink-muted);">
              No notifications dispatched yet.
            </div>
          ` : notifs.map(n => `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 18px; border-bottom: 1px solid var(--border-light); background: ${n.read ? 'transparent' : 'var(--brand-terracotta-subtle)'};">
              <div style="display: flex; gap: 12px; align-items: flex-start; min-width: 0;">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; background: var(--bg-card-subtle); border: 1px solid var(--border-main); color: ${n.type === 'impound_alert' ? 'var(--color-red)' : (n.type === 'reunited' ? 'var(--color-green)' : 'var(--brand-terracotta)')}; flex-shrink: 0; margin-top: 2px;">
                  ${n.type === 'impound_alert' 
                    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' 
                    : (n.type === 'reunited' 
                      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>' 
                      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>')}
                </span>
                <div style="display: flex; flex-direction: column; gap: 3px;">
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <b style="font-size: 13px; color: var(--ink-primary);">${n.title}</b>
                    ${n.targetAudience ? `<span class="status-pill status-safe" style="font-size: 9px; padding: 1px 6px;">📍 ${n.targetAudience}</span>` : ''}
                    ${!n.read ? `<span class="status-pill status-impounded" style="font-size: 8.5px; padding: 1px 5px;">UNREAD</span>` : ''}
                  </div>
                  <p style="font-size: 12px; color: var(--ink-secondary); margin: 0; line-height: 1.4;">${n.message}</p>
                  <span style="font-size: 10px; font-family: var(--font-mono); color: var(--ink-muted); margin-top: 3px;">
                    ${new Date(n.timestamp).toLocaleString()} ${n.petId ? `· Pet Ref: ${n.petId}` : ''}
                  </span>
                </div>
              </div>

              <button class="btn btn-sm btn-danger btn-delete-notif" data-id="${n.id}" style="margin-left: 14px;">
                Delete
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.attachEvents(container);
  },

  attachEvents(container) {
    const store = window.adminStore;

    container.querySelector('#btn-mark-all-read')?.addEventListener('click', () => {
      store.markAllNotificationsRead();
      window.adminApp.showToast('All notifications marked as read', 'success');
      this.render(container);
    });

    container.querySelector('#btn-compose-broadcast')?.addEventListener('click', () => {
      this.openBroadcastModal();
    });

    container.querySelectorAll('.btn-delete-notif').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        store.deleteNotification(id);
        window.adminApp.showToast('Deleted notification', 'warning');
        this.render(container);
      });
    });
  },

  openBroadcastModal() {
    const store = window.adminStore;

    const modalHtml = `
      <div class="modal-header">
        <div class="nock-card-title">Compose Emergency Broadcast (Quezon City)</div>
        <button class="icon-btn-subtle" id="broadcast-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="broadcast-form" class="form-grid">
          <div class="form-group form-full">
            <label class="form-label">Broadcast Preset Type</label>
            <select class="form-control" id="broadcast-preset">
              <option value="custom">-- Custom Alert Message --</option>
              <option value="flood">Severe Weather / Flood Evacuation Advisory</option>
              <option value="rabies">Free Municipal Anti-Rabies Vaccination Drive</option>
              <option value="pound">Scheduled Stray Animal Control Operation in Sector</option>
            </select>
          </div>

          <div class="form-group form-full">
            <label class="form-label">Alert Headline / Title *</label>
            <input type="text" class="form-control" name="title" id="broadcast-title" placeholder="e.g. Urgent Pet Evacuation Advisory" required />
          </div>

          <div class="form-group form-full">
            <label class="form-label">Notification Body Message *</label>
            <textarea class="form-control" name="message" id="broadcast-msg" placeholder="Write message to registered Quezon City pet owners..." required style="min-height: 90px;"></textarea>
          </div>

          <div class="form-group form-full">
            <label class="form-label">Broadcast Target Audience (Quezon City Districts)</label>
            <select class="form-control" name="target" id="broadcast-target">
              <option value="qc_all">All Registered Pet Owners (Quezon City Wide)</option>
              <option value="qc_d1">District 1 (La Loma, SFDM, Balingasa, Project 6, Santa Teresita)</option>
              <option value="qc_d2">District 2 (Batasan Hills, Payatas, Commonwealth, Bagong Silangan, Holy Spirit)</option>
              <option value="qc_d3">District 3 (Cubao, Quirino, Project 4, Loyola Heights, Libis, E. Rodriguez)</option>
              <option value="qc_d4">District 4 (Diliman, New Manila, South Triangle, Teachers Village, Tomas Morato)</option>
              <option value="qc_d5">District 5 (Novaliches, Fairview, Gulod, San Bartolome, Greater Lagro)</option>
              <option value="qc_d6">District 6 (Balintawak, Tandang Sora, Pasong Tamo, Culiat, Talipapa, Sauyo)</option>
            </select>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="broadcast-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="broadcast-send-btn">Dispatch to QC Owners</button>
      </div>
    `;

    const modal = window.adminApp.openModalContent(modalHtml);

    const presetSelect = modal.querySelector('#broadcast-preset');
    const titleInput = modal.querySelector('#broadcast-title');
    const msgInput = modal.querySelector('#broadcast-msg');

    presetSelect?.addEventListener('change', () => {
      const val = presetSelect.value;
      if (val === 'flood') {
        titleInput.value = 'Typhoon Alert: Quezon City Pet Safety Protocol';
        msgInput.value = 'Due to rising water levels in low-lying areas and waterways across Quezon City, please keep all tagged pets indoors and verify RFID collars.';
      } else if (val === 'rabies') {
        titleInput.value = 'Notice: Free Anti-Rabies Vaccination Drive';
        msgInput.value = 'Free rabies booster shots and microchip registration available at Quezon City Animal Care & Adoption Facility (Payatas) this Saturday 8AM-3PM.';
      } else if (val === 'pound') {
        titleInput.value = 'Advisory: Animal Control Field Operations Active';
        msgInput.value = 'Quezon City Animal Control units are conducting stray monitoring operations. Please ensure all registered pets remain within private premises.';
      }
    });

    modal.querySelector('#broadcast-close-btn')?.addEventListener('click', () => window.adminApp.closeModal());
    modal.querySelector('#broadcast-cancel-btn')?.addEventListener('click', () => window.adminApp.closeModal());

    modal.querySelector('#broadcast-send-btn')?.addEventListener('click', () => {
      const form = modal.querySelector('#broadcast-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const formData = new FormData(form);
      const targetSelect = form.querySelector('#broadcast-target');
      const targetVal = formData.get('target');
      const targetLabel = targetSelect?.options[targetSelect.selectedIndex]?.text || 'Quezon City Wide';

      store.addNotification({
        type: 'broadcast',
        title: formData.get('title'),
        message: formData.get('message'),
        target: targetVal,
        targetAudience: targetLabel
      });

      window.adminApp.closeModal();
      window.adminApp.showToast('Emergency broadcast dispatched to Quezon City owners!', 'success');
      window.adminApp.renderView('notifs');
    });
  }
};
