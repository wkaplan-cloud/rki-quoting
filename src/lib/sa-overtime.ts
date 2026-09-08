// SA overtime rules per BCEA:
//   Mon–Fri weekdays: first 9 h = normal, beyond = overtime
//   Saturday, Sunday, public holidays: all hours = overtime
//
// If a fixed holiday falls on a Sunday, the following Monday is observed.

function getEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function toSALocal(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }))
}

// [month 1-based, day]
const FIXED_HOLIDAYS: [number, number][] = [
  [1,  1],  // New Year's Day
  [3,  21], // Human Rights Day
  [4,  27], // Freedom Day
  [5,  1],  // Workers' Day
  [6,  16], // Youth Day
  [8,  9],  // National Women's Day
  [9,  24], // Heritage Day
  [12, 16], // Day of Reconciliation
  [12, 25], // Christmas Day
  [12, 26], // Day of Goodwill
]

export function isSAPublicHoliday(date: Date): boolean {
  const sa = toSALocal(date)
  const year = sa.getFullYear()
  const month = sa.getMonth() + 1
  const day = sa.getDate()
  const dow = sa.getDay() // 0=Sun, 1=Mon

  const easter = getEaster(year)
  const goodFriday = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2)
  const familyDay  = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 1)

  const variable = [
    { m: goodFriday.getMonth() + 1, d: goodFriday.getDate() },
    { m: familyDay.getMonth()  + 1, d: familyDay.getDate()  },
  ]
  for (const h of variable) {
    if (month === h.m && day === h.d) return true
  }

  for (const [hm, hd] of FIXED_HOLIDAYS) {
    if (month === hm && day === hd) return true
    // Substitute Monday: fixed holiday fell on Sunday → Monday is observed
    if (dow === 1) {
      const prev = new Date(sa); prev.setDate(prev.getDate() - 1)
      if (prev.getMonth() + 1 === hm && prev.getDate() === hd) return true
    }
  }

  return false
}

export interface HourBreakdown {
  normalMs:   number
  overtimeMs: number
  totalMs:    number
}

const NORMAL_DAILY_MS = 9 * 3_600_000

export function calcHourBreakdown(clockIn: Date, clockOut: Date): HourBreakdown {
  const totalMs = Math.max(0, clockOut.getTime() - clockIn.getTime())
  const sa = toSALocal(clockIn)
  const dow = sa.getDay()

  if (dow === 0 || dow === 6 || isSAPublicHoliday(clockIn)) {
    return { normalMs: 0, overtimeMs: totalMs, totalMs }
  }

  const normalMs = Math.min(totalMs, NORMAL_DAILY_MS)
  return { normalMs, overtimeMs: totalMs - normalMs, totalMs }
}

interface MinimalPunch { punch_type: string; punched_at: string; job_id?: string | null }

// SAST is always UTC+2 (no DST). 17:00 SAST = 15:00 UTC.
export function get5pmSASTCutoff(clockIn: Date): Date {
  const sa = toSALocal(clockIn)
  return new Date(Date.UTC(sa.getFullYear(), sa.getMonth(), sa.getDate(), 15, 0, 0, 0))
}

/**
 * Hours actually worked in one day, from that day's punches.
 *
 * A person has two kinds of punch running at once: the working day (no job_id)
 * and the job they are on (job_id set). This used to pair the nth clock_in with
 * the nth clock_out across the lot, ignoring job_id — so clocking onto a job
 * inside a shift paired the job's start against the day's end, and the same
 * hours were counted twice. Pairing is now done per job, the resulting spans
 * are merged, and overlapping time counts once.
 *
 * The normal/overtime split is also applied to the day, not to each span. The
 * old code gave every pair its own nine-hour normal allowance, so a day split
 * across two jobs could book eighteen normal hours with no overtime.
 */
export function punchesToBreakdown(punches: MinimalPunch[], now = new Date()): HourBreakdown {
  const sorted = [...punches].sort((a, b) => a.punched_at.localeCompare(b.punched_at))
  if (sorted.length === 0) return { normalMs: 0, overtimeMs: 0, totalMs: 0 }

  // Pair within each timeline: the working day and each job are separate.
  const byJob = new Map<string, MinimalPunch[]>()
  for (const p of sorted) {
    const k = p.job_id ?? ''
    const list = byJob.get(k)
    if (list) list.push(p); else byJob.set(k, [p])
  }

  const spans: [number, number][] = []
  for (const list of byJob.values()) {
    let openAt: number | null = null
    for (const p of list) {
      if (p.punch_type === 'clock_in') {
        if (openAt === null) openAt = Date.parse(p.punched_at)
      } else if (openAt !== null) {
        spans.push([openAt, Date.parse(p.punched_at)])
        openAt = null
      }
    }
    if (openAt !== null) {
      // Still open. Cap at 5pm SAST when clocked in before 5pm. An after-hours
      // clock-in is past that cutoff, so it runs to the end of its own SAST day
      // instead — never to "now", which on a June record would book thousands
      // of hours against a single shift.
      const cutoff = get5pmSASTCutoff(new Date(openAt)).getTime()
      const bound = openAt < cutoff ? cutoff : cutoff + 7 * 3_600_000  // midnight SAST
      spans.push([openAt, Math.max(openAt, Math.min(now.getTime(), bound))])
    }
  }

  // Merge overlapping spans so time on a job inside a shift is counted once.
  spans.sort((a, b) => a[0] - b[0])
  let totalMs = 0
  let cur: [number, number] | null = null
  for (const sp of spans) {
    if (!cur) { cur = [sp[0], sp[1]]; continue }
    if (sp[0] <= cur[1]) cur[1] = Math.max(cur[1], sp[1])
    else { totalMs += cur[1] - cur[0]; cur = [sp[0], sp[1]] }
  }
  if (cur) totalMs += cur[1] - cur[0]

  // One normal/overtime split for the whole day, taken from when it started.
  const dayStart = new Date(sorted[0].punched_at)
  const sa = toSALocal(dayStart)
  const dow = sa.getDay()
  if (dow === 0 || dow === 6 || isSAPublicHoliday(dayStart)) {
    return { normalMs: 0, overtimeMs: totalMs, totalMs }
  }
  const normalMs = Math.min(totalMs, NORMAL_DAILY_MS)
  return { normalMs, overtimeMs: totalMs - normalMs, totalMs }
}
