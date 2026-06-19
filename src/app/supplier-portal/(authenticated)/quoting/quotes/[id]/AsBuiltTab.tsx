'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2, AlertCircle, Download, Printer, Send, X } from 'lucide-react'
import type { ElecQuoteLineItem, ElecQuoteSection, ElecMaterialRequest } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  quoteId: string
  sections: ElecQuoteSection[]
  items: ElecQuoteLineItem[]
  contractTotal: number      // quote items only (non-VO), with conditional labour — from QuoteEditor
  approvedVOTotal: number    // sum of approved elec_variation_orders.value — from QuoteEditor
  clientEmail?: string | null
}

function itemContractVal(i: ElecQuoteLineItem): number {
  return i.quoted_quantity * i.quoted_unit_rate + i.quoted_quantity * (i.labour_rate ?? 0)
}
function itemAsBuiltVal(i: ElecQuoteLineItem): number {
  const qty  = i.as_built_quantity  ?? i.quoted_quantity
  const rate = i.as_built_unit_rate ?? i.quoted_unit_rate
  return qty * rate + qty * (i.labour_rate ?? 0)
}

export function AsBuiltTab({ quoteId, sections, items: initialItems, contractTotal, approvedVOTotal, clientEmail }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<ElecQuoteLineItem[]>(initialItems)
  const [materials, setMaterials] = useState<ElecMaterialRequest[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    supabase.from('elec_material_requests').select('*').eq('quote_id', quoteId).neq('status', 'cancelled').order('created_at')
      .then(({ data }) => setMaterials((data ?? []) as ElecMaterialRequest[]))
  }, [quoteId]) // eslint-disable-line

  const [showSendModal, setShowSendModal] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendError, setSendError] = useState('')

  function openSendModal() {
    setSendEmail(clientEmail ?? '')
    setSendMessage('')
    setSendStatus('idle')
    setSendError('')
    setShowSendModal(true)
  }

  async function handleSendToClient() {
    if (!sendEmail.trim() || sendStatus === 'sending') return
    setSendStatus('sending')
    try {
      const res = await fetch(`/api/supplier-portal/quoting/quotes/${quoteId}/send-as-built-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail.trim(), message: sendMessage.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Send failed')
      setSendStatus('sent')
      setTimeout(() => setShowSendModal(false), 1800)
    } catch (e: unknown) {
      setSendStatus('error')
      setSendError(e instanceof Error ? e.message : 'Failed to send')
    }
  }

  const asBuiltTotal   = items.reduce((sum, i) => sum + itemAsBuiltVal(i), 0)
  const revisedContract = contractTotal + approvedVOTotal
  const variance        = asBuiltTotal - revisedContract
  const completionPct   = revisedContract > 0 ? Math.round((asBuiltTotal / revisedContract) * 100) : 0

  const saveDataRef = useRef(items)
  useEffect(() => { saveDataRef.current = items }, [items])

  const handleSave = useCallback(async () => {
    const current = saveDataRef.current
    setSaveStatus('saving'); setSaveError('')
    try {
      for (const item of current) {
        const { error } = await supabase
          .from('elec_quote_line_items')
          .update({ as_built_quantity: item.as_built_quantity, as_built_unit_rate: item.as_built_unit_rate })
          .eq('id', item.id)
        if (error) throw new Error(error.message)
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
      setSaveStatus('error')
    }
  }, []) // eslint-disable-line

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isMountRef = useRef(true)
  useEffect(() => {
    if (isMountRef.current) { isMountRef.current = false; return }
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => void handleSave(), 1500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [items]) // eslint-disable-line

  function updateItem(id: string, patch: Partial<ElecQuoteLineItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  function renderGroup(title: string | null, groupItems: ElecQuoteLineItem[]) {
    if (groupItems.length === 0) return null
    const contractGroup = groupItems.reduce((s, i) => s + itemContractVal(i), 0)
    const asBuiltGroup  = groupItems.reduce((s, i) => s + itemAsBuiltVal(i), 0)

    return (
      <div className="rounded-2xl overflow-hidden mb-3" style={{ border: `1px solid ${S.border}`, background: S.card }}>
        {title && (
          <div className="flex items-center justify-between px-4 py-3"
            style={{ background: 'rgba(58,124,165,0.04)', borderBottom: `1px solid ${S.border}` }}>
            <span className="text-sm font-semibold" style={{ color: S.text }}>{title}</span>
            <div className="flex items-center gap-4 text-xs">
              <span style={{ color: S.muted }}>Contract: <strong style={{ color: S.text }}>{fmtR(contractGroup)}</strong></span>
              <span style={{ color: S.muted }}>As-Built: <strong style={{ color: S.accent }}>{fmtR(asBuiltGroup)}</strong></span>
            </div>
          </div>
        )}
        <div className="p-3">
          <div className="grid items-center px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ gridTemplateColumns: '1fr 55px 85px 85px 85px 85px 85px 85px', color: S.muted, gap: '4px' }}>
            <span>Description</span>
            <span className="text-center">Unit</span>
            <span className="text-right">C Qty</span>
            <span className="text-right">C Rate</span>
            <span className="text-right">C Value</span>
            <span className="text-right">AB Qty</span>
            <span className="text-right">AB Rate</span>
            <span className="text-right">AB Value</span>
          </div>
          {groupItems.map(item => {
            const contractVal = item.quoted_quantity * item.quoted_unit_rate
            const abQtySet  = item.as_built_quantity !== null
            const abRateSet = item.as_built_unit_rate !== null
            const abQty  = item.as_built_quantity ?? item.quoted_quantity
            const abRate = item.as_built_unit_rate ?? item.quoted_unit_rate
            const abVal  = abQty * abRate
            const diff   = abVal - contractVal
            return (
              <div key={item.id} className="rounded-lg mb-1.5 px-2 py-2"
                style={{ background: S.bg, border: `1px solid ${S.border}` }}>
                <div className="grid items-center" style={{ gridTemplateColumns: '1fr 55px 85px 85px 85px 85px 85px 85px', gap: '4px' }}>
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: S.text }}>{item.description || '—'}</p>
                    {item.is_variation && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(217,164,65,0.12)', color: S.gold }}>VO</span>
                    )}
                  </div>
                  <span className="text-xs text-center" style={{ color: S.muted }}>{item.unit ?? '—'}</span>
                  <span className="text-xs text-right font-mono" style={{ color: S.muted }}>{item.quoted_quantity}</span>
                  <span className="text-xs text-right font-mono" style={{ color: S.muted }}>{fmtR(item.quoted_unit_rate)}</span>
                  <span className="text-xs text-right font-mono" style={{ color: S.muted }}>{fmtR(contractVal)}</span>
                  {/* AB Qty — always editable; accent highlight when value differs from contract */}
                  <input type="number" value={abQty}
                    onChange={e => updateItem(item.id, { as_built_quantity: parseFloat(e.target.value) || 0 })}
                    className="px-1.5 py-1 text-xs text-right rounded outline-none w-full"
                    style={{
                      background: abQtySet ? '#fff' : S.input,
                      border: `1px solid ${abQtySet ? S.accent : S.border}`,
                      color: abQtySet ? S.accent : S.text,
                    }} />
                  {/* AB Rate — always editable; accent highlight when value differs from contract */}
                  <input type="number" value={abRate}
                    onChange={e => updateItem(item.id, { as_built_unit_rate: parseFloat(e.target.value) || 0 })}
                    className="px-1.5 py-1 text-xs text-right rounded outline-none w-full"
                    style={{
                      background: abRateSet ? '#fff' : S.input,
                      border: `1px solid ${abRateSet ? S.accent : S.border}`,
                      color: abRateSet ? S.accent : S.text,
                    }} />
                  <span className="text-xs text-right font-semibold font-mono"
                    style={{ color: diff > 0.01 ? S.gold : diff < -0.01 ? S.danger : S.text }}>
                    {fmtR(abVal)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const quoteItems = items.filter(i => !i.is_variation)
  const voItems    = items.filter(i => i.is_variation)
  const freeItems  = quoteItems.filter(i => i.section_id === null)

  const MAT_STATUS_COLOR: Record<string, string> = {
    pending: S.gold, ordered: S.accent, received: S.green,
  }

  return (
    <div>
      {/* Summary */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="grid gap-4 mb-3" style={{ gridTemplateColumns: approvedVOTotal > 0 ? 'repeat(6,1fr)' : 'repeat(4,1fr)' }}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Quote Contract</p>
            <p className="text-base font-bold" style={{ color: S.text }}>{fmtR(contractTotal)}</p>
          </div>
          {approvedVOTotal > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Approved VOs</p>
              <p className="text-base font-bold" style={{ color: S.gold }}>+{fmtR(approvedVOTotal)}</p>
            </div>
          )}
          {approvedVOTotal > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Revised Contract</p>
              <p className="text-base font-bold" style={{ color: S.text }}>{fmtR(revisedContract)}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>As-Built Total</p>
            <p className="text-base font-bold" style={{ color: S.accent }}>{fmtR(asBuiltTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Variance</p>
            <p className="text-base font-bold" style={{ color: variance > 0.01 ? S.gold : variance < -0.01 ? S.danger : S.green }}>
              {variance > 0 ? '+' : ''}{fmtR(variance)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Completion</p>
            <p className="text-base font-bold" style={{ color: completionPct >= 100 ? S.green : S.text }}>{completionPct}%</p>
            <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: S.bg }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(completionPct, 100)}%`, background: S.accent }} />
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center pt-3" style={{ borderTop: `1px solid ${S.border}` }}>
          <p className="text-[10px]" style={{ color: S.muted }}>
            <span style={{ color: S.muted }}>C = Contract (locked)</span>
            <span className="mx-3">·</span>
            <span style={{ color: S.accent }}>AB = As-Built (editable)</span>
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: S.muted }}>
              {saveStatus === 'saving' && <><Loader2 size={12} className="animate-spin" />Saving…</>}
              {saveStatus === 'saved'  && <><Check size={12} style={{ color: S.green }} /><span style={{ color: S.green }}>Saved</span></>}
              {saveStatus === 'error'  && <><AlertCircle size={12} style={{ color: S.danger }} /><span style={{ color: S.danger }}>{saveError}</span></>}
            </div>
            <button onClick={() => window.open(`/api/supplier-portal/quoting/quotes/${quoteId}/as-built-pdf?inline=1`, '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ color: S.muted, background: S.input, border: `1px solid ${S.border}` }}
              onMouseEnter={e => (e.currentTarget.style.background = S.border)}
              onMouseLeave={e => (e.currentTarget.style.background = S.input)}>
              <Printer size={11} /> Print
            </button>
            <a href={`/api/supplier-portal/quoting/quotes/${quoteId}/as-built-pdf`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ color: S.accent, background: 'rgba(58,124,165,0.08)', border: '1px solid rgba(58,124,165,0.2)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(58,124,165,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(58,124,165,0.08)')}>
              <Download size={11} /> Download PDF
            </a>
            <button onClick={openSendModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: S.accent }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              <Send size={11} /> Send to Client →
            </button>
          </div>
        </div>
      </div>

      {/* ── Quote Items ── */}
      {(freeItems.length > 0 || sections.some(s => quoteItems.some(i => i.section_id === s.id))) && (
        <div className="mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: S.muted }}>Quote Items</p>
          {freeItems.length > 0 && renderGroup(null, freeItems)}
          {sections.map(s => renderGroup(s.title || 'Untitled Section', quoteItems.filter(i => i.section_id === s.id)))}
        </div>
      )}

      {/* ── VO Items ── */}
      {voItems.length > 0 && (
        <div className="mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: S.gold }}>Variation Orders</p>
          {renderGroup(null, voItems)}
        </div>
      )}

      {/* ── Materials ── */}
      {materials.length > 0 && (
        <div className="mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: S.muted }}>Materials</p>
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${S.border}`, background: S.card }}>
            <div className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: '1fr 60px 60px 90px', gap: '8px', color: S.muted, background: 'rgba(58,124,165,0.04)', borderBottom: `1px solid ${S.border}` }}>
              <span>Description</span>
              <span className="text-center">Unit</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Status</span>
            </div>
            {materials.map((m, i) => (
              <div key={m.id} className="grid px-4 py-3 items-center text-sm"
                style={{ gridTemplateColumns: '1fr 60px 60px 90px', gap: '8px', borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                <div>
                  <p style={{ color: S.text }}>{m.description}</p>
                  {m.notes && <p className="text-xs mt-0.5 italic" style={{ color: S.muted }}>{m.notes}</p>}
                </div>
                <span className="text-xs text-center" style={{ color: S.muted }}>{m.unit ?? 'nr'}</span>
                <span className="text-xs text-right font-mono" style={{ color: S.muted }}>{m.qty}</span>
                <span className="text-right">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                    style={{ background: `${MAT_STATUS_COLOR[m.status] ?? S.muted}18`, color: MAT_STATUS_COLOR[m.status] ?? S.muted }}>
                    {m.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && materials.length === 0 && (
        <div className="rounded-2xl py-10 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <p className="text-sm" style={{ color: S.muted }}>No line items found</p>
        </div>
      )}

      {/* Send to Client Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSendModal(false) }}>
          <div className="rounded-2xl w-full max-w-md p-6 shadow-2xl" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-base" style={{ color: S.text }}>Send As-Built to Client</h2>
              <button onClick={() => setShowSendModal(false)} className="p-1.5 rounded-lg" style={{ color: S.muted }}
                onMouseEnter={e => (e.currentTarget.style.background = S.border)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X size={15} />
              </button>
            </div>

            {sendStatus === 'sent' ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.1)' }}>
                  <Check size={22} style={{ color: S.green }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: S.text }}>As-built sent!</p>
                <p className="text-sm mt-1" style={{ color: S.muted }}>{sendEmail}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: S.muted }}>Client email</label>
                  <input
                    type="email"
                    value={sendEmail}
                    onChange={e => setSendEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: S.muted }}>Message (optional)</label>
                  <textarea
                    rows={3}
                    value={sendMessage}
                    onChange={e => setSendMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
                  />
                </div>
                {sendStatus === 'error' && (
                  <p className="flex items-center gap-1.5 text-xs" style={{ color: S.danger }}>
                    <AlertCircle size={12} /> {sendError || 'Failed to send — please try again'}
                  </p>
                )}
                <button
                  onClick={() => void handleSendToClient()}
                  disabled={!sendEmail.trim() || sendStatus === 'sending'}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: S.accent }}>
                  {sendStatus === 'sending' ? <><Loader2 size={14} className="animate-spin" />Sending…</> : <><Send size={14} />Send As-Built PDF</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
