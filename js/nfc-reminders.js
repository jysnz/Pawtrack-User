/**
 * PawTrack owner app: NFC tag reminders and the violation that follows.
 *
 * A registered pet with no NFC tag is not covered by Section 35 of the Quezon City Veterinary Code
 * ("Unregistered / no microchips", a fine that rises with each offense). So:
 *   1. The owner gets a notification as soon as a pet without a tag is seen, with 7 days to link one.
 *   2. If they dismiss it, they are reminded once more, 1 day before the 7 days are up.
 *   3. If the 7 days pass and the pet still has no tag, a Section 35 violation is recorded for the owner.
 *      The fine is the next step on the ladder (1st, 2nd, 3rd offense), counted across their pets.
 *
 * Everything is kept on this device, per signed-in account (the database has no violations table yet).
 * A violation is only issued from a pets list that was just loaded from the database (check({ authoritative })).
 */
(function (root) {
  'use strict';
  if (root.nfcReminders) return;

  var STATE_KEY = 'pawtrack_nfc_reminders';
  var VIOLATIONS_KEY = 'pawtrack_my_violations';
  var DAY = 86400000;
  var WINDOW_DAYS = 7;
  var REMIND_BEFORE_DAYS = 1;
  var RULE_ID = 's35-1'; // Section 35: Unregistered / no microchips

  var store = function () { return root.pawStore; };
  var read = function (key) {
    try { return JSON.parse(root.localStorage.getItem(key)) || {}; } catch (e) { return {}; }
  };
  var write = function (key, value) {
    try { root.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
  };
  var noteId = function (petId) { return 'nfc-' + petId; };

  function userId() {
    var u = store() && store().getGoogleUser();
    return u && u.id ? String(u.id) : '';
  }
  function myPets() {
    var s = store();
    return s.getPets().filter(function (p) { return s.isMyPet(p); });
  }
  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ----- the violations ledger -----
  function violations() {
    var all = read(VIOLATIONS_KEY);
    var list = all[userId()];
    return Array.isArray(list) ? list.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }) : [];
  }
  function saveViolations(list) {
    var all = read(VIOLATIONS_KEY);
    all[userId()] = list;
    write(VIOLATIONS_KEY, all);
  }

  // The fine for the next offense of this rule (1st, 2nd, then 3rd and every one after)
  function nextOffense() {
    var count = violations().filter(function (v) { return v.ruleId === RULE_ID; }).length;
    var D = root.PawViolations;
    var row = D && D.byId(RULE_ID);
    var steps = row && row.provision.penalty.kind === 'ladder' ? row.provision.penalty.steps : [1000, 1500, 2000];
    var n = count + 1;
    return { offense: n, fine: steps[Math.min(n, steps.length) - 1], row: row };
  }

  // ----- the per-pet reminder state -----
  function states() { return read(STATE_KEY)[userId()] || {}; }
  function saveStates(next) {
    var all = read(STATE_KEY);
    all[userId()] = next;
    write(STATE_KEY, all);
  }

  function hasNote(id) {
    var list;
    try { list = JSON.parse(root.localStorage.getItem('pawtrack_local_notifications')) || []; } catch (e) { list = []; }
    return list.some(function (n) { return String(n.id) === String(id); });
  }

  function addReminder(pet, st, again) {
    var fine = nextOffense();
    var when = fmtDate(st.dueAt);
    store().addNotification({
      id: noteId(pet.id),
      type: 'nfc_reminder',
      petId: pet.id,
      title: again ? 'REMINDER: ' + pet.name + ' still has no NFC tag' : pet.name + ' has no NFC tag',
      message: 'Link an NFC tag to ' + pet.name + ' by ' + when + '. After that, an impoundment facility is told and decides whether it becomes a Section 35 violation (Unregistered / no microchips). ' +
        'The fine is ' + root.PawViolations.peso(fine.fine) + ' for a ' + ordinal(fine.offense) + ' offense.'
    });
  }

  function ordinal(n) { return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th'; }

  // After 7 days without a tag nothing is fined here. The pet is reported to an impoundment facility, which decides
  // whether it becomes a violation (and then emails the owner). The 7 days are checked again by the database.
  function issueViolation(pet, st, now) {
    st.violationId = 'reported-' + now; // handled: not reported again from this device
    st.dismissedAt = null;
    store().removeLocalNotification(noteId(pet.id));
    var sb = root.pawApp && root.pawApp.supabase;
    if (sb && /^[0-9a-f-]{36}$/i.test(String(pet.id))) {
      sb.rpc('flag_unlinked_pet', { p_pet: pet.id }).then(function (res) {
        if (res && res.error) console.warn('[NFC] could not report ' + pet.name + ':', res.error.message);
      });
    }
    store().addNotification({
      id: 'nfcr-' + pet.id + '-' + now,
      type: 'nfc_reminder',
      category: 'priority',
      petId: pet.id,
      title: pet.name + ' was reported for having no NFC tag',
      message: WINDOW_DAYS + ' days passed without an NFC tag on ' + pet.name + '. An impoundment facility was told and will decide if it becomes a violation. ' +
        'If it does, you are emailed with the fine and where to go. Link a tag now to avoid it.'
    });
  }

  /**
   * Looks at every pet of the signed-in owner. authoritative: the pets list was just loaded from the database, so a
   * pet with no tag really has none, and an expired deadline may become a violation. Without it, only reminders change.
   */
  function check(opts) {
    var s = store();
    if (!s || !root.PawViolations || !userId()) return;
    var authoritative = !!(opts && opts.authoritative);
    var now = Date.now();
    var all = states();
    var next = {};
    var changed = false;

    myPets().forEach(function (pet) {
      var st = all[pet.id];
      var tagged = !!pet.nfcTag;

      if (tagged) {
        // Linked: the reminder is gone. A violation already recorded stays on the record.
        if (st && st.violationId) next[pet.id] = Object.assign({}, st, { resolvedAt: st.resolvedAt || now });
        if (hasNote(noteId(pet.id))) s.removeLocalNotification(noteId(pet.id));
        if (st && !(st.violationId)) changed = true;
        return;
      }

      if (!st) { st = { startedAt: now, dueAt: now + WINDOW_DAYS * DAY, dismissedAt: null, remindedAt: null, violationId: null }; changed = true; }
      else st = Object.assign({}, st);
      next[pet.id] = st;
      if (st.violationId) return; // already fined for this pet

      if (now >= st.dueAt) {
        if (authoritative) { issueViolation(pet, st, now); changed = true; }
        return;
      }
      if (st.dismissedAt) {
        // Dismissed: stay quiet until the last day, then remind once
        if (!st.remindedAt && now >= st.dueAt - REMIND_BEFORE_DAYS * DAY) {
          st.remindedAt = now;
          st.dismissedAt = null;
          addReminder(pet, st, true);
          changed = true;
        }
        return;
      }
      if (!hasNote(noteId(pet.id))) addReminder(pet, st, !!st.remindedAt);
    });

    if (changed || Object.keys(next).length !== Object.keys(all).length) saveStates(next);
    if (changed) s.notify('violations_updated');
  }

  function dismiss(petId) {
    var all = states();
    var st = all[petId];
    if (st && !st.violationId) {
      st.dismissedAt = Date.now();
      saveStates(all);
    }
    store().removeLocalNotification(noteId(petId));
    if (root.notifManager) root.notifManager.renderNotifDropdown();
  }

  // Opens the tag screen for a pet that is already registered
  function linkNow(petId) {
    var s = store();
    var pet = s && s.getPetById(petId);
    if (!pet || !root.nfcLink) return;
    var months = pet.ageMonths;
    var age = months == null || months === '' ? (pet.age || '')
      : (months < 12 ? months + (months === 1 ? ' month' : ' months') : Math.floor(months / 12) + (Math.floor(months / 12) === 1 ? ' year' : ' years'));
    var user = s.getGoogleUser() || {};
    var notifPanel = document.getElementById('notif-dropdown-panel');
    if (notifPanel) notifPanel.style.display = 'none';
    root.nfcLink.open({
      existingPetId: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      gender: pet.gender,
      color: pet.color,
      age: age,
      ageMonths: months,
      description: pet.description || '',
      status: pet.status,
      registeredDate: pet.registeredDate,
      photoUrl: pet.photoUrl || pet.photo || '',
      owner: pet.owner && pet.owner.name ? pet.owner : { name: user.name || '', phone: user.phone || '', email: user.email || '', address: '' }
    });
  }

  // Pets still waiting for a tag, with the days left (for the My Violations page)
  function pending() {
    var all = states();
    var now = Date.now();
    return myPets().filter(function (p) { return !p.nfcTag && all[p.id] && !all[p.id].violationId; }).map(function (p) {
      var due = all[p.id].dueAt;
      return { petId: p.id, petName: p.name, dueAt: due, daysLeft: Math.max(0, Math.ceil((due - now) / DAY)) };
    }).sort(function (a, b) { return a.dueAt - b.dueAt; });
  }

  root.nfcReminders = { check: check, dismiss: dismiss, linkNow: linkNow, violations: violations, pending: pending, WINDOW_DAYS: WINDOW_DAYS, ordinal: ordinal };

  // A pet saved or tagged on this device: update reminders at once (never issues a violation from here)
  if (root.pawStore && root.pawStore.subscribe) {
    root.pawStore.subscribe(function (event) { if (event === 'pets_updated') check({ authoritative: false }); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
