import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL

async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) return null
  return user
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requirePlatformAdmin()
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      plan?: string
      subscription_status?: string
      trial_ends_at?: string | null
      setup_fee_paid?: boolean
    }

    const patch: Record<string, string | boolean | null> = {}
    if (body.plan                !== undefined) patch.plan                = body.plan
    if (body.subscription_status !== undefined) patch.subscription_status = body.subscription_status
    if (body.trial_ends_at       !== undefined) patch.trial_ends_at       = body.trial_ends_at
    if (body.setup_fee_paid      !== undefined) patch.setup_fee_paid      = body.setup_fee_paid

    const { data, error } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .update(patch)
      .eq('id', id)
      .select('id, plan, subscription_status')
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, account: data })
  } catch (e) { return apiError(e) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requirePlatformAdmin()
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Delete portal org members and their auth users
    const { data: members } = await supabaseAdmin
      .from('portal_org_members')
      .select('id, auth_user_id')
      .eq('portal_account_id', id)

    for (const m of members ?? []) {
      if (m.auth_user_id) await supabaseAdmin.auth.admin.deleteUser(m.auth_user_id)
    }
    await supabaseAdmin.from('portal_org_members').delete().eq('portal_account_id', id)

    // Delete manufacturer-specific data
    await supabaseAdmin.from('mfg_quotes').delete().eq('portal_account_id', id)
    await supabaseAdmin.from('mfg_invoices').delete().eq('portal_account_id', id)
    await supabaseAdmin.from('mfg_clients').delete().eq('portal_account_id', id)

    // Fetch account to get auth_user_id before deleting
    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('auth_user_id')
      .eq('id', id)
      .maybeSingle()

    await supabaseAdmin.from('supplier_portal_accounts').delete().eq('id', id)

    if (account?.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(account.auth_user_id)
    }

    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
