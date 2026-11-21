/**
 * PawTrack Admin: Violations
 * The provisions a person can be directed to the City Veterinary Department for, with the fine for each.
 * Source: the notice of violation (Ordinance SP-2505, S-2016, the Quezon City Veterinary Code, and SP-2990, S-2020).
 * A reference list: nothing here is stored or issued from this page.
 */
window.ViolationsView = {
  query: '',
  filter: 'all', // 'all' | 'ladder' | 'flat' | 'none'

  // Each provision: what it covers, the specific violations under it, and its penalty.
  //   ladder  fine rises with each offense (amounts for the 1st, 2nd and 3rd offense)
  //   flat    one fine for every offense, with extras such as confiscation
  //   none    the notice states no fine for it
  provisions: [
    {
      id: 's35', ref: 'Section 35', ordinance: 'SP-2505, S-2016',
      title: 'Registration of companion dogs & cats',
      violations: ['Unregistered / no microchips'],
      penalty: { kind: 'ladder', steps: [1000, 1500, 2000] }
    },
    {
      id: 's37', ref: 'Section 37', ordinance: 'SP-2505, S-2016',
      title: 'Regulation of pet animals',
      violations: ['Keeping of animals according to space requirement'],
      penalty: { kind: 'flat', amount: 2000, extras: ['Confiscation of excess animals with no sufficient space requirement'] }
    },
    {
      id: 's38', ref: 'Section 38', ordinance: 'SP-2505, S-2016',
      title: 'Special permit for the keeping of animals',
      violations: ['No special permit'],
      penalty: { kind: 'flat', amount: 2000, extras: ['Confiscation of animals'] }
    },
    {
      id: 's40', ref: 'Section 40', ordinance: 'SP-2505, S-2016',
      title: 'Prohibited acts',
      violations: [
        'Harboring dogs with symptoms of rabies',
        'Allowing a dog to assault or attack any person',
        'Removal of dog tag / microchip',
        'Transfer of dog tag / microchip to another animal'
      ],
      penalty: { kind: 'flat', amount: 2000, extras: ['Confiscation of animals'] }
    },
    {
      id: 's53', ref: 'Section 53', ordinance: 'SP-2505, S-2016',
      title: 'Responsibilities of animal owners, possessors and keepers',
      violations: [
        'Unleashed',
        'Refuse to shoulder animal bite victims',
        'Defecation on public and private property',
        'Unvaccinated'
      ],
      penalty: { kind: 'ladder', steps: [1000, 1500, 2000] }
    },
    {
      id: 's65', ref: 'Section 65', ordinance: 'SP-2505, S-2016',
      title: 'Animal show, exhibition in circus',
      violations: ['No permit'],
      penalty: { kind: 'none' }
    },
    {
      id: 'sp2990', ref: 'SP-2990, S-2020', ordinance: 'SP-2990, S-2020',
      title: 'Violation of Ordinance SP-2990, S-2020',
      violations: ['Prohibiting backyard piggeries and poultry farms'],
      penalty: { kind: 'ladder', steps: [2000, 3000, 5000] }
    },
    {
      id: 's69', ref: 'Section 69', ordinance: 'SP-2505, S-2016',
      title: 'Opposing, resisting, and intervening with authorities',
      violations: [],
      penalty: { kind: 'none' },
      note: 'Written in by hand on the notice, with no specific violations or fine listed.'
    }
  ],

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  peso(n) { return '₱' + Number(n).toLocaleString('en-PH'); },

  // Words a person might search for in a provision, beyond its visible text
  haystack(p) {
    const pen = p.penalty;
    const words = [p.ref, p.ordinance, p.title, ...p.violations, p.note || ''];
    if (pen.kind === 'ladder') words.push('fine offense', ...pen.steps.map(String));
    if (pen.kind === 'flat') words.push('fine', String(pen.amount), ...(pen.extras || []));
    if (pen.kind === 'none') words.push('no fine stated');
    return words.join(' ').toLowerCase();
  },

  visible() {
    const q = this.query.trim().toLowerCase();
    return this.provisions.filter(p =>
      (this.filter === 'all' || p.penalty.kind === this.filter) &&
      (!q || q.split(/\s+/).every(w => this.haystack(p).includes(w))));
  },

  renderPenalty(p) {
    const pen = p.penalty;
    if (pen.kind === 'ladder') {
      const names = ['1st offense', '2nd offense', '3rd offense'];
      return `
        <div class="vio-penalty">
          <div class="vio-penalty-label">Fine per offense</div>
          <div class="vio-ladder">
            ${pen.steps.map((amt, i) => `
              <div class="vio-step">
                <span class="vio-step-name">${names[i]}</span>
                <b class="vio-step-amt">${this.peso(amt)}</b>
              </div>`).join('')}
          </div>
        </div>`;
    }
    if (pen.kind === 'flat') {
      return `
        <div class="vio-penalty">
          <div class="vio-penalty-label">Fine</div>
          <div class="vio-flat">
            <b class="vio-step-amt">${this.peso(pen.amount)}</b>
            ${(pen.extras || []).map(x => `<span class="vio-tag">${this.esc(x)}</span>`).join('')}
          </div>
        </div>`;
    }
    return `
      <div class="vio-penalty vio-penalty-none">
        <div class="vio-penalty-label">Fine</div>
        <div class="vio-none">Not stated on the notice</div>
      </div>`;
  },

  renderCard(p) {
    return `
      <article class="vio-card" id="vio-${this.esc(p.id)}">
        <header class="vio-card-head">
          <span class="vio-ref">${this.esc(p.ref)}</span>
          <h2 class="vio-title">${this.esc(p.title)}</h2>
        </header>
        ${p.violations.length ? `<ul class="vio-list">${p.violations.map(v => `<li>${this.esc(v)}</li>`).join('')}</ul>` : ''}
        ${p.note ? `<p class="vio-note">${this.esc(p.note)}</p>` : ''}
        ${this.renderPenalty(p)}
      </article>`;
  },

  renderList() {
    const list = this.visible();
    const total = this.provisions.length;
    const status = list.length === total ? `${total} provisions` : `${list.length} of ${total} provisions`;
    return `
      <div class="vio-count" id="vio-count" aria-live="polite">${status}</div>
      ${list.length
        ? `<div class="vio-grid">${list.map(p => this.renderCard(p)).join('')}</div>`
        : `<div class="vio-empty">No provision matches &ldquo;${this.esc(this.query)}&rdquo;. Try a section number, a fine or a word like &ldquo;leash&rdquo;.</div>`}`;
  },

  render(container) {
    const filters = [['all', 'All'], ['ladder', 'Fine rises per offense'], ['flat', 'One fine'], ['none', 'No fine stated']];
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Violations</h1>
          <div class="subtitle">
            <span>Provisions of the Quezon City Veterinary Code (SP-2505, S-2016) and SP-2990, S-2020, with the fine for each</span>
          </div>
        </div>
      </div>

      <div class="vio-notice" role="note">
        <b>Notice of violation</b>
        <span>The person is directed to report to the City Veterinary Department for appropriate action for violating the provisions below.</span>
      </div>

      <div class="vio-toolbar">
        <div class="vio-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="vio-search" placeholder="Search a section, violation or fine" value="${this.esc(this.query)}" autocomplete="off" aria-label="Search violations" />
        </div>
        <div class="vio-chips" role="group" aria-label="Filter by penalty">
          ${filters.map(([k, label]) => `<button type="button" class="vio-chip${this.filter === k ? ' is-active' : ''}" data-filter="${k}" aria-pressed="${this.filter === k}">${label}</button>`).join('')}
        </div>
      </div>

      <div id="vio-results">${this.renderList()}</div>
    `;

    const results = container.querySelector('#vio-results');
    const refresh = () => { if (results) results.innerHTML = this.renderList(); };
    const input = container.querySelector('#vio-search');
    if (input) input.addEventListener('input', () => { this.query = input.value; refresh(); });
    container.querySelectorAll('.vio-chip').forEach(btn => btn.addEventListener('click', () => {
      this.filter = btn.dataset.filter;
      container.querySelectorAll('.vio-chip').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      refresh();
    }));
  }
};
