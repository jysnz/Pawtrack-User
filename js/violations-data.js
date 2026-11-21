/**
 * PawTrack: the violations list, shared by the owner app and the admin console (admin/index.html loads this same file).
 * Source: the notice of violation (Ordinance SP-2505, S-2016, the Quezon City Veterinary Code, and SP-2990, S-2020).
 * Only what the notice states is here: where it prints no fine, the fine is "none" rather than a guess.
 *
 * A provision (a section of the ordinance) has the specific violations under it and one penalty:
 *   ladder  the fine rises with each offense (amounts for the 1st, 2nd and 3rd offense)
 *   flat    one fine for every offense, with extras such as confiscation
 *   none    the notice states no fine
 * A "row" is one specific violation, with its provision: that is what the pages list, one per row.
 */
(function (root) {
  const provisions = [
    {
      id: 's35', ref: 'Section 35', ordinance: 'SP-2505, S-2016',
      title: 'Registration of companion dogs & cats',
      violations: ['Unregistered / no microchips'],
      penalty: { kind: 'ladder', steps: [1000, 1500, 2000] }
    },
    {
      id: 's37', ref: 'Section 37', ordinance: 'SP-2505, S-2016',
      title: 'Regulation of pet animals',
      violations: ['Keeping of animals according to space requirement'],
      penalty: { kind: 'flat', amount: 2000, extras: ['Confiscation of excess animals with no sufficient space requirement'] }
    },
    {
      id: 's38', ref: 'Section 38', ordinance: 'SP-2505, S-2016',
      title: 'Special permit for the keeping of animals',
      violations: ['No special permit'],
      penalty: { kind: 'flat', amount: 2000, extras: ['Confiscation of animals'] }
    },
    {
      id: 's40', ref: 'Section 40', ordinance: 'SP-2505, S-2016',
      title: 'Prohibited acts',
      violations: [
        'Harboring dogs with symptoms of rabies',
        'Allowing a dog to assault or attack any person',
        'Removal of dog tag / microchip',
        'Transfer of dog tag / microchip to another animal'
      ],
      penalty: { kind: 'flat', amount: 2000, extras: ['Confiscation of animals'] }
    },
    {
      id: 's53', ref: 'Section 53', ordinance: 'SP-2505, S-2016',
      title: 'Responsibilities of animal owners, possessors and keepers',
      violations: [
        'Unleashed',
        'Refuse to shoulder animal bite victims',
        'Defecation on public and private property',
        'Unvaccinated'
      ],
      penalty: { kind: 'ladder', steps: [1000, 1500, 2000] }
    },
    {
      id: 's65', ref: 'Section 65', ordinance: 'SP-2505, S-2016',
      title: 'Animal show, exhibition in circus',
      violations: ['No permit'],
      penalty: { kind: 'none' }
    },
    {
      id: 'sp2990', ref: 'SP-2990, S-2020', ordinance: 'SP-2990, S-2020',
      title: 'Violation of Ordinance SP-2990, S-2020',
      violations: ['Prohibiting backyard piggeries and poultry farms'],
      penalty: { kind: 'ladder', steps: [2000, 3000, 5000] }
    },
    {
      id: 's69', ref: 'Section 69', ordinance: 'SP-2505, S-2016',
      title: 'Opposing, resisting, and intervening with authorities',
      violations: [],
      penalty: { kind: 'none' },
      note: 'Written in by hand on the notice, with no specific violations or fine listed.'
    }
  ];

  const OFFENSES = ['1st offense', '2nd offense', '3rd offense'];
  const peso = (n) => '₱' + Number(n).toLocaleString('en-PH');

  // One row per specific violation. A provision with none listed (Section 69) shows its own title as its one row.
  const rows = [];
  provisions.forEach((p) => {
    const names = p.violations.length ? p.violations : [p.title];
    names.forEach((name, i) => rows.push({ id: `${p.id}-${i + 1}`, name, provision: p, listed: p.violations.length > 0 }));
  });

  // The fine in a few words, for a row: "₱1,000 – ₱2,000", "₱2,000 + confiscation", "No fine stated"
  function fineLabel(p) {
    const pen = p.penalty;
    if (pen.kind === 'ladder') return `${peso(pen.steps[0])} – ${peso(pen.steps[pen.steps.length - 1])}`;
    if (pen.kind === 'flat') return (pen.extras || []).some((x) => /confiscation/i.test(x)) ? `${peso(pen.amount)} + confiscation` : peso(pen.amount);
    return 'No fine stated';
  }

  // How the fine works, in a sentence
  function fineExplained(p) {
    const pen = p.penalty;
    if (pen.kind === 'ladder') return 'The fine goes up with each repeat offense.';
    if (pen.kind === 'flat') return 'The same fine applies every time' + ((pen.extras || []).length ? ', with the extra penalty below.' : '.');
    return 'The notice does not print a fine for this.';
  }

  function haystack(row) {
    const p = row.provision;
    const pen = p.penalty;
    const words = [row.name, p.ref, p.ordinance, p.title, p.note || ''];
    if (pen.kind === 'ladder') words.push('fine offense', ...pen.steps.map(String));
    if (pen.kind === 'flat') words.push('fine', String(pen.amount), ...(pen.extras || []));
    if (pen.kind === 'none') words.push('no fine stated');
    return words.join(' ').toLowerCase();
  }

  // kind: 'all' | 'ladder' | 'flat' | 'none'; every word of the query must appear
  function filter(query, kind) {
    const words = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => (!kind || kind === 'all' || r.provision.penalty.kind === kind) && words.every((w) => haystack(r).includes(w)));
  }

  const byId = (id) => rows.find((r) => r.id === id) || null;
  const siblings = (row) => rows.filter((r) => r.provision.id === row.provision.id && r.id !== row.id && r.listed);

  const api = { provisions, rows, OFFENSES, peso, fineLabel, fineExplained, filter, byId, siblings };
  root.PawViolations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
