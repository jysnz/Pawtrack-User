/**
 * Found a Pet: a finder uploads a photo, the AI reads it, and the system lists
 * every missing pet that looks similar. Choosing one sends the owner a found-pet alert.
 */

class FoundView {
  constructor() {
    this.reset();
  }

  reset() {
    this.photo = null;        // downscaled JPEG data URL
    this.status = 'idle';     // 'idle' | 'scanning' | 'done' | 'error'
    this.error = '';
    this.traits = null;
    this.description = '';
    this.matches = [];
    this.checked = 0;
    this.selectedId = null;   // a missing pet, or 'none' for "none of these"
    this.token = 0;           // ignores a scan reply that arrives after the photo changed
    this.sent = null;         // { name } once an alert has gone out
    this.listLimit = 6;       // how many missing pets the list shows before "See more"
    this.mode = 'pick';       // 'pick' (choose it from the missing list) | 'scan' (find the pet from a photo)
    this.query = '';          // search text in the missing list
    this.species = '';        // species chip in the missing list ('' = all)
    this.form = { location: '', placedesc: '', phone: '', notes: '', breed: '', species: '', caption: '', anonymous: true };
    this.pin = null;          // { lat, lng } where the finder dropped the pin
    this.pinChosen = false;   // the finder placed it (map tap, drag, search pick or current location)
  }

  // "Seen this pet?" on the map or the feed: open Found a Pet with that missing pet already chosen.
  // `id` is the pet's id or its missing report's id. Returns false when the pet is not on the list (for example it is yours).
  preselect(id) {
    const pet = this.othersMissing().find((p) => String(p.id) === String(id) || String(p.missingReportId) === String(id));
    if (!pet) return false;
    this.reset();
    this.mode = 'pick';
    this.selectedId = pet.id;
    if (window.location.hash === '#found') this.render(); else window.location.hash = '#found';
    // Open at the top, on the "Pet you found" card, not wherever the page we came from was scrolled to
    this.scrollToStart();
    return true;
  }

  scrollToStart() {
    const go = () => {
      const vp = document.getElementById('app-viewport');
      if (vp) vp.scrollTop = 0;
      document.querySelectorAll('.main-content, main, .app-main').forEach((el) => { el.scrollTop = 0; });
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
    };
    go();
    [60, 250, 600].forEach((ms) => setTimeout(go, ms));
  }

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Step 1: where it was found. Always on screen, before the pet is chosen.
  locationHtml() {
    if (!this.selectedId) return ''; // the map comes after the pet is chosen
    return `
      <section class="glass-card found-card found-location-card">
        <h3 class="found-card-title"><i data-lucide="map-pin"></i> Where did you find it? <span class="found-required" aria-hidden="true">*</span></h3>
        <p class="found-hint">Search for the place, or drop the pin on the map where you found the pet.</p>
          <div class="form-group found-where" id="found-where-group">
            <div class="report-location-search-wrap found-place-wrap" id="found-place-wrap">
              <div class="report-location-search-box">
                <svg class="report-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="found-place-input" class="report-location-search-input" placeholder="Search a street, barangay or landmark..." autocomplete="off" aria-label="Search for the place" />
              </div>
              <div id="found-place-suggestions" class="report-location-suggestions" style="display: none;"></div>
              <button type="button" class="use-location-btn" id="found-use-location">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/></svg>
                <span>Use my current location</span>
              </button>
            </div>
            <div class="found-map-wrap">
              <div id="found-pin-map" aria-label="Map: tap or drag the pin to where you found the pet"></div>
              <div class="report-map-overlay-helper" style="top: 8px; bottom: auto;">Tap the map or drag the pin to where you found the pet</div>
            </div>
            <label class="form-label found-place-label" for="found-location">Place name *</label>
            <input type="text" class="form-control found-place-name" id="found-location" placeholder="Drop the pin on the map to fill this in" value="${this.esc(this.form.location)}" readonly tabindex="-1" aria-readonly="true" />
            <small class="found-fine">Set by the pin on the map.</small>
            <label class="form-label found-place-label" for="found-placedesc">Place description <span class="found-optional">(optional)</span></label>
            <input type="text" class="form-control" id="found-placedesc" maxlength="150" placeholder="e.g. Near the park gate, beside the sari-sari store" value="${this.esc(this.form.placedesc)}" autocomplete="off" />
          </div>
      </section>`;
  }

  // The view is rebuilt from its saved state, so a store update while the page is open loses nothing
  render(container) {
    this.container = container || document.getElementById('app-viewport');
    if (!this.container) return;
    this.keepForm();
    if (!this.form.phone) {
      const user = window.pawStore.getGoogleUser();
      if (user && user.phone) this.form.phone = user.phone;
    }

    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Found a Pet</h1>
          <div class="view-subtitle">Choose the missing pet you found, or scan its photo to find similar missing pets. Then alert the owner.</div>
        </div>
      </div>
      ${this.sent ? `<div class="found-flow">${this.sentHtml()}</div>` : `
        <div class="found-stack">
          ${this.modeHtml()}
          ${this.stepperHtml()}
          ${this.mode === 'scan' ? `<div class="found-row found-row-photo">${this.photoHtml()}</div>` : ''}
          <div class="found-row found-row-main">${this.mainHtml()}</div>
        </div>`}`;
    this.bind();
    if (document.getElementById('found-pin-map')) this.initPinMap();
    if (window.lucide) window.lucide.createIcons({ root: this.container });
  }

  keepForm() {
    ['location', 'placedesc', 'phone', 'notes', 'breed', 'species', 'caption'].forEach((k) => {
      const el = document.getElementById(k === 'breed' ? 'found-pet-breed' : `found-${k}`);
      if (el) this.form[k] = el.value;
    });
    const anon = document.getElementById('found-anonymous');
    if (anon) this.form.anonymous = anon.checked;
  }

  // ---------- sections ----------

  stepperHtml() {
    const hasPhoto = !!this.photo;
    const scanned = this.status === 'done';
    const picked = !!this.selectedId;
    // [title, hint, done, active]
    const placed = !!this.pinChosen;
    const steps = this.mode === 'pick' ? [
      ['Choose the pet', 'From missing pets', picked, !picked],
      ['Where you found it', 'Drop the pin', picked && placed, picked && !placed],
      ['Notify the owner', 'Add details, send', false, picked && placed]
    ] : [
      ['Photo and match', this.status === 'scanning' ? 'Scanning now...' : 'Add a clear photo', scanned, !scanned],
      ['Where you found it', 'Drop the pin', scanned && placed, scanned && !placed],
      ['Alert the owner', 'Send your details', false, scanned && placed]
    ];
    return `<ol class="found-stepper glass-card" aria-label="Progress">${steps.map(([title, hint, done, active], i) =>
      `<li class="${done ? 'is-done' : ''}${active && !done ? ' is-active' : ''}"${active && !done ? ' aria-current="step"' : ''}>
        <span class="found-dot">${done ? '<i data-lucide="check"></i>' : i + 1}</span>
        <span class="found-step-text"><span class="found-step-label">${title}</span><span class="found-step-hint">${hint}</span></span>
      </li>`).join('')}</ol>`;
  }

  photoHtml() {
    const scanning = this.status === 'scanning';
    const optional = ' <span class="found-required" aria-hidden="true">*</span>';
    let body;
    if (this.photo && this.mode === 'pick') {
      // Big preview: a blurred copy of the photo fills the frame, the photo itself is shown whole on top
      body = `<div class="found-preview">
          <span class="found-preview-bg" style="background-image:url('${this.esc(this.photo)}')" aria-hidden="true"></span>
          <img class="found-preview-img" src="${this.esc(this.photo)}" alt="The pet you found" />
          <div class="found-preview-bar">
            <button type="button" class="btn btn-sm" id="found-change"><i data-lucide="image"></i> Change photo</button>
            <button type="button" class="btn btn-sm" id="found-remove"><i data-lucide="trash-2"></i> Remove</button>
          </div>
        </div>`;
    } else if (this.photo) {
      const state = this.mode === 'pick'
        ? 'Photo added. Nothing is sent yet.'
        : scanning ? 'Reading the photo...'
        : this.status === 'done' ? `${this.matches.length} similar missing ${this.matches.length === 1 ? 'pet' : 'pets'} found.`
        : this.status === 'error' ? 'The scan did not finish.' : 'Ready to scan.';
      body = `<div class="found-photo-row">
          <div class="found-photo"><img src="${this.esc(this.photo)}" alt="The pet you found" />
            ${scanning ? '<div class="found-scanline" aria-hidden="true"></div>' : ''}</div>
          <div class="found-photo-side">
            ${this.mode === 'pick' ? '' : `<span class="found-photo-state" role="status">${scanning ? '<span class="found-spinner"></span>' : '<i data-lucide="check-circle-2"></i>'}${state}</span>`}
            ${this.mode === 'scan' && this.status === 'done' ? this.statsHtml() : (this.mode === 'pick' ? '' : `<p class="found-photo-tip">${scanning ? 'This usually takes a few seconds.' : 'A clear photo of the face and body gives the best results.'}</p>`)}
            <div class="found-photo-actions">
              <button type="button" class="btn btn-outline btn-sm" id="found-change" ${scanning ? 'disabled' : ''}><i data-lucide="image"></i> Change photo</button>
              ${this.mode === 'scan' && (this.status === 'done' || this.status === 'error') ? '<button type="button" class="btn btn-outline btn-sm" id="found-scan"><i data-lucide="refresh-cw"></i> Scan again</button>' : ''}
              ${this.mode === 'pick' ? '<button type="button" class="btn btn-outline btn-sm" id="found-remove"><i data-lucide="trash-2"></i> Remove</button>' : ''}
            </div>
          </div>
        </div>`;
    } else {
      body = `<div class="found-drop" id="found-drop" tabindex="0" role="button" aria-label="Choose a photo">
          <span class="found-drop-icon"><i data-lucide="camera"></i></span>
          <span class="found-drop-text">
            <strong>Add a photo of the pet</strong>
            <p>Drop it here, or choose one. A clear photo of the face and body works best.</p>
          </span>
          <span class="found-drop-actions">
            <button type="button" class="btn btn-primary btn-sm" id="found-upload"><i data-lucide="upload"></i> Upload photo</button>
            <button type="button" class="btn btn-outline btn-sm" id="found-camera"><i data-lucide="camera"></i> Take photo</button>
          </span>
        </div>`;
    }
    return `
      <section class="glass-card found-card found-photo-card" id="found-photo-card">
        <h3 class="found-card-title"><i data-lucide="camera"></i> Photo of the pet${optional}</h3>
        ${body}
        <input type="file" id="found-file" accept="image/*" hidden />
        <input type="file" id="found-cam" accept="image/*" capture="environment" hidden />
      </section>`;
  }

  // Result numbers shown beside the photo after a scan
  statsHtml() {
    const best = this.matches.length ? `${this.matches[0].confidenceScore}%` : '-';
    const tile = (value, label) => `<div class="found-stat"><b>${value}</b><span>${label}</span></div>`;
    return `<div class="found-stats">${tile(this.matches.length, 'Similar pets')}${tile(this.checked, 'Pets checked')}${tile(best, 'Best match')}</div>`;
  }

  modeHtml() {
    const tab = (key, icon, label) => `<button type="button" class="found-mode-btn${this.mode === key ? ' is-active' : ''}" data-mode="${key}" role="tab" aria-selected="${this.mode === key}"><i data-lucide="${icon}"></i> ${label}</button>`;
    return `<div class="found-mode" role="tablist" aria-label="How do you want to find the pet?">${tab('pick', 'list', 'Choose a missing pet')}${tab('scan', 'scan-search', 'Scan a pet')}</div>`;
  }

  // Missing pets that belong to someone else. Your own are not offered: if you find your own pet, mark it safe in Pets.
  othersMissing() {
    const store = window.pawStore;
    return store.getMapPets().filter((p) => p.name && p.status === 'lost' && !store.isMyPet(p));
  }

  // The whole list of missing pets, one per row, filtered by the search box
  missingPets() {
    const q = this.query.trim().toLowerCase();
    return this.othersMissing()
      .filter((p) => !this.species || (this.species === 'Other' ? !['Dog', 'Cat'].includes(p.species) : p.species === this.species))
      .filter((p) => !q || [p.name, p.species, p.breed, p.color, p.lastSeenLocation].filter(Boolean).join(' ').toLowerCase().includes(q))
      .sort((a, b) => (new Date(b.lastSeenDate).getTime() || 0) - (new Date(a.lastSeenDate).getTime() || 0));
  }

  // A missing pet by id: a registered pet, or one reported without registering (it exists only as its report)
  missingPet(id) {
    return window.pawStore.getMapPets().find((p) => String(p.id) === String(id)) || null;
  }

  petRowInner(pet, { badge = true } = {}) {
    const seen = this.timeAgo(pet.lastSeenDate);
    return `${this.avatar(pet)}
        <span class="found-match-text">
          <span class="found-match-name"><strong>${this.esc(pet.name)}</strong>${badge && seen ? `<em class="found-missing-tag">Missing ${seen}</em>` : ''}</span>
          <span class="found-match-meta">${this.esc([pet.species, pet.breed, pet.color].filter(Boolean).join(' · '))}</span>
          <span class="found-match-meta"><i data-lucide="map-pin"></i>${this.esc(pet.lastSeenLocation || 'Last seen unknown')}</span>
        </span>`;
  }

  pickRowsHtml() {
    const pets = this.missingPets();
    if (!pets.length) {
      const any = this.othersMissing().length > 0;
      return `<div class="found-nomatch"><i data-lucide="search-x"></i><p>${any ? 'No missing pet matches your search or filter.' : 'No pets are reported missing right now.'}</p></div>`;
    }
    const limit = this.listLimit || 6;
    const shown = pets.slice(0, limit);
    const rows = shown.map((pet) => {
      const picked = String(this.selectedId) === String(pet.id);
      return `<button type="button" class="found-match${picked ? ' is-selected' : ''}" data-pet="${this.esc(pet.id)}" role="radio" aria-checked="${picked}">
        ${this.petRowInner(pet)}
        <span class="found-check" aria-hidden="true"><i data-lucide="check"></i></span>
      </button>`;
    }).join('');
    const hidden = pets.length - shown.length;
    const more = hidden > 0
      ? `<button type="button" class="found-more" id="found-more"><i data-lucide="chevron-down"></i> See more (${hidden} more)</button>`
      : (pets.length > 6 ? '<button type="button" class="found-more" id="found-less"><i data-lucide="chevron-up"></i> Show less</button>' : '');
    return rows + more;
  }

  pickHtml() {
    const total = this.othersMissing().length;
    const ownMissing = window.pawStore.getMapPets().filter((p) => p.name && p.status === 'lost' && window.pawStore.isMyPet(p)).length;
    const chosen = this.selectedId && this.selectedId !== 'none' ? this.missingPet(this.selectedId) : null;
    // Once a pet is chosen the long list folds into just that pet, so the page moves on without gaps
    if (this.selectedId && (chosen || this.selectedId === 'none')) {
      const row = chosen
        ? `<div class="found-match is-selected found-match-static">${this.petRowInner(chosen)}<span class="found-check" aria-hidden="true"><i data-lucide="check"></i></span></div>`
        : `<div class="found-match is-selected found-match-static"><span class="found-match-img found-match-blank"><i data-lucide="eye"></i></span>
            <span class="found-match-text"><span class="found-match-name"><strong>Other pet</strong></span><span class="found-match-meta">Not registered in PawTrack. It will be posted as a sighting.</span></span>
            <span class="found-check" aria-hidden="true"><i data-lucide="check"></i></span></div>`;
      return `
      <section class="glass-card found-card found-chosen">
        <div class="found-section-head">
          <h3 class="found-card-title"><i data-lucide="check-circle-2"></i> Pet you found</h3>
          <button type="button" class="btn btn-outline btn-sm" id="found-change-pet"><i data-lucide="repeat"></i> Change</button>
        </div>
        ${row}
      </section>`;
    }
    const chip = (key, label) => `<button type="button" class="found-chip${this.species === key ? ' is-active' : ''}" data-species="${key}" aria-pressed="${this.species === key}">${label}</button>`;
    return `
      <section class="glass-card found-card">
        <div class="found-section-head">
          <h3 class="found-card-title"><i data-lucide="list"></i> Which pet did you find?</h3>
          <span>${total} reported missing</span>
        </div>
        <p class="found-hint">Tap the pet you found. Newest reports are first. Not on the list? Choose Other pet.</p>
        ${ownMissing ? `<div class="found-own-note"><i data-lucide="info"></i><span>Found your own pet? It is not listed here. Open <a href="#pets">Pets</a> and mark it as safe.</span></div>` : ''}
        <div class="found-filter">
          <label class="found-search"><i data-lucide="search"></i>
            <input type="search" class="form-control" id="found-search" placeholder="Search by name, breed, color or area" value="${this.esc(this.query)}" autocomplete="off" aria-label="Search missing pets" />
          </label>
          <div class="found-chips-row">
            <div class="found-chips" role="group" aria-label="Filter by species">${chip('', 'All')}${chip('Dog', 'Dogs')}${chip('Cat', 'Cats')}${chip('Other', 'Other')}</div>
            <button type="button" class="found-other-btn" id="found-other" aria-pressed="false" title="Report a pet that is not registered in PawTrack">Other pet (not registered)</button>
          </div>
        </div>
        <div class="found-matches" id="found-pick-list" role="radiogroup" aria-label="Missing pets">${this.pickRowsHtml()}</div>
      </section>`;
  }

  mainHtml() {
    // Choosing a missing pet: the photo step appears only once a pet has been tapped
    return this.mode === 'pick' ? `${this.pickHtml()}${this.selectedId ? this.photoHtml() : ''}${this.locationHtml()}${this.alertHtml()}` : this.scanHtml();
  }

  scanHtml() {
    if (!this.photo) {
      return `<section class="glass-card found-card found-empty">
        <h3><i data-lucide="search-check"></i> How it works</h3>
        <ol class="found-how">
          <li><b>1</b><span>Upload a photo of the pet you found.</span></li>
          <li><b>2</b><span>PawTrack compares it with the pets reported missing and lists the ones that look similar.</span></li>
          <li><b>3</b><span>Pick the matching pet and send its owner your location and number.</span></li>
        </ol>
      </section>`;
    }
    if (this.status === 'scanning') return this.scanningHtml();
    if (this.status === 'error') {
      return `<section class="glass-card found-card">
        <div class="found-note is-error"><i data-lucide="alert-circle"></i><span>${this.esc(this.error)}</span></div>
        <button type="button" class="btn btn-primary btn-sm found-retry" id="found-scan"><i data-lucide="refresh-cw"></i> Try again</button>
      </section>`;
    }
    if (this.status === 'done') return `${this.resultsHtml()}${this.locationHtml()}${this.alertHtml()}`;
    return `<section class="glass-card found-card"><button type="button" class="btn btn-primary found-scan" id="found-scan"><i data-lucide="scan-search"></i> Scan for similar missing pets</button></section>`;
  }

  scanningHtml() {
    const skeleton = '<div class="found-skeleton"><span class="sk-img"></span><span class="sk-lines"><span></span><span></span></span><span class="sk-score"></span></div>';
    return `<section class="glass-card found-card" aria-busy="true">
      <div class="found-note"><span class="found-spinner"></span><span>Reading the photo, then comparing it with the pets reported missing...</span></div>
      <div class="found-skeletons">${skeleton}${skeleton}${skeleton}</div>
    </section>`;
  }

  resultsHtml() {
    const rows = this.matches.map((m, i) => {
      const pet = m.pet;
      const tone = m.confidenceScore >= 75 ? 'high' : m.confidenceScore >= 55 ? 'mid' : 'low';
      const label = tone === 'high' ? 'Strong match' : tone === 'mid' ? 'Possible match' : 'Weak match';
      const picked = String(this.selectedId) === String(pet.id);
      const seen = this.timeAgo(pet.lastSeenDate);
      return `<button type="button" class="found-match is-${tone}${picked ? ' is-selected' : ''}" data-pet="${this.esc(pet.id)}" role="radio" aria-checked="${picked}">
        ${this.avatar(pet)}
        <span class="found-match-text">
          <span class="found-match-name"><strong>${this.esc(pet.name)}</strong>${i === 0 ? '<em class="found-badge">Best match</em>' : ''}</span>
          <span class="found-match-meta">${this.esc([pet.species, pet.breed, pet.color].filter(Boolean).join(' · '))}</span>
          <span class="found-match-meta"><i data-lucide="map-pin"></i>${this.esc(pet.lastSeenLocation || 'Last seen unknown')}${seen ? ` · ${seen}` : ''}</span>
          <span class="found-bar" aria-hidden="true"><span style="width:${m.confidenceScore}%"></span></span>
        </span>
        <span class="found-score"><b>${m.confidenceScore}%</b><small>${label}</small></span>
        <span class="found-check" aria-hidden="true"><i data-lucide="check"></i></span>
      </button>`;
    }).join('');

    return `
      <section class="glass-card found-card">
        <div class="found-section-head">
          <h3 class="found-card-title">${this.matches.length ? `${this.matches.length} similar missing ${this.matches.length === 1 ? 'pet' : 'pets'}` : 'Similar missing pets'}</h3>
          <span>${this.checked} checked</span>
        </div>
        ${this.matches.length
          ? `<p class="found-hint">Tap the pet you found. Scores are estimates, so check the details.</p>
             <div class="found-matches" role="radiogroup" aria-label="Similar missing pets">${rows}</div>`
          : `<div class="found-nomatch"><i data-lucide="search-x"></i><p>${this.checked ? `None of the ${this.checked} missing pets look like this one.` : 'No pets are reported missing right now.'}</p></div>`}
        <button type="button" class="found-none${this.selectedId === 'none' ? ' is-selected' : ''}" id="found-none">
          <i data-lucide="${this.selectedId === 'none' ? 'check-circle-2' : 'circle'}"></i> None of these. Post it as a sighting instead.
        </button>
      </section>`;
  }

  alertHtml() {
    if (!this.selectedId) return '';
    const pet = this.selectedId === 'none' ? null : this.missingPet(this.selectedId);
    return `
      <section class="glass-card found-card found-alert" id="found-alert">
        <div class="found-alert-head">
          ${pet ? `${this.avatar(pet)}<div><span class="found-alert-kicker">Alert the owner of</span><h3>${this.esc(pet.name)}</h3></div>`
            : `<span class="found-match-img found-match-blank"><i data-lucide="eye"></i></span><div><span class="found-alert-kicker">No match selected</span><h3>Post a sighting</h3></div>`}
        </div>
        <form id="found-form" class="found-form" novalidate>
          ${pet ? '' : `<div class="form-group">
            <label class="form-label" for="found-species">What kind of pet is it?</label>
            <select class="form-control" id="found-species">
              ${['Dog', 'Cat', 'Other'].map((o) => `<option value="${o}"${(this.form.species || '') === o ? ' selected' : ''}>${o === 'Other' ? 'Other / not sure' : o}</option>`).join('')}
            </select>
            <small class="found-fine">Pick the closest one.</small>
          </div>
          <div class="form-group">
            <label class="form-label" for="found-pet-breed">Assumed breed * <span class="found-optional">(your best guess)</span></label>
            <input type="text" class="form-control" id="found-pet-breed" maxlength="60" placeholder="e.g. Aspin, Shih Tzu, Persian cat. A guess is fine" value="${this.esc(this.form.breed)}" autocomplete="off" />
            <small class="found-fine">Helps owners and shelters recognize the pet. A guess is fine.</small>
          </div>`}
          <div class="form-group found-wide">
            <label class="form-label" for="found-phone">Your phone number * <span class="found-optional">(so the owner can contact you)</span></label>
            <input type="tel" class="form-control" id="found-phone" placeholder="e.g. 0917 555 3829" value="${this.esc(this.form.phone)}" autocomplete="tel" />
            <small class="found-fine">${pet ? 'Only the owner sees this so they can reach you.' : 'Shared with the shelters that review sightings.'}</small>
          </div>
          <div class="form-group found-wide">
            <label class="form-label" for="found-notes">Pet condition *</label>
            <textarea class="form-control" id="found-notes" rows="2" placeholder="e.g. Healthy and friendly, small cut on the left paw, wearing a red collar">${this.esc(this.form.notes)}</textarea>
          </div>
          <div class="form-group found-wide">
            <label class="form-label" for="found-caption">Post caption <span class="found-optional">(optional)</span></label>
            <textarea class="form-control" id="found-caption" rows="2" maxlength="300" placeholder="Words for your post, e.g. Found this friendly dog near the park gate. Is he yours?">${this.esc(this.form.caption)}</textarea>
            <small class="found-fine">Shown with your post on the Sightings page.</small>
          </div>
          <label class="found-anon found-wide" for="found-anonymous">
            <input type="checkbox" id="found-anonymous" ${this.form.anonymous ? 'checked' : ''} />
            <span><strong>Report as anonymous</strong>
              <small>${this.form.anonymous ? 'Your report will show as "Community Good Samaritan".' : `Your report will show your name${this.finderName() ? ` (${this.esc(this.finderName())})` : ''}.`}</small></span>
          </label>
          <button type="submit" class="btn btn-primary found-send"><i data-lucide="send"></i> ${pet ? `This is ${this.esc(pet.name)}. Notify the owner` : 'Post the sighting'}</button>
        </form>
      </section>`;
  }

  // The signed-in guardian's name, shown on the report when it is not anonymous
  finderName() {
    const user = window.pawStore.getGoogleUser();
    return user && user.name ? String(user.name).trim() : '';
  }

  sentHtml() {
    return `
      <section class="glass-card found-card found-sent">
        <span class="found-sent-icon"><i data-lucide="check"></i></span>
        <h3>${this.sent.name ? `${this.esc(this.sent.name)}'s owner has been alerted` : 'Sighting posted'}</h3>
        <p>${this.sent.name ? 'They received your photo, location and phone number.' : 'It is now on the Incident Map and the Sightings board.'} Thank you for helping.</p>
        <div class="found-sent-actions">
          <button type="button" class="btn btn-primary" id="found-again"><i data-lucide="plus"></i> Report another pet</button>
          <button type="button" class="btn btn-outline" onclick="window.location.hash = '#owner'"><i data-lucide="map-pin"></i> See missing pets</button>
        </div>
      </section>`;
  }

  avatar(pet) {
    const photo = pet.photoUrl || pet.photo;
    return photo ? `<img class="found-match-img" src="${this.esc(photo)}" alt="" loading="lazy" />`
      : '<span class="found-match-img found-match-blank"><i data-lucide="paw-print"></i></span>';
  }

  timeAgo(iso) {
    const t = iso ? new Date(iso).getTime() : NaN;
    if (!Number.isFinite(t)) return '';
    const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (mins < 60) return `${mins || 1} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} h ago`;
    const days = Math.round(hrs / 24);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }

  // ---------- events ----------

  bind() {
    const $ = (id) => document.getElementById(id);
    $('found-place-input')?.addEventListener('input', (e) => this.searchPlace(e.target.value));
    $('found-place-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { const l = $('found-place-suggestions'); if (l) { l.style.display = 'none'; l.innerHTML = ''; } }
      if (e.key === 'Enter') { e.preventDefault(); if ((this.places || []).length) this.pickPlace(0); else this.searchPlace(e.target.value, { allowOsm: true }); }
    });
    $('found-use-location')?.addEventListener('click', () => this.useMyLocation());
    $('found-upload')?.addEventListener('click', (e) => { e.stopPropagation(); $('found-file').click(); });
    $('found-change')?.addEventListener('click', () => $('found-file').click());
    $('found-remove')?.addEventListener('click', () => { this.keepForm(); this.token++; this.photo = null; this.status = 'idle'; this.render(); });
    $('found-camera')?.addEventListener('click', (e) => { e.stopPropagation(); $('found-cam').click(); });
    ['found-file', 'found-cam'].forEach((id) => $(id)?.addEventListener('change', (e) => this.pickPhoto(e.target.files[0])));
    $('found-scan')?.addEventListener('click', () => this.scan());
    $('found-none')?.addEventListener('click', () => this.select('none'));
    $('found-other')?.addEventListener('click', () => this.select('none'));
    $('found-change-pet')?.addEventListener('click', () => { this.keepForm(); this.selectedId = null; this.render(); });
    this.bindMore();
    $('found-again')?.addEventListener('click', () => { this.reset(); this.render(); });
    $('found-anonymous')?.addEventListener('change', (e) => {
      this.form.anonymous = e.target.checked;
      const note = e.target.closest('.found-anon').querySelector('small');
      const name = this.finderName();
      if (note) note.textContent = e.target.checked ? 'Your report will show as "Community Good Samaritan".' : `Your report will show your name${name ? ` (${name})` : ''}.`;
    });
    $('found-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.send(); });
    this.container.querySelectorAll('.found-match').forEach((b) => b.addEventListener('click', () => this.select(b.dataset.pet)));
    this.container.querySelectorAll('.found-mode-btn').forEach((b) => b.addEventListener('click', () => this.setMode(b.dataset.mode)));
    $('found-search')?.addEventListener('input', (e) => { this.query = e.target.value; this.listLimit = 6; this.refreshList(); });
    this.container.querySelectorAll('.found-chip').forEach((b) => b.addEventListener('click', () => {
      this.species = b.dataset.species;
      this.listLimit = 6;
      this.container.querySelectorAll('.found-chip').forEach((c) => {
        const on = c.dataset.species === this.species;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      this.refreshList();
    }));

    const drop = $('found-drop');
    if (drop) {
      drop.addEventListener('click', () => $('found-file').click());
      drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('found-file').click(); } });
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
      drop.addEventListener('drop', (e) => this.pickPhoto(e.dataTransfer && e.dataTransfer.files[0]));
    }
  }

  // Redraws only the list, so typing in the search box keeps its focus
  refreshList() {
    const list = document.getElementById('found-pick-list');
    if (!list) return;
    list.innerHTML = this.pickRowsHtml();
    list.querySelectorAll('.found-match').forEach((b) => b.addEventListener('click', () => this.select(b.dataset.pet)));
    this.bindMore();
    if (window.lucide) window.lucide.createIcons({ root: list });
  }

  // "See more" shows six more pets; "Show less" goes back to the first six
  bindMore() {
    const more = document.getElementById('found-more');
    const less = document.getElementById('found-less');
    if (more) more.addEventListener('click', () => { this.listLimit = (this.listLimit || 6) + 6; this.refreshList(); });
    if (less) less.addEventListener('click', () => { this.listLimit = 6; this.refreshList(); });
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.keepForm();
    this.mode = mode;
    this.selectedId = null; // a choice made one way does not carry over to the other
    this.render();
  }

  select(id) {
    this.keepForm();
    this.selectedId = id;
    this.render();
    (document.getElementById('found-photo-card') || document.getElementById('found-alert'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Shrinks the photo before anything is sent or stored, then scans it straight away
  pickPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.notifManager?.showToast('Please choose an image file (JPG, PNG or WEBP).', 'warning', 3500);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const scale = Math.min(1, 768 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/jpeg', 0.85);
        // Only a real photo of a pet is accepted (scanning does its own AI check, so it only gets the quick one)
        const check = await window.petAI.checkPetPhoto(url, { ai: this.mode === 'pick', indicator: document.querySelector('.found-photo-card') });
        if (!check.ok) {
          window.notifManager?.showToast(check.reason, 'warning', 7000);
          return;
        }
        this.token++;
        this.photo = url;
        this.status = 'idle';
        this.traits = null; this.matches = []; this.description = '';
        if (this.mode === 'pick') { this.status = 'idle'; this.render(); } else { this.selectedId = null; this.scan(); }
      };
      img.onerror = () => window.notifManager?.showToast('That photo could not be opened. Try another one.', 'warning', 3500);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  async scan() {
    if (!this.photo || this.status === 'scanning') return;
    this.keepForm();
    const token = ++this.token;
    this.status = 'scanning';
    this.selectedId = null;
    this.render();
    try {
      const traits = await window.petAI.readPhoto(this.photo);
      if (token !== this.token) return;
      if (traits.isPet === false) throw new Error('No pet was detected in this photo. Try a clearer photo of the animal.');
      const { matches, checked } = window.petAI.matchMissing(traits, 50);
      this.traits = traits;
      this.matches = matches;
      this.checked = checked;
      this.status = 'done';
    } catch (err) {
      if (token !== this.token) return;
      this.status = 'error';
      this.error = err.message || 'The photo could not be scanned. Please try again.';
    }
    this.render();
  }

  // ---------- where it was found: map and pin ----------

  async initPinMap() {
    await window.PawMapsReady;
    const el = document.getElementById('found-pin-map');
    if (!el || !window.L) return;
    if (this.map) { try { this.map.remove(); } catch (e) {} this.map = null; }
    // Start on the pin already placed, else on where the chosen pet was last seen, else central Quezon City
    const pet = this.selectedId && this.selectedId !== 'none' ? this.missingPet(this.selectedId) : null;
    const start = this.pin
      || (pet && Array.isArray(pet.lastSeenCoords) ? { lat: +pet.lastSeenCoords[0], lng: +pet.lastSeenCoords[1] } : null)
      || { lat: 14.6500, lng: 121.0400 };
    this.map = window.L.map(el, { scrollWheelZoom: true, zoomControl: true, doubleClickZoom: false, cursor: 'crosshair' })
      .setView([start.lat, start.lng], this.pin ? 16 : 14);
    window.L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: '&copy; Google Maps' }).addTo(this.map);
    this.marker = window.L.marker([start.lat, start.lng], { icon: this.pinIcon(), draggable: true, autoPan: true }).addTo(this.map);
    this.marker.on('dragstart', () => { this.pinDragging = true; });
    this.marker.on('dragend', (e) => {
      const at = e.target.getLatLng();
      this.placePin(at.lat, at.lng);
      setTimeout(() => { this.pinDragging = false; }, 250); // the map also reports a click when a drag ends
    });
    this.map.on('click', (e) => {
      if (this.pinDragging) return;
      this.placePin(e.latlng.lat, e.latlng.lng);
    });
    setTimeout(() => this.map && this.map.invalidateSize(), 200);
  }

  pinIcon() {
    return window.L.divIcon({
      className: 'custom-report-pin',
      html: `<div class="pin-drop" style="position:relative; transform:translate(-50%, -100%); cursor:grab; touch-action:none; user-select:none;">
          <div style="position:absolute; inset:-14px;"></div>
          <div style="width:38px; height:38px; border-radius:50% 50% 50% 0; background:linear-gradient(135deg, #16a34a, #0f5132); transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 8px 18px rgba(0,0,0,0.45); border:2px solid #fff;">
            <svg style="transform:rotate(45deg);" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div style="width:10px; height:4px; border-radius:50%; background:rgba(0,0,0,0.4); margin:2px auto 0; filter:blur(1px);"></div>
        </div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
  }

  // The finder placed the pin. The place name comes only from the map (it is read-only): the search result's
  // name, or the address looked up for the pin, or its coordinates when no address can be found.
  async placePin(lat, lng, name = null) {
    const pin = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
    this.pin = pin;
    this.pinChosen = true;
    if (this.marker) this.marker.setLatLng([lat, lng]);
    const group = document.getElementById('found-where-group');
    if (group && group.classList.contains('has-error')) { group.classList.remove('has-error'); group.querySelector('.field-error')?.remove(); }
    const box = document.getElementById('found-location');
    if (!box) return;
    if (name) { box.value = name; return; }
    box.value = 'Finding the address...';
    const found = window.reportManager && window.reportManager.reverseGeocode ? await window.reportManager.reverseGeocode(lat, lng).catch(() => '') : '';
    if (this.pin !== pin) return; // the pin moved again while looking this one up
    // The page may have been redrawn meanwhile, so write to the field as it is now and to the saved form
    this.form.location = found || `Pinned spot (${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)})`;
    const now = document.getElementById('found-location');
    if (now) now.value = this.form.location;
  }

  // Search box above the map: live places (the same search as the report form)
  searchPlace(query, { allowOsm = false } = {}) {
    const list = document.getElementById('found-place-suggestions');
    if (!list) return;
    const q = query.trim();
    clearTimeout(this.placeTimer);
    if (q.length < 2) { list.style.display = 'none'; list.innerHTML = ''; return; }
    list.innerHTML = '<div class="report-suggestion-status">Searching places...</div>';
    list.style.display = 'block';
    this.placeTimer = setTimeout(async () => {
      let places = [];
      let failed = false;
      try { places = await searchPlaces(q, { allowOsm }); } catch (e) { failed = true; }
      const input = document.getElementById('found-place-input');
      if (!input || input.value.trim() !== q) return; // the text changed while searching
      if (places === null) { // no live search without Google: one search when Enter is pressed
        this.places = [];
        list.innerHTML = '<div class="report-suggestion-status">Press Enter to search for this place.</div>';
        return;
      }
      this.places = places;
      const pinSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary, #ea9d1e); flex-shrink:0;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
      list.innerHTML = places.length
        ? places.map((pl, i) => `<div class="report-suggestion-item" data-index="${i}">
            <div class="report-suggestion-main">${pinSvg}<span class="report-suggestion-text"><span class="report-suggestion-name">${this.esc(pl.title)}</span>${pl.subtitle ? `<span class="report-suggestion-sub">${this.esc(pl.subtitle)}</span>` : ''}</span></div>
            <span class="report-suggestion-badge">Place</span>
          </div>`).join('')
        : `<div class="report-suggestion-status">${failed ? 'Place search is not available right now. Drop the pin on the map instead.' : 'No places found. Try a street, barangay or landmark, or drop the pin on the map.'}</div>`;
      list.querySelectorAll('.report-suggestion-item').forEach((row) => row.addEventListener('click', () => this.pickPlace(+row.dataset.index)));
    }, allowOsm ? 0 : 350);
  }

  async pickPlace(i) {
    const pl = (this.places || [])[i];
    const list = document.getElementById('found-place-suggestions');
    if (!pl) return;
    if (list) { list.style.display = 'none'; list.innerHTML = ''; }
    try {
      const at = pl.lat != null ? { lat: pl.lat, lng: pl.lng, name: [pl.title, pl.subtitle].filter(Boolean).join(', ') } : await pl.resolve();
      const input = document.getElementById('found-place-input');
      if (input) input.value = at.name;
      if (this.map) this.map.setView([at.lat, at.lng], 17);
      this.placePin(at.lat, at.lng, at.name);
    } catch (e) {
      window.notifManager?.showToast('That place could not be opened. Try another result or drop the pin.', 'warning', 3500);
    }
  }

  useMyLocation() {
    const btn = document.getElementById('found-use-location');
    const toast = (msg, kind) => window.notifManager?.showToast(msg, kind, 5000);
    if (!navigator.geolocation || !window.isSecureContext) {
      toast('Your location is not available here. Tap the map to place the pin instead.', 'warning');
      return;
    }
    const busy = (on) => { if (btn) { btn.disabled = on; btn.classList.toggle('is-loading', on); btn.querySelector('span').textContent = on ? 'Finding your location…' : 'Use my current location'; } };
    busy(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      busy(false);
      const { latitude, longitude } = pos.coords;
      if (this.map) this.map.setView([latitude, longitude], 17);
      this.placePin(latitude, longitude);
    }, () => {
      busy(false);
      toast('Your location could not be found. Allow location access, or tap the map to place the pin.', 'warning');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }

  // ---------- sending ----------

  fieldError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    const group = el.closest('.form-group');
    group.classList.add('has-error');
    if (!group.querySelector('.field-error')) {
      const note = document.createElement('small');
      note.className = 'field-error';
      note.setAttribute('role', 'alert');
      group.appendChild(note);
    }
    group.querySelector('.field-error').textContent = message;
    el.addEventListener('input', () => { group.classList.remove('has-error'); group.querySelector('.field-error')?.remove(); }, { once: true });
  }

  async send() {
    this.keepForm();
    document.querySelectorAll('.found-stack .has-error').forEach((g) => { g.classList.remove('has-error'); g.querySelector('.field-error')?.remove(); });
    const { location, placedesc, phone, notes } = this.form;
    const photoCard = document.getElementById('found-photo-card');
    photoCard?.classList.remove('has-error');
    const photoMissing = !this.photo;
    if (photoMissing) photoCard?.classList.add('has-error');
    const problems = [];
    if (!this.pinChosen) problems.push(['found-pin-map', 'Drop the pin on the map where you found the pet.']);
    else if (!location.trim() || location === 'Finding the address...') problems.push(['found-location', 'Wait a moment while the address for the pin is found.']);
    if (this.selectedId === 'none' && !(this.form.breed || '').trim()) problems.push(['found-pet-breed', 'Enter your best guess of the breed, for example Aspin or Shih Tzu.']);
    if (!phone.trim()) problems.push(['found-phone', 'Add a phone number the owner can call.']);
    else if (!/^(\+?63|0)9\d{9}$/.test(phone.replace(/[\s\-().]/g, ''))) problems.push(['found-phone', 'Enter a valid Philippine mobile number, for example 0917 123 4567.']);
    if (!notes.trim()) problems.push(['found-notes', 'Describe the condition of the pet, for example if it is hurt, hungry or calm.']);
    if (problems.length || photoMissing) {
      problems.forEach(([id, msg]) => this.fieldError(id, msg));
      const targets = [...(photoMissing && photoCard ? [photoCard] : []), ...problems.map(([id]) => document.getElementById(id)).filter(Boolean)];
      targets.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      const first = targets[0];
      if (first) {
        first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (first.focus && first.matches('input, textarea, select, button')) first.focus({ preventScroll: true });
      }
      const n = problems.length + (photoMissing ? 1 : 0);
      window.notifManager?.showToast(photoMissing && n === 1 ? 'Add a current photo of the pet first.' : n === 1 ? 'One thing needs your attention.' : `${n} things need your attention.`, 'warning', 4000);
      return;
    }

    // The address from the pin, plus the finder's own description of the spot when they gave one
    const where = placedesc.trim() ? `${location.trim()} (${placedesc.trim()})` : location.trim();
    const store = window.pawStore;
    const reporter = (!this.form.anonymous && this.finderName()) || 'Community Good Samaritan';
    const pet = this.selectedId === 'none' ? null : this.missingPet(this.selectedId);
    const t = this.traits || {};
    const coords = [this.pin.lat, this.pin.lng]; // where the finder dropped the pin
    const now = new Date().toISOString();
    const comments = `Pet condition: ${notes.trim()}`;
    const evidence = this.photo || (pet && (pet.photoUrl || pet.photo)) || '';

    let alerted = false;
    try {
      store.addSighting({
        id: 'SIGHT-' + Date.now().toString().slice(-6),
        species: pet ? pet.species : (this.form.species || (t.species && t.species !== 'Unknown' ? t.species : 'Dog')),
        breed: pet ? pet.breed : (this.form.breed.trim() || (t.breed && t.breed !== 'Unknown' ? t.breed : 'Breed not specified')),
        location: where,
        coords,
        nfcTag: pet ? (pet.nfcTag || '') : '',
        reporterPhone: phone.trim(),
        reporterName: reporter,
        comments,
        caption: (this.form.caption || '').trim(),
        timestamp: now,
        confidenceScore: pet ? (this.matches.find((m) => m.pet.id === pet.id) || {}).confidenceScore || 0 : 0,
        photo: evidence,
        photoUrl: evidence,
        reportType: 'found',
        ...(pet ? { matchedPetId: pet.id } : {}),
        ...(pet && pet.missingReportId ? { missing_report_id: pet.missingReportId } : {})
      });

      if (pet) {
        // The owner (whoever filed the pet's missing report) is alerted through Supabase, on their own device
        const submitBtn = document.querySelector('#found-form .found-send');
        if (submitBtn) submitBtn.disabled = true;
        alerted = pet.missingReportId
          ? await store.notifyReporter(pet.missingReportId, 'found', { phone: phone.trim(), location: where, notes: comments })
          : false;
        if (submitBtn) submitBtn.disabled = false;
        store.addCaseTimelineEvent(pet.id, {
          type: 'sighting',
          title: 'Pet Located by Good Samaritan',
          location: where,
          finder: `${reporter} (${phone.trim()})`,
          notes: comments,
          photoUrl: evidence,
          timestamp: now
        });
      }
      // A sighting of no particular pet gets no notification: it is not about anyone's own pet
    } catch (err) {
      console.error('[Found] send failed:', err);
      window.notifManager?.showToast(`Could not send the alert: ${err.message || 'unknown error'}. Please try again.`, 'error', 6000);
      return;
    }

    if (pet && !alerted) {
      // The sighting is on the map, but the owner could not be reached (the store already explained why)
      window.notifManager?.showToast(`Your report of ${pet.name} is on the map, but the owner could not be alerted.`, 'warning', 6000);
    } else {
      window.notifManager?.showToast(pet ? `${pet.name}'s owner has been alerted.` : 'Sighting posted.', 'success', 4500);
    }
    const sent = { name: pet ? pet.name : '' };
    this.reset();
    this.sent = sent;
    this.render();
  }
}

window.foundView = new FoundView();
