export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'

interface SpecQuoteRow {
  id: string
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
    | { spec_name: string; board_id: string; studio_boards: { name: string; client_id: string | null; clients: { client_name: string } | { client_name: string }[] | null } | { name: string; client_id: string | null; clients: { client_name: string } | { client_name: string }[] | null }[] | null }
    | { spec_name: string; board_id: string; studio_boards: { name: string; client_id: string | null; clients: { client_name: string } | { client_name: string }[] | null } | { name: string; client_id: string | null; clients: { client_name: string } | { client_name: string }[] | null }[] | null }[]
    | null
  pieces: { name: string } | { name: string }[] | null
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

// Flat, read-only log of every quote a supplier has given — whether typed in
// manually after an email reply, or (later) submitted through a self-serve
// link. Deliberately not a workflow: no accept/decline, no assignment
// state, just "who quoted what, and when" in one place instead of scattered
// across inboxes and boards.
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
      `id, supplier_name, price, notes, lead_time, unable_to_quote, source, created_at, studio_spec_id, piece_id,
       studio_specs ( spec_name, board_id, studio_boards ( name, client_id, clients ( client_name ) ) ),
       pieces ( name )`
    )
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as unknown as SpecQuoteRow[]

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Quotes" subtitle="Every price a supplier has given, in one place" count={rows.length} />
      <div className="p-8">
        {rows.length === 0 ? (
          <p className="text-sm text-[#8A877F]">
            No quotes logged yet — log one from a spec on any Studio board, or from a Piece.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#D8D3C8]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC] text-left text-xs text-[#8A877F] uppercase tracking-wider">
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 font-medium">Board / Client</th>
                  <th className="px-4 py-2.5 font-medium">Supplier</th>
                  <th className="px-4 py-2.5 font-medium text-right">Price</th>
                  <th className="px-4 py-2.5 font-medium">Lead time</th>
                  <th className="px-4 py-2.5 font-medium">Notes</th>
                  <th className="px-4 py-2.5 font-medium">Logged</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const spec = one(row.studio_specs)
                  const board = one(spec?.studio_boards)
                  const client = one(board?.clients)
                  const piece = one(row.pieces)
                  const itemName = spec?.spec_name || piece?.name || 'Untitled item'
                  const boardLabel = board ? (client ? `${client.client_name} · ${board.name}` : board.name) : piece ? 'Pieces catalog' : '—'
                  return (
                    <tr key={row.id} className="border-b border-[#EDE9E1] last:border-0">
                      <td className="px-4 py-2.5 text-[#2C2C2A]">{itemName}</td>
                      <td className="px-4 py-2.5 text-[#8A877F]">{boardLabel}</td>
                      <td className="px-4 py-2.5 text-[#2C2C2A]">
                        <span className="inline-flex items-center gap-1.5">
                          {row.supplier_name || '—'}
                          {row.source === 'link' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5EFE4] text-[#9A7B4F] uppercase tracking-wide" title="Submitted by the supplier via a self-serve link">
                              via link
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                        {row.unable_to_quote ? (
                          <span className="text-[#B08968] font-normal italic">Couldn&apos;t quote</span>
                        ) : row.price != null ? (
                          <span className="text-[#2C2C2A]">R{row.price.toLocaleString()}</span>
                        ) : (
                          <span className="text-[#8A877F]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#8A877F] whitespace-nowrap">{row.lead_time || '—'}</td>
                      <td className="px-4 py-2.5 text-[#8A877F] max-w-[240px] truncate">{row.notes || '—'}</td>
                      <td className="px-4 py-2.5 text-[#8A877F] whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
