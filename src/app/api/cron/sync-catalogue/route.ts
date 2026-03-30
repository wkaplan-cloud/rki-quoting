import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const TWINBRU_BASE = process.env.TWINBRU_BASE_URL ?? 'https://api.twinbru.com'
const SUB_KEY      = process.env.TWINBRU_SUBSCRIPTION_KEY ?? ''
const BEARER       = process.env.TWINBRU_BEARER_TOKEN ?? ''


function twinbruHeaders(extra: Record<string, string> = {}) {
  return {
    'Ocp-Apim-Subscription-Key': SUB_KEY,
    'Authorization': `Bearer ${BEARER}`,
    'Api-Version': 'v1',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...extra,
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

function extractItems(data: Record<string, unknown>): Record<string, unknown>[] {
  const results = data.results
  if (Array.isArray(results)) {
    return results.map((r: Record<string, unknown>) =>
      (r && typeof r === 'object' && 'item' in r) ? (r.item as Record<string, unknown>) : r
    )
  }
  for (const key of ['items', 'data', 'products', 'values']) {
    if (Array.isArray(data[key])) return data[key] as Record<string, unknown>[]
  }
  return []
}

export async function GET(req: NextRequest) {
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
    return NextResponse.json({ error: 'No global price list found.' }, { status: 400 })
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
    // Get the highest product_id already in our database.
    // Twinbru assigns sequential numeric IDs so any new fabric will have a higher ID.
    // We filter the API with productId.gt.{maxId} — only new products come back,
    // regardless of how large the full catalogue is.
    const { data: maxRow } = await supabase
      .from('price_list_items')
      .select('product_id')
      .eq('price_list_id', priceListId)
      .not('product_id', 'is', null)
      .order('product_id', { ascending: false })
      .limit(1)
      .single()

    const maxProductId = maxRow ? parseInt(maxRow.product_id, 10) : 0

    let page = 1
    let totalFetched = 0
    let added = 0
    let hasMore = true
    const newItems: Record<string, unknown>[] = []

    // Filter to only products with ID higher than our current max
    const filter = maxProductId > 0 ? `productId.gt.${maxProductId}` : ''

    while (hasMore) {
      const res = await fetch(`${TWINBRU_BASE}/products/`, {
        method: 'POST',
        headers: twinbruHeaders(),
        body: JSON.stringify({ page, pageSize: 50, filter }),
      })

      if (!res.ok) {
        throw new Error(`Products API ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)
      }

      const data = await res.json()
      const items = extractItems(data)
      const total = Number(data.totalItemCount ?? data.total ?? 0)

      if (items.length === 0) break
      totalFetched += items.length

      for (const item of items) {
        const pid = String(item.productId ?? '').trim()
        if (!pid) continue
        newItems.push({ ...buildRecord(item), price_list_id: priceListId })
        added++
      }

      // Flush every 500
      if (newItems.length >= 500) {
        await supabase.from('price_list_items').insert(newItems.splice(0))
      }

      hasMore = items.length === 50 && totalFetched < (total || Infinity)
      page++
      if (hasMore) await new Promise(r => setTimeout(r, 120))
    }

    // Insert any remaining
    if (newItems.length > 0) {
      await supabase.from('price_list_items').insert(newItems)
    }

    // Update item_count
    if (added > 0) {
      const { count } = await supabase
        .from('price_list_items')
        .select('id', { count: 'exact', head: true })
        .eq('price_list_id', priceListId)
      await supabase.from('price_lists').update({ item_count: count ?? 0 }).eq('id', priceListId)
    }

    await supabase.from('twinbru_sync_log').update({
      status: 'ok',
      completed_at: new Date().toISOString(),
      items_checked: totalFetched,
      items_added: added,
    }).eq('id', logId)

    return NextResponse.json({
      ok: true,
      maxProductId,
      checked: totalFetched,
      added,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('twinbru_sync_log').update({
      status: 'error', completed_at: new Date().toISOString(), error_message: msg,
    }).eq('id', logId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
