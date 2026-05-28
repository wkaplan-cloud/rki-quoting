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
      .select('sage_invoice_id, portal_account_id')
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

    if ((status === 'Paid' || status === 'PAID') && invTotal > 0) {
      updates.status = 'paid'
      updates.total_paid = invTotal
    } else if (amountPaid > 0) {
      updates.total_paid = amountPaid
    }

    await supabaseAdmin.from('elec_claims').update(updates).eq('id', claimId)

    return NextResponse.json({ status, amount_paid: amountPaid, total: invTotal })
  } catch (e) {
    return apiError(e)
  }
}
