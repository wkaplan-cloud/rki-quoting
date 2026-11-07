/**
 * Who a supplier's email was addressed to, shown on the assistant's page.
 *
 * Run: npx tsx --test src/lib/__tests__/agent-recipients.test.mts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAddressHeader, withTeamNames } from '../agent/recipients'

test('keeps the name beside the address', () => {
  assert.deepEqual(parseAddressHeader('"Thando M" <T@rki.co.za>'), ['Thando M <t@rki.co.za>'])
})

test('a bare address stays bare', () => {
  assert.deepEqual(parseAddressHeader('info@rki.co.za'), ['info@rki.co.za'])
})

test('a comma inside a quoted name does not split it', () => {
  assert.deepEqual(parseAddressHeader('"Kaplan, Warren" <w@rki.co.za>, b@rki.co.za'), ['Kaplan, Warren <w@rki.co.za>', 'b@rki.co.za'])
})

test("the assistant's own address is dropped", () => {
  assert.deepEqual(parseAddressHeader('mia.abc@inbound.resend.app, t@rki.co.za', 'inbound.resend.app'), ['t@rki.co.za'])
})

test('an undecoded name falls back to the address', () => {
  assert.deepEqual(parseAddressHeader('=?UTF-8?B?VGhhbmRv?= <t@rki.co.za>'), ['t@rki.co.za'])
})

test('missing or address-less headers give nothing', () => {
  assert.deepEqual(parseAddressHeader(null), [])
  assert.deepEqual(parseAddressHeader('undisclosed-recipients:;'), [])
})

test('team members show by their first name, whatever the sender called them', () => {
  const team = new Map([['info@rki.co.za', 'Sheryl Kaplan']])
  assert.deepEqual(
    withTeamNames(['R Kaplan Interiors <info@rki.co.za>', 'info@rki.co.za', 'Gary B <gary@supplier.co.za>'], team),
    ['Sheryl', 'Sheryl', 'Gary B <gary@supplier.co.za>'],
  )
})
