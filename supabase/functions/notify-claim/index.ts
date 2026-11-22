// Emails the person who claimed an impounded pet once the facility has decided.
//   POST { claim_id }   (called by the facility's admin right after accepting or rejecting the claim)
// The caller must be signed in and an admin of the facility that holds the animal. Accepted: go to the facility and
// print the Digital NFC card shown in My Pets. Rejected: the claim was not approved.
// Secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL (verified in Brevo), BREVO_SENDER_NAME (optional).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function card(inner: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;color:#1e293b;">${inner}<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;text-align:center;">PawTrack NFC Pet Recovery</p></div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  if (!Deno.env.get('BREVO_API_KEY') || !Deno.env.get('BREVO_SENDER_EMAIL')) {
    return json(503, { error: 'Email is not set up yet.' });
  }

  const accessToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who } = await admin.auth.getUser(accessToken);
  if (!who || !who.user) return json(401, { error: 'Please sign in again.' });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid request.' }); }
  const claimId = typeof body.claim_id === 'string' ? body.claim_id : '';
  if (!/^[0-9a-f-]{36}$/i.test(claimId)) return json(400, { error: 'Missing claim.' });

  const { data: claim } = await admin.from('impound_claims').select('*').eq('id', claimId).maybeSingle();
  if (!claim || claim.status === 'pending') return json(404, { error: 'That claim has no decision yet.' });
  const { data: pet } = await admin.from('impounded_pets').select('pet_name, species, breed, shelter_id').eq('id', claim.impound_id).maybeSingle();
  if (!pet) return json(404, { error: 'The animal is not listed any more.' });

  // Only an approved admin of the facility that holds the animal may trigger this email
  const { data: me } = await admin.from('admin_accounts').select('id, status, shelter_id').eq('id', who.user.id).maybeSingle();
  if (!me || me.status !== 'approved') return json(403, { error: 'Admins only.' });
  const { data: facility } = await admin.from('shelters').select('id, name, address, phone, hours, parent_id').eq('id', pet.shelter_id).maybeSingle();
  const mine = me.shelter_id === pet.shelter_id || (facility && facility.parent_id === me.shelter_id);
  if (!mine) return json(403, { error: 'This animal is held by another facility.' });
  if (claim.notified_at) return json(200, { sent: false, already: true });

  const petName = pet.pet_name || 'the animal';
  const where = facility ? `${esc(facility.name)}${facility.address ? ', ' + esc(facility.address) : ''}` : 'the facility';
  let subject: string;
  let html: string;
  const appUrl = (Deno.env.get('PAWTRACK_APP_URL') || '').startsWith('https://') ? Deno.env.get('PAWTRACK_APP_URL')! : '';
  if (claim.status === 'accepted') {
    subject = `Good news: your claim for ${petName} was accepted`;
    const step = (n: number, title: string, text: string) => `
      <tr>
        <td valign="top" style="padding:8px 12px 8px 0;width:30px;"><div style="width:26px;height:26px;border-radius:13px;background:#c2410c;color:#ffffff;font:700 13px/26px -apple-system,Segoe UI,Roboto,Arial,sans-serif;text-align:center;">${n}</div></td>
        <td valign="top" style="padding:8px 0;font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#334155;"><strong style="color:#0f172a;">${title}</strong><br />${text}</td>
      </tr>`;
    const fact = (label: string, value: string) => value ? `
      <tr>
        <td valign="top" style="padding:4px 12px 4px 0;width:78px;font:600 11px -apple-system,Segoe UI,Roboto,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;">${label}</td>
        <td valign="top" style="padding:4px 0;font:14px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1e293b;">${value}</td>
      </tr>` : '';
    html = `<div style="background:#f8fafc;padding:24px 12px;">
      <div style="max-width:540px;margin:0 auto;border-radius:16px;overflow:hidden;background:#ffffff;border:1px solid #e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
        <div style="background:#c2410c;padding:26px 28px;text-align:center;">
          <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,.2);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.08em;">CLAIM ACCEPTED</div>
          <h1 style="margin:12px 0 0;font-size:24px;line-height:1.25;color:#ffffff;">${esc(petName)} is ready to go home</h1>
        </div>
        <div style="padding:26px 28px 8px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Hello ${esc(claim.claimant_name)}, <strong>${facility ? esc(facility.name) : 'the facility'}</strong> reviewed your claim and accepted it. Here is what to do next:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;">
            ${step(1, 'Open My Pets in PawTrack', 'Your approved claim is at the top of the page.')}
            ${step(2, 'Print your Digital NFC card', 'Tap <em>Digital NFC card</em>, then <em>Print card</em>. You can also show it on your phone.')}
            ${step(3, 'Go to the facility', 'Bring the card and a valid ID to collect ' + esc(petName) + '.')}
          </table>
          ${appUrl ? `<div style="text-align:center;margin:0 0 22px;"><a href="${esc(appUrl)}/#pets" style="display:inline-block;padding:12px 26px;border-radius:10px;background:#c2410c;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Open My Pets</a></div>` : ''}
          <div style="margin:0 0 22px;padding:16px 18px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;">
            <div style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9a3412;">Where to go</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${fact('Facility', facility ? esc(facility.name) : '')}
              ${fact('Address', facility && facility.address ? esc(facility.address) : '')}
              ${fact('Hours', facility && facility.hours ? esc(facility.hours) : '')}
              ${fact('Phone', facility && facility.phone ? esc(facility.phone) : '')}
              ${fact('Animal', esc([petName, pet.species, pet.breed].filter(Boolean).join(' · ')))}
            </table>
          </div>
          <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#64748b;">The facility may ask to see the photo of you with ${esc(petName)} that you sent with your claim. If your plans change, call the facility so ${esc(petName)} is not held longer than needed.</p>
        </div>
        <div style="padding:14px 28px;border-top:1px solid #f1f5f9;background:#f8fafc;text-align:center;font-size:11px;color:#94a3b8;">PawTrack NFC Pet Recovery</div>
      </div>
    </div>`;
  } else {
    subject = `Your claim for ${petName} was not approved`;
    html = card(`
      <h2 style="margin:0 0 6px;font-size:20px;color:#0f172a;">Your claim was not approved</h2>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">Hello ${esc(claim.claimant_name)}, <strong>${where}</strong> could not approve your claim for <strong>${esc(petName)}</strong>.</p>
      ${claim.decision_note ? `<p style="margin:0 0 14px;padding:10px 12px;border-radius:8px;background:#f8fafc;font-size:13px;line-height:1.55;color:#334155;"><strong>Reason:</strong> ${esc(claim.decision_note)}</p>` : ''}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">If you think this is a mistake, contact the facility${facility && facility.phone ? ' at ' + esc(facility.phone) : ''}.</p>`);
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': Deno.env.get('BREVO_API_KEY')!, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: Deno.env.get('BREVO_SENDER_NAME') ?? 'PawTrack', email: Deno.env.get('BREVO_SENDER_EMAIL') },
      to: [{ email: claim.claimant_email }],
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error('[notify-claim] Brevo error:', res.status, (await res.text().catch(() => '')).slice(0, 200));
    return json(502, { error: 'The email could not be sent right now.' });
  }
  await admin.from('impound_claims').update({ notified_at: new Date().toISOString() }).eq('id', claimId);
  return json(200, { sent: true });
});
