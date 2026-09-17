'use client'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, AlertTriangle, Ban, X, Lock, Unlock } from 'lucide-react'
import { CroppedImage } from '@/components/shared/CroppedImage'
import { parsePriceInput, parseQuantityInput, formatZar, formatQuantity } from '@/lib/rfq/price'
import type { ImageCropRect, MaterialQuantityAsk, ComponentAsk } from '@/lib/studio/types'

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
  /**
   * Whether this supplier is being asked for the piece itself. False for a
   * component supplier — the cushion workroom, the stone yard — who gets the
   * picture and the name, and then only their own part. They are not quoting
   * the sofa, and showing them its spec only invites them to price it.
   */
  ownsItem: boolean
  // Everything from here to specNotes describes the item, and is shown only
  // when ownsItem
  category: string
  description: string
  quantity: string
  dimensions: string
  materials: string[]
  /** Category specs, already resolved to their human labels + units. */
  itemSpecs: { label: string; value: string }[]
  specNotes: string
  /** Cloth on the item to measure. Empty unless ownsItem. */
  itemMaterials: RfqAsk[]
  /** Things this supplier makes, prices and counts. */
  components: RfqComponent[]
  prefill: { price: number | null; leadTime: string; note: string; unableToQuote: boolean }
  sort: number
}

/**
 * A material the supplier is asked to measure, plus whatever they last said.
 * The designer specifies which cloth goes on a piece; only the maker knows how
 * much it takes, and they normally leave it blank on the board.
 */
export interface RfqAsk extends MaterialQuantityAsk {
  /** From this supplier's last submission, or null if never answered. */
  prefill: number | null
}

/** One thing this supplier makes: priced, counted, and measured for cloth. */
export interface RfqComponent extends Omit<ComponentAsk, 'materials'> {
  materials: RfqAsk[]
  prefillPrice: number | null
  prefillQuantity: number | null
}

interface Entry {
  /** The item's own price. Unused on a component supplier's sheet. */
  price: string
  leadTime: string
  note: string
  unableToQuote: boolean
  /** Typed amounts, keyed by ask key — cloth measures and component counts. */
  quantities: Record<string, string>
  /** Typed prices, keyed by component key. */
  prices: Record<string, string>
}

/** Every key on an item that takes a quantity, in the order they are shown. */
function quantityKeys(it: RfqFormItem): { key: string; unit: string; prefill: number | null }[] {
  return [
    ...it.itemMaterials.map(m => ({ key: m.key, unit: m.unit, prefill: m.prefill })),
    ...it.components.flatMap(c => [
      { key: c.key, unit: c.unit, prefill: c.prefillQuantity },
      ...c.materials.map(m => ({ key: m.key, unit: m.unit, prefill: m.prefill })),
    ]),
  ]
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
          quantities: Object.fromEntries(
            quantityKeys(it).map(q => [q.key, q.prefill != null ? String(q.prefill) : ''])
          ),
          prices: Object.fromEntries(
            it.components.map(c => [c.key, c.prefillPrice != null ? String(c.prefillPrice) : ''])
          ),
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
  // Only an amount is worth protecting. A sheet that came back with notes and
  // no prices is an unfinished one, not a quote the studio could have acted
  // on, so it opens ready to type in — locking it would ask a supplier to
  // justify filling in the blanks they left.
  const anyPriceOnRecord = items.some(it => it.prefill.price != null)
  const [unlocked, setUnlocked] = useState(false)
  const [revisionReason, setRevisionReason] = useState('')
  const lockable = alreadySubmitted && anyPriceOnRecord
  const locked = lockable && !unlocked

  function update(specId: string, patch: Partial<Entry>) {
    setEntries(prev => ({ ...prev, [specId]: { ...prev[specId], ...patch } }))
    setNoPriceAck(false)
  }

  function updateQuantity(specId: string, key: string, value: string) {
    setEntries(prev => ({
      ...prev,
      [specId]: { ...prev[specId], quantities: { ...prev[specId].quantities, [key]: value } },
    }))
    setNoPriceAck(false)
  }

  function updateComponentPrice(specId: string, key: string, value: string) {
    setEntries(prev => ({
      ...prev,
      [specId]: { ...prev[specId], prices: { ...prev[specId].prices, [key]: value } },
    }))
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

  // Same read-it-back safety net as the price: a quantity that can't be
  // stored must never look accepted.
  const parsedQty = useMemo(() => {
    const out: Record<string, ReturnType<typeof parseQuantityInput>> = {}
    for (const it of items) {
      const e = entries[it.specId]
      for (const q of quantityKeys(it)) {
        out[`${it.specId}|${q.key}`] = e?.unableToQuote
          ? { value: null, error: null }
          : parseQuantityInput(e?.quantities[q.key] ?? '')
      }
    }
    return out
  }, [items, entries])

  // A component's price reads through the same parser as the item's, so a
  // scatter quoted at "R 450,00" is stored as the amount shown back on screen.
  const parsedComponentPrice = useMemo(() => {
    const out: Record<string, ReturnType<typeof parsePriceInput>> = {}
    for (const it of items) {
      const e = entries[it.specId]
      for (const c of it.components) {
        out[`${it.specId}|${c.key}`] = e?.unableToQuote
          ? { value: null, error: null }
          : parsePriceInput(e?.prices[c.key] ?? '')
      }
    }
    return out
  }, [items, entries])

  const badQtyCount = useMemo(
    () => Object.values(parsedQty).filter(q => q.error).length,
    [parsedQty]
  )

  /**
   * Items carrying an actual amount — the only sense in which this form is
   * "done". A component supplier's amount is on their components, not on the
   * item, so both count.
   */
  const pricedCount = useMemo(
    () =>
      items.filter(
        it =>
          parsed[it.specId]?.value !== null ||
          it.components.some(c => parsedComponentPrice[`${it.specId}|${c.key}`]?.value !== null)
      ).length,
    [items, parsed, parsedComponentPrice]
  )
  const unableCount = useMemo(
    () => Object.values(entries).filter(e => e.unableToQuote).length,
    [entries]
  )
  /** Anything typed that we can't read as money blocks the submit outright. */
  const badPriceCount = useMemo(
    () =>
      Object.values(parsed).filter(p => p.error).length +
      Object.values(parsedComponentPrice).filter(p => p.error).length,
    [parsed, parsedComponentPrice]
  )
  const answeredCount = useMemo(
    () =>
      Object.entries(entries).filter(
        ([id, e]) =>
          e.unableToQuote ||
          parsed[id]?.value !== null ||
          e.leadTime.trim() ||
          e.note.trim() ||
          // Quantities on their own are an answer: a maker who can't price
          // until the cloth is costed can still send back what the piece takes.
          Object.values(e.quantities).some(v => v.trim()) ||
          Object.values(e.prices).some(v => v.trim())
      ).length,
    [entries, parsed]
  )
  /**
   * Items the supplier has already put a price against. Those are the ones
   * locked — anything they left blank stays editable, so finishing an
   * incomplete sheet never needs unlocking.
   */
  const isItemLocked = (it: RfqFormItem) => locked && it.prefill.price != null

  /**
   * Same rule one level down: an answer already sent is locked, an empty box
   * stays open. A supplier who priced the piece and forgot the yardage can
   * come back and add it without unlocking anything.
   */
  const isAnswerLocked = (prefill: number | null) => locked && prefill != null

  /** True once a price already on record has actually been altered. */
  const changedAnExistingPrice = useMemo(
    () =>
      items.some(it => {
        const e = entries[it.specId]
        if (!e) return false
        // Anything already sent that has since moved is a revision in its own
        // right — the studio may have ordered cloth, or quoted a client,
        // against the figure this supplier gave last time.
        const movedAQuantity = quantityKeys(it).some(
          q => q.prefill != null && parsedQty[`${it.specId}|${q.key}`]?.value !== q.prefill
        )
        if (movedAQuantity) return true
        const movedAComponentPrice = it.components.some(
          c =>
            c.prefillPrice != null &&
            parsedComponentPrice[`${it.specId}|${c.key}`]?.value !== c.prefillPrice
        )
        if (movedAComponentPrice) return true
        if (it.prefill.price == null) return false
        return (
          parsed[it.specId]?.value !== it.prefill.price ||
          e.leadTime !== it.prefill.leadTime ||
          e.note !== it.prefill.note ||
          e.unableToQuote !== it.prefill.unableToQuote
        )
      }),
    [items, entries, parsed, parsedQty, parsedComponentPrice]
  )
  // Say why only when something already quoted on has moved. Adding prices to
  // items left blank is not a revision.
  const needsReason = changedAnExistingPrice

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
    if (needsReason && !revisionReason.trim()) {
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
    if (badQtyCount > 0) {
      setError(
        `Check the ${badQtyCount === 1 ? 'highlighted quantity' : `${badQtyCount} highlighted quantities`} — ${badQtyCount === 1 ? "it can't" : "they can't"} be read as a number.`
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
            // Every box on the sheet, answered or not: the server stores the
            // set as it stands, so clearing an answer clears it there too.
            lines: quantityKeys(it).map(q => ({
              key: q.key,
              quantity: entries[it.specId].quantities[q.key] ?? '',
              price: entries[it.specId].prices[q.key] ?? '',
            })),
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
          {items.length === 1 ? ' item' : ' items'} below. Prices are{' '}
          <strong style={{ color: '#4A4A47' }}>for one of each item</strong>, not for the whole quantity
          — where an item is needed more than once, its quantity is shown beside the box. Where an item
          takes fabric, leather or stone, please also give the quantity it takes of each.
        </p>
        {supplierEmail.trim() && (
          // Also said above the submit button. Here because a supplier wants
          // to know there will be a record of what they sent BEFORE they start
          // typing prices, not after they have committed to them.
          <p className="text-xs mt-3 rounded-lg px-3 py-2" style={{ color: '#4A4A47', backgroundColor: '#F5F2EC' }}>
            Once you submit, we&apos;ll email a copy of everything you entered to{' '}
            <span style={{ color: '#2C2C2A', fontWeight: 600 }}>{supplierEmail.trim()}</span>{' '}
            so you have a record of it — and you can reopen this link any time before{' '}
            {expiryLabel}{' '}
            to change anything.
          </p>
        )}
        {message.trim() && (
          <p className="text-sm mt-3 pt-3 border-t whitespace-pre-line" style={{ color: '#4A4A47', borderColor: '#EDE9E1' }}>
            {message.trim()}
          </p>
        )}
        {locked && (
          <div className="mt-3 rounded-lg px-3 py-3" style={{ backgroundColor: '#F5EFE4' }}>
            <p className="text-xs flex items-start gap-1.5" style={{ color: '#9A7B4F' }}>
              <Lock size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                The prices you&apos;ve already sent are locked, because{' '}
                {businessName}{' '}
                may have quoted their client on them. Anything you left blank is still open to fill in.
              </span>
            </p>
            <button
              type="button"
              onClick={() => setUnlocked(true)}
              className="mt-2.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              style={{ backgroundColor: '#9A7B4F', color: '#ffffff' }}
            >
              <Unlock size={13} /> Change a price I&apos;ve sent
            </button>
          </div>
        )}
        {lockable && unlocked && (
          <p className="text-xs mt-3 rounded-lg px-3 py-2" style={{ color: '#9A7B4F', backgroundColor: '#F5EFE4' }}>
            Everything is editable. Anything you leave alone stays exactly as it is, and{' '}
            {businessName}{' '}
            is told what you changed.
          </p>
        )}
        {alreadySubmitted && !lockable && (
          <p className="text-xs mt-3 rounded-lg px-3 py-2" style={{ color: '#9A7B4F', backgroundColor: '#F5EFE4' }}>
            Everything you sent last time is filled in below. You haven&apos;t priced anything yet — add your
            amounts in the <strong>Your price</strong> boxes and submit again.
          </p>
        )}
      </div>

      {/* Items */}
      {items.map(it => {
        const e = entries[it.specId]
        const disabled = e.unableToQuote
        // Only a price already on record is locked; blanks stay editable
        const fieldsDisabled = isItemLocked(it) || e.unableToQuote
        const priceState = parsed[it.specId] ?? { value: null, error: null }
        // "4", "4 off" and "4 required" all mean four. Anything that isn't a
        // plain count is treated as one, because multiplying a price by a
        // number nobody can read is worse than not showing a total at all.
        const unitCount = parseFloat(it.quantity)
        const multiple = Number.isFinite(unitCount) && unitCount > 1 ? unitCount : null
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
                {/* The item's own spec, for whoever is making the item. A
                    component supplier is shown the picture and the name so
                    they know what their part goes on, and nothing more: they
                    are not quoting the piece, and its dimensions, its cloth
                    and its notes are not theirs to answer for. */}
                {it.ownsItem ? (
                  <>
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
                    {it.specNotes.trim() && (
                      <p className="text-xs mt-2 italic" style={{ color: '#8A877F' }}>{it.specNotes.trim()}</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs mt-1" style={{ color: '#8A877F' }}>
                    Someone else is making this piece. You&apos;re being asked only for the parts below
                    — the picture is for context.
                  </p>
                )}
              </div>
            </div>

            {/* Pricing inputs */}
            <div className="px-5 py-4 border-t" style={{ borderColor: '#EDE9E1', backgroundColor: '#FAFAF8' }}>
              {/* The piece's own price, for whoever is making the piece. A
                  component supplier is not quoting it, so they are not given a
                  box for it — being asked for a sofa price is exactly the
                  mistake this whole split exists to prevent. */}
              <div className={it.ownsItem ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
                {it.ownsItem && (
                <div>
                  <label htmlFor={`price-${it.specId}`} className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#8A877F' }}>
                    Your price each (excl. VAT)
                    {multiple && (
                      // Right where they are about to type, not in the spec
                      // list above it: a supplier reading "Qty 4" at the top of
                      // the card and a bare "Your price" down here has been
                      // given every reason to send one number for all four.
                      <span className="ml-1.5 normal-case tracking-normal font-medium" style={{ color: '#9A7B4F' }}>
                        — for one of {unitCount}
                      </span>
                    )}
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
                          ? multiple
                            ? `Reads as ${formatZar(priceState.value)} each · ${formatZar(priceState.value * multiple)} for ${unitCount}`
                            : `Reads as ${formatZar(priceState.value)}`
                          : ''}
                  </p>
                </div>
                )}
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
              {/* Material quantities. One box per cloth, generated from the
                  spec: the designer says WHICH cloth, the maker is the only
                  one who knows how much of it the piece eats. Two fabrics on
                  one piece are two orders from two possibly different houses,
                  so a single combined figure is unorderable — hence a box
                  each rather than one field per item. */}
              {it.itemMaterials.length > 0 && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: '#EDE9E1' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8A877F' }}>
                    Quantities needed
                  </p>
                  <p className="text-[11px] mt-1 mb-2.5" style={{ color: '#8A877F' }}>
                    How much this item takes of each material below. Each one is ordered on its own, so
                    please give them separately rather than as one total.
                  </p>
                  <div className="space-y-2.5">
                    {it.itemMaterials.map(m => (
                      <QuantityRow
                        key={m.key}
                        domId={askDomId(it.specId, m.key)}
                        label={m.label}
                        hint={m.supplierName ? `From ${m.supplierName}` : ''}
                        unit={m.unit}
                        designerQuantity={m.designerQuantity}
                        value={e.quantities[m.key] ?? ''}
                        state={parsedQty[`${it.specId}|${m.key}`] ?? EMPTY_PARSE}
                        disabled={isAnswerLocked(m.prefill) || e.unableToQuote}
                        dimmed={disabled}
                        onChange={v => updateQuantity(it.specId, m.key, v)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* The supplier's own components — the scatters they sew, the
                  stone they cut. Each is priced by the size it is made in and
                  counted on its own, because that is how it is ordered: two
                  sizes of scatter are two different things, not one line with
                  an average price. */}
              {it.components.length > 0 && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: '#EDE9E1' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8A877F' }}>
                    {it.ownsItem ? 'Also on this piece' : 'What we need from you'}
                  </p>
                  <div className="mt-2.5 space-y-3">
                    {it.components.map(c => {
                      const pState = parsedComponentPrice[`${it.specId}|${c.key}`] ?? EMPTY_PARSE
                      const countState = parsedQty[`${it.specId}|${c.key}`] ?? EMPTY_PARSE
                      const priceDisabled = isAnswerLocked(c.prefillPrice) || e.unableToQuote
                      const priceId = `cprice-${askDomId(it.specId, c.key)}`
                      const perOne = c.unit === 'each' ? 'each' : `per ${c.unit}`
                      return (
                        <div
                          key={c.key}
                          className="rounded-xl border px-3 py-3"
                          style={{ borderColor: '#EDE9E1', backgroundColor: '#ffffff' }}
                        >
                          <p className="text-sm font-medium" style={{ color: '#2C2C2A' }}>{c.label}</p>
                          {c.details.trim() && (
                            <p className="text-xs mt-0.5" style={{ color: '#8A877F' }}>{c.details.trim()}</p>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                            <div>
                              <label
                                htmlFor={priceId}
                                className="block text-[11px] font-semibold uppercase tracking-wide mb-1"
                                style={{ color: '#8A877F' }}
                              >
                                Your price {perOne} (excl. VAT)
                              </label>
                              <div className="relative">
                                <span
                                  className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none ${
                                    priceDisabled ? 'opacity-40' : ''
                                  }`}
                                  style={{ color: '#8A877F' }}
                                >
                                  R
                                </span>
                                <input
                                  id={priceId}
                                  inputMode="decimal"
                                  value={e.prices[c.key] ?? ''}
                                  disabled={priceDisabled}
                                  onChange={ev =>
                                    updateComponentPrice(
                                      it.specId,
                                      c.key,
                                      ev.target.value.replace(/[^\d.,\s]/g, '')
                                    )
                                  }
                                  aria-invalid={pState.error ? true : undefined}
                                  aria-describedby={`${priceId}-read`}
                                  className={`w-full py-2 pl-12 pr-3 text-sm rounded-lg border bg-white outline-none transition-colors disabled:opacity-40 focus:ring-2 ${
                                    pState.error
                                      ? 'border-[#D98A72] focus:border-[#B4472F] focus:ring-[#B4472F]/25'
                                      : 'focus:border-[#9A7B4F] focus:ring-[#9A7B4F]/25 ' +
                                        (disabled ? 'border-[#EDE9E1]' : 'border-[#D8D3C8]')
                                  }`}
                                  style={{ color: '#2C2C2A' }}
                                  aria-label={`Price ${perOne} for ${c.label}, excluding VAT`}
                                />
                              </div>
                              <p
                                id={`${priceId}-read`}
                                className="text-[11px] mt-1 min-h-[15px]"
                                style={{ color: pState.error ? '#B4472F' : '#8A877F' }}
                              >
                                {disabled
                                  ? ''
                                  : pState.error
                                    ? pState.error
                                    : pState.value !== null
                                      ? `Reads as ${formatZar(pState.value)} ${perOne}`
                                      : ''}
                              </p>
                            </div>
                            <QuantityRow
                              stacked
                              domId={askDomId(it.specId, c.key)}
                              label={c.unit === 'each' ? 'How many' : 'Area needed'}
                              hint=""
                              unit={c.unit === 'each' ? '' : c.unit}
                              designerQuantity={c.designerQuantity}
                              value={e.quantities[c.key] ?? ''}
                              state={countState}
                              disabled={isAnswerLocked(c.prefillQuantity) || e.unableToQuote}
                              dimmed={disabled}
                              onChange={v => updateQuantity(it.specId, c.key, v)}
                            />
                          </div>

                          {c.materials.length > 0 && (
                            <div className="mt-3 pt-3 border-t space-y-2.5" style={{ borderColor: '#F0EDE6' }}>
                              <p className="text-[11px]" style={{ color: '#8A877F' }}>
                                Cloth for this — how much it takes of each:
                              </p>
                              {c.materials.map(m => (
                                <QuantityRow
                                  key={m.key}
                                  domId={askDomId(it.specId, m.key)}
                                  label={m.label}
                                  hint={m.supplierName ? `From ${m.supplierName}` : ''}
                                  unit={m.unit}
                                  designerQuantity={m.designerQuantity}
                                  value={e.quantities[m.key] ?? ''}
                                  state={parsedQty[`${it.specId}|${m.key}`] ?? EMPTY_PARSE}
                                  disabled={isAnswerLocked(m.prefill) || e.unableToQuote}
                                  dimmed={disabled}
                                  onChange={v => updateQuantity(it.specId, m.key, v)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
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

      {needsReason && (
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
            Prices you&apos;ve sent are locked &mdash; use{' '}
            <strong style={{ color: '#4A4A47' }}>Change a price I&apos;ve sent</strong> at the top
          </p>
        )}
        {supplierEmail.trim() && (
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
          disabled={submitting || answeredCount === 0}
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
          {/* z-10 is load-bearing: a cropped picture renders through
              CroppedImage as a POSITIONED span, which paints in the same layer
              as this absolutely-positioned button and, coming later in the
              DOM, on top of it. The close button was therefore unclickable on
              every image the designer had framed — which is most of them. */}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close image"
            autoFocus
            className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
          {/* Definite width AND height, not shrink-to-fit: the image inside
              sizes itself against this box, so a percentage max-height has to
              have something real to resolve against.

              It deliberately does NOT swallow clicks. It fills the overlay, so
              stopping propagation here stopped it everywhere — the dark margin
              around the picture looked dismissable, carried the zoom-out
              cursor, and did nothing. Clicking anywhere closes now, which is
              what the cursor has been promising all along. */}
          <span className="w-full h-full flex items-center justify-center">
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

const EMPTY_PARSE = { value: null, error: null } as const

/** Colons and dots in a key are fine in an id but not in a selector. */
const askDomId = (specId: string, key: string) =>
  `qty-${specId}-${key.replace(/[^a-zA-Z0-9]/g, '-')}`

/**
 * One "how much of this?" box: label on the left, figure and its unit on the
 * right, and the reading back underneath. Shared by the cloth on an item, the
 * cloth on a scatter, and the count of the scatters themselves, so a supplier
 * meets the same control wherever they are asked for a number.
 */
function QuantityRow({
  domId,
  label,
  hint,
  unit,
  designerQuantity,
  value,
  state,
  disabled,
  dimmed,
  stacked,
  onChange,
}: {
  domId: string
  label: string
  hint: string
  /** Blank for a plain count — "4 each" is not how anyone writes four. */
  unit: string
  designerQuantity: string
  value: string
  state: { value: number | null; error: string | null }
  disabled: boolean
  /** The whole item is off ("can't quote"), so the reading is hidden. */
  dimmed: boolean
  /** Label above the field instead of beside it, for narrow columns. */
  stacked?: boolean
  onChange: (value: string) => void
}) {
  const designer = designerQuantity.trim()
  const designerNum = parseFloat(designer)
  // The designer usually leaves the figure blank. When they have put one
  // down, saying so beats silently overwriting it — and a gap between the two
  // is worth one line of amber, not a blocked submission.
  const over = Number.isFinite(designerNum) && state.value !== null && state.value !== designerNum

  const field = (
    <>
      <div className="relative">
        <input
          id={domId}
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={ev => onChange(ev.target.value.replace(/[^\d.,\s]/g, ''))}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={`${domId}-read`}
          className={`w-full py-2 pl-3 text-sm rounded-lg border bg-white outline-none transition-colors disabled:opacity-40 focus:ring-2 ${
            unit ? 'pr-10' : 'pr-3'
          } ${
            state.error
              ? 'border-[#D98A72] focus:border-[#B4472F] focus:ring-[#B4472F]/25'
              : 'focus:border-[#9A7B4F] focus:ring-[#9A7B4F]/25 ' +
                (dimmed ? 'border-[#EDE9E1]' : 'border-[#D8D3C8]')
          }`}
          style={{ color: '#2C2C2A' }}
        />
        {unit && (
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none ${
              disabled ? 'opacity-40' : ''
            }`}
            style={{ color: '#8A877F' }}
            aria-hidden="true"
          >
            {unit}
          </span>
        )}
      </div>
      <p
        id={`${domId}-read`}
        className="text-[11px] mt-1 min-h-[15px]"
        style={{ color: state.error ? '#B4472F' : over ? '#9A7B4F' : '#8A877F' }}
      >
        {dimmed
          ? ''
          : state.error
            ? state.error
            : over
              ? `Reads as ${formatQuantity(state.value!, unit)} — the spec allowed ${designer} ${unit}`.trim()
              : state.value !== null
                ? `Reads as ${formatQuantity(state.value, unit)}`.trim()
                : ''}
      </p>
    </>
  )

  if (stacked) {
    return (
      <div>
        <label
          htmlFor={domId}
          className="block text-[11px] font-semibold uppercase tracking-wide mb-1"
          style={{ color: '#8A877F' }}
        >
          {label}
          {designer && (
            <span className="ml-1.5 normal-case tracking-normal font-medium" style={{ color: '#9A7B4F' }}>
              — spec says {designer}
            </span>
          )}
        </label>
        {field}
      </div>
    )
  }

  return (
    <div className="sm:flex sm:items-start sm:gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={domId} className="block text-xs sm:pt-2" style={{ color: '#2C2C2A' }}>
          {label}
        </label>
        {(hint || designer) && (
          <p className="text-[11px] mt-0.5" style={{ color: '#8A877F' }}>
            {hint}
            {hint && designer ? ' · ' : ''}
            {designer ? `${designer} ${unit} allowed on the spec`.trim() : ''}
          </p>
        )}
      </div>
      <div className="mt-1 sm:mt-0 w-full sm:w-40 flex-shrink-0">{field}</div>
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
