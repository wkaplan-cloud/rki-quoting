/**
 * Install vs programming hours on a job, from time punches.
 *
 * Run: npx tsx --test src/lib/__tests__/work-hours.test.mts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sumWorkHours, type WorkPunch } from '../work-hours'

const p = (staff_id: string, punch_type: WorkPunch['punch_type'], at: string, work_type?: WorkPunch['work_type'], job_id = 'job1'): WorkPunch =>
  ({ staff_id, job_id, punch_type, punched_at: `2026-09-24T${at}:00+02:00`, work_type })

test('splits sessions by the work type on the clock-in', () => {
  const h = sumWorkHours([
    p('a', 'clock_in', '08:00', 'install'), p('a', 'clock_out', '11:00'),
    p('a', 'clock_in', '12:00', 'programming'), p('a', 'clock_out', '14:30'),
  ])
  assert.equal(h.install, 3)
  assert.equal(h.programming, 2.5)
})

test('punches from before work types existed count as install', () => {
  const h = sumWorkHours([p('a', 'clock_in', '08:00'), p('a', 'clock_out', '10:00')])
  assert.equal(h.install, 2)
  assert.equal(h.programming, 0)
})

test('an open session is left out rather than guessed', () => {
  const h = sumWorkHours([p('a', 'clock_in', '08:00', 'programming')])
  assert.equal(h.install + h.programming, 0)
})

test('staff and jobs are paired separately', () => {
  const h = sumWorkHours([
    p('a', 'clock_in', '08:00', 'install'),
    p('b', 'clock_in', '09:00', 'programming'),
    p('a', 'clock_out', '10:00'),
    p('b', 'clock_out', '12:00'),
    p('a', 'clock_in', '13:00', 'install', 'job2'), p('a', 'clock_out', '14:00', null, 'job2'),
  ])
  assert.equal(h.install, 3)
  assert.equal(h.programming, 3)
  assert.deepEqual(h.byStaff.a, { install: 3, programming: 0 })
  assert.deepEqual(h.byStaff.b, { install: 0, programming: 3 })
})

test('a stray clock-out and a doubled clock-in do not distort the total', () => {
  const h = sumWorkHours([
    p('a', 'clock_out', '07:00'),
    p('a', 'clock_in', '08:00', 'install'), p('a', 'clock_in', '09:00', 'install'),
    p('a', 'clock_out', '12:00'),
  ])
  assert.equal(h.install, 4)
})
