/**
 * Guards the read that broke the auto-clockout cron: PostgREST truncates at
 * 1000 rows without erroring, and a forward walk over a truncated window closes
 * the wrong shifts.
 *
 * Run: npx tsx --test src/lib/__tests__/fetch-all-rows.test.mts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchAllRows, PAGE_SIZE } from '../fetch-all-rows'

/** A fake PostgREST table that truncates at PAGE_SIZE, exactly as the real one does. */
function table(total: number) {
  const all = Array.from({ length: total }, (_, i) => ({ id: i }))
  const calls: [number, number][] = []
  const page = async (from: number, to: number) => {
    calls.push([from, to])
    const span = Math.min(to - from + 1, PAGE_SIZE)
    return { data: all.slice(from, from + span), error: null }
  }
  return { all, calls, page }
}

test('reads a window larger than the 1000-row cap in full', async () => {
  const t = table(1787) // the live punch count that broke the auto-clockout cron
  const { rows, error, truncated } = await fetchAllRows(t.page)
  assert.equal(error, null)
  assert.equal(truncated, false)
  assert.equal(rows.length, 1787)
  assert.deepEqual(rows, t.all)
  assert.equal(t.calls.length, 2)
})

test('the newest rows survive — the ones a truncated read used to hide', async () => {
  const t = table(1787)
  const { rows } = await fetchAllRows(t.page)
  // A single capped read stops at index 999; everything after it went missing.
  assert.deepEqual(rows.at(-1), { id: 1786 })
  assert.ok(rows.some(r => r.id === 1000), 'row just past the cap must be present')
})

test('an exact multiple of the page size still terminates', async () => {
  const t = table(PAGE_SIZE * 2)
  const { rows, truncated } = await fetchAllRows(t.page)
  assert.equal(rows.length, PAGE_SIZE * 2)
  assert.equal(truncated, false)
  assert.equal(t.calls.length, 3) // third page comes back empty and ends it
})

test('an empty window reads as no rows, not as an error', async () => {
  const { rows, error, truncated } = await fetchAllRows(table(0).page)
  assert.deepEqual(rows, [])
  assert.equal(error, null)
  assert.equal(truncated, false)
})

test('a window that fits in one page costs one request', async () => {
  const t = table(12)
  const { rows } = await fetchAllRows(t.page)
  assert.equal(rows.length, 12)
  assert.equal(t.calls.length, 1)
})

test('surfaces a query error instead of silently returning a short read', async () => {
  const page = async () => ({ data: null, error: { message: 'statement timeout' } })
  const { rows, error, truncated } = await fetchAllRows(page)
  assert.equal(error, 'statement timeout')
  assert.equal(truncated, true)
  assert.deepEqual(rows, [])
})

test('stops at maxPages rather than looping forever on an unstable ordering', async () => {
  let calls = 0
  const page = async () => {
    calls++
    return { data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i })), error: null }
  }
  const { truncated } = await fetchAllRows(page, 3)
  assert.equal(calls, 3)
  assert.equal(truncated, true, 'must report the read was incomplete')
})
