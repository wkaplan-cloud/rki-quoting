import { randomUUID } from 'crypto'
import { createElement } from 'react'
import { sendEmail } from '@/lib/email'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { renderPdfToBuffer } from '@/lib/pdf/render'
import { JobCardPDF } from '@/lib/pdf/JobCardPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { jobCardTotals } from '@/lib/job-card-totals'
import type { ElecJobCard, ElecSettings } from '@/lib/elec-types'

/**
 * Builds and sends the client's copy of a job card.
 *
 * Lives here rather than in the route so a resend from a script produces
 * byte-for-byte the same mail the portal sends — a test that renders its own
 * lookalike email proves nothing about the real one.
 */

export interface JobCardEmailAccount {
  id: string
  company_name: string | null
  email: string | null
  logo_url: string | null
}

export interface SendJobCardEmailOptions {
  account: JobCardEmailAccount
  jobCardId: string
  /** Client address the job card goes to. */
  email: string
  name?: string | null
  message?: string | null
  asInvoice?: boolean
  includeLink?: boolean
  clientCompany?: string | null
  clientQsName?: string | null
  clientQsEmail?: string | null
  /**
   * Record the send against the job card and sync the client record.
   * A resend for inspection passes false so it leaves no trace.
   */
  persist?: boolean
  /** Prefixed to the subject — used to mark a test resend. */
  subjectPrefix?: string
  /**
   * Drop the Materials & Charges table and every total from the PDF.
   * True for the send the technician fires on completion — that copy is proof
   * the work was done. The office send is the priced job card, so it is false
   * there. Defaults to the old behaviour for scripted resends.
   */
  hideItems?: boolean
}

// For public Supabase photos, use the CDN render endpoint (800px wide, 60% quality)
// instead of the admin storage API — ~95% smaller, far faster to download.
// Falls back to fetchLogoBase64 if the render endpoint is unavailable.
async function fetchPhotoForPDF(url: string): Promise<string | null> {
  const m = url.match(/^(https:\/\/[^/]+)\/storage\/v1\/object\/public\/(.+?)(\?.*)?$/)
  if (m) {
    // resize=contain is not optional. Supabase's transform defaults to cover,
    // and cover with a width but no height keeps the original height and slices
    // the width to match — an 1800x2400 site photo came back 800x2400, a third
    // of it cut out of the middle. The client's PDF is the one copy that has to
    // show the whole photo.
    const renderUrl = `${m[1]}/storage/v1/render/image/public/${m[2]}?width=800&quality=60&resize=contain`
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 12000)
      const res = await fetch(renderUrl, { signal: ctrl.signal })
      clearTimeout(t)
      if (res.ok) {
        const ct = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0]
        if (!ct.includes('svg')) {
          const buf = await res.arrayBuffer()
          return `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
        }
      }
    } catch { /* fall through to full-size fetch */ }
  }
  return fetchLogoBase64(url)
}

/**
 * The org's own addresses, for the CC on a client send. Staff send job cards
 * from site, so without this the office has no record of the mail landing.
 * The client's own address is filtered out so nobody is copied twice.
 */
async function resolveOrgCc(accountId: string, accountEmail: string | null, clientEmail: string) {
  const { data: orgMembers } = await supabaseAdmin
    .from('portal_org_members')
    .select('email')
    .eq('portal_account_id', accountId)
    .not('accepted_at', 'is', null)
  const clientAddr = clientEmail.trim().toLowerCase()
  return Array.from(new Set(
    [accountEmail, ...(orgMembers ?? []).map(m => m.email)]
      .filter((e): e is string => !!e?.trim())
      .map(e => e.trim())
  )).filter(e => e.toLowerCase() !== clientAddr)
}

export async function sendJobCardEmail(opts: SendJobCardEmailOptions): Promise<
  { ok: true; cc: string[]; subject: string } | { ok: false; error: string; status: number }
> {
  const {
    account, jobCardId, email, name, message,
    asInvoice = false, includeLink = false,
    clientCompany, clientQsName, clientQsEmail,
    persist = true, subjectPrefix = '',
    hideItems = !asInvoice,
  } = opts

  const [
    { data: jobCard },
    { data: materialsData },
    { data: photosData },
    { data: settings },
    logoBase64,
  ] = await Promise.all([
    supabaseAdmin
      .from('elec_job_cards')
      .select(`*, staff:elec_staff(id,name,role,phone,email), client:elec_clients(id,client_name,email,contact_number)`)
      .eq('id', jobCardId).eq('portal_account_id', account.id).single(),
    supabaseAdmin.from('elec_job_card_materials').select('*').eq('job_card_id', jobCardId).order('created_at'),
    supabaseAdmin.from('elec_job_card_photos').select('*').eq('job_card_id', jobCardId).order('uploaded_at'),
    supabaseAdmin.from('elec_settings').select('*').eq('portal_account_id', account.id).maybeSingle(),
    account.logo_url ? fetchLogoBase64(account.logo_url) : Promise.resolve(null),
  ])
  if (!jobCard) return { ok: false, error: 'Job card not found', status: 404 }

  // The name captured alongside the signature is stored as that photo's caption
  const signatureName = (photosData ?? []).find(p => p.url === jobCard.client_signature_url)?.caption ?? null

  // Only fetch the photos the PDF will actually render (9 max). The signature
  // and the work-description reference image are stored in the same table but
  // are not site photos, so neither may eat a slot in that nine.
  const rawPhotos = (photosData ?? [])
    .filter(p => p.url !== jobCard.client_signature_url && p.url !== jobCard.work_description_image_url)
    .slice(0, 9)

  // Pre-fetch all images concurrently. Photos use the CDN render endpoint for small JPEGs;
  // the signature uses the full fetchLogoBase64 path (may be a private signed URL).
  const [photosWithBase64, signatureBase64, refImageBase64] = await Promise.all([
    Promise.all(rawPhotos.map(p =>
      fetchPhotoForPDF(p.url).then(b64 => ({ ...p, url: b64 ?? p.url }))
    )),
    jobCard.client_signature_url ? fetchLogoBase64(jobCard.client_signature_url) : Promise.resolve(null),
    jobCard.work_description_image_url ? fetchPhotoForPDF(jobCard.work_description_image_url) : Promise.resolve(null),
  ])

  const card: ElecJobCard = {
    ...jobCard,
    materials: materialsData ?? [],
    photos: photosWithBase64,
    client_signature_url: signatureBase64 ?? jobCard.client_signature_url ?? null,
    work_description_image_url: refImageBase64 ?? jobCard.work_description_image_url ?? null,
  }

  const pdfBuffer = await renderPdfToBuffer(
    createElement(JobCardPDF, {
      jobCard: card,
      companyName: account.company_name ?? '',
      settings: settings as ElecSettings | null,
      logoBase64,
      asInvoice,
      hideItems,
      signatureName,
    })
  )

  // A sign link is worth sending while there is still a signature to give —
  // either the card has never been signed, or it was edited after signing and
  // the client needs to approve the new version.
  const needsSignature = !jobCard.approved_at || !!jobCard.amended_at
  const signToken = includeLink && needsSignature
    ? (jobCard.share_token ?? randomUUID())
    : null
  const signUrl = signToken
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'}/job-sign/${signToken}`
    : null

  if (persist) {
    const now = new Date().toISOString()
    await supabaseAdmin
      .from('elec_job_cards')
      .update({
        sent_to_name: name ?? null,
        sent_to_email: email,
        sent_at: now,
        amended_at: null,
        client_email: email,
        ...(signToken ? { share_token: signToken } : {}),
      })
      .eq('id', jobCardId)

    // Sync client details back to the client record. The address only fills a
    // blank — a job at one of the client's other sites must not replace the
    // address on file. Email is different: it is the address they were just
    // written to, so keeping it current is the point.
    if (jobCard.client_id) {
      const { data: existingClient } = await supabaseAdmin
        .from('elec_clients').select('address').eq('id', jobCard.client_id).maybeSingle()
      const clientPatch: Record<string, string> = { email }
      if (!existingClient?.address?.trim() && jobCard.location?.trim())
        clientPatch.address = jobCard.location.trim()
      if (clientCompany?.trim()) clientPatch.company = clientCompany.trim()
      if (clientQsName?.trim()) clientPatch.qs_name = clientQsName.trim()
      if (clientQsEmail?.trim()) clientPatch.qs_email = clientQsEmail.trim()
      await supabaseAdmin.from('elec_clients').update(clientPatch).eq('id', jobCard.client_id)
    }
  }

  // Same arithmetic the PDF prints — call-out fee and labour included, not
  // materials alone.
  const vatRate = (settings as ElecSettings | null)?.default_vat_rate ?? 15
  const { total: totalInclVat } = jobCardTotals(card, vatRate)

  // A sign link is only generated while an approval is still outstanding, so its
  // presence means this is the client being asked to agree to the work and the
  // price before it starts — not a record of work already done.
  const isApprovalRequest = !!signUrl
  const isReapproval = isApprovalRequest && !!jobCard.approved_at && !!jobCard.amended_at

  const label = asInvoice ? 'Invoice' : isApprovalRequest ? 'For Approval' : 'Job Card'
  /** What the attachment is called in prose — never the eyebrow label. */
  const attachmentNoun = asInvoice ? 'invoice' : 'job card'
  const subject = `${subjectPrefix}${asInvoice
    ? `Invoice ${jobCard.job_number} — ${jobCard.title}`
    : isApprovalRequest
      ? `${isReapproval ? 'Updated for approval' : 'For approval'}: Job Card ${jobCard.job_number} — ${jobCard.title}`
      : `Job Card ${jobCard.job_number} — ${jobCard.title}`}`
  const totalLine = !hideItems && totalInclVat > 0
    ? `<p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#18181B;">Total: R${totalInclVat.toFixed(2)} <span style="font-size:12px;color:#71717A;">(incl. VAT)</span></p>`
    : ''
  // Three different messages go out under one name: a quote awaiting approval,
  // a re-approval after the card changed, and the record of completed work.
  const bodyLine = isReapproval
    ? 'This job card has changed since you approved it. The updated version is attached, setting out the work and what it will cost. Please approve the new version before we go ahead.'
    : isApprovalRequest
      ? 'Please find the job card attached for your approval. It sets out the work to be done and what it will cost, itemised with the materials and charges. Once you have approved it we will book the work in.'
      : hideItems
        ? 'The work on this job has been completed on site. The attached job card sets out what was found and what was done, together with the site photos and the signature captured on completion.'
        : 'The attached job card sets out the work carried out on site and what it comes to, itemised with the materials and charges.'

  const companyName = account.company_name ?? 'Your contractor'
  const ccEmails = await resolveOrgCc(account.id, account.email, email)

  await sendEmail({
    from: `${companyName} via QuotingHub <noreply@quotinghub.co.za>`,
    replyTo: account.email ?? undefined,
    to: email,
    ...(ccEmails.length > 0 ? { cc: ccEmails } : {}),
    subject,
    attachments: [{ filename: `${jobCard.job_number}.pdf`, content: pdfBuffer }],
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;">
      <tr><td style="background:#1E2A38;padding:28px 36px;border-radius:8px 8px 0 0;">
        <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">${companyName}</p>
        <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:.08em;">${label}</p>
      </td></tr>
      <tr><td style="background:#fff;padding:36px;border-left:1px solid #E4E4E7;border-right:1px solid #E4E4E7;">
        <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181B;">${jobCard.job_number}</p>
        <p style="margin:0 0 16px;font-size:15px;color:#71717A;">${jobCard.title}</p>
        ${totalLine}
        ${asInvoice ? '' : `<p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#18181B;">${bodyLine}</p>`}
        ${message ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#18181B;">${message}</p>` : ''}
        ${signUrl ? `<p style="margin:0 0 20px;"><a href="${signUrl}" style="display:inline-block;background:#3A7CA5;color:#fff;text-decoration:none;padding:12px 26px;border-radius:8px;font-size:14px;font-weight:600;">Review &amp; Approve Online →</a></p>` : ''}
        <p style="margin:0 0 24px;font-size:13px;color:#71717A;">${signUrl
          ? `Approve it online using the button above, or review the attached PDF first. If anything needs changing, reply to this email before approving and we'll sort it out.`
          : `Please find the ${attachmentNoun} attached as a PDF. If you have any questions, reply to this email and we'll get back to you.`}</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#18181B;">
          Kind regards,<br>
          <strong>${companyName}</strong><br>
          <a href="mailto:${account.email}" style="color:#3A7CA5;text-decoration:none;">${account.email}</a>
        </p>
      </td></tr>
      <tr><td style="background:#F0F2F5;border:1px solid #E4E4E7;border-top:none;border-radius:0 0 8px 8px;padding:16px 36px;">
        <p style="margin:0;font-size:11px;color:#71717A;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;">QuotingHub</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    text: `${label} ${jobCard.job_number} — ${jobCard.title}\n\n${!hideItems && totalInclVat > 0 ? `Total: R${totalInclVat.toFixed(2)} (incl. VAT)\n\n` : ''}${asInvoice ? '' : bodyLine + '\n\n'}${message ? message + '\n\n' : ''}${signUrl ? `Review and approve online: ${signUrl}\n\n` : ''}${signUrl ? `The ${attachmentNoun} is attached as a PDF. If anything needs changing, reply to this email before approving and we'll sort it out.` : `Please find the ${attachmentNoun} attached. If you have any questions, reply to this email and we'll get back to you.`}\n\nKind regards,\n${companyName}\n${account.email}`,
  })

  return { ok: true, cc: ccEmails, subject }
}
