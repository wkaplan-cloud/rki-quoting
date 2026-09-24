/**
 * Which lines count toward a quote's total: optional extras and
 * good/better/best alternative sections.
 *
 * Run: npx tsx --test src/lib/__tests__/quote-options.test.mts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { excludedSectionIds, lineCounts, countsInQuoteTotal } from '../quote-options'

const sec = (id: string, sort_order: number, option_group: string | null = null, option_chosen = false) =>
  ({ id, sort_order, option_group, option_chosen })

test('sections outside any group always count', () => {
  assert.equal(excludedSectionIds([sec('a', 0), sec('b', 1)]).size, 0)
})

test('only the chosen alternative counts', () => {
  const ex = excludedSectionIds([sec('good', 0, 'Cinema'), sec('better', 1, 'Cinema', true), sec('best', 2, 'Cinema')])
  assert.deepEqual([...ex].sort(), ['best', 'good'])
})

test('with nothing chosen, the first alternative counts', () => {
  const ex = excludedSectionIds([sec('best', 2, 'Cinema'), sec('good', 0, 'Cinema'), sec('better', 1, 'Cinema')])
  assert.deepEqual([...ex].sort(), ['best', 'better'])
})

test('groups are independent of each other', () => {
  const ex = excludedSectionIds([
    sec('c1', 0, 'Cinema', true), sec('c2', 1, 'Cinema'),
    sec('w1', 2, 'Wi-Fi'), sec('w2', 3, 'Wi-Fi', true),
  ])
  assert.deepEqual([...ex].sort(), ['c2', 'w1'])
})

test('a line counts only if it is neither an untaken extra nor in an unchosen alternative', () => {
  const ex = new Set(['alt'])
  assert.equal(lineCounts({ section_id: 'main' }, ex), true)
  assert.equal(lineCounts({ section_id: 'alt' }, ex), false)
  assert.equal(lineCounts({ section_id: null, is_optional: true }, ex), false)
  assert.equal(lineCounts({ section_id: 'main', is_optional: true, optional_selected: true }, ex), true)
  assert.equal(countsInQuoteTotal({}), true)
})
