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

  // Look back 90 days, not just today — a staff member whose last punch was days
  // or weeks ago (offline sync failure, app never reopened, etc.) still needs to
  // be caught and closed out. Restricting to "today" left them stuck forever,
  // since a punch-less staff member simply never appeared in the query.
  const lookback = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const { data: punches, error } = await supabaseAdmin
    .from('elec_time_punches')
    .select('staff_id, portal_account_id, punch_type, punched_at')
    .gte('punched_at', lookback.toISOString())
    .order('punched_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Latest punch per staff — if it's clock_in they're still on site
  const latestPerStaff = new Map<string, { punch_type: string; portal_account_id: string; punched_at: string }>()
  for (const p of (punches ?? [])) {
    if (!latestPerStaff.has(p.staff_id)) {
      latestPerStaff.set(p.staff_id, { punch_type: p.punch_type, portal_account_id: p.portal_account_id, punched_at: p.punched_at })
    }
  }

  const toClockOut = [...latestPerStaff.entries()]
    .filter(([, v]) => v.punch_type === 'clock_in')
    .map(([staffId, v]) => {
      const isStale = v.punched_at < todayStart.toISOString()
      return {
        portal_account_id: v.portal_account_id,
        staff_id:          staffId,
        punch_type:        'clock_out' as const,
        // Stale carryover clock-ins are closed out "now" (cron run time) rather than
        // backdated to today's 17:00 — backdating would misrepresent a multi-day gap
        // as a single normal shift in the timesheet.
        punched_at:        isStale ? now.toISOString() : clockOutAt.toISOString(),
        latitude:          null,
        longitude:         null,
        notes:             isStale
          ? `Auto clocked out — stale clock-in from ${v.punched_at.slice(0, 10)}, review hours manually`
          : 'Auto clocked out at 5pm',
        idempotency_key:   isStale
          ? `auto-clockout-stale-${staffId}-${v.punched_at.slice(0, 10)}`
          : `auto-clockout-${staffId}-${clockOutAt.toISOString().slice(0, 10)}`,
      }
    })

  if (toClockOut.length === 0) {
    return NextResponse.json({ ok: true, clocked_out: 0 })
  }

  const { error: insertError } = await supabaseAdmin
    .from('elec_time_punches')
    .insert(toClockOut)

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ ok: true, clocked_out: toClockOut.length })
}
