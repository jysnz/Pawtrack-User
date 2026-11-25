/**
 * The one list of animal species PawTrack understands, shared by the owner site and the admin console.
 * The database stores the `key` (see supabase/migrations/20261145_multi_species.sql); everything else is display.
 * Anything that is not one of the named species is stored as 'Other', and the person's own wording stays in the breed.
 */
(function () {
  const LIST = [
    { key: 'Dog', label: 'Dog', plural: 'Dogs', icon: '🐕', color: '#b45309', match: /\b(dog|dogs|aso|canine|puppy|puppies|pup)\b/i },
    { key: 'Cat', label: 'Cat', plural: 'Cats', icon: '🐈', color: '#2563eb', match: /\b(cat|cats|pusa|feline|kitten|kittens|kitty)\b/i },
    { key: 'Bird', label: 'Bird', plural: 'Birds', icon: '🦜', color: '#0d9488', match: /\b(bird|birds|ibon|parrot|parakeet|lovebird|cockatiel|cockatoo|canary|finch|macaw|dove|pigeon|chicken|rooster|hen|duck)\b/i },
    { key: 'Rabbit', label: 'Rabbit', plural: 'Rabbits', icon: '🐇', color: '#9333ea', match: /\b(rabbit|rabbits|bunny|bunnies|kuneho|hare)\b/i },
    { key: 'Small mammal', label: 'Small mammal', plural: 'Small mammals', icon: '🐹', color: '#db2777', match: /\b(hamster|guinea pig|gerbil|rat|mouse|mice|ferret|chinchilla|hedgehog|sugar glider|small mammal)\b/i },
    { key: 'Reptile', label: 'Reptile', plural: 'Reptiles', icon: '🦎', color: '#65a30d', match: /\b(reptile|reptiles|lizard|gecko|iguana|turtle|tortoise|snake|bearded dragon)\b/i },
    { key: 'Other', label: 'Other', plural: 'Other animals', icon: '🐾', color: '#a8a29e', match: null }
  ];
  const BY_KEY = Object.fromEntries(LIST.map((s) => [s.key, s]));

  const PawSpecies = {
    LIST,
    KEYS: LIST.map((s) => s.key),

    // Is this one of the named species exactly as stored?
    isKnown(value) { return Object.prototype.hasOwnProperty.call(BY_KEY, value); },

    // What the database is allowed to hold: a known key stays, free text is read for a clue, anything else is 'Other'
    normalize(value, fallback = 'Other') {
      const text = String(value == null ? '' : value).trim();
      if (!text) return fallback;
      if (BY_KEY[text]) return text;
      const lower = text.toLowerCase();
      const exact = LIST.find((s) => s.key.toLowerCase() === lower);
      if (exact) return exact.key;
      const hit = LIST.find((s) => s.match && s.match.test(text));
      return hit ? hit.key : 'Other';
    },

    get(value) { return BY_KEY[this.normalize(value)]; },
    label(value) { return this.get(value).label; },
    plural(value) { return this.get(value).plural; },
    icon(value) { return this.get(value).icon; },
    color(value) { return this.get(value).color; },

    // [[value, text], ...] for a <select>. `all` adds the first "All animals" choice with that value
    options({ all, otherLabel } = {}) {
      const rows = LIST.map((s) => [s.key, s.key === 'Other' && otherLabel ? otherLabel : s.label]);
      return all === undefined ? rows : [[all, 'All animals'], ...rows];
    },
    // The same for filters, where the text is the plural ("Dogs")
    filterOptions(allValue = 'all') {
      return [[allValue, 'All animals'], ...LIST.map((s) => [s.key, s.plural])];
    },

    // Counts per species for any list of records, in the order of LIST, empty species left out unless `keepAll`
    count(items, getSpecies = (i) => i.species, keepAll = false) {
      const counts = Object.fromEntries(LIST.map((s) => [s.key, 0]));
      (items || []).forEach((i) => { counts[this.normalize(getSpecies(i))] += 1; });
      return LIST.map((s) => ({ ...s, n: counts[s.key] })).filter((s) => keepAll || s.n > 0);
    }
  };

  if (typeof window !== 'undefined') window.PawSpecies = PawSpecies;
  if (typeof module !== 'undefined' && module.exports) module.exports = PawSpecies;
})();
