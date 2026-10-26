import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getElecPortalAccount, elecSageGet } from '@/lib/sage-elec'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { claimId } = await req.json() as { claimId: string }
    if (!claimId) return NextResponse.json({ error: 'Missing claimId' }, { status: 400 })

    const account = await getElecPortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account found' }, { status: 404 })

    const { data: claim } = await supabaseAdmin
      .from('elec_claims')
      .select('sage_invoice_id, portal_account_id, total_claimed, total_certified, total_invoiced')
      .eq('id', claimId)
      .eq('portal_account_id', account.id)
      .single()

    if (!claim?.sage_invoice_id) {
      return NextResponse.json({ error: 'No Sage invoice linked to this claim' }, { status: 400 })
    }

    const invoice = await elecSageGet(account.id, `/TaxInvoice/Get/${claim.sage_invoice_id}`)
    const status: string = invoice.Status ?? invoice.status ?? 'UNKNOWN'

    const invTotal: number = invoice.Total ?? invoice.total ?? 0
    const invOutstanding: number = invoice.TotalOutstanding ?? invoice.Outstanding ?? invTotal
    const amountPaid = invTotal > 0 ? parseFloat((invTotal - invOutstanding).toFixed(2)) : 0

    const updates: Record<string, unknown> = {
      sage_invoice_status: status,
    }

    // total_paid is kept on the same footing as the rest of the claim — the
    // billed amount excl. VAT, before retention — the way "Mark Paid" records
    // it. Sage's figures include VAT with retention off, so a part-payment is
    // carried over as the same share of the billed amount.
    const billed = claim.total_invoiced ?? claim.total_certified ?? claim.total_claimed ?? 0
    let totalPaid: number | null = null
    if ((status === 'Paid' || status === 'PAID') && invTotal > 0) {
      updates.status = 'paid'
      totalPaid = billed
    } else if (amountPaid > 0) {
      totalPaid = Math.round(billed * Math.min(1, amountPaid / invTotal) * 100) / 100
    }
    if (totalPaid != null) updates.total_paid = totalPaid

    await supabaseAdmin.from('elec_claims').update(updates).eq('id', claimId)

    return NextResponse.json({ status, amount_paid: amountPaid, total: invTotal, total_paid: totalPaid })
  } catch (e) {
    return apiError(e)
  }
}
