import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Nightly cleanup: scan all active product IDs from Twinbru, compare against DB,
// delete any that are no longer active (discontinued).

export const maxDuration = 300

const TWINBRU_BASE = process.env.TWINBRU_BASE_URL ?? 'https://api.twinbru.com'
const SUB_KEY      = process.env.TWINBRU_SUBSCRIPTION_KEY ?? ''
const BEARER       = process.env.TWINBRU_BEARER_TOKEN ?? ''
const PAGE_SIZE    = 50
const END_YEAR     = new Date().getFullYear()

function twinbruHeaders() {
  return {
    'Ocp-Apim-Subscription-Key': SUB_KEY,
    'Authorization': `Bearer ${BEARER}`,
    'Api-Version': 'v1',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── Step 1: Scan all years, collect active product IDs ──────────────────────
  const activeIds = new Set<string>()

  for (let year = 2000; year <= END_YEAR; year++) {
    const filter = `status.eq.RN/launch.in(${year}00-${year}99)`
    let page           = 1
    let totalPageCount = 0

    while (true) {
      const res = await fetch(`${TWINBRU_BASE}/products/`, {
        method: 'POST',
        headers: twinbruHeaders(),
        body: JSON.stringify({ page, pageSize: PAGE_SIZE, filter }),
      })

      if (res.status === 404 || res.status === 500) break
      if (!res.ok) {
        const txt = await res.text()
        return NextResponse.json({ error: `Twinbru ${res.status} (year ${year}): ${txt.slice(0, 200)}` }, { status: 502 })
      }

      const data = await res.json().catch(() => null)
      if (!data) break

      const tpc = Number(data.totalPageCount ?? data.totalPages ?? 0)
      if (totalPageCount === 0 && tpc) totalPageCount = tpc

      const raw = data.results ?? data.items ?? data.products ?? []
      const rawItems: Record<string, unknown>[] = Array.isArray(raw) ? raw : []
      const items = rawItems.map(r =>
        (r && typeof r === 'object' && 'item' in r) ? (r.item as Record<string, unknown>) : r
      )

      for (const item of items) {
        const pid = String(item.productId ?? item.id ?? '').trim()
        if (pid) activeIds.add(pid)
      }

      if (!items.length || items.length < PAGE_SIZE) break
      if (totalPageCount && page >= totalPageCount) break

      page++
      await new Promise(r => setTimeout(r, 80))
    }
  }

  if (activeIds.size === 0) {
    return NextResponse.json({ error: 'Scan returned 0 active products — aborting to avoid accidental mass delete' }, { status: 400 })
  }

  // ── Step 2: Load all product_ids from DB ────────────────────────────────────
  const dbIds: string[] = []
  let from = 0
  while (true) {
    const { data } = await supabase
      .from('price_list_items')
      .select('product_id')
      .not('product_id', 'is', null)
      .range(from, from + 999)
    if (!data?.length) break
    for (const r of data) dbIds.push(r.product_id)
    if (data.length < 1000) break
    from += 1000
  }

  const discontinuedIds = dbIds.filter(id => !activeIds.has(id))

  if (discontinuedIds.length === 0) {
    return NextResponse.json({ ok: true, scanned: activeIds.size, totalInDb: dbIds.length, deleted: 0 })
  }

  // ── Step 3: Delete discontinued in batches of 500 ───────────────────────────
  let deleted = 0
  for (let i = 0; i < discontinuedIds.length; i += 500) {
    const batch = discontinuedIds.slice(i, i + 500)
    const { error } = await supabase
      .from('price_list_items')
      .delete()
      .in('product_id', batch)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    deleted += batch.length
  }

  // ── Step 4: Update item_count on the global price list ──────────────────────
  const { data: priceList } = await supabase
    .from('price_lists')
    .select('id')
    .eq('is_global', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (priceList) {
    const { count } = await supabase
      .from('price_list_items')
      .select('id', { count: 'exact', head: true })
      .not('product_id', 'is', null)
    await supabase.from('price_lists').update({ item_count: count ?? 0 }).eq('id', priceList.id)
  }

  return NextResponse.json({ ok: true, scanned: activeIds.size, totalInDb: dbIds.length, deleted })
}
