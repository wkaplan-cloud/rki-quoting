import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Resolve portal account (owner or org member)
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

    if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    await supabaseAdmin
      .from('elec_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('portal_account_id', accountId)
      .is('read_at', null)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
