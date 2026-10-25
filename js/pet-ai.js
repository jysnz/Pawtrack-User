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

  // Reads the Register Pet form, writes into its description box and reports progress under it
  async fillRegisterForm({ auto = false } = {}) {
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const box = document.getElementById('reg-pet-description');
    const status = document.getElementById('reg-ai-status');
    const btn = document.getElementById('reg-ai-btn');
    if (!box) return false;

    const name = val('reg-pet-name');
    if (!name) {
      if (status) { status.textContent = 'Enter the pet name first.'; status.dataset.kind = 'error'; }
      document.getElementById('reg-pet-name')?.focus();
      return false;
    }

    const ageValue = parseInt(val('reg-pet-age'), 10);
    const unit = val('reg-pet-age-unit') === 'months' ? 'month' : 'year';
    const age = Number.isFinite(ageValue) ? `${ageValue} ${unit}${ageValue === 1 ? '' : 's'}` : '';

    if (btn) btn.disabled = true;
    if (status) { status.textContent = auto ? 'Writing a description for you...' : 'Writing...'; status.dataset.kind = 'busy'; }
    try {
      const text = await this.describe({
        name,
        species: val('reg-pet-species'),
        breed: val('reg-pet-breed'),
        gender: val('reg-pet-gender'),
        color: val('reg-pet-color'),
        age
      }, val('reg-pet-photo'));
      box.value = text;
      if (status) { status.textContent = 'Written by AI. Edit it if anything is off.'; status.dataset.kind = 'ok'; }
      return true;
    } catch (err) {
      if (status) { status.textContent = err.message; status.dataset.kind = 'error'; }
      return false;
    } finally {
      if (btn) btn.disabled = false;
    }
  }
}

window.petAI = new PetAI();
