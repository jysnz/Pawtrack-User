/**
 * Owner app: pets without an NFC tag get a reminder, a dismissed one comes back a day before the 7 days are up,
 * and a Section 35 violation is recorded when the 7 days pass. Run: node tests/test-nfc-reminders.js
 */
let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 200) : ''}`); if (!ok) failed++; };

const mem = {};
global.window = global;
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
global.document = { getElementById: () => null };
require('../js/violations-data.js');

let pets = [{ id: 'p1', name: 'Biscuit', ownerId: 'u1', nfcTag: '' }];
const notes = [];
let events = [];
window.pawStore = {
  subscribe() {},
  notify(e) { events.push(e); },
  getGoogleUser: () => ({ id: 'u1', name: 'Test' }),
  getPets: () => pets,
  isMyPet: (p) => p.ownerId === 'u1',
  addNotification(n) { notes.unshift({ ...n, read: false }); mem.pawtrack_local_notifications = JSON.stringify(notes); },
  removeLocalNotification(id) { const i = notes.findIndex((n) => n.id === id); if (i > -1) notes.splice(i, 1); mem.pawtrack_local_notifications = JSON.stringify(notes); }
};
require('../js/nfc-reminders.js');
const R = window.nfcReminders;
const DAY = 86400000;
let now = 1_800_000_000_000;
Date.now = () => now;

R.check({ authoritative: true });
check('an untagged pet gets a reminder', notes.length === 1 && notes[0].type === 'nfc_reminder' && notes[0].petId === 'p1');
check('it names the Section 35 fine for a 1st offense', /Section 35/.test(notes[0].message) && /₱1,000/.test(notes[0].message));
R.check({ authoritative: true });
check('checking again does not add a second reminder', notes.length === 1);
check('the pet is listed as pending with 7 days left', R.pending().length === 1 && R.pending()[0].daysLeft === 7);

R.dismiss('p1');
check('dismissing removes it', notes.length === 0);
now += 3 * DAY; R.check({ authoritative: true });
check('it stays quiet on day 3', notes.length === 0);
now += 3.5 * DAY; R.check({ authoritative: true }); // day 6.5: within 1 day of the deadline
check('it is reminded again before the 7 days are up', notes.length === 1 && /REMINDER/.test(notes[0].title));
R.dismiss('p1');
now += 0.2 * DAY; R.check({ authoritative: true });
check('a second dismissal is not reminded again', notes.length === 0 && R.violations().length === 0);

now += 1 * DAY; R.check({ authoritative: false });
check('a device-only check never issues a violation', R.violations().length === 0);
R.check({ authoritative: true });
const v = R.violations();
check('after 7 days a Section 35 violation is recorded (1st offense, ₱1,000)', v.length === 1 && v[0].ruleId === 's35-1' && v[0].offense === 1 && v[0].fine === 1000, JSON.stringify(v));
check('the owner is alerted about it', notes.some((n) => n.type === 'nfc_violation' && n.category === 'priority'));
R.check({ authoritative: true });
check('it is only fined once for that pet', R.violations().length === 1);

pets.push({ id: 'p2', name: 'Mochi', ownerId: 'u1', nfcTag: '' });
R.check({ authoritative: true });
now += 8 * DAY; R.check({ authoritative: true });
const v2 = R.violations();
check('the next pet is a 2nd offense (₱1,500)', v2.length === 2 && v2[0].offense === 2 && v2[0].fine === 1500, JSON.stringify(v2));

pets.push({ id: 'p3', name: 'Rex', ownerId: 'u1', nfcTag: '' });
R.check({ authoritative: true });
pets.find((p) => p.id === 'p3').nfcTag = 'PT-ABC';
R.check({ authoritative: true });
now += 8 * DAY; R.check({ authoritative: true });
check('a pet that gets a tag in time is never fined and loses its reminder', R.violations().length === 2 && !notes.some((n) => n.petId === 'p3' && n.type === 'nfc_reminder'));

pets = [];
window.pawStore.getGoogleUser = () => ({ id: 'u2', name: 'Other' });
check('violations belong to one account', R.violations().length === 0);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
