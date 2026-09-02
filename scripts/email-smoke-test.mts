/**
 * Sends two real test emails so you can inspect the headers in Gmail.
 *
 *   npx tsx scripts/email-smoke-test.mts you@example.com
 *
 * Sends nothing to anyone but the address you pass. The marketing test uses
 * a fake recipient token, so clicking its unsubscribe link suppresses only
 * the address you tested with — delete that row afterwards if it is yours.
 *
 * Add MARKETING_FROM to .env.local first if you want the marketing test to go
 * out on news.quotinghub.co.za rather than the root domain.
 */

import fs from 'node:fs'
import path from 'node:path'

// Load .env.local the way `next dev` would.
const envPath = path.join(import.meta.dirname, '..', '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const to = process.argv[2]
if (!to) {
  console.error('usage: npx tsx scripts/email-smoke-test.mts you@example.com')
  process.exit(1)
}

const { sendEmail, bulkPayload, marketingFooter, unsubscribeUrl, FROM_MARKETING } =
  await import('../src/lib/email.js') // resolved by tsx to src/lib/email.ts

const body = `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#2C2C2A;">
  <h1 style="font-size:20px;margin:0 0 16px;">Deliverability test</h1>
  <p style="font-size:15px;line-height:1.7;color:#5A5751;">
    If you can read this, the wrapper rendered the HTML part.
    Open <strong>Show original</strong> in Gmail and check SPF, DKIM and DMARC all say PASS.
  </p>
  <table style="margin:16px 0;"><tr><td>Sent</td><td>${new Date().toISOString()}</td></tr></table>
  <p><a href="https://www.quotinghub.co.za/dashboard">Open QuotingHub</a></p>
</div>`

console.log(`\n1. transactional  ->  ${to}`)
const t = await sendEmail({
  to,
  subject: 'QuotingHub deliverability test (transactional)',
  preheader: 'Checking SPF, DKIM, DMARC and the plain-text part.',
  html: body,
})
console.log('   ', t.error ? `ERROR ${JSON.stringify(t.error)}` : `sent id=${t.data?.id}`)

console.log(`\n2. marketing      ->  ${to}   from: ${FROM_MARKETING}`)
const payload = bulkPayload({
  to,
  subject: 'QuotingHub deliverability test (marketing)',
  preheader: 'This one carries the one-click unsubscribe headers.',
  html: body + marketingFooter(to),
})
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
})
console.log('   ', res.ok ? `sent ${JSON.stringify(await res.json())}` : `ERROR ${await res.text()}`)

console.log('\nList-Unsubscribe header sent:')
console.log('  ', payload.headers['List-Unsubscribe'])
console.log('unsubscribe URL:', unsubscribeUrl(to))
console.log('\nplain-text part the wrapper derived:\n---')
console.log(payload.text)
console.log('---')
