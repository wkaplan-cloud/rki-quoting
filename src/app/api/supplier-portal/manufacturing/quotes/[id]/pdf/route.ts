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

  const pdfElement = createElement(MfgQuotePDF, {
    documentType:   'quote',
    quoteNumber:    quote.quote_number,
    revisionNumber: quote.revision_number,
    date:           quote.created_at,
    validUntil:     quote.valid_until,
    clientName:     (client as { client_name?: string } | null)?.client_name ?? 'Client',
    clientType:     ((client as { client_type?: string } | null)?.client_type ?? 'individual') as 'individual' | 'company',
    contactPerson:  (client as { contact_person?: string | null } | null)?.contact_person,
    clientEmail:    (client as { email?: string | null } | null)?.email,
    clientPhone:    (client as { phone?: string | null } | null)?.phone,
    clientAddress:  (client as { address?: string | null } | null)?.address,
    clientVatNumber:(client as { vat_number?: string | null } | null)?.vat_number,
    jobName:        (quote as { job?: { job_name?: string } | null }).job?.job_name ?? '',
    sentByName:     quote.sent_by_name,
    sentByEmail:    quote.sent_by_email,
    sentByPhone:    quote.sent_by_phone,
    lineItems:        lineItems ?? [],
    subtotal:         quote.subtotal,
    vatAmount:        quote.vat_amount,
    total:            quote.total,
    applyVat:         quote.apply_vat,
    vatRate:          quote.vat_rate,
    deliveryCost:     (quote as Record<string, unknown>).delivery_cost as number ?? 0,
    installationCost: (quote as Record<string, unknown>).installation_cost as number ?? 0,
    settings:         settings ?? null,
    logoBase64,
    showUnitPrice:    (quote as Record<string, unknown>).show_unit_price === true,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(pdfElement as any)
  const filename = `${quote.quote_number}${quote.revision_number > 1 ? `-v${quote.revision_number}` : ''}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
