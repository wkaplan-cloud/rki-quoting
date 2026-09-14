import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'
import { startOfSADayISO } from '@/lib/dates'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 403 })

    // Midnight SAST, not the server's midnight — Vercel runs in UTC, which would
    // start "today" at 02:00 SAST and carry the previous crew day's tail into it.
    const todayStart = startOfSADayISO()

    const { data: punches, error } = await supabaseAdmin
      .from('elec_time_punches')
      .select('id, staff_id, punch_type, punched_at, latitude, longitude, notes, job_id')
      .eq('portal_account_id', account.id)
      .gte('punched_at', todayStart)
      .order('punched_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(punches ?? [])
  } catch (e) { return apiError(e) }
}
