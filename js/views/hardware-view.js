/**
 * PawTrack Hardware & Universal Smartphone NFC Collar Tag View
 */

class HardwareView {
  constructor() {
    this.tagCode = 'NFC-882194';
    this.patterns = ['paw', 'bone', 'cat'];
    this.selectedPatternIndex = 0;
    this.selectedPattern = 'paw'; // 'paw' (default signature), 'bone', 'cat'
    this.cycleInterval = null;
  }

  getPatternSvg(pattern) {
    switch (pattern) {
      case 'bone':
        return `
          <svg viewBox="0 0 100 100" class="tag-svg-emblem" fill="#121212">
            <g transform="rotate(-26 50 52)">
              <circle cx="23" cy="45" r="9.5" />
              <circle cx="23" cy="57" r="9.5" />
              <circle cx="77" cy="45" r="9.5" />
              <circle cx="77" cy="57" r="9.5" />
              <rect x="22" y="44.5" width="56" height="13" rx="2.5" />
            </g>
          </svg>
        `;
      case 'cat':
        return `
          <svg viewBox="0 0 100 100" class="tag-svg-emblem" fill="#121212">
            <path d="M 64 26 C 63 22 59 19 55 21 C 53 22 52 25 54 28 C 50 28 46 31 45 35 C 44 38 46 41 48 42 L 42 45 C 37 47 35 52 38 56 C 41 59 45 58 48 54 L 51 50 L 50 62 C 44 63 36 60 30 65 C 25 69 27 76 33 76 C 39 76 43 72 46 68 L 52 68 C 53 77 58 83 67 83 C 74 83 78 77 77 70 C 75 64 69 63 65 67 C 63 69 63 72 66 74 C 65 75 64 76 62 76 C 59 76 57 73 57 66 L 57 48 L 63 50 C 68 52 72 49 72 44 C 72 39 68 37 63 39 L 58 37 C 60 34 62 31 65 30 C 67 29 69 27 68 25 C 67 24 65 24 64 26 Z" />
          </svg>
        `;
      case 'paw':
      default:
        return `
          <svg viewBox="0 0 100 100" class="tag-svg-emblem" fill="#121212">
            <!-- 4 Raised Toe Pads -->
            <ellipse cx="23" cy="38" rx="7.5" ry="11.5" transform="rotate(-22 23 38)" />
            <ellipse cx="40.5" cy="25" rx="8" ry="12.5" transform="rotate(-7 40.5 25)" />
            <ellipse cx="59.5" cy="25" rx="8" ry="12.5" transform="rotate(7 59.5 25)" />
            <ellipse cx="77" cy="38" rx="7.5" ry="11.5" transform="rotate(22 77 38)" />
            <!-- Large Arched Palm Pad -->
            <path d="M 23 68 C 21 53 34 44.5 50 44.5 C 66 44.5 79 53 77 68 C 75 74.5 64 74 50 72 C 36 74 25 74.5 23 68 Z" />
          </svg>
        `;
    }
  }

  startCycleTimer() {
    this.stopCycleTimer();
    this.cycleInterval = setInterval(() => {
      const slot = document.getElementById('tag-emblem-slot');
      if (!slot) {
        this.stopCycleTimer();
        return;
      }
      this.selectedPatternIndex = (this.selectedPatternIndex + 1) % this.patterns.length;
      const nextPattern = this.patterns[this.selectedPatternIndex];
      this.morphToPattern(nextPattern);
    }, 3000);
  }

  stopCycleTimer() {
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.cycleInterval = null;
    }
  }

  morphToPattern(pattern) {
    this.selectedPattern = pattern;
    const slot = document.getElementById('tag-emblem-slot');
    if (!slot) return;

    slot.classList.add('tag-morph-out');
    setTimeout(() => {
      slot.innerHTML = this.getPatternSvg(pattern);
      slot.classList.remove('tag-morph-out');
      slot.classList.add('tag-morph-in');
      setTimeout(() => {
        slot.classList.remove('tag-morph-in');
      }, 350);
    }, 200);
  }

  setPattern(pattern) {
    this.selectedPattern = pattern;
    const idx = this.patterns.indexOf(pattern);
    if (idx !== -1) {
      this.selectedPatternIndex = idx;
    }
    const emblemSlot = document.getElementById('tag-emblem-slot');
    if (emblemSlot) {
      emblemSlot.innerHTML = this.getPatternSvg(pattern);
    }
  }

  render(container) {
    const t = (k, d) => (window.pawI18n ? window.pawI18n.t(k, d) : d);

    const specs = [
      { icon: 'radio', label: t('hardware.specFrequency', 'Frequency'), value: '13.56 MHz' },
      { icon: 'cpu', label: t('hardware.specChip', 'Chip'), value: 'NTAG213' },
      { icon: 'droplets', label: t('hardware.specRating', 'Water rating'), value: 'IP67' },
      { icon: 'battery-off', label: t('hardware.specPower', 'Power'), value: t('hardware.specPassive', 'Passive, no battery') }
    ];
    const steps = [
      { icon: 'tag', n: 1, title: t('hardware.card1Title', '1. NFC Collar Tag (13.56 MHz NTAG213)'), desc: t('hardware.card1Desc', 'Encapsulated inside a sealed waterproof enclosure. Features high-frequency NTAG213 NFC for citizen phone taps and 134.2 kHz FDX-B for municipal scanner reads.') },
      { icon: 'smartphone', n: 2, title: t('hardware.card2Title', '2. Smartphone NFC Tap-to-Report (No App Needed)'), desc: t('hardware.card2Desc', 'Works natively on Apple iOS and Android smartphones. Tapping the collar tag launches the PawTrack web portal and opens the report dialog with one touch.') },
      { icon: 'shield', n: 3, title: t('hardware.card3Title', '3. Standardized Impact-Resistant Enclosure'), desc: t('hardware.card3Desc', 'Unified single-design casing fabricated with durable weather-sealed PETG, reinforced steel eyelet for collar attachment, and IP67 water resistance.') },
      { icon: 'map-pin', n: 4, title: t('hardware.card4Title', '4. Recorded Checkpoint Detection (No Battery or GPS Needed)'), desc: t('hardware.card4Desc', 'Passively powered by the interrogating NFC field. Eliminates heavy batteries and satellite fees while ensuring instant identification during recovery.') }
    ];
    // The step titles carry their own "1. " prefix; the badge shows the number instead
    const stepTitle = (x) => x.title.replace(/^\s*\d+\.\s*/, '');

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <button type="button" class="hw-back" onclick="window.location.hash = 'settings'">
            <i data-lucide="arrow-left"></i><span>${t('settings.title', 'Settings')}</span>
          </button>
          <h1>${t('hardware.title', 'Universal NFC Collar Tag Specifications')}</h1>
          <div class="view-subtitle">${t('hardware.subtitle', 'Review the standardized smartphone NFC collar tag, reader architecture, and municipal pet recovery integration.')}</div>
        </div>
      </div>

      <div class="hw-layout">
        <section class="glass-card hw-stage">
          <div class="hw-eyebrow">${t('hardware.previewHeading', 'Standardized Collar Tag Prototype')}</div>

          <div class="tag-preview-wrapper">
            <div class="tag-keychain-rig">
              <div class="tag-keychain-splitring"></div>
              <div class="tag-keychain-chain">
                <div class="tag-chain-link"></div>
                <div class="tag-chain-link"></div>
              </div>
              <div class="tag-jumpring"></div>
            </div>

            <div class="tag-3d-model" id="tag-3d-preview">
              <div class="tag-hole"></div>
              <div class="tag-emboss-graphic" id="tag-emblem-slot">
                ${this.getPatternSvg(this.selectedPattern)}
              </div>
              <div class="tag-nfc-subtle-indicator">NFC</div>
            </div>
          </div>

          <div class="hw-callout">
            <div class="hw-callout-head">
              <span class="hw-callout-icon"><i data-lucide="smartphone"></i></span>
              <strong>${t('hardware.nfcPhoneTitle', 'Smartphone NFC Instant Sighting')}</strong>
            </div>
            <p>${t('hardware.nfcPhoneDesc', 'Standardized single-mold design with integrated NTAG213 NFC chip. Anyone finding the pet can simply tap their NFC-enabled smartphone against the tag to open the pet profile and report dialog instantly.')}</p>
          </div>
        </section>

        <div class="hw-side">
          <section class="glass-card hw-panel">
            <h2 class="hw-panel-title"><i data-lucide="list-checks"></i> ${t('hardware.glanceTitle', 'At a glance')}</h2>
            <div class="hw-specs">
              ${specs.map((x) => `
                <div class="hw-spec">
                  <span class="hw-spec-icon"><i data-lucide="${x.icon}"></i></span>
                  <small>${x.label}</small>
                  <strong>${x.value}</strong>
                </div>`).join('')}
            </div>
          </section>

          <section class="glass-card hw-panel">
            <h2 class="hw-panel-title"><i data-lucide="cpu"></i> ${t('hardware.archTitle', 'Hardware & Reader Architecture')}</h2>
            <ol class="hw-steps">
              ${steps.map((x) => `
                <li class="hw-step">
                  <span class="hw-step-icon"><i data-lucide="${x.icon}"></i><b>${x.n}</b></span>
                  <div>
                    <strong>${stepTitle(x)}</strong>
                    <p>${x.desc}</p>
                  </div>
                </li>`).join('')}
            </ol>

            <div class="hw-audio">
              <span>${t('hardware.audioVerify', 'Acoustic Hardware Verification')}</span>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.nfcScanner.playSuccessChirp()">
                <i data-lucide="volume-2"></i> ${t('hardware.testBeeperBtn', 'Test Reader Audio Beeper')}
              </button>
            </div>
          </section>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: container });
    this.startCycleTimer();
  }

  scanAndReport(nfcTag = 'NFC-882194') {
    if (window.nfcScanner && typeof window.nfcScanner.scanAndReportTag === 'function') {
      window.nfcScanner.scanAndReportTag(nfcTag);
    } else {
      window.location.hash = 'owner';
      setTimeout(() => {
        if (window.reportManager) {
          window.reportManager.openReportModal('found', null, { nfcTag });
        }
      }, 200);
    }
  }

  setFilament(colorHex, nameOrKey, defaultFallback) {
    // Retained for backward compatibility
    this.selectedFilament = colorHex || '#ea9d1e';
  }
}

window.hardwareView = new HardwareView();

