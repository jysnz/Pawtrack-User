/**
 * PawTrack Community Pet Sightings Board
 * Dedicated view for browsing, filtering, archiving, retrieving, and deleting
 * community-reported pet sightings. Integrates with the store, notification system,
 * incident map, and owner verification modal.
 */

class SightingsView {
  constructor() {
    this.currentFilter = 'all';      // 'all' | 'possible' | 'confirmed' | 'archived' | 'reunited'
    this.currentSort   = 'newest';   // 'newest' | 'oldest' | 'confirmed_first'
    this.searchQuery   = '';
    this.selectedCommunity = 'all';

    if (typeof window !== 'undefined' && window.pawStore) {
      window.pawStore.subscribe((event) => {
        if (window.location.hash === '#sightings') {
          this.refresh();
        }
      });
    }
  }

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────
  render(container) {
    this.container = container || document.getElementById('app-viewport');
    if (!this.container) return;

    const t = (k, d) => (window.pawI18n ? window.pawI18n.t(k, d) : d);
    const sightings = window.pawStore ? (window.pawStore.getSightings() || []) : [];
    const stats = this._buildStats(sightings);

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Community Sighting Reports</h1>
          <div class="view-subtitle">
            All community-reported pet sightings. Owners can verify matches, archive old reports, or retrieve and delete archived sightings.
          </div>
        </div>
        <div style="display:flex; gap:0.65rem; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-primary btn-sm" onclick="window.location.hash = '#found'">
            <i data-lucide="eye"></i> Report Pet Sighting
          </button>
          <button class="btn ${this.currentFilter === 'archived' ? 'btn-primary' : 'btn-outline'} btn-sm" id="sightings-header-archived-btn" onclick="window.sightingsView.setFilter('${this.currentFilter === 'archived' ? 'all' : 'archived'}')" title="${this.currentFilter === 'archived' ? 'Active Sightings' : 'Archived Sightings'} (${stats.archived})" aria-label="${this.currentFilter === 'archived' ? 'Active Sightings' : 'Archived Sightings'}">
            <i data-lucide="archive"></i>
          </button>
          <button class="btn btn-outline btn-sm" onclick="window.location.hash='#owner'; setTimeout(() => document.getElementById('incident-map-section')?.scrollIntoView({behavior:'smooth'}), 150);" title="View on Map" aria-label="View on Map">
            <i data-lucide="map"></i>
          </button>
        </div>
      </div>

      <!-- Search and sort on top, status filters below (pill counts double as the status summary) -->
      <div class="glass-card sightings-filter-bar">
        <div class="sightings-filter-top">
          <div class="sightings-search">
            <input
              type="text"
              id="sightings-search-input"
              placeholder="Search by location, breed, reporter name…"
              value="${this._esc(this.searchQuery)}"
              oninput="window.sightingsView.handleSearch(this.value)"
              style="width:100%;"
            />
          </div>

          <div class="sightings-sort">
            <label for="sightings-sort-select" style="font-size:0.76rem; color:var(--text-muted); white-space:nowrap; flex-shrink:0;">Sort</label>
            <select id="sightings-sort-select" class="form-control" style="padding:7px 10px; font-size:0.8rem;" onchange="window.sightingsView.setSort(this.value)">
              <option value="newest"          ${this.currentSort === 'newest'          ? 'selected' : ''}>Newest First</option>
              <option value="oldest"          ${this.currentSort === 'oldest'          ? 'selected' : ''}>Oldest First</option>
              <option value="confirmed_first" ${this.currentSort === 'confirmed_first' ? 'selected' : ''}>Confirmed First</option>
            </select>
          </div>
        </div>

        <div id="sightings-filter-pills" class="sightings-filter-pills">
          ${this._filterPill('all',       'All Active', stats.active,    this.currentFilter === 'all')}
          ${this._filterPill('mine',      'Your pets',  stats.mine,      this.currentFilter === 'mine')}
          ${this._filterPill('missing',   'Missing',    stats.missing,   this.currentFilter === 'missing')}
          ${this._filterPill('possible',  'Possible',   stats.possible,  this.currentFilter === 'possible')}
          ${this._filterPill('confirmed', 'Confirmed',  stats.confirmed, this.currentFilter === 'confirmed')}
          ${this._filterPill('archived',  'Archived',   stats.archived,  this.currentFilter === 'archived')}
          ${this._filterPill('reunited',  'Reunited',   stats.reunited,  this.currentFilter === 'reunited')}
        </div>
      </div>

      <!-- Sighting Cards Grid -->
      <div id="sightings-grid" style="margin-bottom: 2.5rem;">
        ${this._renderGrid(sightings)}
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: this.container });

    this._loadMyClaims();
    this._afterGrid();
    this._bindFeed();

    // Tapping a report (not one of its buttons or the photo) opens the claim dialog
    if (!this.container.__claimBound) {
      this.container.__claimBound = true;
      const open = (e) => {
        const card = e.target.closest && e.target.closest('.sighting-card[data-claim]');
        if (!card || e.target.closest('button, a, .sighting-card-photo-wrap, .sighting-card-actions')) return;
        this.openClaim(card.dataset.claim);
      };
      this.container.addEventListener('click', open);
      this.container.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches && e.target.matches('.sighting-card[data-claim]')) open(e); });
    }
  }

  refresh() {
    const container = this.container || document.getElementById('app-viewport');
    if (container && window.location.hash === '#sightings') {
      this.render(container);
    }
  }

  // ─────────────────────────────────────────────────
  // FILTER / SEARCH / SORT HANDLERS
  // ─────────────────────────────────────────────────
  setFilter(f) {
    this.currentFilter = f;
    this.feedLimit = 5;
    this.refresh();
  }

  handleSearch(val) {
    this.searchQuery = val;
    this._refreshGrid();
  }

  setCommunity(val) {
    this.selectedCommunity = val;
    this._refreshGrid();
  }

  setSort(val) {
    this.currentSort = val;
    this._refreshGrid();
  }

  _refreshGrid() {
    const grid = document.getElementById('sightings-grid');
    if (!grid) return;
    const sightings = window.pawStore.getSightings();
    grid.innerHTML = this._renderGrid(sightings);
    if (window.lucide) window.lucide.createIcons({ root: grid });
    this._afterGrid();
  }

  // ─────────────────────────────────────────────────
  // ARCHIVE, RETRIEVE & DELETE ACTIONS
  // ─────────────────────────────────────────────────
  // Asks first; the archive itself runs from the modal's confirm button
  archiveSighting(sightingId) {
    if (!sightingId || !window.pawStore) return;
    const modal = document.getElementById('archive-sighting-modal');
    if (!modal) return this.performArchive(sightingId);
    this.pendingArchiveId = sightingId;
    const s = window.pawStore.getSightings().find((x) => x.id === sightingId);
    const what = document.getElementById('archive-sighting-what');
    if (what) {
      const label = s ? [s.breed, s.location].filter(Boolean).join(' · ') : '';
      what.textContent = label;
      what.hidden = !label;
    }
    if (!this._archiveWired) {
      this._archiveWired = true;
      const close = () => window.notifManager.closeModal('archive-sighting-modal');
      document.getElementById('archive-sighting-cancel-btn')?.addEventListener('click', close);
      document.getElementById('archive-sighting-yes-btn')?.addEventListener('click', () => {
        const id = this.pendingArchiveId;
        this.pendingArchiveId = null;
        close();
        if (id) this.performArchive(id);
      });
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('active')) close(); });
    }
    window.notifManager.openModal('archive-sighting-modal');
    setTimeout(() => document.getElementById('archive-sighting-cancel-btn')?.focus(), 150);
  }

  // ─────────────────────────────────────────────────
  // CLAIM A REPORTED PET
  // ─────────────────────────────────────────────────
  // ─────────────────────────────────────────────────
  // FEED (the Possible tab): scroll, like and comment
  // ─────────────────────────────────────────────────
  // Every list except Archived (which has Retrieve and Delete) and Reunited is shown as the feed
  _isFeed() {
    return ['all', 'possible', 'mine', 'confirmed', 'missing'].includes(this.currentFilter);
  }

  // A colour per person, so avatars are not all the same
  _hue(name) {
    let h = 0;
    for (const ch of String(name || '?')) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  // The account's profile picture when there is one; the coloured initial shows behind it and stays if the picture fails
  _avatar(name, cls = '', src = '') {
    const n = String(name || '?').trim();
    const pic = /^(https:|data:image\/)/.test(String(src || '')) ? `<img src="${this._esc(src)}" alt="" loading="lazy" onerror="this.remove()" />` : '';
    return `<span class="spost-avatar ${cls}" style="background:hsl(${this._hue(n)} 55% 42%); color:#fff;">${this._esc(n.charAt(0).toUpperCase())}${pic}</span>`;
  }

  // "What's on your mind?" box at the top of the feed
  _feedComposerHtml() {
    const user = window.pawStore.getGoogleUser() || {};
    const first = String(user.name || '').split(/[ ,]+/).filter(Boolean).slice(-1)[0] || '';
    return `
      <div class="sfeed-composer">
        <div class="sfeed-composer-row">
          ${this._avatar(user.name || 'You', '', user.picture)}
          <button type="button" class="sfeed-composer-input" onclick="window.location.hash='#found'">Seen or found a pet${first ? `, ${this._esc(first)}` : ''}? Tell the community...</button>
        </div>
      </div>`;
  }

  // Side panel (wide screens): a summary and shortcuts, sticky while the feed scrolls
  _feedSideHtml(sightings) {
    const st = this._buildStats(sightings);
    const stat = (n, label, filter) => `<button type="button" class="sfeed-stat" onclick="window.sightingsView.setFilter('${filter}')"><b>${n}</b><span>${label}</span></button>`;
    return `
      <aside class="sfeed-side" aria-label="Sightings summary">
        <section class="sfeed-card">
          <h3>Community sightings</h3>
          <div class="sfeed-stats">
            ${stat(st.possible, 'Possible', 'possible')}
            ${stat(st.confirmed, 'Confirmed', 'confirmed')}
            ${stat(st.missing, 'Missing', 'missing')}
            ${stat(st.mine, 'Your pets', 'mine')}
            ${stat(st.reunited, 'Reunited', 'reunited')}
          </div>
        </section>
        <section class="sfeed-card">
          <h3>Seen a pet?</h3>
          <p>Add a clear photo and where you saw it. Owners nearby are alerted right away.</p>
          <button type="button" class="btn btn-primary btn-sm sfeed-side-btn" onclick="window.location.hash='#found'"><i data-lucide="eye"></i> Report a sighting</button>
        </section>
        <section class="sfeed-card">
          <h3>Is one of these yours?</h3>
          <p>Open <b>Details</b> on a post to claim your pet. The finder is alerted with your photo and number.</p>
        </section>
      </aside>`;
  }

  // Reports of missing pets are posts in the feed too
  _missingPosts() {
    const q = this.searchQuery.trim().toLowerCase();
    return window.pawStore.getMissingReports()
      .filter((r) => !q || [r.petName, r.breed, r.color, r.lastSeenLocation, r.caption].filter(Boolean).join(' ').toLowerCase().includes(q))
      .map((r) => ({ ...r, __kind: 'missing' }));
  }

  _feedPosts(list) {
    const withMissing = this.currentFilter === 'all' || this.currentFilter === 'missing';
    const posts = withMissing ? [...list, ...this._missingPosts()] : [...list];
    const time = (x) => new Date(x.createdAt || x.dateTimeSeen || 0).getTime() || 0;
    if (this.currentSort === 'oldest') posts.sort((a, b) => time(a) - time(b));
    else if (this.currentSort === 'confirmed_first') posts.sort((a, b) => (b.status === 'confirmed_sighting') - (a.status === 'confirmed_sighting') || time(b) - time(a));
    else posts.sort((a, b) => time(b) - time(a));
    return posts;
  }

  _feedHasMore() {
    return (this._feedItems || []).length > (this.feedLimit || 5);
  }

  _feedEndText() {
    return this._feedHasMore() ? 'Loading more sightings...' : `You are all caught up (${(this._feedItems || []).length} ${(this._feedItems || []).length === 1 ? 'sighting' : 'sightings'})`;
  }

  _feedPostsHtml() {
    return (this._feedItems || []).slice(0, this.feedLimit || 5).map((s) => this._postHtml(s)).join('');
  }

  _postHtml(s) {
    const store = window.pawStore;
    const me = store.getGoogleUser() || {};
    const missing = s.__kind === 'missing';
    const likes = store.getLikes(s.id);
    const comments = store.getComments(s.id);
    const open = this.openComments && this.openComments.has(s.id);
    const social = store.isDbId(s.id);
    const owner = !missing && this._isOwnerOfSightedPet(s);

    // A post about one of your pets: your own missing report, or a sighting of a pet you reported missing
    let yourPet = null;
    if (missing) {
      if (me.id && s.reporterId === me.id) yourPet = { name: s.petName || 'Your pet', photo: s.photoUrl || s.photo || '', line: 'You reported this pet missing' };
    } else if (owner) {
      const rep = store.getMissingReportById(s.missing_report_id);
      const pet = rep && rep.petId ? store.getPetById(rep.petId) : null;
      yourPet = {
        name: (pet && pet.name) || (rep && rep.petName) || 'Your pet',
        photo: (pet && (pet.photoUrl || pet.photo)) || (rep && (rep.photoUrl || rep.photo)) || '',
        line: 'Someone may have seen your pet'
      };
    }
    // On your own missing report the title already says whose pet it is, so the card is only for sightings
    const yourPetHtml = yourPet && !missing ? `
        <div class="spost-yourpet">
          ${yourPet.photo ? `<img src="${this._esc(yourPet.photo)}" alt="" onerror="this.remove()" />` : '<span class="spost-yourpet-noimg"><i data-lucide="paw-print"></i></span>'}
          <div><small>Your pet</small><strong>${this._esc(yourPet.name)}</strong><span>${this._esc(yourPet.line)}</span></div>
        </div>` : '';
    // Who posted, what it says, and the photo: different for a missing pet and a sighting
    let name, title, sub, photo, caption, detail, badge, badgeCls, place, when;
    let authorPic = '';
    let isMineMissing = false;
    let detailIsHtml = false;
    if (missing) {
      const mine = me.id && s.reporterId === me.id;
      isMineMissing = !!mine;
      name = mine ? (me.name || 'You') : 'PawTrack guardian';
      authorPic = mine ? me.picture : ''; // other guardians' pictures are not shown on their missing reports
      title = `${s.petName || 'A pet'} is missing`;
      sub = [s.species, s.breed, s.color].filter(Boolean).join(' · ');
      photo = s.photoUrl || s.photo || '';
      caption = s.caption || '';
      // Condition and notes are saved together as "Condition: ... | notes": show each on its own line
      const nm = String(s.notes || '').match(/^condition:\s*([^|]*?)\s*(?:\|\s*([\s\S]*))?$/i);
      detail = [
        s.description ? ['Description', s.description] : null,
        nm ? ['Before it went missing', nm[1]] : (s.notes ? ['Notes', s.notes] : null),
        nm && nm[2] ? ['Notes', nm[2]] : null
      ].filter((f) => f && String(f[1]).trim());
      detailIsHtml = true;
      badge = 'Missing'; badgeCls = ' is-missing';
      place = s.lastSeenLocation; when = s.createdAt || s.lastSeenDate;
    } else {
      const raw = String(s.comments || s.notes || '').trim();
      const cond = raw.match(/^pet condition:\s*([\s\S]*)$/i);
      const breed = store.sightingBreed(s);
      const linked = s.petId || s.missing_report_id || s.matchedPetId;
      name = s.reporterName || 'Community Good Samaritan';
      const anonymous = name === 'Community Good Samaritan' || name === 'Anonymous';
      authorPic = s.reporterAvatar || (!anonymous && me.id && s.reporterId === me.id ? me.picture : '');
      title = breed;
      sub = s.species || 'Animal';
      photo = s.photoUrl || s.photo || '';
      caption = s.caption || '';
      detail = (cond ? cond[1] : raw) ? [[cond ? 'Pet condition' : 'Notes', cond ? cond[1] : raw]] : [];
      detailIsHtml = true;
      badge = s.status === 'confirmed_sighting' ? 'Confirmed sighting' : 'Possible sighting';
      badgeCls = s.status === 'confirmed_sighting' ? ' is-confirmed' : '';
      place = s.location; when = s.dateTimeSeen || s.createdAt;
      s.__assumed = !(linked || breed === 'Breed not specified');
    }

    const commentsHtml = open ? `
      <div class="spost-comments">
        ${comments.map((c) => `
          <div class="spost-comment">
            ${this._avatar(c.author_name, 'sm', c.author_avatar || (me.id && c.user_id === me.id ? me.picture : ''))}
            <div class="spost-bubble">
              <strong>${this._esc(c.author_name || 'A PawTrack guardian')}</strong>
              <p>${this._esc(c.body)}</p>
              <small>${this._esc(this._timeAgo(c.created_at))}${me.id && c.user_id === me.id ? ` · <button type="button" class="spost-link" data-feed="delcomment" data-cid="${this._esc(c.id)}">Delete</button>` : ''}</small>
            </div>
          </div>`).join('') || '<p class="spost-nocomments">No comments yet. Be the first to comment.</p>'}
        ${me.id && social ? `<form class="spost-compose" data-sid="${this._esc(s.id)}" data-kind="${missing ? 'missing' : 'sighting'}">
            ${this._avatar(me.name || 'You', 'sm', me.picture)}
            <input type="text" maxlength="500" placeholder="Write a comment..." aria-label="Write a comment" autocomplete="off" />
            <button type="submit" class="btn btn-primary btn-sm" aria-label="Send comment"><i data-lucide="send"></i></button>
          </form>` : `<p class="spost-nocomments">${me.id ? 'Comments open once this report is saved online.' : 'Log in to comment.'}</p>`}
      </div>` : '';

    const secondary = missing
      ? (isMineMissing
        ? '<button type="button" data-feed="mine"><i data-lucide="check-circle-2"></i> Mark as found</button>'
        : '<button type="button" data-feed="seen"><i data-lucide="eye"></i> I saw this pet</button>')
      : `${owner && s.status === 'possible_sighting' ? '<button type="button" data-feed="verify"><i data-lucide="shield-check"></i> Verify</button>' : ''}
         ${owner && s.status === 'confirmed_sighting' ? '<button type="button" data-feed="case"><i data-lucide="route"></i> Next steps</button>' : ''}
         ${owner && s.movedOn ? '<button type="button" data-feed="found"><i data-lucide="party-popper"></i> My pet was found</button>' : ''}
         <button type="button" data-feed="details"><i data-lucide="heart-handshake"></i> Details</button>
         ${owner ? '<button type="button" data-feed="archive"><i data-lucide="archive"></i> Archive</button>' : ''}`;

    return `
      <article class="spost${s.movedOn ? ' is-moved' : ''}${missing ? ' is-missing' : ''}${yourPet ? ' is-yours' : ''}" data-post="${this._esc(s.id)}" data-kind="${missing ? 'missing' : 'sighting'}">
        <header class="spost-head">
          ${this._avatar(name, '', authorPic)}
          <div class="spost-who">
            <strong>${this._esc(name)}</strong>
            <small>${this._esc(this._timeAgo(when))} &middot; <i data-lucide="map-pin"></i> ${this._esc(String(place || 'Location not specified').replace(/\s*\([^()]*\)\s*$/, ''))}</small>
          </div>
          <div class="spost-more">
            <button type="button" class="spost-more-toggle" data-feed="more" aria-label="More actions" aria-haspopup="true" aria-expanded="false"><i data-lucide="more-vertical"></i></button>
            <div class="spost-menu">${secondary}</div>
          </div>
          ${s.movedOn ? '<span class="spost-moved">Pet moved on</span>' : ''}
          <span class="spost-badge${badgeCls}">${badge}</span>
        </header>
        ${yourPetHtml}
        <div class="spost-text">
          <div class="spost-title">${this._esc(title)}${s.__assumed ? ' <em class="sighting-card-assumed">Assumed breed</em>' : ''}</div>
          ${sub ? `<p class="spost-meta"><i data-lucide="paw-print"></i>${String(sub).split(' · ').filter(Boolean).map((t) => `<span>${this._esc(t)}</span>`).join('')}</p>` : ''}
          ${caption ? `<p class="spost-caption">${this._esc(caption)}</p>` : ''}
          ${(() => {
            if (!detail || !detail.length) return '';
            const facts = `<dl class="spost-facts">${detail.map(([k, v]) => `<div><dt>${this._esc(k)}</dt><dd>${this._esc(v)}</dd></div>`).join('')}</dl>`;
            // A missing report keeps its extra facts folded away; a sighting's condition is the point of the post
            return missing ? `<details class="spost-fold"><summary>Pet details</summary>${facts}</details>` : facts;
          })()}
        </div>
        ${photo ? `<img class="spost-photo" src="${this._esc(photo)}" alt="Post photo" loading="lazy" onclick="window.pawApp && window.pawApp.openLightbox('${this._esc(photo)}', '${this._esc(title)}', '${missing ? 'Missing pet' : 'Community sighting'}')" onerror="this.remove()" />` : ''}
        <div class="spost-counts">
          <span><i data-lucide="thumbs-up"></i> ${likes.count}</span>
          <button type="button" class="spost-link" data-feed="comments">${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}</button>
        </div>
        <div class="spost-actions">
          <button type="button" class="${likes.liked ? 'is-liked' : ''}" data-feed="like" ${social && me.id ? '' : 'disabled'}><i data-lucide="thumbs-up"></i> ${likes.liked ? 'Liked' : 'Like'}</button>
          <button type="button" data-feed="comments"><i data-lucide="message-circle"></i> Comment</button>
          <span class="spost-secondary">${secondary}</span>
        </div>
        ${commentsHtml}
      </article>`;
  }

  // Redraws the posts that are showing (after more load in, or likes and comments arrive)
  _redrawFeed() {
    const posts = document.getElementById('sfeed-posts');
    if (!posts) return;
    posts.innerHTML = this._feedPostsHtml();
    const sentinel = document.getElementById('sfeed-sentinel');
    if (sentinel) sentinel.textContent = this._feedEndText();
    if (window.lucide) window.lucide.createIcons({ root: posts });
    // Look again: if the end of the feed is still on screen, load the next batch
    if (this._feedObserver && sentinel) { this._feedObserver.unobserve(sentinel); this._feedObserver.observe(sentinel); }
  }

  _redrawPost(sightingId) {
    const el = document.querySelector(`.spost[data-post="${CSS.escape(sightingId)}"]`);
    const s = (this._feedItems || []).find((x) => x.id === sightingId);
    if (!el || !s) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = this._postHtml(s);
    el.replaceWith(tmp.firstElementChild);
    const fresh = document.querySelector(`.spost[data-post="${CSS.escape(sightingId)}"]`);
    if (fresh && window.lucide) window.lucide.createIcons({ root: fresh });
    return fresh;
  }

  // After the list is drawn: load likes and comments, and watch the end of the feed
  _afterGrid() {
    if (this._feedObserver) { this._feedObserver.disconnect(); this._feedObserver = null; }
    if (!this._isFeed()) return;
    window.pawStore.loadSocial().then(() => this._redrawFeed());
    const sentinel = document.getElementById('sfeed-sentinel');
    if (sentinel && 'IntersectionObserver' in window) {
      this._feedObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && this._feedHasMore()) {
          this.feedLimit = (this.feedLimit || 5) + 5;
          this._redrawFeed();
        }
      }, { rootMargin: '400px' });
      this._feedObserver.observe(sentinel);
    }
  }

  _bindFeed() {
    if (!this.container || this.container.__feedBound) return;
    this.container.__feedBound = true;
    this.openComments = this.openComments || new Set();

    document.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.spost-more')) return;
      if (this.container) this.container.querySelectorAll('.spost-more.is-open').forEach((w) => w.classList.remove('is-open'));
    });
    this.container.addEventListener('click', async (e) => {
      const btn = e.target.closest && e.target.closest('[data-feed]');
      const post = btn && btn.closest('.spost');
      if (!btn || !post) return;
      const id = post.dataset.post;
      const kind = post.dataset.kind;
      const act = btn.dataset.feed;
      // The three-dot menu on small screens: open it, or close it once an action in it is chosen
      if (act === 'more') {
        const wrap = btn.closest('.spost-more');
        const open = !wrap.classList.contains('is-open');
        this.container.querySelectorAll('.spost-more.is-open').forEach((w) => { w.classList.remove('is-open'); w.querySelector('.spost-more-toggle')?.setAttribute('aria-expanded', 'false'); });
        if (open) { wrap.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
        return;
      }
      btn.closest('.spost-more')?.classList.remove('is-open');
      if (act === 'like') {
        btn.disabled = true;
        await window.pawStore.toggleLike(id, kind);
        this._redrawPost(id);
      } else if (act === 'comments') {
        if (this.openComments.has(id)) this.openComments.delete(id); else this.openComments.add(id);
        const fresh = this._redrawPost(id);
        if (this.openComments.has(id) && fresh) fresh.querySelector('.spost-compose input')?.focus();
      } else if (act === 'details') {
        this.openClaim(id);
      } else if (act === 'mine') {
        const r = (this._feedItems || []).find((x) => x.id === id) || {};
        window.publicView.openMarkFound(r.petId || id);
      } else if (act === 'found') {
        const sg = window.pawStore.getSightingById(id) || {};
        const rep = sg.missing_report_id ? window.pawStore.getMissingReportById(sg.missing_report_id) : null;
        const pid = (rep && (rep.petId || rep.id)) || sg.petId || sg.missing_report_id;
        if (pid) window.publicView.openMarkFound(pid);
      } else if (act === 'seen') {
        const r = (this._feedItems || []).find((x) => x.id === id) || {};
        if (!(window.foundView && window.foundView.preselect(id))) window.reportManager.openSightingModal(id, r.petId || '');
      } else if (act === 'case') {
        const caseId = await window.pawStore.getCaseIdForSighting(id);
        if (caseId) window.notifManager.openReunionCase(caseId); else window.notifManager.openSightingVerificationModal(id);
      } else if (act === 'verify') {
        window.notifManager.openSightingVerificationModal(id);
      } else if (act === 'archive') {
        this.archiveSighting(id);
      } else if (act === 'delcomment') {
        if (await window.pawStore.deleteComment(id, btn.dataset.cid)) this._redrawPost(id);
      }
    });

    this.container.addEventListener('submit', async (e) => {
      const form = e.target.closest && e.target.closest('.spost-compose');
      if (!form) return;
      e.preventDefault();
      const input = form.querySelector('input');
      const body = input.value.trim();
      if (!body) return;
      const sid = form.dataset.sid;
      form.querySelector('button').disabled = true;
      const res = await window.pawStore.addComment(sid, body, form.dataset.kind);
      if (!res.ok) {
        window.notifManager?.showToast(res.error || 'Could not post your comment.', 'danger', 4500);
        form.querySelector('button').disabled = false;
        return;
      }
      this.openComments.add(sid);
      this._redrawPost(sid)?.querySelector('.spost-compose input')?.focus();
    });
  }

  async _loadMyClaims() {
    const rows = await window.pawStore.getMyClaims();
    const next = new Set(rows.map((r) => r.sighting_id));
    const changed = !this.myClaims || next.size !== this.myClaims.size || [...next].some((id) => !this.myClaims.has(id));
    this.myClaims = next;
    if (changed && next.size && window.location.hash === '#sightings') this._refreshGrid();
  }

  // `role` is 'finder' for the guardian who sent the report, so the wording speaks to them
  _claimStatus(c, role = 'claimant') {
    const when = c.resolved_at ? this._timeAgo(c.resolved_at) : '';
    const finder = role === 'finder';
    if (c.status === 'reunited') return { cls: 'is-reunited', label: 'Reunited', note: finder ? `You marked this pet as reunited with its owner${when ? ` (${when})` : ''}.` : `The finder confirmed this pet is yours${when ? ` (${when})` : ''}.` };
    if (c.status === 'discarded') return { cls: 'is-discarded', label: 'Claim discarded', note: finder ? `You discarded this claim${when ? ` (${when})` : ''}.` : `The finder discarded this claim${when ? ` (${when})` : ''}.` };
    return finder
      ? { cls: 'is-pending', label: 'Needs your review', note: 'Check their photo and message, then mark the pet as reunited or discard the claim.' }
      : { cls: 'is-pending', label: 'Waiting for the finder', note: 'The finder was alerted and will review your claim.' };
  }

  _claimedHtml(c) {
    const st = this._claimStatus(c);
    const finder = c.finder_phone
      ? `<div class="claim-finder"><span>Finder's phone number</span><a href="tel:${this._esc(String(c.finder_phone).replace(/[^+\d]/g, ''))}">${this._esc(c.finder_phone)}</a></div>`
      : '<p class="claim-note">The finder did not leave a number, so they will contact you using the number you gave.</p>';
    return `
      <div class="claim-mine">
        <div class="claim-mine-head"><span class="claim-done-icon"><i data-lucide="check"></i></span>
          <div><strong>You claimed this pet</strong><small>${this._esc(this._timeAgo(c.created_at))}</small></div>
          <span class="claim-status ${st.cls}">${st.label}</span></div>
        <p class="claim-note">${this._esc(st.note)}</p>
        ${finder}
        <div class="claim-details">
          <div class="claim-row"><span>Your phone</span><strong>${this._esc(c.phone || '')}</strong></div>
          <div class="claim-row"><span>Your message</span><strong>${this._esc(c.message || '')}</strong></div>
        </div>
        ${c.photoUrl ? `<img class="claim-mine-photo" src="${this._esc(c.photoUrl)}" alt="Your photo with the pet" onclick="window.pawApp && window.pawApp.openLightbox('${this._esc(c.photoUrl)}', 'Your claim photo', '')" />` : ''}
      </div>`;
  }

  async openClaim(sightingId) {
    const s = window.pawStore.getSightings().find((x) => x.id === sightingId);
    const body = document.getElementById('claim-body');
    if (!s || !body) return;
    const me = window.pawStore.getGoogleUser() || {};
    const isArchived = s.status === 'dismissed' || s.status === 'archived';
    const isOwner = this._isOwnerOfSightedPet(s);
    let blocked = '';
    if (!me.id) blocked = 'Log in to claim a pet.';
    else if (s.reporterId && s.reporterId === me.id) blocked = 'You sent this report. If the owner claims the pet, you will be notified.';
    else if (isOwner) blocked = 'This looks like a sighting of a pet you reported missing. Use Verify Sighting to confirm whether it is yours.';
    else if (isArchived) blocked = 'This report was archived, so it can no longer be claimed.';
    else if (!window.pawStore.isDbId(s.id)) blocked = 'This report is still being saved online. Try again in a moment.';
    let myClaim = null;
    if (!blocked && this.myClaims && this.myClaims.has(sightingId)) myClaim = await window.pawStore.getMyClaim(sightingId);
    const title = document.getElementById('claim-title-text');
    if (title) title.textContent = blocked ? ' Sighting report' : myClaim ? ' You claimed this pet' : ' Is this your pet?';
    const photo = s.photoUrl || s.photo || window.PET_PHOTO_PLACEHOLDER;
    const raw = String(s.comments || s.notes || '').trim();
    const cond = raw.match(/^pet condition:\s*([\s\S]*)$/i);
    const place = String(s.location || '').match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    const linked = s.petId || s.missing_report_id || s.matchedPetId;
    const row = (label, value) => value ? `<div class="claim-row"><span>${label}</span><strong>${this._esc(value)}</strong></div>` : '';
    this.claimId = sightingId;
    this.claimView = { type: 'report', id: sightingId };
    body.innerHTML = `
      <div class="claim-pet">
        <img src="${this._esc(photo)}" alt="Reported pet" onerror="this.src='${window.PET_PHOTO_PLACEHOLDER}'" />
        <div>
          <div class="claim-pet-title">${this._esc(window.pawStore.sightingBreed(s))}</div>
          <div class="claim-pet-sub">${this._esc(s.species || 'Animal')}${(linked || window.pawStore.sightingBreed(s) === 'Breed not specified') ? '' : ' <span class="sighting-card-assumed">Assumed breed</span>'}</div>
          <div class="claim-pet-time">${this._esc(this._timeAgo(s.dateTimeSeen || s.createdAt))}</div>
        </div>
      </div>
      <div class="claim-details">
        ${row('Found at', place ? place[1] : s.location)}
        ${row('Place description', place ? place[2] : '')}
        ${row('Pet condition', cond ? cond[1] : '')}
        ${row('Reported by', s.reporterName || 'Community Good Samaritan')}
      </div>
      ${myClaim ? this._claimedHtml(myClaim) : blocked ? `<div class="claim-blocked"><p class="claim-note">${this._esc(blocked)}</p>${isOwner && !isArchived ? `<button type="button" class="btn btn-primary claim-submit" onclick="window.notifManager.closeModal('claim-sighting-modal'); window.notifManager.openSightingVerificationModal('${this._esc(s.id)}')"><i data-lucide="shield-check"></i> Verify Sighting</button>` : ''}</div>` : `<form id="claim-form" class="claim-form" novalidate>
        <p class="claim-note">If this is your pet, show the finder it is yours. They are alerted with your number and photo, and you get their number once you send your claim.</p>
        <div class="form-group">
          <label class="form-label" for="claim-phone">Your phone number *</label>
          <input type="tel" class="form-control" id="claim-phone" placeholder="e.g. 0917 123 4567" value="${this._esc(me.phone || '')}" autocomplete="tel" inputmode="tel" />
        </div>
        <div class="form-group">
          <label class="form-label" for="claim-photo">Photo of you with your pet *</label>
          <input type="file" id="claim-photo" class="form-control" accept="image/jpeg,image/png,image/webp" />
          <img id="claim-photo-preview" class="claim-photo-preview" alt="Your photo" hidden />
          <small class="claim-fine">A clear photo of you together with the pet helps the finder trust your claim. Only the finder can see it.</small>
        </div>
        <div class="form-group">
          <label class="form-label" for="claim-message">How do you know it is yours? *</label>
          <textarea class="form-control" id="claim-message" rows="3" maxlength="500" placeholder="Its name, markings, collar, or anything only the owner would know"></textarea>
        </div>
        <div class="claim-error" id="claim-error" role="alert" hidden></div>
        <button type="submit" class="btn btn-primary claim-submit" id="claim-submit"><i data-lucide="heart-handshake"></i> This is my pet</button>
      </form>`}`;
    const form = body.querySelector('#claim-form');
    if (form) {
      form.addEventListener('submit', (e) => { e.preventDefault(); this.submitClaim(); });
      body.querySelector('#claim-photo').addEventListener('change', (e) => {
        const f = e.target.files[0];
        const img = body.querySelector('#claim-photo-preview');
        img.hidden = !f;
        if (f) { const r = new FileReader(); r.onload = () => { img.src = r.result; }; r.readAsDataURL(f); }
      });
    }
    // The finder who sent this report sees the claims made on it
    if (s.reporterId && s.reporterId === me.id) this.showClaims(sightingId);
    window.notifManager.openModal('claim-sighting-modal');
    if (window.lucide) window.lucide.createIcons({ root: body });
  }

  // Reunited / discard buttons for a pending claim (a second tap confirms)
  _claimActions(c) {
    if (c.status !== 'pending') return '';
    return `<div class="claim-actions" data-claim-id="${this._esc(c.id)}">
      <button type="button" class="btn btn-primary btn-sm" data-act="reunited"><i data-lucide="party-popper"></i> Mark as reunited</button>
      <button type="button" class="btn btn-outline btn-sm" data-act="discarded"><i data-lucide="x"></i> Discard claim</button>
    </div>`;
  }

  _bindClaimBody() {
    const body = document.getElementById('claim-body');
    if (!body || body.__actBound) return;
    body.__actBound = true;
    body.addEventListener('click', async (e) => {
      const btn = e.target.closest && e.target.closest('[data-act], [data-do], [data-back]');
      const box = btn && btn.closest('.claim-actions');
      if (!btn || !box) return;
      const id = box.dataset.claimId;
      if (btn.dataset.act) {
        const reunited = btn.dataset.act === 'reunited';
        box.innerHTML = `<span class="claim-ask">${reunited ? 'Mark this pet as reunited with its owner?' : 'Discard this claim?'}</span>
          <button type="button" class="btn ${reunited ? 'btn-primary' : 'btn-danger'} btn-sm" data-do="${btn.dataset.act}">Yes</button>
          <button type="button" class="btn btn-outline btn-sm" data-back="1">Back</button>`;
      } else if (btn.dataset.back) {
        this._refreshClaimView();
      } else if (btn.dataset.do) {
        box.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        const res = await window.pawStore.resolveClaim(id, btn.dataset.do);
        if (!res.ok) {
          window.notifManager?.showToast(res.error || 'Could not update the claim.', 'danger', 5000);
          this._refreshClaimView();
          return;
        }
        window.notifManager?.showToast(btn.dataset.do === 'reunited' ? 'Marked as reunited. Both of you were notified.' : 'Claim discarded. Both of you were notified.', 'success', 4500);
        this._refreshClaimView();
      }
    });
  }

  // Redraws whichever claim screen is open (the report's claims, or one claim's details)
  _refreshClaimView() {
    if (!this.claimView) return;
    const { type, id } = this.claimView;
    if (type === 'detail') this.openClaimDetail(id); else this.openClaim(id);
  }

  _claimItemHtml(c) {
    const st = this._claimStatus(c);
    const tel = String(c.phone || '').replace(/[^+\d]/g, '');
    return `
      <div class="claim-item ${st.cls}">
        <div class="claim-item-head">
          ${c.photoUrl ? `<img src="${this._esc(c.photoUrl)}" alt="Claimant with the pet" title="View photo" onclick="window.pawApp && window.pawApp.openLightbox('${this._esc(c.photoUrl)}', 'Claim photo', '${this._esc(c.claimant_name || '')}')" />` : '<span class="claim-item-noimg"></span>'}
          <div class="claim-item-who">
            <strong>${this._esc(c.claimant_name || 'A PawTrack guardian')}</strong>
            <small>Claimed ${this._esc(this._timeAgo(c.created_at))}</small>
          </div>
          <span class="claim-status ${st.cls}">${c.status === 'pending' ? 'Pending' : st.label}</span>
        </div>
        <p class="claim-item-msg">${this._esc(c.message || '')}</p>
        <a class="claim-item-call" href="tel:${this._esc(tel)}"><i data-lucide="phone"></i> ${this._esc(c.phone || '')}</a>
        ${this._claimActions(c)}
      </div>`;
  }

  // Claims on the report the signed-in guardian sent: who claimed, how to reach them, their photo, and the decision
  async showClaims(sightingId) {
    const claims = await window.pawStore.getClaimsFor(sightingId);
    const body = document.getElementById('claim-body');
    if (!body || this.claimId !== sightingId) return;
    body.querySelector('.claim-list')?.remove();
    const box = document.createElement('div');
    box.className = 'claim-list';
    box.innerHTML = `<h4>Claims on this report (${claims.length})</h4>` + (claims.length
      ? claims.map((c) => this._claimItemHtml(c)).join('')
      : '<p class="claim-note">Nobody has claimed this pet yet.</p>');
    body.appendChild(box);
    this._bindClaimBody();
    if (window.lucide) window.lucide.createIcons({ root: box });
  }

  // Details of one claim, opened by tapping a claim notification (or from the claim screens)
  async openClaimDetail(claimId) {
    const d = await window.pawStore.getClaimDetail(claimId);
    const body = document.getElementById('claim-body');
    if (!d || !body) {
      window.notifManager?.showToast('The details of this claim are not available.', 'info', 4000);
      return;
    }
    this.claimView = { type: 'detail', id: claimId };
    const sg = d.sighting || {};
    const place = String(sg.location || '').match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    const st = this._claimStatus(d, d.role);
    const title = document.getElementById('claim-title-text');
    if (title) title.textContent = ' Pet claim';
    const tel = (v) => String(v || '').replace(/[^+\d]/g, '');
    const mine = d.role === 'claimant';
    const who = mine ? 'Your claim' : (d.claimant_name || 'A PawTrack guardian');
    const callName = mine ? 'the finder' : (d.claimant_name || 'the claimant');
    const callNumber = mine ? d.finder_phone : d.phone;
    const placeText = place ? place[1] : sg.location;
    const timeline = [
      ['Claimed', this._timeAgo(d.created_at)],
      d.resolved_at ? [st.label, this._timeAgo(d.resolved_at)] : null
    ].filter(Boolean);
    body.innerHTML = `
      <div class="cd">
        <section class="cd-pet">
          <img src="${this._esc(sg.photo_url || window.PET_PHOTO_PLACEHOLDER)}" alt="Reported pet" onerror="this.src='${window.PET_PHOTO_PLACEHOLDER}'" />
          <div class="cd-pet-main">
            <small class="cd-kicker">Reported pet</small>
            <h4>${this._esc(window.pawStore.sightingBreed({ breed: sg.breed, missing_report_id: sg.missing_pet_id }))}</h4>
            <div class="cd-sub">${this._esc(sg.species || 'Animal')}</div>
            ${placeText ? `<div class="cd-where"><i data-lucide="map-pin"></i><span>${this._esc(placeText)}${place && place[2] ? ` <em>(${this._esc(place[2])})</em>` : ''}</span></div>` : ''}
          </div>
          <span class="claim-status ${st.cls}">${st.label}</span>
        </section>

        <section class="cd-claim">
          <header class="cd-claim-head">
            ${this._avatar(mine ? (window.pawStore.getGoogleUser() || {}).name || 'You' : d.claimant_name, '')}
            <div><strong>${this._esc(who)}</strong><small>${mine ? 'You claimed this pet' : 'says this pet is theirs'} &middot; ${this._esc(this._timeAgo(d.created_at))}</small></div>
          </header>

          ${callNumber ? `<a class="cd-call" href="tel:${this._esc(tel(callNumber))}">
            <span class="cd-call-icon"><i data-lucide="phone"></i></span>
            <span class="cd-call-text"><small>Call ${this._esc(callName)}</small><strong>${this._esc(callNumber)}</strong></span>
            <span class="cd-call-go">Tap to call</span>
          </a>` : `<p class="cd-nophone">${mine ? 'The finder did not leave a number. They will contact you on the number you gave.' : 'No phone number on this claim.'}</p>`}

          <div class="cd-field">
            <span class="cd-label">${mine ? 'Your message' : 'Their message'}</span>
            <blockquote class="cd-quote">${this._esc(d.message || '')}</blockquote>
          </div>

          ${d.photoUrl ? `<div class="cd-field">
            <span class="cd-label">${mine ? 'Your photo with the pet' : 'Their photo with the pet'}</span>
            <button type="button" class="cd-evidence" onclick="window.pawApp && window.pawApp.openLightbox('${this._esc(d.photoUrl)}', 'Claim photo', '${this._esc(d.claimant_name || '')}')" title="Tap to enlarge">
              <img src="${this._esc(d.photoUrl)}" alt="Photo with the pet" />
              <span class="cd-evidence-zoom"><i data-lucide="maximize-2"></i> Enlarge</span>
            </button>
          </div>` : ''}
        </section>

        <div class="cd-status ${st.cls}"><i data-lucide="${d.status === 'reunited' ? 'party-popper' : d.status === 'discarded' ? 'x-circle' : 'clock'}"></i><span>${this._esc(st.note)}</span></div>

        <ul class="cd-timeline">${timeline.map(([k, v]) => `<li><span>${this._esc(k)}</span><b>${this._esc(v)}</b></li>`).join('')}</ul>

        ${d.role === 'finder' ? this._claimActions(d) : ''}
      </div>`;
    this._bindClaimBody();
    window.notifManager.openModal('claim-sighting-modal');
    if (window.lucide) window.lucide.createIcons({ root: body });
  }

  async submitClaim() {
    const err = document.getElementById('claim-error');
    const fail = (msg, focusId) => { err.textContent = msg; err.hidden = false; if (focusId) document.getElementById(focusId)?.focus(); };
    const phone = document.getElementById('claim-phone').value.trim();
    const message = document.getElementById('claim-message').value.trim();
    err.hidden = true;
    if (!phone) return fail('Add a phone number so the finder can reach you.', 'claim-phone');
    if (!/^(\+?63|0)9\d{9}$/.test(phone.replace(/[\s\-().]/g, ''))) return fail('Enter a valid Philippine mobile number, for example 0917 123 4567.', 'claim-phone');
    const file = document.getElementById('claim-photo').files[0];
    if (!file) return fail('Add a photo of you with your pet.', 'claim-photo');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return fail('The photo must be a JPG, PNG or WebP image.', 'claim-photo');
    if (file.size > 15 * 1024 * 1024) return fail('That photo is too large. Choose one under 15 MB.', 'claim-photo');
    if (message.length < 5) return fail('Tell the finder how you know this is your pet.', 'claim-message');

    const btn = document.getElementById('claim-submit');
    btn.disabled = true;
    let blob;
    try {
      // Redrawn as a smaller JPEG: this also strips anything hidden in the file
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      blob = await window.pawStore.shrinkPhoto(dataUrl);
      // The photo must show a real pet (not a screenshot or an unrelated picture)
      const verdict = await window.petAI.checkPetPhoto(dataUrl, { indicator: document.getElementById('claim-photo')?.closest('.form-group') });
      if (!verdict.ok) { btn.disabled = false; return fail(verdict.reason, 'claim-photo'); }
    } catch (e) { btn.disabled = false; return fail('That photo could not be read. Try another one.', 'claim-photo'); }
    const res = await window.pawStore.claimSighting(this.claimId, phone, message, blob);
    if (!res.ok) {
      if (/already claimed/i.test(res.error || '')) { (this.myClaims = this.myClaims || new Set()).add(this.claimId); return this.openClaim(this.claimId); }
      btn.disabled = false;
      return fail(res.error || 'Could not send your claim. Please try again.');
    }
    (this.myClaims = this.myClaims || new Set()).add(this.claimId);
    this._refreshGrid();
    window.pawStore.syncFromSupabase(); // brings in the "You claimed a pet" notification

    window.modalGuard && window.modalGuard.markClean('claim-sighting-modal');
    const finder = res.finderPhone
      ? `<div class="claim-finder"><span>Finder's phone number</span><a href="tel:${this._esc(res.finderPhone.replace(/[^+\d]/g, ''))}">${this._esc(res.finderPhone)}</a></div>
         <p class="claim-note">Call or text them to arrange where to meet. Bring something that shows the pet is yours.</p>`
      : '<p class="claim-note">The finder did not leave a number, so they will contact you using the number you gave.</p>';
    document.getElementById('claim-body').innerHTML = `
      <div class="claim-done">
        <span class="claim-done-icon"><i data-lucide="check"></i></span>
        <h3>Claim sent</h3>
        <p>The finder has been alerted that this pet may be yours.</p>
        ${finder}
        <button type="button" class="btn btn-primary" onclick="window.notifManager.closeModal('claim-sighting-modal')">Done</button>
      </div>`;
    if (window.lucide) window.lucide.createIcons({ root: document.getElementById('claim-body') });
    window.notifManager?.showToast('Your claim was sent to the finder.', 'success', 4000);
  }

  performArchive(sightingId) {
    if (!sightingId || !window.pawStore) return;
    const updated = window.pawStore.archiveSighting(sightingId);
    if (updated) {
      if (window.notifManager) {
        window.notifManager.showToast('Sighting report moved to Archive.', 'info', 3500);
      }
      this.refresh();
    }
  }

  retrieveSighting(sightingId) {
    if (!sightingId || !window.pawStore) return;
    const restored = window.pawStore.retrieveSighting(sightingId);
    if (restored) {
      if (window.notifManager) {
        window.notifManager.showToast('Sighting report retrieved and restored to active board.', 'success', 3500);
      }
      this.refresh();
    }
  }

  deleteSighting(sightingId) {
    if (!sightingId || !window.pawStore) return;
    const confirmDelete = window.confirm('Are you sure you want to permanently delete this sighting report? This action cannot be undone.');
    if (!confirmDelete) return;

    const deleted = window.pawStore.deleteSighting(sightingId);
    if (deleted) {
      if (window.notifManager) {
        window.notifManager.showToast('Sighting report permanently deleted.', 'danger', 3500);
      }
      this.refresh();
    }
  }

  // ─────────────────────────────────────────────────
  // DATA HELPERS
  // ─────────────────────────────────────────────────
  _buildStats(sightings) {
    const active = sightings.filter(s => s.status !== 'dismissed' && s.status !== 'archived');
    return {
      total:     sightings.length,
      active:    active.length,
      possible:  active.filter(s => s.status === 'possible_sighting').length,
      confirmed: active.filter(s => s.status === 'confirmed_sighting').length,
      archived:  sightings.filter(s => s.status === 'dismissed' || s.status === 'archived').length,
      linked:    active.filter(s => !!s.missing_report_id).length,
      mine:      this._mine(sightings).length,
      missing:   window.pawStore.getMissingReports().length,
      reunited:  window.pawStore.getReunitedPets().length,
    };
  }

  _filteredSorted(sightings) {
    let list = [...sightings];

    // Status filter
    if (this.currentFilter === 'all') {
      list = list.filter(s => s.status !== 'dismissed' && s.status !== 'archived');
    } else if (this.currentFilter === 'possible') {
      list = list.filter(s => s.status === 'possible_sighting');
    } else if (this.currentFilter === 'mine') {
      list = this._mine(list);
    } else if (this.currentFilter === 'missing') {
      list = []; // the Missing tab lists reports of missing pets, added to the feed below
    } else if (this.currentFilter === 'confirmed') {
      list = list.filter(s => s.status === 'confirmed_sighting');
    } else if (this.currentFilter === 'archived' || this.currentFilter === 'dismissed') {
      list = list.filter(s => s.status === 'dismissed' || s.status === 'archived');
    }

    // Community filter
    if (this.selectedCommunity !== 'all') {
      const sel = this.selectedCommunity.toLowerCase();
      const districtKeywords = {
        'district 1': ['district 1', 'd1', 'la loma', 'sfdm', 'san francisco del monte', 'project 6', 'banawe', 'sto. domingo', 'project 7', 'balingasa', 'veterans village', 'del monte', 'siena', 'calavite'],
        'district 2': ['district 2', 'd2', 'commonwealth', 'batasan', 'payatas', 'holy spirit', 'bagong silangan', 'litex', 'lupang pangako', 'bf homes qc'],
        'district 3': ['district 3', 'd3', 'cubao', 'katipunan', 'loyola', 'eastwood', 'anonas', 'kamias', 'project 2', 'project 3', 'project 4', 'matandang balara', 'old balara', 'blue ridge', 'socorro', 'quirino', 'libis'],
        'district 4': ['district 4', 'd4', 'diliman', 'tomas morato', 'timog', 'south triangle', 'new manila', 'kamuning', 'teachers village', 'maginhawa', 'sikatuna', 'phil-am', 'west avenue', 'central', 'krus na ligas', 'up campus', 'quezon memorial circle', 'city hall', 'scout'],
        'district 5': ['district 5', 'd5', 'novaliches', 'fairview', 'lagro', 'gulod', 'san bartolome', 'bagbag', 'sta. lucia', 'greater lagro', 'regalado'],
        'district 6': ['district 6', 'd6', 'tandang sora', 'balintawak', 'culiat', 'talipapa', 'sangandaan', 'pasong tamo', 'baesa', 'sauyo']
      };

      list = list.filter(s => {
        const itemCommunity = (s.community || '').toLowerCase();
        const itemLocation = (s.location || '').toLowerCase();
        const combined = `${itemCommunity} ${itemLocation}`;
        if (itemCommunity === sel || combined.includes(sel)) return true;

        for (const [dKey, keywords] of Object.entries(districtKeywords)) {
          if (sel.includes(dKey)) {
            return keywords.some(kw => combined.includes(kw));
          }
        }
        return combined.includes(sel);
      });
    }

    // Search
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s =>
        (s.location     || '').toLowerCase().includes(q) ||
        (s.breed        || '').toLowerCase().includes(q) ||
        (s.reporterName || '').toLowerCase().includes(q) ||
        (s.community    || '').toLowerCase().includes(q) ||
        (s.comments     || '').toLowerCase().includes(q)
      );
    }

    // Sort
    if (this.currentSort === 'newest') {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (this.currentSort === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else if (this.currentSort === 'confirmed_first') {
      const rank = s => s.status === 'confirmed_sighting' ? 0 : s.status === 'possible_sighting' ? 1 : 2;
      list.sort((a, b) => rank(a) - rank(b) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return list;
  }

  // ─────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────
  // Possible sightings of the signed-in guardian's own missing pets, newest first
  _mine(sightings) {
    return sightings
      .filter(s => s.status === 'possible_sighting' && this._isOwnerOfSightedPet(s))
      .sort((a, b) => new Date(b.createdAt || b.dateTimeSeen || 0) - new Date(a.createdAt || a.dateTimeSeen || 0));
  }

  _filterPill(filter, label, count, active) {
    return `
      <button
        type="button"
        class="btn btn-sm sightings-filter-pill ${active ? 'btn-primary active' : 'btn-outline'}"
        data-filter="${filter}"
        onclick="window.sightingsView.setFilter('${filter}')"
      >${label} <span style="opacity:0.7;">(${count})</span></button>
    `;
  }

  _communityOptions(sightings) {
    const qcDistricts = [
      'District 1 (La Loma / SFDM / Project 6)',
      'District 2 (Commonwealth / Batasan / Payatas)',
      'District 3 (Cubao / Katipunan / Loyola / Eastwood)',
      'District 4 (Diliman / Tomas Morato / UP / New Manila)',
      'District 5 (Novaliches / Fairview / Lagro)',
      'District 6 (Tandang Sora / Balintawak / Culiat)'
    ];

    const set = new Set(qcDistricts);
    sightings.forEach(s => { 
      if (s.community && !s.community.includes('National Capital Region')) set.add(s.community); 
    });
    if (window.pawStore) {
      window.pawStore.getPets().forEach(p => { 
        if (p.community && !p.community.includes('National Capital Region')) set.add(p.community); 
      });
    }
    const opts = ['<option value="all">All QC Districts</option>'];
    Array.from(set).forEach(c => {
      opts.push(`<option value="${this._esc(c)}" ${this.selectedCommunity === c ? 'selected' : ''}>${c}</option>`);
    });
    return opts.join('');
  }

  // A reunited pet: the pet's photo, where it was last seen, how long it was missing, and when it got home
  _renderReunionCard(r) {
    const photo = r.reunionPhotoUrl || r.photoUrl || window.PET_PHOTO_PLACEHOLDER;
    const days = r.daysMissing == null ? '' : (r.daysMissing === 0 ? 'Found the same day' : `Missing for ${r.daysMissing} day${r.daysMissing === 1 ? '' : 's'}`);
    return `
      <div class="sighting-card glass-card">
        <div class="sighting-card-photo-wrap">
          <img src="${this._esc(photo)}" alt="${this._esc(r.name)}" class="sighting-card-photo" onerror="this.src='${window.PET_PHOTO_PLACEHOLDER}'" />
          <span class="sighting-card-status-badge is-solid" style="background:#16a34a; color:#ffffff; border-color:transparent;"><i class="sighting-card-status-dot"></i>Reunited</span>
        </div>
        <div class="sighting-card-body">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem; gap:0.5rem;">
            <div>
              <div style="font-size:1rem; font-weight:800; color:var(--text-main); line-height:1.2;">${this._esc(r.name)}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${this._esc([r.species, r.breed].filter(Boolean).join(' · '))}</div>
            </div>
            <span style="font-size:0.72rem; color:var(--text-muted); white-space:nowrap; flex-shrink:0;">${this._timeAgo(r.reunitedAt)}</span>
          </div>
          ${r.location ? `<div class="sighting-card-detail-row"><span>Last seen: ${this._esc(r.location)}</span></div>` : ''}
          ${days ? `<div class="sighting-card-detail-row"><span>${days}</span></div>` : ''}
          <div class="sighting-card-detail-row"><span>${this._esc(r.outcome || 'Returned to owner')}</span></div>
          ${r.foundCondition ? `<div class="sighting-card-condition"><span class="sighting-card-condition-label"><i data-lucide="heart-pulse"></i> Condition when found</span><p>${this._esc(r.foundCondition)}</p></div>` : ''}
          ${r.story ? `<div class="sighting-card-notes">"${this._esc(r.story)}"</div>` : ''}
        </div>
      </div>`;
  }

  _renderReunions() {
    const list = window.pawStore.getReunitedPets();
    const q = this.searchQuery.trim().toLowerCase();
    const shown = q ? list.filter(r => [r.name, r.breed, r.species, r.location].some(v => (v || '').toLowerCase().includes(q))) : list;
    if (!shown.length) {
      return `
        <div class="sightings-empty-state glass-card">
          <h3>No reunited pets yet</h3>
          <p>Pets marked as found will show up here.</p>
        </div>`;
    }
    return `<div class="sightings-cards-grid">${shown.map(r => this._renderReunionCard(r)).join('')}</div>`;
  }

  _renderGrid(sightings) {
    if (this.currentFilter === 'reunited') return this._renderReunions();
    const list = this._filteredSorted(sightings);

    if (list.length === 0 && !(this._isFeed() && this._feedPosts(list).length)) {
      const isArchivedView = this.currentFilter === 'archived' || this.currentFilter === 'dismissed';
      return `
        <div class="sightings-empty-state glass-card">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            ${isArchivedView 
              ? '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'
              : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="3" x2="21" y2="21"/>'
            }
          </svg>
          <h3>${isArchivedView ? 'No archived sightings' : this.currentFilter === 'mine' ? 'No possible sightings of your pets' : 'No sightings found'}</h3>
          <p>${isArchivedView ? 'You have no archived sighting reports.' : this.currentFilter === 'mine' ? 'When someone reports seeing a pet you reported missing, it will show up here.' : 'No active sighting reports match the current filters. Try a different filter or report a sighting!'}</p>
          ${isArchivedView ? `
            <button class="btn btn-outline" onclick="window.sightingsView.setFilter('all')">
              <i data-lucide="arrow-left"></i> Back to Active Sightings
            </button>
          ` : ''}
        </div>
      `;
    }

    // The sightings list is a scrolling feed, like Facebook: one post after another, with likes and comments
    if (this._isFeed()) {
      this._feedItems = this._feedPosts(list);
      this.feedLimit = this.feedLimit || 5;
      return `<div class="sfeed-layout">
        <div class="sfeed">
          ${this._feedComposerHtml()}
          <div id="sfeed-posts">${this._feedPostsHtml()}</div>
          <div id="sfeed-sentinel" class="sfeed-sentinel">${this._feedEndText()}</div>
        </div>
        ${this._feedSideHtml(sightings)}
      </div>`;
    }

    return `
      <div class="sightings-cards-grid">
        ${list.map(s => this._renderCard(s)).join('')}
      </div>
    `;
  }

  _renderCard(s) {
    const isConfirmed = s.status === 'confirmed_sighting';
    const isArchived  = s.status === 'dismissed' || s.status === 'archived';
    const isPossible  = s.status === 'possible_sighting';

    const palette      = window.MAP_COLORS || {};
    const statusColor  = isConfirmed ? (palette.confirmed || '#16a34a') : isPossible ? (palette.sighting || '#ea9d1e') : '#b85410';
    const statusLabel  = isConfirmed ? 'Confirmed Sighting' : isPossible ? 'Possible Sighting' : 'Archived';
    const statusBg     = isConfirmed ? 'rgba(22,163,74,0.12)' : isPossible ? 'rgba(234,157,30,0.12)' : 'rgba(184,84,16,0.12)';
    const statusBorder = isConfirmed ? 'rgba(22,163,74,0.3)'  : isPossible ? 'rgba(234,157,30,0.3)'  : 'rgba(184,84,16,0.3)';

    const timeAgo = this._timeAgo(s.dateTimeSeen || s.createdAt);
    const photo   = s.photoUrl || s.photo || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=400&q=80';

    // Look up linked pet
    let linkedPetHtml = '';
    if (s.petId || s.missing_report_id) {
      let pet = s.petId ? window.pawStore.getPetById(s.petId) : null;
      if (!pet && s.missing_report_id) {
        const rep = window.pawStore.getMissingReportById(s.missing_report_id);
        if (rep) pet = window.pawStore.getPetById(rep.petId);
      }
      if (pet) {
        linkedPetHtml = `
          <div class="sighting-card-linked-pet">
            <img src="${this._esc(pet.photoUrl)}" alt="${this._esc(pet.name)}" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=80&q=80'" />
            <div>
              <div style="font-size:0.7rem; color:var(--primary); font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Linked Missing Pet</div>
              <div style="font-size:0.85rem; font-weight:700; color:var(--text-main);">${this._esc(pet.name)}</div>
              <div style="font-size:0.72rem; color:var(--text-muted);">${this._esc(pet.breed || '')} · NFC: ${this._esc(pet.nfcTag || 'N/A')}</div>
            </div>
          </div>
        `;
      }
    }

    if (!linkedPetHtml) {
      linkedPetHtml = `
        <div class="sighting-card-linked-pet is-none">
          <span class="sighting-card-linked-icon"><i data-lucide="paw-print"></i></span>
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Registered pet</div>
            <div style="font-size:0.85rem; font-weight:700; color:var(--text-main);">Not linked</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">Reported without a registered pet</div>
          </div>
        </div>`;
    }

    // Only the guardian who reported the pet missing reviews its sightings; the finder who sent this one never does
    const isOwner = this._isOwnerOfSightedPet(s);

    // Anyone else who is signed in can claim a reported pet as theirs
    const me = window.pawStore.getGoogleUser();
    const canClaim = !!(me && me.id) && !isOwner && !isArchived && s.reporterId !== me.id && window.pawStore.isDbId(s.id);

    // Action buttons
    let actionHtml = '';
    if (!isOwner) {
      actionHtml = isConfirmed
        ? `<span class="btn btn-sm" style="flex:1; background:rgba(22,163,74,0.1); color:#16a34a; border:1px solid rgba(22,163,74,0.3); cursor:default; display:flex; align-items:center; gap:5px; justify-content:center;"><i data-lucide="check-circle-2"></i> Owner Confirmed</span>`
        : '';
    } else if (isArchived) {
      // Archived actions: Retrieve & Delete
      actionHtml = `
        <button class="btn btn-success btn-sm" style="flex:1; background:#16a34a; border-color:#16a34a; color:#ffffff; display:flex; align-items:center; gap:5px; justify-content:center;" onclick="window.sightingsView.retrieveSighting('${this._esc(s.id)}')">
          <i data-lucide="rotate-ccw"></i> Retrieve
        </button>
        <button class="btn btn-outline btn-sm" style="color:#ef4444; border-color:rgba(239,68,68,0.35); display:flex; align-items:center; gap:5px; justify-content:center;" onclick="window.sightingsView.deleteSighting('${this._esc(s.id)}')" title="Permanently delete this sighting">
          <i data-lucide="trash-2"></i> Delete
        </button>
      `;
    } else if (isPossible) {
      actionHtml = `
        <button class="btn btn-primary btn-sm" style="flex:1; background:#16a34a; border-color:#16a34a; display:flex; align-items:center; gap:5px; justify-content:center;" onclick="window.notifManager.openSightingVerificationModal('${this._esc(s.id)}')">
          <i data-lucide="shield-check"></i> Verify Sighting
        </button>
        <button class="btn btn-outline btn-sm" onclick="window.sightingsView.archiveSighting('${this._esc(s.id)}')" title="Archive this sighting" style="display:flex; align-items:center; gap:5px;">
          <i data-lucide="archive"></i> Archive
        </button>
      `;
    } else if (isConfirmed) {
      actionHtml = `
        <span class="btn btn-sm" style="flex:1; background:rgba(22,163,74,0.1); color:#16a34a; border:1px solid rgba(22,163,74,0.3); cursor:default; display:flex; align-items:center; gap:5px; justify-content:center;">
          <i data-lucide="check-circle-2"></i> Owner Confirmed
        </span>
        <button class="btn btn-outline btn-sm" onclick="window.sightingsView.archiveSighting('${this._esc(s.id)}')" title="Archive this sighting" style="display:flex; align-items:center; gap:5px;">
          <i data-lucide="archive"></i> Archive
        </button>
      `;
    }

    return `
      <div class="sighting-card glass-card ${isArchived ? 'sighting-card-dismissed' : ''} is-claimable" data-claim="${this._esc(s.id)}" tabindex="0" role="button" aria-label="Open this sighting report">
        <!-- Photo -->
        <div class="sighting-card-photo-wrap" onclick="window.pawApp && window.pawApp.openLightbox('${this._esc(photo)}', '${this._esc(s.breed || 'Spotted Pet')}', 'Community Sighting Evidence · ${this._esc(s.location || '')}')">
          <img src="${this._esc(photo)}" alt="Sighting photo" class="sighting-card-photo" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=400&q=80'" />
          <!-- Status badge over photo -->
          <span class="sighting-card-status-badge is-solid" style="background:${statusColor}; color:${isPossible ? '#1a1206' : '#ffffff'}; border-color:transparent;">
            <i class="sighting-card-status-dot"></i>${statusLabel}
          </span>
          ${timeAgo ? `<span class="sighting-card-time">${timeAgo}</span>` : ''}
        </div>

        <!-- Body -->
        <div class="sighting-card-body">
          <!-- Breed (the reporter's guess when the pet is not registered) -->
          <div class="sighting-card-head">
            <div class="sighting-card-title">${this._esc(window.pawStore.sightingBreed(s))}</div>
            <div class="sighting-card-sub">${this._esc(s.species || 'Animal')}${(s.petId || s.missing_report_id || s.matchedPetId || window.pawStore.sightingBreed(s) === 'Breed not specified') ? '' : ' <span class="sighting-card-assumed">Assumed breed</span>'}</div>
          </div>

          <!-- Location -->
          <div class="sighting-card-detail-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>${this._esc(s.location || 'Location not specified')}</span>
          </div>

          <!-- Date/Time -->
          <div class="sighting-card-detail-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${s.dateTimeSeen ? new Date(s.dateTimeSeen).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently spotted'}</span>
          </div>

          <!-- Reporter -->
          <div class="sighting-card-detail-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>
            <span>${this._esc(s.reporterName || 'Community Good Samaritan')}</span>
            ${s.reporterPhone && s.reporterPhone !== '+63 9XX XXX XXXX' ? `<span style="color:var(--primary); font-size:0.72rem; margin-left:4px;">${this._esc(s.reporterPhone)}</span>` : ''}
          </div>

          <!-- Notes (truncated) -->
          ${(() => {
            const raw = String(s.comments || s.notes || '').trim();
            if (!raw) return '';
            const m = raw.match(/^pet condition:\s*(.*)$/i);
            const text = (m ? m[1] : raw);
            const short = text.length > 110 ? text.slice(0, 110) + '…' : text;
            return `<div class="sighting-card-condition"><span class="sighting-card-condition-label"><i data-lucide="heart-pulse"></i> ${m ? 'Pet condition' : 'Notes'}</span><p>${this._esc(short)}</p></div>`;
          })()}

          <!-- Linked pet banner -->
          ${linkedPetHtml}

          ${this.myClaims && this.myClaims.has(s.id)
            ? '<div class="sighting-card-claim-hint is-claimed"><i data-lucide="check-circle-2"></i> You claimed this pet</div>'
            : canClaim ? '<div class="sighting-card-claim-hint"><i data-lucide="heart-handshake"></i> Is this your pet? Tap to claim it</div>' : ''}

          <!-- Actions -->
          <div class="sighting-card-actions${actionHtml.trim() ? ' has-actions' : ''}">
            ${actionHtml}
            <button class="btn btn-outline btn-sm sighting-card-map-btn" onclick="window.location.hash='#owner'; setTimeout(() => { if (window.publicView) window.publicView.focusPetOnMap('${s.id}'); document.getElementById('incident-map-section')?.scrollIntoView({behavior:'smooth'}); }, 150);" title="View on Incident Map">
              <i data-lucide="map-pin"></i> <span class="sighting-card-map-label">View on map</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────
  // The signed-in guardian reported the pet this sighting is about, and did not send the sighting themselves
  _isOwnerOfSightedPet(s) {
    const store = window.pawStore;
    const user = store && store.getGoogleUser && store.getGoogleUser();
    if (!user || !user.id || !s.missing_report_id) return false;
    if (s.reporterId && s.reporterId === user.id) return false;
    const report = store.getMissingReportById(s.missing_report_id);
    return !!report && !!report.reporterId && report.reporterId === user.id;
  }

  _timeAgo(value) {
    if (!value) return 'Unknown time';
    const mins = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
    if (mins < 60)   return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24)    return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;');
  }

  // ─────────────────────────────────────────────────
  // OWNER / PET MANAGEMENT DELEGATION
  // ─────────────────────────────────────────────────
  openRegisterModal(prefillNfc) {
    if (window.ownerView) {
      window.ownerView.openRegisterModal(prefillNfc);
    }
  }

  openOwnerGuideModal() {
    if (window.ownerView) {
      window.ownerView.openOwnerGuideModal();
    }
  }

  markPetSafe(petId) {
    if (window.ownerView) {
      window.ownerView.markPetSafe(petId);
    }
  }

  showPendingFinderInfo(petId) {
    if (window.ownerView) {
      window.ownerView.showPendingFinderInfo(petId);
    }
  }

  showDigitalTagPass(petId) {
    if (window.ownerView) {
      window.ownerView.showDigitalTagPass(petId);
    }
  }

  openReportLostModal(petId) {
    if (window.ownerView) {
      window.ownerView.openReportLostModal(petId);
    }
  }

  renderPetCard(pet) {
    if (window.ownerView) {
      return window.ownerView.renderPetCard(pet);
    }
    return '';
  }
}

window.sightingsView = new SightingsView();
