/**
 * PawTrack Admin — Notification & Broadcast Dispatch Center
 * Emergency broadcasts, urgent impound notice dispatch, and delivery status logs
 */

window.NotifsView = {
  // Admin-only operational alerts, derived from impound and missing-report data.
  // They are never stored as notifications, so pet owners never see them.
  buildOpsAlerts() {
    const store = window.adminStore;
    const HOUR = 3600 * 1000;
    const now = Date.now();
    const ts = (v) => { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0; };
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const alerts = [];

    const activeId = typeof store.getActiveFacilityId === 'function' ? store.getActiveFacilityId() : null;
    const impounds = store.getImpoundments().filter(i => !activeId || i.shelterId === activeId);
    impounds.forEach(i => {
      const name = esc(i.petName || 'A pet');
      const where = esc(i.shelterName || 'the facility');
      if (i.status === 'claimed' && i.closedAt && now - ts(i.closedAt) <= 7 * 24 * HOUR) {
        alerts.push({ href: '#impoundments', kind: 'claimed', severity: 'ok', time: ts(i.closedAt), title: `${name} was claimed by their owner`, message: `The pet impounded at ${where} was released to their owner.` });
      } else if (i.status === 'active_impounded') {
        const deadline = ts(i.claimDeadline);
        if (deadline && deadline < now) {
          alerts.push({ href: '#impoundments', kind: 'overdue', severity: 'high', time: deadline, title: `Claim window ended for ${name}`, message: `Nobody claimed the pet held at ${where} before the deadline. Review the case.` });
        } else if (deadline && deadline - now <= 24 * HOUR) {
          alerts.push({ href: '#impoundments', kind: 'deadline', severity: 'warn', time: now, title: `${name} claim window ends within 24 hours`, message: `Held at ${where}. Extend the holding period or contact the owner.` });
        }
        if (ts(i.intakeDate) && now - ts(i.intakeDate) <= 24 * HOUR) {
          alerts.push({ href: '#impoundments', kind: 'intake', severity: 'info', time: ts(i.intakeDate), title: `${name} was impounded`, message: `New intake logged at ${where}.` });
        }
      }
    });

    const recentIntakes = impounds.filter(i => ts(i.intakeDate) && now - ts(i.intakeDate) <= 24 * HOUR).length;
    if (recentIntakes >= 3) {
      alerts.push({ href: '#impoundments', kind: 'surge', severity: 'high', time: now, title: 'Surge in impound intakes', message: `${recentIntakes} pets were impounded in the last 24 hours. Check facility capacity.` });
    }

    // Pets reported missing in an area this account's facilities cover (routed by the database on filing)
    const shelters = store.getShelters();
    const routed = typeof store.getRoutedReports === 'function' ? store.getRoutedReports() : [];
    routed.forEach(c => {
      const t = ts(c.createdAt);
      const age = now - t;
      if (!t || age > 7 * 24 * HOUR) return;
      const fresh = age <= 24 * HOUR;
      const place = [c.lastSeenBarangay, c.lastSeenCity].filter(Boolean).map(esc).join(', ') || esc(c.location || 'your coverage area');
      const via = (shelters.find(s => s.id === c.routedShelterId) || {}).name;
      const species = c.species ? ` (${esc(c.species)})` : '';
      alerts.push({
        href: `#reports/${encodeURIComponent(c.id)}`, cta: 'View report', fresh,
        photo: /^https:\/\//.test(c.photoUrl || '') ? c.photoUrl : '',
        kind: 'missing', severity: fresh ? 'high' : 'warn', time: t,
        title: `${esc(c.petName || 'A pet')}${species} was reported missing in your area`,
        message: `Last seen in ${place}.${via ? ` Routed to ${esc(via)}${c.routedVia === 'barangay' ? ' by barangay coverage' : ' as the city facility'}.` : ''} Watch for this pet at intake.`
      });
    });

    const cases = store.getCases();
    const last24 = cases.filter(c => now - ts(c.createdAt) <= 24 * HOUR).length;
    const prev7 = cases.filter(c => { const age = now - ts(c.createdAt); return age > 24 * HOUR && age <= 8 * 24 * HOUR; }).length;
    const dailyAvg = prev7 / 7;
    if (last24 >= 3 && last24 >= Math.max(3, dailyAvg * 2)) {
      alerts.push({
        href: '#reports', kind: 'surge', severity: 'high', time: now,
        title: 'Sudden surge in missing pet reports',
        message: `${last24} pets were reported missing in the last 24 hours, against about ${dailyAvg.toFixed(1)} a day over the past week.`
      });
    }

    const sightings = store.getSightings();
    const sightings24 = sightings.filter(s => now - ts(s.createdAt || s.timestamp) <= 24 * HOUR).length;
    if (sightings24 >= 5) {
      alerts.push({ href: '#reports', kind: 'surge', severity: 'warn', time: now, title: 'High volume of pet sightings', message: `${sightings24} sightings were reported in the last 24 hours.` });
    }

    const order = { high: 0, warn: 1, info: 2, ok: 3 };
    return alerts.sort((a, b) => order[a.severity] - order[b.severity] || b.time - a.time);
  },

  // "5 min ago", "3 h ago", "2 d ago"; older than a week falls back to the date
  ago(time) {
    const m = Math.max(0, Math.round((Date.now() - time) / 60000));
    if (m < 1) return 'Just now';
    if (m < 60) return `${m} min ago`;
    if (m < 1440) return `${Math.round(m / 60)} h ago`;
    if (m < 7 * 1440) return `${Math.round(m / 1440)} d ago`;
    return new Date(time).toLocaleDateString();
  },

  renderOpsAlerts() {
    const alerts = this.buildOpsAlerts();
    const colors = { high: 'var(--color-red)', warn: 'var(--brand-terracotta)', info: 'var(--ink-secondary)', ok: 'var(--color-green)' };
    const labels = { high: 'Urgent', warn: 'Attention', info: 'Info', ok: 'Done' };
    const icons = {
      surge: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
      claimed: '<polyline points="20 6 9 17 4 12"/>',
      overdue: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      deadline: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      intake: '<path d="M12 5v14M5 12h14"/>',
      missing: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'
    };
    const ctaDefault = { missing: 'View report', surge: 'View reports' };
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const row = (a) => {
      const color = colors[a.severity];
      const icon = `<span class="alert-icon" style="color: ${color};"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[a.kind]}</svg></span>`;
      const lead = a.photo ? `<img class="alert-photo" src="${esc(a.photo)}" alt="" loading="lazy" data-fallback>` : icon;
      const cta = a.cta || ctaDefault[a.kind] || 'Open';
      return `
        <a class="alert-item alert-${a.severity}" href="${esc(a.href || '#notifs')}" style="--alert-accent: ${color};">
          ${lead}
          <div class="alert-body">
            <div class="alert-head">
              <b class="alert-title">${a.title}</b>
              ${a.fresh ? '<span class="alert-new">New</span>' : ''}
            </div>
            <p class="alert-msg">${a.message}</p>
            <div class="alert-meta">
              <span class="alert-tag" style="color: ${color};">${labels[a.severity]}</span>
              <span title="${esc(new Date(a.time).toLocaleString())}">${this.ago(a.time)}</span>
            </div>
          </div>
          <span class="alert-go">
            <span class="alert-go-text">${esc(cta)}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </a>`;
    };
    return `
      <div class="table-container" id="ops-alerts">
        <div class="table-toolbar">
          <span style="font-size: 12px; font-weight: 700; color: var(--ink-primary);">Operations Alerts${alerts.length ? ` <span class="alert-count">${alerts.length}</span>` : ''}</span>
          <span style="font-size: 11px; color: var(--ink-muted);">Admin only. Owners do not see these. Tap an alert to open it.</span>
        </div>
        <div class="alert-list">
          ${alerts.length === 0 ? `
            <div style="text-align: center; padding: 28px; color: var(--ink-muted);">No impound, missing-pet or surge alerts right now.</div>
          ` : alerts.map(row).join('')}
        </div>
      </div>`;
  },

  render(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Alerts</h1>
          <div class="subtitle">
            <span>Pets reported missing in your area, impoundment activity and sudden surges</span>
          </div>
        </div>
      </div>

      ${this.renderOpsAlerts()}
    `;
    // A photo that fails to load falls back to the icon tile
    container.querySelectorAll('img.alert-photo[data-fallback]').forEach(img => {
      img.addEventListener('error', () => {
        const tile = document.createElement('span');
        tile.className = 'alert-icon';
        img.replaceWith(tile);
      }, { once: true });
    });
  }
};
