// PawTrack admin console: creates the admin account after a server-side Cloudflare Turnstile check.
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
const MAX_ATTEMPTS = 5;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Same scheme as admin-signup-otp, which emails the code and stores it in admin_signup_otps
function hashCode(email: string, code: string): Promise<string> {
  return sha256(`admin:${email}:${code}:${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`);
}

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

  // Signing in with Google proves the address, but the console still asks for the 6-digit code emailed to it
  // (sent by admin-signup-otp after its own Turnstile check), so the code is what lets this request through.
  const code = text(body.code, 6);
  if (!/^\d{6}$/.test(code)) return json(400, { error: 'Enter the 6-digit code from your email.' });
  const email = user.email.toLowerCase();
  const { data: row } = await admin.from('admin_signup_otps').select('*').eq('email', email).maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return json(400, { error: 'That code has expired. Send a new one.', expired: true });
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await admin.from('admin_signup_otps').delete().eq('email', email);
    return json(429, { error: 'Too many wrong codes. Send a new one.', expired: true });
  }
  if ((await hashCode(email, code)) !== row.code_hash) {
    await admin.from('admin_signup_otps').update({ attempts: row.attempts + 1 }).eq('email', email);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return json(400, { error: left > 0 ? `That code is incorrect. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code is incorrect. Send a new one.', expired: left <= 0 });
  }

  const fullName = text(body.full_name, 120);
  const position = text(body.position, 120) || null;
  const phone = text(body.phone, 20);
  const birthDate = text(body.birth_date, 10);
  if (fullName.length < 2) return json(400, { error: 'Please enter your full name.' });
  if (!PH_MOBILE.test(phone)) return json(400, { error: 'Please enter a valid Philippine mobile number.' });
  if (!isAdult(birthDate)) return json(400, { error: 'Admins must be at least 18 years old. Please check your birth date.' });

  // The status (approved) and the age rule are enforced by the database trigger
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
    if (insertError.code === '23505') return json(409, { error: 'This account is already set up. Log in to continue.' });
    console.error('[admin-register] Insert error:', insertError.message);
    return json(500, { error: 'Could not create your account. Please try again.' });
  }
  await admin.from('admin_signup_otps').delete().eq('email', email); // a code works once
  return json(200, { account });
});
