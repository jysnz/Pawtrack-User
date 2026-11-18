/**
 * PawTrack Admin — motion helpers
 *
 * - enterView(container): staggered rise-in of a view's top-level blocks. Called on route CHANGE only,
 *   never on store-driven re-renders (those happen on every realtime event and must not flicker).
 * - countKpis(container, route): counts KPI numbers up on first sight and tweens between values when
 *   they change. Re-entering a view with unchanged numbers renders them instantly.
 *
 * Both are no-ops that leave the final content untouched under prefers-reduced-motion.
 */
(function () {
  'use strict';

  const MAX_STAGGER = 8;
  const COUNT_MS = 520;
  const KPI_SELECTOR = '.kpi-value, .kpi-number, .kpi-main-val';
  // optional prefix (symbol/arrow), number (with or without thousands separators), optional decimals, suffix
  const NUMBER_RE = /^([^\d]*?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?([\s\S]*)$/;

  const lastValues = new Map();

  function reducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function enterView(container) {
    if (!container) return;

    // A new page starts at the top (the viewport uses smooth scrolling, so override it for this jump)
    try {
      container.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch (e) {
      container.scrollTop = 0;
    }

    // Views usually render one wrapper; stagger inside it so the blocks arrive one after another
    const root = container.children.length === 1 ? container.firstElementChild : container;
    const targets = Array.from(root.children).slice(0, MAX_STAGGER);

    targets.forEach((el, i) => {
      el.style.setProperty('--stagger', String(i));
      el.classList.add('motion-in');
      const cleanup = () => {
        el.classList.remove('motion-in');
        el.style.removeProperty('--stagger');
      };
      el.addEventListener('animationend', cleanup, { once: true });
      // If the animation is cancelled (display:none, re-render) the listener never fires
      setTimeout(cleanup, 700 + i * 40);
    });
  }

  function formatLike(value, decimals, useGrouping) {
    if (useGrouping) {
      return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    return value.toFixed(decimals);
  }

  // Counts the number inside one text node, so a unit label next to it ("4 <span>this week</span>") survives
  function tween(node, from, to, parts) {
    const { pre, post, decimals, grouped, finalText } = parts;
    const start = performance.now();

    const frame = (now) => {
      if (!node.isConnected) return;
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 4); // ease-out quart: fast start, soft landing
      if (t < 1) {
        node.nodeValue = pre + formatLike(from + (to - from) * eased, decimals, grouped) + post;
        requestAnimationFrame(frame);
      } else {
        node.nodeValue = finalText; // always land on exactly what the view rendered
      }
    };
    requestAnimationFrame(frame);
  }

  function countKpis(container, route) {
    if (!container) return;
    // KPI numbers show their real value straight away: counting up from 0 on every page load (and tweening on
    // every sync) made figures such as "Capacity in use" visibly flicker
    const skip = true;

    container.querySelectorAll(KPI_SELECTOR).forEach((el, i) => {
      // The number lives in the first text node; a unit span after it is left alone
      const node = Array.from(el.childNodes).find((n) => !(n.nodeType === 3 && n.nodeValue.trim() === ''));
      if (!node || node.nodeType !== 3) return; // empty, or the value starts with markup: leave it alone

      const m = NUMBER_RE.exec(node.nodeValue.trim());
      if (!m) return;

      const pre = m[1];
      const intPart = m[2];
      const decPart = m[3] || '';
      const post = m[4];
      if (/\d/.test(post)) return; // "14h 20m", "12/30": several numbers, a single tween would read wrong
      const to = parseFloat(intPart.replace(/,/g, '') + decPart);
      if (!Number.isFinite(to)) return;

      const key = `${route}:${i}:${pre}|${post}`;
      const prev = lastValues.get(key);
      lastValues.set(key, to);

      if (skip || prev === to) return;
      const from = prev === undefined ? 0 : prev;
      if (from === to) return;

      tween(node, from, to, {
        pre,
        post,
        decimals: decPart ? decPart.length - 1 : 0,
        grouped: intPart.includes(','),
        finalText: node.nodeValue
      });
    });
  }

  window.AdminMotion = { enterView, countKpis, reducedMotion };
})();
