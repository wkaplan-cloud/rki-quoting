import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import type { SupplierMaterialQuantity } from '@/lib/studio/types'

// Supplier pricing → quote line items.
//
// Board conversion deliberately lands every line unpriced, and suppliers
// answer an RFQ days later — this is the step that carries their answers
// across. It is never automatic: one item can hold several quotes (that is the
// whole point of sending comparison suppliers), so which price wins is always
// the designer's explicit choice, applied on a button press.
//
// Identity is the studio_object_id breadcrumb every converted item row carries
// (see convert-to-project + studio_line_item_links) — the same link sync uses,
// so rows added by a later sync are covered too.
//
// line_items has no org_id: access is granted through the parent project, so
// every read and write here goes through the user's RLS client and fails
// closed on a project they can't see.

interface LineItemRow {
  id: string
  item_name: string
  cost_price: number
  supplier_id: string | null
  supplier_name: string | null
  studio_object_id: string | null
}

interface QuoteRow {
  id: string
  studio_spec_id: string
  supplier_id: string | null
  supplier_name: string
  price: number | null
  lead_time: string
  notes: string
  source: string
  unable_to_quote: boolean
  created_at: string
  /** Metres per cloth, as the supplier measured them on their RFQ form. */
  material_quantities: SupplierMaterialQuantity[] | null
}

export interface QuotableItem {
  lineItemId: string
  itemName: string
  currentCost: number
  currentSupplierName: string | null
  quotes: {
    id: string
    supplierName: string
    supplierId: string | null
    price: number | null
    leadTime: string
    notes: string
    source: string
    unableToQuote: boolean
    createdAt: string
    /** Shown in the modal, and applied to the material's own line on apply. */
    materialQuantities: { key: string; label: string; quantity: number; unit: string }[]
  }[]
}

// Shared by GET (preview) and POST (apply) so a quote can only ever be applied
// to the line item it was actually given for, inside this project.
async function loadQuotableItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
): Promise<{ items: QuotableItem[]; quoteById: Map<string, QuoteRow> }> {
  const { data: rawLineItems } = await supabase
    .from('line_items')
    .select('id, item_name, cost_price, supplier_id, supplier_name, studio_object_id')
    .eq('project_id', projectId)
    .eq('row_type', 'item')
    .not('studio_object_id', 'is', null)
    // Parents only. A material child (the fabric on a chair) carries its
    // parent's studio_object_id, so without this it matches the same spec and
    // gets offered the chair's quote — which would overwrite the fabric's own
    // price, already fetched live from the price list at conversion. The
    // supplier quoted the item, not its components.
    .is('parent_item_id', null)
    .order('sort_order')

  const lineItems = (rawLineItems ?? []) as LineItemRow[]
  if (!lineItems.length) return { items: [], quoteById: new Map() }

  const objectIds = [...new Set(lineItems.map(l => l.studio_object_id).filter((v): v is string => !!v))]
  const { data: specs } = await supabase
    .from('studio_specs')
    .select('id, object_id')
    .in('object_id', objectIds)

  const specIdByObject = new Map((specs ?? []).map(s => [s.object_id as string, s.id as string]))
  const specIds = [...new Set(specIdByObject.values())]
  if (!specIds.length) return { items: [], quoteById: new Map() }

  const { data: rawQuotes } = await supabase
    .from('spec_quotes')
    .select('id, studio_spec_id, supplier_id, supplier_name, price, lead_time, notes, source, unable_to_quote, created_at, material_quantities')
    .in('studio_spec_id', specIds)
    .order('created_at', { ascending: false })

  const quotes = (rawQuotes ?? []) as QuoteRow[]
  const quoteById = new Map(quotes.map(q => [q.id, q]))
  const bySpec = new Map<string, QuoteRow[]>()
  for (const q of quotes) {
    const list = bySpec.get(q.studio_spec_id) ?? []
    list.push(q)
    bySpec.set(q.studio_spec_id, list)
  }

  const items: QuotableItem[] = []
  for (const li of lineItems) {
    const specId = li.studio_object_id ? specIdByObject.get(li.studio_object_id) : undefined
    const list = specId ? bySpec.get(specId) : undefined
    // An item nobody has quoted on has nothing to choose between — leave it out
    if (!list?.length) continue
    items.push({
      lineItemId: li.id,
      itemName: li.item_name,
      currentCost: li.cost_price ?? 0,
      currentSupplierName: li.supplier_name,
      quotes: list.map(q => ({
        id: q.id,
        supplierName: q.supplier_name,
        supplierId: q.supplier_id,
        price: q.price,
        leadTime: q.lead_time ?? '',
        notes: q.notes ?? '',
        source: q.source,
        unableToQuote: q.unable_to_quote,
        createdAt: q.created_at,
        // Only what they actually measured — a blank box is not a quantity,
        // and writing one as zero would empty the order.
        materialQuantities: (q.material_quantities ?? [])
          .filter((m): m is SupplierMaterialQuantity & { quantity: number } => m.quantity !== null)
          .map(m => ({ key: m.key, label: m.label, quantity: m.quantity, unit: m.unit ?? 'm' })),
      })),
    })
  }

  return { items, quoteById }
}

// GET /api/projects/[id]/supplier-quotes — every quote a supplier has given on
// this project's board-originated items, with what each line currently costs.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: project } = await supabase.from('projects').select('id').eq('id', id).maybeSingle()
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { items } = await loadQuotableItems(supabase, id)
    return NextResponse.json({ items })
  } catch (e) {
    return apiError(e)
  }
}

// POST /api/projects/[id]/supplier-quotes — write the chosen prices onto their
// line items. Applying a quote also moves the line onto that supplier (with
// their default markup) when the quote came from a linked supplier record: the
// price and the supplier are one decision, not two.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: project } = await supabase.from('projects').select('id').eq('id', id).maybeSingle()
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = (await req.json().catch(() => ({}))) as {
      apply?: { lineItemId: string; quoteId: string }[]
    }
    const requested = (body.apply ?? []).filter(a => a?.lineItemId && a?.quoteId)
    if (!requested.length) return NextResponse.json({ error: 'Nothing to apply' }, { status: 400 })

    const { items, quoteById } = await loadQuotableItems(supabase, id)
    const allowedByLineItem = new Map(items.map(i => [i.lineItemId, new Set(i.quotes.map(q => q.id))]))

    const toApply: { lineItemId: string; quote: QuoteRow }[] = []
    for (const a of requested) {
      if (!allowedByLineItem.get(a.lineItemId)?.has(a.quoteId)) continue
      const quote = quoteById.get(a.quoteId)
      // "Couldn't quote" carries no price — there is nothing to write
      if (!quote || quote.unable_to_quote || quote.price == null) continue
      toApply.push({ lineItemId: a.lineItemId, quote })
    }
    if (!toApply.length) {
      return NextResponse.json({ error: 'None of those prices could be applied' }, { status: 400 })
    }

    // Default markups for any supplier a line is moving onto
    const supplierIds = [...new Set(toApply.map(t => t.quote.supplier_id).filter((v): v is string => !!v))]
    const markupBySupplier = new Map<string, number>()
    if (supplierIds.length) {
      const { data: sups } = await supabase
        .from('suppliers')
        .select('id, markup_percentage')
        .in('id', supplierIds)
      for (const s of sups ?? []) markupBySupplier.set(s.id as string, (s.markup_percentage as number) ?? 0)
    }

    // The cloth lines under every item being priced. A returned yardage lands
    // on the child row carrying that ask's key — children all share their
    // parent's studio_object_id, so the key is the only thing that tells the
    // fabric apart from the leather beside it. Rows converted before the key
    // existed have none, and are left alone rather than guessed at.
    const parentIds = toApply.map(t => t.lineItemId)
    const { data: childRows } = await supabase
      .from('line_items')
      .select('id, parent_item_id, studio_material_key, unit')
      .eq('project_id', id)
      .in('parent_item_id', parentIds)
      .not('studio_material_key', 'is', null)
    const childrenByParent = new Map<string, { id: string; studio_material_key: string; unit: string | null }[]>()
    for (const row of (childRows ?? []) as {
      id: string
      parent_item_id: string
      studio_material_key: string
      unit: string | null
    }[]) {
      const list = childrenByParent.get(row.parent_item_id) ?? []
      list.push({ id: row.id, studio_material_key: row.studio_material_key, unit: row.unit })
      childrenByParent.set(row.parent_item_id, list)
    }

    // Two different tallies on purpose: `updated` is every row the table has
    // to redraw (cloth lines included), `pricedCount` is what the designer is
    // told they applied. Counting cloth lines as priced items would report
    // three applied prices for one chair.
    const updated: Record<string, unknown>[] = []
    let pricedCount = 0
    for (const { lineItemId, quote } of toApply) {
      const patch: Record<string, unknown> = { cost_price: quote.price }
      if (quote.supplier_id) {
        patch.supplier_id = quote.supplier_id
        patch.supplier_name = quote.supplier_name || null
        patch.markup_percentage = markupBySupplier.get(quote.supplier_id) ?? 0
      }
      const { data, error } = await supabase
        .from('line_items')
        .update(patch)
        .eq('id', lineItemId)
        .eq('project_id', id)
        .select('*')
        .maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (data) {
        updated.push(data)
        pricedCount++
      }

      // What the supplier measured, onto that material's own line. Only the
      // quantity moves: the material is bought from its house at its own
      // price, which this supplier never quoted and must not overwrite.
      const qtyByKey = new Map(
        (quote.material_quantities ?? [])
          .filter(m => m.quantity !== null)
          .map(m => [m.key, { amount: m.quantity as number, unit: m.unit ?? 'm' }])
      )
      if (qtyByKey.size) {
        for (const child of childrenByParent.get(lineItemId) ?? []) {
          const measured = qtyByKey.get(child.studio_material_key)
          if (measured === undefined) continue
          const { data: childData } = await supabase
            .from('line_items')
            .update({ quantity: measured.amount, unit: child.unit ?? measured.unit })
            .eq('id', child.id)
            .eq('project_id', id)
            .select('*')
            .maybeSingle()
          if (childData) updated.push(childData)
        }
      }

      // Same record as the Quotes-section apply: applied_price going out of
      // step with price is what makes a stale quote detectable later.
      await supabase
        .from('spec_quotes')
        .update({
          applied_to_line_item_id: lineItemId,
          applied_at: new Date().toISOString(),
          applied_price: quote.price,
        })
        .eq('id', quote.id)
    }

    return NextResponse.json({ updated: pricedCount, lineItems: updated })
  } catch (e) {
    return apiError(e)
  }
}
