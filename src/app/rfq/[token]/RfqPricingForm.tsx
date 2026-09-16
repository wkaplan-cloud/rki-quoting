'use client'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, AlertTriangle, Ban, X, Lock, Unlock } from 'lucide-react'
import { CroppedImage } from '@/components/shared/CroppedImage'
import { parsePriceInput, formatZar } from '@/lib/rfq/price'
import type { ImageCropRect } from '@/lib/studio/types'

// One picture of the item, already reduced to what the designer actually
// framed: `crop` is the source-pixel rect the board shows, and the natural
// dimensions let CSS re-cut it exactly. Null crop = the whole image.
export interface RfqFormImage {
  url: string
  crop: ImageCropRect | null
  naturalWidth: number
  naturalHeight: number
}

export interface RfqFormItem {
  specId: string
  name: string
  area: string
  // The board image (cropped as framed) first, then any extra views
  images: RfqFormImage[]
  category: string
  description: string
  quantity: string
  dimensions: string
  materials: string[]
  scatters: string[]
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
// plus a "can't quote this" toggle. Merge model — a resubmission updates the
// items it carries and leaves the rest alone, so we prefill from what they
// last sent and coming back to fix one price can't cost them the others.
export function RfqPricingForm({
  token,
  businessName,
  boardName,
  supplierName,
  supplierEmail,
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
  /** Where the confirmation copy goes — blank if the RFQ has no address. */
  supplierEmail: string
  message: string
  items: RfqFormItem[]
  initialSubmissionMessage: string
  alreadySubmitted: boolean
  expiryLabel: string
}) {
  const [lightbox, setLightbox] = useState<{ image: RfqFormImage; name: string } | null>(null)
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
  // Whether the endpoint actually sent the supplier their copy
  const [emailedCopy, setEmailedCopy] = useState(false)
  // A submission with no prices on it is almost always a mistake, so it takes
  // a deliberate second press. See noPriceAck below.
  const [noPriceAck, setNoPriceAck] = useState(false)
  // A sheet that has already been sent opens read-only. Changing a price the
  // studio may have quoted a client on should be a deliberate act, not
  // something that happens by tapping a field.
  const [unlocked, setUnlocked] = useState(!alreadySubmitted)
  const [revisionReason, setRevisionReason] = useState('')
  const locked = !unlocked
  /** Revising a sent sheet — the studio is told what changed and why. */
  const isRevising = alreadySubmitted && unlocked

  function update(specId: string, patch: Partial<Entry>) {
    setEntries(prev => ({ ...prev, [specId]: { ...prev[specId], ...patch } }))
    setNoPriceAck(false)
  }

  // Every price read through the same parser the server uses, so the amount
  // shown under the field is the amount that will be stored — no guessing.
  const parsed = useMemo(() => {
    const out: Record<string, ReturnType<typeof parsePriceInput>> = {}
    for (const [specId, e] of Object.entries(entries)) {
      out[specId] = e.unableToQuote ? { value: null, error: null } : parsePriceInput(e.price)
    }
    return out
  }, [entries])

  /** Items carrying an actual amount — the only sense in which this form is "done". */
  const pricedCount = useMemo(
    () => Object.values(parsed).filter(p => p.value !== null).length,
    [parsed]
  )
  const unableCount = useMemo(
    () => Object.values(entries).filter(e => e.unableToQuote).length,
    [entries]
  )
  /** Anything typed that we can't read as money blocks the submit outright. */
  const badPriceCount = useMemo(
    () => Object.values(parsed).filter(p => p.error).length,
    [parsed]
  )
  const answeredCount = useMemo(
    () =>
      Object.entries(entries).filter(
        ([id, e]) => e.unableToQuote || parsed[id]?.value !== null || e.leadTime.trim() || e.note.trim()
      ).length,
    [entries, parsed]
  )
  // Nothing priced, while at least one item was still open to be priced. A
  // sheet where every item is declined is a complete answer; one where the
  // supplier declined a single item and wrote notes against the rest is the
  // case that went out as a finished quote with no money on it.
  const needsNoPriceConfirm = pricedCount === 0 && unableCount < items.length

  // Escape closes the lightbox, and the page behind it stays put while open
  useEffect(() => {
    if (!lightbox) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [lightbox])

  async function submit() {
    if (isRevising && !revisionReason.trim()) {
      setError('Please say what changed before resubmitting.')
      document.getElementById('revision-reason')?.focus()
      return
    }
    if (badPriceCount > 0) {
      setError(
        `Check the ${badPriceCount === 1 ? 'highlighted price' : `${badPriceCount} highlighted prices`} — ${badPriceCount === 1 ? "it can't" : "they can't"} be read as an amount.`
      )
      return
    }
    // First press on an all-blank sheet asks rather than sends
    if (needsNoPriceConfirm && !noPriceAck) {
      setNoPriceAck(true)
      setError(null)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/rfq/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: overallMessage,
          revisionReason: revisionReason.trim(),
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
      setEmailedCopy(json.emailedCopy === true)
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
          {/* Explicit {' '} either side: JSX trims every line of a text node
              that spans lines, so a space touching an expression is lost. */}
          {businessName}{' '}
          {/* A literal entity inside a JS string stays literal — real character. */}
          has your quote{emailedCopy ? ', and we’ve emailed you a copy of exactly what you submitted' : ''}.
          You can come back to this link any time before{' '}
          {expiryLabel}{' '}
          to add or change prices — your answers stay filled in, and nothing you&apos;ve already sent is lost.
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
        {alreadySubmitted && locked && (
          <div className="mt-3 rounded-lg px-3 py-3" style={{ backgroundColor: '#F5EFE4' }}>
            <p className="text-xs flex items-start gap-1.5" style={{ color: '#9A7B4F' }}>
              <Lock size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                You&apos;ve already sent this pricing, so it&apos;s locked.{' '}
                {businessName}{' '}
                may have quoted their client on it — unlock only if something has genuinely changed.
              </span>
            </p>
            <button
              type="button"
              onClick={() => setUnlocked(true)}
              className="mt-2.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              style={{ backgroundColor: '#9A7B4F', color: '#ffffff' }}
            >
              <Unlock size={13} /> Revise my pricing
            </button>
          </div>
        )}
        {isRevising && (
          <p className="text-xs mt-3 rounded-lg px-3 py-2" style={{ color: '#9A7B4F', backgroundColor: '#F5EFE4' }}>
            Editing unlocked. Change what you need and submit again — anything you leave alone stays exactly as
            it is, and{' '}
            {businessName}{' '}
            is told what changed.
          </p>
        )}
      </div>

      {/* Items */}
      {items.map(it => {
        const e = entries[it.specId]
        const disabled = e.unableToQuote
        // Locked covers everything; "can't quote" only greys that item's inputs
        const fieldsDisabled = locked || e.unableToQuote
        const priceState = parsed[it.specId] ?? { value: null, error: null }
        return (
          <div key={it.specId} className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: '#EDE9E1' }}>
            <div className="flex gap-4 p-5">
              {it.images.length > 0 && (
                // A 96px thumbnail is not enough to quote a joint detail or a
                // weave from — the supplier needs the picture at full size.
                // Extra views stack under the main one, same treatment.
                <div className="flex-shrink-0 flex flex-col gap-1.5">
                  {it.images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightbox({ image: img, name: it.name })}
                      aria-label={
                        i === 0
                          ? `View larger image of ${it.name}`
                          : `View extra image ${i} of ${it.name}`
                      }
                      className="rounded-lg overflow-hidden cursor-zoom-in transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ outlineColor: '#9A7B4F' }}
                    >
                      <CroppedImage
                        src={img.url}
                        alt={it.name}
                        crop={img.crop}
                        naturalWidth={img.naturalWidth}
                        naturalHeight={img.naturalHeight}
                        className={
                          i === 0 ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-20 h-14 sm:w-24 sm:h-16'
                        }
                        style={{ backgroundColor: '#F5F2EC' }}
                      />
                    </button>
                  ))}
                </div>
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
                  {it.quantity && <SpecPair label="Qty" value={it.quantity} />}
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
                {it.scatters.length > 0 && (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wide mt-2" style={{ color: '#8A877F' }}>Scatters</p>
                    <ul className="space-y-0.5">
                      {it.scatters.map((sc, i) => (
                        <li key={i} className="text-xs" style={{ color: '#4A4A47' }}>• {sc}</li>
                      ))}
                    </ul>
                  </>
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
                  {/* pl-12 is deliberate, not a guess: the text caret starts
                      where the padding ends, and at pl-7 it sat a few pixels
                      off the R, reading as a stray vertical line stuck to the
                      R rather than a cursor. 48px clears it while the value
                      still reads as a pair with the R — pl-14 leaves the
                      number looking adrift from it.
                      The R is absolutely positioned over a single input (the
                      same construction as the Pieces price field) so the
                      border and focus ring sit on the input itself, matching
                      Lead time and Note beside it. */}
                  <div className="relative">
                    <span
                      className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none ${
                        disabled ? 'opacity-40' : ''
                      }`}
                      style={{ color: '#8A877F' }}
                    >
                      R
                    </span>
                    <input
                      id={`price-${it.specId}`}
                      inputMode="decimal"
                      value={e.price}
                      disabled={fieldsDisabled}
                      // Spaces, commas and dots all survive typing — a price is
                      // written "12 500,00" here, and the line under the field
                      // shows how it was read. Only genuinely impossible
                      // characters are dropped as you go.
                      onChange={ev => update(it.specId, { price: ev.target.value.replace(/[^\d.,\s]/g, '') })}
                      aria-invalid={priceState.error ? true : undefined}
                      aria-describedby={`price-read-${it.specId}`}
                      className={`w-full py-2 pl-12 pr-3 text-sm rounded-lg border bg-white outline-none transition-colors disabled:opacity-40 focus:ring-2 ${
                        priceState.error
                          ? 'border-[#D98A72] focus:border-[#B4472F] focus:ring-[#B4472F]/25'
                          : 'focus:border-[#9A7B4F] focus:ring-[#9A7B4F]/25 ' +
                            (disabled ? 'border-[#EDE9E1]' : 'border-[#D8D3C8]')
                      }`}
                      style={{ color: '#2C2C2A' }}
                      aria-label={`Price for ${it.name} in Rand, excluding VAT`}
                    />
                  </div>
                  {/* Reading the amount back is the whole safety net: a price
                      that can't be stored can never look accepted again. */}
                  <p
                    id={`price-read-${it.specId}`}
                    className="text-[11px] mt-1 min-h-[15px]"
                    style={{ color: priceState.error ? '#B4472F' : '#8A877F' }}
                  >
                    {disabled
                      ? ''
                      : priceState.error
                        ? priceState.error
                        : priceState.value !== null
                          ? `Reads as ${formatZar(priceState.value)}`
                          : ''}
                  </p>
                </div>
                <div>
                  <label htmlFor={`lead-${it.specId}`} className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#8A877F' }}>
                    Lead time / availability
                  </label>
                  <input
                    id={`lead-${it.specId}`}
                    value={e.leadTime}
                    disabled={fieldsDisabled}
                    onChange={ev => update(it.specId, { leadTime: ev.target.value })}
                    className={`w-full py-2 px-3 text-sm rounded-lg border bg-white outline-none transition-colors disabled:opacity-40 focus:border-[#9A7B4F] focus:ring-2 focus:ring-[#9A7B4F]/25 ${
                      disabled ? 'border-[#EDE9E1]' : 'border-[#D8D3C8]'
                    }`}
                    style={{ color: '#2C2C2A' }}
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
                  disabled={fieldsDisabled}
                  onChange={ev => update(it.specId, { note: ev.target.value })}
                  className={`w-full py-2 px-3 text-sm rounded-lg border bg-white outline-none transition-colors disabled:opacity-40 focus:border-[#9A7B4F] focus:ring-2 focus:ring-[#9A7B4F]/25 ${
                    disabled ? 'border-[#EDE9E1]' : 'border-[#D8D3C8]'
                  }`}
                  style={{ color: '#2C2C2A' }}
                  aria-label={`Note for ${it.name}`}
                />
              </div>
              <label className="mt-3 inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={e.unableToQuote}
                  disabled={locked}
                  onChange={ev => update(it.specId, { unableToQuote: ev.target.checked })}
                  className="w-4 h-4 rounded disabled:opacity-40"
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
          disabled={locked}
          onChange={ev => setOverallMessage(ev.target.value)}
          rows={3}
          className="w-full py-2 px-3 text-sm rounded-lg border border-[#D8D3C8] bg-white outline-none resize-y transition-colors disabled:opacity-40 focus:border-[#9A7B4F] focus:ring-2 focus:ring-[#9A7B4F]/25"
          style={{ color: '#2C2C2A' }}
        />
      </div>

      {isRevising && (
        <div className="rounded-2xl bg-white border px-5 py-5" style={{ borderColor: '#E8D3A8' }}>
          <label htmlFor="revision-reason" className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#9A7B4F' }}>
            What&apos;s changed? (required)
          </label>
          <textarea
            id="revision-reason"
            value={revisionReason}
            onChange={ev => setRevisionReason(ev.target.value)}
            rows={2}
            className="w-full py-2 px-3 text-sm rounded-lg border border-[#D8D3C8] bg-white outline-none resize-y transition-colors focus:border-[#9A7B4F] focus:ring-2 focus:ring-[#9A7B4F]/25"
            style={{ color: '#2C2C2A' }}
          />
          <p className="text-[11px] mt-1.5" style={{ color: '#8A877F' }}>
            Sent to{' '}
            {businessName}{' '}
            with the list of what you changed — a line like &ldquo;leather up 8% from 1 October&rdquo; saves a
            phone call.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: '#F0C9C0', backgroundColor: '#FBEDEA' }}>
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#B4472F' }} />
          <p className="text-sm" style={{ color: '#8A3A26' }}>{error}</p>
        </div>
      )}

      {/* Submit */}
      {/* Solid, not a gradient: this bar now carries lines of text above the
          button, and a gradient that fades to transparent at the top let the
          item behind it read straight through them. The fade is a strip of its
          own, sitting just above the solid area. */}
      <div className="sticky bottom-0 pt-2 pb-3 relative" style={{ backgroundColor: '#F5F2EC' }}>
        <div
          aria-hidden="true"
          className="absolute left-0 right-0 pointer-events-none"
          style={{ bottom: '100%', height: '20px', background: 'linear-gradient(to top, #F5F2EC, transparent)' }}
        />
        {noPriceAck && needsNoPriceConfirm && (
          <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5 mb-2" style={{ borderColor: '#E8D3A8', backgroundColor: '#FBF4E4' }}>
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#9A7B4F' }} />
            <p className="text-sm" style={{ color: '#7A5F35' }}>
              You haven&apos;t entered a price on any item. Notes and lead times on their own aren&apos;t a
              quote — add an amount in the <strong>Your price</strong> box, or press again to send without pricing.
            </p>
          </div>
        )}
        {locked && (
          <p className="text-center text-[11px] mb-2" style={{ color: '#8A877F' }}>
            Submitted &mdash; use <strong style={{ color: '#4A4A47' }}>Revise my pricing</strong> at the top to
            change anything
          </p>
        )}
        {!locked && supplierEmail.trim() && (
          // Above the button, not below it: knowing a receipt is coming is
          // what makes a supplier check it against what they meant to send,
          // and that only helps before the press.
          <p className="text-center text-[11px] mb-2" style={{ color: '#8A877F' }}>
            A copy of the pricing above will be emailed to you at{' '}
            <span style={{ color: '#4A4A47' }}>{supplierEmail.trim()}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || answeredCount === 0 || locked}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          style={{ backgroundColor: noPriceAck && needsNoPriceConfirm ? '#8A877F' : '#9A7B4F', color: '#ffffff' }}
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> Submitting…</>
          ) : noPriceAck && needsNoPriceConfirm ? (
            <>Send without pricing</>
          ) : (
            <>
              Submit pricing
              {pricedCount > 0 ? ` · ${pricedCount} of ${items.length} priced` : ''}
            </>
          )}
        </button>
        <p className="text-center text-[11px] mt-2" style={{ color: '#8A877F' }}>
          Link valid until {expiryLabel} · come back any time to add or change prices
        </p>
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.name}
          onClick={() => setLightbox(null)}
          // --crop-avail-h is the height the image has to fit inside: the
          // viewport less this overlay's own padding. CroppedImage turns it
          // into a width cap so the picture scales down instead of clipping.
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/80 cursor-zoom-out [--crop-avail-h:calc(100vh-2rem)] sm:[--crop-avail-h:calc(100vh-4rem)]"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close image"
            autoFocus
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
          {/* Definite width AND height, not shrink-to-fit: the image inside
              sizes itself against this box, so a percentage max-height has to
              have something real to resolve against */}
          <span
            onClick={ev => ev.stopPropagation()}
            className="w-full h-full flex items-center justify-center cursor-default"
          >
            <CroppedImage
              src={lightbox.image.url}
              alt={lightbox.name}
              crop={lightbox.image.crop}
              naturalWidth={lightbox.image.naturalWidth}
              naturalHeight={lightbox.image.naturalHeight}
              fit="contain"
              className="max-w-full max-h-full rounded-lg"
            />
          </span>
          <p className="absolute bottom-4 left-0 right-0 text-center text-xs px-4 text-white/70">
            {lightbox.name}
          </p>
        </div>
      )}
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
