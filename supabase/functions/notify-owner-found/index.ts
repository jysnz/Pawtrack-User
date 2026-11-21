// PawTrack: emails a pet's owner, through Brevo, when a passerby has reported the pet as found.
//   { missing_pet_id }
// The mail is sent in the name of the impoundment facility the lost report was routed to (replies go to that facility),
// or in PawTrack's own name when no facility covers the place the pet was last seen.
// The caller needs no sign-in (finders can be guests), so nothing is taken from the request except the report id:
// the function only sends when notify_missing_pet_reporter stamped a fresh 'found' alert on that report, and it
// claims the alert first, so one alert produces at most one email however often this is called.
// Secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL (verified in Brevo), BREVO_SENDER_NAME (optional),
// PAWTRACK_APP_URL (optional https link for the Open PawTrack button; the button is left out without it).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const ALERT_WINDOW_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

type Facility = { name: string; address: string | null; phone: string | null; email: string | null; hours: string | null };
type Finder = { location: string | null; phone: string | null; note: string | null; raw: string };

// The in-app alert is one sentence: 'Someone found X near PLACE. Finder phone: N. Message: "..."'.
// Split it back into parts so the email can lay them out; anything that does not parse is shown as written.
function parseFinder(message: string | null, location: string | null, petName: string): Finder {
  const raw = message?.trim() || `Someone found ${petName}.`;
  const phone = raw.match(/Finder phone:\s*(.+?)(?:\.\s*Message:\s*"|$)/s)?.[1]?.trim() || null;
  const note = raw.match(/Message:\s*"([\s\S]*)"\s*$/)?.[1]?.trim() || null;
  return { location: location?.trim() || null, phone, note, raw };
}

const BRAND = '#c2410c';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const dial = (v: string) => v.replace(/[^\d+]/g, '');

// A bulletproof button (a table cell with a background), so it renders in Outlook as well as Gmail
function button(href: string, label: string, primary: boolean): string {
  const bg = primary ? BRAND : '#ffffff';
  const fg = primary ? '#ffffff' : '#1e293b';
  const border = primary ? BRAND : '#cbd5e1';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 8px 10px 0;"><tr>
    <td align="center" bgcolor="${bg}" style="border-radius:10px;border:1px solid ${border};">
      <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font:600 14px ${FONT};color:${fg};text-decoration:none;">${esc(label)}</a>
    </td></tr></table>`;
}

// One labelled line in a details card
function row(label: string, valueHtml: string): string {
  return `<tr>
    <td valign="top" style="padding:5px 12px 5px 0;width:92px;font:600 11px ${FONT};letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;">${label}</td>
    <td valign="top" style="padding:5px 0;font:14px/1.5 ${FONT};color:#1e293b;">${valueHtml}</td>
  </tr>`;
}

function foundEmail(ownerName: string, petName: string, petPhoto: string | null, finder: Finder, facility: Facility | null, appUrl: string | null): string {
  const pet = esc(petName);
  const sender = facility ? esc(facility.name) : 'PawTrack';
  const phoneLink = (n: string) => `<a href="tel:${esc(dial(n))}" style="color:${BRAND};font-weight:600;text-decoration:none;">${esc(n)}</a>`;

  const preheader = finder.location
    ? `Someone found ${petName} near ${finder.location}. Call the finder to arrange a reunion.`
    : `Someone found ${petName}. Call the finder to arrange a reunion.`;

  const photo = petPhoto
    ? `<img src="${esc(petPhoto)}" width="88" height="88" alt="${pet}" style="display:block;margin:0 auto 14px;width:88px;height:88px;border-radius:50%;object-fit:cover;border:3px solid #ffffff;box-shadow:0 0 0 2px #fed7aa;">`
    : `<div style="margin:0 auto 14px;width:64px;height:64px;line-height:64px;border-radius:50%;background:#fff7ed;font-size:30px;text-align:center;">&#128062;</div>`;

  // Where the pet is and how to reach the finder: the part the owner acts on first
  const finderRows = [
    finder.location ? row('Found near', esc(finder.location)) : '',
    finder.phone ? row('Finder', phoneLink(finder.phone)) : '',
    finder.note ? row('Message', `<span style="color:#475569;">&ldquo;${esc(finder.note)}&rdquo;</span>`) : '',
  ].join('');
  const finderCard = finderRows
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
         <tr><td style="padding:16px 18px;">
           <div style="font:700 12px ${FONT};letter-spacing:.06em;text-transform:uppercase;color:#15803d;margin-bottom:6px;">From the finder</div>
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${finderRows}</table>
         </td></tr></table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;"><tr><td style="padding:16px 18px;font:14px/1.6 ${FONT};color:#166534;">${esc(finder.raw)}</td></tr></table>`;

  const buttons = [
    finder.phone ? button(`tel:${dial(finder.phone)}`, 'Call the finder', true) : '',
    appUrl ? button(appUrl, 'Open PawTrack', !finder.phone) : '',
  ].join('');

  const steps = [
    finder.phone ? 'Call or message the finder to arrange where to meet.' : 'Open PawTrack to get in touch with the finder.',
    'Bring a photo or the pet&rsquo;s tag so the finder can confirm it is yours.',
    'Mark the report as found in PawTrack once you are reunited.',
  ].map((t, i) => `<tr>
      <td valign="top" style="padding:4px 12px 4px 0;width:22px;"><div style="width:22px;height:22px;line-height:22px;border-radius:50%;background:#fff7ed;color:${BRAND};font:700 12px ${FONT};text-align:center;">${i + 1}</div></td>
      <td valign="top" style="padding:4px 0;font:14px/1.55 ${FONT};color:#475569;">${t}</td></tr>`).join('');

  const facilityRows = facility ? [
    facility.address ? row('Address', `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(facility.address)}" style="color:${BRAND};text-decoration:none;">${esc(facility.address)}</a>`) : '',
    facility.hours ? row('Hours', esc(facility.hours)) : '',
    facility.phone ? row('Phone', phoneLink(facility.phone)) : '',
    facility.email ? row('Email', `<a href="mailto:${esc(facility.email)}" style="color:${BRAND};text-decoration:none;">${esc(facility.email)}</a>`) : '',
  ].join('') : '';
  const facilityCard = facility
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
         <tr><td style="padding:16px 18px;">
           <div style="font:700 12px ${FONT};letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Your local impoundment facility</div>
           <div style="font:700 15px ${FONT};color:#0f172a;margin-bottom:2px;">${esc(facility.name)}</div>
           <div style="font:13px/1.5 ${FONT};color:#64748b;margin-bottom:8px;">Covers the area where ${pet} was last seen. Reach out if you need help.</div>
           ${facilityRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${facilityRows}</table>` : ''}
         </td></tr></table>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${pet} was found</title></head>
<body style="margin:0;padding:0;background:#f4f1ec;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f1ec"><tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e2da;">
      <tr><td bgcolor="${BRAND}" style="padding:14px 28px;font:700 13px ${FONT};letter-spacing:.08em;text-transform:uppercase;color:#ffffff;">
        PawTrack <span style="font-weight:400;opacity:.85;">&nbsp;&middot;&nbsp; Pet found</span>
      </td></tr>
      <tr><td align="center" style="padding:30px 28px 0;">
        ${photo}
        <h1 style="margin:0 0 6px;font:700 24px/1.25 ${FONT};color:#0f172a;">Good news: ${pet} was found</h1>
        <p style="margin:0;font:13px ${FONT};color:#94a3b8;">Sent by ${sender} through PawTrack</p>
      </td></tr>
      <tr><td style="padding:22px 28px 6px;">
        <p style="margin:0 0 6px;font:15px/1.6 ${FONT};color:#334155;">Hello <strong>${esc(ownerName)}</strong>,</p>
        <p style="margin:0;font:15px/1.6 ${FONT};color:#334155;">A passerby has reported finding <strong>${pet}</strong>, the pet you reported lost.</p>
        ${finderCard}
      </td></tr>
      ${buttons ? `<tr><td align="center" style="padding:14px 28px 0;">${buttons}</td></tr>` : ''}
      <tr><td style="padding:12px 28px 0;">
        <div style="font:700 12px ${FONT};letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:6px 0 6px;">What to do next</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${steps}</table>
        ${facilityCard}
        ${facility ? `<p style="margin:16px 0 0;font:13px/1.5 ${FONT};color:#94a3b8;">You can also reply to this email to reach ${esc(facility.name)}.</p>` : ''}
      </td></tr>
      <tr><td align="center" style="padding:26px 28px 24px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:16px;font:11px/1.6 ${FONT};color:#94a3b8;">PawTrack NFC Pet Recovery &amp; Municipal Pound Network<br>You are receiving this because you reported ${pet} missing in PawTrack.</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  let id = '';
  try { id = String((await req.json())?.missing_pet_id ?? ''); } catch { /* handled below */ }
  if (!UUID.test(id)) return json(400, { error: 'A report id is needed' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // Claim the alert: only a fresh, not-yet-emailed 'found' alert passes, and only one caller wins it
  const since = new Date(Date.now() - ALERT_WINDOW_MS).toISOString();
  const { data: claimed, error: claimErr } = await admin.from('missing_pets')
    .update({ found_email_sent_at: new Date().toISOString() })
    .eq('id', id).gt('found_alert_at', since).is('found_email_sent_at', null)
    .select('id, pet_name, reporter_id, routed_shelter_id, photo_url').maybeSingle();
  if (claimErr) return json(500, { error: 'Could not look up the report' });
  if (!claimed) return json(200, { sent: false, reason: 'nothing to send' });

  const release = () => admin.from('missing_pets').update({ found_email_sent_at: null }).eq('id', id);
  try {
    if (!claimed.reporter_id) { await release(); return json(200, { sent: false, reason: 'no owner account' }); }
    const { data: owner } = await admin.auth.admin.getUserById(claimed.reporter_id);
    const to = owner?.user?.email;
    if (!to) { await release(); return json(200, { sent: false, reason: 'owner has no email' }); }

    const { data: guardian } = await admin.from('guardians').select('full_name').eq('id', claimed.reporter_id).maybeSingle();
    const ownerName = guardian?.full_name || owner.user?.user_metadata?.full_name || 'there';

    let facility: Facility | null = null;
    if (claimed.routed_shelter_id) {
      const { data } = await admin.from('shelters').select('name, address, phone, email, hours').eq('id', claimed.routed_shelter_id).maybeSingle();
      facility = data ?? null;
    }

    // The finder's own words from the in-app alert the owner just received
    const { data: note } = await admin.from('notifications').select('message, location')
      .eq('recipient_id', claimed.reporter_id).eq('type', 'sighting_verification').eq('pet_name', claimed.pet_name)
      .like('title', 'GOOD SAMARITAN%').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const finder = parseFinder(note?.message ?? null, note?.location ?? null, claimed.pet_name);
    const photo = typeof claimed.photo_url === 'string' && /^https:\/\//.test(claimed.photo_url) ? claimed.photo_url : null;
    const appUrl = /^https:\/\//.test(Deno.env.get('PAWTRACK_APP_URL') ?? '') ? Deno.env.get('PAWTRACK_APP_URL')! : null;

    const senderName = facility ? `${facility.name} via ${Deno.env.get('BREVO_SENDER_NAME') ?? 'PawTrack'}` : (Deno.env.get('BREVO_SENDER_NAME') ?? 'PawTrack');
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': Deno.env.get('BREVO_API_KEY')!, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: senderName.slice(0, 120), email: Deno.env.get('BREVO_SENDER_EMAIL') },
        ...(facility?.email ? { replyTo: { email: facility.email, name: facility.name } } : {}),
        to: [{ email: to }],
        subject: `Good news: ${claimed.pet_name} was found`,
        htmlContent: foundEmail(String(ownerName), claimed.pet_name, photo, finder, facility, appUrl),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Brevo responded ${res.status}`);
    return json(200, { sent: true, via: facility ? 'facility' : 'pawtrack' });
  } catch (err) {
    await release();   // let a later call try again
    console.error('notify-owner-found failed:', err instanceof Error ? err.message : err);
    return json(502, { error: 'The email could not be sent' });
  }
});
