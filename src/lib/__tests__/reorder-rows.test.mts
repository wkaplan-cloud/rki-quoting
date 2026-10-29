/**
 * Dragging a section heading moves its items with it.
 *
 * Run: npx tsx --test src/lib/__tests__/reorder-rows.test.mts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reorderRows } from '../reorder-rows'

// 'S' = section heading, anything else = item
const rows = (s: string) => s.split(' ').map(name => ({ name, row_type: name.startsWith('S') ? 'section' : 'item' }))
const names = (r: { name: string }[]) => r.map(x => x.name).join(' ')

const list = rows('x SA a1 a2 SB b1 SC c1 c2')
//                0 1  2  3  4  5  6  7  8

test('an item still moves on its own', () => {
  assert.equal(names(reorderRows(list, 2, 5)), 'x SA a2 SB b1 a1 SC c1 c2')
})

test('dragging a section down takes its items and lands after the target section', () => {
  assert.equal(names(reorderRows(list, 1, 5)), 'x SB b1 SA a1 a2 SC c1 c2')
  assert.equal(names(reorderRows(list, 1, 4)), 'x SB b1 SA a1 a2 SC c1 c2')
  assert.equal(names(reorderRows(list, 1, 8)), 'x SB b1 SC c1 c2 SA a1 a2')
})

test('dragging a section up lands before the target section heading', () => {
  assert.equal(names(reorderRows(list, 6, 5)), 'x SA a1 a2 SC c1 c2 SB b1')
  assert.equal(names(reorderRows(list, 6, 2)), 'x SC c1 c2 SA a1 a2 SB b1')
})

test('dragging a section to the very top stays below the loose items', () => {
  assert.equal(names(reorderRows(list, 4, 0)), 'x SB b1 SA a1 a2 SC c1 c2')
})

test('dropping a section onto its own items does nothing', () => {
  assert.equal(reorderRows(list, 1, 3), list)
  assert.equal(reorderRows(list, 1, 1), list)
})
