/**
 * PawTrack profile picture picker, shared by the owner app and the admin console.
 *
 *   PawAvatar.mount(slot, { id, initial, picture, optional, onChange })   a field for a register form
 *   PawAvatar.value(id)        the chosen picture as a small square JPEG data URL, '' when none, or null when removed
 *   PawAvatar.reset(id)        clears the field
 *   PawAvatar.mountEditor(slot, { id, initial, picture, onSave })  a "Change photo" control that saves by itself (Settings)
 *
 * A picture is checked (a real JPG, PNG or WebP, up to 5 MB), cropped to a square and shrunk to 256 px, so what is
 * stored is small and carries nothing else from the original file (no metadata, no hidden data).
 */
(function (root) {
  'use strict';
  if (root.PawAvatar) return;

  var MAX_BYTES = 5 * 1024 * 1024;
  var SIZE = 256;
  var values = {};

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var css = '' +
    '.pav { display: grid; gap: 6px; }' +
    '.pav-label { font-size: 10.5px; letter-spacing: 0.05em; font-weight: 600; color: var(--auth-ink-muted, #6b7280); text-transform: uppercase; }' +
    '.pav-label span { text-transform: none; letter-spacing: 0; font-weight: 500; }' +
    '.pav-row { display: flex; align-items: center; gap: 14px; padding: 10px 14px; border-radius: 10px; border: 1px dashed var(--auth-field-border, #d1d5db); background: var(--auth-field-bg, #f3f4f6); }' +
    '.pav-preview { flex: none; width: 56px; height: 56px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: var(--auth-accent, #b85410); color: var(--auth-on-accent, #fff); font-weight: 800; font-size: 20px; }' +
    '.pav-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }' +
    '.pav-text { display: grid; gap: 4px; min-width: 0; }' +
    '.pav-btns { display: flex; gap: 8px; flex-wrap: wrap; }' +
    '.pav-btn { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--auth-field-border, #d1d5db); background: var(--auth-surface, #fff); color: var(--auth-ink, #111827); font: 600 12.5px inherit; font-family: inherit; cursor: pointer; }' +
    '.pav-btn:hover { border-color: var(--auth-accent, #b85410); color: var(--auth-accent, #b85410); }' +
    '.pav-btn.is-quiet { border-color: transparent; background: transparent; color: var(--auth-ink-muted, #6b7280); }' +
    '.pav-hint { font-size: 11.5px; color: var(--auth-ink-muted, #6b7280); }' +
    '.pav-hint.is-error { color: #dc2626; font-weight: 600; }' +
    '.pav-btn[hidden] { display: none; }' +
    '.pav.is-compact { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }' +
    '.pav.is-compact .pav-btn { padding: 5px 12px; }';
  function ensureStyle() {
    if (document.getElementById('pav-style')) return;
    var s = document.createElement('style');
    s.id = 'pav-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // The file really is an image (checked from its first bytes, not its name), then cropped and shrunk
  function process(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('No file chosen.'));
      if (!file.size) return reject(new Error('That file is empty.'));
      if (file.size > MAX_BYTES) return reject(new Error('That photo is over 5 MB.'));
      file.slice(0, 16).arrayBuffer().then(function (buf) {
        var h = new Uint8Array(buf);
        var jpg = h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF;
        var png = h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47;
        var webp = String.fromCharCode(h[0], h[1], h[2], h[3]) === 'RIFF' && String.fromCharCode(h[8], h[9], h[10], h[11]) === 'WEBP';
        if (!(jpg || png || webp)) throw new Error('Choose a JPG, PNG or WebP photo.');
        return createImageBitmap(file);
      }).then(function (bmp) {
        var side = Math.min(bmp.width, bmp.height);
        var canvas = document.createElement('canvas');
        canvas.width = SIZE; canvas.height = SIZE;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
        if (bmp.close) bmp.close();
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      }).catch(function (err) {
        reject(err && err.message && !/createImageBitmap|decode/i.test(err.message) ? err : new Error('That photo could not be read. Try another one.'));
      });
    });
  }

  function previewHtml(picture, initial) {
    return picture ? '<img src="' + esc(picture) + '" alt="" />' : esc((initial || '?').charAt(0).toUpperCase());
  }

  function build(opts, editor) {
    var id = opts.id;
    if (opts.compact) {
      // Buttons and a hint only: the page already shows the current picture
      return '<div class="pav is-compact" id="' + id + '-field">' +
        '<div class="pav-btns">' +
          '<button type="button" class="pav-btn" id="' + id + '-btn">' + (opts.picture ? 'Change photo' : 'Add photo') + '</button>' +
          '<button type="button" class="pav-btn is-quiet" id="' + id + '-remove"' + (opts.picture ? '' : ' hidden') + '>Remove</button>' +
        '</div>' +
        '<span class="pav-hint" id="' + id + '-hint">JPG, PNG or WebP, up to 5 MB</span>' +
        '<span id="' + id + '-preview" hidden></span>' +
        '<input type="file" id="' + id + '-file" accept="image/jpeg,image/png,image/webp" hidden />' +
      '</div>';
    }
    return '<div class="pav" id="' + id + '-field">' +
      '<span class="pav-label">Profile picture' + (opts.optional === false ? '' : ' <span>(optional)</span>') + '</span>' +
      '<div class="pav-row">' +
        '<span class="pav-preview" id="' + id + '-preview">' + previewHtml(opts.picture, opts.initial) + '</span>' +
        '<div class="pav-text">' +
          '<div class="pav-btns">' +
            '<button type="button" class="pav-btn" id="' + id + '-btn">' + (opts.picture ? 'Change photo' : 'Add photo') + '</button>' +
            '<button type="button" class="pav-btn is-quiet" id="' + id + '-remove"' + (opts.picture ? '' : ' hidden') + '>Remove</button>' +
          '</div>' +
          '<span class="pav-hint" id="' + id + '-hint">' + (editor ? 'JPG, PNG or WebP, up to 5 MB. Saved when you choose it.' : 'JPG, PNG or WebP, up to 5 MB') + '</span>' +
        '</div>' +
        '<input type="file" id="' + id + '-file" accept="image/jpeg,image/png,image/webp" hidden />' +
      '</div></div>';
  }

  function wire(slot, opts, editor) {
    var id = opts.id;
    var $ = function (s) { return slot.querySelector('#' + id + '-' + s); };
    var preview = $('preview'), btn = $('btn'), remove = $('remove'), file = $('file'), hint = $('hint');
    var initial = opts.initial;
    var say = function (text, bad) { hint.textContent = text; hint.classList.toggle('is-error', !!bad); };
    var paint = function (picture) {
      if (!opts.compact) preview.innerHTML = previewHtml(picture, initial);
      btn.textContent = picture ? 'Change photo' : 'Add photo';
      remove.hidden = !picture;
    };
    btn.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      file.value = '';
      if (!f) return;
      say('Preparing your photo…');
      process(f).then(function (data) {
        if (editor) {
          btn.disabled = true; remove.disabled = true;
          return Promise.resolve(opts.onSave(data)).then(function (ok) {
            btn.disabled = false; remove.disabled = false;
            if (ok === false) { say('Could not save your photo. Try again.', true); return; }
            paint(data); say(opts.compact ? 'Saved.' : 'JPG, PNG or WebP, up to 5 MB. Saved when you choose it.');
          });
        }
        values[id] = data; paint(data); say('Looks good.');
        if (opts.onChange) opts.onChange(data);
      }).catch(function (err) { btn.disabled = false; remove.disabled = false; say(err.message, true); });
    });
    remove.addEventListener('click', function () {
      if (editor) {
        btn.disabled = true; remove.disabled = true;
        Promise.resolve(opts.onSave(null)).then(function (ok) {
          btn.disabled = false; remove.disabled = false;
          if (ok === false) { say('Could not remove your photo. Try again.', true); return; }
          paint(''); say('Photo removed.');
        });
        return;
      }
      values[id] = ''; paint(''); say('JPG, PNG or WebP, up to 5 MB');
      if (opts.onChange) opts.onChange('');
    });
    return { paint: paint };
  }

  root.PawAvatar = {
    process: process,
    mount: function (slot, opts) {
      if (typeof slot === 'string') slot = document.getElementById(slot);
      if (!slot) return null;
      ensureStyle();
      values[opts.id] = opts.picture || '';
      slot.innerHTML = build(opts, false);
      return wire(slot, opts, false);
    },
    mountEditor: function (slot, opts) {
      if (typeof slot === 'string') slot = document.getElementById(slot);
      if (!slot) return null;
      ensureStyle();
      slot.innerHTML = build(opts, true);
      return wire(slot, opts, true);
    },
    value: function (id) { return values[id] || ''; },
    reset: function (id) {
      values[id] = '';
      var f = document.getElementById(id + '-field');
      if (f) {
        var p = f.querySelector('.pav-preview'); if (p) p.textContent = '?';
        var b = f.querySelector('#' + id + '-btn'); if (b) b.textContent = 'Add photo';
        var r = f.querySelector('#' + id + '-remove'); if (r) r.hidden = true;
      }
    }
  };
})(window);
