import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: clientId } = await params
    const body = await req.json() as Record<string, string>

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify the client belongs to this portal account
    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    // Also check org membership
    let accountId = account?.id
    if (!accountId) {
      const { data: mem } = await supabaseAdmin
        .from('portal_org_members')
        .select('portal_account_id')
        .eq('auth_user_id', user.id)
        .not('accepted_at', 'is', null)
        .maybeSingle()
      accountId = mem?.portal_account_id
    }
    if (!accountId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { data: client } = await supabaseAdmin
      .from('elec_clients')
      .select('id')
      .eq('id', clientId)
      .eq('portal_account_id', accountId)
      .maybeSingle()
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const patch: Record<string, string> = {}
    if (typeof body.email === 'string' && body.email.trim()) patch.email = body.email.trim()
    if (typeof body.address === 'string' && body.address.trim()) patch.address = body.address.trim()
    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true })

    await supabaseAdmin.from('elec_clients').update(patch).eq('id', clientId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
