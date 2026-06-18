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

interface MinimalPunch { punch_type: string; punched_at: string }

// SAST is always UTC+2 (no DST). 17:00 SAST = 15:00 UTC.
export function get5pmSASTCutoff(clockIn: Date): Date {
  const sa = toSALocal(clockIn)
  return new Date(Date.UTC(sa.getFullYear(), sa.getMonth(), sa.getDate(), 15, 0, 0, 0))
}

export function punchesToBreakdown(punches: MinimalPunch[], now = new Date()): HourBreakdown {
  const sorted = [...punches].sort((a, b) => a.punched_at.localeCompare(b.punched_at))
  const ins  = sorted.filter(p => p.punch_type === 'clock_in')
  const outs = sorted.filter(p => p.punch_type === 'clock_out')
  let normalMs = 0, overtimeMs = 0, totalMs = 0
  ins.forEach((inP, idx) => {
    const outP = outs[idx]
    let clockOut: Date
    if (outP) {
      clockOut = new Date(outP.punched_at)
    } else {
      // No clock_out yet: cap at 5pm SAST only if clocked in before 5pm
      // (after-hours clock-ins must not be capped — cutoff is already in the past)
      const cutoff = get5pmSASTCutoff(new Date(inP.punched_at))
      const clockInMs = new Date(inP.punched_at).getTime()
      if (clockInMs < cutoff.getTime()) {
        clockOut = now < cutoff ? now : cutoff
      } else {
        clockOut = now
      }
    }
    const b = calcHourBreakdown(new Date(inP.punched_at), clockOut)
    normalMs   += b.normalMs
    overtimeMs += b.overtimeMs
    totalMs    += b.totalMs
  })
  return { normalMs, overtimeMs, totalMs }
}
