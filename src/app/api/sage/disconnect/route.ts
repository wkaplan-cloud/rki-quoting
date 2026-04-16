import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error, count } = await supabaseAdmin.from('settings').update({
    sage_access_token: null,
    sage_refresh_token: null,
    sage_token_expires_at: null,
    sage_company_id: null,
  }, { count: 'exact' }).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (count === 0) return NextResponse.json({ error: 'No settings row found for this user' }, { status: 404 })
  return NextResponse.json({ success: true })
}
