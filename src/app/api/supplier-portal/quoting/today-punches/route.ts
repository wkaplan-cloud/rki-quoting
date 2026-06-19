import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: punches, error } = await supabaseAdmin
      .from('elec_time_punches')
      .select('id, staff_id, punch_type, punched_at, latitude, longitude')
      .eq('portal_account_id', account.id)
      .gte('punched_at', todayStart.toISOString())
      .order('punched_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(punches ?? [])
  } catch (e) { return apiError(e) }
}
