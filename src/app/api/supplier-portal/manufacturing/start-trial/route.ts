import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, plan, subscription_status, supplier_category')
      .eq('auth_user_id', user.id)
      .single()

    if (!account) return NextResponse.json({ error: 'No supplier account found' }, { status: 404 })

    // Don't allow trial if already active/trialing as manufacturer
    if (account.supplier_category === 'manufacturer' && account.subscription_status === 'active') {
      return NextResponse.json({ error: 'Already subscribed' }, { status: 400 })
    }

    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await supabaseAdmin
      .from('supplier_portal_accounts')
      .update({
        plan:                'manufacturer',
        supplier_category:   'manufacturer',
        subscription_status: 'trialing',
        trial_ends_at:       trialEndsAt,
      } as Record<string, unknown>)
      .eq('id', account.id)

    await supabaseAdmin
      .from('mfg_settings')
      .upsert({ portal_account_id: account.id }, { onConflict: 'portal_account_id', ignoreDuplicates: true })

    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
