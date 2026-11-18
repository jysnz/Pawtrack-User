// Facility photos: stored in the "facility-photos" bucket under the facility's own folder, then linked to the facility.
// Run: node admin/tests/test-facility-photo.js
const path = require('path');
const mem = {};
global.window = global;
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
global.document = { addEventListener() {}, hidden: false };
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.BroadcastChannel = undefined;
require(path.join(__dirname, '../js/facility-photo.js'));
const AdminStore = require(path.join(__dirname, '../js/admin-store.js'));
const store = window.adminStore || new AdminStore();

let failed = 0;
const check = (n, ok, x) => { console.log(`${ok ? '[PASS]' : '[FAIL]'} ${n}${!ok && x !== undefined ? ' -> ' + String(x).slice(0, 200) : ''}`); if (!ok) failed++; };

const ID = '11111111-1111-4111-8111-111111111111';
const shelters = [{ id: ID, name: 'Main', photoUrl: 'https://x.supabase.co/storage/v1/object/public/facility-photos/' + ID + '/old.jpg' }];
store.getShelters = () => shelters.map(s => ({ ...s }));
const errors = [];
store.dbError = (what, err) => errors.push(what + ': ' + (err && err.message));
store.logAction = () => {}; store.notify = () => {};

const calls = { uploads: [], removes: [], updates: [] };
let uploadError = null, updateRows = [{ id: ID }];
const sb = {
  storage: { from: (bucket) => ({
    upload: async (p, blob, opts) => { calls.uploads.push({ bucket, p, type: opts.contentType }); return { error: uploadError }; },
    getPublicUrl: (p) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${p}` } }),
    remove: (list) => { calls.removes.push(list); return Promise.resolve({}); }
  }) },
  from: (t) => ({ update: (row) => ({ eq: () => ({ select: async () => { calls.updates.push({ t, row }); return { data: updateRows, error: null }; } }) }) })
};
store.client = () => sb;

(async () => {
  const blob = { size: 100 };
  const url = await store.setFacilityPhoto(ID, blob);
  const up = calls.uploads[0];
  check('uploads to the facility-photos bucket, inside the facility\'s own folder, as a JPEG', up && up.bucket === 'facility-photos' && up.p.startsWith(ID + '/') && up.p.endsWith('.jpg') && up.type === 'image/jpeg', JSON.stringify(up));
  check('returns the public link and saves it on the facility', /facility-photos\/.+\.jpg$/.test(url) && calls.updates[0].t === 'shelters' && calls.updates[0].row.photo_url === url);
  check('the previous photo file is removed', calls.removes[0] && calls.removes[0][0] === ID + '/old.jpg', JSON.stringify(calls.removes));
  check('the cached facility shows the new photo straight away', JSON.parse(mem[Object.keys(mem).find(k => /shelter/i.test(k))] || '[]')[0]?.photoUrl === url);

  // Clearing
  calls.uploads.length = 0; calls.updates.length = 0;
  const cleared = await store.setFacilityPhoto(ID, null);
  check('removing the photo uploads nothing and clears the link', cleared === '' && !calls.uploads.length && calls.updates[0].row.photo_url === null);

  // Upload fails
  uploadError = { message: 'quota' };
  calls.updates.length = 0;
  const failedUp = await store.setFacilityPhoto(ID, blob);
  check('a failed upload is reported and the facility is left alone', failedUp === null && errors.length === 1 && !calls.updates.length, errors);
  uploadError = null; errors.length = 0;

  // Not allowed to change the row
  updateRows = [];
  calls.removes.length = 0;
  const refused = await store.setFacilityPhoto(ID, blob);
  check('if the database refuses the change, the uploaded file is cleaned up', refused === null && errors.length === 1 && calls.removes.length >= 1, errors);

  // A facility that is not saved yet
  const none = await store.setFacilityPhoto('sh-123', blob);
  check('an unsaved facility cannot take a photo yet', none === null);

  // Editing must not wipe the photo
  const src = require('fs').readFileSync(path.join(__dirname, '../js/admin-store.js'), 'utf8');
  check('editing a facility without a photo field no longer clears its photo', /shelterData\.photoUrl !== undefined \? \{ photo_url/.test(src));

  // The form field
  const html = window.FacilityPhoto.fieldHtml('');
  check('the field starts empty with an "Add a photo" prompt and a nudge for later', /data-state="empty"/.test(html) && /Add a photo of the facility/.test(html) && /id="fp-nudge"[^>]*hidden/.test(html));
  const withPhoto = window.FacilityPhoto.fieldHtml('https://x/y.jpg');
  check('an existing photo is shown with Change and Remove', /data-state="filled"/.test(withPhoto) && /src="https:\/\/x\/y\.jpg"/.test(withPhoto) && /fp-remove/.test(withPhoto));
  check('only JPG, PNG and WebP are accepted', /accept="image\/jpeg,image\/png,image\/webp"/.test(html));
  check('storage paths are per facility', /^ABC\/.+\.jpg$/.test(window.FacilityPhoto.pathFor('ABC')));

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
