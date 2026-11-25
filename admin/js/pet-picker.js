/**
 * PawTrack Admin — pet picker and field help
 *
 *   PetPicker.create(select)   replaces a native <select> of pets with a searchable list that shows each pet's photo.
 *                              The select stays in the form (hidden) and receives the value and a 'change' event,
 *                              so existing code that listens to it keeps working. Tapping a photo enlarges it.
 *   FieldHelp.attach(form, map) adds an (i) button beside each label; tapping it shows what the field is for.
 *
 * Each <option> of the select supplies: value, data-name, data-rfid, data-photo, data-owner, data-species, data-breed.
 */
(function () {
  'use strict';

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PAW = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 10.5c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-6 2c1.38 0 2.5-1.12 2.5-2.5S7.38 7.5 6 7.5 3.5 8.62 3.5 10s1.12 2.5 2.5 2.5zm12 0c1.38 0 2.5-1.12 2.5-2.5S19.38 7.5 18 7.5s-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zM12 12c-2.76 0-5 2.24-5 5 0 2.21 1.79 4 4 4 1.1 0 2-.9 2-2 0 1.1.9 2 2 2 2.21 0 4-1.79 4-4 0-2.76-2.24-5-5-5z"/></svg>';
  const CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const ZOOM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>';
  let uid = 0;

  // ---------- full-size photo ----------
  function lightbox(src, caption) {
    const overlay = document.createElement('div');
    overlay.className = 'pp-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', caption || 'Photo');
    overlay.innerHTML = `
      <figure class="pp-lightbox-box">
        <img src="${esc(src)}" alt="${esc(caption || '')}" />
        ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}
        <button type="button" class="pp-lightbox-close" aria-label="Close photo">&times;</button>
      </figure>`;
    const previous = document.activeElement;
    const close = () => {
      document.removeEventListener('keydown', onKey, true);
      overlay.classList.remove('is-open');
      setTimeout(() => overlay.remove(), 160);
      if (previous && previous.focus) previous.focus({ preventScroll: true });
    };
    // Escape closes the photo only, not the dialog underneath it
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); }
    };
    overlay.addEventListener('click', (e) => { if (!e.target.closest('img')) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    overlay.querySelector('.pp-lightbox-close').focus({ preventScroll: true });
  }

  // ---------- pet picker ----------
  function create(select) {
    if (!select || select.dataset.petPicker) return null;
    select.dataset.petPicker = '1';

    const items = Array.from(select.options).map((o) => ({
      value: o.value,
      name: o.dataset.name || '',
      rfid: o.dataset.rfid || '',
      photo: o.dataset.photo || '',
      owner: o.dataset.owner || '',
      species: o.dataset.species || '',
      breed: o.dataset.breed || '',
      label: o.textContent.trim()
    }));
    const id = ++uid;

    const thumb = (it, extra = '') => it.photo
      ? `<img class="pp-img ${extra}" src="${esc(it.photo)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'pp-img pp-fallback ${extra}',innerHTML:this.dataset.fb}))" data-fb="${esc(PAW)}" />`
      : `<span class="pp-img pp-fallback ${extra}">${PAW}</span>`;
    const meta = (it) => [it.rfid ? it.rfid : 'No tag', it.owner].filter(Boolean).join(' · ');

    const root = document.createElement('div');
    root.className = 'pp';
    root.innerHTML = `
      <button type="button" class="form-control pp-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="pp-list-${id}"></button>
      <div class="pp-pop" hidden>
        <input type="search" class="form-control pp-search" placeholder="Search name, tag or owner" aria-label="Search registered pets" autocomplete="off" />
        <ul class="pp-list" id="pp-list-${id}" role="listbox" aria-label="Registered pets"></ul>
      </div>
      <div class="pp-preview" hidden></div>`;
    select.insertAdjacentElement('afterend', root);
    select.hidden = true;
    select.tabIndex = -1;

    const trigger = root.querySelector('.pp-trigger');
    const pop = root.querySelector('.pp-pop');
    const search = root.querySelector('.pp-search');
    const list = root.querySelector('.pp-list');
    const preview = root.querySelector('.pp-preview');
    let active = -1;

    const selected = () => items.find((it) => it.value === select.value) || items[0];

    const paintTrigger = () => {
      const it = selected();
      trigger.innerHTML = it.value
        ? `${thumb(it, 'pp-img-sm')}<span class="pp-text"><b>${esc(it.name)}</b><small>${esc(meta(it))}</small></span>${CHEVRON}`
        : `<span class="pp-img pp-img-sm pp-fallback">${PAW}</span><span class="pp-text"><b>Unregistered / stray animal</b><small>Not linked to a PawTrack pet</small></span>${CHEVRON}`;
    };

    // Picking a pet shows its photo large, with a hint that it can be enlarged further
    const paintPreview = () => {
      const it = selected();
      if (!it.value) { preview.hidden = true; preview.innerHTML = ''; return; }
      preview.hidden = false;
      preview.innerHTML = `
        ${it.photo ? `<button type="button" class="pp-preview-photo" aria-label="Enlarge photo of ${esc(it.name)}"><img src="${esc(it.photo)}" alt="${esc(it.name)}" />${`<span class="pp-zoom-badge">${ZOOM}</span>`}</button>` : `<span class="pp-preview-photo pp-fallback">${PAW}</span>`}
        <div class="pp-preview-info">
          <b>${esc(it.name)}</b>
          <span>${esc([it.species, it.breed].filter(Boolean).join(' · ') || 'Registered pet')}</span>
          <span>${esc(it.owner ? 'Guardian: ' + it.owner : 'Guardian not on record')}</span>
          <small>${it.photo ? 'Tap the photo to enlarge it. ' : ''}Details below were filled in from this pet.</small>
        </div>`;
      preview.querySelector('.pp-preview-photo[aria-label]')?.addEventListener('click', () => lightbox(it.photo, it.name));
    };

    const visible = () => {
      const q = search.value.trim().toLowerCase();
      return items.filter((it) => !q || !it.value || `${it.name} ${it.rfid} ${it.owner}`.toLowerCase().includes(q));
    };

    const paintList = () => {
      const rows = visible();
      list.innerHTML = rows.length ? rows.map((it, i) => `
        <li role="option" class="pp-opt ${it.value === select.value ? 'is-selected' : ''} ${i === active ? 'is-active' : ''}" data-value="${esc(it.value)}" id="pp-${id}-${i}" aria-selected="${it.value === select.value}">
          ${it.value && it.photo
            ? `<button type="button" class="pp-zoom" data-zoom="${esc(it.value)}" aria-label="Enlarge photo of ${esc(it.name)}" tabindex="-1">${thumb(it)}<span class="pp-zoom-badge">${ZOOM}</span></button>`
            : `<span class="pp-zoom">${it.value ? thumb(it) : `<span class="pp-img pp-fallback">${PAW}</span>`}</span>`}
          <span class="pp-text"><b>${esc(it.value ? it.name : 'Unregistered / stray animal')}</b><small>${esc(it.value ? meta(it) : 'Not linked to a PawTrack pet')}</small></span>
        </li>`).join('') : '<li class="pp-empty" role="presentation">No registered pet matches that search.</li>';
    };

    const choose = (value) => {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true })); // runs the form's existing auto-fill
      paintTrigger();
      paintPreview();
      close();
      trigger.focus({ preventScroll: true });
    };

    const open = () => {
      pop.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      root.classList.add('is-open');
      search.value = '';
      active = visible().findIndex((it) => it.value === select.value);
      paintList();
      search.focus({ preventScroll: true });
      const cur = list.querySelector('.is-selected');
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    };
    function close() {
      pop.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      root.classList.remove('is-open');
    }

    trigger.addEventListener('click', () => (pop.hidden ? open() : close()));
    trigger.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (pop.hidden) open(); } });

    search.addEventListener('input', () => { active = 0; paintList(); });
    const move = (delta) => {
      const n = list.querySelectorAll('.pp-opt').length;
      if (!n) return;
      active = (active + delta + n) % n;
      paintList();
      list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
      search.setAttribute('aria-activedescendant', `pp-${id}-${active}`);
    };
    root.addEventListener('keydown', (e) => {
      if (pop.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' && e.target === search) {
        e.preventDefault();
        const row = list.querySelectorAll('.pp-opt')[Math.max(active, 0)];
        if (row) choose(row.getAttribute('data-value'));
      } else if (e.key === 'Escape') { e.stopPropagation(); close(); trigger.focus({ preventScroll: true }); }
    });

    list.addEventListener('click', (e) => {
      const zoom = e.target.closest('[data-zoom]');
      if (zoom) {                                  // the photo enlarges; the row is not picked
        e.stopPropagation();
        const it = items.find((x) => x.value === zoom.getAttribute('data-zoom'));
        if (it) lightbox(it.photo, it.name);
        return;
      }
      const row = e.target.closest('.pp-opt');
      if (row) choose(row.getAttribute('data-value'));
    });
    list.addEventListener('mousemove', (e) => {
      const row = e.target.closest('.pp-opt');
      if (!row) return;
      const idx = Array.from(list.querySelectorAll('.pp-opt')).indexOf(row);
      if (idx !== active) { active = idx; list.querySelectorAll('.pp-opt').forEach((r, i) => r.classList.toggle('is-active', i === active)); }
    });
    document.addEventListener('click', (e) => { if (!root.isConnected) return; if (!root.contains(e.target)) close(); });

    paintTrigger();
    paintPreview();
    return { open, close, choose };
  }

  // ---------- field help ----------
  const FieldHelp = {
    // What each field of the animal intake form is for
    INTAKE: {
      petSelect: 'Pick a pet that is already registered in PawTrack to fill in its details and alert its guardian. Leave it on "Unregistered / stray animal" when there is no PawTrack record.',
      petName: 'The name this animal is recorded under. For a stray, use a short description such as "Brown dog, torn left ear".',
      rfidTag: 'The code on the collar tag or implant. It links the intake to the pet\'s record. Leave it empty when there is no tag.',
      species: 'The kind of animal. Choose Other when it is not one of the listed species.',
      breed: 'The breed, if you can tell. "Aspin" or "mixed" is fine.',
      age: 'Your best estimate, for example "2 years" or "6 months".',
      facilityDisplay: 'The facility you work for. Every intake is recorded against it, and it can\'t be changed here.',
      cageNumber: 'Where the animal is being kept, for example "Cage 12". Staff use it to find the animal quickly.',
      impoundLocation: 'Where the animal was picked up, such as a street corner or landmark. It helps the guardian and field staff.',
      intakeOfficer: 'The person receiving the animal. It is filled in with your name.',
      feesAccumulated: 'The daily holding fee the guardian pays to claim the animal. It starts at the default fee.',
      healthCondition: 'Injuries, appetite, hydration or behaviour you noticed at intake. It helps the vet and the guardian.'
    },

    // The explanation floats beside the (i) instead of sitting in the form, so the layout never moves.
    // Hover or focus shows it; a tap or click pins it open (touch screens); Escape or a click elsewhere closes it.
    attach(form, map) {
      if (!form) return;
      let tip = null;
      let current = null;   // the (i) button whose tip is showing
      let pinned = false;

      const place = () => {
        if (!tip || !current) return;
        const r = current.getBoundingClientRect();
        const margin = 8;
        tip.style.maxWidth = Math.min(280, window.innerWidth - margin * 2) + 'px';
        const t = tip.getBoundingClientRect();
        let left = r.left + r.width / 2 - t.width / 2;
        left = Math.max(margin, Math.min(left, window.innerWidth - t.width - margin));
        const above = r.top - t.height - 10 >= margin;           // prefer above, flip below when there is no room
        const top = above ? r.top - t.height - 10 : r.bottom + 10;
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
        tip.classList.toggle('is-below', !above);
        tip.style.setProperty('--arrow-x', Math.round(r.left + r.width / 2 - left) + 'px');
      };
      const hide = () => {
        if (current) current.setAttribute('aria-expanded', 'false');
        if (current) current.removeAttribute('aria-describedby');
        if (tip) { tip.remove(); tip = null; }
        current = null;
        pinned = false;
      };
      const show = (btn, text) => {
        if (current === btn) return;
        hide();
        current = btn;
        tip = document.createElement('div');
        tip.className = 'fld-tip';
        tip.id = 'fld-tip-live';
        tip.setAttribute('role', 'tooltip');
        tip.textContent = text;
        document.body.appendChild(tip);
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-describedby', tip.id);
        place();
        requestAnimationFrame(() => tip && tip.classList.add('is-visible'));
      };

      form.querySelectorAll('.form-group').forEach((group) => {
        const field = group.querySelector('[name]');
        const label = group.querySelector('.form-label');
        const text = field && map[field.getAttribute('name')];
        if (!label || !text || label.querySelector('.fld-info')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fld-info';
        btn.setAttribute('aria-label', 'What is this field?');
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = 'i';
        label.appendChild(btn);

        btn.addEventListener('mouseenter', () => { if (!pinned) show(btn, text); });
        btn.addEventListener('mouseleave', () => { if (!pinned) hide(); });
        btn.addEventListener('focus', () => { if (!pinned) show(btn, text); });
        btn.addEventListener('blur', () => { if (!pinned) hide(); });
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (current === btn && pinned) { hide(); return; }
          show(btn, text);
          pinned = true;
        });
      });

      // Closing and keeping it in place
      form.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) { e.stopPropagation(); hide(); } }, true);
      document.addEventListener('click', (e) => { if (current && (!form.isConnected || !e.target.closest('.fld-info'))) hide(); });
      const scroller = form.closest('.modal-body');
      if (scroller) scroller.addEventListener('scroll', place, { passive: true });
      window.addEventListener('resize', place);
    }
  };

  window.PetPicker = { create, lightbox };
  window.FieldHelp = FieldHelp;
})();
