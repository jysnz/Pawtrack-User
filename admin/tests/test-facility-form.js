// Facility form helpers: +63 phone numbers (digits only) and operating hours picked from dropdowns.
// Run: node admin/tests/test-facility-form.js
const path = require('path');
global.window = global;
const FF = require(path.join(__dirname, '../js/facility-form.js'));
const { phone, hours } = FF;

let failed = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${!ok && extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`);
  if (!ok) failed++;
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------- phone ----------------
check('digits strips everything that is not a digit', phone.digits('917-123 (4567)') === '9171234567', phone.digits('917-123 (4567)'));
check('letters are dropped', phone.digits('9a1b7c') === '917');
check('a pasted +63 number loses its country code', phone.digits('+63 917 123 4567') === '9171234567', phone.digits('+63 917 123 4567'));
check('a leading 0 (trunk prefix) is dropped', phone.digits('0917 123 4567') === '9171234567');
check('a landline with the 02 prefix keeps its area code', phone.digits('(02) 8123-4567') === '281234567', phone.digits('(02) 8123-4567'));
check('at most 10 digits are kept', phone.digits('917123456789999').length === 10);
check('empty is valid (the field is optional)', phone.isValid(''));
check('a 10-digit mobile starting with 9 is valid', phone.isValid('9171234567'));
check('a mobile that is too short is invalid', !phone.isValid('91712345'));
check('a Metro Manila landline (2 + 8 digits) is valid', phone.isValid('281234567'));
check('a provincial landline with a 2-digit area code is valid', phone.isValid('321234567'));
check('a 10-digit number not starting with 9 and not a landline shape is rejected when too short', !phone.isValid('1234'));
check('stored form carries +63', phone.toStored('9171234567') === '+639171234567' && phone.toStored('') === '');
check('mobile display format', phone.format('+639171234567') === '+63 917 123 4567', phone.format('+639171234567'));
check('Metro Manila landline display format', phone.format('+63281234567') === '+63 2 8123 4567', phone.format('+63281234567'));
check('legacy free-typed phones reduce to digits', phone.digits('+63 (2) 8123-4567') === '281234567');

// ---------------- hours ----------------
const row = (days, open = '08:00', close = '17:00', allDay = false) => ({ days, open, close, allDay });
check('48 half-hour choices', hours.TIMES.length === 48 && hours.TIMES[0].label === '12:00 AM' && hours.TIMES[47].label === '11:30 PM');
check('noon and 1 PM labels', hours.TIMES.find(t => t.v === '12:00').label === '12:00 PM' && hours.TIMES.find(t => t.v === '13:30').label === '1:30 PM');
const std = hours.defaultModel();
check('default is one schedule, Mon-Fri 8:00 AM - 5:00 PM, weekend closed', hours.format(std) === 'Mon-Fri: 8:00 AM - 5:00 PM; Sat, Sun: Closed', hours.format(std));
check('all seven days read "Daily"', hours.daysLabel([0, 1, 2, 3, 4, 5, 6]) === 'Daily');
check('separate days are listed', hours.daysLabel([0, 2, 4]) === 'Mon, Wed, Fri');
check('two neighbouring days are listed, three or more become a range', hours.daysLabel([5, 6]) === 'Sat, Sun' && hours.daysLabel([0, 1, 2, 3, 4, 5]) === 'Mon-Sat');
check('mixed runs', hours.daysLabel([0, 1, 2, 4]) === 'Mon-Wed, Fri');

// different hours on different days
const varied = { rows: [row([0, 1, 2, 3, 4]), row([5], '08:00', '12:00')] };
check('different Saturday hours, Sunday closed', hours.format(varied) === 'Mon-Fri: 8:00 AM - 5:00 PM; Sat: 8:00 AM - 12:00 PM; Sun: Closed', hours.format(varied));
check('every day covered means nothing is listed as closed', hours.format({ rows: [row([0, 1, 2, 3, 4]), row([5, 6], '09:00', '13:00')] }) === 'Mon-Fri: 8:00 AM - 5:00 PM; Sat, Sun: 9:00 AM - 1:00 PM');
check('one schedule for all seven days reads Daily', hours.format({ rows: [row([0, 1, 2, 3, 4, 5, 6])] }) === 'Daily: 8:00 AM - 5:00 PM');
check('24 hours on some days, normal hours on others', hours.format({ rows: [row([0, 1, 2, 3, 4]), row([5, 6], '08:00', '17:00', true)] }) === 'Mon-Fri: 8:00 AM - 5:00 PM; Sat, Sun: Open 24 hours');
check('schedules are listed in weekday order whatever order they were added', hours.format({ rows: [row([5], '08:00', '12:00'), row([0, 1, 2, 3, 4])] }).startsWith('Mon-Fri'));
check('no days gives empty text', hours.format({ rows: [row([])] }) === '' && hours.format({ rows: [] }) === '');

const models = [
  std, varied,
  { rows: [row([0, 2, 4], '06:30', '12:00')] },
  { rows: [row([5, 6], '00:00', '23:30')] },
  { rows: [row([0, 1, 2, 3, 4, 5, 6], '08:00', '17:00', true)] },
  { rows: [row([0, 1, 2], '13:00', '18:30'), row([4], '07:00', '11:30'), row([6], '10:00', '14:00')] },
  { rows: [row([0, 1, 2, 3], '09:00', '18:00'), row([4], '09:00', '15:00'), row([5], '10:00', '12:00', false)] }
];
for (const m of models) {
  const text = hours.format(m);
  const back = hours.parse(text);
  check(`round trip: ${text}`, back && hours.format(back) === text && eq(back.rows.map(r => r.days), m.rows.filter(r => r.days.length).sort((a, b) => a.days[0] - b.days[0]).map(r => r.days)), back);
}
check('a Closed group is left out when reading', eq(hours.parse('Mon-Fri: 8:00 AM - 5:00 PM; Sat, Sun: Closed').rows.length, 1));
check('older single-schedule text from the previous version still parses', eq(hours.parse('Mon-Fri: 8:00 AM - 5:00 PM'), { rows: [row([0, 1, 2, 3, 4])] }), hours.parse('Mon-Fri: 8:00 AM - 5:00 PM'));
check('spaces around the dash still parse', eq(hours.parse('Mon - Fri: 8:00 AM - 5:00 PM'), { rows: [row([0, 1, 2, 3, 4])] }), hours.parse('Mon - Fri: 8:00 AM - 5:00 PM'));
check('24-hour text from the previous version still parses', hours.parse('Daily: Open 24 hours').rows[0].allDay === true);
check('a day listed twice is not accepted', hours.parse('Mon-Fri: 8:00 AM - 5:00 PM; Fri: 9:00 AM - 1:00 PM') === null);
check('only closed days is not accepted', hours.parse('Daily: Closed') === null);
check('unrecognised text parses to null', hours.parse('Open when staff are around') === null && hours.parse('') === null && hours.parse(null) === null && hours.parse('Mon-Fri 8AM-5PM') === null);

check('validate: needs a day', hours.validate({ rows: [row([])] }) !== null && hours.validate({ rows: [] }) !== null);
check('validate: an empty extra schedule is refused', hours.validate({ rows: [row([0, 1]), row([])] }) !== null);
check('validate: a day in two schedules is refused', /Fri/.test(hours.validate({ rows: [row([0, 1, 2, 3, 4]), row([4, 5])] })), hours.validate({ rows: [row([0, 1, 2, 3, 4]), row([4, 5])] }));
check('validate: close must be after open', hours.validate({ rows: [row([0], '17:00', '08:00')] }) !== null && hours.validate({ rows: [row([0], '08:00', '08:00')] }) !== null);
check('validate: names the schedule with the bad times when there are several', /Sat/.test(hours.validate({ rows: [row([0, 1, 2, 3, 4]), row([5], '12:00', '08:00')] })), hours.validate({ rows: [row([0, 1, 2, 3, 4]), row([5], '12:00', '08:00')] }));
check('validate: fine', hours.validate(std) === null && hours.validate(varied) === null);
check('validate: 24 hours ignores the times', hours.validate({ rows: [row([0], '17:00', '08:00', true)] }) === null);
check('field html lists one row per schedule and locks days used elsewhere', (() => { const h = hours.fieldHtml(varied); return (h.match(/class="fm-row"/g) || []).length === 2 && h.includes('is-taken') && h.includes('Schedule 2') && h.includes('data-remove="1"'); })());
check('a single schedule has no remove button', !hours.fieldHtml(std).includes('data-remove'));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
