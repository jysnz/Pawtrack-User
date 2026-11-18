/**
 * PawTrack Admin — Dashboard
 * Facility-scoped: every figure here describes the signed-in staff member's own impound facility (and, for a main
 * facility, its sub-facilities). It is computed from the facility's impoundments, transfers and penalty tickets
 * through adminStore. Registry-wide pet, missing-report and community-sighting figures are deliberately not shown.
 * Guardian contact details are not listed here either: they stay on the individual records.
 */

window.ActivationView = {
  timeframe: 'monthly', // 'weekly' | 'monthly' | 'yearly'
  funnelMode: 'percent', // 'percent' | 'number'

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
    if (hrs < 48) return `${hrs}h ${mins % 60}m`;
    return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
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
    const { overdue, intakesThisWeek, active, releaseRate } = ctx;
    return `          <div class="analytics-kpi-row">
            <div class="analytics-kpi-block">
              <div class="analytics-kpi-main-val">${periodTotal} ${periodTotal === 1 ? 'intake' : 'intakes'}</div>
              <div class="analytics-kpi-sub"><span>${periodNoun} · avg ${average.toFixed(1)} per ${unit}</span></div>
            </div>
            <div class="analytics-kpi-block">
              <div class="analytics-kpi-main-val" style="color: ${diff > 0 ? '#b45309' : 'var(--ink-primary)'};">${diff > 0 ? '▲' : diff < 0 ? '▼' : '■'} ${Math.abs(diff)}</div>
              <div class="analytics-kpi-sub"><span>${current.val} this ${unit} vs ${previous.val} last ${unit}${periodTotal ? ` · busiest: ${peak.label}` : ''}</span></div>
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

          <div class="analytics-footer-summary">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="color: ${overdue ? '#b91c1c' : '#15803d'}; font-weight: 600;">${overdue ? `${overdue} past the claim deadline` : 'No claims past their deadline'}</span>
              <span style="color: var(--ink-muted); font-size: 11px;">${intakesThisWeek} ${intakesThisWeek === 1 ? 'intake' : 'intakes'} in the last 7 days · ${active} still in holding</span>
            </div>
            <div style="font-weight: 700; color: var(--ink-primary); font-family: var(--font-mono); font-size: 13px;">
              ${releaseRate == null ? 'No closed cases yet' : `${releaseRate}% released to owners`}
            </div>
          </div>

          <div class="analytics-actions-row">
            <button class="btn btn-secondary btn-sm" id="btn-chart-view-registry">View impoundments</button>
          </div>`;
  },

  // Shown on the very first load, before the database has answered, so the page never claims "no pets yet"
  renderSkeleton(container) {
    const bar = (w, h = 12) => `<span class="dash-skel" style="width: ${w}; height: ${h}px;"></span>`;
    container.innerHTML = `
     <div class="dash-pro is-skeleton" role="status" aria-busy="true" aria-label="Loading the dashboard">
      <div class="view-header">
        <div class="view-header-titles">
          <div class="dash-eyebrow">Operations overview</div>
          <h1>Dashboard</h1>
          <div class="subtitle">${bar('280px', 12)}</div>
        </div>
      </div>
      <div class="kpi-grid" style="margin-bottom: 16px;">
        ${[0, 1, 2, 3].map(() => `
          <div class="kpi-card">
            <div class="kpi-label">${bar('96px', 10)}</div>
            <div class="kpi-body">
              <div>${bar('74px', 24)}<div style="margin-top: 8px;">${bar('130px', 10)}</div></div>
              ${bar('84px', 28)}
            </div>
          </div>`).join('')}
      </div>
      <div class="analytics-card-grid">
        <div class="analytics-card">${bar('160px', 14)}<div style="display: flex; gap: 24px;">${bar('120px', 30)}${bar('120px', 30)}</div>${bar('100%', 140)}</div>
        <div class="analytics-card">${bar('140px', 14)}${bar('100%', 9)}${bar('100%', 9)}${bar('100%', 9)}</div>
      </div>
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
    if (this._live) this._live.unit = m.unit;
  },

  bindChartBody(root) {
    root.querySelector('#btn-chart-view-registry')?.addEventListener('click', () => { window.location.hash = '#impoundments'; });
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
    const holdingSeries = intakeSeries; // arrivals feed the holding count

    // ---- Intake chart ----
    const chartModel = this.chartModel(this.timeframe, impoundments);
    const { chartData, periodTotal, average, current, previous, diff, peak, unit, periodNoun } = chartModel;
    const ctx = { impoundments, overdue: overdue.length, intakesThisWeek, active: active.length, releaseRate };

    // ---- How cases ended (every step is a share of all intakes at this facility) ----
    const outcomeBase = impoundments.length;
    const outcomeSteps = [
      { name: 'Taken in', count: outcomeBase, color: '#78716c' },
      { name: 'Released to owners', count: claimed.length, color: '#15803d' },
      { name: 'Transferred, forfeited or deceased', count: otherOutcomes.length, color: '#b45309' },
      { name: 'Still in holding', count: active.length, color: '#c2410c' }
    ].map((s) => ({ ...s, percent: outcomeBase ? Math.round((s.count / outcomeBase) * 100) : 0 }));

    // ---- Needs attention (each links to where staff can act) ----
    const attention = [
      { n: overdue.length, label: 'impounded pets past their claim deadline', route: 'impoundments', tone: 'danger' },
      { n: incoming.length, label: 'pets arriving from sub-facilities, waiting for you to confirm', route: 'impoundments', tone: 'danger' },
      { n: notArrived.length, label: 'transfers reported as not arrived', route: 'impoundments', tone: 'danger' },
      { n: dueSoon.length, label: 'claim deadlines within 24 hours', route: 'impoundments', tone: 'warn' },
      { n: toCollect.length, label: 'penalty tickets waiting for payment', route: 'impoundments', tone: 'warn' },
      { n: outgoing.length, label: `pets being moved to ${mainFacility ? mainFacility.name : 'the main facility'}`, route: 'impoundments', tone: 'info' }
    ].filter((a) => a.n > 0);

    const stalls = [
      ['Intake', 'Animals currently in holding', active.length ? `${active.length} ${active.length === 1 ? 'pet' : 'pets'}` : 'Clear'],
      ['Claim processing', 'Past the claim deadline', overdue.length ? `${overdue.length} overdue` : 'Clear'],
      ['Transfers', 'Arrivals waiting for confirmation', incoming.length ? `${incoming.length} waiting` : 'Clear'],
      ['Penalties', 'Tickets waiting for payment', toCollect.length ? `${toCollect.length} unpaid` : 'Clear']
    ];

    const makeSparkline = (vals, color = '#c2410c') => {
      const sw = 84, sh = 28;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const span = max - min || 1;
      const pts = vals.map((v, i) => [(i / (vals.length - 1)) * sw, sh - 3 - ((v - min) / span) * (sh - 6)]);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const last = pts[pts.length - 1];
      return `<svg width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}" aria-hidden="true">` +
        `<path class="spark-area" d="${d} L ${sw},${sh} L 0,${sh} Z" fill="${color}" />` +
        `<path class="spark-line" pathLength="1" d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />` +
        `<circle class="spark-dot" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.4" fill="${color}" /></svg>`;
    };

    const info = (key) => `<button type="button" class="dash-info" data-info="${key}" aria-label="What does this show?" title="What does this show?">i</button>`;

    let kpiIndex = 0;
    const KPI_ICON = { capacity: 'shield', holding: 'home', intakes: 'plus', released: 'clock' };
    const kpi = (key, label, value, delta, deltaClass, spark, color) => `
      <div class="kpi-card kpi-rich" style="--k:${kpiIndex++}; --c:${color}">
        <div class="kpi-label"><span class="kpi-ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${this.INFO_ICONS[KPI_ICON[key]] || ''}</svg></span><span class="kpi-name">${label}</span>${info(key)}</div>
        <div class="kpi-body">
          <div>
            <div class="kpi-value">${value}</div>
            <div class="kpi-delta ${deltaClass}">${delta}</div>
          </div>
          <div class="kpi-spark">${makeSparkline(spark, color)}</div>
        </div>
      </div>`;

    // ---- Holding by species (donut) ----
    const SPECIES_COLORS = { Dog: '#b45309', Cat: '#2563eb', Other: '#a8a29e' };
    const speciesCounts = {};
    active.forEach((i) => { const k = i.species || 'Other'; speciesCounts[k] = (speciesCounts[k] || 0) + 1; });
    const speciesSlices = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1]).map(([label, n]) => [label, n, SPECIES_COLORS[label] || '#78716c']);
    let donutAt = 0;
    const donutSegs = speciesSlices.map(([label, n, color], i) => {
      const len = active.length ? (n / active.length) * 100 : 0;
      const seg = len > 0
        ? `<circle class="donut-seg" style="--i:${i}" cx="21" cy="21" r="15.9155" pathLength="100" fill="none" stroke="${color}" stroke-width="5" stroke-dasharray="${Math.max(len - 0.8, 0.1).toFixed(2)} 100" stroke-dashoffset="${(-donutAt).toFixed(2)}" />`
        : '';
      donutAt += len;
      return seg;
    }).join('');

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
        return { name: i.petName || 'Unidentified animal', sub: [i.species, i.cageNumber, where].filter(Boolean).join(' · ') || 'No cage yet', photo: i.photoUrl || '', tone, label };
      });

    // ---- By facility (main facility with sub-facilities) ----
    const facilityRows = treeShelters.map((s) => {
      const here = active.filter((i) => i.shelterId === s.id);
      const late = here.filter((i) => { const d = deadlineOf(i); return d != null && d < now; }).length;
      const cap = s.capacity == null ? 50 : Number(s.capacity) || 0;
      return { name: s.name, main: !s.parentId, n: here.length, late, cap, pct: cap ? Math.min(Math.round((here.length / cap) * 100), 100) : 0 };
    }).sort((a, b) => Number(b.main) - Number(a.main) || b.n - a.n);

    const scopeName = mine ? mine.name : 'Your impound facility';
    // The page is for one facility: name it, and say how it relates to its main facility when it is a sub-facility
    const scopeRole = mainFacility ? `Sub-facility of ${mainFacility.name}` : 'Main facility';
    const scopeNote = `${scopeName} · ${scopeRole}`;
    const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    container.innerHTML = `
     <div class="dash-pro${animate ? ' is-animated' : ''}${fromSkeleton ? ' from-skeleton' : ''}">
      <div class="view-header">
        <div class="view-header-titles">
          <div class="dash-eyebrow"><span class="dash-eyebrow-name">${escHtml(scopeName)}</span><span class="dash-eyebrow-role"> · ${escHtml(scopeRole)}</span></div>
          <h1>Dashboard</h1>
          <div class="subtitle"><span>${todayLabel} · Your facility's impoundments, transfers and penalties, live from the database</span></div>
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

      <div class="kpi-grid" style="margin-bottom: 16px;">
        ${kpi('capacity', 'Capacity in use', capacityPct == null ? '—' : `${capacityPct}%`,
          capacity ? `${active.length} of ${capacity} places taken` : 'Set a capacity on the Facilities page',
          capacityPct != null && capacityPct >= 90 ? 'down' : 'up', holdingSeries, '#15803d')}
        ${kpi('holding', 'In holding now', `${active.length} <span class="kpi-unit">${active.length === 1 ? 'animal' : 'animals'}</span>`,
          overdue.length ? `${overdue.length} past deadline` : (dueSoon.length ? `${dueSoon.length} due within 24h` : 'None past deadline'),
          overdue.length ? 'down' : 'up', holdingSeries, '#b45309')}
        ${kpi('intakes', 'Intakes this week', `${intakesThisWeek} <span class="kpi-unit">${intakesThisWeek === 1 ? 'animal' : 'animals'}</span>`,
          intakesToday ? `${intakesToday} today` : `${impoundments.length} in total`,
          intakesThisWeek ? 'up' : 'neutral', intakeSeries, '#c2410c')}
        ${kpi('released', 'Released to owners', `${claimed.length} <span class="kpi-unit">in total</span>`,
          medianStay != null ? `Median stay ${this.formatDuration(medianStay)}` : (releasedThisWeek ? `${releasedThisWeek} this week` : 'None released yet'),
          'neutral', releaseSeries, '#1c1917')}
      </div>

      <div class="dash-row dash-row-main">
        <!-- Intake chart -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <div class="analytics-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color: var(--brand-terracotta);"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              <span>Intakes over time</span>
              ${info('incidents')}
            </div>
            <div class="dash-segmented is-sliding" role="tablist" aria-label="Time range" style="--seg: ${this.TIMEFRAMES.indexOf(this.timeframe)};">
              ${['weekly', 'monthly', 'yearly'].map((tf) => `<button class="${this.timeframe === tf ? 'active' : ''} btn-timeframe" data-timeframe="${tf}" role="tab" aria-selected="${this.timeframe === tf}">${tf[0].toUpperCase() + tf.slice(1)}</button>`).join('')}
            </div>
          </div>

          <div class="dash-chart-body" id="dash-chart-body">${this.chartBodyHtml(chartModel, ctx)}</div>
        </div>
        <aside class="analytics-card dash-needs" aria-label="Needs attention">
          <div class="analytics-card-header">
            <div class="analytics-card-title">
              <span>${attention.length ? 'Needs attention' : 'All clear'}</span>
              ${attention.length ? `<span class="dash-count">${attention.reduce((a, x) => a + x.n, 0)}</span>` : ''}
            </div>
          </div>
          ${attention.length ? `
            <div class="dash-attention-list">
              ${attention.map((a, idx) => `
                <button class="dash-attention-item tone-${a.tone}" data-go="${a.route}" style="--i:${idx}">
                  ${a.tone === 'danger' ? '<span class="dash-pulse" aria-hidden="true"></span>' : ''}<b>${a.n}</b><span>${escHtml(a.label)}</span><i aria-hidden="true">→</i>
                </button>`).join('')}
            </div>` : `
            <div class="dash-clear">
              <svg class="dash-check" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>
              <b>Nothing needs attention</b>
              <span>No overdue claims, incoming transfers or unpaid penalties right now.</span>
            </div>`}
        </aside>
      </div>

      <div class="dash-row dash-row-3">
        <!-- How cases ended -->
        <div class="analytics-card funnel-card">
          <div class="analytics-card-header">
            <div class="analytics-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color: #16a34a;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span>How cases ended</span>
              ${info('funnel')}
            </div>
            <button class="btn btn-sm btn-secondary" id="btn-toggle-recovery-funnel" title="Switch between percentages and counts" style="padding: 2px 7px; font-size: 10px;">
              ${this.funnelMode === 'percent' ? 'Show counts' : 'Show %'}
            </button>
          </div>

          ${outcomeBase === 0 ? `
            <div class="dash-empty">
              <div class="dash-empty-title">No intakes yet</div>
              <div>Animals your facility takes in, and how each case ends, show up here.</div>
            </div>
          ` : `
            <div class="funnel-list" style="margin: 8px 0;">
              ${outcomeSteps.map((step, idx) => `
                <div class="funnel-step" style="--i:${idx}">
                  <div>
                    <div class="funnel-step-head">
                      <span style="font-weight: 650; color: var(--ink-primary);">${step.name}</span>
                      <span class="funnel-step-count">${step.count}</span>
                    </div>
                    <div class="funnel-track">
                      <div class="funnel-fill" style="width: ${Math.max((step.count / outcomeBase) * 100, step.count ? 4 : 0)}%; background: ${step.color};"></div>
                    </div>
                  </div>
                  <span class="funnel-keep" data-percent="${step.percent}%" data-count="${step.count}" style="color: ${step.color};">${this.funnelMode === 'percent' ? step.percent + '%' : step.count}</span>
                </div>`).join('')}
            </div>
          `}

          <div class="analytics-footer-summary" style="margin-top: 4px;">
            <span style="color: var(--ink-secondary); font-size: 11.5px;">In holding: <b style="color: var(--ink-primary);">${active.length}</b> · Closed: <b style="color: var(--ink-primary);">${closed.length}</b></span>
            <span style="color: #16a34a; font-weight: 700; font-size: 11.5px;">${releaseRate == null ? '' : `Released: ${releaseRate}%`}</span>
          </div>
        </div>
        <div class="analytics-card dash-status">
          <div class="analytics-card-header">
            <div class="analytics-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color: #2563eb;"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
              <span>Holding by species</span>
            </div>
          </div>
          ${active.length ? `
            <div class="dash-donut-row">
              <div class="dash-donut" role="img" aria-label="${speciesSlices.map((x) => x[0] + ' ' + x[1]).join(', ')}">
                <svg viewBox="0 0 42 42" width="132" height="132"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--bg-hover)" stroke-width="5"/><g transform="rotate(-90 21 21)">${donutSegs}</g></svg>
                <div class="dash-donut-center"><b>${active.length}</b><span>in holding</span></div>
              </div>
              <ul class="dash-legend-list">
                ${speciesSlices.map(([label, n, color]) => `<li><i style="background: ${color}"></i><span>${escHtml(label)}</span><b>${n}</b></li>`).join('')}
              </ul>
            </div>` : `
            <div class="dash-empty"><div class="dash-empty-title">Nobody in holding</div>The species of the animals you are holding appear here.</div>`}
        </div>
        <div class="analytics-card dash-holding">
          <div class="analytics-card-header">
            <div class="analytics-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color: #b45309;"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/></svg>
              <span>Holding now</span>
              ${active.length ? `<span class="dash-count dash-count-muted">${active.length}</span>` : ''}
            </div>
            <button class="btn btn-sm btn-secondary" data-go="impoundments" style="padding: 2px 8px; font-size: 10px;">View all</button>
          </div>
          ${holdingRows.length ? `
            <ul class="dash-hold-list">
              ${holdingRows.map((h, idx) => `
                <li style="--i:${idx}">
                  <button type="button" class="dash-hold-row" data-go="impoundments">
                    ${h.photo ? `<img class="dash-hold-img" src="${escHtml(h.photo)}" alt="" loading="lazy" />` : '<span class="dash-hold-img dash-hold-ph" aria-hidden="true">🐾</span>'}
                    <span class="dash-hold-text"><b>${escHtml(h.name)}</b><small>${escHtml(h.sub)}</small></span>
                    <span class="dash-time tone-${h.tone}">${escHtml(h.label)}</span>
                  </button>
                </li>`).join('')}
            </ul>` : `
            <div class="dash-empty"><div class="dash-empty-title">Nobody in holding</div>Animals brought to your facility appear here with their claim countdown.</div>`}
        </div>
      </div>

      ${(subs.length || showPenalties) ? `
      <div class="dash-row dash-row-pair">
        ${subs.length ? `
        <div class="analytics-card dash-facilities">
          <div class="analytics-card-header">
            <div class="analytics-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color: #78716c;"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>
              <span>By facility</span>
            </div>
            <button class="btn btn-sm btn-secondary" data-go="shelters" style="padding: 2px 8px; font-size: 10px;">Manage</button>
          </div>
          <ul class="dash-fac-list">
            ${facilityRows.map((f) => `
              <li>
                <div class="dash-fac-top"><b>${escHtml(f.name)}</b>${f.main ? '<em>Main</em>' : '<em class="is-sub">Sub</em>'}<span>${f.n}${f.cap ? ' / ' + f.cap : ''} in holding${f.late ? ` · <i class="is-late">${f.late} overdue</i>` : ''}</span></div>
                ${f.cap ? `<div class="funnel-track"><div class="funnel-fill" style="width: ${Math.max(f.pct, f.n ? 4 : 0)}%; background: ${f.pct >= 90 ? '#b91c1c' : '#b45309'};"></div></div>` : ''}
              </li>`).join('')}
          </ul>
        </div>` : ''}
        ${showPenalties ? `
        <div class="analytics-card dash-penalties">
          <div class="analytics-card-header">
            <div class="analytics-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color: #b91c1c;"><path d="M3 7h18v10H3zM3 11h18"/><path d="M7 15h2"/></svg>
              <span>Penalty tickets</span>
              ${unpaid.length ? `<span class="dash-count">${unpaid.length}</span>` : ''}
            </div>
            <button class="btn btn-sm btn-secondary" data-go="impoundments" style="padding: 2px 8px; font-size: 10px;">View</button>
          </div>
          <ul class="dash-legend-list dash-pen-list">
            <li><i style="background: #b91c1c"></i><span>Unpaid</span><b>${unpaid.length} · PHP ${sumPhp(unpaid).toLocaleString('en-US')}</b></li>
            <li><i style="background: #15803d"></i><span>Paid</span><b>${paidT.length} · PHP ${sumPhp(paidT).toLocaleString('en-US')}</b></li>
            <li><i style="background: #a8a29e"></i><span>Waived</span><b>${waivedT.length}</b></li>
          </ul>
          <div class="dash-pen-note">Charged when a missing pet is impounded at this facility${subs.length ? ' or a sub-facility' : ''}. Payments go to the main facility.</div>
        </div>` : ''}
      </div>` : ''}
     </div>
    `;

    this._live = { medianStay, claimedCount: claimed.length, unit, capacity, capacityPct, active: active.length, intakesThisWeek };
    this._ctx = ctx;
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
      impounded: { active: active.length, claimed: claimed.length, overdue: overdue.length, dueSoon: dueSoon.length, closed: closed.length },
      holding: active.slice().sort((x, y) => (deadlineOf(x) ?? Infinity) - (deadlineOf(y) ?? Infinity)),
      penalties: showPenalties ? { unpaid: unpaid.length, unpaidPhp: sumPhp(unpaid), paid: paidT.length, paidPhp: sumPhp(paidT), waived: waivedT.length } : null,
      releaseRate, intakesThisWeek, now
    };
    this.attachEvents(container);
  },

  downloadSummaryPdf() {
    const JsPDF = window.jspdf && window.jspdf.jsPDF;
    const r = this._report;
    if (!JsPDF || !r) { window.adminApp?.showToast('PDF tool could not load. Check your connection and try again.', 'error'); return; }

    const doc = new JsPDF({ unit: 'pt', format: 'a4' });
    const W = 595, H = 842, M = 40, CW = W - M * 2;
    const INK = [28, 25, 23], MUTED = [110, 104, 99], TERRA = [194, 65, 12], GREEN = [21, 128, 61], RED = [185, 28, 28], AMBER = [180, 83, 9], LINE = [226, 223, 220], TINT = [248, 246, 243], HEADBG = [240, 237, 233], SLATE = [68, 64, 60];
    let secNo = 0;
    const clean = (v) => String(v ?? '').replace(/[^\x20-\x7E -ÿ]/g, '-');
    const fmtDate = (v) => { const t = this.toTime(v); return t == null ? '-' : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
    const fmtDateTime = (v) => { const t = this.toTime(v); return t == null ? '-' : new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
    const cut = (txt, w) => { let t = clean(txt); if (doc.getTextWidth(t) <= w) return t; while (t.length > 1 && doc.getTextWidth(t + '...') > w) t = t.slice(0, -1); return t + '...'; };
    let y = 0;

    const ensure = (h) => { if (y + h > H - 50) { doc.addPage(); y = M; } };
    const section = (title, note) => {
      ensure(70);
      y += 16;
      secNo += 1;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TERRA);
      doc.text(String(secNo).padStart(2, '0'), M, y);
      doc.setFontSize(13); doc.setTextColor(...INK);
      doc.text(clean(title), M + 22, y);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(M, y + 8, W - M, y + 8);
      y += 24;
      if (note) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); const lines = doc.splitTextToSize(clean(note), CW); doc.text(lines, M, y); y += lines.length * 11.5 + 6; }
    };
    const para = (txt, color = INK, size = 10) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
      const lines = doc.splitTextToSize(clean(txt), CW);
      ensure(lines.length * 13 + 4);
      doc.text(lines, M, y + 10); y += lines.length * 13 + 4;
    };
    const table = (cols, rows, emptyText) => {
      const xs = []; let cx = M;
      cols.forEach((c) => { xs.push(cx); cx += c.w * CW; });
      const head = () => {
        doc.setFillColor(...HEADBG); doc.rect(M, y, CW, 20, 'F'); doc.setDrawColor(...SLATE); doc.setLineWidth(0.8); doc.line(M, y + 20, W - M, y + 20);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...SLATE);
        cols.forEach((c, i) => doc.text(clean(c.label).toUpperCase(), c.align === 'right' ? xs[i] + c.w * CW - 6 : xs[i] + 6, y + 13, { align: c.align === 'right' ? 'right' : 'left' }));
        y += 20;
      };
      ensure(60); head();
      if (!rows.length) { doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); doc.setTextColor(...MUTED); doc.text(clean(emptyText || 'Nothing to show.'), M + 6, y + 16); y += 26; return; }
      rows.forEach((row, ri) => {
        if (y + 22 > H - 50) { doc.addPage(); y = M; head(); }
        if (ri % 2 === 1) { doc.setFillColor(...TINT); doc.rect(M, y, CW, 22, 'F'); }
        doc.setFontSize(9);
        row.forEach((cell, i) => {
          const val = (cell && typeof cell === 'object') ? cell : { t: cell };
          doc.setTextColor(...(val.color || INK));
          doc.setFont('helvetica', val.bold ? 'bold' : 'normal');
          const txt = cut(val.t, cols[i].w * CW - 12);
          doc.text(txt, cols[i].align === 'right' ? xs[i] + cols[i].w * CW - 6 : xs[i] + 6, y + 14, { align: cols[i].align === 'right' ? 'right' : 'left' });
        });
        y += 22;
      });
      doc.setDrawColor(...LINE); doc.line(M, y, W - M, y); y += 6;
    };
    const bar = (label, value, max, color, right) => {
      ensure(24);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
      doc.text(clean(label), M, y + 10);
      const bx = M + 170, bw = CW - 170 - 120;
      doc.setFillColor(...LINE); doc.roundedRect(bx, y + 2, bw, 10, 3, 3, 'F');
      if (value > 0 && max > 0) { doc.setFillColor(...color); doc.roundedRect(bx, y + 2, Math.max(bw * (value / max), 6), 10, 3, 3, 'F'); }
      doc.setFont('helvetica', 'bold'); doc.text(clean(right ?? value), W - M, y + 10, { align: 'right' });
      y += 22;
    };

    // ---- Header ----
    doc.setFillColor(...INK); doc.rect(0, 0, W, 108, 'F');
    doc.setFillColor(...TERRA); doc.rect(0, 108, W, 4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(251, 146, 60);
    doc.text('PAWTRACK  |  FACILITY REPORT', M, 38);
    doc.setFontSize(24); doc.setTextColor(255);
    doc.text('Dashboard Summary', M, 68);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(214, 211, 209);
    doc.text(clean(r.facility), M, 86);
    doc.setFontSize(9); doc.text(r.generatedAt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), W - M, 68, { align: 'right' });
    doc.text(r.generatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }), W - M, 82, { align: 'right' });
    y = 112;

    // ---- Executive summary ----
    const m = Object.fromEntries(r.metrics);
    const bits = [
      `${r.facility}: ${r.impounded.active} animal(s) in holding${m['Capacity in use'] !== 'n/a' ? ` (${m['Capacity in use']} of capacity)` : ''}${r.impounded.overdue ? `, ${r.impounded.overdue} past their claim deadline` : ''}, ${r.impounded.dueSoon} due within 24 hours.`,
      `${r.intakesThisWeek} intake(s) in the last 7 days; ${r.impounded.claimed} animal(s) released to their owners so far${r.releaseRate == null ? '' : ` (${r.releaseRate}% of closed cases)`}.`,
      r.penalties ? `${r.penalties.unpaid} penalty ticket(s) are unpaid (PHP ${r.penalties.unpaidPhp.toLocaleString('en-US')}).` : '',
      r.attention.length ? `Priority: ${r.attention[0]}.` : 'Nothing currently needs urgent attention.'
    ].filter(Boolean);
    y += 18;
    doc.setFillColor(...TINT); doc.setDrawColor(...LINE); doc.setLineWidth(0.6);
    const sumLines = doc.splitTextToSize(clean(bits.join(' ')), CW - 32);
    const sumH = sumLines.length * 13 + 30;
    doc.roundedRect(M, y, CW, sumH, 4, 4, 'FD');
    doc.setFillColor(...TERRA); doc.rect(M, y, 3, sumH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...TERRA); doc.text('EXECUTIVE SUMMARY', M + 16, y + 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK); doc.text(sumLines, M + 16, y + 32);
    y += sumH;

    // ---- Key metrics ----
    section('Key metrics', 'The position of your facility at the time this report was generated.');
    const cardW = (CW - 18) / 4, cardH = 56;
    r.metrics.forEach((mt, i) => {
      if (i % 4 === 0 && i > 0) y += cardH + 6;
      const x = M + (i % 4) * (cardW + 6);
      doc.setFillColor(255, 255, 255); doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.roundedRect(x, y, cardW, cardH, 4, 4, 'FD');
      doc.setFillColor(...TERRA); doc.rect(x, y + 8, 2, cardH - 16, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED);
      doc.text(cut(mt[0].toUpperCase(), cardW - 22), x + 12, y + 17);
      doc.setFontSize(18); doc.setTextColor(...INK);
      doc.text(cut(mt[1], cardW - 22), x + 12, y + 42);
    });
    y += cardH + 8;

    // ---- Needs attention ----
    section('Needs attention');
    if (r.attention.length) r.attention.forEach((t) => { ensure(18); doc.setFillColor(...RED); doc.circle(M + 4, y + 7, 2.5, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK); doc.text(clean(t), M + 14, y + 11); y += 17; });
    else para('All clear: no overdue claims, incoming transfers or unpaid penalties right now.', GREEN);

    // ---- Intake activity ----
    section(`Intakes over time (${r.periodNoun})`, `Animals taken in by your facility. ${r.periodTotal} total, averaging ${r.average.toFixed(1)} per ${r.unit}. This ${r.unit}: ${r.current.val}; last ${r.unit}: ${r.previous.val} (${r.diff > 0 ? 'up ' + r.diff : r.diff < 0 ? 'down ' + Math.abs(r.diff) : 'no change'}).${r.periodTotal ? ' Busiest period: ' + r.peak.label + (r.peak.sub ? ' ' + r.peak.sub : '') + '.' : ''}`);
    const maxBar = Math.max(...r.chart.map((d) => d.val), 1);
    r.chart.forEach((d) => bar(d.label + (d.sub ? ' ' + d.sub : ''), d.val, maxBar, d.active ? TERRA : AMBER, `${d.val}  (${d.reg} registered / ${d.other} unregistered)`));

    // ---- How cases ended ----
    section('How cases ended', 'Every intake at your facility, and how its case ended. Each step is a share of all intakes.');
    if (!r.outcomeBase) para('No intakes yet.', MUTED);
    else r.outcomes.forEach((st) => bar(st.name, st.count, r.outcomeBase, st.color === '#15803d' ? GREEN : st.color === '#78716c' ? SLATE : TERRA, `${st.count}  (${st.percent}%)`));

    // ---- Workload ----
    section('Where work is waiting', 'Current workload by stage.');
    table([{ label: 'Stage', w: 0.28 }, { label: 'What it measures', w: 0.47 }, { label: 'Status', w: 0.25, align: 'right' }],
      r.stalls.map((s) => [{ t: s[0], bold: true }, s[1], { t: s[2], bold: true, color: s[2] === 'Clear' ? GREEN : AMBER }]));

    // ---- Holding breakdown ----
    section('Holding breakdown', 'Animals in holding by species, then by facility.');
    if (r.species.length) { const spMax = Math.max(...r.species.map((x) => x[1]), 1); r.species.forEach(([l, n]) => bar(l, n, spMax, TERRA)); }
    else para('Nobody is in holding.', MUTED);
    if (r.facilities.length > 1) {
      y += 4;
      table([{ label: 'Facility', w: 0.46 }, { label: 'Type', w: 0.14 }, { label: 'In holding', w: 0.2, align: 'right' }, { label: 'Overdue', w: 0.2, align: 'right' }],
        r.facilities.map((f) => [{ t: f.name, bold: true }, f.main ? 'Main' : 'Sub', f.cap ? `${f.n} / ${f.cap}` : String(f.n), { t: String(f.late), color: f.late ? RED : INK, bold: !!f.late }]));
    }

    // ---- Shelter detail ----
    section('Shelter holding', `${r.impounded.active} in holding, ${r.impounded.overdue} past their claim deadline, ${r.impounded.dueSoon} due within 24 hours, ${r.impounded.claimed} released so far. Sorted by nearest deadline.`);
    table([{ label: 'Pet', w: 0.2 }, { label: 'Species', w: 0.1 }, { label: 'Facility', w: 0.24 }, { label: 'Intake', w: 0.2 }, { label: 'Claim deadline', w: 0.26 }],
      r.holding.map((i) => { const d = this.toTime(i.claimDeadline); const late = d != null && d < r.now; return [{ t: i.petName || 'Unknown', bold: true }, i.species, i.shelterName, fmtDate(i.intakeDate), { t: fmtDateTime(i.claimDeadline) + (late ? ' (overdue)' : ''), color: late ? RED : INK, bold: late }]; }),
      'No animals are currently in holding.');

    // ---- Penalties ----
    if (r.penalties) {
      section('Penalty tickets', 'Charged when a missing pet is impounded at your facility or a sub-facility. Payments go to the main facility.');
      table([{ label: 'Status', w: 0.4 }, { label: 'Tickets', w: 0.25, align: 'right' }, { label: 'Amount (PHP)', w: 0.35, align: 'right' }],
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
      doc.text('PawTrack  |  Dashboard Summary  |  Confidential - for authorised staff only', M, H - 22);
      doc.text(`Page ${i} of ${pages}`, W - M, H - 22, { align: 'right' });
    }

    doc.setProperties({ title: 'PawTrack Dashboard Summary', subject: 'Facility report', author: 'PawTrack Admin', creator: 'PawTrack' });
    doc.save(`pawtrack-summary-${r.generatedAt.toISOString().slice(0, 10)}.pdf`);
    window.adminApp?.showToast('Dashboard summary downloaded.', 'success');
  },

  // Each entry: icon, what (one-line summary), how (steps), example, live (optional "right now" line), tip
  INFO: {
    capacity: {
      icon: 'shield', title: 'Capacity in use',
      what: 'How full your facility is.',
      how: ['Counts the animals currently in holding.', 'Divides that by the number of places your facility (and its sub-facilities) has.'],
      tip: 'Set the capacity on the Facilities page. Above 90% the figure turns red so you can plan transfers or releases.',
      live: () => { const l = window.ActivationView._live || {}; return l.capacity ? `<b>${l.active}</b> of ${l.capacity} places taken` : 'No capacity set yet'; }
    },
    holding: {
      icon: 'home', title: 'In holding now',
      what: 'Animals currently held at your facility and not yet claimed.',
      how: ['Counts impounds that are still in holding, including those at your sub-facilities.', 'The line shows how many animals arrived on each of the last 7 days.'],
      tip: '“Past deadline” means the claim deadline has passed and the animal is still in holding. Those also appear under Needs attention.'
    },
    intakes: {
      icon: 'plus', title: 'Intakes this week',
      what: 'How many animals your facility took in during the last 7 days.',
      how: ['The big number is the 7-day total.', 'The line beside it shows the count for each of those days.'],
      tip: 'If nothing came in today, the card shows your total number of intakes instead.'
    },
    released: {
      icon: 'clock', title: 'Released to owners',
      what: 'Animals your facility has handed back to their owners.',
      how: ['Counts impounds that ended as claimed.', 'The median stay is the middle length of time between intake and release.'],
      example: 'Stays of 1 day, 2 days and 9 days give a median of <b>2 days</b>, while the average would be 4. The median ignores a few unusually long cases.',
      tip: 'The line shows releases per day over the last 7 days.',
      live: () => { const l = window.ActivationView._live || {}; return l.claimedCount ? `<b>${l.claimedCount}</b> released, median stay <b>${window.ActivationView.formatDuration(l.medianStay)}</b>` : 'Nothing released yet'; }
    },
    incidents: {
      icon: 'chart', title: 'Intakes over time',
      what: 'How many animals your facility took in during each period.',
      how: ['Each bar adds <b>registered pets</b> (animals that have a PawTrack record) and <b>unregistered animals</b>, shown in two colors.', 'Weekly, Monthly and Yearly change the length of each bar.', 'The dashed line is the average per period.', 'The ▲ / ▼ figure compares the current period with the previous one.'],
      tip: 'The current period is still in progress, so it is usually lower than a finished one. Hover or focus a bar for exact counts.'
    },
    funnel: {
      icon: 'funnel', title: 'How cases ended',
      what: 'Where every animal your facility took in ended up.',
      how: ['<b>Taken in</b> is every intake.', '<b>Released to owners</b>, <b>transferred / forfeited / deceased</b> and <b>still in holding</b> add up to it.', 'Each bar is a share of all intakes.'],
      tip: 'Use “Show counts” to switch between percentages and whole numbers.'
    }
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

  openInfo(key) {
    const item = this.INFO[key];
    if (!item || !window.adminApp) return;
    const live = item.live ? item.live() : '';
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

    // Percent <-> count only changes the labels, so swap them in place instead of redrawing the page
    container.querySelector('#btn-toggle-recovery-funnel')?.addEventListener('click', (e) => {
      this.funnelMode = this.funnelMode === 'percent' ? 'number' : 'percent';
      e.currentTarget.textContent = this.funnelMode === 'percent' ? 'Show counts' : 'Show %';
      container.querySelectorAll('.funnel-keep').forEach((el) => {
        el.textContent = this.funnelMode === 'percent' ? el.getAttribute('data-percent') : el.getAttribute('data-count');
        el.classList.remove('is-swapped');
        void el.offsetWidth; // restart the little swap animation
        el.classList.add('is-swapped');
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

    this.bindChartBody(container);

    container.querySelector('#btn-quick-intake')?.addEventListener('click', () => {
      if (window.ImpoundmentsView) window.ImpoundmentsView.requestIntake();
      else window.location.hash = '#impoundments';
    });

    container.querySelector('#btn-export-brief')?.addEventListener('click', () => this.downloadSummaryPdf());
  }
};

