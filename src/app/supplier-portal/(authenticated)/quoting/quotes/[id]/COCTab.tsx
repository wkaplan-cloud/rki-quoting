'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import type { ElecCOC } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

interface Props {
  quoteId: string
  initialCOC: ElecCOC | null
  cocPrefix: string
}

export function COCTab({ quoteId, initialCOC, cocPrefix }: Props) {
  const supabase = createClient()
  const year = new Date().getFullYear()

  const [coc, setCOC] = useState<ElecCOC>(() => initialCOC ?? {
    id: crypto.randomUUID(),
    quote_id: quoteId,
    coc_number: `${cocPrefix}-${year}-001`,
    installation_description: '',
    issue_date: new Date().toISOString().split('T')[0],
    tester_name: '',
    tester_registration_number: null,
    valid_until: null,
    notes: null,
    created_at: new Date().toISOString(),
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  // Track whether the user has interacted — don't save a blank COC on first render
  const hasEditedRef = useRef(!!initialCOC)

  function set(patch: Partial<ElecCOC>) {
    hasEditedRef.current = true
    setCOC(prev => ({ ...prev, ...patch }))
  }

  const saveDataRef = useRef(coc)
  useEffect(() => { saveDataRef.current = coc }, [coc])

  const handleSave = useCallback(async () => {
    if (!hasEditedRef.current) return
    const current = saveDataRef.current
    setSaveStatus('saving'); setSaveError('')
    try {
      await supabase.from('elec_coc').upsert({ ...current, quote_id: quoteId })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
      setSaveStatus('error')
    }
  }, [quoteId]) // eslint-disable-line

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isMountRef = useRef(true)
  useEffect(() => {
    if (isMountRef.current) { isMountRef.current = false; return }
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => void handleSave(), 1500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [coc]) // eslint-disable-line

  const inp = (label: string, val: string | null, cb: (v: string) => void, placeholder?: string, type = 'text') => (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{label}</label>
      <input type={type} value={val ?? ''} onChange={e => cb(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg outline-none"
        style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
        onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
        onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }} />
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl mb-4"
        style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: S.text }}>Certificate of Compliance</p>
          <p className="text-xs" style={{ color: S.muted }}>Issued under the Occupational Health &amp; Safety Act</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: S.muted }}>
          {saveStatus === 'saving' && <><Loader2 size={12} className="animate-spin" />Saving…</>}
          {saveStatus === 'saved'  && <><Check size={12} style={{ color: S.green }} /><span style={{ color: S.green }}>Saved</span></>}
          {saveStatus === 'error'  && <><AlertCircle size={12} style={{ color: S.danger }} /><span style={{ color: S.danger }}>{saveError}</span></>}
        </div>
      </div>

      <div className="rounded-2xl p-5 grid grid-cols-2 gap-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        {inp('COC Number', coc.coc_number, v => set({ coc_number: v }), `e.g. ${cocPrefix}-${year}-001`)}
        {inp('Issue Date', coc.issue_date, v => set({ issue_date: v }), '', 'date')}
        {inp('Tester Name', coc.tester_name, v => set({ tester_name: v }), 'Full name of tester')}
        {inp('Tester Registration No.', coc.tester_registration_number, v => set({ tester_registration_number: v || null }), 'e.g. ECA-123456')}
        {inp('Valid Until', coc.valid_until, v => set({ valid_until: v || null }), '', 'date')}
        <div />
        <div className="col-span-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Installation Description</label>
          <textarea value={coc.installation_description} onChange={e => set({ installation_description: e.target.value })}
            rows={3} placeholder="Describe the electrical installation covered by this COC"
            className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
            style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
            onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
            onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }} />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</label>
          <textarea value={coc.notes ?? ''} onChange={e => set({ notes: e.target.value || null })}
            rows={2} placeholder="Any additional notes"
            className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
            style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
            onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
            onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }} />
        </div>
      </div>
    </div>
  )
}
