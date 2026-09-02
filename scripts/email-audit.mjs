#!/usr/bin/env node
/**
 * Static audit of every outgoing email path.
 *
 * Catches the three regressions that are easy to reintroduce and invisible
 * until mail starts landing in junk:
 *   1. a route calling resend.emails.send directly, bypassing the wrapper
 *      (loses the text/plain part, Reply-To and preheader)
 *   2. a public API route missing from the proxy.ts allowlist
 *      (the unsubscribe endpoint silently 307'd to /login this way)
 *   3. recipient-facing mail with no preheader text
 *
 * Run before any deploy that touches email:  node scripts/email-audit.mjs
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'src')

function walk(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

const files = walk(SRC)
const rel = (p) => path.relative(ROOT, p)
let failures = 0

// --- 1. no raw Resend calls outside the wrapper --------------------------
// Two ways to bypass it: the SDK (resend.emails.send) and a raw fetch to the
// REST API. The second kind hid two marketing routes from an earlier audit,
// so check for both.
const raw = files.filter((f) => {
  if (f.endsWith(path.join('lib', 'email.ts'))) return false
  const src = fs.readFileSync(f, 'utf8')
  if (src.includes('resend.emails.send(')) return true
  // A raw API call is fine only if it is sending a payload the wrapper built.
  if (!src.includes('api.resend.com/emails')) return false
  return !src.includes('bulkPayload(')
})
if (raw.length) {
  failures++
  console.log('FAIL  routes bypassing src/lib/email.ts:')
  raw.forEach((f) => console.log('        ' + rel(f)))
} else {
  console.log('ok    every send goes through sendEmail()/bulkPayload()')
}

// --- 1b. marketing mail must carry unsubscribe ---------------------------
const marketing = files.filter((f) => {
  if (f.endsWith(path.join('lib', 'email.ts'))) return false
  const src = fs.readFileSync(f, 'utf8')
  return src.includes('api.resend.com/emails') || src.includes('FROM_MARKETING')
})
const noUnsub = marketing.filter(
  (f) => !fs.readFileSync(f, 'utf8').includes('bulkPayload('),
)
if (noUnsub.length) {
  failures++
  console.log('FAIL  bulk/marketing sends without one-click unsubscribe:')
  noUnsub.forEach((f) => console.log('        ' + rel(f)))
} else {
  console.log(`ok    all ${marketing.length} marketing senders use bulkPayload()`)
}

// --- 2. unsubscribe endpoint must be publicly reachable ------------------
const proxy = fs.readFileSync(path.join(SRC, 'proxy.ts'), 'utf8')
if (proxy.includes("'/api/unsubscribe'")) {
  console.log('ok    /api/unsubscribe is in the proxy.ts public allowlist')
} else {
  failures++
  console.log('FAIL  /api/unsubscribe missing from proxy.ts allowlist —')
  console.log('        one-click unsubscribe will redirect to /login and never fire')
}

// --- 3. preheader coverage ----------------------------------------------
const sends = []
for (const f of files) {
  if (f.endsWith(path.join('lib', 'email.ts'))) continue
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  const idxs = lines
    .map((l, i) => (l.includes('sendEmail(') && !l.includes('import') ? i : -1))
    .filter((i) => i >= 0)
  idxs.forEach((i, k) => {
    const end = k + 1 < idxs.length ? idxs[k + 1] : i + 70
    const blk = lines.slice(i, Math.min(end, i + 70)).join('\n')
    const subject = /subject:\s*[`'"]([^`'"]{0,60})/.exec(blk)
    sends.push({
      file: rel(f),
      line: i + 1,
      subject: subject ? subject[1] : '(dynamic)',
      preheader: blk.includes('preheader:'),
    })
  })
}

const noPre = sends.filter((s) => !s.preheader)
console.log(`\n${sends.length} sends, ${sends.length - noPre.length} with preheader text`)
if (noPre.length) {
  console.log('\nno preheader (fine for internal notifications, add one if a customer sees it):')
  for (const s of noPre) console.log(`  ${s.file}:${s.line}  ${s.subject}`)
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
