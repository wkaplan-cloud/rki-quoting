'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Check, FileText, AlertCircle, Download, Printer, Send, Mail, Loader2, CheckCircle } from 'lucide-react'
import type { ElecVariationOrder, ElecVOStatus, ElecClaim, ElecClaimLineItem } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

const VO_STATUS: Record<ElecVOStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: '#D9A441', bg: 'rgba(217,164,65,0.1)' },
  approved: { label: 'Approved', color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEF2F2' },
}

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type VOClaim = Pick<ElecClaim, 'id' | 'claim_number' | 'status' | 'variation_order_id'>

interface Props {
  quoteId: string
  portalAccountId: string
  initialVOs: ElecVariationOrder[]
  initialClaims: VOClaim[]
  voPrefix: string
  companyCode: string
  onClaimCreated: (claim: ElecClaim & { line_items: ElecClaimLineItem[] }) => void
  onVOsChanged?: (vos: ElecVariationOrder[]) => void
}

export function VariationsTab({ quoteId, portalAccountId, initialVOs, initialClaims, voPrefix, companyCode, onClaimCreated, onVOsChanged }: Props) {
  const supabase = createClient()
  const [vos, setVOs] = useState(initialVOs)
  const [voClaims, setVOClaims] = useState<VOClaim[]>(initialClaims.filter(c => c.variation_order_id != null))
  const [showAdd, setShowAdd] = useState(false)
  const [invoicingVoId, setInvoicingVoId] = useState<string | null>(null)

  // New VO form state
  const [formDesc, setFormDesc] = useState('')
  const [formValue, setFormValue] = useState('')
  const [formCost, setFormCost] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formRequestedBy, setFormRequestedBy] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // VO invoice form state
  const [voClaimDate, setVOClaimDate] = useState(new Date().toISOString().split('T')[0])
  const [voSentToName, setVOSentToName] = useState('')
  const [voSentToEmail, setVOSentToEmail] = useState('')
  const [voNotes, setVONotes] = useState('')
  const [voLoading, setVOLoading] = useState(false)
  const [voError, setVOError] = useState('')

  // Inline cost editing
  const [editingCostId, setEditingCostId] = useState<string | null>(null)
  const [editingCostVal, setEditingCostVal] = useState('')

  async function saveCost(voId: string) {
    const cost = editingCostVal.trim() ? (parseFloat(editingCostVal) || null) : null
    await supabase.from('elec_variation_orders').update({ cost_value: cost }).eq('id', voId)
    setVOs(prev => {
      const next = prev.map(v => v.id === voId ? { ...v, cost_value: cost } : v)
      onVOsChanged?.(next)
      return next
    })
    setEditingCostId(null)
  }

  // Send to client modal state
  const [sendModalVO, setSendModalVO] = useState<ElecVariationOrder | null>(null)
  const [sendEmail, setSendEmail] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sendDone, setSendDone] = useState(false)

  const year = new Date().getFullYear()

  async function handleSendToClient() {
    if (!sendModalVO || !sendEmail.trim()) { setSendError('Email required'); return }
    setSendLoading(true); setSendError('')
    const res = await fetch(`/api/supplier-portal/quoting/vos/${sendModalVO.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sendEmail.trim(), message: sendMessage.trim() || undefined }),
    })
    const json = await res.json()
    if (!res.ok) { setSendError(json.error ?? 'Failed to send'); setSendLoading(false); return }
    const voId = sendModalVO.id
    setVOs(prev => {
      const next = prev.map(v => v.id === voId ? { ...v, sent_to_email: sendEmail.trim(), sent_at: new Date().toISOString() } : v)
      onVOsChanged?.(next)
      return next
    })
    setSendLoading(false)
    setSendDone(true)
  }

  function closeSendModal() {
    setSendModalVO(null); setSendEmail(''); setSendMessage(''); setSendError(''); setSendDone(false)
  }

  async function handleCreate() {
    if (!formDesc.trim()) { setError('Description required'); return }
    setLoading(true); setError('')
    const num = String(vos.length + 1).padStart(3, '0')
    const voNumber = companyCode ? `${companyCode}-${voPrefix}-${year}-${num}` : `${voPrefix}-${year}-${num}`
    const { data, error: err } = await supabase
      .from('elec_variation_orders')
      .insert({
        quote_id: quoteId,
        vo_number: voNumber,
        description: formDesc.trim(),
        value: parseFloat(formValue) || 0,
        cost_value: formCost.trim() ? (parseFloat(formCost) || null) : null,
        requested_by: formRequestedBy.trim() || null,
        notes: formNotes.trim() || null,
        status: 'pending',
      })
      .select()
      .single()
    if (err) { setError(err.message); setLoading(false); return }
    setVOs(prev => [data as ElecVariationOrder, ...prev])
    setFormDesc(''); setFormValue(''); setFormCost(''); setFormNotes(''); setFormRequestedBy('')
    setShowAdd(false); setLoading(false)
  }

  async function updateStatus(voId: string, status: ElecVOStatus) {
    const patch: Partial<ElecVariationOrder> = { status }
    if (status === 'approved') patch.approved_date = new Date().toISOString().split('T')[0]
    await supabase.from('elec_variation_orders').update(patch).eq('id', voId)
    setVOs(prev => {
      const next = prev.map(v => v.id === voId ? { ...v, ...patch } : v)
      onVOsChanged?.(next)
      return next
    })
  }

  async function handleInvoiceVO(vo: ElecVariationOrder, submitFlag: boolean) {
    setVOLoading(true); setVOError('')
    try {
      const sentAt = submitFlag ? new Date().toISOString() : null
      const res = await fetch(`/api/supplier-portal/quoting/quotes/${quoteId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_month: voClaimDate.slice(0, 7) + '-01',
          claim_type: 'invoice',
          claim_date: voClaimDate,
          sent_to_name: voSentToName.trim() || null,
          sent_to_email: voSentToEmail.trim() || null,
          notes: voNotes.trim() || null,
          submit: submitFlag,
          sent_at: sentAt,
          line_items: [],
          fixed_amount: vo.value,
          variation_order_id: vo.id,
        }),
      })
      const data = await res.json() as { id?: string; claim_number?: string; error?: string }
      if (!res.ok || !data.id) { setVOError(data.error ?? 'Failed'); setVOLoading(false); return }

      const fullClaim: ElecClaim & { line_items: ElecClaimLineItem[] } = {
        id: data.id!,
        quote_id: quoteId,
        portal_account_id: portalAccountId,
        claim_number: data.claim_number!,
        claim_date: voClaimDate,
        period_month: voClaimDate.slice(0, 7) + '-01',
        claim_type: 'invoice',
        status: submitFlag ? 'submitted' : 'draft',
        total_claimed: vo.value,
        total_certified: null,
        total_invoiced: null,
        total_paid: null,
        sent_to_name: voSentToName.trim() || null,
        sent_to_email: voSentToEmail.trim() || null,
        qs_name: null,
        qs_email: null,
        sent_at: sentAt,
        notes: voNotes.trim() || null,
        variation_order_id: vo.id,
        share_token: null,
        share_token_created_at: null,
        created_at: new Date().toISOString(),
        line_items: [],
      }
      setVOClaims(prev => [...prev, {
        id: fullClaim.id,
        claim_number: fullClaim.claim_number,
        status: fullClaim.status,
        variation_order_id: vo.id,
      }])
      onClaimCreated(fullClaim)
      setInvoicingVoId(null)
      setVOClaimDate(new Date().toISOString().split('T')[0])
      setVOSentToName(''); setVOSentToEmail(''); setVONotes('')
    } catch (e: unknown) {
      setVOError(e instanceof Error ? e.message : 'Error')
    }
    setVOLoading(false)
  }

  const totalApproved = vos.filter(v => v.status === 'approved').reduce((s, v) => s + v.value, 0)
  const totalPending  = vos.filter(v => v.status === 'pending').reduce((s, v) => s + v.value, 0)

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Approved VOs', value: fmtR(totalApproved), color: S.green },
          { label: 'Pending VOs',  value: fmtR(totalPending),  color: S.gold },
          { label: 'Total VOs',    value: String(vos.length),  color: S.text },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{c.label}</p>
            <p className="text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Add VO form */}
      {showAdd && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ color: S.text }}>New Variation Order</h3>
            <button onClick={() => { setShowAdd(false); setError('') }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-75"
              style={{ color: S.muted, background: S.bg }}>Cancel</button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Description *</label>
              <input value={formDesc} onChange={e => setFormDesc(e.target.value)} autoFocus
                className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Charge to Client (R)</label>
              <input type="number" value={formValue} onChange={e => setFormValue(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none text-right"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>
                Your Cost (R)
                {(() => {
                  const v = parseFloat(formValue) || 0
                  const c = parseFloat(formCost) || 0
                  if (v > 0 && c > 0) {
                    const margin = Math.round((v - c) / v * 1000) / 10
                    return <span className="ml-2 normal-case font-normal" style={{ color: margin >= 0 ? S.green : S.danger }}>{margin}% margin</span>
                  }
                  return null
                })()}
              </label>
              <input type="number" value={formCost} onChange={e => setFormCost(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none text-right"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Requested By</label>
              <input value={formRequestedBy} onChange={e => setFormRequestedBy(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</label>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          </div>
          {error && <p className="text-sm px-3 py-2 rounded mb-3" style={{ background: '#FEF2F2', color: S.danger, border: '1px solid #FECACA' }}>{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setError('') }}
              className="px-4 py-2 text-sm rounded-lg" style={{ color: S.muted }}>Cancel</button>
            <button onClick={handleCreate} disabled={loading || !formDesc.trim()}
              className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: S.accent }}>{loading ? 'Creating…' : 'Create VO'}</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: S.muted }}>Variation Orders</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => window.open(`/api/supplier-portal/quoting/quotes/${quoteId}/variations-pdf?inline=1`, '_blank')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ color: S.muted, background: S.input, border: `1px solid ${S.border}` }}
            onMouseEnter={e => (e.currentTarget.style.background = S.border)}
            onMouseLeave={e => (e.currentTarget.style.background = S.input)}>
            <Printer size={11} /> Print
          </button>
          <a href={`/api/supplier-portal/quoting/quotes/${quoteId}/variations-pdf`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ color: S.accent, background: 'rgba(58,124,165,0.08)', border: '1px solid rgba(58,124,165,0.2)', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(58,124,165,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(58,124,165,0.08)')}>
            <Download size={11} /> Download PDF
          </a>
          {!showAdd && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ color: S.accent, background: 'rgba(58,124,165,0.08)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(58,124,165,0.08)'}>
              <Plus size={12} /> Add VO
            </button>
          )}
        </div>
      </div>

      {vos.length === 0 && !showAdd && (
        <div className="rounded-2xl py-10 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <p className="text-sm" style={{ color: S.muted }}>No variation orders yet</p>
        </div>
      )}

      {vos.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {vos.map((vo, i) => {
            const st = VO_STATUS[vo.status]
            const linkedClaim = voClaims.find(c => c.variation_order_id === vo.id)
            const isInvoicing = invoicingVoId === vo.id
            return (
              <div key={vo.id}
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                {/* VO row */}
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono" style={{ color: S.muted }}>{vo.vo_number}</span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        {vo.sent_at && (
                          <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(58,124,165,0.08)', color: S.accent }}>
                            <Mail size={10} /> Sent to {vo.sent_to_email}
                          </span>
                        )}
                        {linkedClaim && (
                          <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(22,163,74,0.08)', color: S.green }}>
                            <FileText size={10} /> {linkedClaim.claim_number}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium" style={{ color: S.text }}>{vo.description}</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: S.accent }}>{fmtR(vo.value)}</p>
                      {vo.requested_by && <p className="text-xs mt-1" style={{ color: S.muted }}>Requested by: {vo.requested_by}</p>}
                      {vo.notes && <p className="text-xs mt-0.5 italic" style={{ color: S.muted }}>{vo.notes}</p>}
                      {vo.approved_date && <p className="text-xs mt-0.5" style={{ color: S.green }}>Approved {vo.approved_date}</p>}
                      {vo.rejection_notes && <p className="text-xs mt-0.5 italic" style={{ color: S.danger }}>Reason: {vo.rejection_notes}</p>}
                      {editingCostId === vo.id ? (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Cost (R)</span>
                          <input
                            type="number"
                            autoFocus
                            value={editingCostVal}
                            onChange={e => setEditingCostVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') void saveCost(vo.id); if (e.key === 'Escape') setEditingCostId(null) }}
                            className="px-2 py-0.5 text-xs rounded outline-none text-right w-28"
                            style={{ background: S.input, border: `1px solid ${S.accent}`, color: S.text }} />
                          <button onClick={() => void saveCost(vo.id)}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded"
                            style={{ background: S.accent, color: '#fff' }}>Save</button>
                          <button onClick={() => setEditingCostId(null)}
                            className="text-[10px]" style={{ color: S.muted }}>Cancel</button>
                        </div>
                      ) : vo.cost_value != null ? (() => {
                        const margin = vo.value > 0 ? Math.round((vo.value - vo.cost_value) / vo.value * 1000) / 10 : 0
                        return (
                          <button onClick={() => { setEditingCostId(vo.id); setEditingCostVal(String(vo.cost_value)) }}
                            className="text-xs mt-0.5 text-left hover:opacity-75"
                            style={{ color: margin >= 0 ? S.green : S.danger }}>
                            Cost: {fmtR(vo.cost_value)} · Margin: {margin}% ✎
                          </button>
                        )
                      })() : (
                        <button onClick={() => { setEditingCostId(vo.id); setEditingCostVal('') }}
                          className="text-xs mt-0.5 text-left hover:opacity-75"
                          style={{ color: S.gold }}>
                          ⚠ No cost entered — profit may be overstated. Add cost →
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      {vo.status === 'pending' && (
                        <>
                          <button
                            onClick={() => { setSendModalVO(vo); setSendDone(false) }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'rgba(58,124,165,0.08)', color: S.accent, border: `1px solid rgba(58,124,165,0.2)` }}>
                            <Send size={11} /> Send to Client
                          </button>
                          <button onClick={() => updateStatus(vo.id, 'approved')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ background: S.green }}>
                            <Check size={11} /> Mark Approved (verbal)
                          </button>
                          <button onClick={() => updateStatus(vo.id, 'rejected')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: '#FEF2F2', color: S.danger }}>
                            <X size={11} /> Mark Rejected
                          </button>
                        </>
                      )}
                      {vo.status === 'approved' && !linkedClaim && !isInvoicing && (
                        <button
                          onClick={() => { setInvoicingVoId(vo.id); setVOError('') }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(58,124,165,0.08)', color: S.accent, border: `1px solid rgba(58,124,165,0.2)` }}>
                          <FileText size={11} /> Invoice VO
                        </button>
                      )}
                      {isInvoicing && (
                        <button onClick={() => setInvoicingVoId(null)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-75"
                          style={{ color: S.muted, background: S.bg }}>Cancel</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline invoice form */}
                {isInvoicing && (
                  <div className="mx-5 mb-4 rounded-xl p-4" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
                    <p className="text-xs font-semibold mb-3" style={{ color: S.text }}>
                      Invoice for {vo.vo_number} — {fmtR(vo.value)}
                    </p>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Invoice Date</label>
                        <input type="date" value={voClaimDate} onChange={e => setVOClaimDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                          style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Send To (Name)</label>
                        <input value={voSentToName} onChange={e => setVOSentToName(e.target.value)} placeholder="Optional"
                          className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                          style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Send To (Email)</label>
                        <input type="email" value={voSentToEmail} onChange={e => setVOSentToEmail(e.target.value)} placeholder="Optional"
                          className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                          style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</label>
                        <input value={voNotes} onChange={e => setVONotes(e.target.value)} placeholder="Optional"
                          className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                          style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
                      </div>
                    </div>
                    {voError && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded mb-3 text-sm"
                        style={{ background: '#FEF2F2', color: S.danger, border: '1px solid #FECACA' }}>
                        <AlertCircle size={13} />{voError}
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setInvoicingVoId(null)} className="px-4 py-2 text-sm rounded-lg" style={{ color: S.muted }}>Cancel</button>
                      <button onClick={() => handleInvoiceVO(vo, false)} disabled={voLoading}
                        className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                        style={{ background: '#fff', color: S.text, border: `1px solid ${S.border}` }}>
                        Save Draft
                      </button>
                      <button onClick={() => handleInvoiceVO(vo, true)} disabled={voLoading}
                        className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                        style={{ background: S.accent }}>
                        {voLoading ? 'Sending…' : 'Send to Client'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Send to client modal */}
      {sendModalVO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) closeSendModal() }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <div>
                <h2 className="font-bold text-sm" style={{ color: S.text }}>Send to Client for Approval</h2>
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>{sendModalVO.vo_number} · {fmtR(sendModalVO.value)}</p>
              </div>
              <button onClick={closeSendModal} className="p-1.5 rounded-lg" style={{ color: S.muted }}>
                <X size={15} />
              </button>
            </div>

            {sendDone ? (
              <div className="px-5 py-10 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.1)' }}>
                  <CheckCircle size={22} style={{ color: S.green }} />
                </div>
                <p className="font-semibold text-sm" style={{ color: S.text }}>Sent successfully!</p>
                <p className="text-xs text-center" style={{ color: S.muted }}>
                  Approval request sent to <strong>{sendEmail}</strong>.
                  <br />They can approve or reject directly from the email.
                </p>
                <button onClick={closeSendModal}
                  className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: S.accent }}>Done</button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Client Email *</label>
                  <input type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)}
                    autoFocus placeholder="client@example.com"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Message <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)}
                    rows={2} placeholder="Add a note for the client…"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                {sendError && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: '#FEF2F2', color: S.danger }}>
                    <AlertCircle size={13} />{sendError}
                  </div>
                )}
                <button onClick={() => void handleSendToClient()}
                  disabled={!sendEmail.trim() || sendLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: S.accent }}>
                  {sendLoading ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Approval Request</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
