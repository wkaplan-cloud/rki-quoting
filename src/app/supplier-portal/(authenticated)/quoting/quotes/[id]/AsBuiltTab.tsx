'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import type { ElecQuoteLineItem, ElecQuoteSection } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  sections: ElecQuoteSection[]
  items: ElecQuoteLineItem[]
  contractTotal: number
}

export function AsBuiltTab({ sections, items: initialItems, contractTotal }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<ElecQuoteLineItem[]>(initialItems)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const asBuiltTotal = items.reduce((sum, item) => {
    const qty = item.as_built_quantity ?? item.quoted_quantity
    const rate = item.as_built_unit_rate ?? item.quoted_unit_rate
    return sum + qty * rate
  }, 0)
  const variance = asBuiltTotal - contractTotal
  const completionPct = contractTotal > 0 ? Math.round((asBuiltTotal / contractTotal) * 100) : 0

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
    const contractGroup = groupItems.reduce((s, i) => s + i.quoted_quantity * i.quoted_unit_rate, 0)
    const asBuiltGroup = groupItems.reduce((s, i) => {
      const qty = i.as_built_quantity ?? i.quoted_quantity
      const rate = i.as_built_unit_rate ?? i.quoted_unit_rate
      return s + qty * rate
    }, 0)

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
                  {/* AB Qty — grey/faint when not yet set, accent when edited */}
                  <input type="number" value={abQty}
                    onChange={e => updateItem(item.id, { as_built_quantity: parseFloat(e.target.value) || 0 })}
                    className="px-1.5 py-1 text-xs text-right rounded outline-none w-full"
                    style={{
                      background: abQtySet ? '#fff' : 'transparent',
                      border: `1px solid ${abQtySet ? S.accent : S.border}`,
                      color: abQtySet ? S.accent : S.muted,
                    }} />
                  {/* AB Rate — same pattern */}
                  <input type="number" value={abRate}
                    onChange={e => updateItem(item.id, { as_built_unit_rate: parseFloat(e.target.value) || 0 })}
                    className="px-1.5 py-1 text-xs text-right rounded outline-none w-full"
                    style={{
                      background: abRateSet ? '#fff' : 'transparent',
                      border: `1px solid ${abRateSet ? S.accent : S.border}`,
                      color: abRateSet ? S.accent : S.muted,
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

  const freeItems = items.filter(i => i.section_id === null)

  return (
    <div>
      {/* Summary */}
      <div className="rounded-2xl p-4 mb-4 grid grid-cols-4 gap-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Contract Value</p>
          <p className="text-lg font-bold" style={{ color: S.text }}>{fmtR(contractTotal)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>As-Built Value</p>
          <p className="text-lg font-bold" style={{ color: S.accent }}>{fmtR(asBuiltTotal)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Variance</p>
          <p className="text-lg font-bold" style={{ color: variance > 0.01 ? S.gold : variance < -0.01 ? S.danger : S.green }}>
            {variance > 0 ? '+' : ''}{fmtR(variance)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Completion</p>
          <p className="text-lg font-bold" style={{ color: S.text }}>{completionPct}%</p>
          <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: S.bg }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(completionPct, 100)}%`, background: S.accent }} />
          </div>
        </div>
        <div className="col-span-4 flex justify-between items-center pt-1" style={{ borderTop: `1px solid ${S.border}` }}>
          <p className="text-[10px]" style={{ color: S.muted }}>
            <span style={{ color: S.muted }}>C = Contract (locked)</span>
            <span className="mx-3">·</span>
            <span style={{ color: S.accent }}>AB = As-Built (editable)</span>
          </p>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: S.muted }}>
            {saveStatus === 'saving' && <><Loader2 size={12} className="animate-spin" />Saving…</>}
            {saveStatus === 'saved'  && <><Check size={12} style={{ color: S.green }} /><span style={{ color: S.green }}>Saved</span></>}
            {saveStatus === 'error'  && <><AlertCircle size={12} style={{ color: S.danger }} /><span style={{ color: S.danger }}>{saveError}</span></>}
          </div>
        </div>
      </div>

      {freeItems.length > 0 && renderGroup(null, freeItems)}
      {sections.map(s => renderGroup(s.title || 'Untitled Section', items.filter(i => i.section_id === s.id)))}

      {items.length === 0 && (
        <div className="rounded-2xl py-10 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <p className="text-sm" style={{ color: S.muted }}>No line items found</p>
        </div>
      )}
    </div>
  )
}
