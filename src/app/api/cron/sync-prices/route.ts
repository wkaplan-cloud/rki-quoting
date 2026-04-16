import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const TWINBRU_BASE = process.env.TWINBRU_BASE_URL ?? 'https://api.twinbru.com'
const SUB_KEY      = process.env.TWINBRU_SUBSCRIPTION_KEY ?? ''
const PRICES_KEY   = process.env.TWINBRU_PRICES_KEY ?? ''
const BEARER       = process.env.TWINBRU_BEARER_TOKEN ?? ''
const BATCH        = 50   // confirmed max per /prices/products call

function twinbruHeaders(usesPricesKey = false) {
  return {
    'Ocp-Apim-Subscription-Key': usesPricesKey ? PRICES_KEY : SUB_KEY,
    'Authorization': `Bearer ${BEARER}`,
    'Api-Version': 'v1',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

async function fetchPriceBatch(productIds: number[]): Promise<{ productId: number; price: number }[]> {
  const res = await fetch(`${TWINBRU_BASE}/prices/products`, {
    method: 'POST',
    headers: twinbruHeaders(true),
    body: JSON.stringify({ productIds, currency: 'ZAR' }),
  })
  if (!res.ok) throw new Error(`Twinbru prices API ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)
  const data = await res.json()

  // Response shape confirmed: { results: [{ item: { productId, price, ... } }] }
  const items: Record<string, unknown>[] =
    data?.results?.map((r: Record<string, unknown>) => r?.item ?? r) ?? []

  return items.flatMap(item => {
    const pid = item?.productId as number | undefined
    const price = item?.price as number | undefined  // confirmed field name
    if (pid == null || price == null) return []
    return [{ productId: pid, price }]
  })
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Insert a running log entry
  const { data: logRow } = await supabase
    .from('twinbru_sync_log')
    .insert({ sync_type: 'prices', triggered_by: 'cron' })
    .select('id')
    .single()
  const logId = logRow?.id

  try {
    // Load all product IDs + current prices from price_list_items (paginate past 1000 row limit)
    const items: { id: string; product_id: string; price_zar: number | null; price_list_id: string }[] = []
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data, error: fetchErr } = await supabase
        .from('price_list_items')
        .select('id, product_id, price_zar, price_list_id')
        .not('product_id', 'is', null)
        .range(from, from + PAGE - 1)
      if (fetchErr) throw new Error(fetchErr.message)
      if (!data?.length) break
      items.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }

    if (!items.length) {
      await supabase.from('twinbru_sync_log').update({
        status: 'ok', completed_at: new Date().toISOString(),
        items_checked: 0, items_changed: 0,
      }).eq('id', logId)
      return NextResponse.json({ ok: true, checked: 0, changed: 0 })
    }

    // Build a map: productId (number) → { rowId, currentPrice, priceListId }
    const rowMap = new Map<number, { rowId: string; currentPrice: number | null; priceListId: string }>()
    for (const item of items) {
      const pid = parseInt(item.product_id, 10)
      if (!isNaN(pid)) rowMap.set(pid, { rowId: item.id, currentPrice: item.price_zar, priceListId: item.price_list_id })
    }

    const productIds = Array.from(rowMap.keys())
    const updates: { id: string; price_list_id: string; price_zar: number; price_updated_at: string }[] = []

    // Fetch prices from Twinbru — 5 concurrent batches of 50 to stay within time limits
    const PARALLEL = 5
    for (let i = 0; i < productIds.length; i += BATCH * PARALLEL) {
      const batchSlices: number[][] = []
      for (let j = i; j < Math.min(i + BATCH * PARALLEL, productIds.length); j += BATCH) {
        batchSlices.push(productIds.slice(j, j + BATCH))
      }
      const priceGroups = await Promise.all(batchSlices.map(b => fetchPriceBatch(b)))

      const now = new Date().toISOString()
      for (const prices of priceGroups) {
        for (const { productId, price } of prices) {
          const row = rowMap.get(productId)
          if (!row) continue
          // Explicitly convert to number (API may return strings despite the type assertion)
          // Round to 2dp to avoid floating-point false-positives
          const apiPrice = Math.round(Number(price) * 100) / 100
          if (isNaN(apiPrice)) continue
          const dbPrice = row.currentPrice != null ? Math.round(row.currentPrice * 100) / 100 : null
          if (dbPrice !== apiPrice) {
            updates.push({ id: row.rowId, price_list_id: row.priceListId, price_zar: apiPrice, price_updated_at: now })
          }
        }
      }

      // Brief pause between groups to avoid rate limiting
      if (i + BATCH * PARALLEL < productIds.length) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    // Write changed prices to Supabase in batches of 500
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500)
      const { error: upsertErr } = await supabase
        .from('price_list_items')
        .upsert(batch, { onConflict: 'id' })
      if (upsertErr) throw new Error(`Price upsert failed: ${upsertErr.message}`)
    }

    // Mark log complete
    await supabase.from('twinbru_sync_log').update({
      status: 'ok',
      completed_at: new Date().toISOString(),
      items_checked: productIds.length,
      items_changed: updates.length,
    }).eq('id', logId)

    return NextResponse.json({ ok: true, checked: productIds.length, changed: updates.length })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('twinbru_sync_log').update({
      status: 'error', completed_at: new Date().toISOString(), error_message: msg,
    }).eq('id', logId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
