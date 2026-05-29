import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ notifications: [], count: 0 })

    let accountId: string | null = null
    const { data: own } = await supabaseAdmin
      .from('supplier_portal_accounts').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (own) {
      accountId = own.id
    } else {
      const { data: mem } = await supabaseAdmin
        .from('portal_org_members').select('portal_account_id')
        .eq('auth_user_id', user.id).not('accepted_at', 'is', null).maybeSingle()
      if (mem) accountId = mem.portal_account_id
    }

    if (!accountId) return NextResponse.json({ notifications: [], count: 0 })

    const since = req.nextUrl.searchParams.get('since')

    let query = supabaseAdmin
      .from('elec_notifications')
      .select('*')
      .eq('portal_account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (since) query = query.gt('created_at', since)

    const { data: notifications } = await query

    const { count } = await supabaseAdmin
      .from('elec_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('portal_account_id', accountId)
      .is('read_at', null)

    return NextResponse.json({ notifications: notifications ?? [], count: count ?? 0 })
  } catch (e) {
    return apiError(e)
  }
}
