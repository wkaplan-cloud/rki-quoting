import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const maxDuration = 10

// Runs daily at 15:00 UTC = 17:00 SAST.
// Inserts a clock_out punch for every staff member still clocked in at 5pm.

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Midnight SAST on the current SAST day = 22:00 UTC the previous UTC day
  const todayStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 22, 0, 0, 0
  ))

  // Clock-out timestamp = exactly 17:00:00 SAST = 15:00:00 UTC
  const clockOutAt = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0, 0
  ))

  // All punches from today across all portal accounts, newest first
  const { data: punches, error } = await supabaseAdmin
    .from('elec_time_punches')
    .select('staff_id, portal_account_id, punch_type')
    .gte('punched_at', todayStart.toISOString())
    .order('punched_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Latest punch per staff — if it's clock_in they're still on site
  const latestPerStaff = new Map<string, { punch_type: string; portal_account_id: string }>()
  for (const p of (punches ?? [])) {
    if (!latestPerStaff.has(p.staff_id)) {
      latestPerStaff.set(p.staff_id, { punch_type: p.punch_type, portal_account_id: p.portal_account_id })
    }
  }

  const toClockOut = [...latestPerStaff.entries()]
    .filter(([, v]) => v.punch_type === 'clock_in')
    .map(([staffId, v]) => ({
      portal_account_id: v.portal_account_id,
      staff_id:          staffId,
      punch_type:        'clock_out' as const,
      punched_at:        clockOutAt.toISOString(),
      latitude:          null,
      longitude:         null,
      notes:             'Auto clocked out at 5pm',
      idempotency_key:   `auto-clockout-${staffId}-${clockOutAt.toISOString().slice(0, 10)}`,
    }))

  if (toClockOut.length === 0) {
    return NextResponse.json({ ok: true, clocked_out: 0 })
  }

  const { error: insertError } = await supabaseAdmin
    .from('elec_time_punches')
    .insert(toClockOut)

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ ok: true, clocked_out: toClockOut.length })
}
