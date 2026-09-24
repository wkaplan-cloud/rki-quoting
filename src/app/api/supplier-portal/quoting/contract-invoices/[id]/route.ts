import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'

/** PATCH { status: 'paid' | 'void' | 'sent' | 'draft' } — record a payment, or void a mistake. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { status } = await req.json() as { status?: string }
    if (!['draft', 'sent', 'paid', 'void'].includes(status ?? '')) return NextResponse.json({ error: 'Unknown status' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('elec_contract_invoices')
      .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
      .eq('id', id).eq('portal_account_id', account.id)
      .select().maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    return NextResponse.json({ invoice: data })
  } catch (e) {
    return apiError(e)
  }
}
