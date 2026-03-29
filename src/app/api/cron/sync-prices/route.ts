import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const TWINBRU_BASE = process.env.TWINBRU_BASE_URL ?? 'https://api.twinbru.com'
const SUB_KEY      = process.env.TWINBRU_SUBSCRIPTION_KEY ?? ''
const PRICES_KEY   = process.env.TWINBRU_PRICES_KEY ?? ''
const BEARER       = process.env.TWINBRU_BEARER_TOKEN ?? ''
const BATCH        = 100  // max product IDs per /prices/products call

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

  // Unwrap various response shapes
  const items: Record<string, unknown>[] = (
    data?.results?.map((r: Record<string, unknown>) => r?.item ?? r) ??
    data?.items ??
    data?.data ??
    (Array.isArray(data) ? data : [])
  )

  return items.flatMap(item => {
    const pid = item?.productId as number | undefined
    const price = (item?.price ?? item?.salesPrice ?? item?.amount ?? item?.value) as number | undefined
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
    const items: { id: string; product_id: string; price_zar: number | null }[] = []
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data, error: fetchErr } = await supabase
        .from('price_list_items')
        .select('id, product_id, price_zar')
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

    // Build a map: productId (number) → { rowId, currentPrice }
    const rowMap = new Map<number, { rowId: string; currentPrice: number | null }>()
    for (const item of items) {
      const pid = parseInt(item.product_id, 10)
      if (!isNaN(pid)) rowMap.set(pid, { rowId: item.id, currentPrice: item.price_zar })
    }

    const productIds = Array.from(rowMap.keys())
    const updates: { id: string; price_zar: number; price_updated_at: string }[] = []

    // Fetch prices from Twinbru in batches of 100
    for (let i = 0; i < productIds.length; i += BATCH) {
      const batch = productIds.slice(i, i + BATCH)
      const prices = await fetchPriceBatch(batch)

      const now = new Date().toISOString()
      for (const { productId, price } of prices) {
        const row = rowMap.get(productId)
        if (!row) continue
        // Only update if the price actually changed
        if (row.currentPrice !== price) {
          updates.push({ id: row.rowId, price_zar: price, price_updated_at: now })
        }
      }

      // Small pause to avoid hammering the API
      if (i + BATCH < productIds.length) {
        await new Promise(r => setTimeout(r, 120))
      }
    }

    // Write changed prices to Supabase in batches of 500
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500)
      await supabase.from('price_list_items').upsert(batch)
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
