import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { JobCardPDF } from '@/lib/pdf/JobCardPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import type { ElecJobCard, ElecSettings } from '@/lib/elec-types'

export const maxDuration = 60

const resend = new Resend(process.env.RESEND_API_KEY)

async function resolveAccount(userId: string) {
  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id, company_name, email, logo_url')
    .eq('auth_user_id', userId).maybeSingle()
  if (own) return own
  const { data: mem } = await supabaseAdmin
    .from('portal_org_members').select('portal_account_id')
    .eq('auth_user_id', userId).not('accepted_at', 'is', null).maybeSingle()
  if (!mem) return null
  const { data: acc } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id, company_name, email, logo_url')
    .eq('id', mem.portal_account_id).maybeSingle()
  return acc
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { email, name, message, as_invoice, client_company, client_qs_name, client_qs_email } = await req.json() as { email: string; name?: string; message?: string; as_invoice?: boolean; client_company?: string | null; client_qs_name?: string | null; client_qs_email?: string | null }
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolveAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 403 })

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
        .eq('id', id).eq('portal_account_id', account.id).single(),
      supabaseAdmin.from('elec_job_card_materials').select('*').eq('job_card_id', id).order('created_at'),
      supabaseAdmin.from('elec_job_card_photos').select('*').eq('job_card_id', id).order('uploaded_at'),
      supabaseAdmin.from('elec_settings').select('*').eq('portal_account_id', account.id).maybeSingle(),
      account.logo_url ? fetchLogoBase64(account.logo_url) : Promise.resolve(null),
    ])
    if (!jobCard) return NextResponse.json({ error: 'Job card not found' }, { status: 404 })

    const rawPhotos = (photosData ?? []).filter(p => p.url !== jobCard.client_signature_url)

    // Pre-fetch all images concurrently so renderToBuffer gets data URIs and makes zero network calls
    const [photosWithBase64, signatureBase64] = await Promise.all([
      Promise.all(rawPhotos.map(p =>
        fetchLogoBase64(p.url).then(b64 => ({ ...p, url: b64 ?? p.url }))
      )),
      jobCard.client_signature_url ? fetchLogoBase64(jobCard.client_signature_url) : Promise.resolve(null),
    ])

    const card: ElecJobCard = {
      ...jobCard,
      materials: materialsData ?? [],
      photos: photosWithBase64,
      client_signature_url: signatureBase64 ?? jobCard.client_signature_url ?? null,
    }

    const pdfBuffer = await renderToBuffer(
      createElement(JobCardPDF, {
        jobCard: card,
        companyName: account.company_name ?? '',
        settings: settings as ElecSettings | null,
        logoBase64,
        asInvoice: as_invoice ?? false,
      }) as any
    )

    const now = new Date().toISOString()
    await supabaseAdmin
      .from('elec_job_cards')
      .update({ sent_to_name: name ?? null, sent_to_email: email, sent_at: now, client_email: email })
      .eq('id', id)

    // Sync all client details back to the client record
    if (jobCard.client_id) {
      const clientPatch: Record<string, string> = { email }
      if (jobCard.location?.trim()) clientPatch.address = jobCard.location.trim()
      if (client_company?.trim()) clientPatch.company = client_company.trim()
      if (client_qs_name?.trim()) clientPatch.qs_name = client_qs_name.trim()
      if (client_qs_email?.trim()) clientPatch.qs_email = client_qs_email.trim()
      await supabaseAdmin.from('elec_clients').update(clientPatch).eq('id', jobCard.client_id)
    }

    const cardMaterials: { qty: number; unit_price: number | null }[] = card.materials ?? []
    const totalExclVat = cardMaterials.reduce((s: number, m: { qty: number; unit_price: number | null }) =>
      s + m.qty * (m.unit_price ?? 0), 0
    )
    const vatRate = (settings as ElecSettings | null)?.default_vat_rate ?? 15
    const totalInclVat = totalExclVat * (1 + vatRate / 100)

    const label = as_invoice ? 'Invoice' : 'Job Card'
    const subject = as_invoice
      ? `Invoice ${jobCard.job_number} — ${jobCard.title}`
      : `Job Card ${jobCard.job_number} — ${jobCard.title}`
    const totalLine = as_invoice && totalInclVat > 0
      ? `<p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#18181B;">Total: R${totalInclVat.toFixed(2)} <span style="font-size:12px;color:#71717A;">(incl. VAT)</span></p>`
      : ''

    const companyName = account.company_name ?? 'Your contractor'
    await resend.emails.send({
      from: `${companyName} via QuotingHub <noreply@quotinghub.co.za>`,
      replyTo: account.email,
      to: email,
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
        ${message ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#18181B;">${message}</p>` : ''}
        <p style="margin:0;font-size:13px;color:#71717A;">Please find the ${label.toLowerCase()} attached as a PDF.</p>
      </td></tr>
      <tr><td style="background:#F0F2F5;border:1px solid #E4E4E7;border-top:none;border-radius:0 0 8px 8px;padding:16px 36px;">
        <p style="margin:0;font-size:11px;color:#71717A;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;">QuotingHub</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
      text: `${label} ${jobCard.job_number} — ${jobCard.title}\n\n${as_invoice && totalInclVat > 0 ? `Total: R${totalInclVat.toFixed(2)} (incl. VAT)\n\n` : ''}${message ?? ''}\n\nPlease find the ${label.toLowerCase()} attached.`,
    })

    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
