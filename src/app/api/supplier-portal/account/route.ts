import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const account = await resolvePortalAccount(user.id)
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const body = await req.json() as { receive_price_requests?: boolean }

  const updates: Record<string, unknown> = {}
  if (typeof body.receive_price_requests === 'boolean') {
    updates.receive_price_requests = body.receive_price_requests
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .update(updates)
    .eq('id', account.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
