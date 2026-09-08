import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const maxDuration = 10

// Runs daily at 15:00 UTC = 17:00 SAST.
// Inserts a clock_out punch for every session still open at 5pm.
//
// A session is per staff member AND per job. Clocking into a job writes a punch
// carrying that job_id, and the office reads a job card's hours by filtering
// punches on that job_id — so a clock_out with no job_id closes the staff
// member's day while leaving the job's own session open, counting up to now
// forever. This used to take the latest punch per staff member and write one
// job-less clock_out, which is exactly that bug. Every open (staff, job) pair
// is now closed on its own row.

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
    .select('staff_id, portal_account_id, punch_type, punched_at, job_id')
    .gte('punched_at', lookback.toISOString())
    .order('punched_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Walk each (staff, job) timeline forwards and keep whatever is left open.
  // A second clock_in on the same pair supersedes the first, which is how the
  // orphans accumulated in the first place — closing the newest is right, and
  // the backfill script deals with the ones already stranded.
  type Open = { portal_account_id: string; punched_at: string; job_id: string | null }
  const open = new Map<string, Open>()
  const key = (staffId: string, jobId: string | null) => `${staffId}|${jobId ?? ''}`

  for (const p of (punches ?? [])) {
    const k = key(p.staff_id, p.job_id)
    if (p.punch_type === 'clock_in') {
      open.set(k, { portal_account_id: p.portal_account_id, punched_at: p.punched_at, job_id: p.job_id })
    } else {
      open.delete(k)
    }
  }

  const toClockOut = [...open.entries()].map(([k, v]) => {
    const staffId = k.split('|')[0]
    const isStale = v.punched_at < todayStart.toISOString()
    // A job's own session and the staff member's overall day are separate rows,
    // so the key has to carry the job or the second insert is deduplicated away.
    const jobPart = v.job_id ? `-job-${v.job_id}` : ''
    return {
      portal_account_id: v.portal_account_id,
      staff_id:          staffId,
      punch_type:        'clock_out' as const,
      job_id:            v.job_id,
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
        ? `auto-clockout-stale-${staffId}${jobPart}-${v.punched_at.slice(0, 10)}`
        : `auto-clockout-${staffId}${jobPart}-${clockOutAt.toISOString().slice(0, 10)}`,
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
