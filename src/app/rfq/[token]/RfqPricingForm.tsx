'use client'
import { useMemo, useState } from 'react'
import { CheckCircle2, Loader2, AlertTriangle, Ban } from 'lucide-react'

export interface RfqFormItem {
  specId: string
  name: string
  area: string
  imageUrl: string | null
  category: string
  description: string
  quantity: string
  unit: string
  dimensions: string
  materials: string[]
  /** Category specs, already resolved to their human labels + units. */
  itemSpecs: { label: string; value: string }[]
  specNotes: string
  prefill: { price: number | null; leadTime: string; note: string; unableToQuote: boolean }
  sort: number
}

interface Entry {
  price: string
  leadTime: string
  note: string
  unableToQuote: boolean
}

// Public, no-login pricing form a supplier fills in from their RFQ email link.
// Read-only spec on top of each card; price / lead time / note inputs below,
// plus a "can't quote this" toggle. Overwrite model — resubmitting replaces
// the last submission, so we prefill from whatever they last sent.
export function RfqPricingForm({
  token,
  businessName,
  boardName,
  supplierName,
  message,
  items,
  initialSubmissionMessage,
  alreadySubmitted,
  expiryLabel,
}: {
  token: string
  businessName: string
  boardName: string
  supplierName: string
  message: string
  items: RfqFormItem[]
  initialSubmissionMessage: string
  alreadySubmitted: boolean
  expiryLabel: string
}) {
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(
      items.map(it => [
        it.specId,
        {
          price: it.prefill.price != null ? String(it.prefill.price) : '',
          leadTime: it.prefill.leadTime,
          note: it.prefill.note,
          unableToQuote: it.prefill.unableToQuote,
        },
      ])
    )
  )
  const [overallMessage, setOverallMessage] = useState(initialSubmissionMessage)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function update(specId: string, patch: Partial<Entry>) {
    setEntries(prev => ({ ...prev, [specId]: { ...prev[specId], ...patch } }))
  }

  const filledCount = useMemo(
    () =>
      Object.values(entries).filter(
        e => e.unableToQuote || e.price.trim() || e.leadTime.trim() || e.note.trim()
      ).length,
    [entries]
  )

  async function submit() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/rfq/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: overallMessage,
          items: items.map(it => ({
            specId: it.specId,
            price: entries[it.specId].price,
            leadTime: entries[it.specId].leadTime,
            note: entries[it.specId].note,
            unableToQuote: entries[it.specId].unableToQuote,
          })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch {
      setError('Could not reach the server. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white border px-6 py-10 text-center" style={{ borderColor: '#EDE9E1' }}>
        <CheckCircle2 size={44} className="mx-auto mb-4" style={{ color: '#16A34A' }} />
        <h1 className="text-lg font-semibold mb-1" style={{ color: '#2C2C2A' }}>Thank you — your pricing is in</h1>
        <p className="text-sm max-w-sm mx-auto" style={{ color: '#8A877F' }}>
          {businessName} has your quote. You can revisit this link and resubmit any time before {expiryLabel} if
          anything changes — your latest submission replaces the previous one.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-2xl bg-white border px-5 py-5" style={{ borderColor: '#EDE9E1' }}>
        <h1 className="text-lg font-semibold" style={{ color: '#2C2C2A' }}>
          Quote request{boardName ? ` — ${boardName}` : ''}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8A877F' }}>
          {supplierName ? `Hi ${supplierName} — ` : ''}please add your pricing for the {items.length}
          {items.length === 1 ? ' item' : ' items'} below. Enter a price per item, plus lead time and any notes.
        </p>
        {message.trim() && (
          <p className="text-sm mt-3 pt-3 border-t whitespace-pre-line" style={{ color: '#4A4A47', borderColor: '#EDE9E1' }}>
            {message.trim()}
          </p>
        )}
        {alreadySubmitted && (
          <p className="text-xs mt-3 rounded-lg px-3 py-2" style={{ color: '#9A7B4F', backgroundColor: '#F5EFE4' }}>
            You&apos;ve submitted before — your previous prices are filled in. Submitting again replaces them.
          </p>
        )}
      </div>

      {/* Items */}
      {items.map(it => {
        const e = entries[it.specId]
        const disabled = e.unableToQuote
        return (
          <div key={it.specId} className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: '#EDE9E1' }}>
            <div className="flex gap-4 p-5">
              {it.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.imageUrl}
                  alt={it.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover flex-shrink-0"
                  style={{ backgroundColor: '#F5F2EC' }}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 flex-wrap">
                  <h2 className="text-base font-semibold" style={{ color: '#2C2C2A' }}>{it.name}</h2>
                  {it.area && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: '#9A7B4F', backgroundColor: '#F5EFE4' }}>{it.area}</span>
                  )}
                </div>
                {it.category && <p className="text-xs mt-0.5" style={{ color: '#8A877F' }}>{it.category}</p>}
                {it.description && <p className="text-sm mt-2 whitespace-pre-line" style={{ color: '#4A4A47' }}>{it.description}</p>}

                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {(it.quantity || it.unit) && <SpecPair label="Qty" value={[it.quantity, it.unit].filter(Boolean).join(' ')} />}
                  {it.dimensions && <SpecPair label="Dimensions" value={it.dimensions} />}
                  {it.itemSpecs.map(sp => (
                    <SpecPair key={sp.label} label={sp.label} value={sp.value} />
                  ))}
                </dl>

                {it.materials.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {it.materials.map((m, i) => (
                      <li key={i} className="text-xs" style={{ color: '#4A4A47' }}>• {m}</li>
                    ))}
                  </ul>
                )}
                {it.specNotes.trim() && (
                  <p className="text-xs mt-2 italic" style={{ color: '#8A877F' }}>{it.specNotes.trim()}</p>
                )}
              </div>
            </div>

            {/* Pricing inputs */}
            <div className="px-5 py-4 border-t" style={{ borderColor: '#EDE9E1', backgroundColor: '#FAFAF8' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`price-${it.specId}`} className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#8A877F' }}>
                    Your price (excl. VAT)
                  </label>
                  <div className="flex items-center rounded-lg border bg-white overflow-hidden" style={{ borderColor: disabled ? '#EDE9E1' : '#D8D3C8' }}>
                    <span className="pl-3 pr-1 text-sm" style={{ color: '#8A877F' }}>R</span>
                    <input
                      id={`price-${it.specId}`}
                      inputMode="decimal"
                      value={e.price}
                      disabled={disabled}
                      onChange={ev => update(it.specId, { price: ev.target.value.replace(/[^\d.]/g, '') })}
                      className="w-full py-2 pr-3 text-sm bg-transparent outline-none disabled:opacity-40"
                      style={{ color: '#2C2C2A' }}
                      aria-label={`Price for ${it.name} in Rand, excluding VAT`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor={`lead-${it.specId}`} className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#8A877F' }}>
                    Lead time / availability
                  </label>
                  <input
                    id={`lead-${it.specId}`}
                    value={e.leadTime}
                    disabled={disabled}
                    onChange={ev => update(it.specId, { leadTime: ev.target.value })}
                    className="w-full py-2 px-3 text-sm rounded-lg border bg-white outline-none disabled:opacity-40 focus:border-[#9A7B4F]"
                    style={{ borderColor: disabled ? '#EDE9E1' : '#D8D3C8', color: '#2C2C2A' }}
                    aria-label={`Lead time for ${it.name}`}
                  />
                </div>
              </div>
              <div className="mt-3">
                <label htmlFor={`note-${it.specId}`} className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#8A877F' }}>
                  Note (optional)
                </label>
                <input
                  id={`note-${it.specId}`}
                  value={e.note}
                  disabled={disabled}
                  onChange={ev => update(it.specId, { note: ev.target.value })}
                  className="w-full py-2 px-3 text-sm rounded-lg border bg-white outline-none disabled:opacity-40 focus:border-[#9A7B4F]"
                  style={{ borderColor: disabled ? '#EDE9E1' : '#D8D3C8', color: '#2C2C2A' }}
                  aria-label={`Note for ${it.name}`}
                />
              </div>
              <label className="mt-3 inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={e.unableToQuote}
                  onChange={ev => update(it.specId, { unableToQuote: ev.target.checked })}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#9A7B4F' }}
                />
                <span className="text-xs flex items-center gap-1" style={{ color: e.unableToQuote ? '#9A7B4F' : '#8A877F' }}>
                  <Ban size={12} /> I can&apos;t quote this item
                </span>
              </label>
            </div>
          </div>
        )
      })}

      {/* Overall message */}
      <div className="rounded-2xl bg-white border px-5 py-5" style={{ borderColor: '#EDE9E1' }}>
        <label htmlFor="overall-message" className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#8A877F' }}>
          Anything else? (delivery terms, quote validity, general notes)
        </label>
        <textarea
          id="overall-message"
          value={overallMessage}
          onChange={ev => setOverallMessage(ev.target.value)}
          rows={3}
          className="w-full py-2 px-3 text-sm rounded-lg border bg-white outline-none resize-y focus:border-[#9A7B4F]"
          style={{ borderColor: '#D8D3C8', color: '#2C2C2A' }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: '#F0C9C0', backgroundColor: '#FBEDEA' }}>
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#B4472F' }} />
          <p className="text-sm" style={{ color: '#8A3A26' }}>{error}</p>
        </div>
      )}

      {/* Submit */}
      <div className="sticky bottom-0 pt-2 pb-3" style={{ background: 'linear-gradient(to top, #F5F2EC 70%, transparent)' }}>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || filledCount === 0}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          style={{ backgroundColor: '#9A7B4F', color: '#ffffff' }}
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> Submitting…</>
          ) : (
            <>Submit pricing{filledCount > 0 ? ` · ${filledCount}/${items.length}` : ''}</>
          )}
        </button>
        <p className="text-center text-[11px] mt-2" style={{ color: '#8A877F' }}>
          Link valid until {expiryLabel} · you can resubmit if anything changes
        </p>
      </div>
    </div>
  )
}

function SpecPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="flex-shrink-0" style={{ color: '#8A877F' }}>{label}:</dt>
      <dd className="min-w-0" style={{ color: '#4A4A47' }}>{value}</dd>
    </div>
  )
}
