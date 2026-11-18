/**
 * PawTrack Admin: the facility photo field.
 * A picker with a live preview, plus the helpers that shrink the picture and store it in the public
 * "facility-photos" Supabase bucket (one folder per facility: facility-photos/<shelter id>/<file>.jpg).
 *
 *   FacilityPhoto.fieldHtml(currentUrl)  markup for the field
 *   FacilityPhoto.bind(root)             wires it up; returns { blob(), removed(), has(), nudge(show) }
 *   FacilityPhoto.shrink(file)           Promise<Blob> (JPEG, longest side 1200px)
 *   FacilityPhoto.pathFor(shelterId)     the storage path for a new file
 */
(function () {
  'use strict';
  if (window.FacilityPhoto) return;

  var MAX_BYTES = 12 * 1024 * 1024;   // what we accept from the camera or gallery; it is shrunk before upload
  var TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };

  function fieldHtml(currentUrl) {
    var has = /^https:\/\//.test(currentUrl || '');
    return '' +
      '<div class="fp" id="fp-root" data-state="' + (has ? 'filled' : 'empty') + '">' +
        '<div class="fp-frame">' +
          '<img class="fp-img" id="fp-img" alt="Facility photo preview" ' + (has ? 'src="' + esc(currentUrl) + '"' : 'hidden') + ' />' +
          '<label class="fp-drop" for="fp-input">' +
            '<span class="fp-ic" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 1 2-2h2l1.5-2h7L17 7h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg></span>' +
            '<b>Add a photo of the facility</b>' +
            '<small>Tap to take or choose a picture. JPG, PNG or WebP.</small>' +
          '</label>' +
        '</div>' +
        '<div class="fp-actions">' +
          '<label class="btn btn-secondary btn-sm" for="fp-input" id="fp-change">Change photo</label>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="fp-remove">Remove</button>' +
        '</div>' +
        '<input type="file" id="fp-input" accept="image/jpeg,image/png,image/webp" class="fp-file" />' +
        '<div class="fp-error" id="fp-error" role="alert" hidden></div>' +
        '<div class="fp-nudge" id="fp-nudge" hidden>' +
          '<b>No photo yet.</b> Owners recognise a facility faster when they can see it. Add one now, or save without a photo and add it later.' +
        '</div>' +
      '</div>';
  }

  function bind(root) {
    var box = root.querySelector('#fp-root');
    var input = root.querySelector('#fp-input');
    var img = root.querySelector('#fp-img');
    var err = root.querySelector('#fp-error');
    var nudge = root.querySelector('#fp-nudge');
    var original = img && img.getAttribute('src') ? img.getAttribute('src') : '';
    var picked = null;      // the shrunk image waiting to be uploaded
    var removed = false;    // the saved photo is to be cleared
    var objectUrl = null;

    function setState(state) { box.setAttribute('data-state', state); }
    function showError(msg) { err.textContent = msg || ''; err.hidden = !msg; }

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      showError('');
      if (!file) return;
      if (TYPES.indexOf(file.type) < 0) { showError('Choose a JPG, PNG or WebP picture.'); input.value = ''; return; }
      if (file.size > MAX_BYTES) { showError('That picture is too large. Choose one under 12 MB.'); input.value = ''; return; }
      setState('loading');
      shrink(file).then(function (blob) {
        picked = blob;
        removed = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);
        img.src = objectUrl;
        img.hidden = false;
        setState('filled');
        if (nudge) nudge.hidden = true;
      }).catch(function () {
        showError('That picture could not be read. Try another one.');
        setState(original && !removed ? 'filled' : 'empty');
      });
    });

    root.querySelector('#fp-remove').addEventListener('click', function () {
      picked = null;
      removed = !!original;
      input.value = '';
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      img.removeAttribute('src');
      img.hidden = true;
      showError('');
      setState('empty');
    });

    return {
      blob: function () { return picked; },
      removed: function () { return removed && !picked; },
      has: function () { return !!picked || (!!original && !removed); },
      nudge: function (show) {
        if (nudge) nudge.hidden = !show;
        if (show && box.scrollIntoView) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
  }

  // Draws the picture onto a canvas no larger than 1200px and re-encodes it as a JPEG
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';   // a transparent PNG would turn black as a JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) { return blob ? resolve(blob) : reject(new Error('encode failed')); }, 'image/jpeg', 0.85);
      };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error('unreadable image')); };
      image.src = url;
    });
  }

  function pathFor(shelterId) {
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    return shelterId + '/' + id + '.jpg';
  }

  window.FacilityPhoto = { fieldHtml: fieldHtml, bind: bind, shrink: shrink, pathFor: pathFor };
})();
