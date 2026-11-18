/**
 * PawTrack Admin: shared search behaviour (Reports, Impoundments).
 *
 * - Several words: every word must match, in any field; accents and capitals are ignored.
 * - Suggestions while typing (arrow keys + Enter, or click), a clear button, Esc to close then clear,
 *   and "/" anywhere on the page to jump to the box.
 * - The search itself only runs on the Search button, Enter or a picked suggestion.
 * - Matched words are highlighted in the results (highlight()).
 */
(function () {
  'use strict';

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (v) => String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const terms = (query) => norm(query).split(/\s+/).filter(Boolean);

  // True when every typed word appears somewhere in the given fields
  function matches(query, fields) {
    const t = terms(query);
    if (!t.length) return true;
    const hay = norm(fields.join(' '));
    return t.every((w) => hay.includes(w));
  }

  // Escapes text and wraps the typed words in <mark>
  function highlight(text, query) {
    const t = String(text == null ? '' : text);
    const words = String(query || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return esc(t);
    const re = new RegExp('(' + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
    return t.split(re).map((part, i) => (i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part))).join('');
  }

  // Suggestions from a list of [label, kind] pairs: starts-with first, no duplicates, at most `limit`
  function suggest(typed, pairs, limit = 6) {
    const t = norm(typed).trim();
    if (!t) return [];
    const seen = new Set();
    const out = [];
    pairs.forEach(([label, kind]) => {
      const key = kind + norm(label);
      if (!label || seen.has(key) || !norm(label).includes(t)) return;
      seen.add(key);
      out.push({ label: String(label), kind, starts: norm(label).startsWith(t) });
    });
    return out.sort((a, b) => (b.starts - a.starts) || a.label.localeCompare(b.label)).slice(0, limit);
  }

  let slashTarget = null;
  let slashBound = false;

  /**
   * opts: { form, input, box, clearBtn, suggestions: (typed) => [{label, kind}], apply: (value) => void, current: () => string }
   */
  function attach(opts) {
    const { form, input, box, clearBtn } = opts;
    if (!input) return;
    let active = -1;
    const close = () => { if (box) box.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
    const mark = () => box && box.querySelectorAll('.rp-sug').forEach((el, i) => {
      el.classList.toggle('is-active', i === active);
      el.setAttribute('aria-selected', String(i === active));
    });

    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); close(); opts.apply(input.value); });

    input.addEventListener('input', () => {
      if (clearBtn) clearBtn.hidden = !input.value;
      const list = box ? opts.suggestions(input.value) : [];
      if (!list.length) return close();
      box.innerHTML = list.map((x) => `<button type="button" class="rp-sug" role="option" data-v="${esc(x.label)}"><span>${esc(x.label)}</span><em>${esc(x.kind)}</em></button>`).join('');
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
    });

    if (box) {
      box.addEventListener('mousedown', (e) => {
        const b = e.target.closest('.rp-sug');
        if (b) { e.preventDefault(); input.value = b.dataset.v; opts.apply(b.dataset.v); }
      });
    }
    input.addEventListener('blur', close);

    input.addEventListener('keydown', (e) => {
      const items = box ? box.querySelectorAll('.rp-sug') : [];
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); active = (active + 1) % items.length; mark(); }
      else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; mark(); }
      else if (e.key === 'Enter' && active >= 0 && items[active]) { e.preventDefault(); input.value = items[active].dataset.v; opts.apply(items[active].dataset.v); }
      else if (e.key === 'Escape') {
        if (box && !box.hidden) close();
        else if (input.value || (opts.current && opts.current())) { input.value = ''; opts.apply(''); }
      }
    });

    if (clearBtn) clearBtn.addEventListener('mousedown', (e) => { e.preventDefault(); input.value = ''; opts.apply(''); });

    // "/" anywhere on the page jumps to the search box of the page that is open
    slashTarget = input;
    if (!slashBound) {
      slashBound = true;
      document.addEventListener('keydown', (e) => {
        const el = slashTarget;
        if (e.key !== '/' || !el || !el.isConnected || e.metaKey || e.ctrlKey || e.altKey) return;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName) || (document.activeElement && document.activeElement.isContentEditable)) return;
        e.preventDefault();
        el.focus();
        el.select();
      });
    }
  }

  window.PawSearch = { esc, norm, terms, matches, highlight, suggest, attach };
})();
