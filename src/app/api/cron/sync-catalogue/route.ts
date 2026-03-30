import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const TWINBRU_BASE = process.env.TWINBRU_BASE_URL ?? 'https://api.twinbru.com'
const SUB_KEY      = process.env.TWINBRU_SUBSCRIPTION_KEY ?? ''
const BEARER       = process.env.TWINBRU_BEARER_TOKEN ?? ''
const PAGE_SIZE    = 50

function twinbruHeaders() {
  return {
    'Ocp-Apim-Subscription-Key': SUB_KEY,
    'Authorization': `Bearer ${BEARER}`,
    'Api-Version': 'v1',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

function buildRecord(item: Record<string, unknown>) {
  return {
    brand:       String(item.brand        ?? item.brandName        ?? '').trim() || null,
    collection:  String(item.collectionName ?? '').trim() || null,
    design:      String(item.designName   ?? '').trim() || null,
    colour:      String(item.productName  ?? '').trim() || null,
    sku:         String(item.sku          ?? item.productId ?? '').trim() || null,
    product_id:  String(item.productId    ?? '').trim() || null,
  }
}

function unwrap(data: Record<string, unknown>): { items: Record<string, unknown>[]; total: number } {
  const total = Number(
    data.totalItemCount ?? data.total ?? data.totalItems ?? data.count ?? 0
  )
  const results = data.results
  if (Array.isArray(results)) {
    return {
      items: results.map((r: Record<string, unknown>) =>
        (r && typeof r === 'object' && 'item' in r) ? (r.item as Record<string, unknown>) : r
      ),
      total,
    }
  }
  for (const key of ['items', 'data', 'products', 'values']) {
    if (Array.isArray(data[key])) return { items: data[key] as Record<string, unknown>[], total }
  }
  return { items: [], total }
}

export async function GET(req: NextRequest) {
  // Accepts both cron (Authorization header) and manual admin trigger (same header)
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggeredBy = req.nextUrl.searchParams.get('trigger') ?? 'cron'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Find the global Twinbru price list
  const { data: priceList } = await supabase
    .from('price_lists')
    .select('id')
    .eq('is_global', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!priceList) {
    return NextResponse.json({ error: 'No global price list found. Create one first.' }, { status: 400 })
  }
  const priceListId = priceList.id

  // Insert running log entry
  const { data: logRow } = await supabase
    .from('twinbru_sync_log')
    .insert({ sync_type: 'catalogue', triggered_by: triggeredBy })
    .select('id')
    .single()
  const logId = logRow?.id

  try {
    // Load existing product_ids so we can skip already-known products
    const { data: existing } = await supabase
      .from('price_list_items')
      .select('product_id')
      .eq('price_list_id', priceListId)
      .not('product_id', 'is', null)

    const knownIds = new Set((existing ?? []).map(r => r.product_id))

    let page = 1
    let totalFetched = 0
    let added = 0
    let hasMore = true
    const newItems: Record<string, unknown>[] = []

    while (hasMore) {
      // Retry up to 3 times on 500
      let res: Response | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch(`${TWINBRU_BASE}/products/`, {
          method: 'POST',
          headers: twinbruHeaders(),
          body: JSON.stringify({ page, pageSize: PAGE_SIZE, filter: '' }),
        })
        if (res.status !== 500) break
        await new Promise(r => setTimeout(r, 1500))
      }
      if (!res || !res.ok) {
        const body = res ? await res.text().then(t => t.slice(0, 200)) : 'no response'
        throw new Error(`Twinbru products API ${res?.status ?? 0}: ${body}`)
      }

      const data = await res.json()
      const { items, total } = unwrap(data)

      if (items.length === 0) break
      totalFetched += items.length

      for (const item of items) {
        const pid = String(item.productId ?? '').trim()
        if (!pid || knownIds.has(pid)) continue
        knownIds.add(pid)
        newItems.push({ ...buildRecord(item), price_list_id: priceListId })
        added++
      }

      // Flush to DB every 500 new items to avoid huge payloads
      if (newItems.length >= 500) {
        await supabase.from('price_list_items').insert(newItems.splice(0))
      }

      hasMore = items.length === PAGE_SIZE && totalFetched < (total || Infinity)
      page++

      if (hasMore) await new Promise(r => setTimeout(r, 120))
    }

    // Insert any remaining
    if (newItems.length > 0) {
      await supabase.from('price_list_items').insert(newItems)
    }

    // Update item_count on the price list
    const { count } = await supabase
      .from('price_list_items')
      .select('id', { count: 'exact', head: true })
      .eq('price_list_id', priceListId)

    await supabase
      .from('price_lists')
      .update({ item_count: count ?? 0 })
      .eq('id', priceListId)

    await supabase.from('twinbru_sync_log').update({
      status: 'ok',
      completed_at: new Date().toISOString(),
      items_checked: totalFetched,
      items_added: added,
    }).eq('id', logId)

    return NextResponse.json({ ok: true, checked: totalFetched, added })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('twinbru_sync_log').update({
      status: 'error', completed_at: new Date().toISOString(), error_message: msg,
    }).eq('id', logId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
