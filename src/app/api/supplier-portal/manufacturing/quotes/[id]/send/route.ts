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
  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = await createClient()

  const [{ data: quote }, { data: settings }] = await Promise.all([
    supabase
      .from('mfg_quotes')
      .select('*, job:mfg_jobs(id, job_name, client:mfg_clients(id, client_name, client_type, contact_person, email, phone, address, vat_number))')
      .eq('id', id)
      .eq('portal_account_id', auth.portalAccountId)
      .single(),
    supabase
      .from('mfg_settings')
      .select('*')
      .eq('portal_account_id', auth.portalAccountId)
      .maybeSingle(),
  ])

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: lineItems } = await supabase
    .from('mfg_quote_line_items')
    .select('*')
    .eq('quote_id', id)
    .order('sort_order')

  const logoBase64 = await fetchLogoBase64(settings?.logo_url)
  const client = (quote as { job?: { client?: Record<string, unknown> | null } | null }).job?.client ?? null
  const jobName = (quote as { job?: { job_name?: string } | null }).job?.job_name ?? ''
  const clientName = (client as { client_name?: string } | null)?.client_name ?? 'Client'
  const businessName = settings?.business_name ?? 'Your supplier'

  const pdfElement = createElement(MfgQuotePDF, {
    documentType:   'quote',
    quoteNumber:    quote.quote_number,
    revisionNumber: quote.revision_number,
    date:           quote.created_at,
    validUntil:     quote.valid_until,
    clientName,
    clientType:     ((client as { client_type?: string } | null)?.client_type ?? 'individual') as 'individual' | 'company',
    contactPerson:  (client as { contact_person?: string | null } | null)?.contact_person,
    clientEmail:    (client as { email?: string | null } | null)?.email,
    clientPhone:    (client as { phone?: string | null } | null)?.phone,
    clientAddress:  (client as { address?: string | null } | null)?.address,
    clientVatNumber:(client as { vat_number?: string | null } | null)?.vat_number,
    jobName,
    sentByName:     quote.sent_by_name,
    sentByPhone:    quote.sent_by_phone,
    lineItems:      lineItems ?? [],
    subtotal:       quote.subtotal,
    vatAmount:      quote.vat_amount,
    total:          quote.total,
    applyVat:       quote.apply_vat,
    vatRate:        quote.vat_rate,
    settings:       settings ?? null,
    logoBase64,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(pdfElement as any)
  const filename  = `${quote.quote_number}${quote.revision_number > 1 ? `-v${quote.revision_number}` : ''}.pdf`

  const emailTemplate = settings?.email_template_quote
    ?.replace('{client_name}', clientName)
    ?.replace('{job_name}', jobName)
    ?.replace('{doc_number}', quote.quote_number)
    ?.replace('{valid_until}', quote.valid_until ? new Date(quote.valid_until + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
    ?? `Dear ${clientName},\n\nPlease find attached your quotation for the ${jobName} project.\n\nThis quote is valid until ${quote.valid_until ?? '30 days from date of issue'}.\n\nDon't hesitate to reach out if you have any questions.\n\nKind regards\n${businessName}`

  const { error: emailError } = await resend.emails.send({
    from:    `${businessName} <noreply@quotinghub.co.za>`,
    replyTo: settings?.email ?? undefined,
    to:      email.trim(),
    subject: `Quotation ${quote.quote_number} — ${jobName} — ${businessName}`,
    text:    emailTemplate,
    attachments: [{ filename, content: Buffer.from(pdfBuffer) }],
  })

  if (emailError) return NextResponse.json({ error: emailError.message }, { status: 500 })

  // Mark as sent and log activity
  const now = new Date().toISOString()
  await Promise.all([
    supabase.from('mfg_quotes').update({ status: 'sent', sent_to_email: email.trim(), sent_at: now, updated_at: now }).eq('id', id),
    supabase.from('mfg_activity_log').insert({
      portal_account_id: auth.portalAccountId,
      entity_type: 'quote', entity_id: id,
      action: 'sent',
      metadata: { email: email.trim() },
    }),
  ])

  return NextResponse.json({ ok: true })
}
