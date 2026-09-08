/**
 * Resends a job card's client email exactly as the portal sends it.
 *
 *   npx tsx scripts/resend-job-card.mts <job-card-id> [--prefix "TEST — "] [--dry]
 *
 * Goes through the same sendJobCardEmail() the API route uses, so what lands
 * is the real mail — same PDF, same copy, same CC to the org. Records nothing
 * against the job card (persist: false), so sent_at and the client record are
 * left as they were.
 */

import fs from 'node:fs'
import path from 'node:path'

// Load .env.local the way `next dev` would.
const envPath = path.join(import.meta.dirname, '..', '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const prefixIdx = args.indexOf('--prefix')
const subjectPrefix = prefixIdx >= 0 ? args[prefixIdx + 1] ?? '' : ''
const jobCardId = args.find((a, i) => !a.startsWith('--') && i !== prefixIdx + 1)
if (!jobCardId) {
  console.error('usage: npx tsx scripts/resend-job-card.mts <job-card-id> [--prefix "TEST — "] [--dry]')
  process.exit(1)
}

const { supabaseAdmin } = await import('../src/lib/supabase/admin.js')
const { sendJobCardEmail } = await import('../src/lib/job-card-email.js')

const { data: card } = await supabaseAdmin
  .from('elec_job_cards')
  .select('id, job_number, title, portal_account_id, client_email, sent_to_email, sent_to_name')
  .eq('id', jobCardId)
  .maybeSingle()
if (!card) { console.error('No job card with that id'); process.exit(1) }

const { data: account } = await supabaseAdmin
  .from('supplier_portal_accounts')
  .select('id, company_name, email, logo_url')
  .eq('id', card.portal_account_id)
  .maybeSingle()
if (!account) { console.error('No portal account for that job card'); process.exit(1) }

const to = card.sent_to_email ?? card.client_email
if (!to) { console.error('That job card has no client email on it'); process.exit(1) }

console.log(`${card.job_number} — ${card.title}`)
console.log(`  from: ${account.company_name}`)
console.log(`  to:   ${to}`)
if (dry) { console.log('  --dry, nothing sent'); process.exit(0) }

const result = await sendJobCardEmail({
  account,
  jobCardId: card.id,
  email: to,
  name: card.sent_to_name,
  asInvoice: false,
  includeLink: false,
  persist: false,
  subjectPrefix,
})
if (!result.ok) { console.error(result.error); process.exit(1) }
console.log(`  cc:   ${result.cc.join(', ') || '(none)'}`)
console.log(`  subj: ${result.subject}`)
console.log('Sent.')
