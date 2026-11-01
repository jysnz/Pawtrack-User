// New guardian sign-up with an emailed one-time code. The account is created only after the code is entered.
//   { action: 'send',   email, turnstileToken }                       emails a 6-digit code through Brevo
//   { action: 'verify', email, code, password, full_name, phone }     checks the code, creates the account,
//                                                                     and returns a token_hash the browser
//                                                                     exchanges for a session (auth.verifyOtp)
// Secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL (verified in Brevo), BREVO_SENDER_NAME (optional), TURNSTILE_SECRET_KEY.
// Table: public.signup_otps (service role only).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_GAP_MS = 60 * 1000;
const SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
const PH_MOBILE = /^\+639\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The code is bound to the email and to a server-only value, so a leaked row cannot be brute-forced offline cheaply
function hashCode(email: string, code: string): Promise<string> {
  return sha256(`${email}:${code}:${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`);
}

function sixDigits(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}

async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY is not configured');
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const outcome = await res.json();
  return outcome.success === true;
}

async function sendCodeEmail(to: string, code: string) {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 14px; background: #ffffff; color: #1e293b;">
      <h2 style="margin: 0 0 6px; font-size: 20px; color: #0f172a;">Verify your email</h2>
      <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: #334155;">Use this code to finish creating your PawTrack account for <strong>${esc(to)}</strong>:</p>
      <div style="font-size: 34px; font-weight: 800; letter-spacing: 10px; text-align: center; color: #ba3820; background: #fff4f1; padding: 16px 12px; border-radius: 10px; border: 1px dashed #f0b3a6;">${esc(code)}</div>
      <p style="margin: 18px 0 0; font-size: 13px; line-height: 1.6; color: #64748b;">The code expires in 10 minutes. If you did not try to create a PawTrack account, you can ignore this email and nothing will be created.</p>
      <p style="margin: 20px 0 0; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">PawTrack NFC Pet Recovery</p>
    </div>`;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': Deno.env.get('BREVO_API_KEY')!, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: Deno.env.get('BREVO_SENDER_NAME') ?? 'PawTrack', email: Deno.env.get('BREVO_SENDER_EMAIL') },
      to: [{ email: to }],
      subject: `${code} is your PawTrack verification code`,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Brevo responded ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });

  if (!Deno.env.get('BREVO_API_KEY') || !Deno.env.get('BREVO_SENDER_EMAIL') || !Deno.env.get('TURNSTILE_SECRET_KEY')) {
    return json(503, { error: 'Email verification is not set up yet. Please try again later.' });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  const email = text(body.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return json(400, { error: 'Please enter a valid email address.' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------- send ----------
  if (body.action === 'send') {
    const turnstileToken = text(body.turnstileToken, 4096);
    if (!turnstileToken) return json(400, { error: 'Please complete the security check.' });
    const remoteIp = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
    try {
      if (!(await verifyTurnstile(turnstileToken, remoteIp))) return json(400, { error: 'Security check failed. Please complete it again.' });
    } catch (err) {
      console.error('[signup-otp] Turnstile error:', (err as Error).message);
      return json(503, { error: 'Security check is unavailable right now. Please try again shortly.' });
    }

    const { data: existing } = await admin.from('guardians').select('id').eq('email', email).maybeSingle();
    if (existing) return json(409, { error: 'An account with this email already exists. Try logging in instead.' });

    const now = Date.now();
    const { data: row } = await admin.from('signup_otps').select('*').eq('email', email).maybeSingle();
    let windowStarted = new Date(now).toISOString();
    let sends = 1;
    if (row) {
      const sinceLast = now - new Date(row.sent_at).getTime();
      if (sinceLast < RESEND_GAP_MS) {
        return json(429, { error: `Please wait ${Math.ceil((RESEND_GAP_MS - sinceLast) / 1000)} seconds before asking for another code.`, retryAfter: Math.ceil((RESEND_GAP_MS - sinceLast) / 1000) });
      }
      if (now - new Date(row.window_started_at).getTime() < 60 * 60 * 1000) {
        if (row.sends_in_window >= SENDS_PER_HOUR) return json(429, { error: 'Too many codes requested for this email. Please try again in an hour.' });
        windowStarted = row.window_started_at;
        sends = row.sends_in_window + 1;
      }
    }

    const code = sixDigits();
    const { error: saveError } = await admin.from('signup_otps').upsert({
      email,
      code_hash: await hashCode(email, code),
      expires_at: new Date(now + CODE_TTL_MS).toISOString(),
      attempts: 0,
      sent_at: new Date(now).toISOString(),
      window_started_at: windowStarted,
      sends_in_window: sends,
    });
    if (saveError) {
      console.error('[signup-otp] save error:', saveError.message);
      return json(500, { error: 'Could not send the code. Please try again.' });
    }
    try {
      await sendCodeEmail(email, code);
    } catch (err) {
      console.error('[signup-otp] Brevo error:', (err as Error).message);
      await admin.from('signup_otps').delete().eq('email', email);
      return json(502, { error: 'The email could not be sent right now. Please try again.' });
    }
    return json(200, { sent: true, expiresInSeconds: CODE_TTL_MS / 1000, resendInSeconds: RESEND_GAP_MS / 1000 });
  }

  // ---------- verify ----------
  if (body.action === 'verify') {
    const code = text(body.code, 6);
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName = text(body.full_name, 80);
    const phone = text(body.phone, 20);
    if (!/^\d{6}$/.test(code)) return json(400, { error: 'Enter the 6-digit code from your email.' });
    if (fullName.length < 2) return json(400, { error: 'Please enter your full name.' });
    if (!PH_MOBILE.test(phone)) return json(400, { error: 'Please enter a valid Philippine mobile number.' });
    if (
      password.length < 10 || password.length > 72 ||
      !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9\s]/.test(password)
    ) {
      return json(400, { error: 'Password needs 10+ characters with an uppercase letter, a lowercase letter, a number and a symbol.' });
    }

    const { data: row } = await admin.from('signup_otps').select('*').eq('email', email).maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return json(400, { error: 'That code has expired. Send a new one.', expired: true });
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await admin.from('signup_otps').delete().eq('email', email);
      return json(429, { error: 'Too many wrong codes. Send a new one.', expired: true });
    }
    if ((await hashCode(email, code)) !== row.code_hash) {
      await admin.from('signup_otps').update({ attempts: row.attempts + 1 }).eq('email', email);
      const left = MAX_ATTEMPTS - row.attempts - 1;
      return json(400, { error: left > 0 ? `That code is incorrect. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code is incorrect. Send a new one.', expired: left <= 0 });
    }
    await admin.from('signup_otps').delete().eq('email', email); // a code works once

    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { signup_source: 'pawtrack_owner', full_name: fullName, phone },
    });
    if (createError) {
      if (/already|registered|exists/i.test(createError.message)) return json(409, { error: 'An account with this email already exists. Try logging in instead.' });
      if ((createError as { code?: string }).code === 'weak_password' || /password/i.test(createError.message)) {
        return json(400, { error: 'That password is too weak or has appeared in a data breach. Please choose a different one.', expired: true });
      }
      console.error('[signup-otp] createUser error:', createError.message);
      return json(500, { error: 'Could not create your account. Please try again.' });
    }

    // A one-time token the browser exchanges for a session, so the new guardian lands signed in
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const tokenHash = link && link.properties && link.properties.hashed_token;
    if (linkError || !tokenHash) {
      console.error('[signup-otp] generateLink error:', linkError && linkError.message);
      return json(200, { created: true, token_hash: null });
    }
    return json(200, { created: true, token_hash: tokenHash });
  }

  return json(400, { error: 'Unknown action.' });
});
