/**
 * What a progress claim bills: certified amount, less retention, plus VAT on
 * what is billed now.
 *
 * Run: npx tsx --test src/lib/__tests__/claim-totals.test.mts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimTotals } from '../claim-totals'

test('VAT is charged after retention comes off', () => {
  const t = claimTotals({ claim_type: 'invoice', total_claimed: 100000 }, 10, 15)
  assert.equal(t.retention, 10000)
  assert.equal(t.net, 90000)
  assert.equal(t.vat, 13500)
  assert.equal(t.total, 103500)
})

test('the retention release carries the VAT held back, so it is charged once in all', () => {
  const progress = claimTotals({ claim_type: 'invoice', total_claimed: 100000 }, 10, 15)
  const release = claimTotals({ claim_type: 'retention', total_claimed: progress.retention }, 10, 15)
  assert.equal(release.retention, 0)
  assert.equal(release.total, 11500)
  assert.equal(progress.total + release.total, 115000)
})

test('a certified figure below the claim is what gets billed', () => {
  const t = claimTotals({ claim_type: 'invoice', total_claimed: 149440, total_certified: 146451.2 }, 0, 15)
  assert.equal(t.billed, 146451.2)
  assert.equal(t.notCertified, 2988.8)
  assert.equal(t.total, 168418.88)
})

test('an issued invoice amount wins over the certified one', () => {
  const t = claimTotals({ claim_type: 'invoice', total_claimed: 500, total_certified: 400, total_invoiced: 450 }, 0, 15)
  assert.equal(t.billed, 450)
})

test('fractions of a cent are rounded away', () => {
  const t = claimTotals({ claim_type: 'invoice', total_claimed: 23000.0046 }, 0, 0)
  assert.equal(t.billed, 23000)
  assert.equal(t.total, 23000)
})
