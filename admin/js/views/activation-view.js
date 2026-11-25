/**
 * PawTrack Admin — Dashboard
 * Facility-scoped: every figure here describes the signed-in staff member's own impound facility (and, for a main
 * facility, its sub-facilities). It is computed from the facility's impoundments, transfers and penalty tickets
 * through adminStore. Registry-wide pet, missing-report and community-sighting figures are deliberately not shown.
 * Guardian contact details are not listed here either: they stay on the individual records.
 */

/**
 * The page an account sees on the Dashboard and Heatmap until it has joined or created a facility.
 * Nothing from the console is shown there, only the two ways in.
 */
window.AdminNoFacility = {
  html(pageTitle, whatItShows) {
    const icon = (path) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    return `
      <div class="view-header"><div class="view-header-titles"><h1>${pageTitle}</h1></div></div>
      <section class="nofac" aria-labelledby="nofac-title">
        <div class="nofac-mark" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/><path d="M12 9v2"/></svg>
        </div>
        <h2 class="nofac-title" id="nofac-title">Set up your facility to get started</h2>
        <p class="nofac-sub">${whatItShows} Register your facility, or join the team that already runs one.</p>
        <div class="nofac-options">
          <article class="nofac-option">
            <span class="nofac-option-icon">${icon('<path d="M12 5v14M5 12h14"/>')}</span>
            <h3>Register a facility</h3>
            <p>You are the first from your team. Add its name, address and the area it covers.</p>
            <button type="button" class="btn btn-primary btn-sm" data-nofac-go="shelters">Register facility</button>
          </article>
          <article class="nofac-option">
            <span class="nofac-option-icon">${icon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>')}</span>
            <h3>Join your team</h3>
            <p>Ask your facility manager for the invite code, then enter it on the Facilities page.</p>
            <button type="button" class="btn btn-secondary btn-sm" data-nofac-go="shelters">Join with a code</button>
          </article>
        </div>
      </section>`;
  },
  render(container, pageTitle, whatItShows) {
    container.innerHTML = this.html(pageTitle, whatItShows);
    container.querySelectorAll('[data-nofac-go]').forEach((btn) => {
      btn.addEventListener('click', () => { window.location.hash = '#' + btn.dataset.nofacGo; });
    });
  }
};

window.ActivationView = {
  timeframe: 'monthly', // 'weekly' | 'monthly' | 'yearly'

  MONTHS: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  toTime(v) {
    const t = v ? new Date(v).getTime() : NaN;
    return Number.isFinite(t) ? t : null;
  },

  // "14h 20m" / "2d 3h" / "—"
  formatDuration(ms) {
    if (ms == null || !Number.isFinite(ms)) return '—';
    const mins = Math.max(Math.round(ms / 60000), 0);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return mins % 60 ? `${hrs}h ${mins % 60}m` : `${hrs}h`;
    const days = Math.floor(hrs / 24), rest = hrs % 24;
    return rest ? `${days}d ${rest}h` : `${days}d`;
  },

  median(list) {
    if (!list.length) return null;
    const s = [...list].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  },

  // Counts per day for the last `days` days (oldest first), for the sparklines
  dailySeries(times, days = 7) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const out = new Array(days).fill(0);
    times.forEach((t) => {
      if (t == null) return;
      const idx = Math.floor((t - start.getTime()) / 86400000);
      if (idx >= 0 && idx < days) out[idx] += 1;
    });
    return out;
  },

  // Buckets for the incident chart: [{ label, sub, from, to, active }]
  buildBuckets(timeframe) {
    const now = new Date();
    const buckets = [];
    if (timeframe === 'weekly') {
      const monday = new Date(now);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      for (let i = 5; i >= 0; i--) {
        const from = new Date(monday);
        from.setDate(from.getDate() - i * 7);
        const to = new Date(from);
        to.setDate(to.getDate() + 7);
        buckets.push({
          label: `${this.MONTHS[from.getMonth()]} ${from.getDate()}`,
          sub: i === 0 ? 'This week' : '',
          from: from.getTime(), to: to.getTime(), active: i === 0
        });
      }
    } else if (timeframe === 'yearly') {
      for (let i = 3; i >= 0; i--) {
        const y = now.getFullYear() - i;
        buckets.push({
          label: String(y), sub: i === 0 ? 'This year' : '',
          from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime(), active: i === 0
        });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        buckets.push({
          label: this.MONTHS[from.getMonth()],
          sub: from.getMonth() === 0 || i === 11 ? String(from.getFullYear()) : '',
          from: from.getTime(), to: to.getTime(), active: i === 0
        });
      }
    }
    return buckets;
  },

  TIMEFRAMES: ['weekly', 'monthly', 'yearly'],

  // Everything the intake chart shows for one time range (this facility's intakes only)
  chartModel(timeframe, impoundments) {
    const regTimes = impoundments.filter((i) => i.petId).map((i) => this.toTime(i.intakeDate)).filter((t) => t != null);
    const otherTimes = impoundments.filter((i) => !i.petId).map((i) => this.toTime(i.intakeDate)).filter((t) => t != null);
    const inRange = (list, b) => list.filter((t) => t >= b.from && t < b.to).length;
    const chartData = this.buildBuckets(timeframe).map((b) => {
      const reg = inRange(regTimes, b);
      const other = inRange(otherTimes, b);
      return { ...b, reg, other, val: reg + other };
    });
    const maxVal = Math.max(...chartData.map((d) => d.val), 0);
    const axisMax = Math.max(Math.ceil(maxVal / 3) * 3, 3); // multiple of 3 so the gridlines land on whole numbers
    const periodTotal = chartData.reduce((a, d) => a + d.val, 0);
    const peak = chartData.reduce((best, d) => (d.val > best.val ? d : best), chartData[0]);
    const average = periodTotal / chartData.length;
    const current = chartData[chartData.length - 1];
    const previous = chartData[chartData.length - 2];
    const diff = current.val - previous.val;
    const unit = { weekly: 'week', monthly: 'month', yearly: 'year' }[timeframe];
    const periodNoun = { weekly: 'Last 6 weeks', monthly: 'Last 12 months', yearly: 'Last 4 years' }[timeframe];
    return { chartData, axisMax, periodTotal, peak, average, current, previous, diff, unit, periodNoun };
  },

  // The part of the intake card that changes with the time range (the header and its selector stay put)
  chartBodyHtml(m, ctx) {
    const { chartData, axisMax, periodTotal, peak, average, current, previous, diff, unit, periodNoun } = m;
    return `          <div class="analytics-kpi-row">
            <div class="analytics-kpi-block">
              <div class="analytics-kpi-main-val">${periodTotal} ${periodTotal === 1 ? 'intake' : 'intakes'}</div>
              <div class="analytics-kpi-sub"><span>${periodNoun}, averaging ${average.toFixed(1)} per ${unit}</span></div>
            </div>
            <div class="analytics-kpi-block">
              <div class="analytics-kpi-main-val" style="color: ${diff > 0 ? '#b45309' : 'var(--ink-primary)'};">${diff > 0 ? '▲' : diff < 0 ? '▼' : '■'} ${Math.abs(diff)}</div>
              <div class="analytics-kpi-sub"><span>${current.val} this ${unit}, ${previous.val} last ${unit}${periodTotal ? `. Busiest: ${peak.label}` : ''}</span></div>
            </div>
          </div>

          <div class="dash-legend" aria-label="Chart legend">
            <span><i class="dot dot-missing"></i>Registered pets</span>
            <span><i class="dot dot-intake"></i>Unregistered animals</span>
            <span><i class="dot dot-avg"></i>Average</span>
          </div>

          <div class="analytics-chart-canvas-wrapper">
            <div class="analytics-chart-layout">
              <div class="analytics-y-axis">
                <span class="analytics-y-tick">${axisMax}</span>
                <span class="analytics-y-tick">${axisMax * 2 / 3}</span>
                <span class="analytics-y-tick">${axisMax / 3}</span>
                <span class="analytics-y-tick">0</span>
              </div>
              <div class="analytics-chart-main">
                <div class="analytics-plot-area">
                  <div class="analytics-grid-line" style="bottom: 100%;"></div>
                  <div class="analytics-grid-line" style="bottom: 66.67%;"></div>
                  <div class="analytics-grid-line" style="bottom: 33.33%;"></div>
                  ${periodTotal ? `<div class="dash-avg-line" style="bottom: ${(average / axisMax) * 100}%;"></div>` : ''}
                  <div class="analytics-bars-track">
                    ${chartData.map((item, idx) => `
                      <div class="analytics-bar-slot ${item.active ? 'is-current' : ''}" style="--i:${idx};" tabindex="0" aria-label="${item.label}${item.sub ? ' ' + item.sub : ''}: ${item.reg} registered pets, ${item.other} unregistered animals">
                        <div class="dash-tip" role="tooltip">
                          <b>${item.label}${item.sub ? ' · ' + item.sub : ''}</b>
                          <span><i class="dot dot-missing"></i>${item.reg} registered ${item.reg === 1 ? 'pet' : 'pets'}</span>
                          <span><i class="dot dot-intake"></i>${item.other} unregistered</span>
                        </div>
                        ${item.val ? `<span class="dash-bar-value">${item.val}</span>` : ''}
                        <div class="analytics-bar dash-stack" style="height: ${item.val ? Math.max((item.val / axisMax) * 100, 5) : 1.5}%;">
                          ${item.other ? `<div class="seg seg-intake" style="flex: ${item.other};"></div>` : ''}
                          ${item.reg ? `<div class="seg seg-missing" style="flex: ${item.reg};"></div>` : ''}
                        </div>
                      </div>`).join('')}
                  </div>
                </div>
                <div class="analytics-x-axis">
                  ${chartData.map((item) => `
                    <div class="analytics-x-label-slot ${item.active ? 'active' : ''}">
                      <span>${item.label}</span>
                      ${item.sub ? `<span class="analytics-bar-sublabel">${item.sub}</span>` : ''}
                    </div>`).join('')}
                </div>
              </div>
            </div>
            ${periodTotal === 0 ? '<div class="dash-chart-empty">No intakes in this range yet</div>' : ''}
          </div>
`;
  },

  // Shown on the very first load, before the database has answered, so the page never claims "no pets yet"
  renderSkeleton(container) {
    const bar = (w, h = 12) => `<span class="dash-skel" style="width: ${w}; height: ${h}px;"></span>`;
    // The same shape as the page: a heading, the big sentence with its kennels, then two lists
    container.innerHTML = `
     <div class="dash-pro dd is-skeleton" role="status" aria-busy="true" aria-label="Loading the dashboard">
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Dashboard</h1>
          <div class="subtitle">${bar('280px', 12)}</div>
        </div>
      </div>
      <header class="dd-sec"><h2>Right now</h2></header>
      <section class="dd-now">
        <div class="dd-now-main">
          ${bar('180px', 64)}
          <div style="margin: 16px 0;">${bar('240px', 12)}</div>
          <div class="dd-kennels">${Array.from({ length: 24 }, () => '<i class="dd-k is-free"></i>').join('')}</div>
        </div>
        <div>${bar('100%', 56)}<div style="margin-top: 14px;">${bar('100%', 56)}</div></div>
      </section>
      <header class="dd-sec"><h2>Intakes over time</h2></header>
      ${bar('100%', 160)}
     </div>`;
  },


  // Switching the time range redraws only the chart, so the selector can slide and the bars can grow
  updateChart(container) {
    const body = container.querySelector && container.querySelector('#dash-chart-body');
    const ctx = this._ctx;
    if (!body || !ctx) { this._animateNext = true; this.render(container); return; }
    const m = this.chartModel(this.timeframe, ctx.impoundments);
    body.classList.add('is-animated');
    body.innerHTML = this.chartBodyHtml(m, ctx);
    this.bindChartBody(body);

    const seg = container.querySelector('.dash-segmented');
    if (seg) {
      seg.style.setProperty('--seg', String(this.TIMEFRAMES.indexOf(this.timeframe)));
      seg.querySelectorAll('.btn-timeframe').forEach((b) => {
        const on = b.getAttribute('data-timeframe') === this.timeframe;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
    }
    // the downloadable summary follows what is on screen
    if (this._report) Object.assign(this._report, { periodNoun: m.periodNoun, unit: m.unit, chart: m.chartData, periodTotal: m.periodTotal, average: m.average, current: m.current, previous: m.previous, diff: m.diff, peak: m.peak });
    if (this._live) { this._live.unit = m.unit; this._live.chart = m; }
  },

  bindChartBody(root) {
;
  },

  render(container) {
    const store = window.adminStore;
    const fn = (name, fallback) => (typeof store[name] === 'function' ? store[name]() : fallback);
    const hasFacility = typeof store.hasFacility === 'function' ? store.hasFacility() : true;
    // Everything on this page is for ONE facility: the one chosen in the sidebar (a sub-facility counts like any main one)
    const activeId = fn('getActiveFacilityId', null);
    const allShelters = fn('getShelters', []) || [];
    const mine = (activeId && allShelters.find((s) => s.id === activeId)) || fn('getMyShelter', null);
    const impoundments = (fn('getMyImpoundments', []) || []).filter((i) => !activeId || i.shelterId === activeId);
    const facilityIds = activeId ? [activeId] : (fn('getMyFacilityIds', []) || []);
    const treeShelters = allShelters.filter((s) => facilityIds.includes(s.id));
    const subs = [];
    const mainFacility = mine && mine.parentId ? (allShelters.find((s) => s.id === mine.parentId) || null) : null;
    const tickets = (fn('getTickets', []) || []).filter((t) => impoundments.some((i) => i.id === t.impoundId) || facilityIds.includes(t.payeeShelterId));
    const now = Date.now();

    // First load: nothing cached yet and the database has not answered. Show a skeleton, not misleading zeros.
    // Also while the facility itself has not arrived: capacity would read "—" for a moment, then jump to "0%".
    const account = typeof store.currentAdmin === 'function' ? store.currentAdmin() : null;
    const waitingOnFacility = !!(account && account.shelter_id) && !treeShelters.length && !store.hasSynced;
    const accountPending = typeof store.currentAdmin === 'function' && !account;
    const loading = (store.syncStatus === 'connecting' && !impoundments.length) || accountPending || waitingOnFacility || (!store.hasSynced && !impoundments.length && !allShelters.length);
    if (loading && store.syncStatus === 'offline' && !store.hasSynced) {
      // First load and the database cannot be reached: say so instead of showing a skeleton forever
      this._wasLoading = true;
      container.innerHTML = `
        <div class="view-header"><div class="view-header-titles"><h1>Dashboard</h1></div></div>
        <div class="card" style="text-align:center; padding: 32px 20px;">
          <h3 style="margin:0 0 6px; font-size:15px;">Can't reach the database</h3>
          <p style="margin:0 0 16px; color: var(--ink-muted); font-size:12.5px;">Check your connection. This page will fill in as soon as it is back.</p>
          <button class="btn btn-primary" id="btn-offline-retry">Try again</button>
        </div>`;
      container.querySelector('#btn-offline-retry')?.addEventListener('click', (e) => {
        e.currentTarget.disabled = true;
        Promise.resolve(store.syncFromSupabase()).finally(() => { if (window.adminApp) window.adminApp.renderView('activation'); });
      });
      return;
    }
    if (loading) {
      this._wasLoading = true;
      return this.renderSkeleton(container);
    }
    // An account that has not joined or created a facility has nothing to show here yet: only the way in, no figures
    if (account && !hasFacility) {
      this._wasLoading = false;
      window.AdminNoFacility.render(container, 'Dashboard', 'This dashboard shows your facility\'s animals, transfers and penalties.');
      return;
    }
    // Entry animations play when the page is opened, when the data first arrives, and after the person's own action.
    // A background re-render (every realtime sync) stays perfectly still.
    const entering = !!(window.AdminMotion && window.AdminMotion.routeEntering);
    const fromSkeleton = !!this._wasLoading && !entering;
    this._wasLoading = false;
    const animate = entering || fromSkeleton || !!this._animateNext;
    this._animateNext = false;
    const syncedAt = store.lastSyncedAt ? new Date(store.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
    const escHtml = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const DAY = 24 * 3600 * 1000;

    // ---- This facility's impoundments ----
    const active = impoundments.filter((i) => i.status === 'active_impounded');
    const claimed = impoundments.filter((i) => i.status === 'claimed');
    const closed = impoundments.filter((i) => i.status !== 'active_impounded');
    const otherOutcomes = closed.filter((i) => i.status !== 'claimed');
    const deadlineOf = (i) => this.toTime(i.claimDeadline);
    const overdue = active.filter((i) => { const d = deadlineOf(i); return d != null && d < now; });
    const dueSoon = active.filter((i) => { const d = deadlineOf(i); return d != null && d >= now && d - now < DAY; });
    const stayTimes = claimed
      .map((i) => (this.toTime(i.closedAt) ?? NaN) - (this.toTime(i.intakeDate) ?? NaN))
      .filter((ms) => Number.isFinite(ms) && ms >= 0);
    const medianStay = this.median(stayTimes);
    const releaseRate = closed.length ? Math.round((claimed.length / closed.length) * 100) : null;
    // A facility saved without a capacity (the owner site once wrote the shared list without it) counts as the default 50
    const capacity = treeShelters.reduce((a, s) => a + (s.capacity == null ? 50 : Number(s.capacity) || 0), 0);
    const capacityPct = capacity ? Math.min(Math.round((active.length / capacity) * 100), 100) : null;

    // ---- Transfers between this facility's sub-facilities and its main facility ----
    const incoming = (fn('getIncomingTransfers', []) || []).filter((t) => !activeId || t.transferToId === activeId);
    const outgoing = (fn('getOutgoingTransfers', []) || []).filter((i) => i.status === 'active_impounded' && (!activeId || i.shelterId === activeId));
    const notArrived = active.filter((i) => i.transferStatus === 'not_arrived');

    // ---- Penalty tickets (missing pets impounded at this facility or its sub-facilities) ----
    const unpaid = tickets.filter((t) => t.status === 'unpaid');
    const paidT = tickets.filter((t) => t.status === 'paid');
    const waivedT = tickets.filter((t) => t.status === 'waived');
    const sumPhp = (list) => list.reduce((a, t) => a + (Number(t.amount) || 0), 0);
    const toCollect = (fn('getTicketsToCollect', []) || []).filter((t) => !activeId || t.payeeShelterId === activeId);
    const showPenalties = !!store.penaltyReady && tickets.length > 0;

    // ---- Sparklines (last 7 days) ----
    const intakeSeries = this.dailySeries(impoundments.map((i) => this.toTime(i.intakeDate)));
    const releaseSeries = this.dailySeries(claimed.map((i) => this.toTime(i.closedAt)));
    const intakesThisWeek = intakeSeries.reduce((a, b) => a + b, 0);
    const intakesToday = intakeSeries[intakeSeries.length - 1];
    const releasedThisWeek = releaseSeries.reduce((a, b) => a + b, 0);

    // ---- Intake chart ----
    const chartModel = this.chartModel(this.timeframe, impoundments);
    const { chartData, periodTotal, average, current, previous, diff, peak, unit, periodNoun } = chartModel;
    const ctx = { impoundments, overdue: overdue.length, intakesThisWeek, active: active.length, releaseRate };

    // ---- How cases ended (every step is a share of all intakes at this facility) ----
    const outcomeBase = impoundments.length;
    const outcomeSteps = [
      { name: 'Taken in', count: outcomeBase, color: '#78716c' },
      { name: 'Released to owners', count: claimed.length, color: '#15803d' },
      { name: 'Transferred, forfeited, euthanized or deceased', count: otherOutcomes.length, color: '#b45309' },
      { name: 'Still in holding', count: active.length, color: '#c2410c' }
    ].map((s) => ({ ...s, percent: outcomeBase ? Math.round((s.count / outcomeBase) * 100) : 0 }));

    // ---- Needs attention (each links to where staff can act) ----
    // Each task: how many, what it is (singular / plural), what to do about it, and the word on its button
    const mainName = mainFacility ? mainFacility.name : 'the main facility';
    const attention = [
      { n: overdue.length, one: 'pet is past its claim deadline', many: 'pets are past their claim deadline', hint: 'Release it to its owner, start rehabilitation or transfer it', cta: 'Review', route: 'impoundments', tone: 'danger' },
      { n: incoming.length, one: 'pet arriving from a sub-facility', many: 'pets arriving from sub-facilities', hint: 'Confirm that they reached your facility', cta: 'Confirm', route: 'impoundments', tone: 'danger' },
      { n: notArrived.length, one: 'transfer reported as not arrived', many: 'transfers reported as not arrived', hint: 'Follow up with the sub-facility', cta: 'Follow up', route: 'impoundments', tone: 'danger' },
      { n: dueSoon.length, one: 'claim deadline within 24 hours', many: 'claim deadlines within 24 hours', hint: 'Owners can still claim them', cta: 'View', route: 'impoundments', tone: 'warn' },
      { n: toCollect.length, one: 'penalty ticket waiting for payment', many: 'penalty tickets waiting for payment', hint: 'Record the payment or waive the penalty', cta: 'Collect', key: 'tickets', route: 'impoundments', tone: 'warn' },
      { n: outgoing.length, one: `pet being moved to ${mainName}`, many: `pets being moved to ${mainName}`, hint: 'In progress, nothing to do yet', cta: 'Track', route: 'impoundments', tone: 'info' }
    ].filter((a) => a.n > 0).map((a) => ({ ...a, label: a.n === 1 ? a.one : a.many }));

    const stalls = [
      ['Intake', 'Animals currently in holding', active.length ? `${active.length} ${active.length === 1 ? 'pet' : 'pets'}` : 'Clear'],
      ['Claim processing', 'Past the claim deadline', overdue.length ? `${overdue.length} overdue` : 'Clear'],
      ['Transfers', 'Arrivals waiting for confirmation', incoming.length ? `${incoming.length} waiting` : 'Clear'],
      ['Penalties', 'Tickets waiting for payment', toCollect.length ? `${toCollect.length} unpaid` : 'Clear']
    ];

    const info = (key) => `<button type="button" class="dash-info" data-info="${key}" aria-label="What does this show?" title="What does this show?">i</button>`;

    // ---- Holding by species (donut) ----
    const speciesSlices = window.PawSpecies.count(active).sort((a, b) => b.n - a.n).map((s) => [s.key, s.n, s.color]);
    // How long the animals in holding have been here (shown once, under Right now)
    const stayMs = active.map((i) => (i.intakeDate ? now - new Date(i.intakeDate).getTime() : null)).filter((v) => v != null && v >= 0);
    const avgStay = stayMs.length ? this.formatDuration(stayMs.reduce((a, b) => a + b, 0) / stayMs.length) : '—';
    const longestStay = stayMs.length ? this.formatDuration(Math.max(...stayMs)) : '—';

    // ---- Holding now: who is closest to their claim deadline ----
    const holdingRows = active.slice()
      .sort((x, y) => (deadlineOf(x) ?? Infinity) - (deadlineOf(y) ?? Infinity))
      .slice(0, 5)
      .map((i) => {
        const d = deadlineOf(i);
        const left = d == null ? null : d - now;
        const tone = left == null ? 'ok' : left < 0 ? 'late' : left < DAY ? 'soon' : 'ok';
        const label = left == null ? 'No deadline' : left < 0 ? `${this.formatDuration(-left)} overdue` : `${this.formatDuration(left)} left`;
        const where = subs.length && i.shelterName ? i.shelterName : '';
        const start = this.toTime(i.intakeDate);
        const span = d != null && start != null ? d - start : 0;
        // the bar is what is left of the claim window; an overdue animal shows it empty and red
        const pct = left == null ? 0 : left < 0 ? 100 : span > 0 ? Math.max(4, Math.min(100, Math.round((left / span) * 100))) : 0;
        const found = window.RehabView && window.RehabView.photoOf ? window.RehabView.photoOf(i) : (i.photoUrl && /^https:\/\//.test(i.photoUrl) ? { url: i.photoUrl, stock: false } : null);
        const photo = found && !found.stock ? found : null;
        return { name: i.petName || 'Unidentified animal', sub: [i.species, i.breed, i.cageNumber, where].filter(Boolean).join(', ') || 'No cage yet', photo, icon: window.PawSpecies ? window.PawSpecies.icon(i.species) : '🐾', tint: window.PawSpecies ? window.PawSpecies.color(i.species) : '#a8a29e', tone, label, pct };
      });

    // ---- By facility (main facility with sub-facilities) ----
    const facilityRows = treeShelters.map((s) => {
      const here = active.filter((i) => i.shelterId === s.id);
      const late = here.filter((i) => { const d = deadlineOf(i); return d != null && d < now; }).length;
      const cap = s.capacity == null ? 50 : Number(s.capacity) || 0;
      return { name: s.name, main: !s.parentId, n: here.length, late, cap, pct: cap ? Math.min(Math.round((here.length / cap) * 100), 100) : 0 };
    }).sort((a, b) => Number(b.main) - Number(a.main) || b.n - a.n);

    // A section heading is plain: a rule, a title, and one line saying what it is (no numbering: the sections are not a sequence)
    const sec = (id, title, note, extra = '') => `
      <header class="dd-sec" id="dash-sec-${id}">
        <h2>${title}</h2>${note ? `<p>${note}</p>` : ''}${extra}
      </header>`;
    const jumpNav = `
      <nav class="dash-jump" aria-label="Sections of this page">
        ${[['now', 'Right now'], ['trends', 'Intakes'], ['advice', 'AI advice'], ['todo', 'To do'], ['holding', 'In holding']].map(([id, label], i) =>
          `<button type="button" data-jump="dash-sec-${id}" class="${i === 0 ? 'is-active' : ''}" ${i === 0 ? 'aria-current="true"' : ''}>${label}</button>`).join('')}
      </nav>`;
    const scopeName = mine ? mine.name : 'Your impound facility';
    // The page is for one facility: name it, and say how it relates to its main facility when it is a sub-facility
    const scopeRole = mainFacility ? `Sub-facility of ${mainFacility.name}` : 'Main facility';
    const scopeNote = `${scopeName}, ${scopeRole.toLowerCase()}`;
    const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const animalWord = (n) => (n === 1 ? 'animal' : 'animals');

    // ---- Capacity as kennels: one cell per place, filled when taken, red when past the claim deadline, amber when due soon ----
    const kennelCount = Math.max(capacity, active.length);
    const kennelHtml = !kennelCount ? '' : kennelCount <= 120 ? `
      <div class="dd-kennels" role="img" aria-label="${active.length} of ${capacity} places taken${overdue.length ? `, ${overdue.length} past the claim deadline` : ''}${dueSoon.length ? `, ${dueSoon.length} due within 24 hours` : ''}">
        ${Array.from({ length: kennelCount }, (_, i) => { const st = i < overdue.length ? 'late' : i < overdue.length + dueSoon.length ? 'soon' : i < active.length ? 'on' : 'free'; return `<i class="dd-k is-${st}" style="--n:${i}">${st === 'free' ? '' : '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#dd-paw"/></svg>'}</i>`; }).join('')}
      </div>` : `
      <div class="dd-capbar" role="img" aria-label="${active.length} of ${capacity} places taken">
        <u class="is-late" style="width:${(overdue.length / kennelCount) * 100}%"></u><u class="is-soon" style="width:${(dueSoon.length / kennelCount) * 100}%"></u><u class="is-on" style="width:${((active.length - overdue.length - dueSoon.length) / kennelCount) * 100}%"></u>
      </div>`;
    const kennelKey = !kennelCount ? '' : `
      <ul class="dd-key" aria-hidden="true">
        <li><i class="dd-k is-on"></i>Taken</li>
        ${overdue.length ? '<li><i class="dd-k is-late"></i>Past claim deadline</li>' : ''}
        ${dueSoon.length ? '<li><i class="dd-k is-soon"></i>Due within 24 hours</li>' : ''}
        <li><i class="dd-k is-free"></i>Free</li>
      </ul>`;
    const overBy = capacity && active.length > capacity ? active.length - capacity : 0;
    const taskPhp = sumPhp(toCollect);

    container.innerHTML = `
     <div class="dash-pro dd${animate ? ' is-animated' : ''}${fromSkeleton ? ' from-skeleton' : ''}">
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Dashboard</h1>
          <div class="subtitle"><span>${todayLabel}</span></div>
          <div class="dd-where"><b>${escHtml(scopeName)}</b><span>${escHtml(scopeRole)}</span></div>
        </div>
        <div class="view-header-actions">
          <button class="chip chip-subtle-terracotta" id="btn-quick-intake" title="Tap an NFC tag, or log a pet that has no tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Scan &amp; intake
          </button>
          <button class="chip dash-refresh" id="btn-refresh" title="Refresh the data${syncedAt ? ` (last updated ${syncedAt})` : ''}" aria-label="Refresh the data">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
            <span>${syncedAt ? `Updated ${syncedAt}` : 'Refresh'}</span>
          </button>
          <button class="chip" id="btn-export-brief">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Download summary
          </button>
        </div>
      </div>

      ${hasFacility ? '' : `
        <div class="dash-onboard">
          <div class="dash-onboard-text"><b>You are not part of an impound facility yet.</b><span>Register yours, or join your colleagues with the invite code your manager shares. This dashboard then shows your facility's animals, transfers and penalties.</span></div>
          <button class="btn btn-primary btn-sm" data-go="shelters">Set up your facility</button>
        </div>`}

      ${jumpNav}

      <svg class="dd-defs" width="0" height="0" aria-hidden="true" focusable="false"><symbol id="dd-paw" viewBox="0 0 24 24"><circle cx="5.2" cy="10.4" r="2.2"/><circle cx="9.4" cy="5.8" r="2.4"/><circle cx="14.6" cy="5.8" r="2.4"/><circle cx="18.8" cy="10.4" r="2.2"/><path d="M12 11c-3.1 0-6.2 3.3-6.2 6.1 0 2 1.5 3 3.1 3 1.2 0 2-.6 3.1-.6s1.9.6 3.1.6c1.6 0 3.1-1 3.1-3C18.2 14.3 15.1 11 12 11z"/></symbol></svg>
      ${sec('now', 'Right now', 'Who is in the facility and how full it is')}
      <section class="dd-now dd-hero">
        <div class="dd-now-main">
          <p class="dd-lead"><b class="dd-big">${active.length}</b><span>${animalWord(active.length)} in holding</span>${info('holding')}</p>
          <p class="dd-cap">${capacity ? `${active.length} of ${capacity} places taken, ${capacityPct}% full${overBy ? `. ${overBy} over capacity` : ''}` : 'Set a capacity on the Facilities page to see how full you are'}${capacity ? info('capacity') : ''}</p>
          ${kennelHtml}
          ${kennelKey}
        </div>
        <dl class="dd-facts">
          <div>
            <dt>Time in holding${info('stay')}</dt>
            <dd>${active.length ? escHtml(String(avgStay)) : '—'}</dd>
            <small>${active.length ? `on average, the longest is ${escHtml(String(longestStay))}` : 'Nobody is in holding'}</small>
          </div>
          <div>
            <dt>Released to owners${info('released')}</dt>
            <dd>${claimed.length}</dd>
            <small>${medianStay != null ? `median stay ${this.formatDuration(medianStay)}` : 'None released yet'}</small>
          </div>
        </dl>
      </section>

      ${sec('trends', 'Intakes over time', 'How many animals the facility took in', info('incidents'))}
      <div class="dd-block dd-panel">
        <div class="dd-tools">
          <div class="dash-segmented is-sliding" role="tablist" aria-label="Time range" style="--seg: ${this.TIMEFRAMES.indexOf(this.timeframe)};">
            ${['weekly', 'monthly', 'yearly'].map((tf) => `<button class="${this.timeframe === tf ? 'active' : ''} btn-timeframe" data-timeframe="${tf}" role="tab" aria-selected="${this.timeframe === tf}">${tf[0].toUpperCase() + tf.slice(1)}</button>`).join('')}
          </div>
        </div>
        <div class="dash-chart-body" id="dash-chart-body">${this.chartBodyHtml(chartModel, ctx)}</div>
      </div>

      ${sec('advice', 'AI advice', 'Suggested next steps, written from the figures on this page')}
      <div class="dd-block dd-panel is-ai" id="dash-advisor-slot">
        ${this.advisorHtml()}
      </div>

      <div class="dd-cols">
        <section class="dd-col" aria-label="To do">
          ${sec('todo', attention.length ? 'To do' : 'All clear', attention.length ? `${attention.length} ${attention.length === 1 ? 'thing needs' : 'things need'} a person`  : 'Nothing is waiting for you', info('attention'))}
          ${attention.length ? `
            <ul class="dt-list">
              ${attention.map((a, idx) => `
                <li style="--i:${idx}">
                  <button type="button" class="dt-item tone-${a.tone}" data-go="${a.route}" aria-label="${escHtml(`${a.tone === 'danger' ? 'Urgent: ' : ''}${a.n} ${a.label}. ${a.hint}.`)}">
                    <span class="dt-count"><b>${a.n}</b></span>
                    <span class="dt-body"><b class="dt-title">${escHtml(a.label)}</b><small class="dt-hint">${escHtml(a.key === 'tickets' && taskPhp ? `PHP ${taskPhp.toLocaleString('en-US')} to collect. ${a.hint}` : a.hint)}</small></span>
                    <span class="dt-cta">${escHtml(a.cta)}</span>
                  </button>
                </li>`).join('')}
            </ul>` : `
            <div class="dash-clear">
              <svg class="dash-check" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>
              <b>Nothing needs attention</b>
              <span>No overdue claims, incoming transfers or unpaid penalties right now.</span>
            </div>`}
        </section>
        <section class="dd-col" aria-label="In holding">
          ${sec('holding', 'In holding', active.length ? (active.length > holdingRows.length ? `The ${holdingRows.length} closest to their claim deadline` : 'Closest to their claim deadline first') : 'Nobody at the moment', info('holdingNow'))}
          ${holdingRows.length ? `
            <ul class="dh-list">
              ${holdingRows.map((h, idx) => `
                <li style="--i:${idx}">
                  <button type="button" class="dh-row" data-go="impoundments" aria-label="${escHtml(`${h.name}, ${h.label}`)}">
                    <span class="dh-photo" style="--sc:${escHtml(h.tint)}">${h.photo ? `<img src="${escHtml(h.photo.url)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('i'),{textContent:'${h.icon}'}))" />` : `<i aria-hidden="true">${h.icon}</i>`}</span>
                    <span class="dh-body">
                      <span class="dh-top"><b class="dh-name" title="${escHtml(h.name)}">${escHtml(h.name)}</b><span class="dash-time tone-${h.tone}">${escHtml(h.label)}</span></span>
                      <span class="dh-sub">${escHtml(h.sub)}</span>
                      <span class="dh-bar tone-${h.tone}" aria-hidden="true"><u style="width:${h.pct}%"></u></span>
                    </span>
                  </button>
                </li>`).join('')}
            </ul>
            <button type="button" class="dh-all" data-go="impoundments">${active.length > holdingRows.length ? `See all ${active.length} in holding` : 'Open impoundments'}</button>` : `
            <div class="dash-empty"><div class="dash-empty-title">Nobody in holding</div>Animals brought to your facility appear here with their claim countdown.</div>`}
        </section>
      </div>
     </div>
    `;

    this._live = {
      medianStay, claimedCount: claimed.length, unit, capacity, capacityPct, active: active.length, intakesThisWeek,
      overdue: overdue.length, dueSoon: dueSoon.length, closed: closed.length, otherOutcomes: otherOutcomes.length,
      outcomeBase, releaseRate, intakesToday, incoming: incoming.length, notArrived: notArrived.length, outgoing: outgoing.length,
      toCollect: toCollect.length, unpaid: unpaid.length, unpaidPhp: sumPhp(unpaid), paid: paidT.length, waived: waivedT.length,
      speciesTop: speciesSlices[0] ? { label: speciesSlices[0][0], n: speciesSlices[0][1] } : null, avgStay, longestStay,
      chart: chartModel
    };
    this._ctx = ctx;
    // What the AI advisor is allowed to see: the same counts and rates shown on this page, nothing personal
    this._advisorInput = {
      isSubFacility: !!mainFacility,
      overview: {
        inHolding: active.length, capacity, capacityPercent: capacityPct, pastClaimDeadline: overdue.length, dueWithin24h: dueSoon.length,
        intakesLast7Days: intakesThisWeek, intakesToday, releasedToOwners: claimed.length, releaseRatePercent: releaseRate,
        medianStayHours: medianStay == null ? null : Math.round(medianStay / 3600000)
      },
      outcomes: { takenIn: outcomeBase, releasedToOwners: claimed.length, transferredForfeitedOrDeceased: otherOutcomes.length, stillInHolding: active.length },
      species: Object.fromEntries(speciesSlices.map(([l, n]) => [l, n])),
      trend: { periodTotal, averagePerPeriod: average, thisPeriod: current && current.val, lastPeriod: previous && previous.val, busiestPeriodCount: peak && peak.val },
      penalties: showPenalties ? { unpaid: unpaid.length, unpaidPhp: sumPhp(unpaid), paid: paidT.length, paidPhp: sumPhp(paidT), waived: waivedT.length, waitingForPayment: toCollect.length } : {},
      transfers: { arrivalsWaitingForConfirmation: incoming.length, beingMovedToMainFacility: outgoing.length, reportedNotArrived: notArrived.length },
      facilities: facilityRows.map((f) => ({ name: f.name, inHolding: f.n, capacity: f.cap, overdue: f.late }))
    };
    this._report = {
      generatedAt: new Date(),
      facility: scopeNote,
      periodNoun, unit,
      metrics: [
        ['Capacity in use', capacityPct == null ? 'n/a' : `${capacityPct}%`],
        ['In holding now', active.length],
        ['Past claim deadline', overdue.length],
        ['Due within 24h', dueSoon.length],
        ['Intakes (7 days)', intakesThisWeek],
        ['Released to owners', claimed.length],
        ['Median stay', this.formatDuration(medianStay)],
        ['Unpaid penalties', showPenalties ? `PHP ${sumPhp(unpaid).toLocaleString('en-US')}` : 'n/a']
      ],
      attention: attention.map((a) => `${a.n} ${a.label}`),
      chart: chartData, periodTotal, average, current, previous, diff, peak,
      outcomes: outcomeSteps, outcomeBase,
      stalls,
      species: speciesSlices.map(([l, n]) => [l, n]),
      facilities: facilityRows,
      holding: active.slice().sort((x, y) => (deadlineOf(x) ?? Infinity) - (deadlineOf(y) ?? Infinity)),
      penalties: showPenalties ? { unpaid: unpaid.length, unpaidPhp: sumPhp(unpaid), paid: paidT.length, paidPhp: sumPhp(paidT), waived: waivedT.length } : null,
      releaseRate, now
    };
    this.attachEvents(container);
  },

  // ---- AI decision support: the analytics above go to the dashboard-advisor Edge Function (Gemini) ----
  ADVICE_ROUTE: { claims: 'impoundments', capacity: 'shelters', transfers: 'impoundments', penalties: 'impoundments', intake: 'impoundments', outcomes: 'claims', general: 'impoundments' },
  _advisor: { status: 'idle', data: null, error: '', at: null },

  advisorHtml() {
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const st = this._advisor;
    const at = st.at ? new Date(st.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
    const loading = st.status === 'loading';
    const head = `
      <div class="analytics-card-header dd-ai-head">
        <div class="analytics-card-title"><span class="dd-ai-note">Written by Gemini</span><button type="button" class="dash-info" data-info="advice" aria-label="What does this show?" title="What does this show?">i</button></div>
        <button type="button" class="btn btn-sm btn-secondary" id="btn-advisor" ${loading ? 'disabled' : ''}>${loading ? 'Analysing…' : (st.data ? 'Refresh advice' : 'Get recommendations')}</button>
      </div>`;
    let body;
    if (loading) body = '<div class="dash-empty"><div class="dash-empty-title">Reading your analytics…</div>The advisor is weighing capacity, claim deadlines, transfers and penalties.</div>';
    else if (st.status === 'error') body = `<div class="dash-empty"><div class="dash-empty-title">Could not get advice</div>${esc(st.error)}</div>`;
    else if (st.data) {
      const label = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };
      body = `
        <p class="dash-ai-summary">${esc(st.data.summary)}</p>
        <ol class="dash-ai-list">
          ${st.data.recommendations.map((r, i) => `
            <li class="prio-${esc(r.priority)}" style="--i:${i}">
              <span class="dash-ai-prio">${label[r.priority] || 'Medium'}</span>
              <span class="dash-ai-text"><b>${esc(r.action)}</b><small>${esc(r.reason)}</small></span>
              <button type="button" class="dash-ai-go" data-go="${this.ADVICE_ROUTE[r.area] || 'impoundments'}" title="Open the page for this">${esc(r.area)} <span aria-hidden="true">→</span></button>
            </li>`).join('')}
        </ol>
        <div class="dash-ai-foot">Generated ${esc(at)} from the figures on this page. AI can be wrong: check before acting.</div>`;
    } else body = '<p class="dd-ai-idle">The advisor reads the figures on this page and suggests what to do next, most important first.</p>';
    return `<div class="analytics-card dash-ai">${head}${body}</div>`;
  },

  async runAdvisor(container) {
    const input = this._advisorInput;
    const client = window.adminStore && window.adminStore.client && window.adminStore.client();
    const set = (patch) => {
      this._advisor = { ...this._advisor, ...patch };
      const slot = container.querySelector('#dash-advisor-slot');
      if (slot) { slot.innerHTML = this.advisorHtml(); this.bindAdvisor(container); }
    };
    if (!input || !client) { set({ status: 'error', error: 'Sign in again to use the advisor.' }); return; }
    set({ status: 'loading', error: '' });
    try {
      const call = client.functions.invoke('dashboard-advisor', { body: input });
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('The AI took too long. Please try again.')), 45000));
      const { data, error } = await Promise.race([call, timeout]);
      if (error) {
        let msg = error.message;
        try { const b = await error.context.json(); if (b && b.error) msg = b.error; } catch (e) { /* keep message */ }
        throw new Error(msg || 'The AI advisor is unavailable.');
      }
      if (!data || !Array.isArray(data.recommendations)) throw new Error('No recommendations were produced.');
      set({ status: 'done', data, at: Date.now() });
    } catch (err) {
      set({ status: 'error', error: err.message || 'The AI advisor is unavailable.' });
    }
  },

  bindAdvisor(container) {
    container.querySelector('#btn-advisor')?.addEventListener('click', () => this.runAdvisor(container));
    container.querySelectorAll('#dash-advisor-slot .dash-info').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.openInfo('advice'); });
    });
    container.querySelectorAll('#dash-advisor-slot [data-go]').forEach((el) => {
      el.addEventListener('click', () => { window.location.hash = '#' + el.getAttribute('data-go'); });
    });
  },

  downloadSummaryPdf() {
    const JsPDF = window.jspdf && window.jspdf.jsPDF;
    const r = this._report;
    if (!JsPDF || !r) { window.adminApp?.showToast('PDF tool could not load. Check your connection and try again.', 'error'); return; }

    const doc = new JsPDF({ unit: 'pt', format: 'a4' });
    const W = 595, H = 842, M = 40, CW = W - M * 2;
    const INK = [28, 25, 23], MUTED = [110, 104, 99], TERRA = [194, 65, 12], GREEN = [21, 128, 61], RED = [185, 28, 28], AMBER = [180, 83, 9], LINE = [226, 223, 220], TINT = [248, 246, 243], HEADBG = [240, 237, 233], SLATE = [68, 64, 60];
    const clean = (v) => String(v ?? '').replace(/[^\x20-\x7E -ÿ]/g, '-');
    const fmtDate = (v) => { const t = this.toTime(v); return t == null ? '-' : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
    const fmtDateTime = (v) => { const t = this.toTime(v); return t == null ? '-' : new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
    let y = 0;

    const ensure = (h) => { if (y + h > H - 50) { doc.addPage(); y = M; } };
    const table = (title, cols, rows, emptyText = 'Nothing to show.') => {
      const xs = []; let cx = M;
      cols.forEach((c) => { xs.push(cx); cx += c.w * CW; });
      const head = (label) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...INK);
        doc.text(clean(label), M, y + 14);
        y += 22;
        doc.setFillColor(...HEADBG); doc.rect(M, y, CW, 20, 'F'); doc.setDrawColor(...LINE); doc.setLineWidth(0.6);
        doc.line(M, y + 20, W - M, y + 20);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...SLATE);
        cols.forEach((c, i) => doc.text(clean(c.label).toUpperCase(), c.align === 'right' ? xs[i] + c.w * CW - 6 : xs[i] + 6, y + 13, { align: c.align === 'right' ? 'right' : 'left' }));
        y += 20;
      };
      const prepare = (row, empty) => row.map((cell, i) => {
        const val = cell && typeof cell === 'object' ? cell : { t: cell };
        const style = empty ? 'italic' : val.bold ? 'bold' : 'normal';
        doc.setFont('helvetica', style); doc.setFontSize(9);
        return { lines: doc.splitTextToSize(clean(val.t), (empty ? CW : cols[i].w * CW) - 12), style, color: val.color || INK };
      });
      const height = (cells) => 11 + Math.max(...cells.map((cell) => cell.lines.length), 1) * 11;
      const empty = !rows.length;
      const cellsByRow = empty ? [prepare([{ t: emptyText, color: MUTED }], true)] : rows.map((row) => prepare(row, false));
      ensure(42 + height(cellsByRow[0])); head(title);
      cellsByRow.forEach((cells, ri) => {
        const rowHeight = height(cells);
        if (y + rowHeight > H - 50) { doc.addPage(); y = M; head(`${title} (continued)`); }
        if (ri % 2 === 1) { doc.setFillColor(...TINT); doc.rect(M, y, CW, rowHeight, 'F'); }
        doc.setFontSize(9);
        cells.forEach((cell, i) => {
          const right = !empty && cols[i].align === 'right';
          doc.setTextColor(...cell.color); doc.setFont('helvetica', cell.style);
          doc.text(cell.lines, right ? xs[i] + cols[i].w * CW - 6 : xs[i] + 6, y + 14, { align: right ? 'right' : 'left' });
        });
        y += rowHeight;
      });
      doc.setDrawColor(...LINE); doc.line(M, y, W - M, y); y += 14;
    };
    const metricColumns = [{ label: 'Metric', w: 0.7 }, { label: 'Value', w: 0.3, align: 'right' }];
    const periodLabel = ({ label, sub }) => sub ? `${label} (${sub})` : label;

    // ---- Header ----
    doc.setFillColor(...INK); doc.rect(0, 0, W, 108, 'F');
    doc.setFillColor(...TERRA); doc.rect(0, 108, W, 4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(251, 146, 60);
    doc.text('PAWTRACK  |  FACILITY REPORT', M, 38);
    doc.setFontSize(24); doc.setTextColor(255);
    doc.text('Summary', M, 68);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(214, 211, 209);
    doc.text(clean(r.facility), M, 86);
    doc.setFontSize(9); doc.text(r.generatedAt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), W - M, 68, { align: 'right' });
    doc.text(r.generatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }), W - M, 82, { align: 'right' });
    y = 130;

    table('Key metrics', metricColumns, [
      ...r.metrics,
      ['Released to owners (% of closed cases)', r.releaseRate == null ? 'n/a' : `${r.releaseRate}%`],
    ]);

    table('Needs attention', [{ label: 'Item', w: 1 }], r.attention.map((item) => [item]), 'Nothing currently needs urgent attention.');

    table(`Intake totals (${r.periodNoun})`, metricColumns, [
      ['Total intakes', r.periodTotal],
      [`Average per ${r.unit}`, r.average.toFixed(1)],
      [`This ${r.unit}`, r.current.val],
      [`Previous ${r.unit}`, r.previous.val],
      [`Change from previous ${r.unit}`, `${r.diff > 0 ? '+' : ''}${r.diff}`],
      ['Busiest period', r.periodTotal ? periodLabel(r.peak) : 'n/a'],
    ]);
    table('Intakes over time', [
      { label: 'Period', w: 0.4 }, { label: 'Registered', w: 0.2, align: 'right' },
      { label: 'Unregistered', w: 0.2, align: 'right' }, { label: 'Total', w: 0.2, align: 'right' },
    ], r.chart.map((d) => [periodLabel(d), d.reg, d.other, { t: d.val, bold: d.active }]));

    table('How cases ended', [
      { label: 'Outcome', w: 0.52 }, { label: 'Animals', w: 0.18, align: 'right' },
      { label: 'Share of all intakes', w: 0.3, align: 'right' },
    ], r.outcomeBase ? r.outcomes.map((st) => [st.name, st.count, `${st.percent}%`]) : [], 'No intakes yet.');

    table('Where work is waiting', [{ label: 'Stage', w: 0.28 }, { label: 'What it measures', w: 0.47 }, { label: 'Status', w: 0.25, align: 'right' }],
      r.stalls.map((s) => [{ t: s[0], bold: true }, s[1], { t: s[2], bold: true, color: s[2] === 'Clear' ? GREEN : AMBER }]));

    table('Holding by species', [{ label: 'Species', w: 0.7 }, { label: 'Animals', w: 0.3, align: 'right' }],
      r.species, 'No animals are currently in holding.');
    if (r.facilities.length > 1) {
      table('Holding by facility', [{ label: 'Facility', w: 0.46 }, { label: 'Type', w: 0.14 }, { label: 'In holding', w: 0.2, align: 'right' }, { label: 'Overdue', w: 0.2, align: 'right' }],
        r.facilities.map((f) => [{ t: f.name, bold: true }, f.main ? 'Main' : 'Sub', f.cap ? `${f.n} / ${f.cap}` : String(f.n), { t: String(f.late), color: f.late ? RED : INK, bold: !!f.late }]));
    }

    table('Shelter holding by claim deadline', [{ label: 'Pet', w: 0.2 }, { label: 'Species', w: 0.1 }, { label: 'Facility', w: 0.24 }, { label: 'Intake', w: 0.2 }, { label: 'Claim deadline', w: 0.26 }],
      r.holding.map((i) => { const d = this.toTime(i.claimDeadline); const late = d != null && d < r.now; return [{ t: i.petName || 'Unknown', bold: true }, i.species, i.shelterName, fmtDate(i.intakeDate), { t: fmtDateTime(i.claimDeadline) + (late ? ' (overdue)' : ''), color: late ? RED : INK, bold: late }]; }),
      'No animals are currently in holding.');

    if (r.penalties) {
      table('Penalty tickets', [{ label: 'Status', w: 0.4 }, { label: 'Tickets', w: 0.25, align: 'right' }, { label: 'Amount (PHP)', w: 0.35, align: 'right' }],
        [[{ t: 'Unpaid', bold: true, color: r.penalties.unpaid ? RED : INK }, String(r.penalties.unpaid), r.penalties.unpaidPhp.toLocaleString('en-US')],
         [{ t: 'Paid', bold: true, color: GREEN }, String(r.penalties.paid), r.penalties.paidPhp.toLocaleString('en-US')],
         [{ t: 'Waived', bold: true }, String(r.penalties.waived), '-']]);
    }

    // ---- Footer on every page ----
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(M, H - 34, W - M, H - 34);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text('PawTrack  |  Confidential - for authorised staff only', M, H - 22);
      doc.text(`Page ${i} of ${pages}`, W - M, H - 22, { align: 'right' });
    }

    doc.setProperties({ title: 'Summary', subject: 'Facility report', author: 'PawTrack Admin', creator: 'PawTrack' });
    doc.save(`pawtrack-summary-${r.generatedAt.toISOString().slice(0, 10)}.pdf`);
    window.adminApp?.showToast('Summary downloaded.', 'success');
  },

  // Each entry: icon, what (one-line summary), how (steps), example, live (optional "right now" line), tip
  INFO: {
    bdChip: {
      icon: 'shield', title: 'Without chip or tag',
      formula: ['Without chip or tag (%) = animals taken in with no NFC tag and no microchip ÷ all animals taken in × 100'],
      calc: () => { const b = (window.ActivationView._live || {}).bd || {}; return b.total ? `${b.unidentified} ÷ ${b.total} × 100 = ${b.unidentifiedPct}%` : ''; },
      what: 'How many of the animals you took in could not be identified from a tag or chip.',
      how: ['Looks at every animal taken in.', 'An animal counts as identified when it has an NFC tag or a microchip number.'],
      tip: 'These are the animals that cannot be matched to an owner by a scan, so they rely on photos and reports.'
    },
    bdSpecies: {
      icon: 'chart', title: 'Species',
      formula: ['Share (%) = animals of that species ÷ all animals taken in × 100', 'Anything that is not a named species is counted as Other'],
      calc: () => { const b = (window.ActivationView._live || {}).bd || {}; return b.topSpecies ? `${b.topSpecies.label}: ${b.topSpecies.n} ÷ ${b.total} × 100 = ${Math.round((b.topSpecies.n / b.total) * 100)}%` : ''; },
      what: 'Which kinds of animals your facility takes in.',
      how: ['Groups every intake by species.', 'Free text is read: “aso” counts as Dog and “kuneho” as Rabbit.', 'The number in the ring is every animal taken in.']
    },
    bdAge: {
      icon: 'clock', title: 'Age',
      formula: ['Age is read from the record (“3 years”, “6 months”); a bare number is years', 'Under 1 year = baby, 1 to 3 = young, 4 to 7 = adult, 8 or more = senior', 'Bar = animals in that bracket. Animals with no recorded age are left out'],
      calc: () => { const b = (window.ActivationView._live || {}).bd || {}; return b.total ? `${b.withAge} of ${b.total} animals have an age` : ''; },
      what: 'How old the animals are when they arrive.',
      how: ['Reads each animal’s age and puts it in a bracket.', 'Shows how many animals are in each bracket.']
    },
    bdOutcomes: {
      icon: 'funnel', title: 'How cases end',
      formula: ['Closed cases = intakes that are no longer in holding', 'Share (%) = cases with that outcome ÷ closed cases × 100', 'Animals still in holding are not counted here'],
      calc: () => { const b = (window.ActivationView._live || {}).bd || {}; return b.closed ? `${b.released} released ÷ ${b.closed} closed × 100 = ${Math.round((b.released / b.closed) * 100)}%` : ''; },
      what: 'What finally happened to the animals whose cases are closed.',
      how: ['Counts closed cases by how they ended: released to owner, forfeited, transferred, euthanized or deceased.', 'Each share is out of the closed cases only.']
    },
    bdSource: {
      icon: 'home', title: 'Where animals come from',
      formula: ['With sub-facilities: animals received by each facility ÷ all animals taken in × 100', 'Otherwise: animals with a PawTrack record vs animals with none'],
      what: 'Which facility took each animal in, or whether it was a registered pet.',
      how: ['Groups intakes by the facility that received them.', 'A registered pet has a PawTrack record, so its guardian can be alerted.']
    },
    bdPenalties: {
      icon: 'alert', title: 'Penalty tickets',
      formula: ['Unpaid amount = the sum of all unpaid tickets (PHP)', 'Paid amount = the sum of all paid tickets (PHP)', 'Waived tickets are counted but carry no amount'],
      calc: () => { const b = (window.ActivationView._live || {}).bd || {}; return b.pen ? `${b.pen.unpaid} unpaid = PHP ${Number(b.pen.unpaidPhp).toLocaleString('en-US')}; ${b.pen.paid} paid = PHP ${Number(b.pen.paidPhp).toLocaleString('en-US')}; ${b.pen.waived} waived` : ''; },
      what: 'Fines charged when a missing pet is impounded at your facility.',
      how: ['Tickets are grouped as unpaid, paid or waived.', 'Payments go to the main facility.']
    },
    bdBreeds: {
      icon: 'chart', title: 'Breeds',
      formula: ['Breed = the breed recorded, tidied (capital letters, extra spaces removed)', 'Top breeds = the five with the most intakes', 'No chip / tag (%) = intakes of that breed with no tag or microchip ÷ intakes of that breed × 100'],
      what: 'The breeds your facility takes in most.',
      how: ['Counts intakes by breed and species.', 'The bar compares each breed with the most common one.']
    },
    stay: {
      icon: 'clock', title: 'Time in holding',
      formula: ['Time in holding = now − the time the animal was taken in', 'Average = the sum of those times ÷ animals in holding', 'Longest = the largest of those times'],
      calc: () => { const l = window.ActivationView._live || {}; return l.active ? `average ${l.avgStay}, longest ${l.longestStay}, across ${l.active} ${l.active === 1 ? 'animal' : 'animals'}` : ''; },
      what: 'How long the animals now in holding have been at your facility.',
      how: ['Takes every animal that is in holding.', 'Counts the time since each was taken in.', 'Shows the average and the longest.'],
      tip: 'A long stay is worth a look: it can mean an owner has not been found or a decision is waiting.'
    },
    capacity: {
      formula: ['Capacity in use (%) = animals in holding ÷ total places × 100', 'Total places = capacity of your facility + its sub-facilities (50 for any facility with none set)'],
      calc: () => { const l = window.ActivationView._live || {}; return l.capacity ? `${l.active} ÷ ${l.capacity} × 100 = <b>${l.capacityPct}%</b>` : ''; },
      icon: 'shield', title: 'Capacity in use',
      what: 'How full your facility is.',
      how: ['Each square is one place in the facility.', 'A dark square is a place with an animal in it. Red squares are past their claim deadline and amber ones are due within 24 hours. Empty squares are free.'],
      tip: 'Set the capacity on the Facilities page. When it is nearly full, plan transfers or releases.',
      live: () => { const l = window.ActivationView._live || {}; return l.capacity ? `<b>${l.active}</b> of ${l.capacity} places taken` : 'No capacity set yet'; }
    },
    holding: {
      formula: ['In holding = impounds with status “active_impounded”', 'Past deadline = in holding AND claim deadline < now', 'Due within 24h = in holding AND 0 ≤ (claim deadline − now) < 24 hours'],
      calc: () => { const l = window.ActivationView._live || {}; return `${l.active} in holding, ${l.overdue} past deadline, ${l.dueSoon} due within 24h`; },
      icon: 'home', title: 'In holding',
      what: 'Animals currently held at your facility and not yet claimed.',
      how: ['Counts impounds that are still in holding, including those at your sub-facilities.'],
      tip: 'An animal past its claim deadline is still counted here. Those are listed under To do.'
    },
    released: {
      formula: ['Released = impounds with status “claimed”', 'Stay = release time − intake time', 'Median stay = the middle value of all stays (the mean of the two middle values when the count is even)'],
      calc: () => { const l = window.ActivationView._live || {}; return l.claimedCount ? `${l.claimedCount} released, median stay ${window.ActivationView.formatDuration(l.medianStay)}` : ''; },
      icon: 'clock', title: 'Released to owners',
      what: 'Animals your facility has handed back to their owners.',
      how: ['Counts impounds that ended as claimed.', 'The median stay is the middle length of time between intake and release.'],
      example: 'Stays of 1 day, 2 days and 9 days give a median of <b>2 days</b>, while the average would be 4. The median ignores a few unusually long cases.',
      live: () => { const l = window.ActivationView._live || {}; return l.claimedCount ? `<b>${l.claimedCount}</b> released, median stay <b>${window.ActivationView.formatDuration(l.medianStay)}</b>` : 'Nothing released yet'; }
    },
    incidents: {
      formula: ['Period total = sum of the intakes in every bar', 'Average per period = period total ÷ number of bars', 'Change (▲ / ▼) = intakes this period − intakes last period', 'Each bar = registered pets + unregistered animals taken in during that period'],
      calc: () => { const l = window.ActivationView._live || {}; const m = l.chart; return m ? `total ${m.periodTotal} ÷ ${m.chartData.length} bars = avg ${m.average.toFixed(1)}; change ${m.current.val} − ${m.previous.val} = ${m.diff > 0 ? '+' : ''}${m.diff}` : ''; },
      icon: 'chart', title: 'Intakes over time',
      what: 'How many animals your facility took in during each period.',
      how: ['Each bar adds <b>registered pets</b> (animals that have a PawTrack record) and <b>unregistered animals</b>, shown in two colors.', 'Weekly, Monthly and Yearly change the length of each bar.', 'The dashed line is the average per period.', 'The ▲ / ▼ figure compares the current period with the previous one.'],
      tip: 'The current period is still in progress, so it is usually lower than a finished one. Hover or focus a bar for exact counts.'
    },
    holdingNow: {
      icon: 'home', title: 'Holding now',
      what: 'The animals closest to their claim deadline, as individual cases.',
      how: ['Takes every animal in holding.', 'Sorts them by claim deadline, soonest first, and shows the first five.', 'The time on the right is how long is left, or how long ago the deadline passed.'],
      formula: ['Time left = claim deadline − now', 'Overdue = time left is negative', 'Due soon = time left is under 24 hours'],
      tip: 'Open the Impoundments page to see all of them.'
    },
    attention: {
      icon: 'alert', title: 'Needs attention',
      what: 'The jobs that are waiting for a person, with how many of each.',
      how: ['Each row is one kind of job, counted from the live records.', 'Rows with nothing waiting are hidden.', 'Red rows are act-now, amber rows are coming up, blue rows are in progress.'],
      formula: ['Past claim deadline = in holding AND claim deadline < now', 'Due within 24h = in holding AND 0 ≤ (claim deadline − now) < 24 hours', 'Arriving = transfers from sub-facilities not yet confirmed by you', 'Not arrived = in holding AND transfer status “not_arrived”', 'Awaiting payment = penalty tickets still unpaid for this facility'],
      calc: () => { const l = window.ActivationView._live || {}; return `${l.overdue} overdue, ${l.incoming} arriving, ${l.notArrived} not arrived, ${l.dueSoon} due soon, ${l.toCollect} unpaid`; }
    },
    advice: {
      icon: 'shield', title: 'AI decision support',
      what: 'Suggested next steps, written by AI from the figures on this page.',
      how: ['Press the button to send the page’s figures to Google Gemini through a secure PawTrack function.', 'Only counts and rates are sent, never names of owners, pets or staff.', 'Gemini returns a short summary and the actions that matter most, ranked by priority.'],
      formula: ['Recommendations = Gemini(capacity, holding, overdue claims, intakes, outcomes, species, penalties, transfers, facility fill)', 'Priority: urgent = legal or welfare risk now, high = will become urgent soon, medium = efficiency, low = housekeeping'],
      tip: 'AI can be wrong. Treat the advice as a prompt to check the page it points to, not as an order.'
    },
  },

  INFO_ICONS: {
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="10"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    funnel: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/>'
  },

  // `extra` lets another page (the Breakdown) hand over its own figures for the worked example
  openInfo(key, extra) {
    const item = this.INFO[key];
    if (!item || !window.adminApp) return;
    const prev = this._live;
    if (extra) this._live = { ...(prev || {}), ...extra };
    let live = '', calc = '';
    try { live = item.live ? item.live() : ''; calc = item.calc ? item.calc() : ''; } finally { this._live = prev; }
    const box = window.adminApp.openModalContent(`
      <div class="modal-header dash-info-head">
        <div class="dash-info-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${this.INFO_ICONS[item.icon] || ''}</svg></div>
        <div class="dash-info-heading">
          <span class="dash-info-eyebrow">About this graph</span>
          <h3>${item.title}</h3>
        </div>
        <button class="icon-btn-subtle" id="dash-info-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body dash-info-body">
        <p class="dash-info-what">${item.what}</p>
        ${live ? `<div class="dash-info-live"><span>Right now</span><div>${live}</div></div>` : ''}
        <div class="dash-info-section">
          <h4>How it works</h4>
          <ol class="dash-info-steps">${item.how.map((h) => `<li>${h}</li>`).join('')}</ol>
        </div>
        ${item.formula ? `
        <div class="dash-info-section">
          <h4>Formula</h4>
          <div class="dash-info-formula">${item.formula.map((f) => `<code>${f}</code>`).join('')}</div>
          ${calc ? `<div class="dash-info-calc"><span>With your numbers</span>${calc}</div>` : ''}
        </div>` : ''}
        ${item.example ? `<div class="dash-info-example"><h4>Example</h4><p>${item.example}</p></div>` : ''}
        ${item.tip ? `<div class="dash-info-tip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>${item.tip}</span></div>` : ''}
      </div>
      <div class="modal-footer" style="justify-content: flex-end;">
        <button class="btn btn-primary" id="dash-info-ok">Got it</button>
      </div>`);
    box?.querySelector('#dash-info-close')?.addEventListener('click', () => window.adminApp.closeModal());
    box?.querySelector('#dash-info-ok')?.addEventListener('click', () => window.adminApp.closeModal());
    box?.querySelector('#dash-info-ok')?.focus();
  },

  // The jump bar: a tap scrolls to the section, and the bar follows the section being read
  bindJumpNav(container) {
    const buttons = [...container.querySelectorAll('[data-jump]')];
    const scroller = container.closest ? container.closest('.view-viewport') || container : container;
    if (this._spyOff) { this._spyOff(); this._spyOff = null; }
    if (!buttons.length) return;
    const setActive = (id) => buttons.forEach((b) => {
      const on = b.getAttribute('data-jump') === id;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      if (on && b.scrollIntoView && b.parentElement && b.parentElement.scrollWidth > b.parentElement.clientWidth) {
        b.parentElement.scrollTo({ left: b.offsetLeft - 16, behavior: 'smooth' }); // keep it in view on a narrow screen
      }
    });
    let lock = 0; // a tap scrolls smoothly: ignore the scroll events it causes until it lands
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-jump');
      const target = container.querySelector('#' + id);
      const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setActive(id);
      lock = Date.now() + (calm ? 100 : 700);
      if (target) target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    }));
    if (!scroller.addEventListener) return;
    let frame = 0;
    const onScroll = () => {
      if (frame || Date.now() < lock) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const top = scroller.getBoundingClientRect().top + 96;
        let current = buttons[0].getAttribute('data-jump');
        buttons.forEach((b) => {
          const el = container.querySelector('#' + b.getAttribute('data-jump'));
          if (el && el.getBoundingClientRect().top <= top) current = b.getAttribute('data-jump');
        });
        // At the very bottom the last section wins even when it is short
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) current = buttons[buttons.length - 1].getAttribute('data-jump');
        setActive(current);
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    this._spyOff = () => scroller.removeEventListener('scroll', onScroll);
  },

  attachEvents(container) {
    container.querySelectorAll('.dash-info').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openInfo(btn.getAttribute('data-info'));
      });
    });

    container.querySelectorAll('.btn-timeframe').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tf = e.currentTarget.getAttribute('data-timeframe');
        if (!tf || tf === this.timeframe) return;
        this.timeframe = tf;
        this.updateChart(container);
      });
    });

    container.querySelector('#btn-refresh')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.classList.contains('is-spinning')) return;
      btn.classList.add('is-spinning');
      btn.setAttribute('aria-busy', 'true');
      const started = Date.now();
      let ok = false;
      try { ok = await window.adminStore.syncFromSupabase(); } catch (err) { ok = false; }
      // keep the spin on screen long enough to read as feedback
      await new Promise((r) => setTimeout(r, Math.max(0, 600 - (Date.now() - started))));
      btn.classList.remove('is-spinning');
      btn.removeAttribute('aria-busy');
      window.adminApp?.showToast(ok ? 'The dashboard is up to date.' : 'Could not reach the database. Showing the last data.', ok ? 'success' : 'warning', 1800);
    });

    container.querySelectorAll('[data-go]').forEach((el) => {
      el.addEventListener('click', () => { window.location.hash = '#' + el.getAttribute('data-go'); });
    });

    this.bindJumpNav(container);

    this.bindChartBody(container);
    this.bindAdvisor(container);

    container.querySelector('#btn-quick-intake')?.addEventListener('click', () => {
      if (window.ImpoundmentsView) window.ImpoundmentsView.requestIntake();
      else window.location.hash = '#impoundments';
    });

    container.querySelector('#btn-export-brief')?.addEventListener('click', () => this.downloadSummaryPdf());
  }
};

