/**
 * PawTrack owner app: penalty ticket prompt.
 *
 * When a facility impounds a pet that was reported missing, the owner is given a penalty ticket payable to the main
 * facility. This shows the owner what to pay and where: a dialog the first time each ticket appears, and a banner
 * that stays while any ticket is unpaid. Payments are made to the facility itself; its staff record the payment,
 * which clears the ticket here. If the tickets table is not available yet, nothing is shown.
 *
 *   PenaltyPrompt.check(supabaseClient)   call after the owner signs in
 */
(function () {
  'use strict';
  if (window.PenaltyPrompt) return;

  var SEEN_KEY = 'pawtrack_penalty_seen';
  var POLL_MS = 60000;
  var timer = null;
  var client = null;
  var current = [];

  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  var money = function (n) { return 'PHP ' + Number(n || 0).toLocaleString('en-US'); };

  function seen() {
    try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'); } catch (e) { return []; }
  }
  function remember(ids) {
    try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen().concat(ids))); } catch (e) { /* ignore */ }
  }

  function removeBanner() {
    var b = document.getElementById('pt-penalty-banner');
    if (b) b.remove();
  }
  function removeModal() {
    var m = document.getElementById('pt-penalty-modal');
    if (m) m.remove();
    document.removeEventListener('keydown', onKey, true);
  }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); removeModal(); } }

  function showBanner(tickets) {
    if (!tickets.length) { removeBanner(); return; }
    var total = tickets.reduce(function (a, t) { return a + Number(t.amount_php || 0); }, 0);
    // Same tickets as the banner already on screen: leave it alone (rebuilding it every poll makes it flash)
    var key = tickets.length + ':' + total;
    var existing = document.getElementById('pt-penalty-banner');
    if (existing && existing.getAttribute('data-key') === key) return;
    removeBanner();
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'pt-penalty-banner';
    b.setAttribute('data-key', key);
    b.className = 'pt-penalty-banner';
    b.innerHTML = '<span class="pt-penalty-dot" aria-hidden="true"></span><span>' +
      (tickets.length === 1 ? '1 unpaid penalty ticket' : tickets.length + ' unpaid penalty tickets') +
      ' · <b>' + esc(money(total)) + '</b></span><span class="pt-penalty-go">View</span>';
    b.addEventListener('click', function () { showModal(current); });
    document.body.appendChild(b);
  }

  function ticketCard(t) {
    var p = t.payee || {};
    var maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((p.name || '') + ' ' + (p.address || ''));
    return '<article class="pt-ticket">' +
      '<div class="pt-ticket-top"><div><div class="pt-ticket-label">Penalty ticket</div><div class="pt-ticket-no">' + esc(t.ticket_no) + '</div></div>' +
      '<div class="pt-ticket-amount">' + esc(money(t.amount_php)) + '</div></div>' +
      '<p class="pt-ticket-why">Your missing pet <b>' + esc(t.pet_name) + '</b> was found and impounded. A penalty is due before you can collect it.</p>' +
      '<dl class="pt-ticket-pay">' +
        '<div><dt>Pay to</dt><dd>' + esc(p.name || 'the main facility') + '</dd></div>' +
        (p.address ? '<div><dt>Address</dt><dd>' + esc(p.address) + '</dd></div>' : '') +
        (p.phone ? '<div><dt>Phone</dt><dd><a href="tel:' + esc(String(p.phone).replace(/[^+\d]/g, '')) + '">' + esc(p.phone) + '</a></dd></div>' : '') +
        (p.hours ? '<div><dt>Hours</dt><dd>' + esc(String(p.hours).split(';').join(' · ')) + '</dd></div>' : '') +
      '</dl>' +
      '<ol class="pt-ticket-steps"><li>Go to or contact the facility above.</li><li>Pay ' + esc(money(t.amount_php)) + ' and show your ticket number.</li><li>Staff record your payment, then you can collect ' + esc(t.pet_name) + '.</li></ol>' +
      (p.address ? '<a class="pt-ticket-dir" href="' + esc(maps) + '" target="_blank" rel="noopener">Get directions</a>' : '') +
    '</article>';
  }

  function showModal(tickets) {
    removeModal();
    if (!tickets.length) return;
    var m = document.createElement('div');
    m.id = 'pt-penalty-modal';
    m.className = 'pt-penalty-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', 'Penalty ticket');
    m.innerHTML = '<div class="pt-penalty-box"><button type="button" class="pt-penalty-close" aria-label="Close">&times;</button>' +
      '<h2>' + (tickets.length === 1 ? 'You have a penalty to pay' : 'You have ' + tickets.length + ' penalties to pay') + '</h2>' +
      '<p class="pt-penalty-sub">Payments are made to the facility itself, not in this app.</p>' +
      tickets.map(ticketCard).join('') +
      '<button type="button" class="pt-penalty-ok">Got it</button></div>';
    m.addEventListener('click', function (e) { if (e.target === m) removeModal(); });
    m.querySelector('.pt-penalty-close').addEventListener('click', removeModal);
    m.querySelector('.pt-penalty-ok').addEventListener('click', removeModal);
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(m);
    m.querySelector('.pt-penalty-ok').focus({ preventScroll: true });
    remember(tickets.map(function (t) { return t.id; }));
  }

  function clear() {
    current = [];
    removeBanner();
    removeModal();
    if (timer) { clearInterval(timer); timer = null; }
  }

  function load() {
    if (!client) return Promise.resolve();
    return client.auth.getSession().then(function (res) {
      if (!res.data || !res.data.session) { clear(); return; }
      return client.from('penalty_tickets')
        .select('id, ticket_no, pet_name, amount_php, status, payee:shelters!payee_shelter_id(name, address, phone, hours)')
        .eq('status', 'unpaid').order('created_at', { ascending: false })
        .then(function (r) {
          if (r.error) return; // the table may not exist yet: nothing to show
          current = r.data || [];
          showBanner(current);
          var already = seen();
          var fresh = current.filter(function (t) { return already.indexOf(t.id) < 0; });
          if (fresh.length && !document.getElementById('pt-penalty-modal')) showModal(current);
        });
    }).catch(function () { /* offline or not signed in: try again on the next poll */ });
  }

  window.PenaltyPrompt = {
    check: function (supabaseClient) {
      client = supabaseClient;
      if (!client) return;
      load();
      if (!timer) timer = setInterval(load, POLL_MS);
    },
    clear: clear
  };
})();
