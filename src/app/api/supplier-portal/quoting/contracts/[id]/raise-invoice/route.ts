import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { raiseNextInvoice } from '@/lib/service-contracts'
import type { ElecServiceContract } from '@/lib/elec-types'

/** Raises the next period's invoice now, instead of waiting for the daily run. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data: contract } = await supabaseAdmin
      .from('elec_service_contracts').select('*').eq('id', id).eq('portal_account_id', account.id).maybeSingle()
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    if (contract.status !== 'active' || !contract.next_invoice_date) {
      return NextResponse.json({ error: 'Only an active plan with a next invoice date can be invoiced' }, { status: 409 })
    }

    const invoice = await raiseNextInvoice(contract as ElecServiceContract)
    if (!invoice) return NextResponse.json({ error: 'That period has already been invoiced' }, { status: 409 })
    return NextResponse.json({ invoice })
  } catch (e) {
    return apiError(e)
  }
}
