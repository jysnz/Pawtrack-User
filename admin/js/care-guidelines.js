/**
 * PawTrack Admin: care guidelines and rehabilitation stages.
 *
 *  - CareGuidelines.recommend(impound)  a rule-based recommendation engine: from the animal's species, its recorded
 *    condition and how long it has been held, it returns the standard care protocol plus the alerts that apply to THIS
 *    animal, most urgent first. It is deterministic on purpose: the same animal always gets the same guidance.
 *  - CareGuidelines.STAGES / checklist() the rehabilitation stages an unclaimed animal goes through before it may be
 *    listed for adoption, and the checklist for each stage (species-specific where care differs).
 *
 * This is general husbandry guidance for facility staff. It never replaces a veterinarian.
 */
window.CareGuidelines = (function () {
  const HOUR = 3600 * 1000;
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------------------------------------------------------- rehabilitation stages
  const STAGES = [
    { key: 'medical', label: 'Medical care', aim: 'Examine the animal, treat what is found and make it medically ready. Identity, photos and condition were already recorded at intake.', target: 'First 2 weeks' },
    { key: 'behavior', label: 'Behavior & handling', aim: 'Settle, socialise and confirm the animal is safe and comfortable with people.', target: 'Runs alongside medical care' },
    { key: 'clearance', label: 'Final clearance', aim: 'A last check that the animal is healthy, safe and fully documented.', target: 'Before listing' },
    { key: 'ready', label: 'Rehabilitated', aim: 'Every check is done. The animal is rehabilitated and ready to be listed for adoption.', target: 'Done' }
  ];
  const STAGE_KEYS = STAGES.map((s) => s.key);

  const item = (stage, key, label, hint, required = true) => ({ key: `${stage}.${key}`, label, hint, required });
  const SPAYABLE = ['Dog', 'Cat', 'Rabbit'];

  function checklist(species, stage, cond) {
    const sp = species || 'Other';
    if (stage === 'medical') {
      const vaccine = sp === 'Dog' ? ['Core vaccines and rabies', 'Rabies and the core dog vaccines, given as the vet advises for its age.']
        : sp === 'Cat' ? ['Core vaccines and rabies', 'Rabies and the core cat vaccines, given as the vet advises for its age.']
        : ['Vet has confirmed preventive care', 'Most of these species have no routine vaccine. The vet confirms what, if anything, is needed.'];
      const list = [
        item('medical', 'exam', 'Veterinary exam and body condition score', 'A vet or trained health officer examines the animal head to toe and records its weight and condition.')
      ];
      if (sp === 'Bird') list.push(item('medical', 'quarantine', 'Kept apart from other birds', 'Quarantine until a vet clears it, because birds can carry diseases that spread to flocks and people.'));
      if (sp === 'Reptile') list.push(item('medical', 'husbandry', 'Heat, light and humidity set up', 'A warm and a cool zone, UVB where the species needs it, and correct humidity.'));
      if (sp === 'Rabbit') list.push(item('medical', 'gut', 'Eating and droppings checked', 'A rabbit that is not eating or not passing droppings is an emergency.'));
      if (['Bird', 'Reptile', 'Other', 'Small mammal'].includes(sp)) list.push(item('medical', 'wildlife', 'Checked that it is not protected wildlife', 'Many wild birds, reptiles and mammals may not be kept or rehomed. Confirm with the local wildlife office when unsure.', sp !== 'Small mammal'));
      list.push(
        item('medical', 'treatment', 'Injuries and illness treated', 'Every problem found at the exam has a treatment plan, and the course is finished.'),
        item('medical', 'vaccine', vaccine[0], vaccine[1]),
        item('medical', 'parasite', 'Checked and treated for parasites', 'Fleas, ticks, mites, lice or worms, with deworming and treatment as the vet prescribes.')
      );
      if (SPAYABLE.includes(sp)) list.push(item('medical', 'sterilize', 'Spay or neuter done (or scheduled)', 'Done before adoption when the animal is old and healthy enough. Otherwise booked with a date.'));
      list.push(item('medical', 'recovery', 'Recovered from procedures', 'Wounds and surgery sites are healing well, with no infection or pain.'));
      return list;
    }
    if (stage === 'behavior') {
      const routine = sp === 'Dog' ? ['House-training and leash manners started', 'Eliminates outside or on the pad, and walks on a leash without panic.']
        : sp === 'Cat' ? ['Uses a litter tray reliably', 'Uses the tray every time, with no accidents for several days.']
        : sp === 'Rabbit' ? ['Uses a litter tray and accepts handling', 'Uses a tray and can be picked up safely with its hindquarters supported.']
        : sp === 'Bird' ? ['Comfortable being handled', 'Steps up or tolerates gentle handling without panic or injury.']
        : ['Calm and safe to handle', 'Can be handled by staff without panic, bites or escape attempts.'];
      return [
        item('behavior', 'settled', 'Settled in (eating and resting normally)', 'Normal appetite and rest for at least 3 days in the facility.'),
        item('behavior', 'temperament', 'Temperament assessed', 'How it reacts to staff, handling, noise and other animals once it has settled. Note any bite or fear signs.'),
        item('behavior', 'handling', 'Safe and comfortable with people', 'Takes handling from staff and from a stranger without aggression.'),
        item('behavior', 'routine', routine[0], routine[1]),
        item('behavior', 'social', 'Behavior around other animals noted', 'Whether it is fine with other animals, and any it should not live with.', false),
        item('behavior', 'enrichment', 'Daily enrichment in place', 'Out-of-cage time, toys, foraging or other enrichment suited to the species.', false)
      ];
    }
    if (stage === 'clearance') {
      return [
        item('clearance', 'vet', 'Vet has declared it fit for adoption', 'A final exam, recorded by the vet.'),
        item('clearance', 'contagion', 'No contagious disease', 'Any quarantine is finished and the vet has cleared it.'),
        item('clearance', 'weight', 'Healthy weight and condition', 'Its body condition is acceptable and its weight is stable.'),
        item('clearance', 'profile', 'Adoption profile written, with final photos', 'Honest description, behavior notes and good photos.'),
        item('clearance', 'records', 'Health records ready for the adopter', 'Vaccination, treatment and sterilization documents prepared.')
      ];
    }
    return [];
  }

  const WORKING = STAGE_KEYS.filter((k) => k !== 'ready');
  const requiredOf = (species, stage, cond) => checklist(species, stage, cond).filter((i) => i.required);
  const condOf = (rehabCase) => (rehabCase && rehabCase.condition) || null;
  const isDone = (rehabCase, key) => !!(rehabCase && rehabCase.checklist && rehabCase.checklist[key] && rehabCase.checklist[key].done);

  // The required items still open, across every working stage, in the order they should be done
  function missingRequired(rehabCase, species) {
    return WORKING.flatMap((stage) => requiredOf(species, stage, condOf(rehabCase)).filter((i) => !isDone(rehabCase, i.key)));
  }

  // The stage follows the checklist: the first one with a required item still open. Everything done is final clearance.
  function derivedStage(rehabCase, species) {
    return WORKING.find((stage) => requiredOf(species, stage, condOf(rehabCase)).some((i) => !isDone(rehabCase, i.key))) || 'clearance';
  }

  // How far a case is: the share of all required items that are ticked
  function progress(rehabCase, species) {
    const all = WORKING.flatMap((stage) => requiredOf(species, stage, condOf(rehabCase)));
    if (rehabCase && rehabCase.stage === 'ready') return { pct: 100, done: all.length, total: all.length };
    const done = all.filter((i) => isDone(rehabCase, i.key)).length;
    return { pct: all.length ? Math.round((done / all.length) * 100) : 0, done, total: all.length };
  }

  // ---------------------------------------------------------------- the standard protocols
  const SECTIONS = [
    ['housing', 'Housing', '🏠'], ['feeding', 'Feeding and water', '🥣'], ['health', 'Health checks', '🩺'],
    ['handling', 'Handling', '🧤'], ['enrichment', 'Enrichment', '🧸'], ['redflags', 'Call the vet if', '🚨']
  ];

  const PROTOCOLS = {
    Dog: {
      housing: ['Give each dog its own clean, dry kennel with room to stand, turn and lie down. Keep it out of direct sun and rain.', 'Keep unfamiliar dogs apart and out of sight of cats. Clean and disinfect the kennel every day.'],
      feeding: ['Fresh, clean water at all times.', 'Adults: two meals a day. Puppies: three to four small meals. Feed thin dogs small portions several times a day and build up slowly.'],
      health: ['Examine on arrival, then once a day: eyes, nose, ears, mouth, coat, skin, paws, stool and appetite.', 'Check for fleas, ticks and skin problems. Keep a record of weight at intake and weekly.'],
      handling: ['Approach calmly from the side, avoid staring, and use a slip lead. Wear gloves with a fearful or injured dog.', 'Walk or give yard time at least twice a day so it can relieve itself.'],
      enrichment: ['Out-of-kennel time, a chew toy and a short daily training or play session reduce stress and barking.'],
      redflags: ['Bloody diarrhoea or repeated vomiting (possible parvovirus). Isolate it at once.', 'Pale gums, labored breathing, a swollen hard belly, seizures, collapse, heat stroke, or no eating for 48 hours.']
    },
    Cat: {
      housing: ['Use a quiet cage or room away from dogs, with a hiding box, a raised bed and a litter tray placed away from food and water.', 'Cover part of the cage with a cloth so it can hide. Keep sick cats apart from the rest.'],
      feeding: ['Fresh water, with wet food where possible. Offer small meals often.', 'A cat that does not eat for 24 hours needs attention, since a long fast can damage its liver.'],
      health: ['Check daily for sneezing, eye or nose discharge, fleas, ear mites and skin problems. Note the litter tray: urine and stool.', 'Ask the vet about testing for feline leukemia and FIV before it lives with other cats.'],
      handling: ['Handle quietly and as little as possible. Use a towel wrap for a frightened cat and wear gloves for a fearful or injured one.'],
      enrichment: ['Hiding places, a scratching post, a perch to look from and a daily play session with a wand toy.'],
      redflags: ['Straining in the litter tray or no urine (urgent, especially in males). Open-mouth breathing.', 'Not eating for 24 hours, repeated vomiting, severe eye or nose discharge, or a swollen belly.']
    },
    Bird: {
      housing: ['A cage big enough to spread its wings, with perches of different widths, out of drafts, direct sun, smoke and kitchen fumes. Cover part of it to feel safe.', 'Quarantine it away from other birds until a vet clears it. Cover the cage floor with paper so droppings can be checked.'],
      feeding: ['A pellet or seed mix suited to the species, with some fresh vegetables or fruit, and clean water changed daily.', 'Never feed avocado, chocolate, caffeine, alcohol or onion. Do not feed bread as a staple.'],
      health: ['Watch the droppings (color, amount, firmness), appetite, and feathers. A bird sitting fluffed up on the cage floor is very ill.', 'Wash hands after handling and wear a mask with a sick bird. Some bird diseases can pass to people.'],
      handling: ['Handle as little as possible. Use a towel, support the body and never squeeze the chest, because birds breathe by moving it.', 'Keep it away from open doors and windows.'],
      enrichment: ['Foraging toys, safe things to chew and a quiet routine with regular dark, calm hours for sleep.'],
      redflags: ['Fluffed up, sitting on the floor, tail bobbing with each breath, or open-beak breathing.', 'Not eating or no droppings for 12 hours, bleeding, a wing held low, or green or bloody droppings.']
    },
    Rabbit: {
      housing: ['A roomy pen with a solid floor (not wire), a hiding box and hay bedding. Keep it quiet, away from dogs and cats, and out of heat over 28 degrees Celsius.', 'Clean the litter area every day.'],
      feeding: ['Unlimited grass hay is most of the diet, plus fresh leafy vegetables, a small amount of pellets and clean water.', 'Change the diet slowly. Sudden changes can stop the gut.'],
      health: ['Check eating, droppings, teeth, eyes, ears, fur and the skin under the tail every day. Flies can lay eggs on a dirty rabbit.', 'Weigh it weekly.'],
      handling: ['Support its hindquarters whenever it is lifted and never lift it by the ears. Keep it low to the ground in case it jumps.'],
      enrichment: ['Hay to dig in, cardboard tunnels, safe things to chew and daily time out of the pen.'],
      redflags: ['No eating or no droppings for 12 hours (gut stasis, an emergency). A swollen belly.', 'Head tilt, diarrhoea, drooling, heavy breathing in heat, or maggots on the skin.']
    },
    'Small mammal': {
      housing: ['A secure, solid-floored enclosure with deep bedding, a hiding place and a steady room temperature. Keep it out of drafts and direct sun.', 'Guinea pigs prefer company, but do not mix unfamiliar animals of other species.'],
      feeding: ['Feed the diet of that exact species. Guinea pigs need hay and vitamin C. Hamsters and gerbils need a seed or pellet mix. Always give clean water.', 'Remove old fresh food each day.'],
      health: ['Check teeth, eyes, coat, skin and droppings daily. Watch for a wet tail or damp rear end, mites and wheezing.', 'Weigh it weekly.'],
      handling: ['Scoop gently with both hands and keep it low over a soft surface. Avoid grabbing, and handle only when it is awake and calm.'],
      enrichment: ['Tunnels, chew items and places to hide and dig.'],
      redflags: ['Not eating for 12 to 24 hours, wet tail or diarrhoea, labored breathing, a cold or limp body.', 'Overgrown teeth, bleeding, or swollen lumps.']
    },
    Reptile: {
      housing: ['An escape-proof enclosure with a warm basking area and a cooler area, UVB light for species that need it, and the right humidity for the species.', 'Keep it away from other reptiles. Heat and light must be correct from the first hour, because many problems start there.'],
      feeding: ['Feed what the species eats (insects, plants or whole prey) and offer water daily. Many reptiles also soak.', 'Do not force-feed. A reptile that is too cold will not digest, so fix the temperature first.'],
      health: ['Check eyes, mouth, skin, shell and limbs. Look for retained shed, mites, soft shell, mouth rot, or wheezing and bubbles at the nose.', 'Wash hands and use gloves. Reptiles can carry Salmonella.'],
      handling: ['Support the whole body and never grab a lizard by the tail. Snakes and large lizards need an experienced handler.'],
      enrichment: ['Hiding places, climbing branches, and a layout that lets it choose its temperature.'],
      redflags: ['Open-mouth breathing, bubbles at the nose or mouth, swelling, a soft shell or limbs, or a prolapse.', 'Lethargy even at the correct temperature, or not eating for a long time with weight loss.']
    },
    Other: {
      housing: ['Look up the species before settling it. Provide a secure, clean enclosure of a suitable size, with the right temperature and a place to hide.', 'Keep it apart from other animals until its needs are clear.'],
      feeding: ['Feed the diet of that species and offer clean water. If you are not sure what it eats, ask a vet before feeding.'],
      health: ['Examine on arrival, then daily: eyes, nose, skin or coat, droppings, appetite and behavior. Record its weight.', 'Wash hands after handling.'],
      handling: ['Handle calmly and as little as needed. Wear gloves with an unfamiliar or injured animal.'],
      enrichment: ['Provide hiding places and activity suited to the species.'],
      redflags: ['Not eating, labored breathing, bleeding, weakness, or sudden behavior change.', 'Any animal that may be protected wildlife. Contact the local wildlife office before doing anything else.']
    }
  };

  // ---------------------------------------------------------------- rules that depend on THIS animal
  const RULES = [
    { id: 'injury', level: 'critical', test: (c) => /injur|wound|bleed|fractur|broken|limp|hit by|accident|burn|bitten|laceration/.test(c.text),
      title: 'Injured: needs a vet today', detail: 'Keep it warm, quiet and still. Control bleeding with firm pressure on clean cloth. Give no human medicines and no food until the vet says so. Record the injury with photos.' },
    { id: 'heat', level: 'critical', test: (c) => /dehydrat|heat ?stroke|overheat|panting heavily|collapse/.test(c.text),
      title: 'Heat or dehydration risk', detail: 'Move it to a cool, shaded place and offer small sips of water. Cool it gently (never ice water) and get a vet right away.' },
    { id: 'seizure', level: 'critical', test: (c) => /seiz|convuls|unresponsive|not breathing|poison/.test(c.text),
      title: 'Possible emergency', detail: 'Do not give food or water. Keep it from hurting itself, note the time it started, and take it to a vet immediately.' },
    { id: 'illness', level: 'high', test: (c) => /sick|ill\b|cough|sneez|diarrh|vomit|letharg|discharge|mange|ringworm|parvo|distemper|fever|weak|tick fever/.test(c.text),
      title: 'Signs of illness: isolate and examine', detail: 'Keep it apart from other animals, use separate bowls and tools, and wash hands between animals. Have a vet examine it and clean the area with disinfectant.' },
    { id: 'thin', level: 'high', test: (c) => /thin|emaciat|underweight|starv|skinny|malnour/.test(c.text),
      title: 'Underweight: feed carefully', detail: 'Give small meals several times a day and increase slowly, since a starved animal can be harmed by sudden large meals. Weigh it every few days.' },
    { id: 'pregnant', level: 'high', test: (c) => /pregnan|nursing|lactat|gravid|with (puppies|kittens|litter|babies)/.test(c.text),
      title: 'Pregnant or nursing', detail: 'Give her a quiet, private, warm nesting space and extra food as the vet advises. Avoid moving her. Ask the vet before any vaccine or treatment.' },
    { id: 'young', level: 'high', test: (c) => /puppy|kitten|\bpup\b|baby|neonate|newborn|chick\b|fledgling|juvenile|infant|young/.test(c.text),
      title: 'Very young: warmth and frequent feeding', detail: 'Young animals chill and weaken quickly. Keep them warm and dry, feed small meals often, and keep them apart from sick adults. Ask the vet about their vaccine schedule.' },
    { id: 'aggressive', level: 'high', test: (c) => /aggress|\bbite\b|\bbit\b|snap|growl|feral|fearful|scared|hiss|attack/.test(c.text),
      title: 'Defensive behavior: handle with care', detail: 'Handle only when needed, with gloves or a catch pole, and with a second person. Never corner it. Log every incident. It needs a temperament assessment before any adoption.' },
    { id: 'senior', level: 'routine', test: (c) => /senior|elderly|geriatric|old age|\bold\b/.test(c.text),
      title: 'Older animal: gentle routine', detail: 'Give soft bedding, easy access to water and the toilet area, and ask the vet for a senior check, including teeth and joints.' },
    { id: 'wildlife', level: 'high', test: (c) => ['Bird', 'Reptile', 'Other'].includes(c.species),
      title: 'Check whether it is protected wildlife', detail: 'Philippine wildlife law restricts keeping and rehoming many wild birds, reptiles and other animals. Confirm with the local wildlife office before it is listed for adoption.' }
  ];

  const PHASES = {
    intake: { key: 'intake', label: 'Intake: first 24 hours' },
    holding: { key: 'holding', label: 'In holding: claim window open' },
    closing: { key: 'closing', label: 'Claim window closing' },
    overdue: { key: 'overdue', label: 'Claim window ended' },
    closed: { key: 'closed', label: 'Case closed' }
  };

  function phaseRules(c) {
    const out = [];
    if (c.phase === 'intake') {
      out.push({ level: 'high', title: 'First 24 hours: do these now', detail: 'Scan for a microchip or NFC tag, take photos, check for injuries, and offer water before food. Place it in a quiet kennel, and record its condition.' });
    }
    if (c.phase === 'closing') {
      out.push({ level: 'high', title: 'Claim window closes soon', detail: 'Confirm that the owner has been contacted by every route on record. Note each attempt, and decide whether to extend the window by 24 hours.' });
    }
    if (c.phase === 'overdue') {
      out.push({ level: 'high', title: 'Claim window has ended: decide its next step', detail: 'If it is healthy and unclaimed, start the rehabilitation track so it can be prepared for adoption. Transfer or euthanasia decisions belong to the vet and the facility manager.' });
    }
    if (c.daysHeld >= 7 && c.phase !== 'closed') {
      out.push({ level: 'routine', title: `Held for ${Math.floor(c.daysHeld)} days: reduce stress`, detail: 'Long stays wear on animals. Add daily out-of-cage time and enrichment, weigh it weekly, and look for early signs of kennel stress.' });
    }
    return out;
  }

  const RANK = { critical: 0, high: 1, routine: 2 };

  function recommend(imp, opts = {}) {
    const now = opts.now || Date.now();
    const species = window.PawSpecies ? window.PawSpecies.normalize(imp && imp.species) : ((imp && imp.species) || 'Other');
    const intake = imp && imp.intakeDate ? new Date(imp.intakeDate).getTime() : NaN;
    const deadline = imp && imp.claimDeadline ? new Date(imp.claimDeadline).getTime() : NaN;
    const open = !imp || imp.status === 'active_impounded' || imp.status === 'in_holding';
    const hoursHeld = Number.isFinite(intake) ? (now - intake) / HOUR : 0;
    const daysHeld = Math.max(hoursHeld / 24, 0);
    let phase = 'holding';
    if (!open) phase = 'closed';
    else if (Number.isFinite(deadline) && deadline < now) phase = 'overdue';
    else if (Number.isFinite(deadline) && deadline - now < 24 * HOUR) phase = 'closing';
    else if (hoursHeld < 24) phase = 'intake';

    // What the admin recorded before rehabilitation counts as much as the note taken at intake
    const cond = opts.condition || null;
    const tagWords = (cond && cond.tags || []).map((t) => ({ injured: 'injured', sick: 'sick', underweight: 'underweight', pregnant: 'pregnant', young: 'young', senior: 'senior', fearful: 'fearful', aggressive: 'aggressive', parasites: 'fleas ticks mites' }[t] || '')).join(' ');
    const ctx = {
      species, phase, daysHeld,
      text: [imp && imp.healthCondition, cond && cond.note, tagWords, imp && imp.petName, imp && imp.breed].filter(Boolean).join(' ').toLowerCase()
    };
    const conditionAlerts = [];
    if (cond && cond.overall === 'critical') conditionAlerts.push({ id: 'cond-critical', level: 'critical', title: 'Critical condition: a vet must see it today', detail: 'You recorded this animal as critical. Keep it warm and quiet, give no food or medicine unless a vet says so, and get a vet to examine it today. Rehabilitation can begin once it is stable.' });
    if (cond && cond.overall === 'vet_soon') conditionAlerts.push({ id: 'cond-vet', level: 'high', title: 'Needs a vet soon', detail: 'You recorded this animal as needing a vet. Book the exam now, record what the vet finds, and keep it apart from other animals until then.' });
    const alerts = conditionAlerts.concat(RULES.filter((r) => r.test(ctx)).map((r) => ({ id: r.id, level: r.level, title: r.title, detail: r.detail })))
      .concat(phaseRules(ctx).map((r) => ({ id: 'phase', ...r })))
      .sort((a, b) => RANK[a.level] - RANK[b.level]);

    const protocol = PROTOCOLS[species] || PROTOCOLS.Other;
    return {
      species,
      label: window.PawSpecies ? window.PawSpecies.label(species) : species,
      phase: PHASES[phase],
      alerts,
      sections: SECTIONS.map(([key, title, icon]) => ({ key, title, icon, items: protocol[key] || [] })),
      daysHeld
    };
  }

  const LEVEL_LABEL = { critical: 'Urgent', high: 'Important', routine: 'Routine' };

  // The recommendation as markup: what applies to this animal first, then the standard protocol
  function renderHtml(rec) {
    return `
      <div class="cg">
        <div class="cg-head">
          <span class="cg-species">${esc(window.PawSpecies ? window.PawSpecies.icon(rec.species) : '🐾')} ${esc(rec.label)}</span>
          <span class="cg-phase">${esc(rec.phase.label)}</span>
        </div>
        ${rec.alerts.length ? `
        <h4 class="cg-title">For this animal</h4>
        <ul class="cg-alerts">
          ${rec.alerts.map((a) => `
            <li class="cg-alert is-${a.level}">
              <span class="cg-level">${LEVEL_LABEL[a.level]}</span>
              <div><b>${esc(a.title)}</b><p>${esc(a.detail)}</p></div>
            </li>`).join('')}
        </ul>` : `<p class="cg-none">Nothing unusual is recorded for this animal. Follow the standard protocol below.</p>`}
        <h4 class="cg-title">Standard care protocol: ${esc(rec.label.toLowerCase())}</h4>
        <div class="cg-sections">
          ${rec.sections.map((s) => `
            <section class="cg-section${s.key === 'redflags' ? ' is-red' : ''}">
              <h5><span aria-hidden="true">${s.icon}</span> ${esc(s.title)}</h5>
              <ul>${s.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
            </section>`).join('')}
        </div>
        <p class="cg-note">General guidance for facility staff. It does not replace a veterinarian: when in doubt, call one.</p>
      </div>`;
  }

  return { STAGES, STAGE_KEYS, WORKING, checklist, progress, derivedStage, missingRequired, recommend, renderHtml, PROTOCOLS };
})();
