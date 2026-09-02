'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, ArrowRight, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

// Flat log of every supplier price, plus the one action that turns a logged
// price into money on a quote. The project's own "Apply supplier quotes"
// button only offers the line items that came from the board this quote was
// requested on — this is the way round for everything else: any price, onto
// any line item of any project.

export interface QuoteRow {
  id: string
  itemName: string
  boardName: string | null
  clientName: string | null
  fromPieces: boolean
  /** Project the quote's board was converted into, if it has been — the sensible default target. */
  boardProjectId: string | null
  supplierId: string | null
  supplierName: string
  price: number | null
  leadTime: string
  notes: string
  source: string
  unableToQuote: boolean
  createdAt: string
}

interface ProjectOption {
  id: string
  project_number: string | null
  project_name: string
}

interface LineItemOption {
  id: string
  item_name: string
  cost_price: number
  supplier_name: string | null
}

export function QuotesTable({ rows }: { rows: QuoteRow[] }) {
  const [applying, setApplying] = useState<QuoteRow | null>(null)
  // Applied in this session — the row shows a tick straight away rather than
  // looking untouched until the next reload
  const [applied, setApplied] = useState<Record<string, string>>({})

  return (
    <>
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
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const boardLabel = row.boardName
                ? row.clientName
                  ? `${row.clientName} · ${row.boardName}`
                  : row.boardName
                : row.fromPieces
                  ? 'Pieces catalog'
                  : '—'
              const canApply = !row.unableToQuote && row.price != null
              return (
                <tr key={row.id} className="border-b border-[#EDE9E1] last:border-0">
                  <td className="px-4 py-2.5 text-[#2C2C2A]">{row.itemName}</td>
                  <td className="px-4 py-2.5 text-[#8A877F]">{boardLabel}</td>
                  <td className="px-4 py-2.5 text-[#2C2C2A]">
                    <span className="inline-flex items-center gap-1.5">
                      {row.supplierName || '—'}
                      {row.source === 'link' && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5EFE4] text-[#9A7B4F] uppercase tracking-wide"
                          title="Submitted by the supplier via a self-serve link"
                        >
                          via link
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                    {row.unableToQuote ? (
                      <span className="text-[#B08968] font-normal italic">Couldn&apos;t quote</span>
                    ) : row.price != null ? (
                      <span className="text-[#2C2C2A]">R{row.price.toLocaleString()}</span>
                    ) : (
                      <span className="text-[#8A877F]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[#8A877F] whitespace-nowrap">{row.leadTime || '—'}</td>
                  <td className="px-4 py-2.5 text-[#8A877F] max-w-[240px] truncate">{row.notes || '—'}</td>
                  <td className="px-4 py-2.5 text-[#8A877F] whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleDateString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {applied[row.id] ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <Check size={13} /> {applied[row.id]}
                      </span>
                    ) : canApply ? (
                      <button
                        type="button"
                        onClick={() => setApplying(row)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#9A7B4F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
                      >
                        Add to quote <ArrowRight size={12} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {applying && (
        <ApplyQuoteModal
          quote={applying}
          onClose={() => setApplying(null)}
          onApplied={label => {
            setApplied(prev => ({ ...prev, [applying.id]: label }))
            setApplying(null)
          }}
        />
      )}
    </>
  )
}

// Pick a project, pick a line item, write the price onto it. Reads and writes
// both go through the user's own client, so RLS decides what's reachable.
function ApplyQuoteModal({
  quote,
  onClose,
  onApplied,
}: {
  quote: QuoteRow
  onClose: () => void
  onApplied: (label: string) => void
}) {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectOption[] | null>(null)
  const [projectId, setProjectId] = useState<string>(quote.boardProjectId ?? '')
  const [lineItems, setLineItems] = useState<LineItemOption[] | null>(null)
  const [lineItemId, setLineItemId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('projects')
        .select('id, project_number, project_name')
        .order('created_at', { ascending: false })
      if (!cancelled) setProjects((data ?? []) as ProjectOption[])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!projectId) {
      setLineItems(null)
      return
    }
    let cancelled = false
    setLineItems(null)
    setLineItemId('')
    void (async () => {
      const supabase = createClient()
      // Sections are headings, not costable lines
      const { data } = await supabase
        .from('line_items')
        .select('id, item_name, cost_price, supplier_name')
        .eq('project_id', projectId)
        .eq('row_type', 'item')
        .order('sort_order')
      if (!cancelled) setLineItems((data ?? []) as LineItemOption[])
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  async function apply() {
    if (!lineItemId || quote.price == null) return
    setSaving(true)
    try {
      const supabase = createClient()
      const patch: Record<string, unknown> = { cost_price: quote.price }
      // A quote from a linked supplier moves the line onto that supplier with
      // their default markup — the price and who supplies it are one decision,
      // same as the project's Apply supplier quotes flow
      if (quote.supplierId) {
        const { data: sup } = await supabase
          .from('suppliers')
          .select('markup_percentage')
          .eq('id', quote.supplierId)
          .maybeSingle()
        patch.supplier_id = quote.supplierId
        patch.supplier_name = quote.supplierName || null
        patch.markup_percentage = sup?.markup_percentage ?? 0
      }
      const { error } = await supabase.from('line_items').update(patch).eq('id', lineItemId)
      if (error) throw new Error(error.message)

      const item = lineItems?.find(l => l.id === lineItemId)
      toast.success(`R${quote.price.toLocaleString()} applied to ${item?.item_name ?? 'the line item'}`)
      router.refresh()
      onApplied(item?.item_name ?? 'Applied')
    } catch (e) {
      toast.error((e as Error).message || 'Could not apply that price')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl bg-[#F5F2EC] border border-[#D8D3C8] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8D3C8]">
          <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
            Add price to a quote
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            title="Close"
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="rounded-lg border border-[#D8D3C8] bg-white px-3 py-2.5">
            <p className="text-sm text-[#2C2C2A]">
              {quote.itemName} — <span className="font-medium">R{quote.price?.toLocaleString()}</span>
            </p>
            <p className="text-[11px] text-[#8A877F] mt-0.5">
              Quoted by {quote.supplierName || 'an unnamed supplier'}
              {quote.leadTime ? ` · lead time ${quote.leadTime}` : ''}
            </p>
          </div>

          <label className="block">
            <span className="block text-[11px] font-medium text-[#8A877F] uppercase tracking-wide mb-1">
              Quote
            </span>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full text-sm px-2.5 py-2 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A] cursor-pointer"
            >
              <option value="">Choose a quote…</option>
              {(projects ?? []).map(p => (
                <option key={p.id} value={p.id}>
                  {p.project_number ? `${p.project_number} · ` : ''}
                  {p.project_name}
                </option>
              ))}
            </select>
            {quote.boardProjectId && projectId === quote.boardProjectId && (
              <p className="text-[10px] text-emerald-700 mt-1">
                The quote this item&apos;s board was converted into
              </p>
            )}
          </label>

          {projectId && (
            <div>
              <p className="text-[11px] font-medium text-[#8A877F] uppercase tracking-wide mb-1">
                Line item
              </p>
              {lineItems === null ? (
                <p className="text-xs text-[#8A877F]">Loading…</p>
              ) : lineItems.length === 0 ? (
                <p className="text-xs text-[#8A877F]">This quote has no line items yet.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-[#D8D3C8] bg-white divide-y divide-[#EDE9E1]">
                  {lineItems.map(li => (
                    <label
                      key={li.id}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#F5F2EC] transition-colors"
                    >
                      <input
                        type="radio"
                        name="line-item"
                        checked={lineItemId === li.id}
                        onChange={() => setLineItemId(li.id)}
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ accentColor: '#9A7B4F' }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-[#2C2C2A] truncate">{li.item_name}</span>
                        <span className="block text-[10px] text-[#8A877F]">
                          Currently R{(li.cost_price ?? 0).toLocaleString()}
                          {li.supplier_name ? ` · ${li.supplier_name}` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {quote.supplierId && (
            <p className="text-[11px] text-[#8A877F] leading-relaxed">
              This also moves the line onto {quote.supplierName} and applies their default markup.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#D8D3C8]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-8 px-3 text-xs text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={saving || !lineItemId}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-[#C4A46B] text-[#1A1A18] rounded-lg hover:bg-[#D4B47B] transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Applying…
              </>
            ) : (
              <>Apply price</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
