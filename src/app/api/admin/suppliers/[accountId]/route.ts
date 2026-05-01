import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const { accountId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    const { data: member } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .maybeSingle()

    if (member?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, auth_user_id')
      .eq('id', accountId)
      .maybeSingle()

    if (!account) return NextResponse.json({ error: 'Supplier account not found' }, { status: 404 })

    // Keep sourcing history — just unlink the portal account
    await supabaseAdmin
      .from('sourcing_session_suppliers')
      .update({ portal_account_id: null })
      .eq('portal_account_id', accountId)

    await supabaseAdmin
      .from('supplier_portal_accounts')
      .delete()
      .eq('id', accountId)

    if (account.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(account.auth_user_id)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
