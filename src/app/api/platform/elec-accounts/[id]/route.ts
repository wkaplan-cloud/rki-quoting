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

/**
 * Per-org feature switches. These live on elec_settings rather than the account
 * row, so they are applied separately from the plan fields below — the platform
 * admin can set them without signing in as the contractor.
 */
const FEATURE_FLAGS = [
  'projects_enabled',
  'job_card_extras_enabled',
  'job_card_client_send_enabled',
] as const

// GET /api/platform/elec-accounts/[id]
// The org's feature switches, defaulting to on where a column is missing.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requirePlatformAdmin()
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data } = await supabaseAdmin
      .from('elec_settings').select(FEATURE_FLAGS.join(', '))
      .eq('portal_account_id', id).maybeSingle()

    const row = (data ?? {}) as Record<string, boolean | undefined>
    const features = Object.fromEntries(FEATURE_FLAGS.map(f => [f, row[f] !== false]))
    return NextResponse.json({ ok: true, features })
  } catch (e) { return apiError(e) }
}

// PATCH /api/platform/elec-accounts/[id]
// Update plan, subscription_status, notes and feature switches on a contractor
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
      admin_notes?: string
      supplier_category?: string
      features?: Record<string, boolean>
    }

    // Feature switches live on elec_settings, which may not have a row yet for
    // an org that has never opened its settings page.
    if (body.features) {
      const featurePatch: Record<string, boolean> = {}
      for (const f of FEATURE_FLAGS) {
        if (typeof body.features[f] === 'boolean') featurePatch[f] = body.features[f]
      }
      if (Object.keys(featurePatch).length > 0) {
        const { data: existing } = await supabaseAdmin
          .from('elec_settings').select('id').eq('portal_account_id', id).maybeSingle()
        const { error: fErr } = existing
          ? await supabaseAdmin.from('elec_settings').update(featurePatch).eq('portal_account_id', id)
          : await supabaseAdmin.from('elec_settings').insert({ portal_account_id: id, ...featurePatch })
        if (fErr) throw fErr
      }
    }

    const patch: Record<string, string | boolean | null> = {}
    if (body.plan                !== undefined) patch.plan                = body.plan
    if (body.subscription_status !== undefined) patch.subscription_status = body.subscription_status
    if (body.trial_ends_at       !== undefined) patch.trial_ends_at       = body.trial_ends_at
    if (body.setup_fee_paid      !== undefined) patch.setup_fee_paid      = body.setup_fee_paid
    if (body.admin_notes         !== undefined) patch.admin_notes         = body.admin_notes
    if (body.supplier_category   !== undefined) patch.supplier_category   = body.supplier_category

    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true })

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

    // Delete electrician-specific data
    await supabaseAdmin.from('elec_quotes').delete().eq('portal_account_id', id)
    await supabaseAdmin.from('elec_job_cards').delete().eq('portal_account_id', id)
    await supabaseAdmin.from('elec_staff').delete().eq('portal_account_id', id)

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
