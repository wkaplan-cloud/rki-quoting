import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getElecPortalAccount, elecSageGet, elecSagePost } from '@/lib/sage-elec'
import { apiError } from '@/lib/api-error'

export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { sageCustomerId, sageCustomerName = '' } = await req.json() as {
      sageCustomerId: string
      sageCustomerName?: string
    }
    if (!sageCustomerId) return NextResponse.json({ error: 'sageCustomerId required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await getElecPortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account found' }, { status: 404 })

    const { data: jobCard } = await supabaseAdmin
      .from('elec_job_cards')
      .select('*, materials:elec_job_card_materials(*)')
      .eq('id', id)
      .eq('portal_account_id', account.id)
      .single()
    if (!jobCard) return NextResponse.json({ error: 'Job card not found' }, { status: 404 })

    if (jobCard.sage_invoice_id && (jobCard.sage_invoice_status ?? '').toUpperCase() === 'PAID') {
      return NextResponse.json({ error: 'This invoice has already been paid in Sage.' }, { status: 400 })
    }

    const materials: { qty: number; unit_price: number | null }[] = jobCard.materials ?? []
    const totalExclVat = materials.reduce((s: number, m: { qty: number; unit_price: number | null }) =>
      s + m.qty * (m.unit_price ?? 0), 0
    )
    if (totalExclVat <= 0) {
      return NextResponse.json({ error: 'Add material prices before pushing to Sage — total is R0.' }, { status: 400 })
    }

    const { data: settings } = await supabaseAdmin
      .from('elec_settings')
      .select('sage_item_id, default_vat_rate')
      .eq('portal_account_id', account.id)
      .maybeSingle()

    const vatRate: number = settings?.default_vat_rate ?? 15
    const selectionId: number = settings?.sage_item_id ?? 1

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

    const customerFields: Record<string, unknown> = {}
    if (customerResp) {
      const taxRef = customerResp.TaxReference ?? customerResp.TaxNumber ?? null
      if (taxRef) customerFields.TaxReference = taxRef
      for (let i = 1; i <= 5; i++) {
        const da = customerResp[`DeliveryAddress0${i}`]
        const pa = customerResp[`PostalAddress0${i}`]
        if (da !== undefined) customerFields[`DeliveryAddress0${i}`] = da
        if (pa !== undefined) customerFields[`PostalAddress0${i}`] = pa
      }
    }

    const description = `${jobCard.title} – ${jobCard.job_number}`
    const amountExclVat = parseFloat(totalExclVat.toFixed(2))
    const vatAmt = parseFloat((amountExclVat * vatRate / 100).toFixed(2))

    const payload: Record<string, unknown> = {
      CustomerID: Number(sageCustomerId),
      Date: toSageDate(now),
      DueDate: toSageDate(dueDate),
      Inclusive: false,
      Reference: jobCard.job_number,
      Description: description.length > 100 ? description.slice(0, 97) + '…' : description,
      Lines: [{
        SelectionId: selectionId,
        LineType: 0,
        Description: `${jobCard.title} (${jobCard.job_number})`,
        Quantity: 1,
        UnitPriceExclusive: amountExclVat,
        TaxTypeId: taxTypeId,
      }],
      ...customerFields,
    }

    let invoice: Record<string, unknown>
    if (jobCard.sage_invoice_id) {
      try {
        invoice = await elecSagePost(account.id, '/TaxInvoice/Save', { ...payload, ID: Number(jobCard.sage_invoice_id) })
      } catch {
        invoice = await elecSagePost(account.id, '/TaxInvoice/Save', payload)
      }
    } else {
      invoice = await elecSagePost(account.id, '/TaxInvoice/Save', payload)
    }

    const sageId = invoice.ID ?? invoice.id
    const sageStatus = invoice.Status ?? invoice.status ?? 'DRAFT'
    const pushedAt = new Date().toISOString()

    await supabaseAdmin.from('elec_job_cards').update({
      sage_invoice_id: String(sageId),
      sage_invoice_status: String(sageStatus),
      sage_pushed_at: pushedAt,
      sage_customer_id: String(sageCustomerId),
      sage_customer_name: sageCustomerName,
    }).eq('id', id)

    return NextResponse.json({
      ok: true,
      sage_invoice_id: sageId,
      sage_invoice_status: sageStatus,
      total_excl_vat: amountExclVat,
      total_incl_vat: amountExclVat + vatAmt,
    })
  } catch (e) { return apiError(e) }
}
