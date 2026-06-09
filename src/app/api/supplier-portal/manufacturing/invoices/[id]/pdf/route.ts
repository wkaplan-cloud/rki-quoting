export const maxDuration = 60
import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { MfgQuotePDF } from '@/lib/pdf/MfgQuotePDF'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
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

  // Use line items from the linked quote
  let lineItems: unknown[] = []
  if ((invoice as { quote?: { id?: string } | null }).quote) {
    const quoteId = (invoice as { quote: { id: string } }).quote.id
    const { data: li } = await supabase.from('mfg_quote_line_items').select('*').eq('quote_id', quoteId).order('sort_order')
    lineItems = li ?? []
  }

  const logoBase64 = await fetchLogoBase64(settings?.logo_url)
  const client = (invoice as { job?: { client?: Record<string, unknown> | null } | null }).job?.client ?? null

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
    clientName:      (client as { client_name?: string } | null)?.client_name ?? 'Client',
    clientType:      ((client as { client_type?: string } | null)?.client_type ?? 'individual') as 'individual' | 'company',
    contactPerson:   (client as { contact_person?: string | null } | null)?.contact_person,
    clientEmail:     (client as { email?: string | null } | null)?.email,
    clientPhone:     (client as { phone?: string | null } | null)?.phone,
    clientAddress:   (client as { address?: string | null } | null)?.address,
    clientVatNumber: (client as { vat_number?: string | null } | null)?.vat_number,
    jobName:         (invoice as { job?: { job_name?: string } | null }).job?.job_name ?? '',
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
  const buffer = await renderToBuffer(pdfElement as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
    },
  })
}
