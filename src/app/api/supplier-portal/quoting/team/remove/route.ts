import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Resolve the account this user owns (or is an admin member of)
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const { memberId } = await req.json() as { memberId: string }
    if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

    // Confirm the member belongs to this account (not another org's member)
    const { data: member } = await supabaseAdmin
      .from('portal_org_members')
      .select('id, auth_user_id')
      .eq('id', memberId)
      .eq('portal_account_id', account.id)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    await supabaseAdmin.from('portal_org_members').delete().eq('id', memberId)

    if (member.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(member.auth_user_id)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
