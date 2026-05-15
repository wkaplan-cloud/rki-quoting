import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { accountId, linkedAccountId } = await req.json() as { accountId: string; linkedAccountId: string | null }
  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .update({ linked_portal_account_id: linkedAccountId ?? null })
    .eq('id', accountId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
