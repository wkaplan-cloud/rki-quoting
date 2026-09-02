'use client'
import { useEffect, useMemo, useState } from 'react'
import { X, Send, Loader2, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStudioStore } from '@/lib/studio/store'
import { createClient } from '@/lib/supabase/client'
import type { StudioSpec } from '@/lib/studio/types'

// Send quote-request emails to suppliers for the selected spec'd items.
// Items start grouped by the supplier named on their spec (that supplier is
// the default recipient) but each item carries its own supplier dropdown, so
// the split can be re-cut here without going back into every spec. Every
// group can also have EXTRA recipients added for price comparison — each
// recipient gets their own separate email + PDF, never a CC, so suppliers
// don't see who else is pricing.

interface OrgSupplier {
  id: string
  supplier_name: string
  email: string | null
  email_cc: string | null
}

interface Recipient {
  key: string
  supplierId: string | null
  supplierName: string
  email: string
}

interface Group {
  key: string
  label: string
  objectIds: string[]
  specs: StudioSpec[]
  defaultSupplierIds: string[]
}

// 'by-supplier': items split per the supplier on their spec — each supplier
// gets an email with only their items. 'combined': everything in ONE
// document, sent whole to whichever supplier(s) are chosen (price the lot).
type RfqMode = 'by-supplier' | 'combined'

// Items with no supplier of their own all land in one bucket — every group key
// is either a supplier id, `name:<typed name>` for a supplier that was typed
// but never linked to a supplier record, or this.
const UNASSIGNED = 'unassigned'

// Which group an item falls into by default: whatever supplier its spec names.
function defaultGroupKey(spec: StudioSpec) {
  if (spec.supplierId) return spec.supplierId
  const typed = spec.supplierName.trim()
  return typed ? `name:${typed}` : UNASSIGNED
}

let recipientSeq = 0

export function RequestQuotesModal() {
  const rfqObjectIds = useStudioStore(s => s.rfqObjectIds)
  const specsMap = useStudioStore(s => s.specs)
  const boardId = useStudioStore(s => s.boardId)

  const [mode, setMode] = useState<RfqMode>('by-supplier')
  // Per-item supplier overrides, objectId → group key. Only holds items the
  // designer has actually re-pointed here; everything else follows its spec.
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [suppliers, setSuppliers] = useState<OrgSupplier[] | null>(null)
  const [recipients, setRecipients] = useState<Record<string, Recipient[]>>({})
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [duplicates, setDuplicates] = useState<
    { item: string; supplierName: string; email: string; minutesAgo: number }[] | null
  >(null)

  const objectIds = useMemo(() => rfqObjectIds ?? [], [rfqObjectIds])
  const withSpec = objectIds.filter(id => specsMap[id])
  const withoutSpec = objectIds.length - withSpec.length

  const groups = useMemo<Group[]>(() => {
    if (mode === 'combined') {
      if (!withSpec.length) return []
      const specs = withSpec.map(id => specsMap[id])
      return [
        {
          key: 'all',
          label: 'All selected items — one document',
          objectIds: [...withSpec],
          specs,
          // Suppliers already named on the specs are pre-added as recipients
          // (removable) — each one chosen gets EVERY item below
          defaultSupplierIds: [...new Set(specs.map(sp => sp.supplierId).filter((v): v is string => !!v))],
        },
      ]
    }
    // Split by supplier — each item's own override if it has one, otherwise
    // the supplier named on its spec
    const map = new Map<string, Group>()
    for (const objectId of withSpec) {
      const spec = specsMap[objectId]
      const key = assignments[objectId] ?? defaultGroupKey(spec)
      let g = map.get(key)
      if (!g) {
        // A key that matches an org supplier takes that supplier's real name —
        // it may have been re-pointed here to a supplier the spec never named.
        const matched = suppliers?.find(s => s.id === key)
        const label =
          matched?.supplier_name ??
          (key.startsWith('name:') ? key.slice(5) : key === UNASSIGNED ? 'No supplier' : spec.supplierName.trim() || 'Supplier')
        g = {
          key,
          label,
          objectIds: [],
          specs: [],
          defaultSupplierIds: matched ? [matched.id] : [],
        }
        map.set(key, g)
      }
      g.objectIds.push(objectId)
      g.specs.push(spec)
    }
    return Array.from(map.values())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withSpec.join(','), specsMap, mode, assignments, suppliers])

  // Load org suppliers (for default recipient emails + the add-recipient list)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('suppliers')
        .select('id, supplier_name, email, email_cc')
        .order('supplier_name')
      if (!cancelled) setSuppliers((data ?? []) as OrgSupplier[])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Seed each group's default recipients once suppliers are known. Keyed per
  // group, so switching modes back and forth keeps what was already set up.
  useEffect(() => {
    if (!suppliers) return
    setRecipients(prev => {
      const next = { ...prev }
      for (const g of groups) {
        if (next[g.key]) continue
        next[g.key] = g.defaultSupplierIds.map(sid => {
          const sup = suppliers.find(s => s.id === sid)
          return {
            key: `r${recipientSeq++}`,
            supplierId: sid,
            supplierName: sup?.supplier_name ?? g.label,
            email: sup?.email ?? '',
          }
        })
      }
      return next
    })
  }, [suppliers, groups])

  if (!rfqObjectIds) return null
  const close = () => useStudioStore.getState().openRfq(null)

  function addRecipient(groupKey: string, value: string) {
    if (!value) return
    setRecipients(prev => {
      const list = prev[groupKey] ?? []
      if (value === 'custom') {
        return { ...prev, [groupKey]: [...list, { key: `r${recipientSeq++}`, supplierId: null, supplierName: '', email: '' }] }
      }
      const sup = suppliers?.find(s => s.id === value)
      if (!sup || list.some(r => r.supplierId === sup.id)) return prev
      return {
        ...prev,
        [groupKey]: [...list, { key: `r${recipientSeq++}`, supplierId: sup.id, supplierName: sup.supplier_name, email: sup.email ?? '' }],
      }
    })
  }

  // Re-point one item at a different supplier. Moving the last item out of a
  // group drops that group; moving one into a supplier with no group yet
  // creates it, and the seeding effect fills in that supplier's email.
  function assignItem(objectId: string, groupKey: string) {
    setAssignments(prev => ({ ...prev, [objectId]: groupKey }))
  }

  function patchRecipient(groupKey: string, key: string, patch: Partial<Recipient>) {
    setRecipients(prev => ({
      ...prev,
      [groupKey]: (prev[groupKey] ?? []).map(r => (r.key === key ? { ...r, ...patch } : r)),
    }))
  }

  function removeRecipient(groupKey: string, key: string) {
    setRecipients(prev => ({ ...prev, [groupKey]: (prev[groupKey] ?? []).filter(r => r.key !== key) }))
  }

  const totalRecipients = groups.reduce((n, g) => n + (recipients[g.key]?.length ?? 0), 0)
  // Named, not counted: a comparison supplier added with no email on their
  // record disables Send, and "some recipients" leaves the designer hunting
  // for which row in a modal that may be scrolled well past it.
  const missingEmailNames = groups.flatMap(g =>
    (recipients[g.key] ?? [])
      .filter(r => !r.email.trim())
      .map(r => r.supplierName.trim() || 'a typed-in recipient')
  )
  const missingEmails = missingEmailNames.length > 0

  async function send(force = false) {
    setSending(true)
    setErrors([])
    if (!force) setDuplicates(null)
    try {
      // Make sure every spec edit is in the DB before the server reads them
      await useStudioStore.getState().flushSave()
      const payload = {
        message: message.trim(),
        force,
        groups: groups
          .map(g => ({
            objectIds: g.objectIds,
            recipients: (recipients[g.key] ?? [])
              .filter(r => r.email.trim())
              .map(r => ({ supplierId: r.supplierId, supplierName: r.supplierName, email: r.email.trim() })),
          }))
          .filter(g => g.recipients.length > 0),
      }
      const res = await fetch(`/api/studio/boards/${boardId}/rfq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (json.error === 'duplicate_rfq' && Array.isArray(json.dupes)) {
          setDuplicates(json.dupes)
          setSending(false)
          return
        }
        setErrors([json.error ?? 'Sending failed — please try again'])
        setSending(false)
        return
      }
      const results = (json.results ?? []) as { email: string; supplierName: string; ok: boolean; error?: string }[]
      if (json.stamps?.length) useStudioStore.getState().markSpecsRfqSent(json.stamps)
      const failed = results.filter(r => !r.ok)
      const sent = results.length - failed.length
      if (failed.length === 0) {
        toast.success(`Quote request sent to ${sent} supplier${sent === 1 ? '' : 's'}`)
        close()
      } else {
        if (sent > 0) toast.success(`Sent to ${sent} supplier${sent === 1 ? '' : 's'}`)
        setErrors(failed.map(f => `${f.supplierName || f.email}: ${f.error ?? 'send failed'}`))
        setSending(false)
      }
    } catch {
      setErrors(['Sending failed — please check your connection and try again'])
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl bg-[#F5F2EC] border border-[#D8D3C8] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8D3C8]">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
            <Send size={12} /> Request quotes · {withSpec.length} item{withSpec.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={close}
            disabled={sending}
            title="Close"
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <div className="flex rounded-lg border border-[#D8D3C8] overflow-hidden">
              {(
                [
                  ['by-supplier', 'Split by item’s supplier'],
                  ['combined', 'All items together'],
                ] as [RfqMode, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`flex-1 h-8 text-[11px] font-medium transition-colors cursor-pointer ${
                    mode === value ? 'bg-[#1A1A18] text-white' : 'bg-white text-[#8A877F] hover:text-[#2C2C2A]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-[#8A877F] leading-relaxed">
              {mode === 'by-supplier'
                ? 'Each supplier gets an email with only their own items. Change an item’s supplier below to move it.'
                : 'One document with every item — each supplier you add below receives ALL of them, in one email.'}
            </p>
          </div>

          {withoutSpec > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {withoutSpec} selected item{withoutSpec === 1 ? ' has' : 's have'} no spec and can&apos;t be
                included — the spec is what the supplier quotes from. Add specs first, then try again.
              </p>
            </div>
          )}

          {groups.map(g => {
            const list = recipients[g.key] ?? []
            return (
              <div key={g.key} className="rounded-lg border border-[#D8D3C8] bg-white p-3">
                <p className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest mb-1">{g.label}</p>
                {mode === 'by-supplier' ? (
                  // One row per item, each with its own supplier — changing it
                  // moves the item to that supplier's email
                  <ul className="space-y-1 mb-2">
                    {g.objectIds.map(objectId => {
                      const sp = specsMap[objectId]
                      const itemName = sp.specName.trim() || 'Untitled item'
                      const current = assignments[objectId] ?? defaultGroupKey(sp)
                      return (
                        <li key={objectId} className="flex items-center gap-1.5">
                          <span className="flex-1 min-w-0 truncate text-[11px] text-[#2C2C2A]" title={itemName}>
                            {itemName}
                          </span>
                          <select
                            value={current}
                            onChange={e => assignItem(objectId, e.target.value)}
                            aria-label={`Supplier for ${itemName}`}
                            className="flex-shrink-0 max-w-[140px] text-[11px] rounded-md border border-[#D8D3C8] bg-white px-1.5 py-1 cursor-pointer text-[#2C2C2A]"
                          >
                            <option value={UNASSIGNED}>No supplier</option>
                            {/* A name typed on the spec but never linked to a supplier record
                                still needs an option, or the select would show blank */}
                            {current.startsWith('name:') && (
                              <option value={current}>{current.slice(5)}</option>
                            )}
                            {(suppliers ?? []).map(s => (
                              <option key={s.id} value={s.id}>
                                {s.supplier_name}
                              </option>
                            ))}
                          </select>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-[11px] text-[#2C2C2A] mb-2 leading-relaxed">
                    {g.specs.map(sp => sp.specName.trim() || 'Untitled item').join(' · ')}
                  </p>
                )}

                <p className="text-[10px] text-[#8A877F] mb-1">Send to:</p>
                <div className="space-y-1.5">
                  {list.map(r => (
                    <div key={r.key} className="flex items-center gap-1.5">
                      {r.supplierId ? (
                        <span className="flex-shrink-0 max-w-[120px] truncate text-[11px] text-[#2C2C2A]">{r.supplierName}</span>
                      ) : (
                        <input
                          value={r.supplierName}
                          onChange={e => patchRecipient(g.key, r.key, { supplierName: e.target.value })}
                          placeholder="Name"
                          className="w-[110px] text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] text-[#2C2C2A]"
                        />
                      )}
                      <input
                        value={r.email}
                        onChange={e => patchRecipient(g.key, r.key, { email: e.target.value })}
                        placeholder="email@supplier.co.za"
                        type="email"
                        className={`flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-md border bg-white outline-none focus:border-[#9A7B4F] text-[#2C2C2A] ${
                          r.email.trim() ? 'border-[#D8D3C8]' : 'border-amber-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => removeRecipient(g.key, r.key)}
                        title="Remove recipient"
                        className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded text-[#8A877F] hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 mt-2">
                  <Plus size={11} className="text-[#8A877F]" />
                  <select
                    value=""
                    onChange={e => addRecipient(g.key, e.target.value)}
                    className="text-[11px] rounded-md border border-[#D8D3C8] bg-white px-1.5 py-1 cursor-pointer text-[#8A877F]"
                    aria-label="Add another supplier for comparison"
                  >
                    <option value="">Add supplier for comparison…</option>
                    {(suppliers ?? [])
                      .filter(s => !list.some(r => r.supplierId === s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.supplier_name}
                          {s.email ? '' : ' (no email saved)'}
                        </option>
                      ))}
                    <option value="custom">Type an email address…</option>
                  </select>
                </div>
              </div>
            )
          })}

          <label className="block">
            <span className="block text-[10px] text-[#8A877F] mb-0.5">Message to suppliers (goes in every email)</span>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Please quote on the attached items. Some images are reference pictures for custom manufacture — see the specs per item."
              className="w-full text-[12px] px-2.5 py-2 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A] resize-none"
            />
          </label>

          <p className="text-[10px] text-[#8A877F] leading-relaxed">
            Each recipient gets their own email with a PDF of only their items — comparison suppliers
            are never CC&apos;d together. Replies come to your email address.
          </p>

          {duplicates && duplicates.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 space-y-1.5">
              <p className="text-[11px] font-medium text-amber-800">Already requested recently:</p>
              {duplicates.map((d, i) => (
                <p key={i} className="text-[11px] text-amber-800 leading-relaxed">
                  {d.item} — {d.supplierName} ({d.minutesAgo}m ago)
                </p>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDuplicates(null)}
                  className="h-7 px-2.5 text-[11px] text-amber-800 hover:bg-amber-100 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void send(true)}
                  className="h-7 px-2.5 text-[11px] font-medium bg-amber-800 text-white hover:bg-amber-900 rounded-md cursor-pointer"
                >
                  Send anyway
                </button>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-[11px] text-red-700 leading-relaxed">{e}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#D8D3C8]">
          {missingEmails && (
            <span className="mr-auto text-[10px] text-amber-700 leading-snug">
              {missingEmailNames.length === 1
                ? `${missingEmailNames[0]} has no email address saved — add one above to send`
                : `${missingEmailNames.length} recipients need an email address: ${missingEmailNames.join(', ')}`}
            </span>
          )}
          <button
            type="button"
            onClick={close}
            disabled={sending}
            className="h-8 px-3 text-xs text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || totalRecipients === 0 || withSpec.length === 0 || missingEmails}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-50"
          >
            {sending ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send size={13} /> Send to {totalRecipients} supplier{totalRecipients === 1 ? '' : 's'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
