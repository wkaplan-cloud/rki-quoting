import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const TWINBRU_BASE = process.env.TWINBRU_BASE_URL ?? 'https://api.twinbru.com'
const SUB_KEY      = process.env.TWINBRU_SUBSCRIPTION_KEY ?? ''
const BEARER       = process.env.TWINBRU_BEARER_TOKEN ?? ''
const PAGE_SIZE    = 50  // confirmed API max

// Strategy confirmed by Robin (Twinbru):
// Loop years 2000→current, filter: "status.eq.RN/launch.in(YYYYxx-YYYYxx)"
// Each year stays under the 10,000 result hard limit.
// Pagination via totalPageCount in response.
// RESUME token: "RESUME:<year>:<page>"

const START_YEAR = 2000
const END_YEAR   = new Date().getFullYear()

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
  // Robin (Twinbru) confirmed: use renditions[].key directly as the CDN path.
  // Prefer a "large" or "medium" rendition; fall back to first available.
  const renditions = Array.isArray(item.renditions) ? item.renditions as Record<string, unknown>[] : []
  const rendition  = renditions.find(r => /large/i.test(String(r.renditionType ?? '')))
    ?? renditions.find(r => /preview/i.test(String(r.renditionType ?? '')))
    ?? renditions.find(r => /thumbnail/i.test(String(r.renditionType ?? '')))
    ?? renditions[0] ?? null
  const imageUrl   = rendition?.key
    ? `https://cdn.twinbru.com/ods/assets/${rendition.key}`
    : null
  return {
    brand:            String(item.brand ?? item.brandName ?? '').trim() || null,
    collection:       String(item.collectionName ?? '').trim() || null,
    design:           String(item.designName ?? '').trim() || null,
    colour:           String(item.productName ?? '').trim() || null,
    sku:              String(item.sku ?? item.productId ?? '').trim() || null,
    product_id:       String(item.productId ?? '').trim() || null,
    full_width_cm:    fullWidth    != null ? Number(fullWidth)    : null,
    useable_width_cm: useableWidth != null ? Number(useableWidth) : null,
    image_url:        imageUrl ? String(imageUrl) : null,
  }
}

function extractProducts(data: unknown): { items: Record<string, unknown>[], totalPageCount: number } {
  if (typeof data !== 'object' || data === null) return { items: [], totalPageCount: 0 }
  const obj = data as Record<string, unknown>
  const totalPageCount = Number(obj.totalPageCount ?? obj.totalPages ?? 0)
  const raw = obj.results ?? obj.items ?? obj.products
  const rawItems = Array.isArray(raw) ? raw as Record<string, unknown>[] : []
  // Unwrap results[].item wrapper if present
  const items = rawItems.map(r =>
    (r && typeof r === 'object' && 'item' in r) ? (r.item as Record<string, unknown>) : r
  )
  return { items, totalPageCount }
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
    // ── Resolve resume position ───────────────────────────────────────────────
    const useResume = triggeredBy === 'cron' || triggeredBy === 'continue'
    let startYear = START_YEAR
    let startPage = 1

    if (useResume) {
      const { data: resumeLog } = await supabase
        .from('twinbru_sync_log')
        .select('error_message')
        .eq('sync_type', 'load')
        .eq('status', 'ok')
        .like('error_message', 'RESUME:%')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      if (resumeLog?.error_message) {
        const parts = resumeLog.error_message.slice(7).split(':')
        const year = parseInt(parts[0], 10)
        const page = parseInt(parts[1], 10)
        if (!isNaN(year)) startYear = year
        if (!isNaN(page)) startPage = page
      }
    }

    // ── Load existing product_ids to skip duplicates ──────────────────────────
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

    // ── Year-by-year scan ─────────────────────────────────────────────────────
    const TIME_LIMIT_MS = 240_000
    const startTime     = Date.now()
    let totalFetched    = 0
    let added           = 0
    const batch: Record<string, unknown>[] = []
    let timedOut        = false
    let resumeToken: string | null = null

    for (let year = startYear; year <= END_YEAR; year++) {
      const filter = `status.eq.RN/launch.in(${year}00-${year}99)`
      let page           = year === startYear ? startPage : 1
      let totalPageCount = 0

      while (true) {
        if (Date.now() - startTime > TIME_LIMIT_MS) {
          timedOut = true
          resumeToken = `RESUME:${year}:${page}`
          break
        }

        const res = await fetch(`${TWINBRU_BASE}/products/`, {
          method: 'POST',
          headers: twinbruHeaders(),
          body: JSON.stringify({ page, pageSize: PAGE_SIZE, filter }),
        })
        const rawText = await res.text()

        if (res.status !== 200) {
          if (res.status === 404 || res.status === 500) break
          throw new Error(`Products API ${res.status} (year ${year} page ${page}): ${rawText.slice(0, 200)}`)
        }

        let data: unknown = {}
        try { data = rawText ? JSON.parse(rawText) : {} } catch {
          throw new Error(`Products API non-JSON (year ${year} page ${page}): ${rawText.slice(0, 200)}`)
        }

        const { items, totalPageCount: tpc } = extractProducts(data)
        if (totalPageCount === 0 && tpc) totalPageCount = tpc
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

        if (!items.length || items.length < PAGE_SIZE) break
        if (totalPageCount && page >= totalPageCount) break

        page++
        await new Promise(r => setTimeout(r, 80))
      }

      if (timedOut) break
    }

    // ── Flush + update counts ─────────────────────────────────────────────────
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

    if (timedOut && resumeToken) {
      await supabase.from('twinbru_sync_log').update({
        status: 'ok',
        completed_at: new Date().toISOString(),
        items_checked: totalFetched,
        items_added: added,
        error_message: resumeToken,
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
