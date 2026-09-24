import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getElecPortalAccount } from '@/lib/sage-elec'
import { pushSageInvoice } from '@/lib/sage-invoice'
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

    const description = `${projectName} – ${claim.claim_number}`
    const invoice = await pushSageInvoice({
      portalAccountId: account.id,
      sageCustomerId,
      selectionId: settings?.sage_item_id ?? 1,
      reference: claim.claim_number,
      description,
      lineDescription: `${projectName}${quoteNumber ? ` (${quoteNumber})` : ''} – ${claim.claim_number}`,
      amountExclVat,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      existingSageId: claim.sage_invoice_id,
    })
    const sageId = invoice.id
    const sageStatus = invoice.status
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
