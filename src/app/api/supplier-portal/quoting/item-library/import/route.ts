import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { fetchAllRows } from '@/lib/fetch-all-rows'

/**
 * Imports a distributor price list into the catalogue (elec_item_library).
 *
 * The browser parses the CSV/Excel file and maps its columns; this receives
 * clean rows. An item is matched on SKU first, then on description, so
 * re-importing next month's list updates prices instead of duplicating the
 * catalogue. Markups someone set by hand on an item are kept.
 */

const MAX_ROWS = 5000

interface ImportRow {
  sku?: string | null
  description: string
  brand?: string | null
  category?: string | null
  unit?: string | null
  cost: number
}

interface ExistingItem {
  id: string
  description: string
  sku: string | null
  default_markup_percent: number | null
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '') || null
const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const body = await req.json() as { rows?: ImportRow[]; markup_percent?: number; supplier_name?: string | null }
    const rows = Array.isArray(body.rows) ? body.rows : []
    if (rows.length === 0) return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `A price list can have at most ${MAX_ROWS} rows — split the file and import it in parts.` }, { status: 400 })
    }
    const markup = typeof body.markup_percent === 'number' && body.markup_percent >= 0 ? body.markup_percent : null
    const supplierName = clean(body.supplier_name)

    const { rows: existing, error: readErr } = await fetchAllRows<ExistingItem>((from, to) =>
      supabaseAdmin
        .from('elec_item_library')
        .select('id, description, sku, default_markup_percent')
        .eq('portal_account_id', account.id)
        .order('id')
        .range(from, to),
    )
    if (readErr) return NextResponse.json({ error: readErr }, { status: 500 })

    const bySku = new Map<string, ExistingItem>()
    const byDesc = new Map<string, ExistingItem>()
    for (const item of existing) {
      if (item.sku) bySku.set(item.sku.toLowerCase(), item)
      byDesc.set(item.description.toLowerCase(), item)
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown>[] = []
    const inserts: Record<string, unknown>[] = []
    // Descriptions are unique per account. Two different SKUs sharing one
    // description in the same file would collide, so the later one gets its
    // SKU appended; a repeated SKU just keeps its last row.
    const seenDesc = new Set<string>()
    const seenSku = new Set<string>()
    let skipped = 0

    for (const raw of rows) {
      const description = clean(raw.description)
      const cost = Number(raw.cost)
      if (!description || !Number.isFinite(cost) || cost < 0) { skipped++; continue }
      const sku = clean(raw.sku)
      if (sku && seenSku.has(sku.toLowerCase())) { skipped++; continue }
      if (sku) seenSku.add(sku.toLowerCase())

      const match = (sku && bySku.get(sku.toLowerCase())) || byDesc.get(description.toLowerCase())
      let finalDesc = match ? match.description : description
      if (!match && seenDesc.has(finalDesc.toLowerCase()) && sku) finalDesc = `${description} (${sku})`
      if (seenDesc.has(finalDesc.toLowerCase())) { skipped++; continue }
      seenDesc.add(finalDesc.toLowerCase())

      const itemMarkup = match?.default_markup_percent ?? markup
      const fields = {
        sku,
        brand: clean(raw.brand),
        supplier_name: supplierName,
        default_cost_rate: round2(cost),
        default_unit_rate: itemMarkup != null ? round2(cost * (1 + itemMarkup / 100)) : null,
        default_markup_percent: itemMarkup,
        updated_at: now,
        ...(clean(raw.category) ? { category: clean(raw.category) } : {}),
        ...(clean(raw.unit) ? { unit: clean(raw.unit) } : {}),
      }

      if (match) {
        updates.push({ id: match.id, ...fields })
      } else {
        inserts.push({
          portal_account_id: account.id,
          description: finalDesc,
          item_type: 'material',
          unit: clean(raw.unit) ?? 'nr',
          usage_count: 0,
          ...fields,
        })
      }
    }

    // Updates go one by one (a PostgREST upsert would need every NOT NULL
    // column); they run in small parallel batches to keep a big list quick.
    for (let i = 0; i < updates.length; i += 25) {
      const batch = updates.slice(i, i + 25)
      const results = await Promise.all(batch.map(({ id, ...patch }) =>
        supabaseAdmin.from('elec_item_library').update(patch).eq('id', id as string).eq('portal_account_id', account.id),
      ))
      const failed = results.find(r => r.error)
      if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })
    }
    for (let i = 0; i < inserts.length; i += 500) {
      const { error } = await supabaseAdmin.from('elec_item_library').insert(inserts.slice(i, i + 500))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ added: inserts.length, updated: updates.length, skipped })
  } catch (e) {
    return apiError(e)
  }
}
