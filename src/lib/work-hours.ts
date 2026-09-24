/**
 * Hours on a job, split into install and programming time.
 *
 * A session is one clock-in and the next clock-out for the same staff member
 * on the same job card. The clock-in carries the work type; old punches with
 * none count as install. A session still open is left out — its length isn't
 * known yet, and guessing would inflate the job's cost.
 */

export interface WorkPunch {
  staff_id: string
  job_id: string | null
  punch_type: 'clock_in' | 'clock_out'
  punched_at: string
  work_type?: 'install' | 'programming' | null
}

export interface WorkHours {
  install: number
  programming: number
  /** Per staff member, same split. */
  byStaff: Record<string, { install: number; programming: number }>
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function sumWorkHours(punches: WorkPunch[]): WorkHours {
  const out: WorkHours = { install: 0, programming: 0, byStaff: {} }
  const sorted = [...punches].sort((a, b) => a.punched_at.localeCompare(b.punched_at))
  const open = new Map<string, WorkPunch>()

  for (const p of sorted) {
    const key = `${p.staff_id}|${p.job_id ?? ''}`
    if (p.punch_type === 'clock_in') {
      // A second clock-in without a clock-out keeps the first — the gap
      // between them was still time on the job.
      if (!open.has(key)) open.set(key, p)
      continue
    }
    const start = open.get(key)
    if (!start) continue // a stray clock-out with nothing open
    open.delete(key)
    const hours = (Date.parse(p.punched_at) - Date.parse(start.punched_at)) / 3_600_000
    if (!(hours > 0)) continue
    const kind = start.work_type === 'programming' ? 'programming' : 'install'
    out[kind] += hours
    const staff = out.byStaff[p.staff_id] ?? { install: 0, programming: 0 }
    staff[kind] += hours
    out.byStaff[p.staff_id] = staff
  }

  out.install = round2(out.install)
  out.programming = round2(out.programming)
  for (const s of Object.values(out.byStaff)) { s.install = round2(s.install); s.programming = round2(s.programming) }
  return out
}
