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

export interface MinimalPunch { punch_type: string; punched_at: string; job_id?: string | null }

/** SAST is UTC+2 year round — no daylight saving. */
const SAST_OFFSET_MS = 2 * 3_600_000

/**
 * The South African calendar date a punch falls on, as YYYY-MM-DD.
 * Bucketing on the raw UTC date files work between midnight and 02:00 SAST
 * under the previous day, which is the wrong day for both the timesheet and
 * the weekend / public-holiday test.
 */
export function saDateKey(iso: string): string {
  return new Date(Date.parse(iso) + SAST_OFFSET_MS).toISOString().slice(0, 10)
}

/** One clocked span, and how much of it counts once overlaps are removed. */
export interface PunchSession {
  in: MinimalPunch
  out: MinimalPunch | null
  /** Time not already covered by an earlier session that day. */
  countedMs: number
  normalMs: number
  overtimeMs: number
}

// SAST is always UTC+2 (no DST). 17:00 SAST = 15:00 UTC.
export function get5pmSASTCutoff(clockIn: Date): Date {
  const sa = toSALocal(clockIn)
  return new Date(Date.UTC(sa.getFullYear(), sa.getMonth(), sa.getDate(), 15, 0, 0, 0))
}

/**
 * The sessions worked in ONE South African day, with each one's counted time.
 *
 * A technician has two clocks running at once: the working day (no job_id) and
 * whichever job they are on (job_id set). Pairing every clock_in against the
 * next clock_out regardless of job matched a job's start to the day's end and
 * counted the same hours twice. Pairing happens inside each timeline, and time
 * already covered by an earlier session that day is not counted again — so a
 * job session nested inside a shift contributes nothing extra, which is right.
 *
 * The nine-hour normal allowance is spent across the day in order rather than
 * granted afresh to each session, so a day split over two jobs cannot book
 * eighteen normal hours with no overtime.
 *
 * Every surface that shows hours — the timesheet screen, the emailed PDF, the
 * clocking dashboard — goes through here. They each had their own version of
 * this arithmetic and all three disagreed.
 */
export function buildDaySessions(punches: MinimalPunch[], now = new Date()): PunchSession[] {
  const sorted = [...punches].sort((a, b) => a.punched_at.localeCompare(b.punched_at))
  if (sorted.length === 0) return []

  const byJob = new Map<string, MinimalPunch[]>()
  for (const p of sorted) {
    const k = p.job_id ?? ''
    const list = byJob.get(k)
    if (list) list.push(p); else byJob.set(k, [p])
  }

  const sessions: PunchSession[] = []
  for (const list of byJob.values()) {
    let openP: MinimalPunch | null = null
    for (const p of list) {
      if (p.punch_type === 'clock_in') {
        if (!openP) openP = p
      } else if (openP) {
        sessions.push({ in: openP, out: p, countedMs: 0, normalMs: 0, overtimeMs: 0 })
        openP = null
      }
    }
    if (openP) sessions.push({ in: openP, out: null, countedMs: 0, normalMs: 0, overtimeMs: 0 })
  }
  sessions.sort((a, b) => a.in.punched_at.localeCompare(b.in.punched_at))

  const dayStart = new Date(sorted[0].punched_at)
  const sa = toSALocal(dayStart)
  const dow = sa.getDay()
  const allOvertime = dow === 0 || dow === 6 || isSAPublicHoliday(dayStart)

  const covered: [number, number][] = []
  let spentNormal = 0

  for (const ses of sessions) {
    const a = Date.parse(ses.in.punched_at)
    let b: number
    if (ses.out) {
      b = Date.parse(ses.out.punched_at)
    } else {
      // Still open. Cap at 5pm SAST when clocked in before 5pm; an after-hours
      // clock-in is already past that, so bound it at midnight SAST instead —
      // never at "now", which on a June record would book thousands of hours.
      const cutoff = get5pmSASTCutoff(new Date(a)).getTime()
      const bound = a < cutoff ? cutoff : cutoff + 7 * 3_600_000
      b = Math.max(a, Math.min(now.getTime(), bound))
    }

    let counted = Math.max(0, b - a)
    for (const [ca, cb] of covered) {
      const overlap = Math.min(b, cb) - Math.max(a, ca)
      if (overlap > 0) counted -= overlap
    }
    counted = Math.max(0, counted)
    covered.push([a, b])

    ses.countedMs = counted
    if (allOvertime) { ses.normalMs = 0; ses.overtimeMs = counted }
    else {
      const normal = Math.max(0, Math.min(counted, NORMAL_DAILY_MS - spentNormal))
      ses.normalMs = normal
      ses.overtimeMs = counted - normal
      spentNormal += normal
    }
  }
  return sessions
}

/** Totals for ONE South African day. */
export function punchesToBreakdown(punches: MinimalPunch[], now = new Date()): HourBreakdown {
  let normalMs = 0, overtimeMs = 0, totalMs = 0
  for (const s of buildDaySessions(punches, now)) {
    normalMs += s.normalMs; overtimeMs += s.overtimeMs; totalMs += s.countedMs
  }
  return { normalMs, overtimeMs, totalMs }
}

/**
 * Totals over any span of days. Punches are bucketed by South African calendar
 * date first — the nine-hour rule and the weekend test are per day, so a set
 * spanning several days computed in one go would apply them to the whole range.
 */
export function punchesToBreakdownRange(punches: MinimalPunch[], now = new Date()): HourBreakdown {
  const byDay = new Map<string, MinimalPunch[]>()
  for (const p of punches) {
    const k = saDateKey(p.punched_at)
    const list = byDay.get(k)
    if (list) list.push(p); else byDay.set(k, [p])
  }
  let normalMs = 0, overtimeMs = 0, totalMs = 0
  for (const day of byDay.values()) {
    const b = punchesToBreakdown(day, now)
    normalMs += b.normalMs; overtimeMs += b.overtimeMs; totalMs += b.totalMs
  }
  return { normalMs, overtimeMs, totalMs }
}
