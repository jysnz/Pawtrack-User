/**
 * Landing page opened when someone taps a pet's NFC tag (https://site/?nfc=PT-XXXXXXXX).
 * Shows the pet's public details and lets the finder alert the owner without an account.
 * Owner contact details are never loaded here: the database only returns the public fields,
 * and the owner is reached through the notify_owner_found function.
 */

const FOUND_STRINGS = {
  en: {
    brandSub: 'NFC RECOVERY',
    loading: 'Looking up this tag...',
    unknownTitle: 'This tag is not linked to a pet yet',
    unknownText: 'We could not find a pet for this tag. If you found an animal wearing it, please contact your nearest barangay or animal pound.',
    errorTitle: 'Could not load this page',
    errorText: 'Check your connection and try again.',
    retry: 'Try again',
    registered: 'Registered',
    missing: 'Reported missing',
    impounded: 'At a shelter',
    reunited: 'Reunited',
    missingBanner: 'The owner is looking for this pet. Please notify them right away.',
    iFound: 'I found this pet',
    about: 'About {name}',
    species: 'Species', breed: 'Breed', gender: 'Gender', age: 'Age', color: 'Color & markings', registeredOn: 'Registered', area: 'Area',
    notifyTitle: 'Found {name}? Tell the owner',
    notifySub: 'The owner gets an alert straight away with where you are and how to reach you.',
    where: 'Where is the pet now?',
    useLocation: 'Use my location',
    locating: 'Locating...',
    wherePh: 'Street, landmark or barangay',
    whereErr: 'Tell us where the pet is, or use your location.',
    locDenied: 'Location is blocked. Type where you are instead.',
    phone: 'Your phone number',
    phonePh: 'e.g. 0917 123 4567',
    phoneErr: 'Enter a phone number the owner can call.',
    message: 'Message', optional: '(optional)',
    messagePh: 'Anything the owner should know',
    chipWithMe: 'The pet is with me',
    chipWandering: 'Seen wandering',
    chipInjured: 'Looks injured',
    notify: 'Notify owner',
    sending: 'Sending...',
    privacy: 'Your number is shared only with the owner. The owner\'s details stay private.',
    sentTitle: 'Owner notified',
    sentText: 'We sent {name}\'s owner your location and phone number. They will contact you soon.',
    sentWhere: 'Location', sentPhone: 'Your phone',
    tipsTitle: 'While you wait',
    tip1: 'Keep the pet safe', tip1d: 'Stay with it, or keep it somewhere calm and secure. Offer water.',
    tip2: 'Keep your phone close', tip2d: 'The owner will call or text the number you gave.',
    tip3: 'No collar tag needed to help', tip3d: 'If you cannot stay, tell the owner exactly where you left the pet.',
    sendAnother: 'Send another update',
    sendFailed: 'Could not notify the owner. Please try again.',
    privacyLink: 'Privacy', home: 'Open PawTrack',
    lang: 'TL'
  },
  tl: {
    brandSub: 'NFC RECOVERY',
    loading: 'Hinahanap ang tag na ito...',
    unknownTitle: 'Wala pang alagang naka-link sa tag na ito',
    unknownText: 'Walang nahanap na alaga para sa tag na ito. Kung may nakita kang hayop na may suot nito, makipag-ugnayan sa pinakamalapit na barangay o animal pound.',
    errorTitle: 'Hindi ma-load ang page',
    errorText: 'Tingnan ang iyong connection at subukan ulit.',
    retry: 'Subukan ulit',
    registered: 'Rehistrado',
    missing: 'Naiulat na nawawala',
    impounded: 'Nasa shelter',
    reunited: 'Nakauwi na',
    missingBanner: 'Hinahanap ng may-ari ang alagang ito. Mangyaring abisuhan sila agad.',
    iFound: 'Nakita ko ang alagang ito',
    about: 'Tungkol kay {name}',
    species: 'Uri', breed: 'Lahi', gender: 'Kasarian', age: 'Edad', color: 'Kulay at palatandaan', registeredOn: 'Nairehistro', area: 'Lugar',
    notifyTitle: 'Nakita si {name}? Sabihan ang may-ari',
    notifySub: 'Agad na makakatanggap ng alerto ang may-ari kasama ang lokasyon mo at paraan para tawagan ka.',
    where: 'Nasaan ang alaga ngayon?',
    useLocation: 'Gamitin ang lokasyon ko',
    locating: 'Hinahanap ang lokasyon...',
    wherePh: 'Kalye, landmark o barangay',
    whereErr: 'Sabihin kung nasaan ang alaga, o gamitin ang lokasyon mo.',
    locDenied: 'Naka-block ang lokasyon. I-type na lang kung nasaan ka.',
    phone: 'Iyong numero ng telepono',
    phonePh: 'hal. 0917 123 4567',
    phoneErr: 'Maglagay ng numerong matatawagan ng may-ari.',
    message: 'Mensahe', optional: '(opsyonal)',
    messagePh: 'Anumang dapat malaman ng may-ari',
    chipWithMe: 'Kasama ko ang alaga',
    chipWandering: 'Nakitang gumagala',
    chipInjured: 'Mukhang may sugat',
    notify: 'Abisuhan ang may-ari',
    sending: 'Ipinapadala...',
    privacy: 'Ang numero mo ay makikita lamang ng may-ari. Pribado ang detalye ng may-ari.',
    sentTitle: 'Naabisuhan na ang may-ari',
    sentText: 'Naipadala na namin sa may-ari ni {name} ang lokasyon at numero mo. Kokontakin ka nila agad.',
    sentWhere: 'Lokasyon', sentPhone: 'Iyong numero',
    tipsTitle: 'Habang naghihintay',
    tip1: 'Panatilihing ligtas ang alaga', tip1d: 'Samahan ito o ilagay sa tahimik at ligtas na lugar. Bigyan ng tubig.',
    tip2: 'Dalhin ang iyong phone', tip2d: 'Tatawagan o ite-text ng may-ari ang numerong ibinigay mo.',
    tip3: 'Hindi mo kailangang manatili', tip3d: 'Kung aalis ka, sabihin sa may-ari kung saan mo iniwan ang alaga.',
    sendAnother: 'Magpadala ng bagong update',
    sendFailed: 'Hindi naabisuhan ang may-ari. Subukan ulit.',
    privacyLink: 'Privacy', home: 'Buksan ang PawTrack',
    lang: 'EN'
  }
};

class FoundPage {
  constructor() {
    this.tag = '';
    this.pet = null;
    this.source = '';
    this.coords = null;
    this.sent = null;
    this.root = document.getElementById('found-page');
  }

  lang() {
    return window.pawI18n && window.pawI18n.currentLang === 'tl' ? 'tl' : 'en';
  }

  s(key, vars = {}) {
    let text = (FOUND_STRINGS[this.lang()] || FOUND_STRINGS.en)[key] || FOUND_STRINGS.en[key] || key;
    Object.keys(vars).forEach((k) => { text = text.replace(`{${k}}`, vars[k]); });
    return text;
  }

  esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  icons() {
    if (window.lucide) window.lucide.createIcons();
  }

  async show(tag) {
    this.tag = String(tag || '').trim().toUpperCase();
    this.root = document.getElementById('found-page');
    if (!this.root) return;
    document.body.classList.add('found-mode');
    this.root.hidden = false;
    window.scrollTo(0, 0);
    this.renderLoading();
    try {
      this.pet = await this.fetchPet(this.tag);
    } catch (err) {
      console.warn('[Found page]', err);
      this.renderError();
      return;
    }
    if (!this.pet) this.renderUnknown();
    else this.renderPet();
  }

  async fetchPet(tag) {
    const client = window.pawApp && window.pawApp.supabase;
    if (client) {
      const { data, error } = await client.rpc('get_pet_by_nfc', { p_tag: tag });
      if (error) throw new Error(error.message);
      if (data && data[0]) {
        this.source = 'db';
        return this.fromRow(data[0]);
      }
    }
    // Demo tags that only exist in this browser's saved data
    const local = window.pawStore && window.pawStore.getPetByNFC(tag);
    if (local) {
      this.source = 'local';
      return this.fromLocal(local);
    }
    return null;
  }

  formatAge(months) {
    if (months == null || months === '') return '';
    const m = Number(months);
    if (!Number.isFinite(m)) return '';
    if (m < 12) return `${m} ${m === 1 ? 'month' : 'months'}`;
    const years = Math.floor(m / 12);
    const rest = m % 12;
    const y = `${years} ${years === 1 ? 'year' : 'years'}`;
    return rest ? `${y} ${rest} mo` : y;
  }

  fromRow(r) {
    return {
      name: r.name, species: r.species, breed: r.breed, gender: r.gender, color: r.color,
      age: this.formatAge(r.age_months), status: r.status, photo: r.photo_url,
      registered: r.registered_on, area: r.community
    };
  }

  fromLocal(p) {
    return {
      name: p.name, species: p.species, breed: p.breed, gender: p.gender, color: p.color,
      age: p.age || '', status: p.status || 'safe', photo: p.photoUrl,
      registered: p.registeredDate, area: p.community || ''
    };
  }

  chrome(inner, withSticky = false) {
    return `
      <header class="fp-top">
        <a class="fp-brand" href="./" aria-label="PawTrack">
          <i data-lucide="paw-print"></i>
          <span>PawTrack<small>${this.s('brandSub')}</small></span>
        </a>
        <button type="button" class="fp-lang" id="fp-lang">${this.s('lang')}</button>
      </header>
      ${inner}
      ${withSticky ? `<div class="fp-sticky"><button type="button" class="fp-btn fp-btn-primary fp-btn-block" id="fp-sticky-cta"><i data-lucide="heart-handshake"></i>${this.s('iFound')}</button></div>` : ''}`;
  }

  mount(html, withSticky = false) {
    this.root.innerHTML = this.chrome(html, withSticky);
    this.root.querySelector('#fp-lang')?.addEventListener('click', () => {
      if (window.pawI18n) window.pawI18n.toggleLanguage();
      this.rerender();
    });
    this.icons();
  }

  rerender() {
    if (this.sent) this.renderPet(true);
    else if (this.pet) this.renderPet();
    else if (this.pet === null) this.renderUnknown();
  }

  renderLoading() {
    this.mount(`<div class="fp-state"><div class="fp-spinner" role="status" aria-label="${this.s('loading')}"></div><p>${this.s('loading')}</p></div>`);
  }

  renderUnknown() {
    this.mount(`<div class="fp-state">
      <div class="fp-state-icon"><i data-lucide="tag"></i></div>
      <h1>${this.s('unknownTitle')}</h1>
      <p>${this.s('unknownText')}</p>
      <a class="fp-btn" href="./">${this.s('home')}</a>
    </div>`);
  }

  renderError() {
    this.mount(`<div class="fp-state">
      <div class="fp-state-icon"><i data-lucide="wifi-off"></i></div>
      <h1>${this.s('errorTitle')}</h1>
      <p>${this.s('errorText')}</p>
      <button type="button" class="fp-btn fp-btn-primary" id="fp-retry">${this.s('retry')}</button>
    </div>`);
    this.root.querySelector('#fp-retry')?.addEventListener('click', () => this.show(this.tag));
  }

  statusInfo(status) {
    if (status === 'missing') return { label: this.s('missing'), cls: 'is-missing', icon: 'siren' };
    if (status === 'impounded') return { label: this.s('impounded'), cls: '', icon: 'building-2' };
    if (status === 'reunited') return { label: this.s('reunited'), cls: '', icon: 'heart' };
    return { label: this.s('registered'), cls: '', icon: 'shield-check' };
  }

  fact(label, value, icon, wide = false) {
    if (!value) return '';
    return `<div class="fp-fact${wide ? ' wide' : ''}"><dt><i data-lucide="${icon}"></i>${label}</dt><dd>${this.esc(value)}</dd></div>`;
  }

  renderPet(showSent = false) {
    const p = this.pet;
    const st = this.statusInfo(p.status);
    const photo = p.photo
      ? `<img src="${this.esc(p.photo)}" alt="${this.esc(p.name)}" />`
      : `<div style="height:100%;display:grid;place-items:center;color:var(--primary)"><i data-lucide="paw-print" style="width:64px;height:64px"></i></div>`;
    const registered = p.registered ? new Date(p.registered).toLocaleDateString([], { dateStyle: 'medium' }) : '';

    const html = `
      <main class="fp-main">
        <section class="fp-hero">
          <div class="fp-photo">
            ${photo}
            <span class="fp-status ${st.cls}"><i data-lucide="${st.icon}"></i>${st.label}</span>
            <div class="fp-headline">
              <h1>${this.esc(p.name)}</h1>
              <p>${this.esc([p.breed, p.species].filter(Boolean).join(' · '))}</p>
            </div>
          </div>
          <div class="fp-hero-cta">
            <button type="button" class="fp-btn fp-btn-primary fp-btn-block" id="fp-scroll-cta"><i data-lucide="heart-handshake"></i>${this.s('iFound')}</button>
          </div>
        </section>

        ${p.status === 'missing' ? `<div class="fp-banner" role="alert"><i data-lucide="triangle-alert"></i><div>${this.s('missingBanner')}</div></div>` : ''}

        <section class="fp-card">
          <h2>${this.s('about', { name: this.esc(p.name) })}</h2>
          <dl class="fp-facts">
            ${this.fact(this.s('species'), p.species, 'paw-print')}
            ${this.fact(this.s('breed'), p.breed, 'dna')}
            ${this.fact(this.s('gender'), p.gender, 'venus-and-mars')}
            ${this.fact(this.s('age'), p.age, 'cake')}
            ${this.fact(this.s('color'), p.color, 'palette', true)}
            ${this.fact(this.s('area'), p.area, 'map-pin')}
            ${this.fact(this.s('registeredOn'), registered, 'calendar-check')}
          </dl>
        </section>

        <section class="fp-card fp-notify" id="fp-notify">
          ${showSent && this.sent ? this.sentHtml() : this.formHtml()}
        </section>

        <section class="fp-card">
          <h2>${this.s('tipsTitle')}</h2>
          <div class="fp-tips">
            ${[1, 2, 3].map((n) => `<div class="fp-tip"><span class="fp-tip-num">${n}</span><div><strong>${this.s('tip' + n)}</strong>${this.s('tip' + n + 'd')}</div></div>`).join('')}
          </div>
        </section>

        <p class="fp-foot"><a href="privacy.html">${this.s('privacyLink')}</a> &middot; <a href="./">${this.s('home')}</a></p>
      </main>`;

    this.mount(html, !showSent);
    this.bindPet();
  }

  formHtml() {
    const name = this.esc(this.pet.name);
    return `
      <h2>${this.s('notifyTitle', { name })}</h2>
      <p class="fp-sub">${this.s('notifySub')}</p>
      <form id="fp-form" novalidate>
        <div class="fp-msg" id="fp-msg" role="alert" hidden></div>
        <div class="fp-field" id="fp-where-field">
          <label for="fp-where">${this.s('where')}</label>
          <div class="fp-locate-row">
            <input id="fp-where" type="text" autocomplete="street-address" placeholder="${this.s('wherePh')}" maxlength="300" />
            <button type="button" class="fp-btn fp-btn-icon" id="fp-locate" title="${this.s('useLocation')}" aria-label="${this.s('useLocation')}"><i data-lucide="locate-fixed"></i></button>
          </div>
          <span class="fp-error" id="fp-where-err">${this.s('whereErr')}</span>
        </div>
        <div class="fp-field" id="fp-phone-field">
          <label for="fp-phone">${this.s('phone')}</label>
          <input id="fp-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="${this.s('phonePh')}" maxlength="30" />
          <span class="fp-error" id="fp-phone-err">${this.s('phoneErr')}</span>
        </div>
        <div class="fp-field">
          <span class="fp-label">${this.s('message')} <span class="fp-opt">${this.s('optional')}</span></span>
          <div class="fp-chips">
            ${['chipWithMe', 'chipWandering', 'chipInjured'].map((k) => `<button type="button" class="fp-chip" aria-pressed="false" data-chip="${this.esc(this.s(k))}">${this.s(k)}</button>`).join('')}
          </div>
          <textarea id="fp-notes" maxlength="800" placeholder="${this.s('messagePh')}"></textarea>
        </div>
        <button type="submit" class="fp-btn fp-btn-primary fp-btn-block" id="fp-submit"><i data-lucide="bell-ring"></i>${this.s('notify')}</button>
        <p class="fp-privacy"><i data-lucide="lock"></i><span>${this.s('privacy')}</span></p>
      </form>`;
  }

  sentHtml() {
    return `
      <div class="fp-success">
        <div class="fp-check"><i data-lucide="check"></i></div>
        <h2>${this.s('sentTitle')}</h2>
        <p>${this.s('sentText', { name: this.esc(this.pet.name) })}</p>
        <div class="fp-sent">
          <div><b>${this.s('sentWhere')}:</b> ${this.esc(this.sent.location)}</div>
          <div><b>${this.s('sentPhone')}:</b> ${this.esc(this.sent.phone)}</div>
        </div>
        <button type="button" class="fp-btn" id="fp-again">${this.s('sendAnother')}</button>
      </div>`;
  }

  bindPet() {
    const root = this.root;
    const toForm = () => {
      const card = root.querySelector('#fp-notify');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => root.querySelector('#fp-where')?.focus({ preventScroll: true }), 450);
    };
    root.querySelector('#fp-scroll-cta')?.addEventListener('click', toForm);
    root.querySelector('#fp-sticky-cta')?.addEventListener('click', toForm);
    root.querySelector('#fp-again')?.addEventListener('click', () => { this.sent = null; this.coords = null; this.renderPet(); toForm(); });
    root.querySelector('#fp-locate')?.addEventListener('click', () => this.locate());
    root.querySelector('#fp-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });
    root.querySelectorAll('.fp-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const on = chip.getAttribute('aria-pressed') !== 'true';
        chip.setAttribute('aria-pressed', String(on));
        const notes = root.querySelector('#fp-notes');
        const text = chip.getAttribute('data-chip');
        if (!notes) return;
        if (on && !notes.value.includes(text)) notes.value = (notes.value ? notes.value.trim() + '. ' : '') + text;
        if (!on) notes.value = notes.value.replace(text, '').replace(/^[\s.]+|[\s.]+$/g, '').replace(/\.\s*\./g, '.');
      });
    });
  }

  msg(text) {
    const box = this.root.querySelector('#fp-msg');
    if (!box) return;
    box.textContent = text || '';
    box.hidden = !text;
  }

  locate() {
    const btn = this.root.querySelector('#fp-locate');
    const input = this.root.querySelector('#fp-where');
    if (!navigator.geolocation || !input) return;
    btn.disabled = true;
    input.placeholder = this.s('locating');
    navigator.geolocation.getCurrentPosition((pos) => {
      this.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      input.value = `My current location (${this.coords.lat.toFixed(5)}, ${this.coords.lng.toFixed(5)})`;
      input.placeholder = this.s('wherePh');
      this.root.querySelector('#fp-where-field')?.classList.remove('has-error');
      btn.disabled = false;
    }, () => {
      input.placeholder = this.s('wherePh');
      btn.disabled = false;
      this.msg(this.s('locDenied'));
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  async submit() {
    const root = this.root;
    const location = root.querySelector('#fp-where').value.trim();
    const phone = root.querySelector('#fp-phone').value.trim();
    let notes = root.querySelector('#fp-notes').value.trim();

    const whereOk = location.length >= 2;
    const phoneOk = phone.replace(/\D/g, '').length >= 7;
    root.querySelector('#fp-where-field').classList.toggle('has-error', !whereOk);
    root.querySelector('#fp-phone-field').classList.toggle('has-error', !phoneOk);
    if (!whereOk || !phoneOk) {
      root.querySelector(!whereOk ? '#fp-where' : '#fp-phone').focus();
      return;
    }

    if (this.coords) {
      notes = `${notes}${notes ? ' ' : ''}Map: https://maps.google.com/?q=${this.coords.lat},${this.coords.lng}`;
    }

    this.msg('');
    const btn = root.querySelector('#fp-submit');
    btn.disabled = true;
    btn.textContent = this.s('sending');

    try {
      await this.notifyOwner({ location, phone, notes });
      this.sent = { location, phone };
      this.renderPet(true);
      if (window.nfcScanner) window.nfcScanner.playSuccessChirp();
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      root.querySelector('#fp-notify')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.warn('[Found page] notify failed', err);
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="bell-ring"></i>${this.s('notify')}`;
      this.icons();
      this.msg((err && err.message) || this.s('sendFailed'));
    }
  }

  async notifyOwner({ location, phone, notes }) {
    if (this.source === 'db') {
      const client = window.pawApp.supabase;
      const { data, error } = await client.rpc('notify_owner_found', {
        p_tag: this.tag, p_phone: phone, p_location: location, p_notes: notes || null
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error(this.s('unknownTitle'));
      this.addMapSighting(client, location, notes);
      return;
    }

    // Tags that only exist in this browser: record the sighting and alert the local owner
    const pet = window.pawStore.getPetByNFC(this.tag);
    const now = new Date().toISOString();
    window.pawStore.addSighting({
      id: 'SIGHT-' + Date.now().toString().slice(-6),
      species: this.pet.species, breed: this.pet.breed, location,
      nfcTag: this.tag, reporterPhone: phone, reporterName: 'Community Good Samaritan',
      comments: notes, timestamp: now, reportType: 'found', photo: this.pet.photo, photoUrl: this.pet.photo,
      coords: this.coords ? [this.coords.lat, this.coords.lng] : undefined
    });
    window.pawStore.addNotification({
      id: 'notif-match-' + Date.now(),
      title: `GOOD SAMARITAN FOUND YOUR PET: "${this.pet.name.toUpperCase()}"!`,
      message: `Your pet was found near ${location}. Finder phone: ${phone}. ${notes}`,
      type: 'pet_found_match', petId: pet && pet.id, petName: this.pet.name, nfcTag: this.tag,
      finderName: 'Community Good Samaritan', finderPhone: phone, finderNotes: notes, location
    });
  }

  // Drops a pin on the public incident map; best effort, the owner alert is what matters
  addMapSighting(client, location, notes) {
    if (!this.coords) return;
    client.from('community_sightings').insert({
      species: ['Dog', 'Cat', 'Other'].includes(this.pet.species) ? this.pet.species : 'Dog',
      breed: this.pet.breed || null,
      color: this.pet.color || null,
      photo_url: /^https:\/\//.test(this.pet.photo || '') ? this.pet.photo : null,
      location: location.slice(0, 300),
      lat: this.coords.lat,
      lng: this.coords.lng,
      seen_at: new Date().toISOString(),
      notes: (notes || '').slice(0, 1000) || null,
      reporter_name: 'NFC tag scan',
      status: 'possible_sighting'
    }).then(({ error }) => { if (error) console.warn('[Found page] map pin skipped:', error.message); });
  }
}

window.foundPage = new FoundPage();
