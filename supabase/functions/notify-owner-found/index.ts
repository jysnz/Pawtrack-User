// PawTrack: emails a pet's owner, through Brevo, when a passerby has reported the pet as found.
//   { missing_pet_id }
// The mail is sent in the name of the impoundment facility the lost report was routed to (replies go to that facility),
// or in PawTrack's own name when no facility covers the place the pet was last seen.
// The caller needs no sign-in (finders can be guests), so nothing is taken from the request except the report id:
// the function only sends when notify_missing_pet_reporter stamped a fresh 'found' alert on that report, and it
// claims the alert first, so one alert produces at most one email however often this is called.
// Secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL (verified in Brevo), BREVO_SENDER_NAME (optional).
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

function foundEmail(ownerName: string, petName: string, finderLine: string, facility: Facility | null): string {
  const sender = facility ? esc(facility.name) : 'PawTrack';
  const where = facility
    ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:18px 0;font-size:14px;line-height:1.7;color:#334155;">
         <strong style="color:#0f172a;">${esc(facility.name)}</strong> is the impoundment facility covering where ${esc(petName)} was last seen.<br>
         ${facility.address ? `Address: ${esc(facility.address)}<br>` : ''}
         ${facility.hours ? `Hours: ${esc(facility.hours)}<br>` : ''}
         ${facility.phone ? `Phone: ${esc(facility.phone)}<br>` : ''}
         ${facility.email ? `Email: ${esc(facility.email)}` : ''}
       </div>`
    : '';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;color:#1e293b;">
      <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a;">Good news: ${esc(petName)} was found</h2>
      <p style="margin:0 0 20px;font-size:12px;color:#64748b;">Sent by ${sender} through PawTrack</p>
      <p style="font-size:14.5px;line-height:1.6;color:#334155;">Hello <strong>${esc(ownerName)}</strong>,</p>
      <p style="font-size:14px;line-height:1.6;color:#334155;">A passerby has reported finding <strong>${esc(petName)}</strong>, the pet you reported lost.</p>
      <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:12px 14px;border-radius:4px;font-size:13.5px;line-height:1.6;color:#065f46;">${finderLine}</div>
      ${where}
      <p style="font-size:14px;line-height:1.6;color:#334155;">Open PawTrack to see the full details and to get in touch with the finder.${facility ? ' You can also reply to this email to reach the facility.' : ''}</p>
      <p style="font-size:11px;color:#94a3b8;margin:20px 0 0;text-align:center;border-top:1px solid #f1f5f9;padding-top:14px;">PawTrack NFC Pet Recovery &amp; Municipal Pound Network</p>
    </div>`;
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
    .select('id, pet_name, reporter_id, routed_shelter_id').maybeSingle();
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
    const { data: note } = await admin.from('notifications').select('message')
      .eq('recipient_id', claimed.reporter_id).eq('type', 'sighting_verification').eq('pet_name', claimed.pet_name)
      .like('title', 'GOOD SAMARITAN%').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const finderLine = esc(note?.message ?? `Someone found ${claimed.pet_name}.`);

    const senderName = facility ? `${facility.name} via ${Deno.env.get('BREVO_SENDER_NAME') ?? 'PawTrack'}` : (Deno.env.get('BREVO_SENDER_NAME') ?? 'PawTrack');
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': Deno.env.get('BREVO_API_KEY')!, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: senderName.slice(0, 120), email: Deno.env.get('BREVO_SENDER_EMAIL') },
        ...(facility?.email ? { replyTo: { email: facility.email, name: facility.name } } : {}),
        to: [{ email: to }],
        subject: `${claimed.pet_name} was found`,
        htmlContent: foundEmail(String(ownerName), claimed.pet_name, finderLine, facility),
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
