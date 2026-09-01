'use client'
import { useEffect, useState } from 'react'
import { Loader2, ReceiptText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatZAR } from '@/lib/quoting'
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
}

interface QuotableItem {
  lineItemId: string
  itemName: string
  currentCost: number
  currentSupplierName: string | null
  quotes: Quote[]
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
        setChoices(
          Object.fromEntries(
            loaded.map(it => {
              const priced = it.quotes.filter(q => !q.unableToQuote && q.price != null)
              const cheapest = priced.reduce<Quote | null>(
                (best, q) => (best === null || (q.price ?? 0) < (best.price ?? 0) ? q : best),
                null
              )
              return [it.lineItemId, cheapest?.id ?? KEEP]
            })
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
    ? items.filter(it => {
        const chosen = choices[it.lineItemId]
        if (!chosen || chosen === KEEP) return false
        const q = it.quotes.find(x => x.id === chosen)
        return !!q && !q.unableToQuote && q.price != null
      }).length
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
            markup.
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
                  </div>
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
