'use client'
import { useEffect, useState } from 'react'
import { Loader2, ReceiptText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatZAR } from '@/lib/quoting'
import { formatQuantity } from '@/lib/rfq/price'
import type { LineItem } from '@/lib/types'

// Pull supplier pricing onto the quote. Board items convert unpriced and RFQ
// answers land in spec_quotes days later; this is where the two meet. Nothing
// is applied until the button is pressed, and where several suppliers quoted
// the same item the designer picks which price wins — the comparison is the
// point, so it is never resolved automatically.

interface Quote {
  id: string
  supplierName: string
  supplierId: string | null
  price: number | null
  leadTime: string
  notes: string
  source: string
  unableToQuote: boolean
  createdAt: string
  /** What the supplier measured, per material on the item. */
  materialQuantities: { key: string; label: string; quantity: number; unit: string }[]
}

/**
 * One part of an item its own supplier quoted — a scatter, a stone top. It is
 * a choice of its own: the workroom pricing the cushions and the upholsterer
 * pricing the sofa are not alternatives to each other, so applying one must
 * never mean giving up the other.
 */
interface QuotableComponent {
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

interface QuotableItem {
  lineItemId: string
  itemName: string
  currentCost: number
  currentSupplierName: string | null
  quotes: Quote[]
  components: QuotableComponent[]
}

const KEEP = 'keep'

export function SupplierQuotesModal({
  projectId,
  onClose,
  onApplied,
}: {
  projectId: string
  onClose: () => void
  onApplied: (rows: LineItem[]) => void
}) {
  const [items, setItems] = useState<QuotableItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // lineItemId → quote id to apply, or KEEP to leave the line alone
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/supplier-quotes`)
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setLoadError(json.error ?? 'Could not load supplier quotes')
          return
        }
        const loaded = (json.items ?? []) as QuotableItem[]
        setItems(loaded)
        // Pre-select the cheapest usable price per item — the common case, and
        // still shown as a choice rather than applied behind the designer's back
        // Cheapest usable price pre-selected per line — the common case, and
        // still shown as a choice rather than applied behind the designer's
        // back. Components choose separately, because they are separate lines.
        const cheapestOf = <T extends { id: string; price: number | null }>(list: T[]) =>
          list.reduce<T | null>(
            (best, q) => (best === null || (q.price ?? 0) < (best.price ?? 0) ? q : best),
            null
          )
        setChoices(
          Object.fromEntries(
            loaded.flatMap(it => [
              [
                it.lineItemId,
                cheapestOf(it.quotes.filter(q => !q.unableToQuote && q.price != null))?.id ?? KEEP,
              ] as [string, string],
              ...it.components.map(
                c => [c.lineItemId, cheapestOf(c.quotes)?.id ?? KEEP] as [string, string]
              ),
            ])
          )
        )
      } catch {
        if (!cancelled) setLoadError('Could not load supplier quotes')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const applyCount = items
    ? items.reduce((n, it) => {
        const chosen = choices[it.lineItemId]
        const q = chosen && chosen !== KEEP ? it.quotes.find(x => x.id === chosen) : undefined
        const itemCount = q && !q.unableToQuote && q.price != null ? 1 : 0
        const componentCount = it.components.filter(c => {
          const pick = choices[c.lineItemId]
          return pick && pick !== KEEP && c.quotes.some(x => x.id === pick)
        }).length
        return n + itemCount + componentCount
      }, 0)
    : 0

  async function apply() {
    if (!items) return
    setApplying(true)
    try {
      const payload = {
        apply: Object.entries(choices)
          .filter(([, quoteId]) => quoteId && quoteId !== KEEP)
          .map(([lineItemId, quoteId]) => ({ lineItemId, quoteId })),
      }
      const res = await fetch(`/api/projects/${projectId}/supplier-quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Could not apply the prices')
        setApplying(false)
        return
      }
      onApplied((json.lineItems ?? []) as LineItem[])
      toast.success(`${json.updated} item${json.updated === 1 ? '' : 's'} priced from supplier quotes`)
      onClose()
    } catch {
      toast.error('Could not apply the prices')
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-[#EDE9E1]">
          <h3 className="flex items-center gap-2 text-base font-semibold text-[#2C2C2A] mb-1">
            <ReceiptText size={16} className="text-[#9A7B4F]" /> Supplier quotes
          </h3>
          <p className="text-xs text-[#8A877F]">
            Prices suppliers have given for the board items on this quote. Pick one per item — it
            becomes that line&apos;s cost, and the line moves onto that supplier with their default
            markup. Where a supplier measured a material, that quantity goes onto the
            material&apos;s own line at the same time &mdash; the price on it stays as it is, because
            the material is bought from its own house.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!items && !loadError && (
            <div className="flex items-center gap-2 py-6 text-sm text-[#8A877F]">
              <Loader2 size={15} className="animate-spin" /> Loading supplier quotes…
            </div>
          )}

          {loadError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-red-600" />
              <p className="text-xs text-red-800 leading-relaxed">{loadError}</p>
            </div>
          )}

          {items && items.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-[#EDE9E1] bg-[#F5F2EC] px-3 py-2.5">
              <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5 text-[#9A7B4F]" />
              <p className="text-xs text-[#4A4A47] leading-relaxed">
                No supplier quotes yet for the board items on this quote. Send a quote request from
                the board&apos;s Specs panel — prices land here once suppliers reply.
              </p>
            </div>
          )}

          {items && items.length > 0 && (
            <div className="space-y-3">
              {items.map(it => (
                <div key={it.lineItemId} className="rounded-lg border border-[#EDE9E1] p-3">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <span className="text-sm font-medium text-[#2C2C2A] truncate">{it.itemName}</span>
                    <span className="flex-shrink-0 text-xs text-[#8A877F]">
                      now {formatZAR(it.currentCost)}
                      {it.currentSupplierName ? ` · ${it.currentSupplierName}` : ''}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {it.quotes.length === 0 && it.components.length > 0 && (
                      <p className="px-2 py-1 text-[11px] text-[#8A877F]">
                        Nobody has quoted the item itself — only the parts below.
                      </p>
                    )}
                    {it.quotes.map(q => {
                      const usable = !q.unableToQuote && q.price != null
                      return (
                        <label
                          key={q.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${
                            usable ? 'cursor-pointer hover:bg-[#F5F2EC]' : 'opacity-60'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`quote-${it.lineItemId}`}
                            value={q.id}
                            disabled={!usable}
                            checked={choices[it.lineItemId] === q.id}
                            onChange={() => setChoices(prev => ({ ...prev, [it.lineItemId]: q.id }))}
                            className="flex-shrink-0 accent-[#9A7B4F] cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="flex-1 min-w-0 text-xs text-[#2C2C2A] truncate">
                            {q.supplierName || 'Unnamed supplier'}
                            {q.source === 'link' && (
                              <span
                                className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5EFE4] text-[#9A7B4F] uppercase tracking-wide"
                                title="Submitted by the supplier via a self-serve link"
                              >
                                via link
                              </span>
                            )}
                            {q.leadTime && <span className="ml-1.5 text-[#8A877F]">· {q.leadTime}</span>}
                            {q.notes && <span className="ml-1.5 text-[#8A877F] italic">· {q.notes}</span>}
                            {q.materialQuantities.length > 0 && (
                              // truncate above would hide these, and a quantity
                              // the designer can't see is one they can't check
                              <span className="block whitespace-normal text-[11px] text-[#8A877F] mt-0.5">
                                {q.materialQuantities
                                  .map(m => `${m.label} — ${formatQuantity(m.quantity, m.unit)}`)
                                  .join(' · ')}
                              </span>
                            )}
                          </span>
                          <span className="flex-shrink-0 text-xs font-medium text-[#2C2C2A]">
                            {q.unableToQuote ? (
                              <span className="font-normal italic text-[#B08968]">Couldn&apos;t quote</span>
                            ) : q.price != null ? (
                              formatZAR(q.price)
                            ) : (
                              <span className="font-normal text-[#8A877F]">No price</span>
                            )}
                          </span>
                        </label>
                      )
                    })}

                    {it.quotes.length > 0 && (
                      <label className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[#F5F2EC]">
                        <input
                          type="radio"
                          name={`quote-${it.lineItemId}`}
                          value={KEEP}
                          checked={(choices[it.lineItemId] ?? KEEP) === KEEP}
                          onChange={() => setChoices(prev => ({ ...prev, [it.lineItemId]: KEEP }))}
                          className="flex-shrink-0 accent-[#9A7B4F] cursor-pointer"
                        />
                        <span className="flex-1 text-xs text-[#8A877F]">Leave this line as it is</span>
                      </label>
                    )}
                  </div>

                  {/* Parts of the item, each with its own supplier and its own
                      choice. Nested under the item because that is where they
                      sit on the quote, but chosen independently of it. */}
                  {it.components.map(c => (
                    <div key={c.lineItemId} className="mt-2 pt-2 border-t border-[#F0EDE6]">
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="text-xs font-medium text-[#4A4A47] truncate">{c.label}</span>
                        <span className="flex-shrink-0 text-[11px] text-[#8A877F]">
                          now {formatZAR(c.currentCost)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {c.quotes.map(q => (
                          <label
                            key={q.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[#F5F2EC]"
                          >
                            <input
                              type="radio"
                              name={`component-${c.lineItemId}`}
                              value={q.id}
                              checked={choices[c.lineItemId] === q.id}
                              onChange={() => setChoices(prev => ({ ...prev, [c.lineItemId]: q.id }))}
                              className="flex-shrink-0 accent-[#9A7B4F] cursor-pointer"
                            />
                            <span className="flex-1 min-w-0 text-xs text-[#2C2C2A] truncate">
                              {q.supplierName || 'Unnamed supplier'}
                              {q.leadTime && <span className="ml-1.5 text-[#8A877F]">· {q.leadTime}</span>}
                            </span>
                            <span className="flex-shrink-0 text-xs font-medium text-[#2C2C2A]">
                              {formatZAR(q.price)}
                              <span className="font-normal text-[#8A877F]">
                                {q.unit && q.unit !== 'each' ? ` / ${q.unit}` : ' each'}
                                {q.quantity != null ? ` × ${q.quantity}` : ''}
                              </span>
                            </span>
                          </label>
                        ))}
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[#F5F2EC]">
                          <input
                            type="radio"
                            name={`component-${c.lineItemId}`}
                            value={KEEP}
                            checked={(choices[c.lineItemId] ?? KEEP) === KEEP}
                            onChange={() => setChoices(prev => ({ ...prev, [c.lineItemId]: KEEP }))}
                            className="flex-shrink-0 accent-[#9A7B4F] cursor-pointer"
                          />
                          <span className="flex-1 text-xs text-[#8A877F]">Leave this line as it is</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#EDE9E1]">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
          >
            {items && items.length === 0 ? 'Close' : 'Cancel'}
          </button>
          {items && items.length > 0 && (
            <button
              type="button"
              onClick={() => void apply()}
              disabled={applying || applyCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#9A7B4F] text-white rounded-lg hover:bg-[#7d6340] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {applying ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Applying…
                </>
              ) : (
                <>
                  Apply {applyCount} price{applyCount === 1 ? '' : 's'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
