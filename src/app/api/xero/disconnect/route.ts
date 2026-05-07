import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error, count } = await supabaseAdmin.from('settings').update({
    xero_access_token: null,
    xero_refresh_token: null,
    xero_token_expires_at: null,
    xero_tenant_id: null,
    xero_tenant_name: null,
  }, { count: 'exact' }).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (count === 0) return NextResponse.json({ error: 'No settings row found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
