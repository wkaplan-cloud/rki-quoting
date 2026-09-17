export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { QuotesTable, type QuoteRow } from './QuotesTable'
import { normalizeSupplierQuantity, type SupplierMaterialQuantity } from '@/lib/studio/types'

type BoardRel = {
  name: string
  client_id: string | null
  project_id: string | null
  clients: { client_name: string } | { client_name: string }[] | null
}

interface SpecQuoteRow {
  id: string
  supplier_id: string | null
  supplier_name: string
  price: number | null
  notes: string
  lead_time: string
  unable_to_quote: boolean
  source: string
  created_at: string
  studio_spec_id: string | null
  piece_id: string | null
  studio_specs:
    | { spec_name: string; board_id: string; studio_boards: BoardRel | BoardRel[] | null }
    | { spec_name: string; board_id: string; studio_boards: BoardRel | BoardRel[] | null }[]
    | null
  pieces: { name: string } | { name: string }[] | null
  // The supplier's whole-submission note — delivery terms, quote validity,
  // anything covering the quote rather than one item. Written on every RFQ
  // but, until now, only ever read back to the supplier's own form.
  rfq_requests: { submission_message: string | null } | { submission_message: string | null }[] | null
  applied_to_line_item_id: string | null
  applied_at: string | null
  applied_price: number | null
  /** Per-component answers — the components' prices live here, not in `price`. */
  material_quantities: SupplierMaterialQuantity[] | null
  line_items: AppliedLineItem | AppliedLineItem[] | null
}

type AppliedProject = {
  project_number: string | null
  project_name: string
  clients: { client_name: string } | { client_name: string }[] | null
}
type AppliedLineItem = { item_name: string; projects: AppliedProject | AppliedProject[] | null }

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

// Flat, read-only log of every quote a supplier has given — whether typed in
// against a Piece, or submitted through a self-serve RFQ link. Deliberately
// not a workflow: no accept/decline, no assignment state, just "who quoted
// what, and when" in one place instead of scattered across inboxes and
// boards — plus a single action per row to carry a price onto a quote's line
// item, since that is the only thing anyone wants to do from here.
export default async function QuotesPage() {
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_current_org_id')

  // Same gate as Pieces — most of what lands here originates from Pieces
  // or Studio, both solo-plan-locked, so this follows suit
  const { data: org } = orgId
    ? await supabaseAdmin.from('organizations').select('plan').eq('id', orgId).single()
    : { data: null }
  if (org?.plan === 'solo') redirect('/projects')

  const { data } = await supabase
    .from('spec_quotes')
    .select(
      `id, supplier_id, supplier_name, price, notes, lead_time, unable_to_quote, source, created_at, studio_spec_id, piece_id,
       studio_specs ( spec_name, board_id, studio_boards ( name, client_id, project_id, clients ( client_name ) ) ),
       pieces ( name ),
       rfq_requests ( submission_message ),
       applied_to_line_item_id, applied_at, applied_price, material_quantities,
       line_items ( item_name, projects ( project_number, project_name, clients ( client_name ) ) )`
    )
    .order('created_at', { ascending: false })

  // Components are applied per part, so a supplier who quoted two sizes of
  // scatter has an application record for each. Their stale check cannot come
  // from the row's single applied_price, which only ever holds the item's.
  const quoteIds = ((data ?? []) as unknown as SpecQuoteRow[]).map(r => r.id)
  const staleComponents = new Map<string, string[]>()
  if (quoteIds.length) {
    const { data: applications } = await supabase
      .from('spec_quote_applications')
      .select('spec_quote_id, material_key, applied_price')
      .in('spec_quote_id', quoteIds)
    const answersByQuote = new Map(
      ((data ?? []) as unknown as SpecQuoteRow[]).map(r => [
        r.id,
        new Map(
          (r.material_quantities ?? [])
            .map(normalizeSupplierQuantity)
            .map(q => [q.key, q])
        ),
      ])
    )
    for (const a of (applications ?? []) as {
      spec_quote_id: string
      material_key: string
      applied_price: number | string
    }[]) {
      const answer = answersByQuote.get(a.spec_quote_id)?.get(a.material_key)
      if (!answer || answer.price === null) continue
      if (Number(a.applied_price) === answer.price) continue
      const list = staleComponents.get(a.spec_quote_id) ?? []
      list.push(answer.label || 'a component')
      staleComponents.set(a.spec_quote_id, list)
    }
  }

  const rows: QuoteRow[] = ((data ?? []) as unknown as SpecQuoteRow[]).map(row => {
    const spec = one(row.studio_specs)
    const board = one(spec?.studio_boards)
    const client = one(board?.clients)
    const piece = one(row.pieces)
    const rfq = one(row.rfq_requests)
    const appliedItem = one(row.line_items)
    const appliedProject = one(appliedItem?.projects)
    const appliedClient = one(appliedProject?.clients)?.client_name?.trim()
    // "26075 · Gianna · Lounge sofa" — enough to know which quote moved
    const appliedTo = appliedItem
      ? [appliedProject?.project_number?.trim(), appliedClient, appliedItem.item_name?.trim()]
          .filter(Boolean)
          .join(' · ')
      : null
    return {
      id: row.id,
      itemName: spec?.spec_name || piece?.name || 'Untitled item',
      boardName: board?.name ?? null,
      clientName: client?.client_name ?? null,
      fromPieces: !!piece && !spec,
      boardProjectId: board?.project_id ?? null,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      price: row.price,
      leadTime: row.lead_time ?? '',
      notes: row.notes ?? '',
      source: row.source,
      unableToQuote: row.unable_to_quote,
      supplierMessage: rfq?.submission_message?.trim() || null,
      appliedToLineItemId: row.applied_to_line_item_id,
      appliedTo,
      appliedPrice: row.applied_price === null ? null : Number(row.applied_price),
      // The quote carries applied_price; the supplier's current answer is
      // price. Out of step means someone is quoting a client a stale number.
      stale:
        (row.applied_at != null &&
          row.applied_price !== null &&
          Number(row.applied_price) !== (row.price === null ? null : Number(row.price))) ||
        (staleComponents.get(row.id)?.length ?? 0) > 0,
      /** Which parts moved, when the staleness is in the components. */
      staleComponents: staleComponents.get(row.id) ?? [],
      createdAt: row.created_at,
    }
  })

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Prices Received" subtitle="Every price a supplier has given, in one place" count={rows.length} />
      <div className="p-8">
        {rows.length === 0 ? (
          <p className="text-sm text-[#8A877F]">
            No quotes yet — they arrive when a supplier prices a quote request, or when you log one
            against a Piece.
          </p>
        ) : (
          <QuotesTable rows={rows} />
        )}
      </div>
    </div>
  )
}
