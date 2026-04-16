import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const TWINBRU_BASE = process.env.TWINBRU_BASE_URL ?? 'https://api.twinbru.com'
const SUB_KEY      = process.env.TWINBRU_SUBSCRIPTION_KEY ?? ''
const BEARER       = process.env.TWINBRU_BEARER_TOKEN ?? ''
const PAGE_SIZE    = 50  // confirmed API max

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
  const props = (typeof item.properties === 'object' && item.properties !== null)
    ? item.properties as Record<string, unknown>
    : item
  const fullWidth    = props.selvedge_full_width_cm    ?? item.selvedge_full_width_cm    ?? null
  const useableWidth = props.selvedge_useable_width_cm ?? item.selvedge_useable_width_cm ?? null
  return {
    brand:            String(item.brand ?? item.brandName ?? '').trim() || null,
    collection:       String(item.collectionName ?? '').trim() || null,
    design:           String(item.designName ?? '').trim() || null,
    colour:           String(item.productName ?? '').trim() || null,
    sku:              String(item.sku ?? item.productId ?? '').trim() || null,
    product_id:       String(item.productId ?? '').trim() || null,
    full_width_cm:    fullWidth    != null ? Number(fullWidth)    : null,
    useable_width_cm: useableWidth != null ? Number(useableWidth) : null,
  }
}

// Confirmed response shape from working Python script:
// { results: [...], totalItemCount: N } or { results: [...], total: N }
function extractProducts(data: unknown): { items: Record<string, unknown>[], total: number } {
  if (typeof data !== 'object' || data === null) return { items: [], total: 0 }
  const obj = data as Record<string, unknown>
  const total = Number(obj.totalItemCount ?? obj.total ?? obj.totalItems ?? 0)
  const raw = obj.results ?? obj.items ?? obj.products
  const items = Array.isArray(raw) ? raw as Record<string, unknown>[] : []
  return { items, total }
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

  const { data: logRow } = await supabase
    .from('twinbru_sync_log')
    .insert({ sync_type: 'load', triggered_by: triggeredBy })
    .select('id')
    .single()
  const logId = logRow?.id

  try {
    // Resume from previous partial run if available (RESUME:page)
    const { data: resumeLog } = await supabase
      .from('twinbru_sync_log')
      .select('error_message')
      .eq('sync_type', 'load')
      .eq('status', 'ok')
      .like('error_message', 'RESUME:%')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    let startPage = 1
    if (resumeLog?.error_message) {
      startPage = parseInt(resumeLog.error_message.slice(7), 10) || 1
    }

    // Load existing product_ids to skip duplicates
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

    const TIME_LIMIT_MS = 240_000  // 4 min
    const startTime = Date.now()
    let page = startPage
    let queryTotal = 0
    let queryFetched = 0
    let totalFetched = 0
    let added = 0
    const batch: Record<string, unknown>[] = []
    let timedOut = false

    while (true) {
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        timedOut = true
        break
      }

      const res = await fetch(`${TWINBRU_BASE}/products/`, {
        method: 'POST',
        headers: twinbruHeaders(),
        body: JSON.stringify({ page, pageSize: PAGE_SIZE, filter: '' }),
      })

      const rawText = await res.text()
      if (!res.ok) {
        throw new Error(`Products API ${res.status} (page ${page}): ${rawText.slice(0, 200)}`)
      }

      let data: unknown = {}
      try {
        data = rawText ? JSON.parse(rawText) : {}
      } catch {
        throw new Error(`Products API returned non-JSON (page ${page}): ${rawText.slice(0, 200)}`)
      }

      const { items, total } = extractProducts(data)

      if (queryTotal === 0 && total) queryTotal = total
      queryFetched += items.length
      totalFetched += items.length

      for (const item of items) {
        const pid = String(item.productId ?? item.id ?? '').trim()
        if (!pid || knownIds.has(pid)) continue
        knownIds.add(pid)
        batch.push({ ...buildRecord(item), price_list_id: priceListId })
        added++
      }

      if (batch.length >= 500) {
        await supabase.from('price_list_items').insert(batch.splice(0))
      }

      // Stop when: no items, last page (under page size), or all fetched
      if (!items.length || items.length < PAGE_SIZE) break
      if (queryTotal && queryFetched >= queryTotal) break

      page++
      await new Promise(r => setTimeout(r, 80))
    }

    // Flush remaining
    if (batch.length > 0) {
      await supabase.from('price_list_items').insert(batch)
    }

    if (added > 0) {
      const { count } = await supabase
        .from('price_list_items')
        .select('id', { count: 'exact', head: true })
        .eq('price_list_id', priceListId)
      await supabase.from('price_lists').update({ item_count: count ?? 0 }).eq('id', priceListId)
    }

    if (timedOut) {
      await supabase.from('twinbru_sync_log').update({
        status: 'ok',
        completed_at: new Date().toISOString(),
        items_checked: totalFetched,
        items_added: added,
        error_message: `RESUME:${page}`,
      }).eq('id', logId)
      return NextResponse.json({ ok: true, partial: true, checked: totalFetched, added })
    }

    await supabase.from('twinbru_sync_log').update({
      status: 'ok',
      completed_at: new Date().toISOString(),
      items_checked: totalFetched,
      items_added: added,
    }).eq('id', logId)

    return NextResponse.json({ ok: true, partial: false, checked: totalFetched, added })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('twinbru_sync_log').update({
      status: 'error', completed_at: new Date().toISOString(), error_message: msg,
    }).eq('id', logId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
