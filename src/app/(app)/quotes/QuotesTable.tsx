'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, ArrowRight, Check, MessageSquare, AlertTriangle, Trash2 } from 'lucide-react'
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
  /** Whole-submission note from the supplier (terms, validity), not per item. */
  supplierMessage: string | null
  /** Set once this price has been carried onto a quote's line item. */
  appliedToLineItemId: string | null
  /** "26075 · Gianna · Lounge sofa" — the quote it went onto. */
  appliedTo: string | null
  /** The amount as applied, which is what the quote still carries. */
  appliedPrice: number | null
  /**
   * Parts whose applied price has since moved, for a supplier who quoted
   * components rather than the piece — the row's own appliedPrice is the
   * item's and says nothing about a scatter.
   */
  staleComponents: string[]
  /** How many of this quote's parts are already on a line item. */
  appliedComponentCount: number
  /** The supplier has since changed a price the studio already used. */
  stale: boolean
  createdAt: string
}

/**
 * The three states a received price can be in, in the order they need a
 * designer's attention.
 *
 * Two sections would have been the obvious split — used and not used — but a
 * price that WAS used and has since been changed by the supplier belongs in
 * neither: filed under "on a quote" it reads as settled, and that is the one
 * case that quietly costs money, because a client is holding a quote at the
 * old number. So it gets a section of its own, at the top.
 */
interface Section {
  key: string
  title: string
  blurb: string
  tone: string
  rows: QuoteRow[]
}

function groupRows(rows: QuoteRow[]): Section[] {
  // Used at all: the item's price carried onto a line, or any of its parts
  const used = (r: QuoteRow) => !!r.appliedToLineItemId || r.appliedComponentCount > 0
  const changed = rows.filter(r => r.stale)
  const waiting = rows.filter(r => !r.stale && !used(r))
  const onQuote = rows.filter(r => !r.stale && used(r))
  return [
    {
      key: 'changed',
      title: 'Changed since you used them',
      blurb: 'The supplier has moved a price you have already put on a quote — the client is holding the old number.',
      tone: '#B4472F',
      rows: changed,
    },
    {
      key: 'waiting',
      title: 'Not on a quote yet',
      blurb: 'Prices that have come in and have not been used anywhere.',
      tone: '#9A7B4F',
      rows: waiting,
    },
    {
      key: 'applied',
      title: 'On a quote',
      blurb: 'Already carried onto a line item, and still matching what the supplier last sent.',
      tone: '#8A877F',
      rows: onQuote,
    },
  ]
}

interface ProjectOption {
  id: string
  project_number: string | null
  project_name: string
  // Supabase returns a joined row as an object or a single-element array
  clients: { client_name: string } | { client_name: string }[] | null
}

// Supabase hands a joined row back as an object or a single-element array
// depending on how it infers the relationship — take the first either way.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

interface LineItemOption {
  id: string
  item_name: string
  cost_price: number
  supplier_name: string | null
}

export function QuotesTable({ rows }: { rows: QuoteRow[] }) {
  const sections = groupRows(rows)
  const [applying, setApplying] = useState<QuoteRow | null>(null)
  // The row a designer has asked to remove, held until they confirm
  const [deleting, setDeleting] = useState<QuoteRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // The supplier's submission note, opened from the row it belongs to. Shown
  // on demand rather than inline: one note covers every item in a submission,
  // so printing it down the Notes column would repeat the same paragraph on
  // a dozen rows.
  const [reading, setReading] = useState<QuoteRow | null>(null)
  // Applied in this session — the row shows a tick straight away rather than
  // looking untouched until the next reload
  const [applied, setApplied] = useState<Record<string, string>>({})
  const [reapplying, setReapplying] = useState<string | null>(null)
  const router = useRouter()

  // Carry the supplier's revised price onto the line item it was already
  // applied to. Deliberate, never automatic: a quote that has been sent to a
  // client should not change value because a supplier edited their form.
  async function reapply(row: QuoteRow) {
    if (!row.appliedToLineItemId || row.price == null) return
    setReapplying(row.id)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('line_items')
        .update({ cost_price: row.price })
        .eq('id', row.appliedToLineItemId)
      if (error) throw new Error(error.message)
      await supabase
        .from('spec_quotes')
        .update({ applied_price: row.price, applied_at: new Date().toISOString() })
        .eq('id', row.id)
      toast.success(`${row.appliedTo ?? 'The quote'} updated to R${row.price.toLocaleString()}`)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message || 'Could not update that line item')
    } finally {
      setReapplying(null)
    }
  }

  async function confirmDelete(row: QuoteRow) {
    setDeletingId(row.id)
    try {
      const supabase = createClient()
      // spec_quote_applications cascades, so the record of which parts were
      // used goes with it rather than being left pointing at nothing.
      const { error } = await supabase.from('spec_quotes').delete().eq('id', row.id)
      if (error) throw new Error(error.message)
      toast.success(`${row.supplierName || 'That'} price removed`)
      setDeleting(null)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message || 'Could not remove that price')
    } finally {
      setDeletingId(null)
    }
  }

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
            {/* Nothing is hidden and nothing is filtered away — the rows
                are only put in the order a designer works in. */}
            {sections.map(section =>
              section.rows.length === 0 ? null : (
                <SectionRows
                  key={section.key}
                  section={section}
                  applied={applied}
                  reapplying={reapplying}
                  onRead={setReading}
                  onApply={setApplying}
                  onReapply={reapply}
                  onDelete={setDeleting}
                />
              )
            )}
        </table>
      </div>

      {reading?.supplierMessage && (
        <SupplierNoteModal quote={reading} onClose={() => setReading(null)} />
      )}

      {deleting && (
        <DeleteQuoteDialog
          quote={deleting}
          busy={deletingId === deleting.id}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete(deleting)}
        />
      )}

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

/** One section's heading row, then its prices. */
function SectionRows({
  section,
  applied,
  reapplying,
  onRead,
  onApply,
  onReapply,
  onDelete,
}: {
  section: Section
  applied: Record<string, string>
  reapplying: string | null
  onRead: (row: QuoteRow) => void
  onApply: (row: QuoteRow) => void
  onReapply: (row: QuoteRow) => void
  onDelete: (row: QuoteRow) => void
}) {
  return (
    <tbody className="border-t border-[#D8D3C8] first:border-t-0">
      <tr>
        <td colSpan={8} className="px-4 pt-4 pb-1.5 bg-white">
          <span className="text-xs font-semibold" style={{ color: section.tone }}>
            {section.title}
          </span>
          <span className="ml-2 text-xs text-[#8A877F]">
            {section.rows.length}
          </span>
          <span className="block text-[11px] text-[#8A877F] mt-0.5">{section.blurb}</span>
        </td>
      </tr>
      {section.rows.map(row => (
        <QuoteRowLine
          key={row.id}
          row={row}
          applied={applied}
          reapplying={reapplying}
          onRead={onRead}
          onApply={onApply}
          onReapply={onReapply}
          onDelete={onDelete}
        />
      ))}
    </tbody>
  )
}

function QuoteRowLine({
  row,
  applied,
  reapplying,
  onRead,
  onApply,
  onReapply,
  onDelete,
}: {
  row: QuoteRow
  applied: Record<string, string>
  reapplying: string | null
  onRead: (row: QuoteRow) => void
  onApply: (row: QuoteRow) => void
  onReapply: (row: QuoteRow) => void
  onDelete: (row: QuoteRow) => void
}) {
  const setReading = onRead
  const setApplying = onApply
  const reapply = onReapply
          const boardLabel = row.boardName
            ? row.clientName
              ? `${row.clientName} · ${row.boardName}`
              : row.boardName
            : row.fromPieces
              ? 'Pieces catalog'
              : '—'
          const canApply = !row.unableToQuote && row.price != null
          return (
            <tr key={row.id} className="group/row border-b border-[#EDE9E1] last:border-0">
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
                  {row.supplierMessage && (
                    <button
                      type="button"
                      onClick={() => setReading(row)}
                      title="Note the supplier sent with this submission"
                      aria-label={`Read the note ${row.supplierName || 'the supplier'} sent with this submission`}
                      className="text-[#9A7B4F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
                    >
                      <MessageSquare size={13} />
                    </button>
                  )}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                {row.unableToQuote ? (
                  <span className="text-[#B08968] font-normal italic">Couldn&apos;t quote</span>
                ) : row.price != null ? (
                  <span className={row.stale ? 'text-[#B4472F]' : 'text-[#2C2C2A]'}>
                    R{row.price.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[#8A877F]">—</span>
                )}
                {/* The quote still holds applied_price. Saying so is the
                    whole point — the number on the client's quote is the
                    one that can be wrong. */}
                {row.staleComponents.length > 0 ? (
                  // A component supplier's money is on their parts, so
                  // name the ones that moved rather than quoting a
                  // single figure that belongs to the item.
                  <span className="block text-[10px] font-normal text-[#B4472F] mt-0.5">
                    {row.staleComponents.length === 1
                      ? `${row.staleComponents[0]} has changed since it was applied`
                      : `${row.staleComponents.length} parts changed since they were applied`}
                  </span>
                ) : row.stale ? (
                  <span className="block text-[10px] font-normal text-[#B4472F] mt-0.5">
                    quote still at R{(row.appliedPrice ?? 0).toLocaleString()}
                  </span>
                ) : row.appliedTo ? (
                  <span className="block text-[10px] font-normal text-[#8A877F] mt-0.5">applied</span>
                ) : null}
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
                ) : row.staleComponents.length > 0 ? (
                  // Re-applying a component means choosing per part, which
                  // is what the project's Supplier quotes dialog is for.
                  // Offering a one-press fix here would have to guess.
                  <span className="text-[10px] text-[#8A877F]">
                    re-apply from the quote
                  </span>
                ) : row.stale && row.appliedToLineItemId && row.price != null ? (
                  // The target is already known, so this needs no picker —
                  // one press moves the quote onto the supplier's new price
                  <button
                    type="button"
                    disabled={reapplying === row.id}
                    onClick={() => void reapply(row)}
                    title={`Update ${row.appliedTo ?? 'the quote'} to R${row.price.toLocaleString()}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#B4472F] hover:text-[#8A3A26] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {reapplying === row.id ? (
                      <><Loader2 size={12} className="animate-spin" /> Updating…</>
                    ) : (
                      <><AlertTriangle size={12} /> Re-apply</>
                    )}
                  </button>
                ) : canApply ? (
                  <button
                    type="button"
                    onClick={() => setApplying(row)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#9A7B4F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
                  >
                    {row.appliedTo ? 'Add to another' : 'Add to quote'} <ArrowRight size={12} />
                  </button>
                ) : null}
                {/* Hidden until the row is hovered: this list is mostly read,
                    and a delete sitting permanently beside every price invites
                    the one press nobody wants. */}
                <button
                  type="button"
                  onClick={() => onDelete(row)}
                  title={`Remove ${row.supplierName || 'this supplier'}'s price for ${row.itemName}`}
                  aria-label={`Remove ${row.supplierName || 'this supplier'}'s price for ${row.itemName}`}
                  className="ml-2 p-1 rounded align-middle text-[#C4BFB5] opacity-0 group-hover/row:opacity-100 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          )
}

/**
 * Removing a price is not the same act in both halves of this page, so the
 * dialog does not pretend it is.
 *
 * An unused price is clutter, and deleting it costs nothing. One that has been
 * carried onto a quote is the record of where a number on a client's document
 * came from — the line keeps its price either way, but the trail back to the
 * supplier goes, and so does the warning if they later change their mind. That
 * is worth saying out loud rather than discovering afterwards.
 */
function DeleteQuoteDialog({
  quote,
  busy,
  onCancel,
  onConfirm,
}: {
  quote: QuoteRow
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const used = !!quote.appliedToLineItemId || quote.staleComponents.length > 0
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-[#2C2C2A] mb-1">
          Remove this price?
        </h3>
        <p className="text-sm text-[#4A4A47] mb-3">
          {quote.supplierName || 'A supplier'}&rsquo;s price for{' '}
          <strong className="text-[#2C2C2A]">{quote.itemName}</strong>
          {quote.price != null ? `, ${`R${quote.price.toLocaleString()}`}` : ''}.
        </p>

        {used ? (
          <div className="rounded-lg border border-[#E8D3A8] bg-[#FBF4E4] px-3 py-2.5 mb-4">
            <p className="text-xs leading-relaxed text-[#7A5F35]">
              This one is already on{' '}
              <strong>{quote.appliedTo ?? 'a quote'}</strong>. That line keeps its
              price — but you lose the record of where the number came from, and
              you will not be warned if {quote.supplierName || 'the supplier'} changes it later.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#8A877F] mb-4">
            It has not been used on any quote, so nothing else changes.
          </p>
        )}

        {quote.source === 'link' && (
          <p className="text-xs text-[#8A877F] mb-4">
            Their pricing link still works: if they submit again, this comes back.
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {busy ? <><Loader2 size={14} className="animate-spin" /> Removing…</> : <><Trash2 size={14} /> Remove</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// What the supplier wrote in "Anything else?" on their pricing form — delivery
// terms, quote validity, general conditions. It covers the whole submission,
// so it is read here rather than copied onto any one line item.
function SupplierNoteModal({ quote, onClose }: { quote: QuoteRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] flex flex-col rounded-xl bg-[#F5F2EC] border border-[#D8D3C8] shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8D3C8]">
          <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
            {/* {' '} explicitly: JSX trims each line of a multi-line text node */}
            {quote.supplierName || 'Supplier'}{' '}&middot; note with this submission
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-sm leading-relaxed text-[#2C2C2A] whitespace-pre-line">{quote.supplierMessage}</p>
          <p className="text-[11px] text-[#8A877F] mt-3">
            Applies to every item {quote.supplierName || 'the supplier'} priced in this submission, not just this one.
          </p>
        </div>
      </div>
    </div>
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
        .select('id, project_number, project_name, clients(client_name)')
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

      // Record that this price was used. applied_price is the amount as
      // applied, so if the supplier later revises their quote the two go out
      // of step and the row can say so — without this the quote silently
      // carries a number nobody knows is stale.
      await supabase
        .from('spec_quotes')
        .update({
          applied_to_line_item_id: lineItemId,
          applied_at: new Date().toISOString(),
          applied_price: quote.price,
        })
        .eq('id', quote.id)

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

          {/* Terms and validity are exactly what you want in front of you at
              the moment a price is carried onto a quote. */}
          {quote.supplierMessage && (
            <div className="rounded-lg border border-[#E8D3A8] bg-[#FBF4E4] px-3 py-2.5">
              <p className="text-[10px] font-medium text-[#9A7B4F] uppercase tracking-widest mb-1">
                {quote.supplierName || 'Supplier'} sent this with their pricing
              </p>
              <p className="text-xs leading-relaxed text-[#7A5F35] whitespace-pre-line">{quote.supplierMessage}</p>
            </div>
          )}

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
              {(projects ?? []).map(p => {
                // Client first — across a dozen live jobs "Lounge" or "Phase 2"
                // is not enough to pick the right quote by
                const client = one(p.clients)?.client_name?.trim()
                const label = [p.project_number, client, p.project_name]
                  .map(v => v?.trim())
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <option key={p.id} value={p.id}>
                    {label}
                  </option>
                )
              })}
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
