/**
 * PawTrack Report Manager - Interactive Pin-Drop Map & Lost/Found Pet Reporting
 */

const PRESET_LOCATIONS = [
  // Quezon City Congressional Districts (Primary Presets)
  { name: 'District 1 (La Loma / SFDM / Project 6)', lat: 14.6380, lng: 121.0150, group: 'QC District 1' },
  { name: 'District 2 (Commonwealth / Batasan / Payatas)', lat: 14.6850, lng: 121.0850, group: 'QC District 2' },
  { name: 'District 3 (Cubao / Katipunan / Loyola / Eastwood)', lat: 14.6200, lng: 121.0530, group: 'QC District 3' },
  { name: 'District 4 (Diliman / Tomas Morato / UP / New Manila)', lat: 14.6538, lng: 121.0685, group: 'QC District 4' },
  { name: 'District 5 (Novaliches / Fairview / Lagro)', lat: 14.7180, lng: 121.0350, group: 'QC District 5' },
  { name: 'District 6 (Tandang Sora / Balintawak / Culiat)', lat: 14.6750, lng: 121.0350, group: 'QC District 6' },

  // District 1 - Barangays & Hubs
  { name: 'QC - La Loma / Calavite (Lechon Capital)', lat: 14.6310, lng: 121.0020, group: 'QC District 1' },
  { name: 'QC - San Francisco del Monte (SFDM / Frisco)', lat: 14.6430, lng: 121.0180, group: 'QC District 1' },
  { name: 'QC - Project 6 / Mindanao Ave / Road 8', lat: 14.6650, lng: 121.0300, group: 'QC District 1' },
  { name: 'QC - Santa Mesa Heights / Banawe', lat: 14.6280, lng: 121.0040, group: 'QC District 1' },
  { name: 'QC - Sto. Domingo / Quezon Ave', lat: 14.6260, lng: 121.0090, group: 'QC District 1' },
  { name: 'QC - Balingasa / Balintawak Cloverleaf', lat: 14.6570, lng: 121.0020, group: 'QC District 1' },
  { name: 'QC - Del Monte / Siena', lat: 14.6390, lng: 121.0120, group: 'QC District 1' },
  { name: 'QC - Veterans Village / Project 7', lat: 14.6550, lng: 121.0220, group: 'QC District 1' },

  // District 2 - Barangays & Hubs
  { name: 'QC - Commonwealth Market / Don Fabian', lat: 14.6930, lng: 121.0880, group: 'QC District 2' },
  { name: 'QC - Batasan Hills / Sandiganbayan / Congress', lat: 14.6890, lng: 121.0920, group: 'QC District 2' },
  { name: 'QC - Payatas / Litex / Lupang Pangako', lat: 14.7050, lng: 121.1080, group: 'QC District 2' },
  { name: 'QC - Holy Spirit / BF Homes QC', lat: 14.6780, lng: 121.0760, group: 'QC District 2' },
  { name: 'QC - Bagong Silangan / San Mateo River', lat: 14.6990, lng: 121.1120, group: 'QC District 2' },

  // District 3 - Barangays & Hubs
  { name: 'QC - Cubao / Araneta City / Gateway', lat: 14.6200, lng: 121.0530, group: 'QC District 3' },
  { name: 'QC - Eastwood City / Cyberpark / Libis', lat: 14.6090, lng: 121.0800, group: 'QC District 3' },
  { name: 'QC - Loyola Heights / Katipunan / Ateneo', lat: 14.6390, lng: 121.0770, group: 'QC District 3' },
  { name: 'QC - Project 2 & 3 / Anonas / Kamias', lat: 14.6280, lng: 121.0620, group: 'QC District 3' },
  { name: 'QC - Project 4 / J.P. Rizal / Quirino', lat: 14.6230, lng: 121.0710, group: 'QC District 3' },
  { name: 'QC - Matandang Balara / Old Balara', lat: 14.6620, lng: 121.0780, group: 'QC District 3' },
  { name: 'QC - Blue Ridge / St. Ignatius', lat: 14.6150, lng: 121.0690, group: 'QC District 3' },
  { name: 'QC - Socorro / 15th Avenue', lat: 14.6180, lng: 121.0600, group: 'QC District 3' },

  // District 4 - Barangays & Hubs
  { name: 'QC - Quezon Memorial Circle / City Hall', lat: 14.6500, lng: 121.0400, group: 'QC District 4' },
  { name: 'QC - Diliman / UP Campus / Sunken Garden', lat: 14.6538, lng: 121.0685, group: 'QC District 4' },
  { name: 'QC - Tomas Morato / Timog / Scout Area', lat: 14.6342, lng: 121.0375, group: 'QC District 4' },
  { name: 'QC - South Triangle / ABS-CBN / GMA Network', lat: 14.6400, lng: 121.0370, group: 'QC District 4' },
  { name: 'QC - New Manila / E. Rodriguez / Broadway', lat: 14.6190, lng: 121.0300, group: 'QC District 4' },
  { name: 'QC - Kamuning / Judge Jimenez', lat: 14.6300, lng: 121.0410, group: 'QC District 4' },
  { name: 'QC - Teachers Village / Maginhawa Food Street', lat: 14.6480, lng: 121.0610, group: 'QC District 4' },
  { name: 'QC - Sikatuna Village / V. Luna', lat: 14.6400, lng: 121.0550, group: 'QC District 4' },
  { name: 'QC - Phil-Am / West Avenue', lat: 14.6470, lng: 121.0280, group: 'QC District 4' },
  { name: 'QC - Central / East Avenue / Heart Center', lat: 14.6440, lng: 121.0480, group: 'QC District 4' },
  { name: 'QC - Krus na Ligas / C.P. Garcia', lat: 14.6490, lng: 121.0700, group: 'QC District 4' },

  // District 5 - Barangays & Hubs
  { name: 'QC - Fairview / Regalado / SM City Fairview', lat: 14.7330, lng: 121.0580, group: 'QC District 5' },
  { name: 'QC - Novaliches Proper / Quirino Highway', lat: 14.7180, lng: 121.0350, group: 'QC District 5' },
  { name: 'QC - Greater Lagro / Ascension Church', lat: 14.7250, lng: 121.0690, group: 'QC District 5' },
  { name: 'QC - San Bartolome / Holy Cross', lat: 14.7080, lng: 121.0380, group: 'QC District 5' },
  { name: 'QC - North Fairview / Commonwealth Ave', lat: 14.7150, lng: 121.0620, group: 'QC District 5' },
  { name: 'QC - Gulod / Forest Hills', lat: 14.7120, lng: 121.0290, group: 'QC District 5' },
  { name: 'QC - Santa Monica / Dumalay', lat: 14.7210, lng: 121.0420, group: 'QC District 5' },
  { name: 'QC - Nagkaisang Nayon / General Luis', lat: 14.7190, lng: 121.0180, group: 'QC District 5' },

  // District 6 - Barangays & Hubs
  { name: 'QC - Tandang Sora / Banlat / Himlayang Pilipino', lat: 14.6750, lng: 121.0450, group: 'QC District 6' },
  { name: 'QC - Culiat / Salam Mosque / Union Square', lat: 14.6650, lng: 121.0540, group: 'QC District 6' },
  { name: 'QC - Baesa / Quirino Highway / Mendez', lat: 14.6680, lng: 121.0120, group: 'QC District 6' },
  { name: 'QC - Sangandaan / Project 8 / Seminary', lat: 14.6720, lng: 121.0220, group: 'QC District 6' },
  { name: 'QC - Pasong Tamo / Pingkian', lat: 14.6850, lng: 121.0550, group: 'QC District 6' },
  { name: 'QC - Talipapa / Solville', lat: 14.6890, lng: 121.0320, group: 'QC District 6' },
  { name: 'QC - Sauyo / Don Julio', lat: 14.6980, lng: 121.0420, group: 'QC District 6' },
  { name: 'QC - Unang Sigaw / Balintawak MRT', lat: 14.6580, lng: 121.0050, group: 'QC District 6' }
];


// Live place search for the location boxes (report form and sighting form): Google Places (New) when Google Maps
// is loaded, otherwise OpenStreetMap Nominatim. Covers the whole Philippines, biased toward Metro Manila.
// Each result is { title, subtitle } plus either lat/lng or resolve(), which looks up the place's position.
// OpenStreetMap's usage policy does not allow search-as-you-type, so without Google this returns null (no live
// results) unless allowOsm is set, which callers do only when the person presses Enter.
async function searchPlaces(query, { allowOsm = false } = {}) {
  if (document.documentElement.classList.contains('google-maps-active') && window.google && google.maps && google.maps.importLibrary) {
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await google.maps.importLibrary('places');
      searchPlaces.token = searchPlaces.token || new AutocompleteSessionToken();
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: searchPlaces.token,
        includedRegionCodes: ['ph'],
        locationBias: { center: { lat: 14.6, lng: 121.03 }, radius: 50000 }
      });
      return suggestions.filter((sg) => sg.placePrediction).slice(0, 6).map(({ placePrediction: pr }) => {
        const title = pr.mainText ? pr.mainText.text : pr.text.text;
        const subtitle = pr.secondaryText ? pr.secondaryText.text : '';
        return {
          title,
          subtitle,
          resolve: async () => {
            const place = pr.toPlace();
            await place.fetchFields({ fields: ['location'] });
            searchPlaces.token = null; // picking a place ends the autocomplete session
            return { lat: place.location.lat(), lng: place.location.lng(), name: [title, subtitle].filter(Boolean).join(', ') };
          }
        };
      });
    } catch (err) {
      console.warn('[Places] Google search failed:', err.message);
    }
  }
  if (!allowOsm) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ph&limit=6&viewbox=120.85,14.85,121.25,14.35&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((r) => {
    const parts = String(r.display_name || '').split(',').map((x) => x.trim());
    return { title: parts[0], subtitle: parts.slice(1, 3).join(', '), lat: +r.lat, lng: +r.lon };
  });
}

class ReportManager {
  constructor() {
    this.currentType = 'found'; // 'found' or 'missing'
    this.currentViewMode = 'map'; // 'map' or 'upload'
    this.uploadedPhotoData = null;
    this.pinnedLat = 14.6500;
    this.pinnedLng = 121.0400;
    this.pinnedLocationName = 'Quezon City, Metro Manila';
    this.map = null;
    this.marker = null;
    this.currentMapType = 'roadmap'; // 'roadmap', 'satellite', 'hybrid', 'dark'
    this.currentTileLayer = null;
    this.currentSuggestions = [];
    this.selectedSuggestionIndex = -1;

    // Sighting modal state
    this.sightingViewMode = 'map'; // 'map' or 'upload'
    this.sightingMapType = 'roadmap'; // 'roadmap', 'satellite', 'hybrid', 'dark'
    this.sightingTileLayer = null;
    this.sightingPhotoData = null;
    this.sightingMap = null;
    this.sightingMarker = null;
    this.sightingPinnedLat = 14.6500;
    this.sightingPinnedLng = 121.0400;
    this.sightingSuggestions = [];
    this.selectedSightingSuggestionIndex = -1;

    // Attach global click handler to dismiss location suggestions
    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('report-location-search-wrap');
      if (wrap && !wrap.contains(e.target)) {
        this.hideSuggestions();
      }
      const sightingWrap = document.getElementById('sighting-location-search-wrap');
      if (sightingWrap && !sightingWrap.contains(e.target)) {
        this.hideSightingSuggestions();
      }
    });
  }

  // The report form is a page (#report). Opening it fills the form, then moves to that page.
  openReportModal(type = 'missing', petId = null, prefill = {}) {
    if (!document.getElementById('report-pet-modal')) return;
    this.prepareForm(type, petId, prefill);
    const here = window.location.hash.replace('#', '');
    if (here && here !== 'report') this.returnHash = here;
    if (here === 'report') window.reportPageView.render(document.getElementById('app-viewport'));
    else window.location.hash = 'report';
  }

  prepareForm(type = 'missing', petId = null, prefill = {}) {
    type = 'missing'; // this form only reports missing pets; there is no found-pet tab any more
    this.currentType = type;
    this.formReady = true;
    this.pinChosen = false; // set once the owner places the pin (map tap, drag, search pick or current location)
    document.querySelectorAll('input[name="report-whose"]').forEach((r) => { r.checked = false; });

    // Every new report starts with an empty post caption, not the last one that was sent
    ['report-missing-caption', 'report-found-caption'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
    this.removeUploadedPhoto(false);
    this.setType(type);
    this.setViewMode('map');
    this.populatePetsDropdown(petId);
    this.populateFoundPetsDropdown(petId);
    this.showKnownPet(type === 'missing' ? petId : null);
    this.fillMissingPhone();

    if (prefill && prefill.nfcTag && window.pawStore) {
      const matched = window.pawStore.getPetByNFC(prefill.nfcTag);
      if (matched) {
        petId = matched.id;
        this.populatePetsDropdown(petId);
        this.populateFoundPetsDropdown(petId);
      }
      const nfcInput = document.getElementById('report-found-nfc');
      if (nfcInput) nfcInput.value = prefill.nfcTag;
    }
    if (prefill && prefill.location) {
      const locInput = document.getElementById('report-found-location');
      if (locInput) locInput.value = prefill.location;
    }

    const missingDateInput = document.getElementById('report-missing-date');
    if (missingDateInput && !missingDateInput.value) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      missingDateInput.value = now.toISOString().slice(0, 16);
    }

  }

  // Leaves the report page and goes back to where the person came from
  closeModal() {
    this.formReady = false;
    this.toggleInstructionGuide(false);
    if (window.location.hash !== '#report') return;
    const back = this.returnHash && this.returnHash !== 'report' ? this.returnHash : 'pets';
    this.returnHash = null;
    window.location.hash = back;
  }

  toggleInstructionGuide(forceState = null) {
    const panel = document.getElementById('report-instructions-panel');
    const helpBtn = document.getElementById('report-help-btn');
    if (!panel) return;

    const isOpen = forceState !== null ? forceState : (panel.style.display === 'none' || !panel.style.display);
    panel.style.display = isOpen ? 'block' : 'none';

    if (isOpen) {
      this.updateInstructionsContent();
      if (helpBtn) helpBtn.classList.add('active');
    } else {
      if (helpBtn) helpBtn.classList.remove('active');
    }
  }

  updateInstructionsContent() {
    const content = document.getElementById('report-instructions-content');
    const titleEl = document.getElementById('report-instructions-title');
    if (!content) return;

    const t = (k, d) => (window.pawI18n ? window.pawI18n.t(k, d) : d);

    if (this.currentType === 'found') {
      if (titleEl) {
        titleEl.textContent = t('report.guideFoundTitle', 'How to Report a Found Pet (Step-by-Step)');
        titleEl.setAttribute('data-i18n', 'report.guideFoundTitle');
      }
      content.innerHTML = `
        <div class="report-step-card">
          <div class="report-step-num">1</div>
          <div class="report-step-content">
            <strong data-i18n="report.step1FoundTitle">${t('report.step1FoundTitle', 'Pin Sighting Location')}</strong>
            <p data-i18n="report.step1FoundDesc">${t('report.step1FoundDesc', 'Tap or drag the map pin to mark where you saw or secured the stray pet.')}</p>
          </div>
        </div>
        <div class="report-step-card">
          <div class="report-step-num">2</div>
          <div class="report-step-content">
            <strong data-i18n="report.step2FoundTitle">${t('report.step2FoundTitle', 'Take or Upload Photo')}</strong>
            <p data-i18n="report.step2FoundDesc">${t('report.step2FoundDesc', 'Switch to "Upload" to attach a clear picture for AI image matching.')}</p>
          </div>
        </div>
        <div class="report-step-card">
          <div class="report-step-num">3</div>
          <div class="report-step-content">
            <strong data-i18n="report.step3FoundTitle">${t('report.step3FoundTitle', 'Tap Phone to Collar Tag')}</strong>
            <p data-i18n="report.step3FoundDesc">${t('report.step3FoundDesc', 'Tap your smartphone to the pet\'s NFC collar tag to connect and report instantly.')}</p>
          </div>
        </div>
        <div class="report-step-card">
          <div class="report-step-num">4</div>
          <div class="report-step-content">
            <strong data-i18n="report.step4FoundTitle">${t('report.step4FoundTitle', 'Submit & Notify Guardian')}</strong>
            <p data-i18n="report.step4FoundDesc">${t('report.step4FoundDesc', 'Click "Submit and Notify" — the owner and municipal shelters receive instant alerts.')}</p>
          </div>
        </div>
      `;
    } else {
      if (titleEl) {
        titleEl.textContent = t('report.guideMissingTitle', 'How to Broadcast a Missing Pet Alert (Step-by-Step)');
        titleEl.setAttribute('data-i18n', 'report.guideMissingTitle');
      }
      content.innerHTML = `
        <div class="report-step-card">
          <div class="report-step-num">1</div>
          <div class="report-step-content">
            <strong data-i18n="report.step1MissingTitle">${t('report.step1MissingTitle', 'Select Registered Pet')}</strong>
            <p data-i18n="report.step1MissingDesc">${t('report.step1MissingDesc', 'Choose your registered pet from the list or enter pet name and description.')}</p>
          </div>
        </div>
        <div class="report-step-card">
          <div class="report-step-num">2</div>
          <div class="report-step-content">
            <strong data-i18n="report.step2MissingTitle">${t('report.step2MissingTitle', 'Pin Last Seen Location')}</strong>
            <p data-i18n="report.step2MissingDesc">${t('report.step2MissingDesc', 'Mark the exact street, barangay, or park where your pet was last seen.')}</p>
          </div>
        </div>
        <div class="report-step-card">
          <div class="report-step-num">3</div>
          <div class="report-step-content">
            <strong data-i18n="report.step3MissingTitle">${t('report.step3MissingTitle', 'Attach / Upload Pet Photo')}</strong>
            <p data-i18n="report.step3MissingDesc">${t('report.step3MissingDesc', 'Switch to "Upload" tab to attach a clear, recent picture for AI community matching.')}</p>
          </div>
        </div>
        <div class="report-step-card">
          <div class="report-step-num">4</div>
          <div class="report-step-content">
            <strong data-i18n="report.step4MissingTitle">${t('report.step4MissingTitle', 'Broadcast Emergency Alert')}</strong>
            <p data-i18n="report.step4MissingDesc">${t('report.step4MissingDesc', 'Click "Broadcast Missing Alert" to post on the live Incident Map and notify all patrols.')}</p>
          </div>
        </div>
      `;
    }
  }

  // The hint over the map tells people to drag the pin
  updateMapHelper() {
    const key = this.currentType === 'missing' ? 'report.mapHelperMissing' : 'report.mapHelper';
    const fallback = this.currentType === 'missing' ? 'Drag the pin to where your pet was last seen' : 'Tap or drag pin to mark exact location';
    const helper = document.querySelector('#report-map-view-container .report-map-overlay-helper span');
    if (helper) {
      helper.textContent = window.pawI18n ? window.pawI18n.t(key, fallback) : fallback;
      helper.setAttribute('data-i18n', key);
    }
  }

  setViewMode(mode) {
    this.currentViewMode = mode;
    const mapBtn = document.getElementById('report-mode-map-btn');
    const uploadBtn = document.getElementById('report-mode-upload-btn');
    const mapContainer = document.getElementById('report-map-view-container');
    const uploadContainer = document.getElementById('report-upload-view-container');
    const headerTitle = document.getElementById('report-header-title');

    if (mode === 'map') {
      if (mapBtn) mapBtn.classList.add('active');
      if (uploadBtn) uploadBtn.classList.remove('active');
      if (mapContainer) mapContainer.style.display = 'flex';
      if (uploadContainer) uploadContainer.style.display = 'none';
      if (headerTitle) {
        const key = this.currentType === 'missing' ? 'report.lastSeenHeader' : 'report.pinnedLoc';
        const fallback = this.currentType === 'missing' ? 'Last seen location' : 'Pinned Location:';
        headerTitle.textContent = window.pawI18n ? window.pawI18n.t(key, fallback) : fallback;
        headerTitle.setAttribute('data-i18n', key);
      }
      this.updateMapHelper();
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 80);
    } else {
      if (uploadBtn) uploadBtn.classList.add('active');
      if (mapBtn) mapBtn.classList.remove('active');
      if (mapContainer) mapContainer.style.display = 'none';
      if (uploadContainer) uploadContainer.style.display = 'flex';
      if (headerTitle) {
        headerTitle.textContent = window.pawI18n ? window.pawI18n.t('report.photoHeader', 'Pet Photo:') : 'Pet Photo:';
        headerTitle.setAttribute('data-i18n', 'report.photoHeader');
      }
    }
  }

  setType(type) {
    this.currentType = type;
    const tabFound = document.getElementById('report-tab-found');
    const tabMissing = document.getElementById('report-tab-missing');
    const fieldsFound = document.getElementById('report-fields-found');
    const fieldsMissing = document.getElementById('report-fields-missing');
    const submitBtn = document.getElementById('report-submit-btn');
    const submitLabel = document.getElementById('report-submit-label');
    const modalTitle = document.getElementById('report-modal-title');
    const modalSub = document.getElementById('report-modal-sub');
    const modeToggle = document.getElementById('report-view-mode-toggle');

    if (modeToggle) modeToggle.style.display = type === 'missing' ? 'none' : 'flex';
    if (type === 'missing') this.setViewMode('map');

    if (type === 'found') {
      tabFound?.classList.add('active');
      tabMissing?.classList.remove('active');
      if (fieldsFound) fieldsFound.style.display = ''; // stylesheet decides (grid on phones)
      if (fieldsMissing) fieldsMissing.style.display = 'none';

      // Set HTML5 required on Found fields, unset on Missing fields
      const foundPet = document.getElementById('report-found-pet-select');
      const foundSpecies = document.getElementById('report-found-species');
      const foundBreed = document.getElementById('report-found-breed');
      const foundLoc = document.getElementById('report-found-location');
      const foundPhone = document.getElementById('report-found-phone');
      if (foundPet) foundPet.required = true;
      if (foundSpecies) foundSpecies.required = true;
      if (foundBreed) foundBreed.required = true;
      if (foundLoc) foundLoc.required = true;
      if (foundPhone) foundPhone.required = true;

      const missingPet = document.getElementById('report-missing-pet-select');
      const missingCustom = document.getElementById('report-missing-custom-name');
      const missingLoc = document.getElementById('report-missing-location');
      const missingDate = document.getElementById('report-missing-date');
      const missingPhone = document.getElementById('report-missing-phone');
      if (missingPet) missingPet.required = false;
      if (missingCustom) missingCustom.required = false;
      if (missingLoc) missingLoc.required = false;
      if (missingDate) missingDate.required = false;
      if (missingPhone) missingPhone.required = false;

      if (modalTitle) {
        modalTitle.textContent = window.pawI18n ? window.pawI18n.t('report.modalTitleFound', 'Found this pet?') : 'Found this pet?';
        modalTitle.setAttribute('data-i18n', 'report.modalTitleFound');
      }
      if (modalSub) {
        modalSub.textContent = window.pawI18n ? window.pawI18n.t('report.modalSubFound', 'Drop a pin at the spot where you found the pet, add a quick note if you\'d like, and notify the owner.') : 'Drop a pin at the spot where you found the pet, add a quick note if you\'d like, and notify the owner.';
        modalSub.setAttribute('data-i18n', 'report.modalSubFound');
      }
      if (submitLabel) {
        submitLabel.textContent = window.pawI18n ? window.pawI18n.t('report.btnSubmitFound', 'Submit and Notify') : 'Submit and Notify';
        submitLabel.setAttribute('data-i18n', 'report.btnSubmitFound');
      }
      if (submitBtn) {
        submitBtn.className = 'btn btn-primary';
      }
      this.populateFoundPetsDropdown(foundPet?.value || null);
    } else {
      tabMissing?.classList.add('active');
      tabFound?.classList.remove('active');
      if (fieldsFound) fieldsFound.style.display = 'none';
      if (fieldsMissing) fieldsMissing.style.display = ''; // stylesheet decides (grid on phones)

      // Set HTML5 required on Missing fields, unset on Found fields
      const foundPet = document.getElementById('report-found-pet-select');
      const foundSpecies = document.getElementById('report-found-species');
      const foundBreed = document.getElementById('report-found-breed');
      const foundLoc = document.getElementById('report-found-location');
      const foundPhone = document.getElementById('report-found-phone');
      if (foundPet) foundPet.required = false;
      if (foundSpecies) foundSpecies.required = false;
      if (foundBreed) foundBreed.required = false;
      if (foundLoc) foundLoc.required = false;
      if (foundPhone) foundPhone.required = false;

      const missingPet = document.getElementById('report-missing-pet-select');
      const missingCustom = document.getElementById('report-missing-custom-name');
      const missingLoc = document.getElementById('report-missing-location');
      const missingDate = document.getElementById('report-missing-date');
      const missingPhone = document.getElementById('report-missing-phone');
      if (missingPet) missingPet.required = true;
      if (missingCustom) missingCustom.required = missingPet?.value === 'custom' || missingPet?.value === 'unregistered';
      if (missingLoc) missingLoc.required = true;
      if (missingDate) missingDate.required = true;
      if (missingPhone) missingPhone.required = true;

      if (modalTitle) {
        modalTitle.textContent = window.pawI18n ? window.pawI18n.t('report.modalTitleMissing', 'Report a missing pet') : 'Report a missing pet';
        modalTitle.setAttribute('data-i18n', 'report.modalTitleMissing');
      }
      if (modalSub) {
        modalSub.textContent = window.pawI18n ? window.pawI18n.t('report.modalSubMissing', 'Drop a pin where the pet was last seen, attach a photo, and broadcast an emergency alert to shelters and public map.') : 'Drop a pin where the pet was last seen, attach a photo, and broadcast an emergency alert to shelters and public map.';
        modalSub.setAttribute('data-i18n', 'report.modalSubMissing');
      }
      if (submitLabel) {
        submitLabel.textContent = window.pawI18n ? window.pawI18n.t('report.btnMissingAlert', 'Missing Alert') : 'Missing Alert';
        submitLabel.setAttribute('data-i18n', 'report.btnMissingAlert');
      }
      if (submitBtn) {
        submitBtn.className = 'btn btn-danger';
      }
      this.populatePetsDropdown(missingPet?.value || null);
      this.updateMissingPhotoStatus();
    }

    this.setViewMode(this.currentViewMode || 'map');

    const panel = document.getElementById('report-instructions-panel');
    if (panel && panel.style.display !== 'none') {
      this.updateInstructionsContent();
    }

    if (this.marker) {
      this.updatePinIcon();
    }
  }

  populatePetsDropdown(selectedPetId = null) {
    const select = document.getElementById('report-missing-pet-select');
    if (!select) return;

    const registeredLabel = window.pawI18n ? window.pawI18n.t('report.registered', 'Registered') : 'Registered';
    const unregisteredLabel = window.pawI18n ? window.pawI18n.t('report.unregistered', 'Unregistered') : 'Unregistered';

    const pets = (window.pawStore ? window.pawStore.getPets() : []).filter((p) => p.name && p.status !== 'lost');
    let options = '';

    const isCustomSelected = selectedPetId === 'custom' || selectedPetId === 'unregistered';

    if (pets && pets.length > 0) {
      const firstAvailable = pets[0];
      const targetPetId = (!isCustomSelected && selectedPetId) ? String(selectedPetId) : (!isCustomSelected ? String(firstAvailable.id) : null);

      pets.forEach((p, idx) => {
        const isSelected = !isCustomSelected && (targetPetId === String(p.id) || (!targetPetId && idx === 0));
        options += `<option value="${p.id}" ${isSelected ? 'selected' : ''}>${registeredLabel}: ${p.name} (${p.breed || p.species})</option>`;
      });

      options += `<option value="custom" ${isCustomSelected ? 'selected' : ''}>${unregisteredLabel}</option>`;
      select.innerHTML = options;

      const activeVal = select.value || (isCustomSelected ? 'custom' : pets[0].id);
      this.handlePetSelect(activeVal);
    } else {
      options += `<option value="custom" selected>${unregisteredLabel}</option>`;
      select.innerHTML = options;

      this.handlePetSelect('custom');
    }
  }

  // Opened for a specific pet: show it instead of asking which pet is missing
  showKnownPet(petId) {
    const wrap = document.getElementById('report-missing-pet-select-wrap');
    const card = document.getElementById('report-missing-pet-card');
    if (!wrap || !card) return;
    const pet = petId && petId !== 'custom' && petId !== 'unregistered' && window.pawStore ? window.pawStore.getPetById(petId) : null;
    if (!pet) {
      wrap.style.display = '';
      card.hidden = true;
      card.innerHTML = '';
      return;
    }
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const photo = pet.photoUrl || pet.photo;
    card.innerHTML = `${photo ? `<img src="${esc(photo)}" alt="" />` : ''}
      <div><span class="report-pet-card-label">Reporting missing</span><strong>${esc(pet.name)}</strong>
      <small>${esc([pet.breed, pet.species].filter(Boolean).join(' · '))}</small></div>`;
    const select = document.getElementById('report-missing-pet-select');
    if (select) select.value = String(pet.id);
    wrap.style.display = 'none';
    card.hidden = false;
  }

  // The emergency contact starts as the number registered on the account
  fillMissingPhone() {
    const input = document.getElementById('report-missing-phone');
    const user = window.pawStore && window.pawStore.getGoogleUser();
    if (input && user && user.phone && !input.value.trim()) input.value = user.phone;
  }

  // Pets as photo chips (a native list cannot show pictures); the hidden select keeps the value
  escHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  petAvatarHtml(pet) {
    const photo = pet.photoUrl || pet.photo;
    return photo ? `<img class="pet-pick-img" src="${this.escHtml(photo)}" alt="" loading="lazy" decoding="async" />`
      : '<span class="pet-pick-img pet-pick-blank"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.5c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-6 2c1.38 0 2.5-1.12 2.5-2.5S7.38 7.5 6 7.5 3.5 8.62 3.5 10s1.12 2.5 2.5 2.5zm12 0c1.38 0 2.5-1.12 2.5-2.5S19.38 7.5 18 7.5s-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zM12 12c-2.76 0-5 2.24-5 5 0 2.21 1.79 4 4 4 1.1 0 2-.9 2-2 0 1.1.9 2 2 2 2.21 0 4-1.79 4-4 0-2.76-2.24-5-5-5z"/></svg></span>';
  }

  // The picker shows a few pets as cards; with more than that, "See all" opens a list with one pet per row
  renderPetPicker() {
    const picker = document.getElementById('report-missing-pet-picker');
    const select = document.getElementById('report-missing-pet-select');
    if (!picker || !select) return;
    const esc = (v) => this.escHtml(v);
    // A pet with no name cannot be picked, and a pet already reported missing is not offered again
    const pets = (window.pawStore ? window.pawStore.getPets() : []).filter((p) => p.name && p.status !== 'lost');
    const current = select.value;
    const plus = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    const check = '<svg class="pet-pick-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 12 10 17 19 7"/></svg>';
    const card = ({ value, name, sub = '', sub2 = '', img, selected = false, notes = [], disabled = false, other = false, action = '' }) =>
      `<button type="button" class="pet-pick${selected ? ' is-selected' : ''}${other ? ' is-other' : ''}" ${action ? `data-action="${action}"` : `role="radio" aria-checked="${selected}" data-value="${esc(value)}"`} ${disabled ? 'disabled' : ''} title="${esc(name)}">
        ${img}
        <span class="pet-pick-text"><span class="pet-pick-name">${esc(name)}</span>${sub ? `<span class="pet-pick-sub">${esc(sub)}</span>` : ''}${sub2 ? `<span class="pet-pick-sub">${esc(sub2)}</span>` : ''}${notes.map((n) => `<span class="pet-pick-badge">${esc(n)}</span>`).join('')}</span>
        ${selected ? check : ''}
      </button>`;
    const petCard = (p) => card({
      value: p.id,
      name: p.name,
      sub: [p.species, p.breed].filter(Boolean).join(' · '),
      sub2: [p.color, p.age].filter(Boolean).join(' · '),
      notes: [p.nfcTag ? 'NFC linked' : 'No NFC'],
      img: this.petAvatarHtml(p),
      selected: String(current) === String(p.id)
    });

    // Many pets: show the first few (and always the chosen one); "See all" shows the rest
    const LIMIT = 4;
    let shown = pets;
    let toggle = '';
    if (pets.length > LIMIT) {
      if (!this.petPickerAll) {
        shown = pets.slice(0, LIMIT);
        const chosen = pets.find((p) => String(p.id) === String(current));
        if (chosen && !shown.includes(chosen)) shown = [...pets.slice(0, LIMIT - 1), chosen];
        toggle = `<button type="button" class="pet-pick pet-pick-more" data-action="more"><span class="pet-pick-text"><span class="pet-pick-name">See all pets (${pets.length - shown.length} more)</span></span></button>`;
      } else {
        toggle = '<button type="button" class="pet-pick pet-pick-more" data-action="less"><span class="pet-pick-text"><span class="pet-pick-name">Show fewer pets</span></span></button>';
      }
    }
    picker.innerHTML = shown.map(petCard).join('') + toggle
      + card({
        value: 'custom',
        name: 'Another pet',
        sub: 'Not registered in PawTrack',
        img: `<span class="pet-pick-img pet-pick-other">${plus}</span>`,
        selected: current === 'custom' || current === 'unregistered',
        other: true
      });
    picker.querySelectorAll('.pet-pick-more').forEach((btn) => {
      btn.addEventListener('click', () => { this.petPickerAll = btn.dataset.action === 'more'; this.renderPetPicker(); });
    });
    picker.querySelectorAll('.pet-pick:not(.pet-pick-more)').forEach((btn) => {
      btn.addEventListener('click', () => {
        select.value = btn.dataset.value;
        this.handlePetSelect(select.value);
      });
    });
  }

  handlePetSelect(petId) {
    const customWrap = document.getElementById('report-missing-custom-name-wrap');
    const customInput = document.getElementById('report-missing-custom-name');
    const isUnregistered = petId === 'custom' || petId === 'unregistered';

    const select = document.getElementById('report-missing-pet-select');
    if (select && select.value !== String(petId) && petId) select.value = String(petId);
    this.renderPetPicker();
    // A registered pet with no NFC tag cannot be identified by a tap: its owner must add a current photo and describe its condition
    const chosen = !isUnregistered && petId && window.pawStore
      ? window.pawStore.getPets().find(p => String(p.id) === String(petId)) : null;
    const noNfc = !!chosen && !chosen.nfcTag;
    this.missingNoNfc = noNfc;
    const conditionWrap = document.getElementById('report-missing-condition-wrap');
    const conditionInput = document.getElementById('report-missing-condition');
    // Every registered pet needs its current condition, tagged or not: finders and shelters read it first
    const registeredPick = !!chosen || isUnregistered; // registered or "Another pet"
    const descWrap = document.getElementById('report-missing-desc-wrap');
    if (descWrap) descWrap.style.display = registeredPick ? '' : 'none';
    if (conditionWrap) {
      conditionWrap.style.display = registeredPick ? '' : 'none';
      const hint = conditionWrap.querySelector('small');
      if (hint) hint.textContent = isUnregistered
        ? 'Tell finders how the pet looked and behaved before it went missing, so they know what to look for.'
        : noNfc
          ? 'This pet has no NFC tag, so a recent photo and how it looked before it went missing help others recognise it.'
          : 'Tell finders how your pet looked and behaved before it went missing, so they know what to look for.';
    }
    if (conditionInput) {
      conditionInput.required = registeredPick;
      if (!registeredPick) conditionInput.value = '';
    }
    const photoLabel = document.getElementById('report-missing-photo-label');
    if (photoLabel) photoLabel.textContent = 'Current photo of the pet *';

    // Registered pets with a tag already have their photo on file; unregistered and untagged pets need one uploaded
    const photoRow = document.getElementById('report-missing-photo-row');
    if (photoRow) photoRow.style.display = ''; // always shown, and always a new photo: never the pet's profile photo
    let photoChanged = false;
    if (this._photoFor !== String(petId)) { this.removeUploadedPhoto(false); this._photoFor = String(petId); photoChanged = true; } // keep a photo already added for this pet
    const photoHint = document.querySelector('#report-missing-photo-row .report-photo-hint');
    if (photoHint) photoHint.textContent = chosen
      ? "Your pet's registered photo is used. Change it if you have a newer one."
      : 'Add a clear photo of the pet so others can recognise it.';

    const customDesc = document.getElementById('report-missing-custom-desc');
    if (isUnregistered) {
      if (customWrap) customWrap.style.display = 'block';
      if (customInput) customInput.required = true;
      if (customDesc) {
        customDesc.required = true;
        if (this._descFor !== 'custom') { customDesc.value = ''; this._descFor = 'custom'; }
      }
      this.updateMissingPhotoStatus(null, false);
    } else {
      if (customWrap) customWrap.style.display = 'none';
      if (customDesc) {
        // Written by the owner for this report: never prefilled (not even from the pet's saved description)
        customDesc.required = !!chosen;
        if (this._descFor !== String(petId)) { customDesc.value = ''; this._descFor = String(petId); }
      }
      if (customInput) {
        customInput.required = false;
        customInput.value = '';
      }
      const customSpeciesEl = document.getElementById('report-missing-custom-species');
      if (customSpeciesEl) customSpeciesEl.value = '';
      if (petId && petId !== 'registered' && window.pawStore) {
        const pets = window.pawStore.getPets();
        const pet = pets.find(p => String(p.id) === String(petId));
        if (pet) {
          // The last-seen location is not copied from the pet's previous incident: a new disappearance
          // needs a new spot, and the old one was often just the map's default pin
          const profilePhoto = pet.photoUrl || pet.photo;
          if (photoChanged && profilePhoto) {
            this.applyUploadedPhoto(profilePhoto); // already checked when the pet was registered
            this.updateMissingPhotoStatus(pet.name, true);
          } else {
            this.updateMissingPhotoStatus(null, false);
          }
        }
      } else if (petId === 'registered' && window.pawStore) {
        const pets = window.pawStore.getPets();
        if (pets && pets.length > 0) {
          this.updateMissingPhotoStatus(null, false);
        }
      } else {
        this.updateMissingPhotoStatus(null, false);
      }
    }
  }

  populateFoundPetsDropdown(selectedPetId = null) {
    const select = document.getElementById('report-found-pet-select');
    if (!select) return;

    const registeredLabel = window.pawI18n ? window.pawI18n.t('report.registered', 'Registered') : 'Registered';
    const unregisteredLabel = window.pawI18n ? window.pawI18n.t('report.unregistered', 'Unregistered') : 'Unregistered';

    const pets = window.pawStore ? window.pawStore.getPets() : [];
    let options = '';

    const isCustomSelected = selectedPetId === 'custom' || selectedPetId === 'unregistered';

    if (pets && pets.length > 0) {
      const targetPetId = (!isCustomSelected && selectedPetId) ? String(selectedPetId) : (!isCustomSelected ? String(pets[0].id) : null);

      pets.forEach((p, idx) => {
        const isSelected = !isCustomSelected && (targetPetId === String(p.id) || (!targetPetId && idx === 0));
        options += `<option value="${p.id}" ${isSelected ? 'selected' : ''}>${registeredLabel}: ${p.name} (${p.breed || p.species} - ${p.nfcTag})</option>`;
      });

      options += `<option value="unregistered" ${isCustomSelected ? 'selected' : ''}>${unregisteredLabel}</option>`;
      select.innerHTML = options;

      const activeVal = select.value || (isCustomSelected ? 'unregistered' : pets[0].id);
      this.handleFoundPetSelect(activeVal);
    } else {
      options += `<option value="registered" ${!isCustomSelected ? 'selected' : ''}>${registeredLabel}</option>`;
      options += `<option value="unregistered" ${isCustomSelected ? 'selected' : ''}>${unregisteredLabel}</option>`;
      select.innerHTML = options;

      this.handleFoundPetSelect(isCustomSelected ? 'unregistered' : 'registered');
    }
  }

  handleFoundPetSelect(petId) {
    const isUnregistered = petId === 'custom' || petId === 'unregistered';
    const speciesSelect = document.getElementById('report-found-species');
    const breedInput = document.getElementById('report-found-breed');
    const nfcInput = document.getElementById('report-found-nfc');

    if (isUnregistered) {
      if (nfcInput && !nfcInput.dataset.manual) {
        nfcInput.value = '';
      }
    } else {
      if (petId && petId !== 'registered' && window.pawStore) {
        const pets = window.pawStore.getPets();
        const pet = pets.find(p => String(p.id) === String(petId));
        if (pet) {
          if (speciesSelect && pet.species) {
            speciesSelect.value = (pet.species === 'Cat' ? 'Cat' : pet.species === 'Dog' ? 'Dog' : 'Other');
          }
          if (breedInput && pet.breed) {
            breedInput.value = pet.breed;
          }
          if (nfcInput && pet.nfcTag) {
            nfcInput.value = pet.nfcTag;
          }
          // The photo is not set here: it belongs to the pet chosen in the missing-pet list above
        }
      } else if (petId === 'registered' && window.pawStore) {
        const pets = window.pawStore.getPets();
        if (pets && pets.length > 0) {
          const pet = pets[0];
          if (speciesSelect && pet.species) speciesSelect.value = (pet.species === 'Cat' ? 'Cat' : pet.species === 'Dog' ? 'Dog' : 'Other');
          if (breedInput && pet.breed) breedInput.value = pet.breed;
          if (nfcInput && pet.nfcTag) nfcInput.value = pet.nfcTag;
        }
      }
    }
  }

  updateMissingPhotoStatus(petName = null, isRegistered = false) {
    const statusText = document.getElementById('report-missing-photo-status-text');
    const statusBtn = document.getElementById('report-missing-photo-status-btn');
    if (!statusText) return;

    if (this.uploadedPhotoData) {
      statusText.textContent = isRegistered && petName ? `${petName}'s profile photo` : 'Photo added';
      statusText.dataset.state = 'ok';
      statusText.style.color = '';
      if (statusBtn) statusBtn.textContent = 'Change';
    } else {
      statusText.textContent = 'No photo yet';
      statusText.dataset.state = 'empty';
      statusText.style.color = '';
      if (statusBtn) statusBtn.textContent = 'Upload photo';
    }
  }

  async initPinMap() {
    await window.PawMapsReady;
    const container = document.getElementById('report-pin-map');
    if (!container || !window.L) return;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.map = window.L.map('report-pin-map', {
      scrollWheelZoom: true,
      zoomControl: true,
      doubleClickZoom: false,
      cursor: 'crosshair'
    }).setView([this.pinnedLat, this.pinnedLng], 13);

    // Set initial Google Maps tile layer
    this.setMapLayer(this.currentMapType || 'roadmap');

    // Create custom draggable pin
    const pinIcon = this.createPinIcon();
    this.marker = window.L.marker([this.pinnedLat, this.pinnedLng], {
      icon: pinIcon,
      draggable: true,
      autoPan: true
    }).addTo(this.map);

    const mapEl = () => document.getElementById('report-pin-map');
    this.marker.on('dragstart', () => {
      mapEl()?.classList.add('is-pin-dragging');
      this.pinDragging = true;
    });
    this.marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      mapEl()?.classList.remove('is-pin-dragging');
      this.updatePinnedCoords(pos.lat, pos.lng);
      // The map also reports a click when a drag ends; ignore that one so the pin is not dropped twice
      setTimeout(() => { this.pinDragging = false; }, 250);
    });

    this.map.on('click', (e) => {
      if (this.pinDragging) return;
      this.updatePinnedCoords(e.latlng.lat, e.latlng.lng);
      if (this.marker) {
        this.marker.setLatLng(e.latlng);
        this.marker.setIcon(this.createPinIcon()); // replays the drop animation
      }
    });

    // Place the pin without writing the default spot into the location fields: the owner must pick where the
    // pet was last seen, otherwise every report silently got the default pin's address and coordinates
    const locationIds = ['report-location-search-input', 'report-missing-location', 'report-found-location'];
    const before = locationIds.map(id => (document.getElementById(id) || {}).value || '');
    this.updatePinnedCoords(this.pinnedLat, this.pinnedLng);
    this.pinChosen = false;
    locationIds.forEach((id, i) => { const el = document.getElementById(id); if (el) el.value = before[i]; });
    const clearBtn = document.getElementById('report-search-clear-btn');
    if (clearBtn && !before[0]) clearBtn.style.display = 'none';
    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 200);
  }

  setMapLayer(type) {
    if (!this.map || !window.L) return;
    this.currentMapType = type;

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    let tileUrl;
    let tileOptions = {
      maxZoom: 20,
      attribution: '&copy; Google Maps / OpenStreetMap contributors'
    };

    if (type === 'satellite') {
      // High-resolution Photographic Earth Imagery (Actual real place view)
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      tileOptions.attribution = '&copy; Esri World Imagery & Maxar Earth';
    } else if (type === 'hybrid') {
      // Google Hybrid (Satellite with Street Overlays)
      tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      tileOptions.attribution = '&copy; Google Maps Hybrid Imagery';
    } else if (type === 'dark') {
      // Night / Dark Theme
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      tileOptions.attribution = '&copy; CARTO & OpenStreetMap';
    } else {
      // Google Roadmap
      tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      tileOptions.attribution = '&copy; Google Maps';
    }

    this.currentTileLayer = window.L.tileLayer(tileUrl, tileOptions);
    this.currentTileLayer.on('tileerror', () => {
      if (this.currentMapType !== 'fallback') {
        this.currentMapType = 'fallback';
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap & CARTO',
          maxZoom: 19
        }).addTo(this.map);
      }
    });

    this.currentTileLayer.addTo(this.map);

    const dock = document.getElementById('report-map-layer-dock');
    if (dock) {
      dock.querySelectorAll('.gmap-layer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${type}'`));
      });
    }
  }

  locateMe() {
    this.useMyLocation('report');
  }

  // Pin the reporter's GPS position: 'report' (found/missing report) or 'sighting' (sighting form)
  useMyLocation(target) {
    const isSighting = target === 'sighting';
    const btn = document.getElementById(isSighting ? 'sighting-use-location-btn' : 'report-use-location-btn');
    const toast = (msg, kind) => { if (window.notifManager) window.notifManager.showToast(msg, kind, 5000); };

    if (!navigator.geolocation) {
      toast('Your browser cannot share its location. Tap the map to place the pin instead.', 'warning');
      return;
    }
    if (!window.isSecureContext) {
      toast('Location needs a secure (HTTPS) connection. Tap the map to place the pin instead.', 'warning');
      return;
    }

    const setBusy = (busy) => {
      if (!btn) return;
      btn.disabled = busy;
      btn.classList.toggle('is-loading', busy);
      const label = btn.querySelector('span');
      if (label) label.textContent = busy ? 'Finding your location…' : 'Use my current location';
    };

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const name = (await this.reverseGeocode(latitude, longitude)) || 'My current location';
        if (isSighting) this.jumpToSightingLocation(latitude, longitude, name);
        else this.jumpToLocation(latitude, longitude, name);
        setBusy(false);
        toast(`Pin placed at your location (accurate to about ${Math.max(1, Math.round(accuracy))} m).`, 'success');
      },
      (err) => {
        setBusy(false);
        const reasons = {
          1: 'Location permission is blocked. Allow it in your browser settings for this site, or tap the map to place the pin.',
          2: 'Your location is not available right now. Tap the map to place the pin instead.',
          3: 'Finding your location took too long. Try again, or tap the map to place the pin.'
        };
        toast(reasons[err.code] || reasons[2], 'warning');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  createPinIcon() {
    const isMissing = this.currentType === 'missing';
    const bgGradient = isMissing ? 'linear-gradient(135deg, #ba3820, #54280e)' : 'linear-gradient(135deg, #ea9d1e, #b85410)';
    const iconSvg = isMissing
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 10.5c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-6 2c1.38 0 2.5-1.12 2.5-2.5S7.38 7.5 6 7.5 3.5 8.62 3.5 10s1.12 2.5 2.5 2.5zm12 0c1.38 0 2.5-1.12 2.5-2.5S19.38 7.5 18 7.5s-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zM12 12c-2.76 0-5 2.24-5 5 0 2.21 1.79 4 4 4 1.1 0 2-.9 2-2 0 1.1.9 2 2 2 2.21 0 4-1.79 4-4 0-2.76-2.24-5-5-5z"/></svg>`;

    return window.L.divIcon({
      className: 'custom-report-pin',
      html: `
        <div class="pin-drop" style="position:relative; transform:translate(-50%, -100%); cursor:grab; touch-action:none; -webkit-user-select:none; user-select:none;">
          <div style="position:absolute; left:-14px; right:-14px; top:-14px; bottom:-14px;"></div>
          <div style="width:38px; height:38px; border-radius:50% 50% 50% 0; background:${bgGradient}; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 8px 18px rgba(0,0,0,0.5); border:2px solid #ffffff;">
            <div style="transform:rotate(45deg); display:flex; align-items:center; justify-content:center;">${iconSvg}</div>
          </div>
          <div style="width:10px; height:4px; border-radius:50%; background:rgba(0,0,0,0.4); margin:2px auto 0; filter:blur(1px);"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
  }

  updatePinIcon() {
    if (!this.marker || !window.L) return;
    this.marker.setIcon(this.createPinIcon());
  }

  getNearestPresetName(lat, lng) {
    let bestDist = Infinity;
    let bestLoc = null;
    PRESET_LOCATIONS.forEach(loc => {
      const dLat = (loc.lat - lat) * 111;
      const dLng = (loc.lng - lng) * 111 * Math.cos(lat * (Math.PI / 180));
      const dist = dLat * dLat + dLng * dLng;
      if (dist < bestDist) {
        bestDist = dist;
        bestLoc = loc;
      }
    });
    if (bestLoc) {
      return bestLoc.name.includes('Quezon City') ? bestLoc.name : `${bestLoc.name}, Quezon City`;
    }
    return `Quezon City [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
  }

  async reverseGeocode(lat, lng) {
    if (document.documentElement.classList.contains('google-maps-active') && window.google && google.maps && google.maps.importLibrary) {
      try {
        const { Geocoder } = await google.maps.importLibrary('geocoding');
        const { results } = await new Geocoder().geocode({ location: { lat, lng } });
        if (results && results[0]) {
          // "790 EDSA, Diliman, Quezon City, 1100 Metro Manila, Philippines" -> "790 EDSA, Diliman, Quezon City"
          return results[0].formatted_address.replace(/,\s*Philippines$/i, '').replace(/,\s*(\d{4}\s+)?Metro Manila$/i, '');
        }
      } catch (e) {
        console.warn('[Places] Google address lookup failed:', e.message);
      }
    }
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '';
        const suburb = addr.suburb || addr.village || addr.quarter || addr.city_district || '';
        const parts = [];
        if (road) parts.push(road);
        if (suburb && suburb !== road) parts.push(suburb);
        parts.push(addr.city || addr.town || addr.municipality || 'Quezon City');
        return parts.join(', ');
      }
    } catch (e) {}
    return null;
  }

  updatePinnedCoords(lat, lng, name = null) {
    this.pinChosen = true;
    this.pinnedLat = parseFloat(lat.toFixed(5));
    this.pinnedLng = parseFloat(lng.toFixed(5));

    const latInput = document.getElementById('report-pinned-lat');
    const lngInput = document.getElementById('report-pinned-lng');
    const badge = document.getElementById('report-pinned-coords-badge');

    if (latInput) latInput.value = this.pinnedLat;
    if (lngInput) lngInput.value = this.pinnedLng;
    if (badge) badge.textContent = `${this.pinnedLat.toFixed(5)}, ${this.pinnedLng.toFixed(5)}`;

    const resolvedName = name || this.getNearestPresetName(this.pinnedLat, this.pinnedLng);

    // 1. Put into search bar
    const searchInput = document.getElementById('report-location-search-input');
    const clearBtn = document.getElementById('report-search-clear-btn');
    if (searchInput) {
      searchInput.value = resolvedName;
    }
    if (clearBtn) {
      clearBtn.style.display = 'flex';
    }

    // 2. Put into Found Pet location field
    const foundLocInput = document.getElementById('report-found-location');
    if (foundLocInput) {
      foundLocInput.value = resolvedName;
    }

    // 3. Put into Missing Pet alert (last seen location)
    const missingLocInput = document.getElementById('report-missing-location');
    if (missingLocInput) {
      missingLocInput.value = resolvedName;
    }

    // 4. Highlight matching quick jump chips
    const chips = document.querySelectorAll('.report-zone-chip');
    chips.forEach(chip => {
      const chipText = chip.textContent.trim().toLowerCase();
      const nLower = resolvedName.toLowerCase();
      const distMatch = nLower.match(/district\s*(\d)/);
      const chipDistMatch = chipText.match(/district\s*(\d)/);
      let match = false;
      if (distMatch && chipDistMatch && distMatch[1] === chipDistMatch[1]) {
        match = true;
      } else {
        match = nLower.includes(chipText) || chipText.includes(nLower);
      }
      chip.classList.toggle('active', !!match);
    });

    // Background reverse geocode for exact street/building name if clicked without explicit name
    if (!name && typeof window !== 'undefined' && window.navigator && window.navigator.onLine) {
      this.reverseGeocode(this.pinnedLat, this.pinnedLng).then(geoName => {
        if (geoName) {
          if (searchInput && searchInput.value === resolvedName) searchInput.value = geoName;
          if (foundLocInput && foundLocInput.value === resolvedName) foundLocInput.value = geoName;
          if (missingLocInput && missingLocInput.value === resolvedName) missingLocInput.value = geoName;
        }
      }).catch(() => {});
    }
  }

  handleLocationSearch(query) {
    const trimmed = (query || '').trim();
    const clearBtn = document.getElementById('report-search-clear-btn');
    const suggestionsBox = document.getElementById('report-location-suggestions');
    if (!suggestionsBox) return;

    if (clearBtn) {
      clearBtn.style.display = trimmed.length > 0 ? 'flex' : 'none';
    }

    if (trimmed.length < 1) {
      suggestionsBox.style.display = 'none';
      suggestionsBox.innerHTML = '';
      this.liftForDropdown(suggestionsBox, false);
      this.selectedSuggestionIndex = -1;
      return;
    }

    const lower = trimmed.toLowerCase();
    const matches = PRESET_LOCATIONS.filter(loc => {
      return loc.name.toLowerCase().includes(lower) || loc.group.toLowerCase().includes(lower);
    });

    this.renderSuggestions(matches, trimmed);
  }

  // The two location boxes: the report form's and the sighting form's
  placeBox(kind) {
    return kind === 'sighting'
      ? { box: 'sighting-location-suggestions', input: 'sighting-location-input', list: 'sightingSuggestions', index: 'selectedSightingSuggestionIndex',
          select: (lat, lng, name) => this.selectSightingLocation(lat, lng, name) }
      : { box: 'report-location-suggestions', input: 'report-location-search-input', list: 'currentSuggestions', index: 'selectedSuggestionIndex',
          select: (lat, lng, name) => this.selectLocation(lat, lng, name) };
  }

  // Built-in areas that match show at once; real places from the live search are added below them a moment later
  renderPlaceSuggestions(kind, matches, query) {
    const cfg = this.placeBox(kind);
    const box = document.getElementById(cfg.box);
    if (!box) return;
    const presets = matches.slice(0, 5).map((loc) => ({ title: loc.name, subtitle: '', badge: loc.group, lat: loc.lat, lng: loc.lng }));
    this[cfg.list] = presets;
    this[cfg.index] = -1;
    const searching = query.length >= 2;
    this.drawPlaceSuggestions(kind, searching ? 'searching' : '');
    if (!searching) return;

    clearTimeout(this.placeTimers && this.placeTimers[kind]);
    this.placeTimers = this.placeTimers || {};
    this.placeTimers[kind] = setTimeout(async () => {
      let places = [];
      let failed = false;
      try { places = await searchPlaces(query); } catch (e) { failed = true; }
      const input = document.getElementById(cfg.input);
      if (!input || input.value.trim() !== query) return; // the text changed while searching
      if (places === null) { this.drawPlaceSuggestions(kind, presets.length ? '' : 'enter'); return; }
      this[cfg.list] = [...presets, ...places.map((pl) => ({ ...pl, badge: 'Place' }))];
      this.drawPlaceSuggestions(kind, failed ? 'failed' : (this[cfg.list].length ? '' : 'none'));
    }, 350);
  }

  drawPlaceSuggestions(kind, status) {
    const cfg = this.placeBox(kind);
    const box = document.getElementById(cfg.box);
    if (!box) return;
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pin = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary, #ea9d1e); flex-shrink:0;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
    const rows = this[cfg.list].map((it, i) => `
      <div class="report-suggestion-item" data-index="${i}" onclick="window.reportManager.pickPlaceSuggestion('${kind}', ${i})">
        <div class="report-suggestion-main">
          ${pin}
          <span class="report-suggestion-text">
            <span class="report-suggestion-name">${esc(it.title)}</span>
            ${it.subtitle ? `<span class="report-suggestion-sub">${esc(it.subtitle)}</span>` : ''}
          </span>
        </div>
        <span class="report-suggestion-badge">${esc(it.badge)}</span>
      </div>`).join('');
    const note = {
      searching: 'Searching places...',
      enter: 'Press Enter to search for this place.',
      none: 'No places found. Try a street, barangay or landmark, or drop the pin on the map.',
      failed: 'Place search is not available right now. Drop the pin on the map instead.'
    }[status];
    box.innerHTML = rows + (note ? `<div class="report-suggestion-status">${note}</div>` : '');
    box.style.display = rows || note ? 'block' : 'none';
    this.liftForDropdown(box, !!(rows || note));
  }

  // The card around a location box makes its own stacking layer, so the next card used to paint over the open
  // dropdown and hide most results. While the dropdown is open, that card is raised above its neighbours.
  liftForDropdown(box, open) {
    const card = box && box.closest('.glass-card, .report-section, .modal-box');
    if (card) card.classList.toggle('has-open-dropdown', open);
  }

  async pickPlaceSuggestion(kind, i) {
    const cfg = this.placeBox(kind);
    const it = (this[cfg.list] || [])[i];
    if (!it) return;
    if (it.lat != null && it.lng != null) {
      cfg.select(it.lat, it.lng, [it.title, it.subtitle].filter(Boolean).join(', '));
      return;
    }
    try {
      const at = await it.resolve();
      cfg.select(at.lat, at.lng, at.name);
    } catch (e) {
      if (window.notifManager) window.notifManager.showToast('That place could not be opened. Try another result or drop the pin.', 'warning', 3500);
    }
  }

  renderSuggestions(matches, query) {
    this.renderPlaceSuggestions('report', matches, query);
  }

  handleSearchKeydown(e) {
    const suggestionsBox = document.getElementById('report-location-suggestions');
    if (!suggestionsBox || suggestionsBox.style.display === 'none') {
      if (e.key === 'Enter') {
        e.preventDefault();
        const input = document.getElementById('report-location-search-input');
        if (input && input.value) {
          this.searchOnlineNominatim(input.value);
        }
      }
      return;
    }

    const items = suggestionsBox.querySelectorAll('.report-suggestion-item[data-index]');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedSuggestionIndex = (this.selectedSuggestionIndex + 1) % items.length;
      this.highlightSuggestion(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedSuggestionIndex = (this.selectedSuggestionIndex - 1 + items.length) % items.length;
      this.highlightSuggestion(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.selectedSuggestionIndex >= 0 && this.currentSuggestions && this.currentSuggestions[this.selectedSuggestionIndex]) {
        this.pickPlaceSuggestion('report', this.selectedSuggestionIndex);
      } else {
        const input = document.getElementById('report-location-search-input');
        if (input && input.value) {
          this.searchOnlineNominatim(input.value);
        }
      }
    } else if (e.key === 'Escape') {
      this.hideSuggestions();
    }
  }

  highlightSuggestion(items) {
    items.forEach((item, idx) => {
      item.classList.toggle('active', idx === this.selectedSuggestionIndex);
      if (idx === this.selectedSuggestionIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  selectLocation(lat, lng, name) {
    const input = document.getElementById('report-location-search-input');
    if (input) input.value = name;
    this.hideSuggestions();
    this.jumpToLocation(lat, lng, name);
  }

  clearLocationSearch() {
    const input = document.getElementById('report-location-search-input');
    const clearBtn = document.getElementById('report-search-clear-btn');
    if (input) {
      input.value = '';
      input.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    this.hideSuggestions();
  }

  hideSuggestions() {
    const suggestionsBox = document.getElementById('report-location-suggestions');
    if (suggestionsBox) {
      suggestionsBox.style.display = 'none';
      suggestionsBox.innerHTML = '';
      this.liftForDropdown(suggestionsBox, false);
    }
    this.selectedSuggestionIndex = -1;
  }

  async searchOnlineNominatim(query) {
    this.hideSuggestions();
    if (!query) return;

    if (window.notifManager) {
      window.notifManager.showToast(`Locating "${query}"...`, 'info', 2000);
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ph&viewbox=120.85,14.85,121.25,14.35&q=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        const displayName = result.display_name.split(',').slice(0, 3).join(',');
        this.selectLocation(lat, lon, displayName);
        if (window.notifManager) {
          window.notifManager.showToast(`Jumped to: ${displayName}`, 'success', 3000);
        }
      } else {
        const match = PRESET_LOCATIONS.find(l => l.name.toLowerCase().includes(query.toLowerCase()));
        if (match) {
          this.selectLocation(match.lat, match.lng, match.name);
        } else if (window.notifManager) {
          window.notifManager.showToast(`Location "${query}" was not found. Try another landmark or drag the pin.`, 'warning', 3500);
        }
      }
    } catch (err) {
      const match = PRESET_LOCATIONS.find(l => l.name.toLowerCase().includes(query.toLowerCase()));
      if (match) {
        this.selectLocation(match.lat, match.lng, match.name);
      } else if (window.notifManager) {
        window.notifManager.showToast(`Jumped pin near ${query}.`, 'info', 2500);
      }
    }
  }

  jumpToLocation(lat, lng, name) {
    this.updatePinnedCoords(lat, lng, name);
    if (this.map) {
      this.map.flyTo([lat, lng], 15, { duration: 0.8 });
      if (this.marker) {
        this.marker.setLatLng([lat, lng]);
      }
    }
  }

  triggerTakePhoto() {
    const camInput = document.getElementById('report-photo-camera-input');
    if (camInput) camInput.click();
  }

  triggerUploadPhoto() {
    const fileInput = document.getElementById('report-photo-file-input');
    if (fileInput) fileInput.click();
  }

  handlePhotoFile(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      if (window.notifManager) window.notifManager.showToast('Please select a valid image file (JPG, PNG, WEBP).', 'warning', 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (await this.setUploadedPhoto(e.target.result) && window.notifManager) {
        window.notifManager.showToast('Pet photo attached successfully.', 'success', 3000);
      }
    };
    reader.readAsDataURL(file);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('report-photo-dropzone');
    if (dropzone) dropzone.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('report-photo-dropzone');
    if (dropzone) dropzone.classList.remove('drag-over');
  }

  handlePhotoDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('report-photo-dropzone');
    if (dropzone) dropzone.classList.remove('drag-over');

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith('image/')) {
        if (window.notifManager) window.notifManager.showToast('Please drop a valid image file.', 'warning', 3000);
        return;
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        if (await this.setUploadedPhoto(ev.target.result) && window.notifManager) {
          window.notifManager.showToast('Pet photo attached successfully.', 'success', 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // Phone photos are several MB and the app saves each photo in a few places in the browser's ~5 MB storage,
  // so big photos are shrunk to a small JPEG as soon as they are added
  shrinkDataUrl(dataUrl, maxSide = 800) {
    return new Promise((resolve) => {
      if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < 150000) { resolve(dataUrl); return; }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // A tiny fingerprint of a picture (8x8 grey squares), to tell whether two files show the same photo
  async photoHash(src) {
    const img = await new Promise((resolve, reject) => { const el = new Image(); el.onload = () => resolve(el); el.onerror = reject; el.src = src; });
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 8, 8);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    const grey = [];
    for (let i = 0; i < d.length; i += 4) grey.push(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
    const avg = grey.reduce((a, b) => a + b, 0) / grey.length;
    return grey.map((g) => (g >= avg ? 1 : 0));
  }

  // Is this the pet's own profile photo (or a copy of it)? The report needs a NEW photo.
  async isProfilePhoto(dataUrl) {
    try {
      const id = document.getElementById('report-missing-pet-select')?.value;
      const pet = id && window.pawStore.getPets().find((p) => String(p.id) === String(id));
      const url = pet && (pet.photoUrl || pet.photo);
      if (!url || !dataUrl) return false;
      if (url === dataUrl) return true;
      const blob = await (await fetch(url)).blob();
      const local = URL.createObjectURL(blob);
      try {
        const [a, b] = await Promise.all([this.photoHash(local), this.photoHash(dataUrl)]);
        return a.filter((bit, i) => bit !== b[i]).length <= 5;
      } finally { URL.revokeObjectURL(local); }
    } catch (e) {
      return false; // cannot compare: allow it
    }
  }

  async setUploadedPhoto(dataUrl) {
    // Only a real photo of a pet is accepted, not a screenshot or an unrelated picture
    const check = window.petAI ? await window.petAI.checkPetPhoto(dataUrl, { indicator: document.getElementById('report-missing-photo-row') }) : { ok: true };
    if (!check.ok) {
      this.removeUploadedPhoto(false);
      if (window.notifManager) window.notifManager.showToast(check.reason, 'warning', 7000);
      return false;
    }
    if (dataUrl && dataUrl.length >= 150000) this.shrinkDataUrl(dataUrl).then((small) => this.applyUploadedPhoto(small));
    else this.applyUploadedPhoto(dataUrl);
    return true;
  }

  applySightingUploadedPhoto(dataUrl) {
    if (dataUrl && dataUrl.length >= 150000) this.shrinkDataUrl(dataUrl).then((small) => this.applySightingUploadedPhoto(small));
    else this.applySightingUploadedPhoto(dataUrl);
  }

  applyUploadedPhoto(dataUrl) {
    this.uploadedPhotoData = dataUrl;
    const placeholder = document.getElementById('report-photo-placeholder');
    const previewWrap = document.getElementById('report-photo-preview-wrap');
    const previewImg = document.getElementById('report-photo-preview-img');

    if (placeholder) placeholder.style.display = 'none';
    if (previewWrap) previewWrap.style.display = 'block';
    if (previewImg) previewImg.src = dataUrl;
    const thumb = document.getElementById('report-missing-photo-thumb');
    if (thumb) { thumb.src = dataUrl; thumb.hidden = false; }
    const photoRow = document.getElementById('report-missing-photo-row');
    if (photoRow) this.clearFieldError(photoRow); // a photo is there now: the "add a photo" message goes away

    this.updateMissingPhotoStatus();
  }

  removeUploadedPhoto(showToast = true) {
    this.uploadedPhotoData = null;
    const placeholder = document.getElementById('report-photo-placeholder');
    const previewWrap = document.getElementById('report-photo-preview-wrap');
    const previewImg = document.getElementById('report-photo-preview-img');
    const camInput = document.getElementById('report-photo-camera-input');
    const fileInput = document.getElementById('report-photo-file-input');

    if (camInput) camInput.value = '';
    if (fileInput) fileInput.value = '';
    if (previewImg) previewImg.src = '';
    if (previewWrap) previewWrap.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    const thumb = document.getElementById('report-missing-photo-thumb');
    if (thumb) { thumb.removeAttribute('src'); thumb.hidden = true; }

    this.updateMissingPhotoStatus();

    if (showToast && window.notifManager) {
      window.notifManager.showToast('Photo removed.', 'info', 2000);
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (!window.pawStore) return;

    // A save that fails must say so: otherwise the button just seems to do nothing
    try {
      if (this.currentType === 'found') {
        this.submitFoundReport();
      } else {
        await this.submitMissingReport();
      }
    } catch (err) {
      console.error('[Report] submit failed:', err);
      const full = err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || ''));
      if (window.notifManager) {
        window.notifManager.showToast(full
          ? 'Could not save the report because this device is out of storage. Try a smaller photo.'
          : `Could not send the report: ${(err && err.message) || 'unknown error'}. Please try again.`, 'error', 6000);
      }
    }
  }

  submitFoundReport() {
    const petSelect = document.getElementById('report-found-pet-select');
    const selectedPetId = (petSelect?.value || '').trim();
    const species = (document.getElementById('report-found-species')?.value || '').trim();
    const breed = (document.getElementById('report-found-breed')?.value || '').trim();
    const location = (document.getElementById('report-found-location')?.value || '').trim();
    const phone = (document.getElementById('report-found-phone')?.value || '').trim();
    const nfc = (document.getElementById('report-found-nfc')?.value || '').trim();
    const notes = (document.getElementById('report-found-notes')?.value || '').trim();
    const caption = (document.getElementById('report-found-caption')?.value || '').trim();

    // Required fields validation (all except message/notes and nfc)
    if (!selectedPetId) {
      if (window.notifManager) window.notifManager.showToast('Please select Registered or Unregistered pet.', 'warning', 3500);
      petSelect?.focus();
      return;
    }
    if (!species) {
      if (window.notifManager) window.notifManager.showToast('Please select the animal species.', 'warning', 3500);
      document.getElementById('report-found-species')?.focus();
      return;
    }
    if (!breed) {
      if (window.notifManager) window.notifManager.showToast('Please enter the pet breed or physical appearance.', 'warning', 3500);
      document.getElementById('report-found-breed')?.focus();
      return;
    }
    if (!location) {
      if (window.notifManager) window.notifManager.showToast('Please enter the location or landmark where the pet was found.', 'warning', 3500);
      document.getElementById('report-found-location')?.focus();
      return;
    }
    if (!phone) {
      if (window.notifManager) window.notifManager.showToast('Please enter your contact phone number so the pet guardian can reach you.', 'warning', 3500);
      document.getElementById('report-found-phone')?.focus();
      return;
    }

    const finalPhoto = this.uploadedPhotoData || (species === 'Cat' ? 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500' : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500');

    const sightingId = 'SIGHT-' + Date.now().toString().slice(-6);

    // Check if the selected registered pet or entered NFC matches any registered pet in the system BEFORE building sighting object
    let matchedPet = null;
    if (selectedPetId && selectedPetId !== 'unregistered' && selectedPetId !== 'custom' && selectedPetId !== 'registered' && window.pawStore) {
      matchedPet = window.pawStore.getPetById(selectedPetId);
    }
    if (!matchedPet && nfc && window.pawStore) {
      matchedPet = window.pawStore.getPetByNFC(nfc);
    }

    const sighting = {
      id: sightingId,
      species: species,
      breed: breed,
      location: location,
      coords: [this.pinnedLat, this.pinnedLng],
      nfcTag: nfc || (matchedPet ? matchedPet.nfcTag : ''),
      reporterPhone: phone,
      community: matchedPet ? (matchedPet.community || (matchedPet.owner && matchedPet.owner.community) || '') : '',
      reporterName: 'Community Good Samaritan',
      comments: notes,
      caption,
      timestamp: new Date().toISOString(),
      confidenceScore: 92,
      photo: finalPhoto,
      photoUrl: finalPhoto,
      reportType: 'found'
    };

    window.pawStore.addSighting(sighting);

    if (matchedPet) {
      // Create high-priority notification for the pet owner with complete finder info
      const ownerNotif = {
        id: 'notif-match-' + Date.now(),
        title: `GOOD SAMARITAN FOUND YOUR PET: "${matchedPet.name.toUpperCase()}"!`,
        message: `Your pet was found and reported near ${location}. Finder Contact: ${phone || 'Available in details'}. Notes: "${notes}"`,
        type: 'pet_found_match',
        petId: matchedPet.id,
        petName: matchedPet.name,
        nfcTag: matchedPet.nfcTag,
        finderName: 'Community Good Samaritan',
        finderPhone: phone || '+63 9XX XXX XXXX',
        finderNotes: notes,
        location: location,
        coords: [this.pinnedLat, this.pinnedLng],
        photoUrl: finalPhoto,
        timestamp: new Date().toISOString(),
        read: false
      };

      // The owner is alerted through Supabase (whoever filed the pet's open missing report)
      const openReport = window.pawStore.getActiveMissingReportForPet(matchedPet.id);
      if (openReport) window.pawStore.notifyReporter(openReport.id, 'found', { phone, location, notes });

      // Add timeline event to pet case if available
      window.pawStore.addCaseTimelineEvent(matchedPet.id, {
        type: 'sighting',
        title: 'Pet Located by Good Samaritan',
        location: location,
        finder: `Community Good Samaritan (${phone || 'Phone on file'})`,
        notes: notes,
        photoUrl: finalPhoto,
        timestamp: new Date().toISOString()
      });

      if (window.notifManager) {
        window.notifManager.showToast(`MATCH CONFIRMED: Registered pet "${matchedPet.name}" (NFC: ${nfc}) found! Owner notification sent.`, 'success', 6000);
        setTimeout(() => {
          window.notifManager.showFinderInfo(ownerNotif);
        }, 600);
      }
    } else {
      // No notification: a sighting that matches no pet is not about anyone's own pet
      if (window.notifManager) {
        window.notifManager.showToast(`Sighting recorded & pinned to Incident Map at [${this.pinnedLat}, ${this.pinnedLng}].`, 'success', 5000);
      }
    }

    this.closeModal();

    // If currently on owner or map view, re-render to reflect new report
    if (window.location.hash === '#owner' && window.ownerView) {
      window.ownerView.render(document.getElementById('app-viewport'));
    }
    if (window.location.hash === '#map' && window.publicView) {
      window.publicView.render(document.getElementById('app-viewport'));
    }
  }

  // Inline errors: red field, message underneath, cleared as soon as the user fixes it
  showFieldError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    const group = el.closest('.form-group') || el.parentElement;
    group.classList.add('has-error');
    let note = group.querySelector(':scope > .field-error');
    if (!note) {
      note = document.createElement('small');
      note.className = 'field-error';
      note.setAttribute('role', 'alert');
      group.appendChild(note);
    }
    note.textContent = message;
    if (!group.dataset.errorBound) {
      group.dataset.errorBound = '1';
      const clear = () => this.clearFieldError(group);
      group.addEventListener('input', clear);
      group.addEventListener('change', clear);
      group.addEventListener('click', (e) => { if (e.target.closest('.pet-pick, button')) clear(); });
    }
  }

  clearFieldError(group) {
    group.classList.remove('has-error');
    group.querySelector(':scope > .field-error')?.remove();
  }

  clearFieldErrors() {
    document.querySelectorAll('#report-pet-modal .form-group.has-error').forEach((g) => this.clearFieldError(g));
  }

  async submitMissingReport() {
    const select = document.getElementById('report-missing-pet-select');
    const petId = (select?.value || '').trim();
    const customName = (document.getElementById('report-missing-custom-name')?.value || '').trim();
    const customDesc = (document.getElementById('report-missing-custom-desc')?.value || '').trim();
    const customSpecies = document.getElementById('report-missing-custom-species')?.value || '';
    const location = (document.getElementById('report-missing-location')?.value || '').trim();
    const date = (document.getElementById('report-missing-date')?.value || '').trim();
    // The phone falls back to the account's, then to the one saved on the pet
    const phoneBox = document.getElementById('report-missing-phone');
    const account = window.pawStore.getGoogleUser();
    const savedPet = window.pawStore.getPets().find(p => String(p.id) === petId);
    const phone = ((phoneBox?.value || '').trim() || (account && account.phone) || (savedPet && savedPet.owner && savedPet.owner.phone) || '').trim();
    if (phoneBox && phone && !phoneBox.value.trim()) phoneBox.value = phone;
    const notes = (document.getElementById('report-missing-notes')?.value || '').trim();
    const caption = (document.getElementById('report-missing-caption')?.value || '').trim();

    // Required fields: every problem is marked on its own field, not just the first one
    this.clearFieldErrors();
    const isUnregistered = petId === 'custom' || petId === 'unregistered';
    const untagged = !isUnregistered && petId
      ? window.pawStore.getPets().find(p => String(p.id) === String(petId)) : null;
    const condition = (document.getElementById('report-missing-condition')?.value || '').trim();
    const problems = [];
    if (!petId) problems.push(['report-missing-pet-picker', 'Choose which pet is missing, or pick Another pet.']);
    if (isUnregistered && !customSpecies) problems.push(['report-missing-custom-species', 'Choose what kind of pet it is.']);
    if (isUnregistered && !customName) problems.push(['report-missing-custom-name', "Enter the pet's name."]);
    if ((isUnregistered || untagged) && !customDesc) problems.push(['report-missing-custom-desc', 'Describe the pet so finders can recognise it (breed, size, colours, collar).']);
    // "Another pet": is it the reporter's own pet or someone else's? The reporter is the contact either way
    const whose = (document.querySelector('input[name="report-whose"]:checked') || {}).value || '';
    if (isUnregistered && !whose) problems.push(['report-missing-whose', 'Say whether this is your pet or someone else\'s.']);
    // Every report needs a new photo of the pet as it looks now (not its profile photo)
    if (petId && !this.uploadedPhotoData) {
      problems.push(['report-missing-photo-row', untagged ? `Add a photo of ${untagged.name} so others can recognise it.` : 'Add a current photo of the pet so others can recognise it.']);
    }
    // Every registered pet needs its current condition (injuries, collar, behaviour)
    if (untagged || isUnregistered) {
      if (!condition) problems.push(['report-missing-condition', `Describe how ${untagged ? untagged.name : 'the pet'} looked before it went missing (injuries, collar, behaviour).`]);
    }
    if (!location) problems.push(['report-missing-location', 'Enter where the pet was last seen, or drop the pin on the map.']);
    else if (!this.pinChosen) problems.push(['report-missing-location', 'Drop the pin on the map where the pet was last seen, so it shows in the right place.']);
    if (!date) problems.push(['report-missing-date', 'Choose the date and time the pet went missing.']);
    if (!phone) problems.push(['report-missing-phone', 'Enter a phone number where you can be reached.']);
    if (problems.length) {
      problems.forEach(([id, msg]) => this.showFieldError(id, msg));
      const first = document.getElementById(problems[0][0]);
      if (first) {
        first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const focusable = first.matches('input, textarea, select, button') ? first : first.querySelector('input, textarea, select, button');
        if (focusable) focusable.focus({ preventScroll: true });
      }
      if (window.notifManager) {
        window.notifManager.showToast(problems.length === 1 ? 'One thing needs your attention.' : `${problems.length} things need your attention.`, 'warning', 3000);
      }
      return;
    }
    const reportNotes = condition ? `Condition: ${condition}${notes ? ' | ' + notes : ''}` : notes;

    let petName = 'Pet';
    let nfc = 'NFC-TAG';
    let pet = null;

    if (petId && !isUnregistered) {
      if (window.pawStore) {
        const pets = window.pawStore.getPets();
        pet = pets.find(p => String(p.id) === String(petId)) || (petId === 'registered' && pets.length > 0 ? pets[0] : null);
        if (pet) {
          petName = pet.name;
          nfc = pet.nfcTag || '';
        } else {
          petName = 'Registered Pet';
        }
      }
    } else {
      petName = customName || 'Beloved Pet';
    }

    const finalPhoto = this.uploadedPhotoData || (pet ? (pet.photoUrl || pet.photo) : null) || '';

    // Saved in Supabase (missing_pets); the registered pet's status becomes 'missing' there too
    const submitBtn = document.getElementById('report-submit-btn');
    if (submitBtn) submitBtn.disabled = true;
    const missingReport = await window.pawStore.createMissingReport({
      petId: pet ? pet.id : null,
      petName: petName,
      species: pet ? pet.species : (customSpecies || 'Other'),
      breed: pet ? pet.breed : '',
      gender: pet ? pet.gender : '',
      color: pet ? pet.color : '',
      photoUrl: finalPhoto,
      photo: finalPhoto,
      ownerEmail: (pet && pet.owner && pet.owner.email) || (account && account.email) || '',
      ownerPhone: phone,
      community: (pet && pet.community) ? pet.community : (pet && pet.owner && pet.owner.address ? pet.owner.address : 'Metro Manila'),
      lastSeenLocation: location,
      lastSeenCoords: [this.pinnedLat, this.pinnedLng],
      lastSeenDate: date,
      notes: reportNotes,
      caption: caption,
      condition: condition,
      // For a pet reported without registering: false when the reporter is not its owner (a neighbour's pet,
      // a stray they look after). Finders notify the reporter either way, through ownerEmail and ownerPhone.
      description: customDesc,
      ...(pet ? {} : { reportedByOwner: whose !== 'other' }),
      status: 'active'
    });
    if (submitBtn) submitBtn.disabled = false;
    if (!missingReport) return; // the store already said what went wrong; the form stays open

    // Add Missing Pet Alert to Cases and Notifications
    const newCase = {
      id: 'CASE-' + Date.now().toString().slice(-4),
      petId: pet ? pet.id : 'pet-temp',
      missingReportId: missingReport.id,
      petName: petName,
      nfcTag: nfc,
      status: 'missing',
      location: location,
      coords: [this.pinnedLat, this.pinnedLng],
      photoUrl: finalPhoto,
      photo: finalPhoto,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      timeline: [
        {
          timestamp: new Date().toISOString(),
          type: 'missing',
          title: 'Missing Alert Broadcast Activated',
          location: location,
          notes: reportNotes,
          photoUrl: finalPhoto
        }
      ]
    };
    window.pawStore.saveCase(newCase);

    // No notification for a newly missing pet: the guardian filed it themselves, and notifications are only
    // for news about the guardian's own pets (sightings, finds, impounds)

    if (window.notifManager) {
      window.notifManager.showToast(`Emergency Alert Broadcasted for "${petName}". Pinned on Incident Map.`, 'danger', 5000);
    }

    this.closeModal();

    if (window.location.hash === '#map' && window.publicView) {
      window.publicView.render(document.getElementById('app-viewport'));
    }
    if (window.location.hash === '#owner' && window.ownerView) {
      window.ownerView.render(document.getElementById('app-viewport'));
    }
  }

  // =========================================================
  // COMMUNITY SIGHTING SUBMISSION FLOW METHODS
  // =========================================================

  // context: optional {name, breed, photoUrl, place, lat, lng, seenAt} for pets that are not in the local store
  openSightingModal(missingReportId = null, petId = null, context = null) {
    // Your own missing pet: nobody needs to send you a sighting of it from here, and you cannot report it to yourself
    if (window.pawStore && window.pawStore.isMyMissing(missingReportId, petId)) {
      if (window.notifManager) window.notifManager.showToast('This is your own pet. When you find it, mark it as safe in Pets.', 'info', 5000);
      return;
    }
    const modal = document.getElementById('sighting-submission-modal');
    if (!modal) return;

    // Reset previous inputs & photo
    this.sightingViewMode = 'map';
    this.setSightingViewMode('map');
    this.removeSightingUploadedPhoto(false);

    const hiddenReportId = document.getElementById('sighting-missing-report-id');
    const hiddenPetId = document.getElementById('sighting-pet-id');
    const prefillBanner = document.getElementById('sighting-prefill-banner');
    const modalTitle = document.getElementById('sighting-modal-title');
    const locInput = document.getElementById('sighting-location-input');
    const notesInput = document.getElementById('sighting-notes-input');
    const dateInput = document.getElementById('sighting-datetime-input');
    const phoneInput = document.getElementById('sighting-reporter-phone');
    const nameInput = document.getElementById('sighting-reporter-name');

    // A signed-in guardian's name and mobile number are filled in (and can still be edited)
    const account = (window.pawStore.getGoogleUser && window.pawStore.getGoogleUser()) || null;
    if (notesInput) notesInput.value = '';
    const sightingCaption = document.getElementById('sighting-caption-input');
    if (sightingCaption) sightingCaption.value = '';
    if (phoneInput) phoneInput.value = account && account.phone ? this.formatLocalMobile(account.phone) : '';
    if (nameInput)  nameInput.value  = account && account.name ? account.name : '';
    this.sightingSavedName = nameInput ? nameInput.value : '';
    this.setSightingNameMode('named');

    // Set default datetime to now
    if (dateInput) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      dateInput.value = now.toISOString().slice(0, 16);
    }

    // Determine target pet / missing report
    let targetPet = null;
    let targetReport = null;

    if (missingReportId) {
      targetReport = window.pawStore.getMissingReportById(missingReportId);
      if (targetReport) {
        targetPet = window.pawStore.getPetById(targetReport.petId);
      }
    }
    if (!targetPet && petId) {
      targetPet = window.pawStore.getPetById(petId);
      if (targetPet) {
        targetReport = window.pawStore.getActiveMissingReportForPet(petId);
      }
    }

    if (targetPet || targetReport) {
      const resolvedPetName = targetPet ? targetPet.name : (targetReport ? targetReport.petName : 'Missing Pet');
      const resolvedReportId = targetReport ? targetReport.id : (missingReportId || 'mr-' + Date.now());
      const resolvedPetId = targetPet ? targetPet.id : (targetReport ? targetReport.petId : petId);

      if (hiddenReportId) hiddenReportId.value = resolvedReportId;
      if (hiddenPetId) hiddenPetId.value = resolvedPetId;

      if (modalTitle) modalTitle.textContent = `Have you seen ${resolvedPetName}?`;

      if (prefillBanner) {
        prefillBanner.style.display = 'flex';
        const thumb = document.getElementById('sighting-prefill-pet-thumb');
        const nameEl = document.getElementById('sighting-prefill-pet-name');
        const metaEl = document.getElementById('sighting-prefill-pet-meta');
        // A pet reported without registering exists only as its report, so its photo and details come from there
        const shown = targetPet || targetReport;
        if (thumb) thumb.src = (targetPet && (targetPet.photoUrl || targetPet.photo)) || (targetReport && (targetReport.photoUrl || targetReport.photo)) || window.PET_PHOTO_PLACEHOLDER || '';
        if (nameEl) nameEl.textContent = resolvedPetName;
        if (metaEl) {
          const where = shown.lastSeenLocation || 'Metro Manila';
          const when = shown.lastSeenDate ? ` · ${this.timeAgoLabel(shown.lastSeenDate)}` : '';
          const kind = targetPet ? targetPet.breed : [targetReport.description || targetReport.breed, 'Not registered'].filter(Boolean).join(' · ');
          metaEl.textContent = `${kind} · Last seen: ${where}${when}`;
        }
      }

      // Start the pin on the last seen location; the finder moves it to where they saw the pet
      if (targetPet && targetPet.lastSeenCoords) {
        this.sightingPinnedLat = targetPet.lastSeenCoords[0];
        this.sightingPinnedLng = targetPet.lastSeenCoords[1];
      } else if (targetReport && targetReport.lastSeenCoords) {
        this.sightingPinnedLat = targetReport.lastSeenCoords[0];
        this.sightingPinnedLng = targetReport.lastSeenCoords[1];
      }

      const initialLoc = targetPet ? `Near ${targetPet.lastSeenLocation || 'Quezon City'}` : 'Metro Manila';
      this.updateSightingCoords(this.sightingPinnedLat, this.sightingPinnedLng, initialLoc);
    } else if (context) {
      // A missing pet that only exists as a "last seen" record: use its details for the banner and the pin
      if (hiddenReportId) hiddenReportId.value = '';
      if (hiddenPetId) hiddenPetId.value = '';
      if (modalTitle) modalTitle.textContent = `Have you seen ${context.name}?`;
      if (prefillBanner) {
        prefillBanner.style.display = 'flex';
        const thumb = document.getElementById('sighting-prefill-pet-thumb');
        const nameEl = document.getElementById('sighting-prefill-pet-name');
        const metaEl = document.getElementById('sighting-prefill-pet-meta');
        if (thumb) thumb.src = context.photoUrl || window.PET_PHOTO_PLACEHOLDER || '';
        if (nameEl) nameEl.textContent = context.name;
        if (metaEl) metaEl.textContent = `${context.breed || 'Missing pet'} · Last seen: ${context.place}${context.seenAt ? ' · ' + this.timeAgoLabel(context.seenAt) : ''}`;
      }
      this.sightingPinnedLat = context.lat;
      this.sightingPinnedLng = context.lng;
      this.updateSightingCoords(this.sightingPinnedLat, this.sightingPinnedLng, `Near ${context.place}`);
    } else {
      // General sighting flow
      if (hiddenReportId) hiddenReportId.value = '';
      if (hiddenPetId) hiddenPetId.value = '';
      if (modalTitle) modalTitle.textContent = 'Have you seen a missing pet?';
      if (prefillBanner) prefillBanner.style.display = 'none';
      this.sightingPinnedLat = 14.6500;
      this.sightingPinnedLng = 121.0400;
      this.updateSightingCoords(this.sightingPinnedLat, this.sightingPinnedLng, 'Quezon City, Metro Manila');
    }

    // The starting pin is only a guess: the finder must place it (tap, drag, search or current location).
    // Until then the location box stays empty, so a sighting is never saved at a spot nobody chose.
    this.sightingPinChosen = false;
    this._sightingPinTouched = false;
    const sightingLoc = document.getElementById('sighting-location-input');
    if (sightingLoc) sightingLoc.value = '';
    const sightingClear = document.getElementById('sighting-search-clear-btn');
    if (sightingClear) sightingClear.style.display = 'none';

    modal.classList.add('active');
    modal.style.display = 'flex';

    if (!this._sightingModalBound) {
      this._sightingModalBound = true;
      modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) this.closeSightingModal();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) this.closeSightingModal();
      });
    }
    const body = modal.querySelector('.modal-body');
    if (body) body.scrollTop = 0;

    setTimeout(() => {
      this.initSightingPinMap();
    }, 180);

    this.defaultSightingToMyLocation();
  }

  // +639171234567 -> 0917 123 4567, the way the form asks for it
  formatLocalMobile(value) {
    const digits = String(value || '').replace(/\D/g, '').replace(/^63/, '0');
    const local = digits.startsWith('0') ? digits : `0${digits}`;
    return local.length === 11 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : String(value || '');
  }

  // Starts the sighting pin at the finder's own position (they are usually standing where they saw the pet).
  // Quiet when location is blocked: the pin then starts on the pet's last seen place as before.
  defaultSightingToMyLocation() {
    if (!navigator.geolocation || !window.isSecureContext) return;
    const token = (this._sightingLocateToken = (this._sightingLocateToken || 0) + 1);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const modal = document.getElementById('sighting-submission-modal');
        // The modal was closed, reopened, or the finder already placed the pin themselves
        if (token !== this._sightingLocateToken || !modal || !modal.classList.contains('active') || this._sightingPinTouched) return;
        const { latitude, longitude } = pos.coords;
        const name = (await this.reverseGeocode(latitude, longitude)) || 'My current location';
        if (token !== this._sightingLocateToken || this._sightingPinTouched || !this.sightingMap) return;
        this.jumpToSightingLocation(latitude, longitude, name);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  timeAgoLabel(value) {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
    if (Number.isNaN(minutes)) return '';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
  }

  // Quick time chips: set the "seen at" field to N minutes ago
  setSightingQuickTime(minutesAgo) {
    const input = document.getElementById('sighting-datetime-input');
    if (!input) return;
    const d = new Date(Date.now() - minutesAgo * 60000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    input.value = d.toISOString().slice(0, 16);
  }

  // Quick note chips: append a phrase to the notes box once
  addSightingNote(text) {
    const box = document.getElementById('sighting-notes-input');
    if (!box || box.value.includes(text)) return;
    box.value = box.value.trim() ? `${box.value.trim()} ${text}` : text;
    box.focus();
  }

  closeSightingModal() {
    const modal = document.getElementById('sighting-submission-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
    if (this.sightingMap) {
      try {
        this.sightingMap.remove();
      } catch (e) {}
      this.sightingMap = null;
    }
  }

  // The map and the photo are separate steps and always visible; 'upload' just brings the photo step into view
  setSightingViewMode(mode) {
    this.sightingViewMode = mode;
    const mapContainer = document.getElementById('sighting-map-view-container');
    const uploadContainer = document.getElementById('sighting-upload-view-container');
    if (mapContainer) mapContainer.style.display = 'flex';
    if (uploadContainer) uploadContainer.style.display = 'flex';

    if (this.sightingMap) {
      setTimeout(() => {
        if (this.sightingMap) this.sightingMap.invalidateSize();
      }, 100);
    }
    if (mode === 'upload' && uploadContainer) uploadContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  setSightingNameMode(mode, focus = false) {
    this.sightingNameMode = mode;
    const anonBox = document.getElementById('sighting-anon-checkbox');
    const nameInput = document.getElementById('sighting-reporter-name');

    if (anonBox) anonBox.checked = mode === 'anonymous';

    if (nameInput) {
      if (mode === 'anonymous') {
        if (nameInput.value && nameInput.value.trim().toLowerCase() !== 'anonymous') {
          this.sightingSavedName = nameInput.value;
        }
        nameInput.value = 'Anonymous';
        nameInput.readOnly = true;
        nameInput.style.opacity = '0.6';
      } else {
        if (nameInput.value === 'Anonymous') {
          nameInput.value = this.sightingSavedName || '';
        }
        nameInput.readOnly = false;
        nameInput.placeholder = 'e.g. Juan dela Cruz';
        nameInput.style.opacity = '1';
        if (focus) nameInput.focus();
      }
    }
  }

  handleSightingNameInput(value) {
    const trimmed = (value || '').trim();
    if (trimmed && trimmed.toLowerCase() !== 'anonymous' && this.sightingNameMode === 'anonymous') {
      this.setSightingNameMode('named');
    }
  }

  // Shows whether the required photo is attached
  updateSightingPhotoTag() {
    const tag = document.getElementById('sighting-photo-tag');
    if (!tag) return;
    const attached = !!this.sightingPhotoData;
    tag.textContent = attached ? 'Attached' : 'Required';
    tag.classList.toggle('is-done', attached);
    tag.classList.toggle('is-required', !attached);
  }

  setSightingMapLayer(type) {
    this.sightingMapType = type;
    const dock = document.getElementById('sighting-map-layer-dock');
    if (dock) {
      const btns = dock.querySelectorAll('.gmap-layer-btn');
      btns.forEach(btn => {
        const span = btn.querySelector('span');
        const text = span ? span.textContent.trim().toLowerCase() : '';
        btn.classList.toggle('active', text === type.toLowerCase());
      });
    }

    if (!this.sightingMap || !window.L) return;

    if (this.sightingTileLayer) {
      try { this.sightingMap.removeLayer(this.sightingTileLayer); } catch (e) {}
    }

    const layerUrls = {
      roadmap: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      hybrid: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    };

    const url = layerUrls[type] || layerUrls.roadmap;
    const maxZoom = type === 'satellite' ? 18 : 19;
    this.sightingTileLayer = window.L.tileLayer(url, {
      maxZoom: maxZoom,
      attribution: '&copy; Leaflet | Google Maps'
    }).addTo(this.sightingMap);
  }

  locateSightingMe() {
    this._sightingPinTouched = true;
    this.useMyLocation('sighting');
  }

  jumpToSightingLocation(lat, lng, name) {
    this.updateSightingCoords(lat, lng, name);
    if (this.sightingMap) {
      this.sightingMap.flyTo([lat, lng], 15, { duration: 0.8 });
      if (this.sightingMarker) {
        this.sightingMarker.setLatLng([lat, lng]);
      }
    }
  }


  async initSightingPinMap() {
    await window.PawMapsReady;
    const container = document.getElementById('sighting-pin-map');
    if (!container || !window.L) return;

    if (this.sightingMap) {
      try { this.sightingMap.remove(); } catch (e) {}
      this.sightingMap = null;
    }

    this.sightingMap = window.L.map('sighting-pin-map', {
      scrollWheelZoom: true,
      zoomControl: true,
      doubleClickZoom: false,
      cursor: 'crosshair'
    }).setView([this.sightingPinnedLat, this.sightingPinnedLng], 14);

    this.setSightingMapLayer(this.sightingMapType || 'roadmap');

    // Green Draggable Sighting Marker (PRESERVING EXACT PINPOINT ICON)
    const greenSightingIcon = window.L.divIcon({
      className: 'sighting-pin-leaflet-icon',
      html: `
        <div class="pin-drop" style="position:relative; transform:translate(-50%, -100%); cursor:grab;">
          <div style="width:34px; height:34px; border-radius:50% 50% 50% 0; background:linear-gradient(135deg, #22c55e, #15803d); transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 6px 16px rgba(0,0,0,0.4); border:2px solid #ffffff;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg);"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          </div>
          <div style="width:8px; height:3px; border-radius:50%; background:rgba(0,0,0,0.3); margin:2px auto 0;"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });

    this.sightingMarker = window.L.marker([this.sightingPinnedLat, this.sightingPinnedLng], {
      icon: greenSightingIcon,
      draggable: true
    }).addTo(this.sightingMap);

    this.sightingMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      this._sightingPinTouched = true;
      this.updateSightingCoords(pos.lat, pos.lng);
    });

    this.sightingMap.on('click', (e) => {
      this._sightingPinTouched = true;
      this.updateSightingCoords(e.latlng.lat, e.latlng.lng);
      if (this.sightingMarker) {
        this.sightingMarker.setLatLng(e.latlng);
        this.sightingMarker.setIcon(greenSightingIcon); // replays the drop animation
      }
    });

    setTimeout(() => {
      if (this.sightingMap) this.sightingMap.invalidateSize();
    }, 150);
  }

  updateSightingCoords(lat, lng, name = null) {
    this.sightingPinChosen = true;
    this.sightingPinnedLat = parseFloat(lat.toFixed(5));
    this.sightingPinnedLng = parseFloat(lng.toFixed(5));

    const latInput = document.getElementById('sighting-pinned-lat');
    const lngInput = document.getElementById('sighting-pinned-lng');
    const searchInput = document.getElementById('sighting-location-input');
    const clearBtn = document.getElementById('sighting-search-clear-btn');

    if (latInput) latInput.value = this.sightingPinnedLat;
    if (lngInput) lngInput.value = this.sightingPinnedLng;

    const resolvedName = name || this.getNearestPresetName(this.sightingPinnedLat, this.sightingPinnedLng);

    if (searchInput) {
      searchInput.value = resolvedName;
    }
    if (clearBtn) {
      clearBtn.style.display = 'flex';
    }

    // Background reverse geocode for exact street/building name if clicked without explicit name
    if (!name && typeof window !== 'undefined' && window.navigator && window.navigator.onLine) {
      this.reverseGeocode(this.sightingPinnedLat, this.sightingPinnedLng).then(geoName => {
        if (geoName && searchInput && searchInput.value === resolvedName) {
          searchInput.value = geoName;
        }
      }).catch(() => {});
    }
  }

  handleSightingLocationSearch(query) {
    const trimmed = (query || '').trim();
    const clearBtn = document.getElementById('sighting-search-clear-btn');
    const suggestionsBox = document.getElementById('sighting-location-suggestions');
    if (!suggestionsBox) return;

    if (clearBtn) {
      clearBtn.style.display = trimmed.length > 0 ? 'flex' : 'none';
    }

    if (trimmed.length < 1) {
      suggestionsBox.style.display = 'none';
      suggestionsBox.innerHTML = '';
      this.liftForDropdown(suggestionsBox, false);
      this.selectedSightingSuggestionIndex = -1;
      return;
    }

    const lower = trimmed.toLowerCase();
    const matches = PRESET_LOCATIONS.filter(loc => {
      return loc.name.toLowerCase().includes(lower) || loc.group.toLowerCase().includes(lower);
    });

    this.renderSightingSuggestions(matches, trimmed);
  }

  renderSightingSuggestions(matches, query) {
    this.renderPlaceSuggestions('sighting', matches, query);
  }

  handleSightingSearchKeydown(e) {
    const suggestionsBox = document.getElementById('sighting-location-suggestions');
    if (!suggestionsBox || suggestionsBox.style.display === 'none') {
      if (e.key === 'Enter') {
        e.preventDefault();
        const input = document.getElementById('sighting-location-input');
        if (input && input.value) {
          this.searchOnlineNominatimSighting(input.value);
        }
      }
      return;
    }

    const items = suggestionsBox.querySelectorAll('.report-suggestion-item[data-index]');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedSightingSuggestionIndex = (this.selectedSightingSuggestionIndex + 1) % items.length;
      this.highlightSightingSuggestion(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedSightingSuggestionIndex = (this.selectedSightingSuggestionIndex - 1 + items.length) % items.length;
      this.highlightSightingSuggestion(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.selectedSightingSuggestionIndex >= 0 && this.sightingSuggestions && this.sightingSuggestions[this.selectedSightingSuggestionIndex]) {
        this.pickPlaceSuggestion('sighting', this.selectedSightingSuggestionIndex);
      } else {
        const input = document.getElementById('sighting-location-input');
        if (input && input.value) {
          this.searchOnlineNominatimSighting(input.value);
        }
      }
    } else if (e.key === 'Escape') {
      this.hideSightingSuggestions();
    }
  }

  highlightSightingSuggestion(items) {
    items.forEach((item, idx) => {
      item.classList.toggle('active', idx === this.selectedSightingSuggestionIndex);
      if (idx === this.selectedSightingSuggestionIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  selectSightingLocation(lat, lng, name) {
    const input = document.getElementById('sighting-location-input');
    if (input) input.value = name;
    this.hideSightingSuggestions();
    this._sightingPinTouched = true;
    this.jumpToSightingLocation(lat, lng, name);
  }

  clearSightingLocationSearch() {
    const input = document.getElementById('sighting-location-input');
    const clearBtn = document.getElementById('sighting-search-clear-btn');
    if (input) {
      input.value = '';
      input.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    this.hideSightingSuggestions();
  }

  hideSightingSuggestions() {
    const suggestionsBox = document.getElementById('sighting-location-suggestions');
    if (suggestionsBox) {
      suggestionsBox.style.display = 'none';
      suggestionsBox.innerHTML = '';
      this.liftForDropdown(suggestionsBox, false);
    }
    this.selectedSightingSuggestionIndex = -1;
  }

  async searchOnlineNominatimSighting(query) {
    this.hideSightingSuggestions();
    if (!query) return;

    if (window.notifManager) {
      window.notifManager.showToast(`Locating "${query}"...`, 'info', 2000);
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ph&viewbox=120.85,14.85,121.25,14.35&q=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        const displayName = result.display_name.split(',').slice(0, 3).join(',');
        this.selectSightingLocation(lat, lon, displayName);
        if (window.notifManager) {
          window.notifManager.showToast(`Jumped to: ${displayName}`, 'success', 3000);
        }
      } else {
        const match = PRESET_LOCATIONS.find(l => l.name.toLowerCase().includes(query.toLowerCase()));
        if (match) {
          this.selectSightingLocation(match.lat, match.lng, match.name);
        } else if (window.notifManager) {
          window.notifManager.showToast(`Location "${query}" was not found. Try another landmark or drag the pin.`, 'warning', 3500);
        }
      }
    } catch (err) {
      const match = PRESET_LOCATIONS.find(l => l.name.toLowerCase().includes(query.toLowerCase()));
      if (match) {
        this.selectSightingLocation(match.lat, match.lng, match.name);
      } else if (window.notifManager) {
        window.notifManager.showToast(`Jumped pin near ${query}.`, 'info', 2500);
      }
    }
  }

  triggerSightingTakePhoto() {
    const camInput = document.getElementById('sighting-photo-camera-input');
    if (camInput) camInput.click();
  }

  triggerSightingUploadPhoto() {
    const fileInput = document.getElementById('sighting-photo-file-input');
    if (fileInput) fileInput.click();
  }

  handleSightingPhotoFile(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      if (window.notifManager) window.notifManager.showToast('Please select a valid image file (JPG, PNG, WEBP).', 'warning', 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      // Only a real photo of a pet is accepted, not a screenshot or an unrelated picture
      const check = window.petAI ? await window.petAI.checkPetPhoto(e.target.result, { indicator: document.getElementById('sighting-photo-dropzone') }) : { ok: true };
      if (!check.ok) {
        input.value = '';
        if (window.notifManager) window.notifManager.showToast(check.reason, 'warning', 7000);
        return;
      }
      this.setSightingUploadedPhoto(e.target.result);
      if (window.notifManager) {
        window.notifManager.showToast('Pet photo attached successfully.', 'success', 3000);
      }
    };
    reader.readAsDataURL(file);
  }

  setSightingUploadedPhoto(dataUrl) {
    this.sightingPhotoData = dataUrl;
    const placeholder = document.getElementById('sighting-photo-placeholder');
    const previewWrap = document.getElementById('sighting-photo-preview-wrap');
    const previewImg = document.getElementById('sighting-photo-preview-img');

    if (placeholder) placeholder.style.display = 'none';
    if (previewWrap) previewWrap.style.display = 'block';
    if (previewImg) previewImg.src = dataUrl;
    this.updateSightingPhotoTag();
  }

  removeSightingUploadedPhoto(showToast = true) {
    this.sightingPhotoData = null;
    const placeholder = document.getElementById('sighting-photo-placeholder');
    const previewWrap = document.getElementById('sighting-photo-preview-wrap');
    const previewImg = document.getElementById('sighting-photo-preview-img');
    const camInput = document.getElementById('sighting-photo-camera-input');
    const fileInput = document.getElementById('sighting-photo-file-input');

    if (camInput) camInput.value = '';
    if (fileInput) fileInput.value = '';
    if (previewImg) previewImg.src = '';
    if (previewWrap) previewWrap.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    this.updateSightingPhotoTag();

    if (showToast && window.notifManager) {
      window.notifManager.showToast('Photo removed.', 'info', 2000);
    }
  }

  handleSightingDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('sighting-photo-dropzone');
    if (dropzone) dropzone.classList.add('drag-over');
  }

  handleSightingDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('sighting-photo-dropzone');
    if (dropzone) dropzone.classList.remove('drag-over');
  }

  handleSightingPhotoDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('sighting-photo-dropzone');
    if (dropzone) dropzone.classList.remove('drag-over');

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith('image/')) {
        if (window.notifManager) window.notifManager.showToast('Please drop a valid image file.', 'warning', 3000);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.setSightingUploadedPhoto(ev.target.result);
        if (window.notifManager) {
          window.notifManager.showToast('Pet photo attached successfully.', 'success', 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // Copies a submitted sighting into the Supabase community_sightings table (best effort; the local copy is the source of truth for the app)


  // Downscales an image data URL to at most 1280px on the long side and returns a JPEG blob
  submitCommunitySighting(e) {
    if (e && e.preventDefault) e.preventDefault();

    // 1. Validate Photo (REQUIRED)
    if (!this.sightingPhotoData) {
      if (window.notifManager) {
        window.notifManager.showToast('A sighting photo is required as photographic evidence.', 'danger', 4000);
      }
      this.setSightingViewMode('upload');
      const dropzone = document.getElementById('sighting-photo-dropzone');
      if (dropzone) {
        dropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dropzone.classList.add('drag-over');
        setTimeout(() => dropzone.classList.remove('drag-over'), 1500);
      }
      return;
    }

    // 2. Validate Location (REQUIRED)
    const locInput = document.getElementById('sighting-location-input');
    const location = (locInput ? locInput.value : '').trim();
    if (!location) {
      if (window.notifManager) window.notifManager.showToast('Please describe the location / landmark where the pet was spotted.', 'warning');
      if (locInput) locInput.focus();
      return;
    }
    if (!this.sightingPinChosen) {
      if (window.notifManager) window.notifManager.showToast('Tap the map or drag the pin to where you saw the pet.', 'warning');
      document.getElementById('sighting-pin-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 3. Validate Date & Time (REQUIRED)
    const dateInput = document.getElementById('sighting-datetime-input');
    const dateTimeSeen = (dateInput ? dateInput.value : '').trim();
    if (!dateTimeSeen) {
      if (window.notifManager) window.notifManager.showToast('Please provide the date and time when you saw the pet.', 'warning');
      if (dateInput) dateInput.focus();
      return;
    }

    // 4. Validate reporter details (REQUIRED): a name, or "Stay anonymous", plus a mobile number
    const nameInput = document.getElementById('sighting-reporter-name');
    const phoneInput = document.getElementById('sighting-reporter-phone');
    const anonymous = this.sightingNameMode === 'anonymous';
    const reporterNameRaw = (nameInput?.value || '').trim();
    if (!anonymous && !reporterNameRaw) {
      if (window.notifManager) window.notifManager.showToast('Enter your name, or tick "Stay anonymous".', 'warning');
      nameInput?.focus();
      return;
    }
    const phone = (phoneInput?.value || '').trim();
    if (!phone) {
      if (window.notifManager) window.notifManager.showToast('A contact phone number is required so the owner can reach you.', 'warning');
      phoneInput?.focus();
      return;
    }
    if (!/^(\+?63|0)9\d{9}$/.test(phone.replace(/[\s\-().]/g, ''))) {
      if (window.notifManager) window.notifManager.showToast('Enter a valid Philippine mobile number, for example 0917 123 4567.', 'warning');
      phoneInput?.focus();
      return;
    }

    const notes = (document.getElementById('sighting-notes-input')?.value || '').trim();
    const caption = (document.getElementById('sighting-caption-input')?.value || '').trim();
    const reporterName = anonymous ? 'Anonymous' : reporterNameRaw;
    const missingReportId = document.getElementById('sighting-missing-report-id')?.value || null;
    const petId = document.getElementById('sighting-pet-id')?.value || null;

    let matchedPet = null;
    if (petId) {
      matchedPet = window.pawStore.getPetById(petId);
    } else if (missingReportId) {
      const rep = window.pawStore.getMissingReportById(missingReportId);
      if (rep) matchedPet = window.pawStore.getPetById(rep.petId);
    }

    const sightingId = 'sight-' + Date.now().toString().slice(-6);
    // The open missing report this sighting is about: its reporter is alerted, and it fills in the pet's details
    const reportId = missingReportId || (matchedPet ? matchedPet.missingReportId : null) || null;
    const report = reportId ? window.pawStore.getMissingReportById(reportId) : null;
    const about = matchedPet || report || {};

    const sighting = {
      id: sightingId,
      missing_report_id: reportId,
      petId: matchedPet ? matchedPet.id : null,
      community: about.community || '',
      species: about.species || 'Other',
      breed: about.breed || null,
      color: about.color || null,
      location: location,
      coords: [this.sightingPinnedLat, this.sightingPinnedLng],
      lat: this.sightingPinnedLat,
      lng: this.sightingPinnedLng,
      dateTimeSeen: dateTimeSeen,
      comments: notes || 'Possible pet sighting observed in the community.',
      notes: notes || 'Possible pet sighting observed in the community.',
      photoUrl: this.sightingPhotoData,
      photo: this.sightingPhotoData,
      reporterName: reporterName,
      caption: caption,
      reporterPhone: phone,
      status: 'possible_sighting',
      createdAt: new Date().toISOString()
    };

    window.pawStore.addSighting(sighting); // saved to community_sightings with its photo

    // Alert whoever reported the pet missing, through Supabase (it reaches their own device)
    if (reportId) window.pawStore.notifyReporter(reportId, 'sighting', { phone, location, notes });

    if (window.notifManager) {
      window.notifManager.showToast(`Possible Sighting pinned on Community Map! Notification dispatched to pet owner.`, 'success', 5000);
    }

    this.closeSightingModal();

    // Re-render views
    if (window.publicView && window.location.hash === '#map') {
      window.publicView.render(document.getElementById('app-viewport'));
    }
    if (window.ownerView && window.location.hash === '#owner') {
      window.ownerView.render(document.getElementById('app-viewport'));
    }
    if (window.sightingsView && window.location.hash === '#sightings') {
      window.sightingsView.render(document.getElementById('app-viewport'));
    }
  }
}

window.reportManager = new ReportManager();

// Shows the report form as a page. The form is built once in index.html; it is moved into the page
// while #report is open and parked again before another view replaces the page content.
class ReportPageView {
  render(container) {
    const page = document.getElementById('report-pet-modal');
    const manager = window.reportManager;
    if (!page || !manager) return;
    if (page.parentElement === container) return; // already showing: keep what has been typed

    if (!manager.formReady) manager.prepareForm('missing', null, {});
    container.innerHTML = '';
    page.hidden = false;
    container.appendChild(page);
    if (window.lucide) window.lucide.createIcons({ root: page });
    window.scrollTo(0, 0);
    setTimeout(() => manager.initPinMap(), 60);
  }

  park() {
    const page = document.getElementById('report-pet-modal');
    if (!page || page.parentElement === document.body) return;
    page.hidden = true;
    document.body.appendChild(page);
  }
}

window.reportPageView = new ReportPageView();
