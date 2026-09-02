export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { QuotesTable, type QuoteRow } from './QuotesTable'

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
}

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
       pieces ( name )`
    )
    .order('created_at', { ascending: false })

  const rows: QuoteRow[] = ((data ?? []) as unknown as SpecQuoteRow[]).map(row => {
    const spec = one(row.studio_specs)
    const board = one(spec?.studio_boards)
    const client = one(board?.clients)
    const piece = one(row.pieces)
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
      createdAt: row.created_at,
    }
  })

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Quotes" subtitle="Every price a supplier has given, in one place" count={rows.length} />
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
