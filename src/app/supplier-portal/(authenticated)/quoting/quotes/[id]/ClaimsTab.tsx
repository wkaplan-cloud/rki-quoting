'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, ChevronDown, ChevronRight, Check, AlertCircle, Download } from 'lucide-react'
import type { ElecClaim, ElecClaimLineItem, ElecQuoteLineItem, ElecQuoteSection, ElecClaimStatus, ElecContractType } from '@/lib/elec-types'

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

// How much of an item has already been claimed in submitted/certified/invoiced/paid claims
function prevPct(itemId: string, claims: ClaimWithItems[], excludeId?: string): number {
  return claims
    .filter(c => c.status !== 'draft' && c.id !== excludeId)
    .reduce((sum, c) => {
      const li = c.line_items.find(l => l.quote_line_item_id === itemId)
      return sum + (li?.percentage_claimed ?? 0)
    }, 0)
}

// ─── New claim form ───────────────────────────────────────────────────────────
function NewClaimForm({ quoteId, portalAccountId, claims, items, sections, contractType, onCreated, onCancel }: {
  quoteId: string
  portalAccountId: string
  claims: ClaimWithItems[]
  items: ElecQuoteLineItem[]
  sections: ElecQuoteSection[]
  contractType: ElecContractType
  onCreated: (claim: ClaimWithItems) => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const thisMonth = today.slice(0, 7)

  const [periodMonth, setPeriodMonth] = useState(thisMonth)
  const [claimType, setClaimType] = useState<'invoice' | 'proforma'>('invoice')
  const [claimDate, setClaimDate] = useState(today)
  const [sentToName, setSentToName] = useState('')
  const [sentToEmail, setSentToEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [pcts, setPcts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitNow, setSubmitNow] = useState(false)

  function getPct(itemId: string): number {
    return parseFloat(pcts[itemId] ?? '0') || 0
  }

  function fillFromAsBuilt() {
    const newPcts: Record<string, string> = {}
    for (const item of items) {
      const abQty = item.as_built_quantity ?? item.quoted_quantity
      const abPct = item.quoted_quantity > 0 ? (abQty / item.quoted_quantity) * 100 : 0
      const alreadyClaimed = prevPct(item.id, claims)
      const thisPct = Math.max(0, Math.min(100 - alreadyClaimed, abPct - alreadyClaimed))
      if (thisPct > 0.01) newPcts[item.id] = String(Math.round(thisPct * 10) / 10)
    }
    setPcts(newPcts)
  }

  const lineItems = items.map(item => {
    const contractVal = item.quoted_quantity * item.quoted_unit_rate
    const prev = prevPct(item.id, claims)
    const thisPct = getPct(item.id)
    const thisAmt = contractVal * thisPct / 100
    const remaining = Math.max(0, 100 - prev)
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
          claim_type: claimType,
          claim_date: claimDate,
          sent_to_name: sentToName.trim() || null,
          sent_to_email: sentToEmail.trim() || null,
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
        claim_type: claimType,
        status: submitFlag ? 'submitted' : 'draft',
        total_claimed: totalThisClaim,
        total_certified: null,
        total_invoiced: null,
        total_paid: null,
        sent_to_name: sentToName.trim() || null,
        sent_to_email: sentToEmail.trim() || null,
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
                onChange={e => setPcts(p => ({ ...p, [item.id]: e.target.value }))}
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
        <h3 className="font-bold" style={{ color: S.text }}>New Claim</h3>
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
      <div className="grid grid-cols-3 gap-4 px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Period</label>
          <input type="month" value={periodMonth} onChange={e => setPeriodMonth(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Type</label>
          <div className="flex gap-2 mt-0.5">
            {(['invoice', 'proforma'] as const).map(t => (
              <button key={t} onClick={() => setClaimType(t)}
                className="flex-1 py-2 text-sm rounded-lg font-medium"
                style={{
                  background: claimType === t ? S.accent : S.input,
                  color: claimType === t ? '#fff' : S.muted,
                  border: `1px solid ${claimType === t ? S.accent : S.border}`,
                }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
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
        sent_at: null, notes: notes.trim() || null, variation_order_id: null, created_at: new Date().toISOString(),
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
  onStatusChange: (id: string, patch: Partial<ElecClaim>) => void
  onClose: () => void
}) {
  const supabase = createClient()
  const [certAmount, setCertAmount] = useState(String(claim.total_certified ?? claim.total_claimed))
  const [certBy, setCertBy] = useState('')
  const [showCertForm, setShowCertForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const st = CLAIM_STATUS[claim.status]

  async function advance(status: ElecClaimStatus, extra?: Partial<ElecClaim>) {
    setLoading(true)
    const patch = { status, ...extra }
    const { error } = await supabase.from('elec_claims').update(patch).eq('id', claim.id)
    if (!error) onStatusChange(claim.id, patch)
    setLoading(false)
  }

  async function certify() {
    setLoading(true)
    const certified = parseFloat(certAmount) || 0
    const patch: Partial<ElecClaim> = {
      status: 'certified',
      total_certified: certified,
    }
    const { error } = await supabase.from('elec_claims').update(patch).eq('id', claim.id)
    if (!error) { onStatusChange(claim.id, patch); setShowCertForm(false) }
    setLoading(false)
  }

  const itemMap = Object.fromEntries(items.map(i => [i.id, i]))

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
              style={{ background: S.bg, color: S.muted }}>
              {claim.claim_type.charAt(0).toUpperCase() + claim.claim_type.slice(1)}
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

      {/* Line items */}
      {claim.line_items.length > 0 && (
        <div className="px-5 py-4">
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
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
            <div className="flex justify-between text-sm">
              <span style={{ color: S.muted }}>Total Certified</span>
              <span className="font-semibold" style={{ color: S.gold }}>{fmtR(claim.total_certified)}</span>
            </div>
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

      {/* Certification form (proforma path) */}
      {showCertForm && (
        <div className="mx-5 mb-4 px-4 py-3 rounded-xl" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
          <p className="text-sm font-semibold mb-3" style={{ color: S.text }}>Enter Certified Amount</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Certified Amount (R)</label>
              <input type="number" value={certAmount} onChange={e => setCertAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none text-right"
                style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Certified By</label>
              <input value={certBy} onChange={e => setCertBy(e.target.value)} placeholder="Name / QS / Engineer"
                className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCertForm(false)} className="px-3 py-1.5 text-sm rounded-lg" style={{ color: S.muted }}>Cancel</button>
            <button onClick={certify} disabled={loading}
              className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: S.gold }}>{loading ? 'Saving…' : 'Certify'}</button>
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
        {claim.status === 'submitted' && claim.claim_type === 'proforma' && !showCertForm && (
          <button onClick={() => setShowCertForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'rgba(217,164,65,0.1)', color: S.gold, border: `1px solid ${S.gold}` }}>
            Certify →
          </button>
        )}
        {claim.status === 'submitted' && (claim.claim_type === 'invoice' || claim.claim_type === 'retention') && (
          <button onClick={() => advance('paid', { total_paid: claim.total_claimed })}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: S.green }}>Mark Paid →</button>
        )}
        {claim.status === 'certified' && (
          <button onClick={() => advance('invoiced', { total_invoiced: claim.total_certified ?? claim.total_claimed })}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: S.green }}>Mark Invoiced →</button>
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
  contractType: ElecContractType
  retentionPct: number
}

export function ClaimsTab({ quoteId, portalAccountId, initialClaims, extraClaims = [], items, sections, contractTotal, contractType, retentionPct }: Props) {
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
  const totalClaimed   = activeClaims.reduce((s, c) => s + c.total_claimed, 0)
  const totalCertified = activeClaims.filter(c => c.total_certified != null).reduce((s, c) => s + (c.total_certified ?? 0), 0)
  const totalPaid      = claims.filter(c => c.status === 'paid').reduce((s, c) => s + (c.total_paid ?? c.total_claimed), 0)
  const balance        = contractTotal - totalClaimed

  // Retention: calculated from certified (or claimed if not certified) amounts × retention %
  const certifiedBase  = activeClaims.filter(c => c.claim_type !== 'retention').reduce((s, c) => s + (c.total_certified ?? c.total_claimed), 0)
  const retentionHeld  = retentionPct > 0 ? Math.round(certifiedBase * retentionPct) / 100 : 0
  const hasRetentionClaim = claims.some(c => c.claim_type === 'retention')

  const hasDraft = claims.some(c => c.status === 'draft')

  function handleCreated(claim: ClaimWithItems) {
    setClaims(prev => [claim, ...prev])
    setView('list')
  }

  function handleStatusChange(id: string, patch: Partial<ElecClaim>) {
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
          { label: 'Contract Value',   value: fmtR(contractTotal), color: S.text },
          { label: 'Total Claimed',    value: fmtR(totalClaimed),  color: S.accent },
          { label: 'Total Certified',  value: fmtR(totalCertified), color: S.gold },
          { label: 'Balance to Claim', value: fmtR(balance),       color: balance > 0 ? S.muted : S.green },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{card.label}</p>
            <p className="text-lg font-bold" style={{ color: card.color }}>{card.value}</p>
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
                      style={{ background: S.bg, color: S.muted }}>
                      {c.claim_type === 'retention' ? 'Retention' : c.claim_type === 'proforma' ? 'Proforma' : 'Invoice'}
                    </span>
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
