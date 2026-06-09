export const maxDuration = 60
import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { MfgQuotePDF } from '@/lib/pdf/MfgQuotePDF'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { email, body: bodyOverride } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = await createClient()

  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase
      .from('mfg_invoices')
      .select('*, job:mfg_jobs(id, job_name, client:mfg_clients(id, client_name, client_type, contact_person, email, phone, address, vat_number)), quote:mfg_quotes(id, quote_number, revision_number, subtotal, vat_amount, total)')
      .eq('id', id)
      .eq('portal_account_id', auth.portalAccountId)
      .single(),
    supabase
      .from('mfg_settings')
      .select('*')
      .eq('portal_account_id', auth.portalAccountId)
      .maybeSingle(),
  ])

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let lineItems: unknown[] = []
  if ((invoice as { quote?: { id?: string } | null }).quote) {
    const quoteId = (invoice as { quote: { id: string } }).quote.id
    const { data: li } = await supabase.from('mfg_quote_line_items').select('*').eq('quote_id', quoteId).order('sort_order')
    lineItems = li ?? []
  }

  const logoBase64 = await fetchLogoBase64(settings?.logo_url)
  const client = (invoice as { job?: { client?: Record<string, unknown> | null } | null }).job?.client ?? null
  const jobName = (invoice as { job?: { job_name?: string } | null }).job?.job_name ?? ''
  const clientName = (client as { client_name?: string } | null)?.client_name ?? 'Client'
  const businessName = settings?.business_name ?? 'Your supplier'

  const docType = invoice.invoice_type === 'deposit' ? 'deposit_invoice' : invoice.invoice_type === 'final' ? 'final_invoice' : 'invoice'
  const fullProjectTotal = invoice.invoice_type === 'deposit' ? (invoice as { quote?: { total?: number } | null }).quote?.total : undefined
  const depositPct = invoice.invoice_type === 'deposit' && fullProjectTotal
    ? Math.round((invoice.total / fullProjectTotal) * 100)
    : undefined

  const pdfElement = createElement(MfgQuotePDF, {
    documentType:    docType as 'invoice' | 'deposit_invoice' | 'final_invoice',
    invoiceNumber:   invoice.invoice_number,
    date:            invoice.created_at,
    dueDate:         invoice.due_date,
    clientName,
    clientType:      ((client as { client_type?: string } | null)?.client_type ?? 'individual') as 'individual' | 'company',
    contactPerson:   (client as { contact_person?: string | null } | null)?.contact_person,
    clientEmail:     (client as { email?: string | null } | null)?.email,
    clientPhone:     (client as { phone?: string | null } | null)?.phone,
    clientAddress:   (client as { address?: string | null } | null)?.address,
    clientVatNumber: (client as { vat_number?: string | null } | null)?.vat_number,
    jobName,
    sentByName:      invoice.sent_by_name,
    sentByPhone:     invoice.sent_by_phone,
    lineItems:       lineItems as Parameters<typeof MfgQuotePDF>[0]['lineItems'],
    subtotal:        invoice.subtotal,
    vatAmount:       invoice.vat_amount,
    total:           invoice.total,
    applyVat:        invoice.apply_vat,
    vatRate:         invoice.vat_rate,
    fullProjectTotal,
    depositPercentage: depositPct,
    settings:        settings ?? null,
    logoBase64,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(pdfElement as any)
  const filename = `${invoice.invoice_number}.pdf`

  const dueDateFormatted = invoice.due_date
    ? new Date(invoice.due_date + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const invoiceLabel = invoice.invoice_type === 'deposit' ? 'deposit invoice' : invoice.invoice_type === 'final' ? 'final invoice' : 'invoice'

  const plainBody: string = bodyOverride?.trim() || (
    settings?.email_template_invoice
      ?.replace('{client_name}', clientName)
      ?.replace('{job_name}', jobName)
      ?.replace('{doc_number}', invoice.invoice_number)
      ?.replace('{due_date}', dueDateFormatted ?? 'as per agreed terms')
    ?? `Dear ${clientName},\n\nPlease find attached your ${invoiceLabel} for the ${jobName} project.\n\nAmount due: R ${invoice.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}${dueDateFormatted ? `\nDue date: ${dueDateFormatted}` : ''}\n\nKind regards\n${businessName}`
  )

  const accent = settings?.accent_color ?? '#1B4F8A'
  const bodyHtml = plainBody
    .split('\n\n')
    .map(p => `<p style="margin:0 0 16px 0;color:#374151;font-size:15px;line-height:1.7">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

  const htmlEmail = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- Header -->
  <tr><td style="background:${accent};padding:32px 40px;border-radius:12px 12px 0 0;text-align:center">
    <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em">${businessName}</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:40px;border-radius:0 0 12px 12px">
    ${bodyHtml}

    <!-- Invoice summary box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:10px;overflow:hidden;border:1px solid #E5E7EB">
      <tr><td style="background:#F9FAFB;padding:12px 20px;border-bottom:1px solid #E5E7EB">
        <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6B7280">Invoice details</p>
      </td></tr>
      <tr><td style="padding:20px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#6B7280;width:130px">Invoice number</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827">${invoice.invoice_number}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#6B7280">Job</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827">${jobName}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#6B7280">Amount due</td>
            <td style="padding:4px 0;font-size:13px;font-weight:700;color:#111827">R ${invoice.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
          </tr>
          ${dueDateFormatted ? `<tr>
            <td style="padding:4px 0;font-size:13px;color:#6B7280">Due date</td>
            <td style="padding:4px 0;font-size:13px;color:#111827">${dueDateFormatted}</td>
          </tr>` : ''}
        </table>
      </td></tr>
    </table>

    <p style="margin:24px 0 0 0;font-size:13px;color:#9CA3AF">The PDF invoice is attached to this email.</p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 16px;text-align:center">
    <p style="margin:0;font-size:12px;color:#9CA3AF">Sent via <a href="https://quotinghub.co.za" style="color:${accent};text-decoration:none">QuotingHub</a>${settings?.email ? ` · Reply to <a href="mailto:${settings.email}" style="color:${accent};text-decoration:none">${settings.email}</a>` : ''}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  const { error: emailError } = await resend.emails.send({
    from:    `${businessName} <noreply@quotinghub.co.za>`,
    replyTo: settings?.email ?? undefined,
    to:      email.trim(),
    subject: `Invoice ${invoice.invoice_number} — ${jobName} — ${businessName}`,
    text:    plainBody,
    html:    htmlEmail,
    attachments: [{ filename, content: Buffer.from(pdfBuffer) }],
  })

  if (emailError) return NextResponse.json({ error: emailError.message }, { status: 500 })

  const now = new Date().toISOString()
  await Promise.all([
    supabase.from('mfg_invoices').update({ status: 'sent', sent_to_email: email.trim(), sent_at: now, updated_at: now }).eq('id', id),
    supabase.from('mfg_activity_log').insert({
      portal_account_id: auth.portalAccountId,
      entity_type: 'invoice', entity_id: id,
      action: 'sent',
      metadata: { email: email.trim() },
    }),
  ])

  return NextResponse.json({ ok: true })
}
