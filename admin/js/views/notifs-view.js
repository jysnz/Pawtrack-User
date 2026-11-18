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
        alerts.push({ kind: 'claimed', severity: 'ok', time: ts(i.closedAt), title: `${name} was claimed by their owner`, message: `The pet impounded at ${where} was released to their owner.` });
      } else if (i.status === 'active_impounded') {
        const deadline = ts(i.claimDeadline);
        if (deadline && deadline < now) {
          alerts.push({ kind: 'overdue', severity: 'high', time: deadline, title: `Claim window ended for ${name}`, message: `Nobody claimed the pet held at ${where} before the deadline. Review the case.` });
        } else if (deadline && deadline - now <= 24 * HOUR) {
          alerts.push({ kind: 'deadline', severity: 'warn', time: now, title: `${name} claim window ends within 24 hours`, message: `Held at ${where}. Extend the holding period or contact the owner.` });
        }
        if (ts(i.intakeDate) && now - ts(i.intakeDate) <= 24 * HOUR) {
          alerts.push({ kind: 'intake', severity: 'info', time: ts(i.intakeDate), title: `${name} was impounded`, message: `New intake logged at ${where}.` });
        }
      }
    });

    const recentIntakes = impounds.filter(i => ts(i.intakeDate) && now - ts(i.intakeDate) <= 24 * HOUR).length;
    if (recentIntakes >= 3) {
      alerts.push({ kind: 'surge', severity: 'high', time: now, title: 'Surge in impound intakes', message: `${recentIntakes} pets were impounded in the last 24 hours. Check facility capacity.` });
    }

    const cases = store.getCases();
    const last24 = cases.filter(c => now - ts(c.createdAt) <= 24 * HOUR).length;
    const prev7 = cases.filter(c => { const age = now - ts(c.createdAt); return age > 24 * HOUR && age <= 8 * 24 * HOUR; }).length;
    const dailyAvg = prev7 / 7;
    if (last24 >= 3 && last24 >= Math.max(3, dailyAvg * 2)) {
      alerts.push({
        kind: 'surge', severity: 'high', time: now,
        title: 'Sudden surge in missing pet reports',
        message: `${last24} pets were reported missing in the last 24 hours, against about ${dailyAvg.toFixed(1)} a day over the past week.`
      });
    }

    const sightings = store.getSightings();
    const sightings24 = sightings.filter(s => now - ts(s.createdAt || s.timestamp) <= 24 * HOUR).length;
    if (sightings24 >= 5) {
      alerts.push({ kind: 'surge', severity: 'warn', time: now, title: 'High volume of pet sightings', message: `${sightings24} sightings were reported in the last 24 hours.` });
    }

    const order = { high: 0, warn: 1, info: 2, ok: 3 };
    return alerts.sort((a, b) => order[a.severity] - order[b.severity] || b.time - a.time);
  },

  renderOpsAlerts() {
    const alerts = this.buildOpsAlerts();
    const colors = { high: 'var(--color-red)', warn: 'var(--brand-terracotta)', info: 'var(--ink-secondary)', ok: 'var(--color-green)' };
    const icons = {
      surge: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
      claimed: '<polyline points="20 6 9 17 4 12"/>',
      overdue: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      deadline: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      intake: '<path d="M12 5v14M5 12h14"/>'
    };
    return `
      <div class="table-container" id="ops-alerts">
        <div class="table-toolbar">
          <span style="font-size: 12px; font-weight: 700; color: var(--ink-primary);">Operations Alerts</span>
          <span style="font-size: 11px; color: var(--ink-muted);">Admin only. Owners do not see these.</span>
        </div>
        <div style="display: flex; flex-direction: column; padding: 6px 0;">
          ${alerts.length === 0 ? `
            <div style="text-align: center; padding: 28px; color: var(--ink-muted);">No impound or surge alerts right now.</div>
          ` : alerts.map(a => `
            <div style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 18px; border-bottom: 1px solid var(--border-light);">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; background: var(--bg-card-subtle); border: 1px solid var(--border-main); color: ${colors[a.severity]}; flex-shrink: 0; margin-top: 2px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icons[a.kind]}</svg>
              </span>
              <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0;">
                <b style="font-size: 13px; color: var(--ink-primary);">${a.title}</b>
                <p style="font-size: 12px; color: var(--ink-secondary); margin: 0; line-height: 1.4;">${a.message}</p>
                <span style="font-size: 10px; font-family: var(--font-mono); color: var(--ink-muted); margin-top: 3px;">${new Date(a.time).toLocaleString()}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  },

  render(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Alerts</h1>
          <div class="subtitle">
            <span>Impoundment activity and sudden surges in missing pets</span>
          </div>
        </div>
      </div>

      ${this.renderOpsAlerts()}
    `;
  }
};
