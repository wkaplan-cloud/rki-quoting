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
  // Width fields live inside item.properties (from GET /products/{id} and changefeed)
  const props = (typeof item.properties === 'object' && item.properties !== null)
    ? item.properties as Record<string, unknown>
    : item
  const fullWidth    = props.selvedge_full_width_cm    ?? item.selvedge_full_width_cm    ?? null
  const useableWidth = props.selvedge_useable_width_cm ?? item.selvedge_useable_width_cm ?? null
  return {
    brand:            String(item.brand        ?? '').trim() || null,  // confirmed: field is "brand", no "brandName"
    collection:       String(item.collectionName ?? '').trim() || null,
    design:           String(item.designName   ?? '').trim() || null,
    colour:           String(item.productName  ?? '').trim() || null,
    sku:              String(item.sku          ?? item.productId ?? '').trim() || null,
    product_id:       String(item.productId    ?? '').trim() || null,
    full_width_cm:    fullWidth    != null ? Number(fullWidth)    : null,
    useable_width_cm: useableWidth != null ? Number(useableWidth) : null,
  }
}

function extractItems(data: unknown): Record<string, unknown>[] {
  // Plain array response (ODS can return items directly)
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (typeof data !== 'object' || data === null) return []
  const obj = data as Record<string, unknown>
  // results[].item wrapper (prices API shape)
  if (Array.isArray(obj.results)) {
    return (obj.results as Record<string, unknown>[]).map(r =>
      (r && typeof r === 'object' && 'item' in r) ? (r.item as Record<string, unknown>) : r
    )
  }
  // Standard wrapper keys including OData "value"
  for (const key of ['value', 'items', 'data', 'products', 'values']) {
    if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[]
  }
  return []
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggeredBy = req.nextUrl.searchParams.get('trigger') ?? 'cron'
  // backfill=true → fetch all products from the beginning and upsert widths
  const isBackfill  = req.nextUrl.searchParams.get('backfill') === 'true'

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
    .insert({ sync_type: isBackfill ? 'backfill' : 'catalogue', triggered_by: triggeredBy })
    .select('id')
    .single()
  const logId = logRow?.id

  try {
    // ── BACKFILL MODE ────────────────────────────────────────────────────────
    // Loads all product_ids from DB, fetches each via GET /products/{id}
    // concurrently (30 at a time), upserts width fields back.
    if (isBackfill) {
      // Load only product_ids that still need widths populated
      const allProductIds: string[] = []
      let from = 0
      while (true) {
        const { data: rows } = await supabase
          .from('price_list_items')
          .select('product_id')
          .eq('price_list_id', priceListId)
          .not('product_id', 'is', null)
          .is('full_width_cm', null)
          .range(from, from + 999)
        if (!rows?.length) break
        for (const r of rows) allProductIds.push(r.product_id)
        if (rows.length < 1000) break
        from += 1000
      }

      const CONCURRENCY = 50
      let updated = 0

      for (let i = 0; i < allProductIds.length; i += CONCURRENCY) {
        const chunk = allProductIds.slice(i, i + CONCURRENCY)
        const results = await Promise.all(
          chunk.map(async (pid) => {
            try {
              const res = await fetch(`${TWINBRU_BASE}/products/${pid}`, {
                headers: twinbruHeaders(),
              })
              if (!res.ok) return null
              const item = await res.json()
              const record = buildRecord(item)
              return { ...record, product_id: String(pid), price_list_id: priceListId }
            } catch {
              return null
            }
          })
        )

        const valid = results.filter((r) => r !== null) as Record<string, unknown>[]
        if (valid.length > 0) {
          await supabase.from('price_list_items')
            .upsert(valid, { onConflict: 'product_id,price_list_id' })
          updated += valid.length
        }
      }

      await supabase.from('twinbru_sync_log').update({
        status: 'ok',
        completed_at: new Date().toISOString(),
        items_checked: allProductIds.length,
        items_added: 0,
      }).eq('id', logId)

      return NextResponse.json({ ok: true, checked: allProductIds.length, updated })
    }

    // ── NORMAL SYNC MODE ─────────────────────────────────────────────────────
    // The ODS changefeed scans through ALL product ranges (not just changed ones),
    // returning empty batches for unchanged ranges. This can mean hundreds of empty
    // pages before finding any data, easily timing out a single function invocation.
    //
    // Strategy: time-box each run to 4 min. Save the continuation token as RESUME:<token>
    // in error_message so the next cron run picks up exactly where this one left off.

    // Look for a previous partial run to resume from
    const { data: resumeLog } = await supabase
      .from('twinbru_sync_log')
      .select('error_message, completed_at')
      .eq('sync_type', 'catalogue')
      .eq('status', 'ok')
      .like('error_message', 'RESUME:%')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()
    const resumeToken = resumeLog?.error_message?.slice(7) ?? null  // strip "RESUME:"

    // For sinceDate, use the last FULLY completed sync (no RESUME token)
    const { data: lastFullSync } = await supabase
      .from('twinbru_sync_log')
      .select('completed_at')
      .eq('sync_type', 'catalogue')
      .eq('status', 'ok')
      .is('error_message', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()
    const sinceDate = lastFullSync?.completed_at ?? '2026-03-19T00:00:00Z'

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

    // ODS Changefeed — paginated via ODS-Continuation header
    // Start from the resume token if we have one, otherwise start fresh
    let continuation: string | null = resumeToken
    let totalFetched = 0
    let added = 0
    const batch: Record<string, unknown>[] = []
    const startTime = Date.now()
    const TIME_LIMIT_MS = 240_000  // 4 min — leaves buffer before Vercel's 5-min kill

    while (true) {
      // Time-box: if we're approaching the limit, save progress and exit cleanly
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        if (batch.length > 0) await supabase.from('price_list_items').insert(batch.splice(0))
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
          error_message: continuation ? `RESUME:${continuation}` : null,
        }).eq('id', logId)
        return NextResponse.json({ ok: true, partial: true, since: sinceDate, checked: totalFetched, added })
      }

      // Confirmed correct endpoint from working Python script: POST /changefeed
      // Body carries the date + pageSize; ODS-Continuation header used for paging
      const hdrs: Record<string, string> = {
        ...twinbruHeaders(),
        ...(continuation ? { 'ODS-Continuation': continuation } : {}),
      }

      const res = await fetch(`${TWINBRU_BASE}/changefeed`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ date: sinceDate, pageSize: 500 }),
      })

      const nextContinuation = res.headers.get('ODS-Continuation')
      const rawText = await res.text()
      if (!res.ok) {
        if (res.status === 404) {
          // Changefeed endpoint not available — log as ok with a note
          await supabase.from('twinbru_sync_log').update({
            status: 'ok',
            completed_at: new Date().toISOString(),
            items_checked: 0,
            items_added: 0,
            error_message: 'UNAVAILABLE: Changefeed endpoint returned 404. Use Load Full Catalogue to sync new fabrics.',
          }).eq('id', logId)
          return NextResponse.json({ ok: true, unavailable: true, checked: 0, added: 0 })
        }
        throw new Error(`Changefeed ${res.status}: ${rawText.slice(0, 300)}`)
      }
      let data: unknown = {}
      try {
        data = rawText ? JSON.parse(rawText) : {}
      } catch {
        throw new Error(`Changefeed returned non-JSON (${res.status}): ${rawText.slice(0, 300)}`)
      }
      const items = extractItems(data)

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

      if (nextContinuation) continuation = nextContinuation
      // Stop when empty AND (we've received data OR there's no token left to follow)
      if (items.length === 0 && (totalFetched > 0 || !continuation)) break
      await new Promise(r => setTimeout(r, 100))
    }

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

    // Fully completed — no RESUME token needed
    await supabase.from('twinbru_sync_log').update({
      status: 'ok',
      completed_at: new Date().toISOString(),
      items_checked: totalFetched,
      items_added: added,
    }).eq('id', logId)

    return NextResponse.json({ ok: true, since: sinceDate, checked: totalFetched, added })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('twinbru_sync_log').update({
      status: 'error', completed_at: new Date().toISOString(), error_message: msg,
    }).eq('id', logId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
