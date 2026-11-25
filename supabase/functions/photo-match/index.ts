// Reads one uploaded photo with Google Gemini and returns the pet traits it can see
// (species, breed, colors, markings). The browser then ranks the missing pets locally,
// so the cost stays at one vision call per photo. Needs the GEMINI_API_KEY secret; GEMINI_MODEL is optional.
// Public (verify_jwt off) so visitors who are not signed in can search by photo, hence the per-IP limit.

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitHits = new Map<string, number[]>(); // best-effort, per instance

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TRAIT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isPet: { type: 'BOOLEAN' },
    species: { type: 'STRING', enum: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Small mammal', 'Reptile', 'Other', 'Unknown'] },
    breed: { type: 'STRING' },
    colors: { type: 'ARRAY', items: { type: 'STRING' } },
    coatPattern: { type: 'STRING' },
    size: { type: 'STRING', enum: ['Small', 'Medium', 'Large', 'Unknown'] },
    distinctMarkings: { type: 'STRING' },
    summary: { type: 'STRING' },
  },
  required: ['isPet', 'species', 'breed', 'colors', 'distinctMarkings', 'summary'],
};

const PROMPT = `You are helping a lost-pet recovery service in Metro Manila match a photo against missing pet reports.
Describe the main animal in this photo.
- species: Dog, Cat, Bird, Rabbit, Small mammal (hamster, guinea pig, ferret and the like), Reptile, Other, or Unknown.
- breed: most likely breed or mix (e.g. "Aspin", "Puspin", "Golden Retriever Mix"). Use "Unknown" if unsure.
- colors: simple lowercase color words for the coat (e.g. "golden", "white", "black", "brown", "orange", "grey", "tan", "brindle", "calico", "tricolor", "cream").
- coatPattern: e.g. solid, spotted, patched, striped, tricolor.
- distinctMarkings: visible identifying features using plain words (collar, tag, patch, spots, ear, tail, socks, chest, scar, fluffy, short).
- summary: one short sentence.
If there is no animal in the photo, set isPet to false.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateLimitHits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateLimitHits.set(ip, hits);
  return hits.length > RATE_LIMIT_MAX;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'The AI photo search is not configured yet.' }, 503);

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) return json({ error: 'Too many photo searches. Please wait a minute and try again.' }, 429);

  let image = '';
  try {
    image = String((await req.json())?.image ?? '');
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(image);
  const mimeType = match ? match[1] : 'image/jpeg';
  const data = match ? match[2] : image;
  if (!data) return json({ error: 'No image provided' }, 400);
  if (data.length * 0.75 > MAX_IMAGE_BYTES) return json({ error: 'Image is too large (max 4 MB)' }, 413);

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mimeType, data } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: TRAIT_SCHEMA, temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return json({ error: 'The AI service did not respond. Please try again.' }, 504);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Gemini error', res.status, detail.slice(0, 300));
    return json({ error: 'The AI service could not read the photo right now.' }, 502);
  }

  const result = await res.json().catch(() => ({}));
  const text = (result?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  try {
    return json({ success: true, traits: JSON.parse(text) });
  } catch {
    return json({ error: 'AI returned an unreadable response' }, 502);
  }
});
