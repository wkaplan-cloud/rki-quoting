import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// Platform-admin-only: supplier portal accounts are global (one account can
// serve many studios), so no single org's admin may modify or delete them.
async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const { accountId } = await params
    const denied = await requirePlatformAdmin()
    if (denied) return denied

    const body = await req.json() as { supplier_category?: string }
    if (!body.supplier_category) return NextResponse.json({ error: 'supplier_category required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .update({ supplier_category: body.supplier_category })
      .eq('id', accountId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const { accountId } = await params
    const denied = await requirePlatformAdmin()
    if (denied) return denied

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
