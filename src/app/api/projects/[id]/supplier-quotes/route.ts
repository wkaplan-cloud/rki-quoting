import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { normalizeSupplierQuantity, type SupplierMaterialQuantity } from '@/lib/studio/types'

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

/** A keyed child line — the cloth, the scatters, the stone under one item. */
interface ChildRow {
  id: string
  parent_item_id: string
  item_name: string
  cost_price: number | null
  unit: string | null
  studio_material_key: string
}

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

export interface QuotableQuote {
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
}

/**
 * One part of an item that its own supplier quoted — a scatter, a stone top.
 * It is a choice of its own, because the cushion workroom pricing the scatters
 * and the upholsterer pricing the sofa are not alternatives to each other: the
 * designer wants both, on their own lines.
 */
export interface QuotableComponent {
  /** The child line item the price lands on. */
  lineItemId: string
  label: string
  currentCost: number
  quotes: {
    id: string
    supplierName: string
    supplierId: string | null
    price: number
    quantity: number | null
    unit: string
    leadTime: string
    notes: string
    createdAt: string
  }[]
}

export interface QuotableItem {
  lineItemId: string
  itemName: string
  currentCost: number
  currentSupplierName: string | null
  /** Quotes for the piece itself. Pick one. */
  quotes: QuotableQuote[]
  /** Quotes for parts of it. Pick one per part, independently. */
  components: QuotableComponent[]
}

// Shared by GET (preview) and POST (apply) so a quote can only ever be applied
// to the line item it was actually given for, inside this project.
async function loadQuotableItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
): Promise<{
  items: QuotableItem[]
  quoteById: Map<string, QuoteRow>
  /** Every keyed child line, by parent — where component answers land. */
  childrenByParent: Map<string, ChildRow[]>
  /** Which parent each child belongs to, for resolving an apply target. */
  parentByChild: Map<string, string>
}> {
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
  const empty = {
    items: [],
    quoteById: new Map<string, QuoteRow>(),
    childrenByParent: new Map<string, ChildRow[]>(),
    parentByChild: new Map<string, string>(),
  }
  if (!lineItems.length) return empty

  const objectIds = [...new Set(lineItems.map(l => l.studio_object_id).filter((v): v is string => !!v))]
  const { data: specs } = await supabase
    .from('studio_specs')
    .select('id, object_id')
    .in('object_id', objectIds)

  const specIdByObject = new Map((specs ?? []).map(s => [s.object_id as string, s.id as string]))
  const specIds = [...new Set(specIdByObject.values())]
  if (!specIds.length) return empty

  // The keyed child lines under those parents — the fabric, the scatters, the
  // stone. A component's price and count land on its own row here, never on
  // the parent, and cloth measured by the item's maker lands on its row too.
  const { data: rawChildren } = await supabase
    .from('line_items')
    .select('id, parent_item_id, item_name, cost_price, unit, studio_material_key')
    .eq('project_id', projectId)
    .in('parent_item_id', lineItems.map(l => l.id))
    .not('studio_material_key', 'is', null)
    .order('sort_order')

  const childrenByParent = new Map<string, ChildRow[]>()
  const parentByChild = new Map<string, string>()
  for (const row of (rawChildren ?? []) as ChildRow[]) {
    const list = childrenByParent.get(row.parent_item_id) ?? []
    list.push(row)
    childrenByParent.set(row.parent_item_id, list)
    parentByChild.set(row.id, row.parent_item_id)
  }

  const { data: rawQuotes } = await supabase
    .from('spec_quotes')
    .select('id, studio_spec_id, supplier_id, supplier_name, price, lead_time, notes, source, unable_to_quote, created_at, material_quantities')
    .in('studio_spec_id', specIds)
    .order('created_at', { ascending: false })

  // Normalised once, here, so nothing downstream has to remember that a row
  // written before components existed has no price field on its answers.
  const quotes = ((rawQuotes ?? []) as QuoteRow[]).map(q => ({
    ...q,
    material_quantities: (q.material_quantities ?? []).map(normalizeSupplierQuantity),
  }))
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

    // Component prices, gathered per part rather than per supplier: two
    // cushion workrooms quoting the same scatter are alternatives to each
    // other, while a cushion workroom and an upholsterer are not.
    const children = childrenByParent.get(li.id) ?? []
    const components: QuotableComponent[] = []
    for (const child of children) {
      const offers = list
        .filter(q => !q.unable_to_quote)
        .flatMap(q => {
          const answer = (q.material_quantities ?? []).find(
            m => m.key === child.studio_material_key && m.price !== null
          )
          return answer
            ? [{
                id: q.id,
                supplierName: q.supplier_name,
                supplierId: q.supplier_id,
                price: answer.price as number,
                quantity: answer.quantity,
                unit: answer.unit ?? '',
                leadTime: q.lead_time ?? '',
                notes: q.notes ?? '',
                createdAt: q.created_at,
              }]
            : []
        })
      if (offers.length) {
        components.push({
          lineItemId: child.id,
          label: child.item_name,
          currentCost: child.cost_price ?? 0,
          quotes: offers,
        })
      }
    }

    items.push({
      lineItemId: li.id,
      itemName: li.item_name,
      currentCost: li.cost_price ?? 0,
      currentSupplierName: li.supplier_name,
      components,
      quotes: list
        // A sheet with no price for the piece is a component supplier's, and
        // belongs under its part above, not in the running for the item
        .filter(q => q.price !== null || q.unable_to_quote)
        .map(q => ({
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

  return { items, quoteById, childrenByParent, parentByChild }
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

    const { items, quoteById, childrenByParent, parentByChild } = await loadQuotableItems(supabase, id)

    // A quote can only ever be applied where it was actually offered. Two
    // separate ledgers, because they are two separate choices: one supplier
    // wins the piece, and one supplier wins each part of it.
    const itemOffers = new Map(
      items.map(i => [i.lineItemId, new Set(i.quotes.filter(q => q.price !== null).map(q => q.id))])
    )
    const componentOffers = new Map<string, Set<string>>()
    for (const i of items) {
      for (const c of i.components) {
        componentOffers.set(c.lineItemId, new Set(c.quotes.map(q => q.id)))
      }
    }

    type Target =
      | { kind: 'item'; lineItemId: string; quote: QuoteRow }
      | { kind: 'component'; lineItemId: string; parentId: string; quote: QuoteRow }

    const toApply: Target[] = []
    for (const a of requested) {
      const quote = quoteById.get(a.quoteId)
      if (!quote || quote.unable_to_quote) continue
      if (itemOffers.get(a.lineItemId)?.has(a.quoteId)) {
        toApply.push({ kind: 'item', lineItemId: a.lineItemId, quote })
        continue
      }
      if (componentOffers.get(a.lineItemId)?.has(a.quoteId)) {
        const parentId = parentByChild.get(a.lineItemId)
        if (parentId) toApply.push({ kind: 'component', lineItemId: a.lineItemId, parentId, quote })
      }
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

    // Two different tallies on purpose: `updated` is every row the table has
    // to redraw (cloth lines included), `pricedCount` is what the designer is
    // told they applied. Counting cloth lines as priced items would report
    // three applied prices for one chair.
    const updated: Record<string, unknown>[] = []
    let pricedCount = 0

    /** Whoever is being paid for this line, with their default markup. */
    const supplierPatch = (quote: QuoteRow): Record<string, unknown> =>
      quote.supplier_id
        ? {
            supplier_id: quote.supplier_id,
            supplier_name: quote.supplier_name || null,
            markup_percentage: markupBySupplier.get(quote.supplier_id) ?? 0,
          }
        : {}

    async function write(lineItemId: string, patch: Record<string, unknown>) {
      if (!Object.keys(patch).length) return null
      const { data, error } = await supabase
        .from('line_items')
        .update(patch)
        .eq('id', lineItemId)
        .eq('project_id', id)
        .select('*')
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (data) updated.push(data)
      return data
    }

    /** A measured amount as a line-item patch. 'each' is a count, not a unit. */
    const measuredPatch = (
      answer: SupplierMaterialQuantity,
      currentUnit: string | null
    ): Record<string, unknown> => {
      if (answer.quantity === null) return {}
      const unit = answer.unit && answer.unit !== 'each' ? answer.unit : null
      return { quantity: answer.quantity, ...(currentUnit == null && unit ? { unit } : {}) }
    }

    for (const target of toApply) {
      const { quote } = target
      const answerByKey = new Map((quote.material_quantities ?? []).map(m => [m.key, m]))
      const children = childrenByParent.get(
        target.kind === 'item' ? target.lineItemId : target.parentId
      ) ?? []
      // What this apply actually put on a line, for the stale-quote check below
      let appliedPrice: number | null = null

      if (target.kind === 'item') {
        // The piece itself, onto the parent line
        const data = await write(target.lineItemId, {
          cost_price: quote.price,
          ...supplierPatch(quote),
        })
        if (data) pricedCount++
        appliedPrice = quote.price

        // Cloth this supplier measured but did not price: the linen comes
        // from its own house at its own price, and only the quantity is
        // theirs to say. A component they priced is somebody else's choice
        // to apply, so it is deliberately left alone here.
        for (const child of children) {
          const answer = answerByKey.get(child.studio_material_key)
          if (!answer || answer.price !== null) continue
          await write(child.id, measuredPatch(answer, child.unit))
        }
      } else {
        const child = children.find(c => c.id === target.lineItemId)
        if (!child) continue
        const answer = answerByKey.get(child.studio_material_key)
        if (!answer || answer.price === null) continue

        // The component itself: their price, their count, their name on it
        const data = await write(child.id, {
          cost_price: answer.price,
          ...measuredPatch(answer, child.unit),
          ...supplierPatch(quote),
        })
        if (data) pricedCount++
        appliedPrice = answer.price

        // Its own cloth, which the same supplier measured — the velvet on
        // the scatter they are sewing. Those rows hang off the same parent,
        // so they are found by key rather than by parentage.
        const prefix = `${child.studio_material_key}:f:`
        for (const sibling of children) {
          if (!sibling.studio_material_key.startsWith(prefix)) continue
          const clothAnswer = answerByKey.get(sibling.studio_material_key)
          if (!clothAnswer || clothAnswer.price !== null) continue
          await write(sibling.id, measuredPatch(clothAnswer, sibling.unit))
        }
      }

      // Same record as the Quotes-section apply: applied_price going out of
      // step with price is what makes a stale quote detectable later.
      await supabase
        .from('spec_quotes')
        .update({
          applied_to_line_item_id: target.lineItemId,
          applied_at: new Date().toISOString(),
          applied_price: appliedPrice,
        })
        .eq('id', quote.id)
    }


    return NextResponse.json({ updated: pricedCount, lineItems: updated })
  } catch (e) {
    return apiError(e)
  }
}
