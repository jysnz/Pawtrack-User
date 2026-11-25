const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const traits = {
  isPet: true, species: 'Dog', breed: 'Aspin', colors: ['gray', 'white'],
  coatPattern: 'spotted', distinctMarkings: 'Red collar and white patches',
};
const record = { status: 'lost', species: 'Dog', breed: 'Aspin' };
const pets = [
  { ...record, id: 'breed-only', name: 'Breed Only', color: 'brown' },
  { ...record, id: 'partial', name: 'Partial', color: 'grey' },
  { ...record, id: 'exact', name: 'Exact', coatColor: 'grey, white', color: 'Speckled with a red collar and white patch', description: 'Speckled with a red collar and white patch' },
  { ...record, id: 'own', name: 'Own Match', color: 'grey and white' },
  { ...record, id: 'cat', species: 'Cat', color: 'grey and white' },
  { ...record, id: 'safe', status: 'safe', color: 'grey and white' },
  { ...record, id: 'empty', breed: 'Unknown' },
  { ...record, id: 'legacy', breed: '', description: 'Gray and white Aspin with a red collar' },
];
const context = vm.createContext({
  TurnByTurn: class {},
  window: { pawStore: {
    getMapPets: () => pets,
    isMyPet: (pet) => pet.id === 'own',
    runAiPetMatch: () => assert.fail('Photo searches should use only visual evidence'),
  } },
});
for (const file of ['species.js', 'pet-ai.js', 'views/public-view.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
}

const { petAI, publicView } = context.window;
const ranked = (observed = traits, limit = 50) => {
  const { matches, checked } = petAI.matchMissing(observed, limit);
  return { scores: Array.from(matches, (match) => [match.pet.id, match.confidenceScore]), checked };
};

assert.deepEqual(ranked(), {
  scores: [['exact', 100], ['legacy', 73], ['partial', 50], ['breed-only', 30]], checked: 6,
});
assert.deepEqual(ranked(traits, 1).scores, [['exact', 100]]);
assert.deepEqual(ranked({ isPet: true, species: 'Dog' }).scores, []);
assert.deepEqual(ranked({ ...traits, isPet: false }).scores, []);
assert.deepEqual(ranked({ species: 'Dog', colors: ['grey', 'white'] }).scores, [['exact', 40], ['legacy', 40]]);
assert.deepEqual(ranked({ species: 'Dog', colors: ['red'] }).scores, [], 'Collar color is not counted as coat color');

const html = publicView.renderPhotoMatchResults(traits);
assert.match(html, /Top matches out of 7 missing pets/);
assert.match(html, /Own Match/);
assert.ok(html.indexOf('Exact') < html.indexOf('Own Match'));
assert.match(publicView.renderPhotoMatchResults({ colors: 'unknown' }), /No missing pets look similar/);
console.log('Photo match weights, missing traits, species filtering, and map results passed.');
