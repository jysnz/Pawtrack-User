/**
 * PawTrack splash screen (owner app and admin console).
 *
 * Loaded as a plain script at the top of <head>, so the splash is painted before the app builds anything.
 * It leaves once the page has loaded, after a short minimum so the animation reads as intentional, and (admin)
 * after the console has finished checking a saved sign-in. A safety timeout means it can never get stuck.
 * When it leaves, the logo flies to the place of the logo in the page.
 *
 *   <script src="js/splash.js" data-logo="owner" data-target=".logo-icon-box"></script>
 *   <script src="../js/splash.js" data-label="Admin Console" data-target=".brand-badge"></script>
 *
 *   data-logo     "owner" draws the owner app's logo (gradient disc, golden paw); otherwise the admin badge
 *   data-target   CSS selector of the page's logo; the first one that is really visible is flown to
 *   data-label    small text under the name (a default tagline is used when missing)
 *
 * PawSplash.hide() dismisses it early; PawSplash.hold() keeps it up until release() is called.
 */
(function () {
  'use strict';
  if (window.PawSplash) return;

  var MIN_MS = 2200;          // shortest time on screen: long enough for the whole animation to play and settle
  var MAX_MS = 7000;          // never longer than this
  var FLY_MS = 820;           // the logo's trip to its place in the page
  var started = Date.now();
  var root = document.documentElement;
  var script = document.currentScript;
  var attr = function (n) { return (script && script.getAttribute(n)) || ''; };
  var label = attr('data-label');
  var owner = attr('data-logo') === 'owner';
  var targetSelector = attr('data-target');
  var tagline = label || 'Reuniting pets with their people';

  var NAME = 'PawTrack';
  var letters = NAME.split('').map(function (c, i) {
    return '<span class="pt-ch" style="--i:' + i + '">' + c + '</span>';
  }).join('');

  var PAW = 'M12 10.5c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-6 2c1.38 0 2.5-1.12 2.5-2.5S7.38 7.5 6 7.5 3.5 8.62 3.5 10s1.12 2.5 2.5 2.5zm12 0c1.38 0 2.5-1.12 2.5-2.5S19.38 7.5 18 7.5s-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zM12 12c-2.76 0-5 2.24-5 5 0 2.21 1.79 4 4 4 1.1 0 2-.9 2-2 0 1.1.9 2 2 2 2.21 0 4-1.79 4-4 0-2.76-2.24-5-5-5z';
  var PRINT = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="' + PAW + '"/></svg>';
  var trail = '';
  for (var n = 0; n < 6; n++) trail += '<span class="pt-print" style="--i:' + n + '">' + PRINT + '</span>';

  // The owner app's logo: gradient disc, golden paw, pale border (same look as the header logo, only bigger)
  var ownerMark = '<div class="pt-logo pt-flyable"><svg viewBox="0 0 24 24" fill="currentColor"><path d="' + PAW + '"/></svg></div>';
  // The admin badge: black disc, white paw, outline that draws itself
  var adminMark =
    '<svg class="pt-flyable" viewBox="0 0 64 64">' +
      '<circle class="pt-disc" cx="32" cy="32" r="30" fill="#000"/>' +
      '<circle class="pt-draw" cx="32" cy="32" r="30" fill="none" stroke="#c2410c" stroke-width="1.6" pathLength="100" transform="rotate(-90 32 32)"/>' +
      '<circle cx="32" cy="32" r="26.5" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-dasharray="3,2"/>' +
      '<g fill="#fff">' +
        '<ellipse class="pt-toe pt-toe-2" cx="32" cy="18" rx="4.2" ry="5.8"/>' +
        '<ellipse class="pt-toe pt-toe-1" cx="20.5" cy="23.5" rx="4" ry="5.2" transform="rotate(-20 20.5 23.5)"/>' +
        '<ellipse class="pt-toe pt-toe-3" cx="43.5" cy="23.5" rx="4" ry="5.2" transform="rotate(20 43.5 23.5)"/>' +
        '<path class="pt-pad" d="M32 30C24.5 30 18.5 35 18.5 41.5C18.5 46.8 22.8 50.5 27.5 50.5C30.2 50.5 31.4 48.4 32 48.4C32.6 48.4 33.8 50.5 36.5 50.5C41.2 50.5 45.5 46.8 45.5 41.5C45.5 35 39.5 30 32 30Z"/>' +
      '</g>' +
    '</svg>';

  var el = document.createElement('div');
  el.id = 'pt-splash';
  el.className = owner ? 'pt-owner' : 'pt-admin';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-label', 'Loading PawTrack' + (label ? ' ' + label : ''));
  el.innerHTML =
    '<div class="pt-glow" aria-hidden="true"></div>' +
    '<div class="pt-splash-stack">' +
      '<div class="pt-splash-mark" aria-hidden="true">' +
        '<span class="pt-ring"></span><span class="pt-ring"></span><span class="pt-ring"></span>' +
        (owner ? ownerMark : adminMark) +
        '<span class="pt-shine"></span>' +
      '</div>' +
      '<div class="pt-splash-name" aria-hidden="true">' + letters + '</div>' +
      '<div class="pt-splash-sub"></div>' +
      '<div class="pt-trail" aria-hidden="true">' + trail + '</div>' +
      '<div class="pt-splash-bar" aria-hidden="true"><i></i></div>' +
    '</div>';
  el.querySelector('.pt-splash-sub').textContent = tagline;

  // Added to <html> straight away: <body> does not exist yet, and this must be on screen before anything renders
  root.classList.add('pt-splashing');
  root.appendChild(el);

  var loaded = document.readyState === 'complete';
  var holds = 0;
  var closed = false;

  function ready() {
    // the admin console hides itself while it checks a saved sign-in; wait for that too
    return loaded && holds === 0 && !root.classList.contains('auth-resuming');
  }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  // The page's own logo, but only if it is really on screen and not covered by something else (a sign-in screen, a menu)
  function findTarget() {
    if (!targetSelector) return null;
    var list = document.querySelectorAll(targetSelector);
    el.style.pointerEvents = 'none';   // so the splash itself is ignored by elementFromPoint
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var r = t.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.bottom <= 0 || r.right <= 0 || r.top >= window.innerHeight || r.left >= window.innerWidth) continue;
      var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && (t.contains(hit) || hit.contains(t))) return t;
    }
    return null;
  }

  function remove(node) { if (node && node.parentNode) node.parentNode.removeChild(node); }

  // The splash logo glides to the page's logo, then hands over to it. The wordmark beside it fades in on the way.
  function flyTo(target) {
    var logo = el.querySelector('.pt-flyable');
    var from = logo.getBoundingClientRect();
    var to = target.getBoundingClientRect();

    var flyer = logo.cloneNode(true);
    flyer.classList.add('pt-flyer');
    flyer.style.cssText = 'position:fixed;left:' + from.left + 'px;top:' + from.top + 'px;width:' + from.width + 'px;height:' + from.height +
      'px;margin:0;z-index:2147483001;transform-origin:0 0;pointer-events:none;';
    root.appendChild(flyer);
    logo.style.visibility = 'hidden';
    target.style.visibility = 'hidden';   // the real logo appears exactly when the flyer lands

    var name = target.parentNode && target.parentNode.querySelector('.brand-name, .brand-text');
    if (name && name.animate) name.animate([{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 480, delay: FLY_MS - 380, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' });

    var dx = to.left - from.left, dy = to.top - from.top;
    var anim = flyer.animate(
      [{ transform: 'translate(0, 0) scale(1)' }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (to.width / from.width) + ',' + (to.height / from.height) + ')' }],
      { duration: FLY_MS, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' });
    var landed = false;
    var land = function () { if (landed) return; landed = true; target.style.visibility = ''; remove(flyer); };
    anim.onfinish = land;
    setTimeout(land, FLY_MS + 300);   // never leave the real logo hidden
  }

  function close() {
    if (closed) return;
    closed = true;
    root.classList.remove('pt-splashing');
    // the progress bar completes, then the logo goes home (or, with nowhere to go, everything lifts away)
    el.classList.add('is-done');
    setTimeout(function () {
      var target = reducedMotion() || !el.querySelector('.pt-flyable') ? null : findTarget();
      if (target) {
        el.classList.add('is-flying');
        flyTo(target);
        setTimeout(function () { remove(el); }, 760);
      } else {
        el.classList.add('is-leaving');
        setTimeout(function () { remove(el); }, 480);
      }
    }, 260);
  }

  function check() {
    if (closed) return;
    // re-check when the minimum time is up: something may have asked to hold the splash in the meantime
    if (ready()) setTimeout(function () { if (ready()) close(); }, Math.max(0, MIN_MS - (Date.now() - started)));
  }

  if (!loaded) window.addEventListener('load', function () { loaded = true; check(); });
  // class changes on <html> (auth-resuming being removed) can make it ready
  if (typeof MutationObserver === 'function') {
    new MutationObserver(function () { if (!closed && ready()) check(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  }
  setTimeout(close, MAX_MS);
  check();

  window.PawSplash = {
    hide: close,
    hold: function () { holds += 1; },
    release: function () { holds = Math.max(0, holds - 1); check(); }
  };
})();
