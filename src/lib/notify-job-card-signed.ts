import { supabaseAdmin } from './supabase/admin'
import { sendEmail } from './email'

/**
 * Tells the office the client has signed a job card off — bell notification and
 * an email to the account owner, copying everyone on the team.
 *
 * Both signing paths call this: the tech capturing the signature on site, and
 * the client signing from the emailed link. Fire-and-forget — a mail failure
 * must never lose a signature that has already been saved.
 */
export async function notifyJobCardSigned(opts: {
  jobCardId: string
  signerName: string
  /** approval = client agreeing to the work; sign_off = client confirming it was done. */
  kind: 'approval' | 'sign_off'
  /** How it arrived, for the notification wording. */
  source: 'on_site' | 'email_link' | 'manual'
  /** For a manual approval: phone, WhatsApp, email, in person. */
  methodLabel?: string | null
  /** Who captured it on site, when that is who it was. */
  staffName?: string | null
  staffId?: string | null
}) {
  const { data: card } = await supabaseAdmin
    .from('elec_job_cards')
    .select('id, job_number, title, portal_account_id, client_signature_url, approval_signature_url, location')
    .eq('id', opts.jobCardId)
    .maybeSingle()
  if (!card) return

  // The signature is stored as a captioned photo, and that caption is the
  // authoritative signer name — the same one the PDF prints.
  const isApproval = opts.kind === 'approval'
  const signatureUrl = isApproval ? card.approval_signature_url : card.client_signature_url

  const { data: sigPhoto } = await supabaseAdmin
    .from('elec_job_card_photos')
    .select('caption')
    .eq('job_card_id', card.id)
    .eq('url', card.client_signature_url ?? '')
    .limit(1)
    .maybeSingle()

  const signerName = (!isApproval && sigPhoto?.caption?.trim()) || opts.signerName
  const onSite = opts.source === 'on_site'
  const how = opts.source === 'manual'
    ? `by ${opts.methodLabel ?? 'the office'}, recorded by your team`
    : onSite
      ? `on site${opts.staffName ? ` with ${opts.staffName}` : ''}`
      : 'from the emailed link'
  const headline = isApproval ? 'Client approved' : 'Client signed off'
  const did = isApproval ? 'approved this job card' : 'signed this job card off as done'

  await supabaseAdmin.from('elec_notifications').insert({
    portal_account_id: card.portal_account_id,
    type: 'signature_captured',
    title: `${headline} — ${card.job_number}`,
    body: `${signerName} ${did} — "${card.title}" — ${how}.`,
    metadata: { job_card_id: card.id, staff_id: opts.staffId ?? null },
  })

  const [{ data: account }, { data: members }] = await Promise.all([
    supabaseAdmin
      .from('supplier_portal_accounts')
      .select('email, company_name')
      .eq('id', card.portal_account_id)
      .maybeSingle(),
    supabaseAdmin
      .from('portal_org_members')
      .select('email')
      .eq('portal_account_id', card.portal_account_id)
      .not('accepted_at', 'is', null),
  ])
  if (!account?.email) return

  const cc = (members ?? [])
    .map(m => m.email as string | null)
    .filter((e): e is string => !!e && e.toLowerCase() !== account.email.toLowerCase())

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'
  const cardUrl = `${appUrl}/supplier-portal/quoting/job-cards/${card.id}`
  const when = new Date().toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })

  await sendEmail({
    to: account.email,
    ...(cc.length ? { cc } : {}),
    subject: `${headline} — ${card.job_number} · ${card.title}`,
    preheader: `${signerName} ${did} — ${card.job_number}.`,
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Inter,Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4E4E7;">
  <div style="background:#166534;padding:28px 32px;">
    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,0.65);">${headline}</p>
    <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">${card.job_number} — ${card.title}</h1>
  </div>
  <div style="padding:28px 32px;">
    <p style="margin:0 0 6px;font-size:14px;color:#3F3F46;">
      <strong>${signerName}</strong> ${did} ${how}.
    </p>
    <p style="margin:0 0 20px;font-size:13px;color:#71717A;">${when}${card.location ? ` · ${card.location}` : ''}</p>
    ${signatureUrl ? `
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#71717A;">${isApproval ? 'Approval signature' : 'Sign-off signature'}</p>
    <div style="border:1px solid #E4E4E7;border-radius:10px;padding:10px;margin-bottom:22px;background:#FAFAFA;">
      <img src="${signatureUrl}" alt="Client signature" style="display:block;max-width:100%;height:auto;" />
    </div>` : ''}
    <a href="${cardUrl}" style="display:inline-block;background:#166534;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:600;">Open Job Card →</a>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #E4E4E7;">
    <p style="margin:0;font-size:11px;color:#A1A1AA;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;text-decoration:none;">QuotingHub</a></p>
  </div>
</div>
</body></html>`,
    text: `${headline} — ${card.job_number} — ${card.title}\n\n${signerName} ${did} ${how}.\n${when}${card.location ? ` · ${card.location}` : ''}\n\nOpen the job card: ${cardUrl}`,
  })
}
