/**
 * What goes on the assistant's "To chase" list: quotes near or just past
 * expiry, and RFQs that have waited long enough with no reply of any kind.
 *
 * Run: npx tsx --test src/lib/__tests__/agent-chase-list.test.mts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildChaseList, chaseSummary, dayOffset } from '../agent/chase-list'

const today = '2026-11-04'
const quote = (id: string, validUntil: string | null) => ({ id, supplier: 'S', reference: null, validUntil, project: null })
const rfq = (id: string, sentOn: string, extra = {}) => ({
  id, supplier: 'S', board: null, sentOn, openedAt: null, linkExpiresOn: '2026-12-31', submitted: false, repliedByEmail: false, ...extra,
})

test('quotes are listed from 7 days before expiry to 14 days after', () => {
  const list = buildChaseList([
    quote('too-early', '2026-11-12'), quote('first-day', '2026-11-11'), quote('today', today),
    quote('last-day', '2026-10-21'), quote('too-late', '2026-10-28'),
  ], [], today)
  assert.deepEqual(list.quotes.map(q => [q.id, q.daysLeft]), [['last-day', -14], ['today', 0], ['first-day', 7]])
})

test('a missing or misread expiry date is left out', () => {
  const list = buildChaseList([quote('none', null), quote('words', 'end of month'), quote('bad', '2026-13-45')], [], today)
  assert.equal(list.quotes.length, 0)
})

test('RFQs are chased from 7 days to 10 days after sending', () => {
  const list = buildChaseList([], [
    rfq('too-soon', '2026-10-29'), rfq('first-day', '2026-10-28'), rfq('last-day', '2026-10-25'), rfq('too-late', '2026-10-24'),
  ], today)
  assert.deepEqual(list.rfqs.map(r => [r.id, r.daysWaiting]), [['last-day', 10], ['first-day', 7]])
})

test('a supplier who replied by either route is not chased', () => {
  const list = buildChaseList([], [rfq('link', '2026-10-28', { submitted: true }), rfq('email', '2026-10-28', { repliedByEmail: true })], today)
  assert.equal(list.rfqs.length, 0)
})

test('an RFQ says whether it was opened and whether its link has run out', () => {
  const [r] = buildChaseList([], [rfq('a', '2026-10-28', { openedAt: '2026-10-21T08:00:00Z', linkExpiresOn: '2026-11-03' })], today).rfqs
  assert.equal(r.opened, true)
  assert.equal(r.linkExpired, true)
})

test('summary counts each kind and is empty when there is nothing', () => {
  const list = buildChaseList([quote('a', today)], [rfq('b', '2026-10-28'), rfq('c', '2026-10-28')], today)
  assert.equal(chaseSummary(list), '1 quote expiring or expired, 2 suppliers yet to reply')
  assert.equal(chaseSummary({ quotes: [], rfqs: [] }), '')
})

test('dayOffset crosses month ends', () => {
  assert.equal(dayOffset('2026-11-04', -14), '2026-10-21')
})
