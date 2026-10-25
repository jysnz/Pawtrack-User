/**
 * Step 2 of pet registration: scan an NFC tag, write the pet's page link onto it,
 * and save the pet (with the tag's unique ID) to the database.
 *
 * Web NFC (NDEFReader) only exists in Chrome on Android over HTTPS, so every other
 * device gets a "Simulate scan" button that runs the same flow without touching a tag.
 */

const PUBLIC_SITE_URL = 'https://pawtrack-user.vercel.app';
const TAG_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L lookalikes

class NfcLinkFlow {
  constructor() {
    this.draft = null;
    this.abort = null;
    this.busy = false;
    this.linking = false;
    this.done = false;
    this.mode = 'scan'; // 'scan' | 'confirm' (waiting for the overwrite answer)
    this.pending = null;
    this.approvedSerial = null;
    this.bind();
  }

  bind() {
    const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
    on('nfc-link-start', () => {
      if (this.done) this.finish();
      else if (this.mode === 'confirm') this.approveOverwrite();
      else this.startScan();
    });
    on('nfc-link-demo', () => this.simulate());
    on('nfc-link-back', () => this.back());
    on('nfc-link-close', () => this.back());
  }

  t(key, fallback, vars = {}) {
    let text = window.pawI18n ? window.pawI18n.t(key, fallback) : fallback;
    Object.keys(vars).forEach((k) => { text = text.replace(`{${k}}`, vars[k]); });
    return text;
  }

  // Public address written onto the tag. A tag programmed on localhost must still work for strangers.
  siteUrl() {
    const host = window.location.hostname;
    const local = host === 'localhost' || host === '127.0.0.1' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host);
    return local || window.location.protocol === 'file:' ? PUBLIC_SITE_URL : window.location.origin;
  }

  tagUrl(uid) {
    return `${this.siteUrl()}/?nfc=${encodeURIComponent(uid)}`;
  }

  newTagId() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return 'PT-' + Array.from(bytes, (b) => TAG_ID_ALPHABET[b % TAG_ID_ALPHABET.length]).join('');
  }

  open(draft) {
    this.draft = draft;
    this.done = false;
    this.busy = false;
    this.linking = false;
    this.mode = 'scan';
    this.pending = null;
    this.approvedSerial = null;
    if (this.abort) this.abort.abort();
    const pet = document.getElementById('nfc-link-pet');
    if (pet) {
      const photo = draft.photoUrl ? `<img src="${this.esc(draft.photoUrl)}" alt="" />` : '';
      pet.innerHTML = `${photo}<div><strong>${this.esc(draft.name)}</strong><span>${this.esc(draft.species)} &middot; ${this.esc(draft.breed)} &middot; ${this.esc(draft.age)}</span></div>`;
    }
    this.setState('idle', this.t('nfc.holdTag', 'Hold the NFC tag to the back of your phone'),
      this.t('nfc.holdTagDetail', 'Tap Start scanning, then touch the tag from your pet\'s collar to your phone.'));
    document.getElementById('nfc-link-result').hidden = true;
    this.setButtons({ start: this.t('nfc.start', 'Start scanning'), demo: true, back: true });
    document.getElementById('nfc-link-modal')?.classList.add('active');
    if (window.lucide) window.lucide.createIcons();

    // Start listening straight away (this runs inside the Next tap): while the page is scanning, Chrome keeps a
    // tag's existing link from opening, which is what happens if the tag is tapped before scanning starts
    if ('NDEFReader' in window) this.startScan(true);
  }

  esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  setState(state, headline, detail) {
    document.getElementById('nfc-radar')?.setAttribute('data-state', state);
    const h = document.getElementById('nfc-link-headline');
    const d = document.getElementById('nfc-link-detail');
    if (h) h.textContent = headline;
    if (d) d.textContent = detail || '';
  }

  setButtons({ start, demo = true, back = true, backLabel = null }) {
    const startBtn = document.getElementById('nfc-link-start');
    if (startBtn) { startBtn.textContent = start; startBtn.disabled = !start; }
    const demoBtn = document.getElementById('nfc-link-demo');
    if (demoBtn) demoBtn.style.display = demo ? '' : 'none';
    const backBtn = document.getElementById('nfc-link-back');
    if (backBtn) backBtn.style.display = back ? '' : 'none';
    const backText = backBtn && backBtn.querySelector('span');
    if (backText) backText.textContent = backLabel || this.t('nfc.back', 'Back');
  }

  back() {
    // Cancel on the overwrite question: keep the screen and go back to waiting for a tag
    if (this.mode === 'confirm' || this.approvedSerial !== null) {
      this.mode = 'scan';
      this.pending = null;
      this.approvedSerial = null;
      if (this.abort) this.abort.abort();
      this.busy = false;
      this.setState('idle', this.t('nfc.holdTag', 'Hold the NFC tag to the back of your phone'),
        this.t('nfc.holdTagDetail', 'Keep this screen open and touch the tag from your pet\'s collar to your phone. While it scans, an existing link on the tag will not open.'));
      this.setButtons({ start: this.t('nfc.start', 'Start scanning'), demo: true, back: true });
      return;
    }
    if (this.abort) this.abort.abort();
    this.busy = false;
    this.linking = false;
    document.getElementById('nfc-link-modal')?.classList.remove('active');
    if (!this.done) document.getElementById('register-pet-modal')?.classList.add('active');
  }

  finish() {
    document.getElementById('nfc-link-modal')?.classList.remove('active');
  }

  // Pulls an existing PawTrack tag ID out of whatever a tag already carries
  existingTagId(message) {
    if (!message || !message.records) return null;
    for (const record of message.records) {
      if (record.recordType !== 'url' && record.recordType !== 'text') continue;
      try {
        const text = new TextDecoder().decode(record.data);
        const match = text.match(/[?&]nfc=([A-Za-z0-9-]+)/);
        if (match) return match[1].toUpperCase();
      } catch (e) { /* unreadable record: ignore */ }
    }
    return null;
  }

  // What a tag already holds, as short readable strings (empty when the tag is blank)
  describeRecords(message) {
    const out = [];
    if (!message || !message.records) return out;
    for (const record of message.records) {
      if (record.recordType === 'empty') continue;
      let text = '';
      try {
        if (record.recordType === 'url' || record.recordType === 'text' || record.recordType === 'absolute-url') {
          text = new TextDecoder(record.encoding || 'utf-8').decode(record.data);
        }
      } catch (e) { /* undecodable: fall through to the type name */ }
      text = (text || record.mediaType || record.recordType || 'data').trim();
      out.push(text.length > 70 ? text.slice(0, 67) + '...' : text);
    }
    return out;
  }

  async startScan(auto = false) {
    if (this.busy) return;
    if (!('NDEFReader' in window)) {
      this.setState('error', this.t('nfc.unsupported', 'This device cannot read NFC tags'),
        this.t('nfc.unsupportedDetail', 'Web NFC works on Android Chrome over HTTPS. Use Simulate scan to try the flow here.'));
      this.setButtons({ start: this.t('nfc.retry', 'Scan again'), demo: true, back: true });
      return;
    }

    this.busy = true;
    this.abort = new AbortController();
    this.setState('scanning', this.t('nfc.scanning', 'Scanning... keep the tag against your phone'),
      this.t('nfc.scanningDetail', 'Do not move the tag until the scan finishes.'));
    this.setButtons({ start: '', demo: false, back: true });

    try {
      const reader = new NDEFReader();
      await reader.scan({ signal: this.abort.signal });
      reader.addEventListener('reading', (event) => this.onTagRead(event, reader));
      reader.addEventListener('readingerror', () => {
        if (this.linking) return;
        this.fail(this.t('nfc.failed', 'Could not link the tag'), this.t('nfc.unreadable', 'The tag could not be read. Hold it flat against the phone and try again.'));
      });
    } catch (err) {
      this.busy = false;
      if (auto) {
        // Permission not granted yet or no NFC: leave the Start scanning button for the user to press
        this.setState('idle', this.t('nfc.holdTag', 'Hold the NFC tag to the back of your phone'),
          this.t('nfc.holdTagDetail', 'Keep this screen open and touch the tag from your pet\'s collar to your phone. While it scans, an existing link on the tag will not open.'));
        this.setButtons({ start: this.t('nfc.start', 'Start scanning'), demo: true, back: true });
        return;
      }
      if (err && err.name === 'NotAllowedError') {
        this.fail(this.t('nfc.failed', 'Could not link the tag'), this.t('nfc.denied', 'NFC permission was denied. Allow NFC for this site and try again.'));
      } else if (err && err.name === 'AbortError') {
        // user went back
      } else {
        this.fail(this.t('nfc.failed', 'Could not link the tag'), (err && err.message) || '');
      }
    }
  }

  onTagRead(event, reader) {
    if (this.linking || !this.busy || this.mode === 'confirm') return;
    const serial = event.serialNumber || '';
    const existingUid = this.existingTagId(event.message);

    // The user approved the overwrite and is tapping the tag again so it can be written
    if (this.approvedSerial !== null) {
      if (serial !== this.approvedSerial) {
        this.setState('scanning', this.t('nfc.differentTag', 'That is a different tag'),
          this.t('nfc.differentTagDetail', 'Tap the same tag again, or press Cancel.'));
        return;
      }
      this.approvedSerial = null;
      this.link({ serial, existingUid, writer: reader, existing: [], confirmed: true });
      return;
    }

    this.link({ serial, existingUid, writer: reader, existing: this.describeRecords(event.message) });
  }

  askOverwrite(info) {
    this.pending = info;
    this.mode = 'confirm';
    this.linking = false;
    this.setState('warn', this.t('nfc.hasData', 'This tag already has data'),
      this.t('nfc.hasDataDetail', 'It currently holds: {data}. Overwrite it with the PawTrack link for {name}?',
        { data: info.existing.join(', '), name: this.draft.name }));
    this.setButtons({ start: this.t('nfc.overwrite', 'Overwrite'), demo: false, back: true, backLabel: this.t('nfc.cancel', 'Cancel') });
    if (window.nfcScanner) window.nfcScanner.playErrorBuzz();
  }

  approveOverwrite() {
    const info = this.pending;
    if (!info) return;
    this.mode = 'scan';
    this.pending = null;
    if (info.simulated || !info.writer) {
      this.link({ ...info, existing: [], confirmed: true });
      return;
    }
    // The tag has usually moved away while the question was open, so ask for one more tap before writing
    this.approvedSerial = info.serial;
    this.setState('scanning', this.t('nfc.tapAgain', 'Tap the tag again to overwrite it'),
      this.t('nfc.tapAgainDetail', 'Hold it against your phone until it finishes.'));
    this.setButtons({ start: '', demo: false, back: true, backLabel: this.t('nfc.cancel', 'Cancel') });
  }

  simulate() {
    if (this.busy) return;
    this.busy = true;
    this.setState('scanning', this.t('nfc.scanning', 'Scanning... keep the tag against your phone'), '');
    this.setButtons({ start: '', demo: false, back: false });
    const bytes = new Uint8Array(7);
    crypto.getRandomValues(bytes);
    const serial = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(':');
    setTimeout(() => { this.busy = false; this.link({ serial, existingUid: null, writer: null, simulated: true, existing: [] }); }, 900);
  }

  fail(headline, detail) {
    this.busy = false;
    this.linking = false;
    this.mode = 'scan';
    this.pending = null;
    this.approvedSerial = null;
    if (this.abort) this.abort.abort();
    this.setState('error', headline, detail);
    this.setButtons({ start: this.t('nfc.retry', 'Scan again'), demo: true, back: true });
    if (window.nfcScanner) window.nfcScanner.playErrorBuzz();
  }

  async lookupTag(uid) {
    const client = window.pawApp && window.pawApp.supabase;
    if (!client || !uid) return null;
    const { data } = await client.rpc('get_pet_by_nfc', { p_tag: uid });
    return data && data[0] ? data[0] : null;
  }

  async link({ serial, existingUid, writer, simulated = false, existing = [], confirmed = false }) {
    const draft = this.draft;
    this.busy = true;
    this.linking = true;
    this.setState('linking', this.t('nfc.linking', 'Linking tag to {name}...', { name: draft.name }),
      this.t('nfc.linkingDetail', 'Writing the pet page to the tag and saving it to the database.'));

    try {
      // A tag that already belongs to a pet must never be overwritten
      if (existingUid) {
        const owner = await this.lookupTag(existingUid);
        if (owner) {
          this.fail(this.t('nfc.taken', 'This tag is already linked to another pet'),
            this.t('nfc.takenDetail', 'Use a different tag, or unlink it from the other pet first.'));
          return;
        }
      }
      if (serial && window.pawStore.getPets().some((p) => p.nfcSerial && p.nfcSerial.toLowerCase() === serial.toLowerCase())) {
        this.fail(this.t('nfc.taken', 'This tag is already linked to another pet'),
          this.t('nfc.takenDetail', 'Use a different tag, or unlink it from the other pet first.'));
        return;
      }

      // Anything already on the tag is only replaced after the user says so
      if (existing.length && !confirmed) {
        this.askOverwrite({ serial, existingUid, writer, simulated, existing });
        return;
      }

      let saved = null;
      // A fresh ID is reused if a previous attempt wrote it to the tag but the save failed
      let uid = existingUid || this.newTagId();
      for (let attempt = 0; attempt < 3 && !saved; attempt++) {
        const url = this.tagUrl(uid);
        if (writer && !simulated) {
          await writer.write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true });
        }
        const result = await this.saveToDatabase(uid, serial);
        if (result.conflict === 'tag') { uid = this.newTagId(); continue; }
        if (result.conflict === 'serial') {
          this.fail(this.t('nfc.taken', 'This tag is already linked to another pet'),
            this.t('nfc.takenDetail', 'Use a different tag, or unlink it from the other pet first.'));
          return;
        }
        saved = { uid, url, dbId: result.dbId, photoUrl: result.photoUrl, offline: result.offline };
      }
      if (!saved) throw new Error('Could not reserve a unique tag ID');

      const pet = window.pawStore.savePet({
        ...(saved.dbId ? { id: saved.dbId } : {}),
        name: draft.name,
        species: draft.species,
        breed: draft.breed,
        gender: draft.gender,
        color: draft.color,
        age: draft.age,
        ageMonths: draft.ageMonths,
        nfcTag: saved.uid,
        nfcSerial: serial || null,
        nfcUrl: saved.url,
        microchipNo: '',
        status: 'safe',
        photoUrl: saved.photoUrl || draft.photoUrl,
        owner: draft.owner,
        registeredDate: new Date().toISOString().split('T')[0]
      });

      this.onLinked(pet, saved, simulated);
    } catch (err) {
      console.warn('[NFC link]', err);
      const denied = err && err.name === 'NotAllowedError';
      this.fail(this.t('nfc.failed', 'Could not link the tag'),
        denied ? this.t('nfc.denied', 'NFC permission was denied. Allow NFC for this site and try again.') : ((err && err.message) || ''));
    }
  }

  // Returns { dbId, photoUrl } on success, { conflict: 'tag'|'serial' } on a duplicate, { offline: true } with no session
  async saveToDatabase(uid, serial) {
    const client = window.pawApp && window.pawApp.supabase;
    if (!client) return { offline: true };
    const { data: userData } = await client.auth.getUser();
    const user = userData && userData.user;
    if (!user) return { offline: true };

    const draft = this.draft;
    const photoUrl = await this.uploadPhoto(client, uid, draft.photoUrl);
    const { data, error } = await client.from('registered_pets').insert({
      owner_id: user.id,
      name: draft.name,
      species: ['Dog', 'Cat', 'Other'].includes(draft.species) ? draft.species : 'Other',
      breed: draft.breed,
      gender: draft.gender,
      color: draft.color,
      age_months: draft.ageMonths,
      status: 'safe',
      nfc_tag: uid,
      nfc_serial: serial || null,
      photo_url: photoUrl,
      owner_name: draft.owner.name,
      owner_phone: draft.owner.phone,
      owner_email: draft.owner.email
    }).select('id').single();

    if (error) {
      if (error.code === '23505') {
        return { conflict: /serial/i.test(error.message) ? 'serial' : 'tag' };
      }
      throw new Error(error.message);
    }
    return { dbId: data.id, photoUrl };
  }

  // Keeps big base64 photos out of the pets table: shrink, then store in the public photo bucket
  async uploadPhoto(client, uid, photo) {
    if (!photo || !photo.startsWith('data:')) return photo || null;
    try {
      const blob = await this.shrink(photo, 800);
      const path = `pets/${uid}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await client.storage.from('sighting-photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (!error) return client.storage.from('sighting-photos').getPublicUrl(path).data.publicUrl;
      return await this.blobToDataUrl(await this.shrink(photo, 480));
    } catch (e) {
      return null;
    }
  }

  shrink(dataUrl, maxSide) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image conversion failed'))), 'image/jpeg', 0.8);
      };
      img.onerror = () => reject(new Error('Image could not be read'));
      img.src = dataUrl;
    });
  }

  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  onLinked(pet, saved, simulated) {
    this.done = true;
    this.busy = false;
    this.linking = false;
    if (this.abort) this.abort.abort();
    this.setState('done', this.t('nfc.done', 'Tag linked to {name}', { name: pet.name }),
      this.t('nfc.doneDetail', 'Anyone who taps this tag will open {name}\'s page and can alert you.', { name: pet.name }));
    document.getElementById('nfc-link-uid').textContent = saved.uid;
    document.getElementById('nfc-link-url').innerHTML = `<a href="${this.esc(saved.url)}" target="_blank" rel="noopener">${this.esc(saved.url.replace(/^https?:\/\//, ''))}</a>`;
    document.getElementById('nfc-link-result').hidden = false;
    this.setButtons({ start: this.t('nfc.finish', 'Done'), demo: false, back: false });

    if (window.nfcScanner) window.nfcScanner.playSuccessChirp();
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);

    // Registration is complete: clear the form behind this modal
    const form = document.getElementById('register-pet-form');
    if (form) { form.reset(); delete form.dataset.prefillNfc; }
    if (window.pawApp && window.pawApp.clearPhotoUpload) window.pawApp.clearPhotoUpload();
    document.getElementById('register-pet-modal')?.classList.remove('active');

    if (window.notifManager) {
      const note = saved.offline
        ? ' Saved on this device only: sign in again so other phones can open the tag.'
        : (simulated ? ' (demo scan, nothing was written to a tag)' : '');
      window.notifManager.showToast(`${pet.name} is registered with tag ${saved.uid}.${note}`, saved.offline ? 'warning' : 'success', 6000);
    }
  }
}

window.nfcLink = new NfcLinkFlow();
