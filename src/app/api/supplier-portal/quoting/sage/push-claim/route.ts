import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getElecPortalAccount, elecSageGet, elecSagePost } from '@/lib/sage-elec'
import { apiError } from '@/lib/api-error'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { claimId, sageCustomerId, sageCustomerName = '' } = await req.json() as {
      claimId: string
      sageCustomerId: string
      sageCustomerName?: string
    }
    if (!claimId || !sageCustomerId) return NextResponse.json({ error: 'Missing claimId or sageCustomerId' }, { status: 400 })

    const account = await getElecPortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account found' }, { status: 404 })

    // Fetch claim + quote in parallel
    const [{ data: claim }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from('elec_claims')
        .select('*, quote:elec_quotes(quote_number, project_name, vat_rate)')
        .eq('id', claimId)
        .eq('portal_account_id', account.id)
        .single(),
      supabaseAdmin
        .from('elec_settings')
        .select('sage_item_id, default_vat_rate')
        .eq('portal_account_id', account.id)
        .maybeSingle(),
    ])

    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

    // Block re-push of paid invoices
    if (claim.sage_invoice_id && (claim.sage_invoice_status ?? '').toUpperCase() === 'PAID') {
      return NextResponse.json({ error: 'This invoice has already been paid in Sage.' }, { status: 400 })
    }

    const quote = Array.isArray(claim.quote) ? claim.quote[0] : claim.quote
    const vatRate: number = (quote as { vat_rate?: number } | null)?.vat_rate ?? settings?.default_vat_rate ?? 15
    const projectName: string = (quote as { project_name?: string } | null)?.project_name ?? 'Project'
    const quoteNumber: string = (quote as { quote_number?: string } | null)?.quote_number ?? ''

    const invoiceAmount = claim.total_invoiced ?? claim.total_claimed
    const amountExclVat = parseFloat((invoiceAmount / (1 + vatRate / 100)).toFixed(2))

    const selectionId: number = settings?.sage_item_id ?? 1

    // Fetch tax types and customer in parallel
    const [taxTypesResp, customerRaw] = await Promise.all([
      elecSageGet(account.id, '/TaxType/Get'),
      elecSageGet(account.id, `/Customer/Get/${Number(sageCustomerId)}`).catch(() =>
        elecSageGet(account.id, '/Customer/Get', { '$filter': `ID eq ${Number(sageCustomerId)}`, '$top': 1 }).catch(() => null)
      ),
    ])

    const customerResp: Record<string, unknown> | null =
      customerRaw?.Results?.[0] ??
      (Array.isArray(customerRaw) ? customerRaw[0] : null) ??
      (customerRaw?.ID ? customerRaw : null)

    const defaultTaxType = (taxTypesResp.Results ?? []).find(
      (t: { IsDefault?: boolean; CompanyId?: number }) => t.IsDefault && (t.CompanyId ?? 0) > 0
    )
    const taxTypeId: number = defaultTaxType?.ID ?? 146922

    const toSageDate = (d: Date) => `/Date(${d.getTime()})/`
    const now = new Date()
    const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Copy customer address fields to invoice
    const customerFields: Record<string, unknown> = {}
    if (customerResp) {
      const taxRef = customerResp.TaxReference ?? customerResp.TaxNumber ?? customerResp.VatRegistrationNumber ?? null
      if (taxRef) customerFields.TaxReference = taxRef
      for (let i = 1; i <= 5; i++) {
        const da = customerResp[`DeliveryAddress0${i}`]
        const pa = customerResp[`PostalAddress0${i}`]
        if (da !== undefined) customerFields[`DeliveryAddress0${i}`] = da
        if (pa !== undefined) customerFields[`PostalAddress0${i}`] = pa
      }
    }

    const description = `${projectName} – ${claim.claim_number}`

    const payload: Record<string, unknown> = {
      CustomerID: Number(sageCustomerId),
      Date: toSageDate(now),
      DueDate: toSageDate(dueDate),
      Inclusive: false,
      Reference: claim.claim_number,
      Description: description.length > 100 ? description.slice(0, 97) + '…' : description,
      Lines: [{
        SelectionId: selectionId,
        LineType: 0,
        Description: `${projectName}${quoteNumber ? ` (${quoteNumber})` : ''} – ${claim.claim_number}`,
        Quantity: 1,
        UnitPriceExclusive: amountExclVat,
        TaxTypeId: taxTypeId,
      }],
      ...customerFields,
    }

    let invoice: Record<string, unknown>
    if (claim.sage_invoice_id) {
      try {
        invoice = await elecSagePost(account.id, '/TaxInvoice/Save', { ...payload, ID: Number(claim.sage_invoice_id) })
      } catch {
        invoice = await elecSagePost(account.id, '/TaxInvoice/Save', payload)
      }
    } else {
      invoice = await elecSagePost(account.id, '/TaxInvoice/Save', payload)
    }

    const sageId = invoice.ID ?? invoice.id
    const sageStatus = invoice.Status ?? invoice.status ?? 'DRAFT'
    const pushedAt = new Date().toISOString()

    await supabaseAdmin.from('elec_claims').update({
      sage_invoice_id: String(sageId),
      sage_invoice_status: String(sageStatus),
      sage_pushed_at: pushedAt,
      sage_customer_id: String(sageCustomerId),
      sage_customer_name: sageCustomerName,
      status: 'invoiced',
      total_invoiced: invoiceAmount,
    }).eq('id', claimId)

    return NextResponse.json({ ok: true, sage_invoice_id: sageId, status: sageStatus })
  } catch (e) {
    return apiError(e)
  }
}
