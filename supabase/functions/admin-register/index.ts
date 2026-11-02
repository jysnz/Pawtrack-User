// PawTrack admin console: files an access request after a server-side Cloudflare Turnstile check.
// Browsers cannot insert into admin_accounts directly; this function is the only way in.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_ACTION = 'admin-register';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

const PH_MOBILE = /^\+639\d{9}$/;

// Admins must be 18 or older, counted on the Philippine calendar date
function isAdult(birthDate: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const parsed = new Date(Date.UTC(y, mo - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== mo - 1 || parsed.getUTCDate() !== d || y < 1900) return false;
  const manila = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const cutoff = Date.UTC(manila.getUTCFullYear() - 18, manila.getUTCMonth(), manila.getUTCDate());
  return parsed.getTime() <= cutoff;
}

async function verifyTurnstile(token: string, remoteIp: string | null) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY is not configured');
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);
  const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: form });
  const outcome = await res.json();
  // Tokens are bound to the widget action, so a token from another form cannot be replayed here
  return outcome.success === true && outcome.action === TURNSTILE_ACTION;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const accessToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  const user = userData && userData.user;
  if (userError || !user || !user.email) return json(401, { error: 'Please sign in with Google again.' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid request body' });
  }

  const turnstileToken = text(body.turnstileToken, 4096);
  if (!turnstileToken) return json(400, { error: 'Please complete the security check.' });
  const remoteIp = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  try {
    if (!(await verifyTurnstile(turnstileToken, remoteIp))) {
      return json(400, { error: 'Security check failed. Please complete it again.' });
    }
  } catch (err) {
    console.error('[admin-register] Turnstile error:', (err as Error).message);
    return json(503, { error: 'Security check is unavailable right now. Please try again shortly.' });
  }

  const fullName = text(body.full_name, 120);
  const position = text(body.position, 120) || null;
  const phone = text(body.phone, 20);
  const birthDate = text(body.birth_date, 10);
  if (fullName.length < 2) return json(400, { error: 'Please enter your full name.' });
  if (!PH_MOBILE.test(phone)) return json(400, { error: 'Please enter a valid Philippine mobile number.' });
  if (!isAdult(birthDate)) return json(400, { error: 'Admins must be at least 18 years old. Please check your birth date.' });

  // Status (pending, or approved for bootstrap admins) is decided by the database trigger
  const { data: account, error: insertError } = await admin
    .from('admin_accounts')
    .insert({
      id: user.id,
      email: user.email.toLowerCase(),
      full_name: fullName,
      position,
      phone,
      birth_date: birthDate,
      avatar_url: (user.user_metadata && user.user_metadata.avatar_url) || null
    })
    .select('*')
    .single();

  if (insertError) {
    if (insertError.code === '23505') return json(409, { error: 'You have already requested access.' });
    console.error('[admin-register] Insert error:', insertError.message);
    return json(500, { error: 'Could not save your request. Please try again.' });
  }
  return json(200, { account });
});
