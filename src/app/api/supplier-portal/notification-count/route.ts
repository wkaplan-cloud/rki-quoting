import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ count: 0, portalAccountId: null })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (!account) return NextResponse.json({ count: 0, portalAccountId: null })

    const { count } = await supabaseAdmin
      .from('elec_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('portal_account_id', account.id)
      .is('read_at', null)

    return NextResponse.json({ count: count ?? 0, portalAccountId: account.id })
  } catch {
    return NextResponse.json({ count: 0, portalAccountId: null })
  }
}
