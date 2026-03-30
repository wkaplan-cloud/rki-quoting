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
    // Use last successful sync date so we only fetch products modified since then.
    // Falls back to the CSV export date on first run.
    const { data: lastSync } = await supabase
      .from('twinbru_sync_log')
      .select('completed_at')
      .eq('sync_type', 'catalogue')
      .eq('status', 'ok')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    const sinceDate = lastSync?.completed_at ?? '2026-03-19T00:00:00Z'

    // Load existing product_ids to skip duplicates (paginated past 1000-row limit)
    const knownIds = new Set<string>()
    let from = 0
    while (true) {
      const { data: existing } = await supabase
        .from('price_list_items')
        .select('product_id')
        .eq('price_list_id', priceListId)
        .not('product_id', 'is', null)
        .range(from, from + 999)
      if (!existing?.length) break
      for (const r of existing) knownIds.add(r.product_id)
      if (existing.length < 1000) break
      from += 1000
    }

    // ODS Changefeed — GET /ods/item-read/v1/api/items/product/changes
    // Returns only products modified since sinceDate. Paginated via ODS-Continuation header.
    let continuation: string | null = null
    let totalFetched = 0
    let added = 0
    const newItems: Record<string, unknown>[] = []

    while (true) {
      const url = new URL(`${TWINBRU_BASE}/ods/item-read/v1/api/items/product/changes`)
      url.searchParams.set('modifiedSince', sinceDate)
      url.searchParams.set('maxBatchSize', '500')

      const hdrs: Record<string, string> = {
        ...twinbruHeaders(),
        ...(continuation ? { 'ODS-Continuation': continuation } : {}),
      }

      const res = await fetch(url.toString(), { method: 'GET', headers: hdrs })

      if (!res.ok) {
        throw new Error(`Changefeed ${res.status}: ${await res.text().then(t => t.slice(0, 300))}`)
      }

      const nextContinuation = res.headers.get('ODS-Continuation')
      const data = await res.json()
      const items = extractItems(data)

      totalFetched += items.length

      for (const item of items) {
        const pid = String(item.productId ?? item.id ?? '').trim()
        if (!pid || knownIds.has(pid)) continue
        knownIds.add(pid)
        newItems.push({ ...buildRecord(item), price_list_id: priceListId })
        added++
      }

      // Flush every 500
      if (newItems.length >= 500) {
        await supabase.from('price_list_items').insert(newItems.splice(0))
      }

      if (!nextContinuation || items.length === 0) break
      continuation = nextContinuation
      await new Promise(r => setTimeout(r, 100))
    }

    // Insert any remaining
    if (newItems.length > 0) {
      await supabase.from('price_list_items').insert(newItems)
    }

    // Update item_count if anything was added
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
      since: sinceDate,
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
