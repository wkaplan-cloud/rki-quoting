/**
 * Delivery timeline: which date an item is expected on, and how it is flagged.
 *
 * Run: npx tsx --test src/lib/__tests__/deliveries.test.mts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expectedDate, deliveryState, isDeliveryLine, formatDeliveryDate } from '../deliveries'

const line = (supplier_name: string | null, delivery_date: string | null = null, received = false) =>
  ({ supplier_name, delivery_date, received })

test('an item without its own date uses its supplier date', () => {
  assert.equal(expectedDate(line('Hertex'), { Hertex: '2026-11-10' }), '2026-11-10')
})

test("an item's own date overrides the supplier date", () => {
  assert.equal(expectedDate(line('Hertex', '2026-11-20'), { Hertex: '2026-11-10' }), '2026-11-20')
})

test('supplier names match after trimming', () => {
  assert.equal(expectedDate(line(' Hertex '), { Hertex: '2026-11-10' }), '2026-11-10')
})

test('no item or supplier date means no date', () => {
  assert.equal(expectedDate(line('Hertex'), {}), null)
})

test('received wins over every other state', () => {
  assert.equal(deliveryState('2026-12-01', true, '2026-11-15', '2026-11-01'), 'received')
})

test('due after the installation deadline is late', () => {
  assert.equal(deliveryState('2026-11-16', false, '2026-11-15', '2026-11-01'), 'late')
})

test('due on the deadline day is not late', () => {
  assert.equal(deliveryState('2026-11-15', false, '2026-11-15', '2026-11-01'), 'due')
})

test('a past date that is not received is overdue', () => {
  assert.equal(deliveryState('2026-10-28', false, null, '2026-10-29'), 'overdue')
})

test('due today is on track', () => {
  assert.equal(deliveryState('2026-10-29', false, null, '2026-10-29'), 'due')
})

test('no date is undated', () => {
  assert.equal(deliveryState(null, false, '2026-11-15', '2026-10-29'), 'undated')
})

test('only supplier-backed items are deliveries', () => {
  assert.equal(isDeliveryLine({ row_type: 'item', supplier_name: 'Hertex' }), true)
  assert.equal(isDeliveryLine({ row_type: 'item', supplier_name: '  ' }), false)
  assert.equal(isDeliveryLine({ row_type: 'section', supplier_name: 'Hertex' }), false)
})

test('dates format without timezone drift', () => {
  assert.equal(formatDeliveryDate('2026-11-04'), '4 Nov 2026')
  assert.equal(formatDeliveryDate(null), '')
})
