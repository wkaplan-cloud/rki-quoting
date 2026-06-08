import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ count: 0, portalAccountId: null })

    const account = await resolvePortalAccount(user.id)
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
