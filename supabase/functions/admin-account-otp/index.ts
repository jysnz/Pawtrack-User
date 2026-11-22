// PawTrack admin console: a signed-in admin changes their email or password, confirmed by an emailed one-time code.
//   { action: 'send',   purpose: 'email',    new_email }               emails a 6-digit code to the NEW address
//   { action: 'send',   purpose: 'facility_email', email }              emails a code to a facility's official email, before the facility is registered
//   { action: 'verify', purpose: 'facility_email', email, code }      checks that code (nothing is changed)
//   { action: 'send',   purpose: 'password' }                          emails a 6-digit code to the CURRENT address
//   { action: 'verify', purpose: 'email',    code }                    checks the code, then changes the sign-in email
//   { action: 'check',  purpose: 'password', code }                    checks the code (nothing is changed yet)
//   { action: 'verify', purpose: 'password', new_password }            after a correct check: sets the new password
// The caller must be signed in (their access token identifies them) and an approved admin who signs in with email + password.
// The email/password is only changed here, on the server, after the code is proven, so it cannot be skipped from the browser.
// Secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL (verified in Brevo), BREVO_SENDER_NAME (optional).
// Table: public.admin_account_otps (service role only). Function: public.auth_email_taken (service role only).
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
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Bound to the account, the purpose, the target address and a server-only value
function hashCode(userId: string, purpose: string, target: string, code: string): Promise<string> {
  return sha256(`acct:${userId}:${purpose}:${target}:${code}:${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`);
}

function sixDigits(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}

async function sendMail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': Deno.env.get('BREVO_API_KEY')!, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: Deno.env.get('BREVO_SENDER_NAME') ?? 'PawTrack', email: Deno.env.get('BREVO_SENDER_EMAIL') },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Brevo responded ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
}

function card(title: string, intro: string, body: string, footer: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 14px; background: #ffffff; color: #1e293b;">
      <h2 style="margin: 0 0 6px; font-size: 20px; color: #0f172a;">${title}</h2>
      <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: #334155;">${intro}</p>
      ${body}
      <p style="margin: 18px 0 0; font-size: 13px; line-height: 1.6; color: #64748b;">${footer}</p>
      <p style="margin: 20px 0 0; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">PawTrack Admin Console</p>
    </div>`;
}

function codeBox(code: string): string {
  return `<div style="font-size: 34px; font-weight: 800; letter-spacing: 10px; text-align: center; color: #ba3820; background: #fff4f1; padding: 16px 12px; border-radius: 10px; border: 1px dashed #f0b3a6;">${esc(code)}</div>`;
}

function codeEmail(purpose: string, to: string, code: string): { subject: string; html: string } {
  if (purpose === 'facility_email') {
    return {
      subject: `${code} is your PawTrack facility email code`,
      html: card('Confirm the facility email', `Use this code to confirm that <strong>${esc(to)}</strong> is the official email of the impoundment facility being registered on PawTrack:`, codeBox(code),
        'The code expires in 10 minutes. If you did not expect this, ignore this message and nothing will be registered.'),
    };
  }
  if (purpose === 'email') {
    return {
      subject: `${code} is your PawTrack email change code`,
      html: card('Confirm your new email', `Use this code to make <strong>${esc(to)}</strong> the sign-in email for your PawTrack admin account:`, codeBox(code),
        'The code expires in 10 minutes. If you did not ask to change your email, you can ignore this message and nothing will change.'),
    };
  }
  return {
    subject: `${code} is your PawTrack password change code`,
    html: card('Change your password', 'Use this code to confirm you want to change the password of your PawTrack admin account:', codeBox(code),
      'The code expires in 10 minutes. If you did not ask to change your password, ignore this message and consider changing it, because someone may be using your account.'),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });

  if (!Deno.env.get('BREVO_API_KEY') || !Deno.env.get('BREVO_SENDER_EMAIL')) {
    return json(503, { error: 'Email is not set up yet. Please try again later.' });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------- who is asking ----------
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = token ? await admin.auth.getUser(token) : { data: null, error: new Error('no token') };
  const user = auth && auth.user;
  if (authError || !user || !user.email) return json(401, { error: 'Please sign in again.' });
  const currentEmail = user.email.toLowerCase();

  const { data: account } = await admin.from('admin_accounts').select('id, status, full_name').eq('id', user.id).maybeSingle();
  if (!account || account.status !== 'approved') return json(403, { error: 'Only approved admins can change these settings.' });
  const purpose = body.purpose === 'email' || body.purpose === 'password' || body.purpose === 'facility_email' ? body.purpose : '';
  if (!purpose) return json(400, { error: 'Unknown request.' });

  // ---------- send ----------
  if (body.action === 'send') {
    let target = '';
    if (purpose === 'email') {
      target = text(body.new_email, 254).toLowerCase();
      if (!EMAIL.test(target)) return json(400, { error: 'Enter a valid email address.' });
      if (target === currentEmail) return json(400, { error: 'That is already your email.' });
      const { data: taken } = await admin.rpc('auth_email_taken', { p_email: target });
      if (taken) return json(409, { error: 'That email is already used by another account.' });
    }
    if (purpose === 'facility_email') {
      target = text(body.email, 254).toLowerCase();
      if (!EMAIL.test(target)) return json(400, { error: 'Enter a valid email address.' });
    }
    const recipient = (purpose === 'email' || purpose === 'facility_email') ? target : currentEmail;

    const now = Date.now();
    const { data: row } = await admin.from('admin_account_otps').select('*').eq('user_id', user.id).eq('purpose', purpose).maybeSingle();
    let windowStarted = new Date(now).toISOString();
    let sends = 1;
    if (row) {
      const sinceLast = now - new Date(row.sent_at).getTime();
      if (sinceLast < RESEND_GAP_MS) {
        const wait = Math.ceil((RESEND_GAP_MS - sinceLast) / 1000);
        return json(429, { error: `Please wait ${wait} seconds before asking for another code.`, retryAfter: wait });
      }
      if (now - new Date(row.window_started_at).getTime() < 60 * 60 * 1000) {
        if (row.sends_in_window >= SENDS_PER_HOUR) return json(429, { error: 'Too many codes requested. Please try again in an hour.' });
        windowStarted = row.window_started_at;
        sends = row.sends_in_window + 1;
      }
    }

    const code = sixDigits();
    const { error: saveError } = await admin.from('admin_account_otps').upsert({
      user_id: user.id,
      purpose,
      target: (purpose === 'email' || purpose === 'facility_email') ? target : null,
      code_hash: await hashCode(user.id, purpose, target, code),
      expires_at: new Date(now + CODE_TTL_MS).toISOString(),
      attempts: 0,
      verified_at: null,
      sent_at: new Date(now).toISOString(),
      window_started_at: windowStarted,
      sends_in_window: sends,
    });
    if (saveError) {
      console.error('[admin-account-otp] save error:', saveError.message);
      return json(500, { error: 'Could not send the code. Please try again.' });
    }
    try {
      const mail = codeEmail(purpose, recipient, code);
      await sendMail(recipient, mail.subject, mail.html);
    } catch (err) {
      console.error('[admin-account-otp] Brevo error:', (err as Error).message);
      await admin.from('admin_account_otps').delete().eq('user_id', user.id).eq('purpose', purpose);
      return json(502, { error: 'The email could not be sent right now. Please try again.' });
    }
    return json(200, { sent: true, sentTo: recipient, expiresInSeconds: CODE_TTL_MS / 1000, resendInSeconds: RESEND_GAP_MS / 1000 });
  }

  // ---------- check: prove the emailed code first (password change) ----------
  if (body.action === 'check') {
    if (purpose !== 'password') return json(400, { error: 'Unknown action.' });
    const code = text(body.code, 6);
    if (!/^\d{6}$/.test(code)) return json(400, { error: 'Enter the 6-digit code from your email.' });
    const { data: row } = await admin.from('admin_account_otps').select('*').eq('user_id', user.id).eq('purpose', purpose).maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return json(400, { error: 'That code has expired. Send a new one.', expired: true });
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await admin.from('admin_account_otps').delete().eq('user_id', user.id).eq('purpose', purpose);
      return json(429, { error: 'Too many wrong codes. Send a new one.', expired: true });
    }
    if ((await hashCode(user.id, purpose, row.target ?? '', code)) !== row.code_hash) {
      await admin.from('admin_account_otps').update({ attempts: row.attempts + 1 }).eq('user_id', user.id).eq('purpose', purpose);
      const left = MAX_ATTEMPTS - row.attempts - 1;
      return json(400, { error: left > 0 ? `That code is incorrect. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code is incorrect. Send a new one.', expired: left <= 0 });
    }
    // Correct: the new password may now be set, for the next 10 minutes
    await admin.from('admin_account_otps').update({
      verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      attempts: 0,
    }).eq('user_id', user.id).eq('purpose', purpose);
    return json(200, { verified: true, expiresInSeconds: CODE_TTL_MS / 1000 });
  }

  // ---------- set the new password (only after a correct check) ----------
  if (body.action === 'verify' && purpose === 'password') {
    const newPassword = typeof body.new_password === 'string' ? body.new_password : '';
    if (
      newPassword.length < 10 || newPassword.length > 72 ||
      !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9\s]/.test(newPassword)
    ) {
      return json(400, { error: 'Password needs 10+ characters with an uppercase letter, a lowercase letter, a number and a symbol.' });
    }
    const { data: row } = await admin.from('admin_account_otps').select('*').eq('user_id', user.id).eq('purpose', purpose).maybeSingle();
    if (!row || !row.verified_at || new Date(row.expires_at).getTime() < Date.now()) {
      return json(400, { error: 'Confirm the code from your email first.', expired: true });
    }
    const { error: pwError } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
    if (pwError) {
      const message = pwError.message || '';
      if ((pwError as { code?: string }).code === 'weak_password' || /password/i.test(message)) {
        // The code stays verified: pick a different password without asking for a new code
        return json(400, { error: 'That password is too weak or has appeared in a data breach. Please choose a different one.' });
      }
      console.error('[admin-account-otp] password update error:', message);
      return json(500, { error: 'Could not change your password. Please try again.' });
    }
    await admin.from('admin_account_otps').delete().eq('user_id', user.id).eq('purpose', purpose); // works once
    // Everyone else signed in with the old password is signed out; this browser stays signed in
    try { await admin.auth.admin.signOut(token, 'others'); } catch (err) { console.error('[admin-account-otp] signOut others:', (err as Error).message); }
    try {
      await sendMail(currentEmail, 'Your PawTrack password was changed', card('Your password was changed',
        'The password of your PawTrack admin account was just changed.', '',
        'If this was not you, contact an administrator right away.'));
    } catch (err) {
      console.error('[admin-account-otp] notice error:', (err as Error).message);
    }
    return json(200, { changed: true });
  }

  // ---------- verify (facility official email) ----------
  if (body.action === 'verify' && purpose === 'facility_email') {
    const code = text(body.code, 6);
    const email = text(body.email, 254).toLowerCase();
    if (!/^\d{6}$/.test(code)) return json(400, { error: 'Enter the 6-digit code from your email.' });
    const { data: row } = await admin.from('admin_account_otps').select('*').eq('user_id', user.id).eq('purpose', purpose).maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now() || row.target !== email) {
      return json(400, { error: 'That code has expired. Send a new one.', expired: true });
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await admin.from('admin_account_otps').delete().eq('user_id', user.id).eq('purpose', purpose);
      return json(429, { error: 'Too many wrong codes. Send a new one.', expired: true });
    }
    if ((await hashCode(user.id, purpose, row.target ?? '', code)) !== row.code_hash) {
      await admin.from('admin_account_otps').update({ attempts: row.attempts + 1 }).eq('user_id', user.id).eq('purpose', purpose);
      const left = MAX_ATTEMPTS - row.attempts - 1;
      return json(400, { error: left > 0 ? `That code is incorrect. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code is incorrect. Send a new one.', expired: left <= 0 });
    }
    await admin.from('admin_account_otps').delete().eq('user_id', user.id).eq('purpose', purpose); // works once
    return json(200, { verified: true });
  }

  // ---------- verify (email change) ----------
  if (body.action === 'verify') {
    const code = text(body.code, 6);
    if (!/^\d{6}$/.test(code)) return json(400, { error: 'Enter the 6-digit code from your email.' });

    const { data: row } = await admin.from('admin_account_otps').select('*').eq('user_id', user.id).eq('purpose', purpose).maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return json(400, { error: 'That code has expired. Send a new one.', expired: true });
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await admin.from('admin_account_otps').delete().eq('user_id', user.id).eq('purpose', purpose);
      return json(429, { error: 'Too many wrong codes. Send a new one.', expired: true });
    }
    if ((await hashCode(user.id, purpose, row.target ?? '', code)) !== row.code_hash) {
      await admin.from('admin_account_otps').update({ attempts: row.attempts + 1 }).eq('user_id', user.id).eq('purpose', purpose);
      const left = MAX_ATTEMPTS - row.attempts - 1;
      return json(400, { error: left > 0 ? `That code is incorrect. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code is incorrect. Send a new one.', expired: left <= 0 });
    }
    await admin.from('admin_account_otps').delete().eq('user_id', user.id).eq('purpose', purpose); // a code works once

    const target = String(row.target || '').toLowerCase();
    if (!EMAIL.test(target)) return json(400, { error: 'Send a new code.', expired: true });
    const { data: taken } = await admin.rpc('auth_email_taken', { p_email: target });
    if (taken) return json(409, { error: 'That email is already used by another account.' });

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { email: target, email_confirm: true });
    if (updateError) {
      console.error('[admin-account-otp] email update error:', updateError.message);
      return json(500, { error: 'Could not change your email. Please try again.' });
    }
    // The admin profile keeps its own copy of the address: keep both in step, or undo
    const { error: rowError } = await admin.from('admin_accounts').update({ email: target }).eq('id', user.id);
    if (rowError) {
      console.error('[admin-account-otp] profile update error:', rowError.message);
      await admin.auth.admin.updateUserById(user.id, { email: currentEmail, email_confirm: true });
      return json(500, { error: 'Could not change your email. Please try again.' });
    }
    try {
      await sendMail(currentEmail, 'Your PawTrack sign-in email was changed', card('Your email was changed',
        `The sign-in email of your PawTrack admin account was changed to <strong>${esc(target)}</strong>.`, '',
        'If this was not you, contact an administrator right away.'));
    } catch (err) {
      console.error('[admin-account-otp] notice error:', (err as Error).message);
    }
    return json(200, { changed: true, email: target });
  }

  return json(400, { error: 'Unknown action.' });
});
