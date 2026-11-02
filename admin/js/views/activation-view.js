/**
 * PawTrack Admin — Dashboard
 * Every figure here is computed from the database through adminStore
 * (registered_pets, missing_pets, community_sightings, impounded_pets, nfc_tags).
 * Guardian contact details are deliberately NOT listed here: they stay on the individual
 * pet / case records that staff open when they have a reason to.
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

  render(container) {
    const store = window.adminStore;
    const pets = store.getPets ? (store.getPets() || []) : [];
    const cases = store.getCases ? (store.getCases() || []) : [];
    const impoundments = store.getImpoundments ? (store.getImpoundments() || []) : [];
    const sightings = store.getSightings ? (store.getSightings() || []) : [];
    const now = Date.now();

    // ---- Pets ----
    const totalPets = pets.length;
    const countStatus = (s) => pets.filter((p) => p.status === s).length;
    const safePets = countStatus('safe');
    const reunitedPets = countStatus('reunited');
    const protectedPct = totalPets ? Math.round(((safePets + reunitedPets) / totalPets) * 100) : 0;
    const microchipped = pets.filter((p) => p.microchipNo || p.rfidTag).length;
    const chippedPct = totalPets ? Math.round((microchipped / totalPets) * 100) : 0;

    // ---- Cases (missing reports) ----
    const reunitedCases = cases.filter((c) => c.status === 'reunited');
    const openCases = cases.filter((c) => c.status !== 'reunited');
    const sightedCases = cases.filter((c) => (c.timeline || []).some((t) => t.type === 'sighting') || c.status === 'sighted' || c.status === 'reunited');
    const recoveryTimes = reunitedCases
      .map((c) => (this.toTime(c.lastUpdated) ?? 0) - (this.toTime(c.createdAt) ?? 0))
      .filter((ms) => ms >= 0);
    const medianRecovery = this.median(recoveryTimes);
    const resolutionRate = cases.length ? Math.round((reunitedCases.length / cases.length) * 100) : null;

    // ---- Impoundments & sightings ----
    const active = impoundments.filter((i) => i.status === 'active_impounded');
    const claimed = impoundments.filter((i) => i.status === 'claimed');
    const overdue = active.filter((i) => { const d = this.toTime(i.claimDeadline); return d != null && d < now; });
    const dueSoon = active.filter((i) => { const d = this.toTime(i.claimDeadline); return d != null && d >= now && d - now < 24 * 3600 * 1000; });
    const awaitingReview = sightings.filter((s) => s.status === 'under_review' || s.status === 'possible_sighting');
    const staleCases = openCases.filter((c) => {
      const t = this.toTime(c.lastUpdated);
      return t != null && now - t > 72 * 3600 * 1000;
    });

    // ---- KPI sparklines (last 7 days) ----
    const regSeries = this.dailySeries(pets.map((p) => this.toTime(p.registeredDate)));
    const regThisWeek = regSeries.reduce((a, b) => a + b, 0);
    const regToday = regSeries[regSeries.length - 1];
    const intakeSeries = this.dailySeries(impoundments.map((i) => this.toTime(i.intakeDate)));
    const caseSeries = this.dailySeries(cases.map((c) => this.toTime(c.createdAt)));
    const casesThisWeek = caseSeries.reduce((a, b) => a + b, 0);

    // ---- Incident chart: stacked per period, missing reports + shelter intakes ----
    const caseTimes = cases.map((c) => this.toTime(c.createdAt)).filter((t) => t != null);
    const intakeTimes = impoundments.map((i) => this.toTime(i.intakeDate)).filter((t) => t != null);
    const inRange = (list, b) => list.filter((t) => t >= b.from && t < b.to).length;
    const chartData = this.buildBuckets(this.timeframe).map((b) => {
      const missing = inRange(caseTimes, b);
      const intake = inRange(intakeTimes, b);
      return { ...b, missing, intake, val: missing + intake };
    });
    const maxVal = Math.max(...chartData.map((d) => d.val), 0);
    const axisMax = Math.max(Math.ceil(maxVal / 3) * 3, 3); // multiple of 3 so the gridlines land on whole numbers
    const periodTotal = chartData.reduce((a, d) => a + d.val, 0);
    const peak = chartData.reduce((best, d) => (d.val > best.val ? d : best), chartData[0]);
    const average = periodTotal / chartData.length;
    const current = chartData[chartData.length - 1];
    const previous = chartData[chartData.length - 2];
    const diff = current.val - previous.val;
    const unit = { weekly: 'week', monthly: 'month', yearly: 'year' }[this.timeframe];
    const periodNoun = { weekly: 'Last 6 weeks', monthly: 'Last 12 months', yearly: 'Last 4 years' }[this.timeframe];

    // ---- Recovery funnel (missing reports only, so every step is a share of the same group) ----
    const funnelBase = cases.length;
    const funnelSteps = [
      { name: 'Missing reported', count: funnelBase, color: '#c2410c' },
      { name: 'Sighted by the community', count: sightedCases.length, color: '#c2410c' },
      { name: 'Marked found / reunited', count: reunitedCases.length, color: '#15803d' }
    ].map((s) => ({ ...s, percent: funnelBase ? Math.round((s.count / funnelBase) * 100) : 0 }));
    let chokePoint = null;
    for (let i = 0; i < funnelSteps.length - 1; i++) {
      const drop = funnelSteps[i].percent - funnelSteps[i + 1].percent;
      if (funnelBase && drop > 0 && (!chokePoint || drop > chokePoint.drop)) {
        chokePoint = { drop, text: `${funnelSteps[i].name} → ${funnelSteps[i + 1].name}` };
      }
    }

    // ---- Needs attention (each links to where staff can act) ----
    const attention = [
      { n: overdue.length, label: 'impounded pets past their claim deadline', route: 'impoundments', tone: 'danger' },
      { n: dueSoon.length, label: 'claim deadlines within 24 hours', route: 'impoundments', tone: 'warn' },
      { n: awaitingReview.length, label: 'sighting reports waiting for review', route: 'heatmap', tone: 'info' },
      { n: staleCases.length, label: 'open missing cases with no update in 72h', route: 'heatmap', tone: 'warn' }
    ].filter((a) => a.n > 0);

    const stalls = [
      ['Shelter intake', 'Animals currently in holding', active.length ? `${active.length} ${active.length === 1 ? 'pet' : 'pets'}` : 'Clear'],
      ['Claim processing', 'Past the claim deadline', overdue.length ? `${overdue.length} overdue` : 'Clear'],
      ['Field review', 'Sighting reports not yet reviewed', awaitingReview.length ? `${awaitingReview.length} waiting` : 'Clear']
    ];

    const makeSparkline = (vals, color = '#c2410c') => {
      const sw = 84, sh = 28;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const span = max - min || 1;
      const d = vals.map((v, i) => `${i ? 'L' : 'M'} ${((i / (vals.length - 1)) * sw).toFixed(1)},${(sh - 3 - ((v - min) / span) * (sh - 6)).toFixed(1)}`).join(' ');
      return `<svg width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" /></svg>`;
    };

    const info = (key) => `<button type="button" class="dash-info" data-info="${key}" aria-label="What does this show?" title="What does this show?">i</button>`;

    const kpi = (key, label, value, delta, deltaClass, spark, color) => `
      <div class="kpi-card">
        <div class="kpi-label"><span>${label}</span>${info(key)}</div>
        <div class="kpi-body">
          <div>
            <div class="kpi-value">${value}</div>
            <div class="kpi-delta ${deltaClass}">${delta}</div>
          </div>
          <div class="kpi-spark">${makeSparkline(spark, color)}</div>
        </div>
      </div>`;

    const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    container.innerHTML = `
     <div class="dash-pro">
      <div class="view-header">
        <div class="view-header-titles">
          <div class="dash-eyebrow">Operations overview</div>
          <h1>Dashboard</h1>
          <div class="subtitle"><span>${todayLabel} · Pets, reports and shelter activity, live from the database</span></div>
        </div>
        <div class="view-header-actions">
          <button class="chip chip-subtle-terracotta" id="btn-quick-intake" title="Record a stray or lost pet that was brought to the shelter">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Log impounded pet
          </button>
          <button class="chip" id="btn-export-brief">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Download summary
          </button>
        </div>
      </div>

      <!-- Needs attention -->
      <div class="dash-attention ${attention.length ? '' : 'is-clear'}">
        ${attention.length ? `
          <div class="dash-attention-title">Needs attention</div>
          <div class="dash-attention-list">
            ${attention.map((a) => `
              <button class="dash-attention-item tone-${a.tone}" data-go="${a.route}">
                <b>${a.n}</b><span>${a.label}</span><i aria-hidden="true">→</i>
              </button>`).join('')}
          </div>
        ` : `
          <div class="dash-attention-title">All clear</div>
          <div class="dash-attention-ok">No overdue claims, unreviewed sightings or stale cases right now.</div>
        `}
      </div>

      <div class="kpi-grid" style="margin-bottom: 16px;">
        ${kpi('safe', 'Pets safe at home', totalPets ? `${protectedPct}%` : '—',
          totalPets ? `${safePets + reunitedPets} of ${totalPets} registered` : 'No pets registered yet',
          totalPets ? 'up' : 'neutral', this.dailySeries(pets.map((p) => this.toTime(p.registeredDate))), '#15803d')}
        ${kpi('recovery', 'Median recovery time', this.formatDuration(medianRecovery),
          reunitedCases.length ? `across ${reunitedCases.length} reunited ${reunitedCases.length === 1 ? 'case' : 'cases'}` : 'No reunited cases yet',
          'neutral', caseSeries, '#1c1917')}
        ${kpi('registrations', 'New registrations', `${regThisWeek} <span class="kpi-unit">this week</span>`,
          regToday ? `${regToday} today` : `${chippedPct}% of pets have a tag or chip`,
          regThisWeek ? 'up' : 'neutral', regSeries, '#c2410c')}
        ${kpi('shelters', 'Animals in shelters', `${active.length} <span class="kpi-unit">in holding</span>`,
          overdue.length ? `${overdue.length} past deadline` : (claimed.length ? `${claimed.length} claimed so far` : 'Nobody in holding'),
          overdue.length ? 'down' : 'up', intakeSeries, '#b45309')}
      </div>

      <div class="analytics-card-grid">
        <!-- Incident chart -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <div class="analytics-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color: var(--brand-terracotta);"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              <span>Incidents over time</span>
              ${info('incidents')}
            </div>
            <div class="dash-segmented" role="tablist" aria-label="Time range">
              ${['weekly', 'monthly', 'yearly'].map((tf) => `<button class="${this.timeframe === tf ? 'active' : ''} btn-timeframe" data-timeframe="${tf}" role="tab" aria-selected="${this.timeframe === tf}">${tf[0].toUpperCase() + tf.slice(1)}</button>`).join('')}
            </div>
          </div>

          <div class="analytics-kpi-row">
            <div class="analytics-kpi-block">
              <div class="analytics-kpi-main-val">${periodTotal} ${periodTotal === 1 ? 'report' : 'reports'}</div>
              <div class="analytics-kpi-sub"><span>${periodNoun} · avg ${average.toFixed(1)} per ${unit}</span></div>
            </div>
            <div class="analytics-kpi-block">
              <div class="analytics-kpi-main-val" style="color: ${diff > 0 ? '#b91c1c' : diff < 0 ? '#15803d' : 'var(--ink-primary)'};">${diff > 0 ? '▲' : diff < 0 ? '▼' : '■'} ${Math.abs(diff)}</div>
              <div class="analytics-kpi-sub"><span>${current.val} this ${unit} vs ${previous.val} last ${unit}${periodTotal ? ` · busiest: ${peak.label}` : ''}</span></div>
            </div>
          </div>

          <div class="dash-legend" aria-label="Chart legend">
            <span><i class="dot dot-missing"></i>Missing reports</span>
            <span><i class="dot dot-intake"></i>Shelter intakes</span>
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
                    ${chartData.map((item) => `
                      <div class="analytics-bar-slot ${item.active ? 'is-current' : ''}" tabindex="0" aria-label="${item.label}${item.sub ? ' ' + item.sub : ''}: ${item.missing} missing reports, ${item.intake} shelter intakes">
                        <div class="dash-tip" role="tooltip">
                          <b>${item.label}${item.sub ? ' · ' + item.sub : ''}</b>
                          <span><i class="dot dot-missing"></i>${item.missing} missing ${item.missing === 1 ? 'report' : 'reports'}</span>
                          <span><i class="dot dot-intake"></i>${item.intake} shelter ${item.intake === 1 ? 'intake' : 'intakes'}</span>
                        </div>
                        ${item.val ? `<span class="dash-bar-value">${item.val}</span>` : ''}
                        <div class="analytics-bar dash-stack" style="height: ${item.val ? Math.max((item.val / axisMax) * 100, 5) : 1.5}%;">
                          ${item.intake ? `<div class="seg seg-intake" style="flex: ${item.intake};"></div>` : ''}
                          ${item.missing ? `<div class="seg seg-missing" style="flex: ${item.missing};"></div>` : ''}
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
            ${periodTotal === 0 ? '<div class="dash-chart-empty">No reports or intakes in this range yet</div>' : ''}
          </div>

          <div class="analytics-footer-summary">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="color: #2563eb; font-weight: 600;">${awaitingReview.length} sighting ${awaitingReview.length === 1 ? 'report' : 'reports'} awaiting review</span>
              <span style="color: var(--ink-muted); font-size: 11px;">${casesThisWeek} new missing ${casesThisWeek === 1 ? 'report' : 'reports'} in the last 7 days · ${openCases.length} still open</span>
            </div>
            <div style="font-weight: 700; color: var(--ink-primary); font-family: var(--font-mono); font-size: 13px;">
              ${resolutionRate == null ? 'No cases yet' : `${resolutionRate}% resolved`}
            </div>
          </div>

          <div class="analytics-actions-row">
            <button class="btn btn-secondary btn-sm" id="btn-chart-view-registry">View on heatmap</button>
          </div>
        </div>

        <!-- Recovery funnel -->
        <div class="analytics-card funnel-card">
          <div class="analytics-card-header">
            <div class="analytics-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color: #16a34a;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span>Recovery funnel</span>
              ${info('funnel')}
            </div>
            <button class="btn btn-sm btn-secondary" id="btn-toggle-recovery-funnel" title="Switch between percentages and counts" style="padding: 2px 7px; font-size: 10px;">
              ${this.funnelMode === 'percent' ? 'Show counts' : 'Show %'}
            </button>
          </div>

          ${funnelBase === 0 ? `
            <div class="dash-empty">
              <div class="dash-empty-title">No missing reports yet</div>
              <div>When a guardian reports a pet missing, its journey to being found shows up here.</div>
            </div>
          ` : `
            <div class="funnel-list" style="margin: 8px 0;">
              ${funnelSteps.map((step, idx) => `
                <div class="funnel-step">
                  <div>
                    <div class="funnel-step-head">
                      <span style="font-weight: 650; color: var(--ink-primary);">${step.name}</span>
                      <span class="funnel-step-count">${step.count}</span>
                    </div>
                    <div class="funnel-track">
                      <div class="funnel-fill" style="width: ${Math.max((step.count / funnelBase) * 100, step.count ? 4 : 0)}%; background: ${step.color};"></div>
                    </div>
                  </div>
                  <span class="funnel-keep" style="color: ${step.color};">${this.funnelMode === 'percent' ? step.percent + '%' : step.count}</span>
                </div>`).join('')}
            </div>
            ${chokePoint ? `
              <div class="chokepoint-banner">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="flex-shrink: 0;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div style="display: flex; flex-direction: column; gap: 1px;">
                  <span style="font-weight: 750;">Biggest drop: ${chokePoint.text} (−${chokePoint.drop}%)</span>
                  <span style="font-size: 10.5px; opacity: 0.9;">${openCases.length} ${openCases.length === 1 ? 'case is' : 'cases are'} still open.</span>
                </div>
              </div>` : ''}
          `}

          <div class="analytics-footer-summary" style="margin-top: 4px;">
            <span style="color: var(--ink-secondary); font-size: 11.5px;">In holding: <b style="color: var(--ink-primary);">${active.length}</b> · Claimed: <b style="color: var(--ink-primary);">${claimed.length}</b></span>
            <span style="color: #16a34a; font-weight: 700; font-size: 11.5px;">Reunited: ${reunitedCases.length}</span>
          </div>
        </div>
      </div>

      <div class="nock-card" style="margin-top: 14px;">
        <div class="nock-card-head">
          <span class="nock-card-title">Where cases stall ${info('stalls')}</span>
          <span class="nock-card-right">Current workload</span>
        </div>
        <div class="stall-table">
          ${stalls.map((s) => `
            <div class="stall-row">
              <span class="stall-stage">${s[0]}</span>
              <span class="stall-reason">${s[1]}</span>
              <span class="stall-count ${s[2] === 'Clear' ? 'is-clear' : ''}">${s[2]}</span>
            </div>`).join('')}
        </div>
      </div>
     </div>
    `;

    this._live = { medianRecovery, reunitedCount: reunitedCases.length, unit, totalPets, protectedPct };
    const bySpecies = {};
    pets.forEach((pt) => { const k = pt.species || 'Other'; bySpecies[k] = (bySpecies[k] || 0) + 1; });
    const missingPets = countStatus('missing');
    this._report = {
      generatedAt: new Date(),
      periodNoun, unit,
      metrics: [
        ['Registered pets', totalPets],
        ['Pets safe at home', totalPets ? `${protectedPct}%` : 'n/a'],
        ['Tag / chip coverage', totalPets ? `${chippedPct}%` : 'n/a'],
        ['New registrations (7d)', regThisWeek],
        ['Open missing cases', openCases.length],
        ['Reunited cases', reunitedCases.length],
        ['Resolution rate', resolutionRate == null ? 'n/a' : `${resolutionRate}%`],
        ['Median recovery time', this.formatDuration(medianRecovery)]
      ],
      attention: attention.map((a) => `${a.n} ${a.label}`),
      chart: chartData, periodTotal, average, current, previous, diff, peak,
      funnel: funnelSteps, chokePoint, funnelBase,
      stalls,
      petStatus: [['Safe', safePets], ['Reunited', reunitedPets], ['Missing', missingPets], ['Other', Math.max(totalPets - safePets - reunitedPets - missingPets, 0)]],
      species: Object.entries(bySpecies).sort((x, y) => y[1] - x[1]),
      impounded: { active: active.length, claimed: claimed.length, overdue: overdue.length, dueSoon: dueSoon.length },
      holding: active.slice().sort((x, y) => (this.toTime(x.claimDeadline) ?? Infinity) - (this.toTime(y.claimDeadline) ?? Infinity)),
      openCases: openCases.slice().sort((x, y) => (this.toTime(x.createdAt) ?? 0) - (this.toTime(y.createdAt) ?? 0)),
      awaitingReview, now, casesThisWeek
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
    doc.text('PAWTRACK  |  OPERATIONS REPORT', M, 38);
    doc.setFontSize(24); doc.setTextColor(255);
    doc.text('Dashboard Summary', M, 68);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(214, 211, 209);
    doc.text('Pets, missing reports, sightings and shelter activity', M, 86);
    doc.setFontSize(9); doc.text(r.generatedAt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), W - M, 68, { align: 'right' });
    doc.text(r.generatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }), W - M, 82, { align: 'right' });
    y = 112;

    // ---- Executive summary ----
    const m = Object.fromEntries(r.metrics);
    const bits = [
      `The registry holds ${m['Registered pets']} pet(s), ${m['Pets safe at home']} of them safe at home.`,
      `${m['Open missing cases']} missing case(s) are open and ${m['Reunited cases']} have ended in a reunion (resolution rate ${m['Resolution rate']}).`,
      `${r.impounded.active} animal(s) are in shelter holding${r.impounded.overdue ? `, ${r.impounded.overdue} past their claim deadline` : ''}, and ${r.awaitingReview.length} sighting report(s) await review.`,
      r.attention.length ? `Priority: ${r.attention[0]}.` : 'Nothing currently needs urgent attention.'
    ];
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
    section('Key metrics', 'Overall position of the registry and missing-pet cases at the time this report was generated.');
    const cardW = (CW - 18) / 4, cardH = 56;
    r.metrics.forEach((mt, i) => {
      if (i % 4 === 0 && i > 0) y += cardH + 6;
      const x = M + (i % 4) * (cardW + 6);
      doc.setFillColor(255, 255, 255); doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.roundedRect(x, y, cardW, cardH, 4, 4, 'FD');
      doc.setFillColor(...TERRA); doc.rect(x, y + 8, 2, cardH - 16, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED);
      doc.text(cut(mt[0].toUpperCase(), cardW - 22), x + 12, y + 17);
      doc.setFontSize(18); doc.setTextColor(...INK);
      doc.text(clean(mt[1]), x + 12, y + 42);
    });
    y += cardH + 8;

    // ---- Needs attention ----
    section('Needs attention');
    if (r.attention.length) r.attention.forEach((t) => { ensure(18); doc.setFillColor(...RED); doc.circle(M + 4, y + 7, 2.5, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK); doc.text(clean(t), M + 14, y + 11); y += 17; });
    else para('All clear: no overdue claims, unreviewed sightings or stale cases right now.', GREEN);

    // ---- Incident activity ----
    section(`Incidents over time (${r.periodNoun})`, `Missing-pet reports plus shelter intakes. ${r.periodTotal} total, averaging ${r.average.toFixed(1)} per ${r.unit}. This ${r.unit}: ${r.current.val}; last ${r.unit}: ${r.previous.val} (${r.diff > 0 ? 'up ' + r.diff : r.diff < 0 ? 'down ' + Math.abs(r.diff) : 'no change'}).${r.periodTotal ? ' Busiest period: ' + r.peak.label + (r.peak.sub ? ' ' + r.peak.sub : '') + '.' : ''}`);
    const maxBar = Math.max(...r.chart.map((d) => d.val), 1);
    r.chart.forEach((d) => bar(d.label + (d.sub ? ' ' + d.sub : ''), d.val, maxBar, d.active ? TERRA : AMBER, `${d.val}  (${d.missing} missing / ${d.intake} intake)`));

    // ---- Recovery funnel ----
    section('Recovery funnel', 'How missing reports progress from being reported to being found. Each step is a share of all missing reports.');
    if (!r.funnelBase) para('No missing reports yet.', MUTED);
    else {
      r.funnel.forEach((st) => bar(st.name, st.count, r.funnelBase, st.color === '#15803d' ? GREEN : TERRA, `${st.count}  (${st.percent}%)`));
      if (r.chokePoint) para(`Biggest drop: ${r.chokePoint.text} (-${r.chokePoint.drop}%). ${r.metrics[4][1]} case(s) are still open.`, AMBER);
    }

    // ---- Workload ----
    section('Where cases stall', 'Current workload by stage.');
    table([{ label: 'Stage', w: 0.28 }, { label: 'What it measures', w: 0.47 }, { label: 'Status', w: 0.25, align: 'right' }],
      r.stalls.map((s) => [{ t: s[0], bold: true }, s[1], { t: s[2], bold: true, color: s[2] === 'Clear' ? GREEN : AMBER }]));

    // ---- Registry ----
    section('Registry breakdown', 'Registered pets by current status, then by species.');
    const petMax = Math.max(...r.petStatus.map((x) => x[1]), 1);
    r.petStatus.forEach(([l, n]) => bar(`${l} pets`, n, petMax, l === 'Missing' ? RED : l === 'Other' ? AMBER : GREEN));
    if (r.species.length) { y += 4; const spMax = Math.max(...r.species.map((x) => x[1]), 1); r.species.forEach(([l, n]) => bar(l, n, spMax, TERRA)); }

    // ---- Shelter detail ----
    section('Shelter holding', `${r.impounded.active} in holding, ${r.impounded.overdue} past their claim deadline, ${r.impounded.dueSoon} due within 24 hours, ${r.impounded.claimed} claimed so far. Sorted by nearest deadline.`);
    table([{ label: 'Pet', w: 0.2 }, { label: 'Species', w: 0.1 }, { label: 'Shelter', w: 0.24 }, { label: 'Intake', w: 0.2 }, { label: 'Claim deadline', w: 0.26 }],
      r.holding.map((i) => { const d = this.toTime(i.claimDeadline); const late = d != null && d < r.now; return [{ t: i.petName || 'Unknown', bold: true }, i.species, i.shelterName, fmtDate(i.intakeDate), { t: fmtDateTime(i.claimDeadline) + (late ? ' (overdue)' : ''), color: late ? RED : INK, bold: late }]; }),
      'No animals are currently in holding.');

    // ---- Open cases ----
    section('Open missing cases', `${r.openCases.length} open, ${r.casesThisWeek} new in the last 7 days. Oldest first.`);
    table([{ label: 'Pet', w: 0.18 }, { label: 'Species', w: 0.1 }, { label: 'Status', w: 0.12 }, { label: 'Last seen at', w: 0.3 }, { label: 'Reported', w: 0.15 }, { label: 'Updated', w: 0.15 }],
      r.openCases.map((c) => [{ t: c.petName || 'Unknown', bold: true }, c.species, c.status, c.location || '-', fmtDate(c.createdAt), fmtDate(c.lastUpdated)]),
      'No open missing cases.');

    // ---- Sightings ----
    section('Sightings awaiting review', `${r.awaitingReview.length} community sighting report(s) not yet reviewed.`);
    table([{ label: 'Species', w: 0.12 }, { label: 'Location', w: 0.38 }, { label: 'Seen', w: 0.22 }, { label: 'Confidence', w: 0.13, align: 'right' }, { label: 'Reporter', w: 0.15 }],
      r.awaitingReview.map((s) => [s.species, s.location || '-', fmtDateTime(s.dateTimeSeen || s.createdAt), s.confidenceScore != null ? `${Math.round(s.confidenceScore * (s.confidenceScore <= 1 ? 100 : 1))}%` : '-', s.reporterName || 'Anonymous']),
      'No sightings are waiting for review.');

    // ---- Footer on every page ----
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(M, H - 34, W - M, H - 34);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text('PawTrack  |  Dashboard Summary  |  Confidential - for authorised staff only', M, H - 22);
      doc.text(`Page ${i} of ${pages}`, W - M, H - 22, { align: 'right' });
    }

    doc.setProperties({ title: 'PawTrack Dashboard Summary', subject: 'Operations report', author: 'PawTrack Admin', creator: 'PawTrack' });
    doc.save(`pawtrack-summary-${r.generatedAt.toISOString().slice(0, 10)}.pdf`);
    window.adminApp?.showToast('Dashboard summary downloaded.', 'success');
  },

  // Each entry: icon, what (one-line summary), how (steps), example, live (optional "right now" line), tip
  INFO: {
    safe: {
      icon: 'shield', title: 'Pets safe at home',
      what: 'The share of registered pets that are not currently missing or in a shelter.',
      how: ['Counts pets whose status is <b>Safe</b> or <b>Reunited</b>.', 'Divides that by all registered pets.'],
      tip: 'Pets marked Missing or Impounded are the ones left out of the percentage.',
      live: () => { const l = window.ActivationView._live || {}; return l.totalPets ? `<b>${l.protectedPct}%</b> of ${l.totalPets} registered pets` : 'No pets registered yet'; }
    },
    recovery: {
      icon: 'clock', title: 'Median recovery time',
      what: 'How long a typical missing pet takes to be found.',
      how: ['Takes every reunited case and measures the time from when the missing report was <b>filed</b> to when it was <b>marked found</b>.', 'Sorts those times and picks the <b>middle</b> one.'],
      example: 'Recovery times of 2h, 5h and 90h give a median of <b>5h</b>, while the average would be about 32h. The median ignores a few unusually long cases, so it shows what a normal case looks like.',
      tip: 'Lower is better. The end time is the report’s last update, because a separate “found at” time is not stored.',
      live: () => { const l = window.ActivationView._live || {}; return l.reunitedCount ? `<b>${window.ActivationView.formatDuration(l.medianRecovery)}</b> across ${l.reunitedCount} reunited ${l.reunitedCount === 1 ? 'case' : 'cases'}` : 'No reunited cases yet, so nothing to measure'; }
    },
    registrations: {
      icon: 'plus', title: 'New registrations',
      what: 'How many pets were registered in the last 7 days.',
      how: ['The big number is the 7-day total.', 'The line beside it shows the count for each of those days.'],
      tip: 'If nothing was registered today, the card shows the share of pets that have an NFC tag or microchip instead.'
    },
    shelters: {
      icon: 'home', title: 'Animals in shelters',
      what: 'Animals currently held in a shelter and not yet claimed.',
      how: ['Counts impounds that are still in holding.', 'The line shows shelter intakes over the last 7 days.'],
      tip: '“Past deadline” means the claim deadline has passed and the animal is still in holding. Those also appear under Needs attention.'
    },
    incidents: {
      icon: 'chart', title: 'Incidents over time',
      what: 'How many incidents were logged in each period.',
      how: ['Each bar adds <b>missing reports</b> filed by guardians and <b>shelter intakes</b>, shown in two colors.', 'Weekly, Monthly and Yearly change the length of each bar.', 'The dashed blue line is the average per period.', 'The ▲ / ▼ figure compares the current period with the previous one. Up (red) means more incidents.'],
      tip: 'The current period is still in progress, so it is usually lower than a finished one. Hover or focus a bar for exact counts.'
    },
    funnel: {
      icon: 'funnel', title: 'Recovery funnel',
      what: 'Follows every missing report through to being found.',
      how: ['Three steps: <b>reported</b>, <b>sighted by the community</b>, <b>marked found</b>.', 'Each bar is a share of all missing reports.', '“Did not reach this step” shows how many cases dropped off, and the orange banner points to the biggest drop.'],
      tip: 'Use “Show counts” to switch between percentages and whole numbers.'
    },
    stalls: {
      icon: 'alert', title: 'Where cases stall',
      what: 'A snapshot of work waiting on staff.',
      how: ['Animals in holding.', 'Claims past their deadline.', 'Sighting reports not yet reviewed.'],
      tip: '“Clear” means nothing is waiting in that area.'
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
        if (tf) { this.timeframe = tf; this.render(container); }
      });
    });

    container.querySelector('#btn-toggle-recovery-funnel')?.addEventListener('click', () => {
      this.funnelMode = this.funnelMode === 'percent' ? 'number' : 'percent';
      this.render(container);
    });

    container.querySelectorAll('[data-go]').forEach((el) => {
      el.addEventListener('click', () => { window.location.hash = '#' + el.getAttribute('data-go'); });
    });

    container.querySelector('#btn-chart-view-registry')?.addEventListener('click', () => {
      window.location.hash = '#heatmap';
    });

    container.querySelector('#btn-quick-intake')?.addEventListener('click', () => {
      window.location.hash = '#impoundments';
      if (window.ImpoundmentsView && typeof window.ImpoundmentsView.openIntakeModal === 'function') {
        setTimeout(() => window.ImpoundmentsView.openIntakeModal(), 100);
      }
    });

    container.querySelector('#btn-export-brief')?.addEventListener('click', () => this.downloadSummaryPdf());
  }
};
