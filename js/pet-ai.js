/**
 * AI-written pet descriptions. The text comes from the generate-pet-description Supabase Edge Function,
 * which asks Google Gemini; the API key never reaches the browser.
 */

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
  // If the AI cannot be reached the photo is allowed (the local check still applied).
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
        console.warn('[PetAI] Could not verify the photo:', e.message || e);
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

  // Ranks the pets already reported missing against what the photo shows. Their descriptions are part of the comparison.
  matchMissing(traits, limit = 3) {
    const store = window.pawStore;
    const missing = store.getMapPets().filter((p) => p.status === 'lost' && !store.isMyPet(p));
    const colors = (traits.colors || []).join(' ');
    const sighting = {
      species: traits.species && traits.species !== 'Unknown' ? traits.species : '',
      breed: traits.breed && traits.breed !== 'Unknown' ? traits.breed : '',
      color: [colors, traits.coatPattern || ''].join(' ').trim(),
      distinctMarkings: traits.distinctMarkings || '',
      comments: `${colors} ${traits.distinctMarkings || ''}`.trim()
    };
    const matches = store.runAiPetMatch(sighting, missing).filter((m) => m.confidenceScore > 0).slice(0, limit);
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
