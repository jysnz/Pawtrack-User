/**
 * Modal guard: every dialog closes with Esc, and a dialog the guardian has typed into asks before it
 * closes (× button or Esc), so nothing is lost by accident.
 *
 * - Esc closes the top-most open dialog by pressing its own close button, so its usual clean-up still runs.
 * - A dialog counts as "edited" once the guardian types in, picks from or attaches to one of its fields.
 * - Programmatic closes (after a successful save, for example) never ask.
 */
(function () {
  'use strict';

  // Dialogs that must be answered with their own button: Esc and × do nothing here
  const NO_ESC = new Set(['session-expired-modal', 'google-required-modal', 'account-created-modal', 'password-updated-modal']);
  const CONFIRM_ID = 'discard-confirm-modal';

  const opened = [];        // open dialogs, oldest first (the last one is on top)
  const edited = new WeakSet();
  let pendingClose = null;  // the close action waiting for the "Discard" answer
  let bypass = false;       // true while a confirmed close is being performed

  const isOpen = (el) => el.classList.contains('active');
  const topModal = () => {
    for (let i = opened.length - 1; i >= 0; i--) if (isOpen(opened[i])) return opened[i];
    return null;
  };

  // Keep the open order, and forget "edited" once a dialog closes
  const watch = (el) => {
    if (el.__guardWatched) return;
    el.__guardWatched = true;
    new MutationObserver(() => {
      const i = opened.indexOf(el);
      if (isOpen(el)) {
        if (i === -1) opened.push(el);
      } else {
        if (i !== -1) opened.splice(i, 1);
        edited.delete(el);
      }
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
    if (isOpen(el)) opened.push(el);
  };
  const watchAll = () => document.querySelectorAll('.modal-overlay').forEach(watch);

  // The button that closes a dialog: the × in its header, else a Close / Cancel style button
  const isCloseX = (b) => b.matches('[aria-label="Close"], .modal-close') || (!!b.closest('.modal-header') && /^[×✕xX]$/.test(b.textContent.trim()));
  const closeControl = (modal) => {
    const header = [...modal.querySelectorAll('button')].find(isCloseX);
    if (header) return header;
    return [...modal.querySelectorAll('button')].find((b) => /^(close|cancel|got it|keep it|stay logged in)\b/i.test(b.textContent.trim())) || null;
  };

  const closeNow = (modal) => {
    const btn = closeControl(modal);
    bypass = true;
    try {
      if (btn) btn.click();
      else if (window.notifManager) window.notifManager.closeModal(modal.id);
    } finally { bypass = false; }
  };

  const askDiscard = (modal) => {
    const confirmEl = document.getElementById(CONFIRM_ID);
    if (!confirmEl) { closeNow(modal); return; }
    pendingClose = modal;
    window.notifManager.openModal(CONFIRM_ID);
    setTimeout(() => document.getElementById('discard-confirm-keep-btn')?.focus(), 120);
  };

  // A user-made close (× or Esc): ask first when the dialog was edited
  const requestClose = (modal) => {
    if (edited.has(modal)) askDiscard(modal); else closeNow(modal);
  };

  document.addEventListener('DOMContentLoaded', () => {
    watchAll();
    // Dialogs built later (for example the vaccination delete prompt) are picked up too
    new MutationObserver(watchAll).observe(document.body, { childList: true });
    document.getElementById('discard-confirm-keep-btn')?.addEventListener('click', () => {
      pendingClose = null;
      window.notifManager.closeModal(CONFIRM_ID);
    });
    document.getElementById('discard-confirm-yes-btn')?.addEventListener('click', () => {
      const modal = pendingClose;
      pendingClose = null;
      window.notifManager.closeModal(CONFIRM_ID);
      if (modal) { edited.delete(modal); closeNow(modal); }
    });
  });

  // The guardian changed something in a dialog
  const markEdited = (e) => {
    if (!e.isTrusted) return;
    const field = e.target;
    if (!(field instanceof HTMLElement) || !field.matches('input, textarea, select')) return;
    if (field.type === 'search' || field.type === 'hidden' || field.readOnly) return;
    if (/search/i.test(field.className + ' ' + field.id)) return;
    const modal = field.closest('.modal-overlay');
    if (modal && modal.id !== CONFIRM_ID) edited.add(modal);
  };
  document.addEventListener('input', markEdited, true);
  document.addEventListener('change', markEdited, true);

  // × button: ask first when the dialog was edited (capture phase runs before the button's own handler)
  document.addEventListener('click', (e) => {
    if (bypass || !e.isTrusted) return;
    const btn = e.target.closest && e.target.closest('button');
    if (!btn || !isCloseX(btn)) return;
    const modal = btn.closest('.modal-overlay');
    if (!modal || modal.id === CONFIRM_ID || !edited.has(modal)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    askDiscard(modal);
  }, true);

  // For dialogs that finish their job without closing (a "done" screen): forget what was typed
  window.modalGuard = { markClean: (id) => { const el = document.getElementById(id); if (el) edited.delete(el); } };

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const modal = topModal();
    if (!modal) return;
    if (modal.id === CONFIRM_ID) {
      e.preventDefault();
      pendingClose = null;
      window.notifManager.closeModal(CONFIRM_ID);
      return;
    }
    if (NO_ESC.has(modal.id)) return;
    e.preventDefault();
    requestClose(modal);
  });
})();
