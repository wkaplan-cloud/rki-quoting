import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const TWINBRU_BASE = process.env.TWINBRU_BASE_URL ?? 'https://api.twinbru.com'
const SUB_KEY      = process.env.TWINBRU_SUBSCRIPTION_KEY ?? ''
const BEARER       = process.env.TWINBRU_BEARER_TOKEN ?? ''

// Date of the original CSV import — only look for fabrics added after this
const CSV_EXPORT_DATE = '2026-03-19T00:00:00Z'

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
    // Use the last successful catalogue sync date so we only fetch new products.
    // Falls back to the CSV export date so we don't re-import what we already have.
    const { data: lastSync } = await supabase
      .from('twinbru_sync_log')
      .select('completed_at')
      .eq('sync_type', 'catalogue')
      .eq('status', 'ok')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    const sinceDate = lastSync?.completed_at ?? CSV_EXPORT_DATE

    // ── Changefeed: only returns products added/changed since sinceDate ──────
    let token: string | null = null
    let totalFetched = 0
    let added = 0
    const newItems: Record<string, unknown>[] = []

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

    // Page through changefeed
    while (true) {
      const hdrs = twinbruHeaders(token ? { 'ODS-Continuation': token } : {})
      const res = await fetch(`${TWINBRU_BASE}/changefeed`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ date: sinceDate, pageSize: 500 }),
      })

      if (res.status === 404) {
        // Changefeed not available on this account — return informative message
        await supabase.from('twinbru_sync_log').update({
          status: 'error',
          completed_at: new Date().toISOString(),
          error_message: 'Changefeed endpoint not available (404). Contact Twinbru to enable it.',
        }).eq('id', logId)
        return NextResponse.json({
          error: 'Changefeed not available on this API account. Contact Twinbru support to enable the changefeed endpoint.',
        }, { status: 400 })
      }

      if (!res.ok) {
        throw new Error(`Changefeed API ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)
      }

      const newToken = res.headers.get('ODS-Continuation') ?? res.headers.get('ods-continuation')
      const data = await res.json()
      const items = extractItems(data)

      totalFetched += items.length

      for (const item of items) {
        const pid = String(item.productId ?? '').trim()
        if (!pid || knownIds.has(pid)) continue
        knownIds.add(pid)
        newItems.push({ ...buildRecord(item), price_list_id: priceListId })
        added++
      }

      if (!newToken || items.length === 0) break
      token = newToken
      await new Promise(r => setTimeout(r, 100))
    }

    // Insert new fabrics
    if (newItems.length > 0) {
      for (let i = 0; i < newItems.length; i += 500) {
        await supabase.from('price_list_items').insert(newItems.slice(i, i + 500))
      }
      // Update item_count
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
