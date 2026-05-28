import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getElecPortalAccount } from '@/lib/sage-elec'
import { apiError } from '@/lib/api-error'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await getElecPortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account found' }, { status: 404 })

    await supabaseAdmin.from('elec_settings').update({
      sage_username: null,
      sage_password: null,
      sage_company_id: null,
      sage_access_token: null,
      sage_refresh_token: null,
      sage_token_expires_at: null,
    }).eq('portal_account_id', account.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
