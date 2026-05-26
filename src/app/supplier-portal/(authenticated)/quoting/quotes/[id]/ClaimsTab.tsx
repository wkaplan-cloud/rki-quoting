'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, ChevronRight, AlertCircle, Download } from 'lucide-react'
import type { ElecClaim, ElecClaimLineItem, ElecQuoteLineItem, ElecQuoteSection, ElecClaimStatus, ElecContractType, ElecClient } from '@/lib/elec-types'

type ClaimClient = Pick<ElecClient, 'id' | 'client_name' | 'email' | 'qs_name' | 'qs_email'>

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

const CLAIM_STATUS: Record<ElecClaimStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#71717A', bg: '#F4F4F5' },
  submitted: { label: 'Submitted', color: '#3A7CA5', bg: 'rgba(58,124,165,0.1)' },
  certified: { label: 'Certified', color: '#D9A441', bg: 'rgba(217,164,65,0.1)' },
  invoiced:  { label: 'Invoiced',  color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
  paid:      { label: 'Paid',      color: '#166534', bg: 'rgba(22,101,52,0.1)' },
}

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtMonth(dateStr: string) {
  const d = new Date(dateStr + (dateStr.length === 7 ? '-01' : ''))
  return d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

type ClaimWithItems = ElecClaim & { line_items: ElecClaimLineItem[] }
type View = 'list' | 'new' | 'detail' | 'retention'

// How much of an item has already been claimed/certified in prior non-draft claims.
// For settled claims (certified/invoiced/paid) use the certified %, so any uncertified
// portion stays claimable on the next claim. For submitted-but-not-yet-certified use claimed %.
function prevPct(itemId: string, claims: ClaimWithItems[], excludeId?: string): number {
  return claims
    .filter(c => c.status !== 'draft' && c.id !== excludeId)
    .reduce((sum, c) => {
      const li = c.line_items.find(l => l.quote_line_item_id === itemId)
      if (!li) return sum
      const settled = ['certified', 'invoiced', 'paid'].includes(c.status)
      return sum + (settled && li.percentage_certified != null
        ? li.percentage_certified
        : li.percentage_claimed)
    }, 0)
}

// ─── New claim form ───────────────────────────────────────────────────────────
function NewClaimForm({ quoteId, portalAccountId, claims, items, sections, contractType, client, onCreated, onCancel }: {
  quoteId: string
  portalAccountId: string
  claims: ClaimWithItems[]
  items: ElecQuoteLineItem[]
  sections: ElecQuoteSection[]
  contractType: ElecContractType
  client: ClaimClient | null
  onCreated: (claim: ClaimWithItems) => void
  onCancel: () => void
}) {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const thisMonth = today.slice(0, 7)

  const [periodMonth, setPeriodMonth] = useState(thisMonth)
  const [claimDate, setClaimDate] = useState(today)
  const [sentToName, setSentToName] = useState(client?.client_name ?? '')
  const [sentToEmail, setSentToEmail] = useState(client?.email ?? '')
  const [qsName, setQsName] = useState(client?.qs_name ?? '')
  const [qsEmail, setQsEmail] = useState(client?.qs_email ?? '')
  const [sendToClient, setSendToClient] = useState(true)
  const [sendToQs, setSendToQs] = useState(!!(client?.qs_email))
  const [notes, setNotes] = useState('')
  const [pcts, setPcts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitNow, setSubmitNow] = useState(false)

  // Auto-save changed contact details back to the client record
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  function scheduleClientSave(patch: Partial<ElecClient>) {
    if (!client) return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      void supabase.from('elec_clients').update(patch).eq('id', client.id)
    }, 1200)
  }
  useEffect(() => () => clearTimeout(autoSaveTimer.current), [])

  function getPct(itemId: string): number {
    return parseFloat(pcts[itemId] ?? '0') || 0
  }

  function fillFromAsBuilt() {
    const newPcts: Record<string, string> = {}
    for (const item of items) {
      const abQty = item.as_built_quantity ?? item.quoted_quantity
      const abPct = item.quoted_quantity > 0 ? (abQty / item.quoted_quantity) * 100 : 0
      const alreadyClaimed = prevPct(item.id, claims)
      const thisPct = Math.max(0, abPct - alreadyClaimed)
      if (thisPct > 0.01) newPcts[item.id] = String(Math.round(thisPct * 10) / 10)
    }
    setPcts(newPcts)
  }

  const invoicedVOIds = new Set(claims.filter(c => c.variation_order_id).map(c => c.variation_order_id!))

  const lineItems = items
    .filter(item => !(item.is_variation && item.variation_order_id && invoicedVOIds.has(item.variation_order_id)))
    .map(item => {
      const contractVal = item.quoted_quantity * item.quoted_unit_rate
      const prev = prevPct(item.id, claims)
      const thisPct = getPct(item.id)
      const thisAmt = contractVal * thisPct / 100
      // Re-measurement: ceiling is as-built %; lump sum: ceiling is 100%
      const abPct = contractType === 're_measurement' && item.quoted_quantity > 0
        ? ((item.as_built_quantity ?? item.quoted_quantity) / item.quoted_quantity) * 100
        : 100
      const remaining = Math.max(0, abPct - prev)
      return { item, contractVal, prev, thisPct, thisAmt, remaining }
    })

  const totalThisClaim = lineItems.reduce((s, l) => s + l.thisAmt, 0)
  const totalContract = items.reduce((s, i) => s + i.quoted_quantity * i.quoted_unit_rate, 0)
  const itemsWithClaim = lineItems.filter(l => l.thisPct > 0)

  async function handleSubmit(submitFlag: boolean) {
    if (totalThisClaim <= 0) { setError('No amounts entered — add percentages to at least one line item'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/supplier-portal/quoting/quotes/${quoteId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_month: periodMonth + '-01',
          claim_type: 'invoice',
          claim_date: claimDate,
          sent_to_name: sendToClient ? (sentToName.trim() || null) : null,
          sent_to_email: sendToClient ? (sentToEmail.trim() || null) : null,
          qs_name: sendToQs ? (qsName.trim() || null) : null,
          qs_email: sendToQs ? (qsEmail.trim() || null) : null,
          notes: notes.trim() || null,
          submit: submitFlag,
          sent_at: submitFlag ? new Date().toISOString() : null,
          line_items: itemsWithClaim.map(l => ({
            quote_line_item_id: l.item.id,
            percentage_claimed: l.thisPct,
            amount_claimed: l.thisAmt,
          })),
        }),
      })
      const data = await res.json() as { id?: string; claim_number?: string; error?: string }
      if (!res.ok || !data.id) { setError(data.error ?? 'Failed to create claim'); setLoading(false); return }

      // Build local claim object for optimistic update
      const newClaim: ClaimWithItems = {
        id: data.id,
        quote_id: quoteId,
        portal_account_id: portalAccountId,
        claim_number: data.claim_number!,
        claim_date: claimDate,
        period_month: periodMonth + '-01',
        claim_type: 'invoice',
        status: submitFlag ? 'submitted' : 'draft',
        total_claimed: totalThisClaim,
        total_certified: null,
        total_invoiced: null,
        total_paid: null,
        sent_to_name: sendToClient ? (sentToName.trim() || null) : null,
        sent_to_email: sendToClient ? (sentToEmail.trim() || null) : null,
        qs_name: sendToQs ? (qsName.trim() || null) : null,
        qs_email: sendToQs ? (qsEmail.trim() || null) : null,
        sent_at: submitFlag ? new Date().toISOString() : null,
        notes: notes.trim() || null,
        variation_order_id: null,
        created_at: new Date().toISOString(),
        line_items: itemsWithClaim.map(l => ({
          id: crypto.randomUUID(),
          claim_id: data.id!,
          quote_line_item_id: l.item.id,
          percentage_claimed: l.thisPct,
          amount_claimed: l.thisAmt,
          percentage_certified: null,
          amount_certified: null,
          notes: null,
          created_at: new Date().toISOString(),
        })),
      }
      onCreated(newClaim)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creating claim')
      setLoading(false)
    }
  }

  function renderSection(title: string | null, sectionItems: typeof lineItems) {
    if (sectionItems.length === 0) return null
    return (
      <div key={title ?? 'free'} className="mb-4">
        {title && (
          <div className="px-3 py-2 rounded-t-lg text-xs font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(58,124,165,0.06)', color: S.accent, borderBottom: `1px solid ${S.border}` }}>
            {title}
          </div>
        )}
        {sectionItems.map(({ item, contractVal, prev, thisPct, thisAmt, remaining }) => {
          const fullyDone = remaining <= 0
          return (
            <div key={item.id} className="grid items-center px-3 py-2"
              style={{
                gridTemplateColumns: '1fr 90px 70px 60px 90px 90px',
                gap: 8,
                background: fullyDone ? 'rgba(0,0,0,0.02)' : '#fff',
                borderBottom: `1px solid ${S.border}`,
                opacity: fullyDone ? 0.5 : 1,
              }}>
              <span className="text-sm truncate" style={{ color: S.text }}>{item.description || '—'}</span>
              <span className="text-xs text-right font-mono" style={{ color: S.muted }}>{fmtR(contractVal)}</span>
              <span className="text-xs text-right" style={{ color: S.muted }}>{prev.toFixed(0)}%</span>
              <input
                type="number" min="0" max={remaining} step="0.5"
                value={pcts[item.id] ?? ''}
                disabled={fullyDone}
                onChange={e => {
                  const raw = parseFloat(e.target.value)
                  const clamped = isNaN(raw) ? '' : String(Math.min(raw, remaining))
                  setPcts(p => ({ ...p, [item.id]: clamped }))
                }}
                placeholder="0"
                className="px-1.5 py-1 text-xs text-right rounded outline-none w-full"
                style={{ background: fullyDone ? S.bg : '#fff', border: `1px solid ${fullyDone ? S.border : S.accent}`, color: S.accent }}
              />
              <span className="text-xs text-right" style={{ color: S.muted }}>{remaining.toFixed(0)}% left</span>
              <span className="text-xs text-right font-semibold font-mono" style={{ color: thisPct > 0 ? S.text : S.muted }}>
                {thisPct > 0 ? fmtR(thisAmt) : '—'}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const freeLineItems = lineItems.filter(l => l.item.section_id === null)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
        <h3 className="font-bold" style={{ color: S.text }}>New Claim / Invoice</h3>
        <div className="flex items-center gap-2">
          {contractType === 're_measurement' && (
            <button onClick={fillFromAsBuilt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: 'rgba(58,124,165,0.08)', color: S.accent, border: `1px solid rgba(58,124,165,0.2)` }}>
              Fill from As-Built
            </button>
          )}
          <button onClick={onCancel} style={{ color: S.muted }}><X size={15} /></button>
        </div>
      </div>

      {/* Meta fields */}
      <div className="px-5 py-4 space-y-4" style={{ borderBottom: `1px solid ${S.border}` }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Billing Period</label>
            <input type="month" value={periodMonth} onChange={e => setPeriodMonth(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Claim Date</label>
            <input type="date" value={claimDate} onChange={e => setClaimDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>
        </div>

        {/* Recipient cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Client */}
          <div className="rounded-xl p-3" style={{ border: `1px solid ${sendToClient ? S.accent : S.border}`, background: sendToClient ? 'rgba(58,124,165,0.03)' : S.bg }}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Client</span>
              <button
                type="button"
                onClick={() => setSendToClient(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: sendToClient ? S.accent : S.bg, color: sendToClient ? '#fff' : S.muted, border: `1px solid ${sendToClient ? S.accent : S.border}` }}>
                {sendToClient ? 'Included' : 'Excluded'}
              </button>
            </div>
            <div className="space-y-2">
              <input value={sentToName} onChange={e => { setSentToName(e.target.value); scheduleClientSave({ client_name: e.target.value }) }}
                placeholder="Client name"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none"
                style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
              <input type="email" value={sentToEmail} onChange={e => { setSentToEmail(e.target.value); scheduleClientSave({ email: e.target.value }) }}
                placeholder="client@email.com"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none"
                style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          </div>

          {/* QS */}
          <div className="rounded-xl p-3" style={{ border: `1px solid ${sendToQs ? S.gold : S.border}`, background: sendToQs ? 'rgba(217,164,65,0.03)' : S.bg }}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted }}>QS / Principal Agent</span>
              <button
                type="button"
                onClick={() => setSendToQs(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: sendToQs ? S.gold : S.bg, color: sendToQs ? '#fff' : S.muted, border: `1px solid ${sendToQs ? S.gold : S.border}` }}>
                {sendToQs ? 'Included' : 'Excluded'}
              </button>
            </div>
            <div className="space-y-2">
              <input value={qsName} onChange={e => { setQsName(e.target.value); scheduleClientSave({ qs_name: e.target.value }) }}
                placeholder="QS name"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none"
                style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
              <input type="email" value={qsEmail} onChange={e => { setQsEmail(e.target.value); scheduleClientSave({ qs_email: e.target.value }) }}
                placeholder="qs@email.com"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none"
                style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>
      </div>

      {/* Line items table */}
      <div className="px-5 pt-4">
        <div className="grid px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: '1fr 90px 70px 60px 90px 90px', gap: 8, color: S.muted }}>
          <span>Description</span>
          <span className="text-right">Contract Val</span>
          <span className="text-right">Prev %</span>
          <span className="text-right">This %</span>
          <span className="text-right">Remaining</span>
          <span className="text-right">This Amount</span>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
          {freeLineItems.length > 0 && renderSection(null, freeLineItems)}
          {sections.map(s => renderSection(s.title || 'Section', lineItems.filter(l => l.item.section_id === s.id)))}
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-5 py-3 mt-2"
        style={{ borderTop: `1px solid ${S.border}` }}>
        <div className="flex items-center gap-6 text-sm">
          <span style={{ color: S.muted }}>Contract: <strong style={{ color: S.text }}>{fmtR(totalContract)}</strong></span>
          <span style={{ color: S.muted }}>This claim: <strong style={{ color: S.accent, fontSize: '1rem' }}>{fmtR(totalThisClaim)}</strong></span>
          {totalContract > 0 && <span style={{ color: S.muted }}>{((totalThisClaim / totalContract) * 100).toFixed(1)}% of contract</span>}
        </div>
      </div>

      {error && (
        <div className="mx-5 mb-3 px-3 py-2 rounded flex items-center gap-2 text-sm"
          style={{ background: '#FEF2F2', color: S.danger, border: '1px solid #FECACA' }}>
          <AlertCircle size={13} />{error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 px-5 py-4" style={{ borderTop: `1px solid ${S.border}` }}>
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg" style={{ color: S.muted }}>Cancel</button>
        <button onClick={() => handleSubmit(false)} disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: S.bg, color: S.text, border: `1px solid ${S.border}` }}>
          {loading && !submitNow ? 'Saving…' : 'Save Draft'}
        </button>
        <button onClick={() => { setSubmitNow(true); handleSubmit(true) }} disabled={loading}
          className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
          style={{ background: S.accent }}>
          {loading && submitNow ? 'Sending…' : 'Send to Client'}
        </button>
      </div>
    </div>
  )
}

// ─── Retention release form ───────────────────────────────────────────────────
function NewRetentionForm({ quoteId, portalAccountId, retentionHeld, onCreated, onCancel }: {
  quoteId: string
  portalAccountId: string
  retentionHeld: number
  onCreated: (claim: ClaimWithItems) => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [claimDate, setClaimDate] = useState(today)
  const [sentToName, setSentToName] = useState('')
  const [sentToEmail, setSentToEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(submitFlag: boolean) {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/supplier-portal/quoting/quotes/${quoteId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_month: claimDate.slice(0, 7) + '-01',
          claim_type: 'retention',
          claim_date: claimDate,
          sent_to_name: sentToName.trim() || null,
          sent_to_email: sentToEmail.trim() || null,
          notes: notes.trim() || null,
          submit: submitFlag,
          line_items: [],
          retention_amount: retentionHeld,
        }),
      })
      const data = await res.json() as { id?: string; claim_number?: string; error?: string }
      if (!res.ok || !data.id) { setError(data.error ?? 'Failed'); setLoading(false); return }
      const newClaim: ClaimWithItems = {
        id: data.id, quote_id: quoteId, portal_account_id: portalAccountId,
        claim_number: data.claim_number!, claim_date: claimDate,
        period_month: claimDate.slice(0, 7) + '-01', claim_type: 'retention',
        status: submitFlag ? 'submitted' : 'draft', total_claimed: retentionHeld,
        total_certified: null, total_invoiced: null, total_paid: null,
        sent_to_name: sentToName.trim() || null, sent_to_email: sentToEmail.trim() || null,
        sent_at: null, notes: notes.trim() || null, qs_name: null, qs_email: null, variation_order_id: null, created_at: new Date().toISOString(),
        line_items: [],
      }
      onCreated(newClaim)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
        <div>
          <h3 className="font-bold" style={{ color: S.text }}>Retention Release</h3>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>Claim back held retention at practical completion</p>
        </div>
        <button onClick={onCancel} style={{ color: S.muted }}><X size={15} /></button>
      </div>

      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
        <div className="rounded-xl p-4" style={{ background: 'rgba(58,124,165,0.04)', border: `1px solid ${S.border}` }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Retention Amount to Claim</p>
          <p className="text-2xl font-bold" style={{ color: S.accent }}>{fmtR(retentionHeld)}</p>
          <p className="text-xs mt-1" style={{ color: S.muted }}>Based on certified amounts × retention %</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Claim Date</label>
          <input type="date" value={claimDate} onChange={e => setClaimDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Send To (Name)</label>
          <input value={sentToName} onChange={e => setSentToName(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Send To (Email)</label>
          <input type="email" value={sentToEmail} onChange={e => setSentToEmail(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>
        <div className="col-span-3">
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Practical completion certificate issued — 01 May 2025"
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>
      </div>

      {error && (
        <div className="mx-5 mb-3 px-3 py-2 rounded flex items-center gap-2 text-sm"
          style={{ background: '#FEF2F2', color: S.danger, border: '1px solid #FECACA' }}>
          <AlertCircle size={13} />{error}
        </div>
      )}

      <div className="flex justify-end gap-3 px-5 py-4">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg" style={{ color: S.muted }}>Cancel</button>
        <button onClick={() => handleSubmit(false)} disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: S.bg, color: S.text, border: `1px solid ${S.border}` }}>
          Save Draft
        </button>
        <button onClick={() => handleSubmit(true)} disabled={loading}
          className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
          style={{ background: S.accent }}>
          {loading ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}

// ─── Claim detail ─────────────────────────────────────────────────────────────
function ClaimDetail({ claim, items, onStatusChange, onClose }: {
  claim: ClaimWithItems
  items: ElecQuoteLineItem[]
  onStatusChange: (id: string, patch: Partial<ClaimWithItems>) => void
  onClose: () => void
}) {
  const supabase = createClient()
  const [showCertForm, setShowCertForm] = useState(false)
  // keyed by elec_claim_line_item.id → certified % string
  const [certPcts, setCertPcts] = useState<Record<string, string>>(() =>
    Object.fromEntries(claim.line_items.map(li => [li.id, String(li.percentage_certified ?? li.percentage_claimed)]))
  )
  const [certBy, setCertBy] = useState('')
  const [loading, setLoading] = useState(false)
  const [certError, setCertError] = useState('')
  const st = CLAIM_STATUS[claim.status]

  const itemMap = Object.fromEntries(items.map(i => [i.id, i]))

  async function advance(status: ElecClaimStatus, extra?: Partial<ElecClaim>) {
    setLoading(true)
    const patch = { status, ...extra }
    const { error } = await supabase.from('elec_claims').update(patch).eq('id', claim.id)
    if (!error) onStatusChange(claim.id, patch)
    setLoading(false)
  }

  async function certify() {
    setLoading(true); setCertError('')
    try {
      // Build per-item certified values
      const lineUpdates = claim.line_items.map(li => {
        const pct = parseFloat(certPcts[li.id] ?? String(li.percentage_claimed)) || 0
        const qi = itemMap[li.quote_line_item_id]
        const contractVal = qi ? qi.quoted_quantity * qi.quoted_unit_rate : 0
        return { id: li.id, percentage_certified: pct, amount_certified: contractVal * pct / 100 }
      })
      const totalCertified = lineUpdates.reduce((s, u) => s + u.amount_certified, 0)

      // Update each claim line item
      for (const u of lineUpdates) {
        const { error } = await supabase
          .from('elec_claim_line_items')
          .update({ percentage_certified: u.percentage_certified, amount_certified: u.amount_certified })
          .eq('id', u.id)
        if (error) throw new Error(error.message)
      }

      // Update claim header
      const patch: Partial<ElecClaim> = { status: 'certified', total_certified: totalCertified }
      const { error } = await supabase.from('elec_claims').update(patch).eq('id', claim.id)
      if (error) throw new Error(error.message)

      onStatusChange(claim.id, {
        ...patch,
        line_items: claim.line_items.map(li => {
          const u = lineUpdates.find(x => x.id === li.id)!
          return { ...li, percentage_certified: u.percentage_certified, amount_certified: u.amount_certified }
        }),
      } as Partial<ElecClaim>)
      setShowCertForm(false)
    } catch (e: unknown) {
      setCertError(e instanceof Error ? e.message : 'Save failed')
    }
    setLoading(false)
  }

  const isCertified = ['certified', 'invoiced', 'paid'].includes(claim.status)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-sm" style={{ color: S.text }}>{claim.claim_number}</span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: st.bg, color: st.color }}>{st.label}</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: claim.claim_type === 'retention' ? 'rgba(217,164,65,0.1)' : ['invoiced','paid'].includes(claim.status) ? 'rgba(22,163,74,0.1)' : S.bg,
                color: claim.claim_type === 'retention' ? S.gold : ['invoiced','paid'].includes(claim.status) ? S.green : S.muted,
              }}>
              {claim.claim_type === 'retention' ? 'Retention' : ['invoiced','paid'].includes(claim.status) ? 'Tax Invoice' : 'Claim'}
            </span>
          </div>
          <p className="text-xs" style={{ color: S.muted }}>{fmtMonth(claim.period_month)} · {claim.claim_date}</p>
        </div>
        <a href={`/api/supplier-portal/quoting/claims/${claim.id}/pdf`} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: S.accent, color: '#fff' }}>
          <Download size={11} /> PDF
        </a>
        <button onClick={onClose} style={{ color: S.muted }}><X size={15} /></button>
      </div>

      {/* Line items — show certified columns once certified */}
      {claim.line_items.length > 0 && (
        <div className="px-5 py-4">
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
            {isCertified ? (
              <>
                <div className="grid px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1fr 70px 80px 70px 80px 72px', gap: 6, color: S.muted, background: S.bg }}>
                  <span>Description</span>
                  <span className="text-right">Clmd %</span>
                  <span className="text-right">Clmd Amt</span>
                  <span className="text-right" style={{ color: S.gold }}>Cert %</span>
                  <span className="text-right" style={{ color: S.gold }}>Cert Amt</span>
                  <span className="text-right">Diff</span>
                </div>
                {claim.line_items.map(li => {
                  const qi = itemMap[li.quote_line_item_id]
                  const diff = (li.amount_certified ?? li.amount_claimed) - li.amount_claimed
                  return (
                    <div key={li.id} className="grid px-3 py-2 items-center"
                      style={{ gridTemplateColumns: '1fr 70px 80px 70px 80px 72px', gap: 6, borderTop: `1px solid ${S.border}` }}>
                      <span className="text-xs truncate" style={{ color: S.text }}>{qi?.description || '—'}</span>
                      <span className="text-xs text-right" style={{ color: S.muted }}>{li.percentage_claimed.toFixed(0)}%</span>
                      <span className="text-xs text-right font-mono" style={{ color: S.muted }}>{fmtR(li.amount_claimed)}</span>
                      <span className="text-xs text-right font-semibold" style={{ color: S.gold }}>
                        {li.percentage_certified != null ? `${li.percentage_certified.toFixed(0)}%` : '—'}
                      </span>
                      <span className="text-xs text-right font-semibold font-mono" style={{ color: S.gold }}>
                        {li.amount_certified != null ? fmtR(li.amount_certified) : '—'}
                      </span>
                      <span className="text-xs text-right font-mono"
                        style={{ color: diff < -0.01 ? S.danger : diff > 0.01 ? S.green : S.muted }}>
                        {diff < -0.01 ? '–' : diff > 0.01 ? '+' : ''}{fmtR(Math.abs(diff))}
                      </span>
                    </div>
                  )
                })}
              </>
            ) : (
              <>
                <div className="grid px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1fr 90px 70px 90px', gap: 8, color: S.muted, background: S.bg }}>
                  <span>Description</span>
                  <span className="text-right">Contract Val</span>
                  <span className="text-right">% Claimed</span>
                  <span className="text-right">Amount</span>
                </div>
                {claim.line_items.map(li => {
                  const qi = itemMap[li.quote_line_item_id]
                  const contractVal = qi ? qi.quoted_quantity * qi.quoted_unit_rate : 0
                  return (
                    <div key={li.id} className="grid px-3 py-2 items-center"
                      style={{ gridTemplateColumns: '1fr 90px 70px 90px', gap: 8, borderTop: `1px solid ${S.border}` }}>
                      <span className="text-sm truncate" style={{ color: S.text }}>{qi?.description || '—'}</span>
                      <span className="text-xs text-right font-mono" style={{ color: S.muted }}>{fmtR(contractVal)}</span>
                      <span className="text-xs text-right" style={{ color: S.muted }}>{li.percentage_claimed.toFixed(0)}%</span>
                      <span className="text-xs text-right font-semibold font-mono" style={{ color: S.text }}>{fmtR(li.amount_claimed)}</span>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="px-5 pb-4">
        <div className="space-y-1.5 max-w-xs ml-auto">
          <div className="flex justify-between text-sm">
            <span style={{ color: S.muted }}>Total Claimed</span>
            <span className="font-semibold" style={{ color: S.text }}>{fmtR(claim.total_claimed)}</span>
          </div>
          {claim.total_certified != null && (
            <>
              <div className="flex justify-between text-sm">
                <span style={{ color: S.muted }}>Total Certified</span>
                <span className="font-semibold" style={{ color: S.gold }}>{fmtR(claim.total_certified)}</span>
              </div>
              {claim.total_certified < claim.total_claimed && (
                <div className="flex justify-between text-xs px-2 py-1 rounded" style={{ background: 'rgba(220,38,38,0.06)' }}>
                  <span style={{ color: S.danger }}>Uncertified (carried forward)</span>
                  <span className="font-semibold" style={{ color: S.danger }}>{fmtR(claim.total_claimed - claim.total_certified)}</span>
                </div>
              )}
            </>
          )}
          {claim.total_invoiced != null && (
            <div className="flex justify-between text-sm">
              <span style={{ color: S.muted }}>Invoiced</span>
              <span className="font-semibold" style={{ color: S.green }}>{fmtR(claim.total_invoiced)}</span>
            </div>
          )}
          {claim.total_paid != null && (
            <div className="flex justify-between text-sm pt-1" style={{ borderTop: `1px solid ${S.border}` }}>
              <span className="font-semibold" style={{ color: S.text }}>Paid</span>
              <span className="font-bold" style={{ color: S.green }}>{fmtR(claim.total_paid)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Per-item certification form */}
      {showCertForm && (
        <div className="mx-5 mb-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${S.gold}` }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(217,164,65,0.06)', borderBottom: `1px solid rgba(217,164,65,0.2)` }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: S.text }}>Record Certification</p>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>Enter the QS certified % per item — any reduction is carried forward to your next claim</p>
            </div>
            <div style={{ minWidth: 200 }}>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Certified By</label>
              <input value={certBy} onChange={e => setCertBy(e.target.value)} placeholder="Name / QS / Engineer"
                className="w-full px-3 py-1.5 text-sm rounded-lg outline-none"
                style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          </div>

          {/* Per-item table */}
          <div style={{ background: S.card }}>
            <div className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: '1fr 80px 90px 80px 90px', gap: 8, color: S.muted, background: S.bg, borderBottom: `1px solid ${S.border}` }}>
              <span>Description</span>
              <span className="text-right">Claimed %</span>
              <span className="text-right">Claimed Amt</span>
              <span className="text-right" style={{ color: S.gold }}>Cert %</span>
              <span className="text-right" style={{ color: S.gold }}>Cert Amt</span>
            </div>
            {claim.line_items.map(li => {
              const qi = itemMap[li.quote_line_item_id]
              const contractVal = qi ? qi.quoted_quantity * qi.quoted_unit_rate : 0
              const certPct = parseFloat(certPcts[li.id] ?? String(li.percentage_claimed)) || 0
              const certAmt = contractVal * certPct / 100
              const reduced = certPct < li.percentage_claimed - 0.01
              return (
                <div key={li.id} className="grid px-4 py-2 items-center"
                  style={{ gridTemplateColumns: '1fr 80px 90px 80px 90px', gap: 8, borderBottom: `1px solid ${S.border}` }}>
                  <span className="text-xs truncate" style={{ color: S.text }}>{qi?.description || '—'}</span>
                  <span className="text-xs text-right" style={{ color: S.muted }}>{li.percentage_claimed.toFixed(0)}%</span>
                  <span className="text-xs text-right font-mono" style={{ color: S.muted }}>{fmtR(li.amount_claimed)}</span>
                  <input
                    type="number" min="0" step="0.5"
                    value={certPcts[li.id] ?? String(li.percentage_claimed)}
                    onChange={e => setCertPcts(p => ({ ...p, [li.id]: e.target.value }))}
                    className="px-2 py-1 text-xs text-right rounded outline-none w-full"
                    style={{ background: reduced ? 'rgba(220,38,38,0.06)' : '#fff', border: `1px solid ${reduced ? S.danger : S.gold}`, color: reduced ? S.danger : S.gold }} />
                  <span className="text-xs text-right font-semibold font-mono" style={{ color: reduced ? S.danger : S.gold }}>
                    {fmtR(certAmt)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Total + actions */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(217,164,65,0.04)', borderTop: `1px solid rgba(217,164,65,0.2)` }}>
            <div className="text-sm">
              <span style={{ color: S.muted }}>Total certified: </span>
              <strong style={{ color: S.gold }}>
                {fmtR(claim.line_items.reduce((s, li) => {
                  const qi = itemMap[li.quote_line_item_id]
                  const contractVal = qi ? qi.quoted_quantity * qi.quoted_unit_rate : 0
                  const pct = parseFloat(certPcts[li.id] ?? String(li.percentage_claimed)) || 0
                  return s + contractVal * pct / 100
                }, 0))}
              </strong>
              {(() => {
                const uncert = claim.total_claimed - claim.line_items.reduce((s, li) => {
                  const qi = itemMap[li.quote_line_item_id]
                  const contractVal = qi ? qi.quoted_quantity * qi.quoted_unit_rate : 0
                  const pct = parseFloat(certPcts[li.id] ?? String(li.percentage_claimed)) || 0
                  return s + contractVal * pct / 100
                }, 0)
                return uncert > 0.01
                  ? <span className="ml-3 text-xs" style={{ color: S.danger }}>{fmtR(uncert)} carried forward</span>
                  : null
              })()}
            </div>
            <div className="flex gap-2 items-center">
              {certError && <span className="text-xs" style={{ color: S.danger }}>{certError}</span>}
              <button onClick={() => { setShowCertForm(false); setCertError('') }} className="px-3 py-1.5 text-sm rounded-lg" style={{ color: S.muted }}>Cancel</button>
              <button onClick={certify} disabled={loading}
                className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: S.gold }}>{loading ? 'Saving…' : 'Record Certification'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Status actions */}
      <div className="flex items-center gap-2 px-5 py-4 flex-wrap" style={{ borderTop: `1px solid ${S.border}` }}>
        <span className="text-xs flex-1" style={{ color: S.muted }}>
          {claim.sent_to_name && `Sent to: ${claim.sent_to_name}`}
        </span>
        {claim.status === 'draft' && (
          <button onClick={() => advance('submitted', { sent_at: new Date().toISOString() })}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: S.accent }}>Send to Client →</button>
        )}
        {claim.status === 'submitted' && claim.claim_type === 'retention' && (
          <button onClick={() => advance('paid', { total_paid: claim.total_claimed })}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: S.green }}>Mark Paid →</button>
        )}
        {claim.status === 'submitted' && claim.claim_type !== 'retention' && !showCertForm && (
          <>
            <button onClick={() => setShowCertForm(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(217,164,65,0.1)', color: S.gold, border: `1px solid rgba(217,164,65,0.4)` }}>
              Record Certification →
            </button>
            <button onClick={() => advance('invoiced', { total_invoiced: claim.total_claimed })}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: S.green }}>Issue Tax Invoice →</button>
          </>
        )}
        {claim.status === 'certified' && (
          <button onClick={() => advance('invoiced', { total_invoiced: claim.total_certified ?? claim.total_claimed })}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: S.green }}>Issue Tax Invoice →</button>
        )}
        {claim.status === 'invoiced' && (
          <button onClick={() => advance('paid', { total_paid: claim.total_invoiced ?? claim.total_certified ?? claim.total_claimed })}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: S.green }}>Mark Paid →</button>
        )}
        {(claim.status === 'submitted' || claim.status === 'draft') && (
          <button onClick={() => advance('draft')} disabled={loading}
            className="px-3 py-2 rounded-lg text-xs"
            style={{ color: S.muted, background: S.bg }}>← Revert to Draft</button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  quoteId: string
  portalAccountId: string
  initialClaims: ClaimWithItems[]
  extraClaims?: ClaimWithItems[]
  items: ElecQuoteLineItem[]
  sections: ElecQuoteSection[]
  contractTotal: number
  approvedVOTotal?: number
  contractType: ElecContractType
  retentionPct: number
  client?: ClaimClient | null
}

export function ClaimsTab({ quoteId, portalAccountId, initialClaims, extraClaims = [], items, sections, contractTotal, approvedVOTotal = 0, contractType, retentionPct, client = null }: Props) {
  const [claims, setClaims] = useState<ClaimWithItems[]>(initialClaims)

  useEffect(() => {
    if (extraClaims.length === 0) return
    setClaims(prev => {
      const existingIds = new Set(prev.map(c => c.id))
      const newOnes = extraClaims.filter(c => !existingIds.has(c.id))
      return newOnes.length > 0 ? [...newOnes, ...prev] : prev
    })
  }, [extraClaims])
  const [view, setView] = useState<View>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const activeClaims = claims.filter(c => c.status !== 'draft')
  const progressClaims = activeClaims.filter(c => c.claim_type !== 'retention')
  const totalClaimed   = progressClaims.reduce((s, c) => s + c.total_claimed, 0)
  const totalCertified = progressClaims.filter(c => c.total_certified != null).reduce((s, c) => s + (c.total_certified ?? 0), 0)
  const totalPaid      = claims.filter(c => c.status === 'paid').reduce((s, c) => s + (c.total_paid ?? c.total_claimed), 0)
  // Re-measurement: billable value is as-built total, not the original quoted amount
  const adjustedContract = contractType === 're_measurement'
    ? items.reduce((s, i) => {
        const qty = i.as_built_quantity ?? i.quoted_quantity
        const rate = i.as_built_unit_rate ?? i.quoted_unit_rate
        return s + qty * rate
      }, 0) + approvedVOTotal
    : contractTotal + approvedVOTotal
  const balance = adjustedContract - totalClaimed

  // Retention: calculated from certified (or claimed if not certified) amounts × retention %
  const certifiedBase  = activeClaims.filter(c => c.claim_type !== 'retention').reduce((s, c) => s + (c.total_certified ?? c.total_claimed), 0)
  const retentionHeld  = retentionPct > 0 ? Math.round(certifiedBase * retentionPct) / 100 : 0
  const hasRetentionClaim = claims.some(c => c.claim_type === 'retention')

  const hasDraft = claims.some(c => c.status === 'draft')

  function handleCreated(claim: ClaimWithItems) {
    setClaims(prev => [claim, ...prev])
    setView('list')
  }

  function handleStatusChange(id: string, patch: Partial<ClaimWithItems>) {
    setClaims(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  if (view === 'new') {
    return (
      <NewClaimForm
        quoteId={quoteId}
        portalAccountId={portalAccountId}
        claims={claims}
        items={items}
        sections={sections}
        contractType={contractType}
        client={client}
        onCreated={handleCreated}
        onCancel={() => setView('list')}
      />
    )
  }

  if (view === 'retention') {
    return (
      <NewRetentionForm
        quoteId={quoteId}
        portalAccountId={portalAccountId}
        retentionHeld={retentionHeld}
        onCreated={handleCreated}
        onCancel={() => setView('list')}
      />
    )
  }

  const selected = claims.find(c => c.id === selectedId)
  if (view === 'detail' && selected) {
    return (
      <ClaimDetail
        claim={selected}
        items={items}
        onStatusChange={(id, patch) => {
          handleStatusChange(id, patch)
          // Update selected claim inline
        }}
        onClose={() => { setView('list'); setSelectedId(null) }}
      />
    )
  }

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: contractType === 're_measurement' ? 'As-Built Value' : 'Contract Value', value: fmtR(adjustedContract), color: S.text, sub: approvedVOTotal > 0 ? `+ ${fmtR(approvedVOTotal)} VOs` : null, subColor: S.green },
          { label: 'Total Claimed',    value: fmtR(totalClaimed),   color: S.accent,                            sub: null,                                                                                   subColor: S.muted },
          { label: 'Total Certified',  value: fmtR(totalCertified), color: S.gold,                              sub: null,                                                                                   subColor: S.muted },
          { label: 'Balance to Claim', value: fmtR(balance),        color: balance >= 0 ? S.muted : S.danger,  sub: retentionHeld > 0 && !hasRetentionClaim ? `Retention held: ${fmtR(retentionHeld)}` : null, subColor: S.gold },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{card.label}</p>
            <p className="text-lg font-bold" style={{ color: card.color }}>{card.value}</p>
            {card.sub && <p className="text-[10px] mt-0.5" style={{ color: card.subColor }}>{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: S.muted }}>Claims</h2>
        <div className="flex items-center gap-2">
          {retentionPct > 0 && retentionHeld > 0 && !hasRetentionClaim && (
            <button
              onClick={() => setView('retention')}
              disabled={hasDraft}
              title={hasDraft ? 'Finish the existing draft first' : `Release ${fmtR(retentionHeld)} retention`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: S.gold, background: 'rgba(217,164,65,0.1)', border: `1px solid rgba(217,164,65,0.3)` }}>
              Release Retention
            </button>
          )}
          <button
            onClick={() => setView('new')}
            disabled={hasDraft}
            title={hasDraft ? 'Finish or delete the existing draft claim first' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: S.accent, background: 'rgba(58,124,165,0.08)' }}
            onMouseEnter={e => { if (!hasDraft) e.currentTarget.style.background = 'rgba(58,124,165,0.15)' }}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(58,124,165,0.08)'}>
            <Plus size={12} /> New Claim
          </button>
        </div>
      </div>

      {hasDraft && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-3 text-sm"
          style={{ background: 'rgba(217,164,65,0.08)', border: `1px solid ${S.gold}`, color: S.gold }}>
          <AlertCircle size={14} />
          You have a draft claim — submit or delete it before creating a new one.
        </div>
      )}

      {claims.length === 0 && (
        <div className="rounded-2xl py-10 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <p className="text-sm" style={{ color: S.muted }}>No claims yet</p>
        </div>
      )}

      {claims.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {claims.map((c, i) => {
            const st = CLAIM_STATUS[c.status]
            const isSelected = selectedId === c.id && view === 'detail'
            return (
              <button key={c.id}
                onClick={() => { setSelectedId(c.id); setView('detail') }}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}
                onMouseEnter={e => e.currentTarget.style.background = S.bg}
                onMouseLeave={e => e.currentTarget.style.background = isSelected ? S.bg : 'transparent'}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold" style={{ color: S.text }}>{c.claim_number}</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{
                        background: c.claim_type === 'retention' ? 'rgba(217,164,65,0.1)' : ['invoiced','paid'].includes(c.status) ? 'rgba(22,163,74,0.1)' : S.bg,
                        color: c.claim_type === 'retention' ? S.gold : ['invoiced','paid'].includes(c.status) ? S.green : S.muted,
                      }}>
                      {c.claim_type === 'retention' ? 'Retention' : ['invoiced','paid'].includes(c.status) ? 'Tax Invoice' : 'Claim'}
                    </span>
                    {c.variation_order_id && (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>
                        VO
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: S.muted }}>{fmtMonth(c.period_month)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: S.accent }}>{fmtR(c.total_claimed)}</p>
                  {c.total_paid != null && (
                    <p className="text-xs" style={{ color: S.green }}>Paid {fmtR(c.total_paid)}</p>
                  )}
                </div>
                <ChevronRight size={14} style={{ color: S.border, flexShrink: 0 }} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
