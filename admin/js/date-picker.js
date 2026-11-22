/**
 * PawTrack Admin: custom date picker.
 *
 * Replaces the browser's own calendar on date fields marked  input[type="date"].auth-field-input  with one that
 * matches the sign-in screen (light and dark). The real input stays in the page as a hidden field and keeps its
 * value as an ISO date (YYYY-MM-DD), so the form code reads and validates it exactly as before. Its .min and .max
 * (ISO dates) are read each time the calendar opens, and setting .value from code refreshes what the field shows.
 *
 * Views inside the popover: days -> months -> years (tap the month title to jump years quickly, which is what a
 * birth date needs). Keyboard: Escape closes, arrow keys move between days, Enter picks.
 */
(function () {
  'use strict';
  if (window.AdminDatePicker) return;

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  var ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  var PREV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  var NEXT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  var CHEV = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  var openPicker = null;

  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var iso = function (y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); };
  var parse = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    var dt = new Date(y, mo, d);
    return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d ? { y: y, m: mo, d: d } : null;
  };
  var daysIn = function (y, m) { return new Date(y, m + 1, 0).getDate(); };
  var pretty = function (s) {
    var p = parse(s);
    return p ? MONTHS[p.m] + ' ' + p.d + ', ' + p.y : '';
  };

  function Picker(input) {
    this.input = input;
    this.view = 'days';
    this.build();
    this.sync();
  }

  Picker.prototype.build = function () {
    var self = this;
    var input = this.input;
    var box = input.closest('.auth-field-box') || input.parentElement;
    this.box = box;
    box.classList.add('dp-box');

    // The real input keeps the value but is no longer shown
    var proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    var min = input.getAttribute('min');
    var max = input.getAttribute('max');
    input.type = 'hidden';
    if (min && !input.min) input.min = min;
    if (max && !input.max) input.max = max;
    // Setting .value from code (a form reset, say) must refresh the field text
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: function () { return proto.get.call(input); },
      set: function (v) { proto.set.call(input, v); self.sync(); }
    });

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-trigger';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="dp-value"></span><span class="dp-trigger-icon">' + ICON + '</span>';
    input.insertAdjacentElement('afterend', btn);
    this.btn = btn;
    this.valueEl = btn.querySelector('.dp-value');

    var label = box.querySelector('label[for="' + input.id + '"]');
    if (label) {
      label.setAttribute('for', '');
      label.removeAttribute('for');
      label.id = label.id || input.id + '-label';
      btn.setAttribute('aria-labelledby', label.id + ' ' + (btn.id = btn.id || input.id + '-btn'));
      label.addEventListener('click', function () { btn.focus(); self.toggle(); });
    }

    btn.addEventListener('click', function () { self.toggle(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.open(); }
    });

    var pop = document.createElement('div');
    pop.className = 'dp-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Choose a date');
    pop.hidden = true;
    pop.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep focus where it was
    box.appendChild(pop);
    this.pop = pop;

    pop.addEventListener('click', function (e) { self.onClick(e); });
    pop.addEventListener('keydown', function (e) { self.onKey(e); });
  };

  Picker.prototype.limits = function () {
    return { min: parse(this.input.min), max: parse(this.input.max) };
  };

  Picker.prototype.sync = function () {
    var text = pretty(this.input.value);
    this.valueEl.textContent = text || 'Select a date';
    this.valueEl.classList.toggle('is-empty', !text);
  };

  Picker.prototype.toggle = function () { if (this.pop.hidden) this.open(); else this.close(); };

  Picker.prototype.open = function () {
    if (openPicker && openPicker !== this) openPicker.close();
    openPicker = this;
    var current = parse(this.input.value);
    var lim = this.limits();
    // Start on the chosen date; with none, on the latest allowed date (the youngest permitted birth date)
    var start = current || lim.max || { y: new Date().getFullYear(), m: new Date().getMonth(), d: 1 };
    this.cursor = { y: start.y, m: start.m };
    this.focusDay = current ? current.d : (lim.max ? lim.max.d : 1);
    this.view = 'days';
    this.render();
    this.pop.hidden = false;
    this.btn.setAttribute('aria-expanded', 'true');

    // Open upward when there is no room below
    var rect = this.box.getBoundingClientRect();
    var room = window.innerHeight - rect.bottom;
    this.pop.classList.toggle('dp-up', room < 340 && rect.top > room);

    var self = this;
    this.outside = function (e) { if (!self.box.contains(e.target)) self.close(); };
    document.addEventListener('mousedown', this.outside, true);
    document.addEventListener('touchstart', this.outside, true);
    this.focusSelected();
    // The card scrolls: bring the whole calendar into view
    try { this.pop.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* older browsers */ }
  };

  Picker.prototype.close = function (refocus) {
    if (this.pop.hidden) return;
    this.pop.hidden = true;
    this.btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', this.outside, true);
    document.removeEventListener('touchstart', this.outside, true);
    if (openPicker === this) openPicker = null;
    if (refocus) this.btn.focus();
  };

  Picker.prototype.inRange = function (y, m, d) {
    var lim = this.limits();
    var v = iso(y, m, d);
    if (lim.min && v < iso(lim.min.y, lim.min.m, lim.min.d)) return false;
    if (lim.max && v > iso(lim.max.y, lim.max.m, lim.max.d)) return false;
    return true;
  };
  Picker.prototype.monthAllowed = function (y, m) {
    return this.inRange(y, m, 1) || this.inRange(y, m, daysIn(y, m));
  };
  Picker.prototype.yearAllowed = function (y) {
    var lim = this.limits();
    return (!lim.min || y >= lim.min.y) && (!lim.max || y <= lim.max.y);
  };

  Picker.prototype.render = function () {
    var c = this.cursor;
    var html = '';
    if (this.view === 'days') {
      html += this.head(MONTHS[c.m] + ' ' + c.y, this.shiftOk(-1), this.shiftOk(1));
      html += '<div class="dp-dow" aria-hidden="true">' + DOW.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>';
      html += '<div class="dp-grid" role="grid">';
      var first = new Date(c.y, c.m, 1).getDay();
      for (var i = 0; i < first; i++) html += '<span class="dp-blank"></span>';
      var sel = parse(this.input.value);
      var total = daysIn(c.y, c.m);
      for (var d = 1; d <= total; d++) {
        var ok = this.inRange(c.y, c.m, d);
        var picked = sel && sel.y === c.y && sel.m === c.m && sel.d === d;
        html += '<button type="button" class="dp-day' + (picked ? ' is-selected' : '') + '" data-day="' + d + '"' +
          (ok ? '' : ' disabled') + ' tabindex="' + (d === this.focusDay ? '0' : '-1') + '"' +
          ' aria-label="' + MONTHS[c.m] + ' ' + d + ', ' + c.y + '"' + (picked ? ' aria-pressed="true"' : '') + '>' + d + '</button>';
      }
      html += '</div>';
    } else if (this.view === 'months') {
      html += this.head(String(c.y), this.yearAllowed(c.y - 1), this.yearAllowed(c.y + 1), true);
      html += '<div class="dp-cells">';
      for (var m = 0; m < 12; m++) {
        var okm = this.monthAllowed(c.y, m);
        html += '<button type="button" class="dp-cell' + (m === c.m ? ' is-current' : '') + '" data-month="' + m + '"' + (okm ? '' : ' disabled') + '>' + MONTHS[m].slice(0, 3) + '</button>';
      }
      html += '</div>';
    } else {
      var base = c.y - (c.y % 12);
      html += this.head(base + ' - ' + (base + 11), this.yearAllowed(base - 1), this.yearAllowed(base + 12), true);
      html += '<div class="dp-cells">';
      for (var y = base; y < base + 12; y++) {
        var oky = this.yearAllowed(y);
        html += '<button type="button" class="dp-cell' + (y === c.y ? ' is-current' : '') + '" data-year="' + y + '"' + (oky ? '' : ' disabled') + '>' + y + '</button>';
      }
      html += '</div>';
    }
    this.pop.innerHTML = html;
  };

  // Can the month before / after the one shown be reached?
  Picker.prototype.shiftOk = function (dir) {
    var c = this.cursor;
    var m = c.m + dir, y = c.y;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    return this.monthAllowed(y, m);
  };

  Picker.prototype.head = function (title, prevOk, nextOk, plainTitle) {
    return '<div class="dp-head">' +
      '<button type="button" class="dp-nav" data-nav="-1" aria-label="Previous"' + (prevOk ? '' : ' disabled') + '>' + PREV + '</button>' +
      '<button type="button" class="dp-title" data-title="1" aria-live="polite">' + title + (this.view === 'years' ? '' : CHEV) + '</button>' +
      '<button type="button" class="dp-nav" data-nav="1" aria-label="Next"' + (nextOk ? '' : ' disabled') + '>' + NEXT + '</button>' +
      '</div>';
  };

  Picker.prototype.onClick = function (e) {
    var t = e.target.closest('button');
    if (!t || t.disabled) return;
    var c = this.cursor;
    if (t.dataset.nav) {
      var dir = +t.dataset.nav;
      if (this.view === 'days') { c.m += dir; if (c.m < 0) { c.m = 11; c.y--; } if (c.m > 11) { c.m = 0; c.y++; } }
      else if (this.view === 'months') c.y += dir;
      else c.y += dir * 12;
      this.render();
    } else if (t.dataset.title) {
      this.view = this.view === 'days' ? 'months' : this.view === 'months' ? 'years' : 'days';
      this.render();
    } else if (t.dataset.year) {
      c.y = +t.dataset.year;
      this.view = 'months';
      this.render();
    } else if (t.dataset.month) {
      c.m = +t.dataset.month;
      this.view = 'days';
      this.focusDay = Math.min(this.focusDay, daysIn(c.y, c.m));
      this.render();
    } else if (t.dataset.day) {
      this.pick(c.y, c.m, +t.dataset.day);
    }
  };

  Picker.prototype.pick = function (y, m, d) {
    this.input.value = iso(y, m, d); // refreshes the field text through the setter above
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
    this.close(true);
  };

  Picker.prototype.focusSelected = function () {
    var el = this.pop.querySelector('.dp-day[tabindex="0"]:not([disabled])') || this.pop.querySelector('.dp-day:not([disabled])');
    if (el) el.focus({ preventScroll: true });
  };

  Picker.prototype.onKey = function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); this.close(true); return; }
    var day = e.target.closest && e.target.closest('.dp-day');
    if (!day) return;
    var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    var c = this.cursor;
    var date = new Date(c.y, c.m, +day.dataset.day + step);
    if (!this.inRange(date.getFullYear(), date.getMonth(), date.getDate())) return;
    this.cursor = { y: date.getFullYear(), m: date.getMonth() };
    this.focusDay = date.getDate();
    this.render();
    this.focusSelected();
  };

  function init(root) {
    (root || document).querySelectorAll('input[type="date"].auth-field-input').forEach(function (input) {
      if (!input._datePicker) input._datePicker = new Picker(input);
    });
  }

  window.AdminDatePicker = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();
