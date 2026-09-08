#!/usr/bin/env node
/**
 * Repair clock sessions that never closed.
 *
 * A job card's hours come from pairing clock_in/clock_out punches carrying that
 * job_id. An unmatched clock_in has no end, so the screen counts from its start
 * time to *now* — a session from June still claims thousands of hours.
 *
 * Two bugs stranded these: the staff app restored a job's timer from the wrong
 * record (fixed 2026-09-08), and the 5pm auto-clockout wrote a clock_out with
 * no job_id, closing the staff member's day but never the job's own session
 * (fixed 2026-09-09). This clears up what they left behind.
 *
 * Two different faults, treated differently:
 *
 *   Duplicate punches — two identical rows, same staff, same job, same
 *   timestamp to the millisecond. A double submit. The redundant copy is
 *   deleted; closing it would invent a zero-length shift that never happened.
 *
 *   Orphaned sessions — a clock_in with no clock_out. A clock_out is written,
 *   at the first of:
 *     1. one second before the next punch on that same session
 *     2. 17:00 SAST on the day it started
 *     3. one hour after the start, when neither of those is possible
 *
 * Inserted rows are annotated so a backfilled clock-out is never mistaken for
 * one a technician actually pressed, and carry an idempotency_key beginning
 * `orphan-close-` so the whole run can be reversed.
 *
 * Before writing anything the plan is replayed against the real timeline and
 * the run aborts unless every session closes cleanly.
 *
 * Usage:
 *   node scripts/close-orphan-punches.mjs           # report only, writes nothing
 *   node scripts/close-orphan-punches.mjs --apply   # carry out the repair
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const APPLY = process.argv.includes('--apply')
const HOUR = 3600_000
/** Leave anything opened in the last day alone — those people may be on site. */
const SETTLED_AFTER = 24 * HOUR
const key = (staffId, jobId) => `${staffId}|${jobId ?? ''}`
const fmt = iso => iso.slice(0, 16).replace('T', ' ')

// ── Load every punch, paging past PostgREST's 1000-row cap ──────────────────
const punches = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from('elec_time_punches')
    .select('id, staff_id, portal_account_id, punch_type, punched_at, job_id')
    .order('punched_at', { ascending: true })
    .range(from, from + 999)
  if (error) { console.error('read failed:', error.message); process.exit(1) }
  punches.push(...data)
  if (data.length < 1000) break
}
console.log(`read ${punches.length} punches`)

// ── 1. Exact duplicates ─────────────────────────────────────────────────────
const seen = new Set()
const duplicates = []
const timeline = []
for (const p of punches) {
  const sig = `${p.staff_id}|${p.job_id ?? ''}|${p.punch_type}|${p.punched_at}`
  if (seen.has(sig)) duplicates.push(p)
  else { seen.add(sig); timeline.push(p) }
}

// ── 2. Orphaned sessions on the deduplicated timeline ───────────────────────
const open = new Map()
const orphans = []
for (const p of timeline) {
  const k = key(p.staff_id, p.job_id)
  if (p.punch_type === 'clock_in') {
    if (open.has(k)) orphans.push(open.get(k))   // superseded by a later clock-in
    open.set(k, p)
  } else {
    open.delete(k)
  }
}
const now = Date.now()
for (const p of open.values()) {
  if (now - Date.parse(p.punched_at) > SETTLED_AFTER) orphans.push(p)
}
orphans.sort((a, b) => Date.parse(a.punched_at) - Date.parse(b.punched_at))

// ── 3. Pick an honest close time for each ───────────────────────────────────
const bySession = new Map()
for (const p of timeline) {
  const k = key(p.staff_id, p.job_id)
  if (!bySession.has(k)) bySession.set(k, [])
  bySession.get(k).push(p)
}

/** 17:00 SAST (UTC+2, no DST) on the SAST day the session started. */
function fivePmSast(startIso) {
  const sast = new Date(Date.parse(startIso) + 2 * HOUR)
  return new Date(Date.UTC(sast.getUTCFullYear(), sast.getUTCMonth(), sast.getUTCDate(), 15, 0, 0))
}

const planned = orphans.map(p => {
  const start = Date.parse(p.punched_at)
  const next = (bySession.get(key(p.staff_id, p.job_id)) ?? []).find(q => Date.parse(q.punched_at) > start)
  // A clock_out sharing a timestamp with the next clock_in sorts arbitrarily
  // against it and would re-orphan the session, so land a second earlier.
  const justBefore = t => new Date(Math.max(start, t - 1000))
  let end, basis
  if (next && Date.parse(next.punched_at) - start <= 16 * HOUR) {
    end = justBefore(Date.parse(next.punched_at)); basis = 'next punch'
  } else {
    const five = fivePmSast(p.punched_at)
    if (five.getTime() > start) { end = five; basis = '17:00 SAST' }
    else { end = new Date(start + HOUR); basis = 'start + 1h' }
    if (next && end.getTime() >= Date.parse(next.punched_at)) {
      end = justBefore(Date.parse(next.punched_at)); basis = 'next punch'
    }
  }
  return { p, end, basis, hours: (end.getTime() - start) / HOUR }
})

// ── Report ──────────────────────────────────────────────────────────────────
const phantom = orphans.reduce((s, p) => s + (now - Date.parse(p.punched_at)) / HOUR, 0)

if (duplicates.length) {
  console.log(`\n${duplicates.length} duplicate punch(es) to remove — identical staff, job, type and timestamp:`)
  for (const d of duplicates)
    console.log(`  ${fmt(d.punched_at)}  ${d.punch_type.padEnd(9)}  job=${d.job_id ? d.job_id.slice(0, 8) : '—'}  staff=${d.staff_id.slice(0, 8)}`)
}

console.log(`\n${planned.length} orphaned session(s), currently claiming ${Math.round(phantom).toLocaleString()} phantom hours\n`)
for (const { p, end, basis, hours } of planned) {
  console.log(
    `  ${fmt(p.punched_at)} -> ${fmt(end.toISOString())}  ` +
    `${hours.toFixed(1).padStart(5)}h  via ${basis.padEnd(11)}  ` +
    `job=${p.job_id ? p.job_id.slice(0, 8) : '—'.padEnd(8)}  staff=${p.staff_id.slice(0, 8)}`
  )
}
console.log(`\ntotal hours after repair: ${planned.reduce((s, x) => s + x.hours, 0).toFixed(1)}`)

// ── Self-check: replay the pairing with the plan applied ────────────────────
const merged = [
  ...timeline,
  ...planned.map(({ p, end }) => ({ staff_id: p.staff_id, job_id: p.job_id, punch_type: 'clock_out', punched_at: end.toISOString() })),
].sort((a, b) => Date.parse(a.punched_at) - Date.parse(b.punched_at))

const check = new Map()
let leftOpen = 0
for (const p of merged) {
  const k = key(p.staff_id, p.job_id)
  if (p.punch_type === 'clock_in') { if (check.has(k)) leftOpen++; check.set(k, p) }
  else check.delete(k)
}
for (const p of check.values()) if (now - Date.parse(p.punched_at) > SETTLED_AFTER) leftOpen++

if (leftOpen > 0) {
  console.error(`\nSelf-check failed: ${leftOpen} session(s) would still be orphaned. Nothing written.`)
  process.exit(1)
}
console.log('\nSelf-check passed: every session closes cleanly.')

if (!APPLY) {
  console.log('Report only — nothing written. Re-run with --apply to carry out the repair.')
  process.exit(0)
}

// ── Apply ───────────────────────────────────────────────────────────────────
if (duplicates.length) {
  const { error } = await supabase.from('elec_time_punches').delete().in('id', duplicates.map(d => d.id))
  if (error) { console.error('duplicate removal failed:', error.message); process.exit(1) }
  console.log(`\nremoved ${duplicates.length} duplicate punch(es).`)
}

const rows = planned.map(({ p, end, basis }) => ({
  portal_account_id: p.portal_account_id,
  staff_id:          p.staff_id,
  job_id:            p.job_id,
  punch_type:        'clock_out',
  punched_at:        end.toISOString(),
  latitude:          null,
  longitude:         null,
  notes:             `Backfilled clock-out (${basis}) — the original was never recorded, review hours before billing`,
  idempotency_key:   `orphan-close-${p.id}`,
}))

let written = 0
for (let i = 0; i < rows.length; i += 100) {
  const chunk = rows.slice(i, i + 100)
  const { error } = await supabase.from('elec_time_punches').insert(chunk)
  if (error) { console.error('insert failed:', error.message); process.exit(1) }
  written += chunk.length
}
console.log(`wrote ${written} clock-out punch(es).`)
