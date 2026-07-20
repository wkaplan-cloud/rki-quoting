export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'

interface SpecQuoteRow {
  id: string
  supplier_name: string
  price: number | null
  notes: string
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
  const { data } = await supabase
    .from('spec_quotes')
    .select(
      `id, supplier_name, price, notes, source, created_at, studio_spec_id, piece_id,
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
                      <td className="px-4 py-2.5 text-[#2C2C2A]">{row.supplier_name || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-[#2C2C2A] font-medium">
                        {row.price != null ? `R${row.price.toLocaleString()}` : '—'}
                      </td>
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
