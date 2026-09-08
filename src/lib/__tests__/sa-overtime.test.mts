/**
 * Payroll arithmetic. People are paid from these numbers, so every rule the
 * business relies on is pinned here.
 *
 * Run: npx tsx src/lib/__tests__/sa-overtime.test.mts
 */
import { punchesToBreakdown, punchesToBreakdownRange, buildDaySessions, saDateKey } from '../sa-overtime'

const H = 3_600_000
let passed = 0, failed = 0

function check(name: string, actual: number, expectedHours: number) {
  const got = actual / H
  const ok = Math.abs(got - expectedHours) < 0.001
  if (ok) { passed++; console.log(`  ok    ${name}`) }
  else { failed++; console.log(`  FAIL  ${name}\n          expected ${expectedHours}h, got ${got.toFixed(3)}h`) }
}
function group(title: string) { console.log(`\n${title}`) }

/** SAST times on a plain Wednesday (2026-09-09). UTC is SAST minus two hours. */
const day = (hhmm: string, jobId: string | null = null, type: 'clock_in' | 'clock_out' = 'clock_in', date = '2026-09-09') => {
  const [h, m] = hhmm.split(':').map(Number)
  const utc = new Date(Date.UTC(+date.slice(0,4), +date.slice(5,7) - 1, +date.slice(8,10), h - 2, m, 0))
  return { punch_type: type, punched_at: utc.toISOString(), job_id: jobId }
}
const IN  = (t: string, job: string | null = null, d?: string) => day(t, job, 'clock_in', d)
const OUT = (t: string, job: string | null = null, d?: string) => day(t, job, 'clock_out', d)

// A fixed "now" well after every scenario, so open sessions are deterministic.
const NOW = new Date('2026-09-20T12:00:00Z')

group('A plain day')
{
  const b = punchesToBreakdown([IN('07:00'), OUT('16:00')], NOW)
  check('07:00-16:00 is 9h total', b.totalMs, 9)
  check('  ...all normal', b.normalMs, 9)
  check('  ...no overtime', b.overtimeMs, 0)
}
{
  const b = punchesToBreakdown([IN('06:00'), OUT('17:00')], NOW)
  check('11h day is 9h normal', b.normalMs, 9)
  check('  ...and 2h overtime', b.overtimeMs, 2)
}

group('A job clocked inside the working day counts once')
{
  // The bug that was overpaying: the day 07:00-16:00 with job A 09:00-11:00.
  const b = punchesToBreakdown([IN('07:00'), IN('09:00', 'A'), OUT('11:00', 'A'), OUT('16:00')], NOW)
  check('day 9h with a 2h job inside it is still 9h', b.totalMs, 9)
  check('  ...9h normal', b.normalMs, 9)
  check('  ...0h overtime', b.overtimeMs, 0)
}
{
  // Two jobs back to back inside one day.
  const b = punchesToBreakdown([
    IN('07:00'), IN('07:30', 'A'), OUT('11:00', 'A'), IN('11:30', 'B'), OUT('15:00', 'B'), OUT('16:00'),
  ], NOW)
  check('two jobs inside a 9h day is still 9h', b.totalMs, 9)
}

group('Job time outside the working day still counts')
{
  // Called back out after clocking off for the day.
  const b = punchesToBreakdown([IN('07:00'), OUT('16:00'), IN('18:00', 'A'), OUT('20:00', 'A')], NOW)
  check('9h day plus a 2h callout is 11h', b.totalMs, 11)
  check('  ...9h normal', b.normalMs, 9)
  check('  ...2h overtime', b.overtimeMs, 2)
}

group('Overlapping jobs are not double counted')
{
  // Two job timelines overlapping, no global punch at all.
  const b = punchesToBreakdown([IN('08:00', 'A'), IN('09:00', 'B'), OUT('12:00', 'B'), OUT('10:00', 'A')], NOW)
  check('08:00-12:00 across two overlapping jobs is 4h', b.totalMs, 4)
}

group('Weekends and public holidays are all overtime')
{
  const sat = punchesToBreakdown([IN('08:00', null, '2026-09-12'), OUT('12:00', null, '2026-09-12')], NOW)
  check('Saturday 4h is all overtime', sat.overtimeMs, 4)
  check('  ...no normal hours', sat.normalMs, 0)
  const hol = punchesToBreakdown([IN('08:00', null, '2026-09-24'), OUT('12:00', null, '2026-09-24')], NOW)
  check('Heritage Day 4h is all overtime', hol.overtimeMs, 4)
}

group('A missing clock-out does not run away')
{
  const b = punchesToBreakdown([IN('07:00')], NOW)
  check('clocked in 07:00, never out, caps at 17:00', b.totalMs, 10)
}
{
  // The June record that was claiming thousands of hours.
  const b = punchesToBreakdown([IN('07:00', null, '2026-06-02')], NOW)
  check('an old open session still caps at 17:00 that day', b.totalMs, 10)
}
{
  // Clocked in after 17:00 and never out — bounded by midnight, not by "now".
  const b = punchesToBreakdown([IN('21:00', null, '2026-06-02')], NOW)
  check('an after-hours open session bounds at midnight', b.totalMs, 3)
}

group('Duplicate and malformed punches')
{
  const b = punchesToBreakdown([IN('07:00'), IN('07:00'), OUT('16:00')], NOW)
  check('a duplicated clock-in does not double the day', b.totalMs, 9)
}
{
  const b = punchesToBreakdown([OUT('06:00'), IN('07:00'), OUT('16:00')], NOW)
  check('a stray clock-out first does not zero the day', b.totalMs, 9)
}
{
  const b = punchesToBreakdown([], NOW)
  check('no punches is no hours', b.totalMs, 0)
}

group('Sessions add up to the day')
{
  const punches = [IN('07:00'), IN('09:00', 'A'), OUT('11:00', 'A'), OUT('16:00'), IN('18:00', 'B'), OUT('20:00', 'B')]
  const sessions = buildDaySessions(punches, NOW)
  const sum = sessions.reduce((s, x) => s + x.countedMs, 0)
  const day = punchesToBreakdown(punches, NOW)
  check('session counted time sums to the day total', sum, day.totalMs / H)
  const nSum = sessions.reduce((s, x) => s + x.normalMs, 0)
  const oSum = sessions.reduce((s, x) => s + x.overtimeMs, 0)
  check('session normal sums to the day normal', nSum, day.normalMs / H)
  check('session overtime sums to the day overtime', oSum, day.overtimeMs / H)
}

group('Multi-day ranges apply the rules per day')
{
  const week = [
    IN('07:00', null, '2026-09-07'), OUT('17:00', null, '2026-09-07'),  // Mon 10h
    IN('07:00', null, '2026-09-08'), OUT('17:00', null, '2026-09-08'),  // Tue 10h
  ]
  const r = punchesToBreakdownRange(week, NOW)
  check('two 10h days is 20h total', r.totalMs, 20)
  check('  ...18h normal (9h each), not 9h for the pair', r.normalMs, 18)
  check('  ...2h overtime (1h each)', r.overtimeMs, 2)
}

group('South African calendar dates')
{
  const ok1 = saDateKey('2026-09-09T22:30:00Z') === '2026-09-10'
  console.log(`  ${ok1 ? 'ok   ' : 'FAIL '} 22:30 UTC files under the next SA day`)
  ok1 ? passed++ : failed++
  const ok2 = saDateKey('2026-09-09T05:00:00Z') === '2026-09-09'
  console.log(`  ${ok2 ? 'ok   ' : 'FAIL '} 05:00 UTC files under the same SA day`)
  ok2 ? passed++ : failed++
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
