/**
 * Sign-in and sign-up email fields never hold an NFC / RFID tag code. A tag tapped on a phone, or a USB reader that types
 * like a keyboard, could otherwise drop a code such as PT-AB12CD34 into whichever field has focus. Such a value is
 * cleared as soon as it appears, and nothing that looks like one is accepted from a paste.
 */
(function (root) {
  'use strict';
  if (root.PawLoginGuard) return;
  // Email fields only: a password can legitimately be any string, so passwords are never touched
  var IDS = ['login-email', 'register-email', 'forgot-email', 'change-email-input', 'admin-login-email', 'admin-signup-email'];
  // A PawTrack tag id, or a bare chip / reader serial (hex pairs, or a long run of digits that is not an email)
  var TAG = /^(PT-[A-Z0-9]{4,}|([0-9A-F]{2}:){3,}[0-9A-F]{2}|[0-9A-F]{8,16}|\d{9,15})$/i;

  function looksLikeTag(v) {
    v = String(v || '').trim();
    return v !== '' && v.indexOf('@') === -1 && TAG.test(v);
  }

  function guard(el) {
    if (!el || el.dataset.noTag) return;
    el.dataset.noTag = '1';
    var clean = function () { if (looksLikeTag(el.value)) el.value = ''; };
    el.addEventListener('input', clean);
    el.addEventListener('change', clean);
    el.addEventListener('paste', function (e) {
      var text = (e.clipboardData && e.clipboardData.getData('text')) || '';
      if (looksLikeTag(text)) e.preventDefault();
    });
    clean();
  }

  function run() { IDS.forEach(function (id) { guard(document.getElementById(id)); }); }

  root.PawLoginGuard = { looksLikeTag: looksLikeTag, run: run };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  // Fields can be created later (modals), and a tag can arrive from the address (?nfc=...) while a form is open
  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
})(window);
