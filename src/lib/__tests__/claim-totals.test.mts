/**
 * What a progress claim bills: certified amount, less retention, plus VAT on
 * what is billed now.
 *
 * Run: npx tsx --test src/lib/__tests__/claim-totals.test.mts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimTotals, lineContractValue, lineAsBuiltValue, certifiedAmount } from '../claim-totals'

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

test('a line is valued with its labour', () => {
  // Labour-only line: certifying it used to come out at R0
  assert.equal(lineContractValue({ quoted_quantity: 1, quoted_unit_rate: 0, labour_rate: 69000 }), 69000)
  assert.equal(lineContractValue({ quoted_quantity: 10, quoted_unit_rate: 50, labour_rate: 20 }), 700)
})

test('as-built value uses as-built qty for labour too', () => {
  assert.equal(lineAsBuiltValue({ quoted_quantity: 10, quoted_unit_rate: 50, labour_rate: 20, as_built_quantity: 12 }), 840)
  assert.equal(lineAsBuiltValue({ quoted_quantity: 10, quoted_unit_rate: 50, labour_rate: 20, as_built_unit_rate: 60 }), 800)
})

test('certifying at the claimed % gives back the claimed amount', () => {
  const li = { percentage_claimed: 15, amount_claimed: 10350 }
  assert.equal(certifiedAmount(li, 15), 10350)
  assert.equal(certifiedAmount(li, 10), 6900)
  assert.equal(certifiedAmount(li, 0), 0)
})
