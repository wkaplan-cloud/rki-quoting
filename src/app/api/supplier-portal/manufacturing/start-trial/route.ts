import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { MFG_SEED_ITEMS } from '@/lib/mfg-seed-items'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, plan, plan_category, subscription_status, supplier_category')
      .eq('auth_user_id', user.id)
      .single()

    if (!account) return NextResponse.json({ error: 'No supplier account found' }, { status: 404 })

    // Don't allow trial if already active/trialing as manufacturer
    if (account.supplier_category === 'manufacturer' && account.subscription_status === 'active') {
      return NextResponse.json({ error: 'Already subscribed' }, { status: 400 })
    }

    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const wasProductSupplier = account.supplier_category === 'manufacturer' && !account.plan

    await supabaseAdmin
      .from('supplier_portal_accounts')
      .update({
        plan:                  'manufacturer',
        plan_category:         'manufacturer',
        supplier_category:     'manufacturer',
        subscription_status:   'trialing',
        trial_ends_at:         trialEndsAt,
        // Preserve price request access for suppliers who are upgrading
        ...(wasProductSupplier ? { receive_price_requests: true } : {}),
      } as Record<string, unknown>)
      .eq('id', account.id)

    await supabaseAdmin
      .from('mfg_settings')
      .upsert({ portal_account_id: account.id }, { onConflict: 'portal_account_id', ignoreDuplicates: true })

    // Seed default price book items only if the account has none yet
    const { count } = await supabaseAdmin
      .from('mfg_price_book_items')
      .select('id', { count: 'exact', head: true })
      .eq('portal_account_id', account.id)

    if ((count ?? 0) === 0) {
      await supabaseAdmin
        .from('mfg_price_book_items')
        .insert(MFG_SEED_ITEMS.map(item => ({ ...item, portal_account_id: account.id })))
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
