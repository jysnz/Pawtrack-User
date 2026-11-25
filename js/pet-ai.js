/**
 * Pet photo analysis and descriptions. Gemini reads the image through Supabase Edge Functions,
 * and the browser ranks missing pets from the observed traits.
 */

const PHOTO_MATCH_WEIGHTS = { color: 40, breed: 30, markings: 20, pattern: 10 };
const MIN_PHOTO_MATCH_SCORE = 30;
const PHOTO_COLORS = 'black|white|brown|grey|gray|golden|gold|cream|orange|ginger|tan|yellow|red|chocolate|rust|blue|green|pink|purple|silver|beige';
const PHOTO_COLOR_ALIASES = { gray: 'grey', gold: 'golden', ginger: 'orange', chocolate: 'brown' };
const PHOTO_PATTERN_ALIASES = {
  solid: 'solid', spotted: 'spotted', speckled: 'spotted', patched: 'patched', patchy: 'patched',
  striped: 'striped', tabby: 'striped', tricolor: 'tricolor', calico: 'calico', brindle: 'brindle',
  bicolor: 'bicolor', merle: 'merle', tortoiseshell: 'tortoiseshell', tuxedo: 'tuxedo'
};
const PHOTO_ACCESSORIES = 'collar|tag|harness|leash|bandana|bow';
const photoColorWords = new RegExp(`\\b(?:${PHOTO_COLORS})\\b`, 'g');
const photoAccessoryColors = new RegExp(`\\b(?:${PHOTO_COLORS})(?:(?: and | )(?:${PHOTO_COLORS}))* (?:${PHOTO_ACCESSORIES})s?\\b`, 'g');
const photoMarkingPhrases = new RegExp(
  `\\b(?:${PHOTO_COLORS}|floppy|upright|curled|cropped|docked|left|right) (?:${PHOTO_ACCESSORIES}|patch(?:es)?|spot|ear|tail|paw|chest|muzzle|face|nose)s?\\b|\\b(?:scars?|socks|freckles)\\b`, 'g'
);

function photoTraitText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Shared values divided by all observed values. Extra colors and conflicting traits reduce the score.
function photoTraitOverlap(observed, reported) {
  const shared = [...observed].filter((value) => reported.has(value)).length;
  return shared ? shared / new Set([...observed, ...reported]).size : 0;
}

function photoColors(text) {
  return new Set((text.replace(photoAccessoryColors, '').match(photoColorWords) || [])
    .map((color) => PHOTO_COLOR_ALIASES[color] || color));
}

function photoBreed(text) {
  if (text === 'n a' || /\b(?:unknown|unsure|unidentified)\b/.test(text)) return new Set();
  const words = text.split(' ').filter((word) => word && !/^(breed|the|other|none|na)$/.test(word))
    .map((word) => /^(mixed|cross|crossbreed)$/.test(word) ? 'mix' : word);
  return words.some((word) => word !== 'mix') ? new Set(words) : new Set();
}

function photoPatterns(text) {
  return new Set(text.replace(/\b(tri|bi) (?:color|colour)\b/g, '$1color').split(' ')
    .filter((word) => Object.hasOwn(PHOTO_PATTERN_ALIASES, word)).map((word) => PHOTO_PATTERN_ALIASES[word]));
}

function photoMarkings(text) {
  const visible = text.replace(/\b(?:no|without) (?:visible )?(?:scars?|socks|freckles)\b/g, '');
  return new Set((visible.match(photoMarkingPhrases) || []).map((marking) => marking
    .replace(photoColorWords, (color) => PHOTO_COLOR_ALIASES[color] || color)
    .replace(/\b(ear|tail|paw|spot|tag|collar|bandana|bow|scar)s\b/g, '$1')
    .replace(/\bpatches\b/g, 'patch')));
}

class PetAI {
  client() {
    return window.pawApp && window.pawApp.supabase;
  }

  // Shrinks a data-URL photo to a small JPEG so the request stays light. Other kinds of photo links are skipped.
  async imagePayload(photo, maxSide = 768) {
    if (!photo || !photo.startsWith('data:image/')) return null;
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Photo could not be read'));
      el.src = photo;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', 0.8);
    return { imageBase64: url.split(',')[1], mimeType: 'image/jpeg' };
  }

  // The function answers non-2xx responses with { error }, which supabase-js hides inside error.context
  async errorMessage(error) {
    try {
      if (error && error.context && typeof error.context.json === 'function') {
        const body = await error.context.json();
        if (body && body.error) return body.error;
      }
    } catch (e) { /* fall through */ }
    return (error && error.message) || 'The AI description service is unavailable.';
  }

  async describe(fields, photo) {
    const client = this.client();
    if (!client) throw new Error('Sign in to use the AI description.');
    let image = null;
    try { image = await this.imagePayload(photo); } catch (e) { /* write it from the details alone */ }

    const call = client.functions.invoke('generate-pet-description', { body: { ...fields, ...(image || {}) } });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('The AI took too long. Please try again.')), 25000));
    const { data, error } = await Promise.race([call, timeout]);
    if (error) throw new Error(await this.errorMessage(error));
    if (!data || !data.description) throw new Error('No description was produced. Please try again.');
    return data.description;
  }

  // Reads a photo with Gemini (through the photo-match Edge Function) and returns the traits it can see
  async readPhoto(photo) {
    const image = await this.imagePayload(photo);
    if (!image) throw new Error('This photo could not be read.');
    const cfg = window.PAWTRACK_SUPABASE;
    const response = await fetch(`${cfg.url}/functions/v1/photo-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.publishableKey },
      body: JSON.stringify({ image: `data:${image.mimeType};base64,${image.imageBase64}` })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `The AI could not read the photo (${response.status}).`);
    return data.traits || {};
  }

  // Screenshots, ID cards, documents and code have few colours and big flat areas; a photo of an animal does not.
  // A quick local check on a tiny copy of the picture, so it costs nothing.
  async looksLikeScreenshot(photo) {
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = photo;
      });
      const size = 96;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      const px = ctx.getImageData(0, 0, size, size).data;
      const colors = new Set();
      let flat = 0, pairs = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          colors.add(((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4));
          if (x < size - 1) {
            const j = i + 4;
            pairs++;
            if (Math.abs(px[i] - px[j]) + Math.abs(px[i + 1] - px[j + 1]) + Math.abs(px[i + 2] - px[j + 2]) < 6) flat++;
          }
        }
      }
      return colors.size < 140 && flat / pairs > 0.5;
    } catch (e) {
      return false; // cannot tell: let the AI check decide
    }
  }

  // Is this a real picture of a pet? Stops screenshots and unrelated pictures being sent as evidence.
  // 1) the local screenshot check, 2) when `ai` is true, Gemini says whether an animal is in the photo.
  // If the AI cannot be reached the photo is NOT accepted: only photos of pets get through.
  // `indicator` is the element to cover with a "Verifying photo" overlay while the check runs
  async checkPetPhoto(photo, { ai = true, indicator = null } = {}) {
    const stop = indicator ? this.showVerifying(indicator) : () => {};
    try {
      if (await this.looksLikeScreenshot(photo)) {
        return { ok: false, reason: 'This looks like a screenshot or a document, not a photo of a pet. Please take or choose a real photo of the animal.' };
      }
      if (!ai) return { ok: true };
      try {
        const traits = await this.readPhoto(photo);
        if (traits.isPet === false) {
          return { ok: false, reason: 'No pet was detected in this photo. Please choose a clear photo of the animal.' };
        }
      } catch (e) {
        // Only photos of pets are accepted, so a photo that could not be checked is not accepted either
        console.warn('[PetAI] Could not verify the photo:', e.message || e);
        return { ok: false, reason: 'We could not check this photo right now. Check your connection and try again.' };
      }
      return { ok: true };
    } finally {
      stop();
    }
  }

  // A spinner and "Verifying photo" over the photo area while it is being checked. Returns a function that removes it.
  showVerifying(el) {
    el.classList.add('photo-verifying');
    const overlay = document.createElement('div');
    overlay.className = 'photo-verify-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<span class="photo-verify-spinner" aria-hidden="true"></span><span class="photo-verify-text"><strong>Verifying photo</strong><small>Checking that it is a real photo of a pet</small></span>';
    el.appendChild(overlay);
    return () => { overlay.remove(); el.classList.remove('photo-verifying'); };
  }

  // A short written description from the traits Gemini saw in the photo
  describeTraits(traits) {
    const known = (v) => v && v !== 'Unknown';
    const parts = [];
    if (traits.summary) parts.push(String(traits.summary).trim().replace(/\.?$/, '.'));
    const look = [known(traits.species) && traits.species, known(traits.breed) && traits.breed].filter(Boolean).join(', ');
    if (look) parts.push(`${look}.`);
    if (traits.colors && traits.colors.length) parts.push(`Colors: ${traits.colors.join(', ')}${traits.coatPattern ? ` (${traits.coatPattern})` : ''}.`);
    if (traits.distinctMarkings) parts.push(`Markings: ${traits.distinctMarkings}.`);
    return parts.join(' ').slice(0, 600);
  }

  matchMissing(traits, limit = 3, { includeOwn = false } = {}) {
    const store = window.pawStore;
    const missing = store.getMapPets().filter((pet) => pet.status === 'lost' && (includeOwn || !store.isMyPet(pet)));
    if (traits.isPet === false) return { matches: [], checked: missing.length };

    const species = window.PawSpecies.normalize(traits.species);
    const colors = photoTraitText(Array.isArray(traits.colors) ? traits.colors.join(' ') : '');
    const breed = photoTraitText(traits.breed);
    const observed = {
      color: photoColors(colors),
      breed: photoBreed(breed),
      markings: photoMarkings(photoTraitText(traits.distinctMarkings)),
      pattern: photoPatterns(`${colors} ${photoTraitText(traits.coatPattern)}`)
    };

    const matches = missing.flatMap((pet) => {
      const reportedSpecies = window.PawSpecies.normalize(pet.species);
      if (species !== 'Other' && reportedSpecies !== 'Other' && species !== reportedSpecies) return [];

      const color = photoTraitText(pet.coatColor || pet.color);
      const description = photoTraitText(pet.description);
      const appearance = `${color} ${description}`;
      const reportedColors = photoColors(color);
      const reportedBreed = photoBreed(photoTraitText(pet.breed));
      const breedSimilarity = !reportedBreed.size && observed.breed.size && ` ${description} `.includes(` ${breed} `)
        ? .75 : photoTraitOverlap(observed.breed, reportedBreed);
      const similarity = {
        color: photoTraitOverlap(observed.color, reportedColors.size ? reportedColors : photoColors(description)),
        breed: breedSimilarity,
        markings: photoTraitOverlap(observed.markings, photoMarkings(appearance)),
        pattern: photoTraitOverlap(observed.pattern, photoPatterns(appearance))
      };
      // Keep the denominator fixed. Unknown traits earn zero points, so one known trait cannot score 100%.
      const score = Object.entries(PHOTO_MATCH_WEIGHTS).reduce((sum, [trait, weight]) => sum + similarity[trait] * weight, 0);
      return score >= MIN_PHOTO_MATCH_SCORE ? [{ pet, score }] : [];
    }).sort((a, b) => b.score - a.score).slice(0, limit)
      .map(({ pet, score }) => ({ pet, confidenceScore: Math.round(score) }));

    return { matches, checked: missing.length };
  }

  // Runs after a pet is registered, without holding up the registration: writes the description,
  // then saves it to the database and this device. A failure just leaves the pet without one.
  async writeInBackground(pet, draft) {
    try {
      const text = (await this.describe({
        name: draft.name, species: draft.species, breed: draft.breed,
        gender: draft.gender, color: draft.color, age: draft.age
      }, draft.photoUrl)).trim().slice(0, 600);
      if (!text) return;

      if (/^[0-9a-f-]{36}$/i.test(pet.id)) {
        const { error } = await this.client().from('registered_pets').update({ description: text }).eq('id', pet.id);
        if (error) throw new Error(error.message);
      }
      if (window.pawStore.getPetById(pet.id)) window.pawStore.savePet({ id: pet.id, description: text });
      if (window.petsView) window.petsView.refresh(true);
    } catch (err) {
      console.warn('[PetAI] description not added:', err.message);
    }
  }
}

window.petAI = new PetAI();
