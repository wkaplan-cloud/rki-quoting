import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET  ?year=2000  → scan one year, return active productIds for that year
// POST { activeProductIds: number[] } → compare against DB, return discontinued count + ids
// DELETE { productIds: string[] } → delete those rows from price_list_items

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

function checkAuth(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

// Scan one year, return all active productIds for that year
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const year = parseInt(req.nextUrl.searchParams.get('year') ?? '0', 10)
  if (!year) return NextResponse.json({ error: 'Missing year param' }, { status: 400 })

  const filter = `status.eq.RN/launch.in(${year}00-${year}99)`
  const activeIds: number[] = []
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
      return NextResponse.json({ error: `Twinbru ${res.status}: ${txt.slice(0, 200)}` }, { status: 502 })
    }

    const data = await res.json().catch(() => null)
    if (!data) break

    const tpc = Number(data.totalPageCount ?? data.totalPages ?? 0)
    if (totalPageCount === 0 && tpc) totalPageCount = tpc

    const raw = data.results ?? data.items ?? data.products ?? []
    const items: Record<string, unknown>[] = Array.isArray(raw) ? raw : []

    for (const item of items) {
      const pid = String(item.productId ?? item.id ?? '').trim()
      if (pid) activeIds.push(pid)
    }

    if (!items.length || items.length < PAGE_SIZE) break
    if (totalPageCount && page >= totalPageCount) break

    page++
    await new Promise(r => setTimeout(r, 80))
  }

  return NextResponse.json({ year, activeIds })
}

// Compare accumulated activeProductIds against DB — return discontinued count + product_ids
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { activeProductIds } = await req.json() as { activeProductIds: string[] }
  if (!Array.isArray(activeProductIds) || activeProductIds.length === 0) {
    return NextResponse.json({ error: 'No active product IDs provided — scan may have returned empty results' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const activeSet = new Set(activeProductIds)

  // Load all product_ids from DB
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

  const discontinuedIds = dbIds.filter(id => !activeSet.has(id))

  return NextResponse.json({
    totalInDb: dbIds.length,
    totalActive: activeProductIds.length,
    discontinuedCount: discontinuedIds.length,
    discontinuedProductIds: discontinuedIds,
  })
}

// Delete discontinued products from price_list_items
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { productIds } = await req.json() as { productIds: string[] }
  if (!Array.isArray(productIds) || !productIds.length) {
    return NextResponse.json({ error: 'Missing productIds' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Delete in batches of 500
  let deleted = 0
  for (let i = 0; i < productIds.length; i += 500) {
    const batch = productIds.slice(i, i + 500)
    const { error } = await supabase
      .from('price_list_items')
      .delete()
      .in('product_id', batch)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    deleted += batch.length
  }

  // Update item_count on the global price list
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

  return NextResponse.json({ deleted })
}
