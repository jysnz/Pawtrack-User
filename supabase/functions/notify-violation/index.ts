// PawTrack: emails a person, through Brevo, when an admin has recorded a violation against them.
//   { violation_id }
// The caller must be signed in and must be the admin who issued that violation. The mail goes out in the name of the
// impoundment facility that issued it ("<Facility> via PawTrack"), and replies go to that facility's email.
// The function claims the violation first (email_sent_at), so one violation sends at most one email.
// Secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL (verified in Brevo), BREVO_SENDER_NAME (optional),
// PAWTRACK_APP_URL (optional https link for the Open PawTrack button).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRAND = '#c2410c';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
const peso = (n: number) => `₱${Number(n).toLocaleString('en-US')}`;
const ordinal = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

function row(label: string, valueHtml: string): string {
  return `<tr>
    <td valign="top" style="padding:5px 12px 5px 0;width:96px;font:600 11px ${FONT};letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;">${label}</td>
    <td valign="top" style="padding:5px 0;font:14px/1.5 ${FONT};color:#1e293b;">${valueHtml}</td></tr>`;
}

type Facility = { name: string; address: string | null; phone: string | null; email: string | null; hours: string | null };
type V = { rule_name: string; section: string; offense: number; fine_php: number; reason: string; pet_name: string | null; created_at: string };

function violationEmail(name: string, v: V, facility: Facility | null, appUrl: string | null): string {
  const sender = facility ? esc(facility.name) : 'PawTrack';
  const date = new Date(v.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });
  const details = [
    row('Violation', `<strong>${esc(v.rule_name)}</strong>`),
    row('Section', esc(v.section)),
    row('Offense', esc(ordinal(v.offense))),
    row('Fine', v.fine_php > 0 ? `<strong style="color:${BRAND};">${esc(peso(v.fine_php))}</strong>` : 'Not stated on the notice'),
    v.pet_name ? row('Pet', esc(v.pet_name)) : '',
    row('Date', esc(date)),
    row('What happened', esc(v.reason)),
  ].join('');
  const fRows = facility ? [
    facility.address ? row('Address', esc(facility.address)) : '',
    facility.hours ? row('Hours', esc(facility.hours)) : '',
    facility.phone ? row('Phone', esc(facility.phone)) : '',
    facility.email ? row('Email', `<a href="mailto:${esc(facility.email)}" style="color:${BRAND};text-decoration:none;">${esc(facility.email)}</a>`) : '',
  ].join('') : '';
  const button = appUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0;"><tr><td align="center" bgcolor="${BRAND}" style="border-radius:10px;"><a href="${esc(appUrl)}" style="display:inline-block;padding:12px 22px;font:600 14px ${FONT};color:#ffffff;text-decoration:none;">Open PawTrack</a></td></tr></table>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Notice of violation</title></head>
<body style="margin:0;padding:0;background:#f4f1ec;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">A ${esc(v.section)} violation was recorded on your PawTrack account.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f1ec"><tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e2da;">
      <tr><td bgcolor="${BRAND}" style="padding:14px 28px;font:700 13px ${FONT};letter-spacing:.08em;text-transform:uppercase;color:#ffffff;">PawTrack <span style="font-weight:400;opacity:.85;">&nbsp;&middot;&nbsp; Notice of violation</span></td></tr>
      <tr><td style="padding:28px 28px 6px;">
        <h1 style="margin:0 0 6px;font:700 22px/1.25 ${FONT};color:#0f172a;">A violation was recorded on your account</h1>
        <p style="margin:0 0 16px;font:13px ${FONT};color:#94a3b8;">Sent by ${sender} through PawTrack</p>
        <p style="margin:0 0 6px;font:15px/1.6 ${FONT};color:#334155;">Hello <strong>${esc(name)}</strong>,</p>
        <p style="margin:0;font:15px/1.6 ${FONT};color:#334155;">${sender} recorded the violation below under the Quezon City Veterinary Code.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;"><tr><td style="padding:14px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${details}</table>
        </td></tr></table>
        <p style="margin:18px 0 0;font:15px/1.6 ${FONT};color:#334155;">You are directed to report to the City Veterinary Department for appropriate action.</p>
        ${button}
        ${facility ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:16px 18px;">
          <div style="font:700 12px ${FONT};letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Issued by</div>
          <div style="font:700 15px ${FONT};color:#0f172a;margin-bottom:6px;">${esc(facility.name)}</div>
          ${fRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${fRows}</table>` : ''}
        </td></tr></table>
        <p style="margin:14px 0 0;font:13px/1.5 ${FONT};color:#94a3b8;">Reply to this email if you think this was a mistake; it goes to ${esc(facility.name)}.</p>` : ''}
      </td></tr>
      <tr><td align="center" style="padding:24px 28px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:16px;font:11px/1.6 ${FONT};color:#94a3b8;">PawTrack NFC Pet Recovery &amp; Municipal Pound Network<br>You are receiving this because a violation was recorded on your PawTrack account.</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  let id = '';
  try { id = String((await req.json())?.violation_id ?? ''); } catch { /* handled below */ }
  if (!UUID.test(id)) return json(400, { error: 'A violation id is needed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: who } = await admin.auth.getUser(token);
  if (!who?.user) return json(401, { error: 'Sign in first' });

  // Only the admin who issued the violation can send its email, and only once
  const { data: v, error: claimErr } = await admin.from('violations')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', id).eq('issued_by', who.user.id).is('email_sent_at', null)
    .select('id, owner_id, rule_name, section, offense, fine_php, reason, pet_name, created_at, shelter_id').maybeSingle();
  if (claimErr) return json(500, { error: 'Could not look up the violation' });
  if (!v) return json(200, { sent: false, reason: 'nothing to send' });

  const release = () => admin.from('violations').update({ email_sent_at: null }).eq('id', id);
  try {
    const { data: guardian } = await admin.from('guardians').select('full_name, email').eq('id', v.owner_id).maybeSingle();
    let to = guardian?.email || '';
    if (!to) {
      const { data: owner } = await admin.auth.admin.getUserById(v.owner_id);
      to = owner?.user?.email || '';
    }
    if (!to) { await release(); return json(200, { sent: false, reason: 'the person has no email' }); }

    let facility: Facility | null = null;
    if (v.shelter_id) {
      const { data } = await admin.from('shelters').select('name, address, phone, email, hours').eq('id', v.shelter_id).maybeSingle();
      facility = data ?? null;
    }
    const brand = Deno.env.get('BREVO_SENDER_NAME') ?? 'PawTrack';
    const senderName = facility ? `${facility.name} via ${brand}` : brand;
    const appUrl = /^https:\/\//.test(Deno.env.get('PAWTRACK_APP_URL') ?? '') ? Deno.env.get('PAWTRACK_APP_URL')! : null;

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': Deno.env.get('BREVO_API_KEY')!, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: senderName.slice(0, 120), email: Deno.env.get('BREVO_SENDER_EMAIL') },
        ...(facility?.email ? { replyTo: { email: facility.email, name: facility.name } } : {}),
        to: [{ email: to }],
        subject: `Notice of violation: ${v.rule_name}`,
        htmlContent: violationEmail(String(guardian?.full_name || 'there'), v as V, facility, appUrl),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Brevo responded ${res.status}`);
    return json(200, { sent: true, via: facility ? 'facility' : 'pawtrack' });
  } catch (err) {
    await release();
    console.error('notify-violation failed:', err instanceof Error ? err.message : err);
    return json(502, { error: 'The email could not be sent' });
  }
});
