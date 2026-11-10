/**
 * The Supplier Prices sheet's rules: repeat copies of one document collapse,
 * and an invoice is compared line by line with the supplier's earlier quote.
 *
 * Run: npx tsx --test src/lib/__tests__/agent-sheet-checks.test.mts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check, dedupe, type Doc, type Line } from '../agent/sheet-checks'

const today = '2026-11-10'
let n = 0
const line = (description: string, unit_price: number, quantity = 1, code: string | null = null): Line =>
  ({ description, code, quantity, unit: null, unit_price, line_total: unit_price * quantity })

function doc(over: Partial<Doc>): Doc {
  return {
    id: `d${++n}`, side: 'quote', docType: 'supplier_quote', received: '2026-11-01', docDate: null, projectId: null,
    client: 'Unassigned', project: '', supplier: 'Gauteng Mouldings', supplierKey: 'gautengmouldings', ref: null,
    excl: 100, vat: 15, incl: 115, currency: 'ZAR', validUntil: null, printedClient: null, link: null, unsure: false,
    copies: 1, lines: [], checks: [], ...over,
  }
}
const invoice = (over: Partial<Doc>) => doc({ side: 'invoice', docType: 'invoice', received: '2026-11-05', ...over })
const texts = (d: Doc) => d.checks.map(c => `${c.level}:${c.text}`)

test('the same invoice received twice is one row, counted twice', () => {
  const a = invoice({ ref: 'INV1', incl: 500 })
  const b = invoice({ ref: 'inv-1', incl: 500, projectId: 'p1' })
  const out = dedupe([a, b])
  assert.equal(out.length, 1)
  assert.equal(out[0].projectId, 'p1', 'keeps the copy someone filed')
  assert.equal(out[0].copies, 2)
})

test('a revision with the same number but a new total stays its own row', () => {
  assert.equal(dedupe([doc({ ref: 'Q1', incl: 100 }), doc({ ref: 'Q1', incl: 120 })]).length, 2)
})

test('documents with no number are never merged', () => {
  assert.equal(dedupe([invoice({ incl: 50 }), invoice({ incl: 50 })]).length, 2)
})

test('an invoice priced above the quote is flagged with the extra amount', () => {
  const q = doc({ ref: 'QU5552', lines: [line('Cornice 108mm', 22.62, 40), line('Adhesive', 220)] })
  const inv = invoice({ ref: 'GM1', lines: [line('Cornice 108mm', 25, 40), line('Adhesive', 220)] })
  check([q, inv], today)
  assert.deepEqual(texts(inv), ['bad:Above quote QU5552 on 1 line: +R95.20'])
  assert.equal(inv.lines[0].quoted, 22.62)
})

test('rounding on the PDF is not an overcharge', () => {
  const q = doc({ ref: 'Q', lines: [line('Panel', 1000)] })
  const inv = invoice({ lines: [line('Panel', 1004)] })
  check([q, inv], today)
  assert.deepEqual(texts(inv), ['good:Matches quote Q'])
})

test('codes match before descriptions', () => {
  const q = doc({ ref: 'Q', lines: [line('Linen natural 140cm', 300, 1, 'LN-140')] })
  const inv = invoice({ lines: [line('LINEN NAT. 140', 300, 1, 'ln140')] })
  check([q, inv], today)
  assert.deepEqual(texts(inv), ['good:Matches quote Q'])
})

test('only earlier quotes from the same supplier count', () => {
  const other = doc({ ref: 'X', supplier: 'Hertex', supplierKey: 'hertex', lines: [line('Panel', 10)] })
  const later = doc({ ref: 'L', received: '2026-11-09', lines: [line('Panel', 10)] })
  const inv = invoice({ lines: [line('Panel', 50)] })
  check([other, later, inv], today)
  assert.deepEqual(texts(inv), [])
})

test('the quote for the same project wins over a newer one for another', () => {
  const mine = doc({ ref: 'MINE', projectId: 'p1', received: '2026-10-01', lines: [line('Panel', 100)] })
  const newer = doc({ ref: 'OTHER', projectId: 'p2', received: '2026-11-03', lines: [line('Panel', 80)] })
  const inv = invoice({ projectId: 'p1', lines: [line('Panel', 100)] })
  check([mine, newer, inv], today)
  assert.deepEqual(texts(inv), ['good:Matches quote MINE'])
})

test('no matching lines falls back to an identical total', () => {
  const q = doc({ ref: 'Q9', excl: 1887.68, lines: [line('Ceiling panels', 1887.68)] })
  const inv = invoice({ excl: 1887.68, lines: [line('Coffered ceiling (as quoted)', 1887.68)] })
  check([q, inv], today)
  assert.deepEqual(texts(inv), ['good:Same total as quote Q9'])
})

test('expired quotes, repeats and unsure filing are amber', () => {
  const q = doc({ ref: 'Q', validUntil: '2026-11-06', copies: 3, unsure: true })
  check([q], today)
  assert.deepEqual(texts(q), ['warn:Received 3 times', 'warn:Project not certain — check', 'warn:Expired 2026-11-06'])
  const fresh = doc({ validUntil: today })
  check([fresh], today)
  assert.deepEqual(texts(fresh), [], 'still valid on its last day')
})
