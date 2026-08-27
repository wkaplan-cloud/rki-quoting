#!/usr/bin/env node
/**
 * Backfill elec_time_punches.address for punches recorded before the column existed.
 *
 * Usage:
 *   node scripts/backfill-punch-addresses.mjs            # backfill everything
 *   node scripts/backfill-punch-addresses.mjs --dry-run  # show what would change
 *   node scripts/backfill-punch-addresses.mjs --limit 50 # cap the number of lookups
 *
 * Run supabase/migrations/punch_address.sql first.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Nominatim's usage policy is one request per second, so this paces itself.
 * Expect roughly a minute per 55 distinct locations — duplicate coordinates are
 * geocoded once and reused, so a busy month is usually far quicker than the raw
 * punch count suggests.
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const dryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.indexOf('--limit')
const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity

const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

const sleep = ms => new Promise(r => setTimeout(r, ms))

function formatAddress(d) {
  const a = d.address ?? {}
  const road = a.road ?? a.pedestrian ?? a.highway ?? a.path
  const area = a.suburb ?? a.city_district ?? a.neighbourhood ?? a.town ?? a.city ?? a.village
  if (road && area) return `${road}, ${area}`
  if (area) return area
  if (d.display_name) return d.display_name.split(',').slice(0, 2).join(',').trim()
  return null
}

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'RKI-QuotingHub-backfill/1.0 (admin@quotinghub.co.za)' }, signal: AbortSignal.timeout(10000) }
    )
    if (!r.ok) {
      console.warn(`  Nominatim returned ${r.status} for ${lat},${lng}`)
      return null
    }
    return formatAddress(await r.json())
  } catch (e) {
    console.warn(`  Lookup failed for ${lat},${lng}: ${e.message}`)
    return null
  }
}

const { data: punches, error } = await sb
  .from('elec_time_punches')
  .select('id, latitude, longitude')
  .is('address', null)
  .not('latitude', 'is', null)
  .not('longitude', 'is', null)
  .order('punched_at', { ascending: false })

if (error) {
  console.error('Failed to load punches:', error.message)
  process.exit(1)
}

if (!punches.length) {
  console.log('Nothing to backfill — every GPS punch already has an address.')
  process.exit(0)
}

// Geocode each distinct location once (4dp ≈ 11m, same key the app cache uses)
const byCoord = new Map()
for (const p of punches) {
  const key = `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`
  if (!byCoord.has(key)) byCoord.set(key, { lat: p.latitude, lng: p.longitude, ids: [] })
  byCoord.get(key).ids.push(p.id)
}

const groups = [...byCoord.values()].slice(0, limit)
const estMin = Math.ceil(groups.length * 1.1 / 60)
console.log(`${punches.length} punches without an address across ${byCoord.size} distinct locations.`)
console.log(`Geocoding ${groups.length} of them at 1/sec — roughly ${estMin} minute${estMin === 1 ? '' : 's'}.${dryRun ? ' (dry run)' : ''}\n`)

let resolved = 0, updated = 0, failed = 0

for (const [i, g] of groups.entries()) {
  const address = await reverseGeocode(g.lat, g.lng)
  if (!address) {
    failed++
  } else {
    resolved++
    console.log(`[${i + 1}/${groups.length}] ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)} → ${address} (${g.ids.length} punch${g.ids.length === 1 ? '' : 'es'})`)
    if (!dryRun) {
      const { error: upErr } = await sb.from('elec_time_punches').update({ address }).in('id', g.ids)
      if (upErr) console.warn(`  Update failed: ${upErr.message}`)
      else updated += g.ids.length
    }
  }
  if (i < groups.length - 1) await sleep(1100)
}

console.log(`\nDone. ${resolved} location${resolved === 1 ? '' : 's'} resolved, ${failed} failed, ${updated} punch row${updated === 1 ? '' : 's'} updated.`)
if (failed) console.log('Failed lookups keep their coordinates and can be retried by re-running this script.')
