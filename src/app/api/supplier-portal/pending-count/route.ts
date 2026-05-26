import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ count: 0 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, email')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!account) return NextResponse.json({ count: 0 })

    const { data: sessionSuppliers } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('id')
      .or(`portal_account_id.eq.${account.id},email.eq.${account.email}`)

    const ssIds = (sessionSuppliers ?? []).map((s: any) => s.id)
    if (ssIds.length === 0) return NextResponse.json({ count: 0 })

    const { count } = await supabaseAdmin
      .from('sourcing_item_assignments')
      .select('id', { count: 'exact', head: true })
      .in('session_supplier_id', ssIds)
      .eq('status', 'pending')

    return NextResponse.json({ count: count ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
