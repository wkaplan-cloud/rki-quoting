'use client'
import { useEffect, useMemo, useState } from 'react'
import { X, Send, Loader2, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStudioStore } from '@/lib/studio/store'
import { createClient } from '@/lib/supabase/client'
import type { StudioSpec } from '@/lib/studio/types'

// Send quote-request emails to suppliers for the selected spec'd items.
// Items are grouped by the supplier named on their spec (that supplier is the
// default recipient), and every group can have EXTRA recipients added for
// price comparison — each recipient gets their own separate email + PDF,
// never a CC, so suppliers don't see who else is pricing.

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
  defaultSupplierId: string | null
}

let recipientSeq = 0

export function RequestQuotesModal() {
  const rfqObjectIds = useStudioStore(s => s.rfqObjectIds)
  const specsMap = useStudioStore(s => s.specs)
  const boardId = useStudioStore(s => s.boardId)

  const [suppliers, setSuppliers] = useState<OrgSupplier[] | null>(null)
  const [recipients, setRecipients] = useState<Record<string, Recipient[]>>({})
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const objectIds = useMemo(() => rfqObjectIds ?? [], [rfqObjectIds])
  const withSpec = objectIds.filter(id => specsMap[id])
  const withoutSpec = objectIds.length - withSpec.length

  // Group selected items by the supplier on their spec
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const objectId of withSpec) {
      const spec = specsMap[objectId]
      const key = spec.supplierId ?? (spec.supplierName.trim() ? `name:${spec.supplierName.trim()}` : 'unassigned')
      let g = map.get(key)
      if (!g) {
        g = {
          key,
          label: spec.supplierName.trim() || 'No supplier on spec',
          objectIds: [],
          specs: [],
          defaultSupplierId: spec.supplierId,
        }
        map.set(key, g)
      }
      g.objectIds.push(objectId)
      g.specs.push(spec)
    }
    return Array.from(map.values())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withSpec.join(','), specsMap])

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

  // Seed each group's default recipient once suppliers are known
  useEffect(() => {
    if (!suppliers) return
    setRecipients(prev => {
      const next = { ...prev }
      for (const g of groups) {
        if (next[g.key]) continue
        if (g.defaultSupplierId) {
          const sup = suppliers.find(s => s.id === g.defaultSupplierId)
          next[g.key] = [
            {
              key: `r${recipientSeq++}`,
              supplierId: g.defaultSupplierId,
              supplierName: sup?.supplier_name ?? g.label,
              email: sup?.email ?? '',
            },
          ]
        } else {
          next[g.key] = []
        }
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
  const missingEmails = groups.some(g => (recipients[g.key] ?? []).some(r => !r.email.trim()))

  async function send() {
    setSending(true)
    setErrors([])
    try {
      // Make sure every spec edit is in the DB before the server reads them
      await useStudioStore.getState().flushSave()
      const payload = {
        message: message.trim(),
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
                <p className="text-[11px] text-[#2C2C2A] mb-2 leading-relaxed">
                  {g.specs.map(sp => sp.specName.trim() || 'Untitled item').join(' · ')}
                </p>

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
            <span className="mr-auto text-[10px] text-amber-700">Some recipients still need an email address</span>
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
