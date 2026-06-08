'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { FileCheck, Download, Loader2, Search, CheckCircle2, Plus, ExternalLink, X, Pencil, Check, AlertCircle, Send, Printer } from 'lucide-react'
import type { ElecCOC } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

type COCWithQuote = ElecCOC & {
  quote: { id: string; quote_number: string; project_name: string; project_address: string | null } | null
  job_card: { id: string; job_number: string; title: string; location: string | null } | null
}

type TestResult = 'pass' | 'fail' | 'n/a'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  initialCOCs: COCWithQuote[]
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function COCEditModal({ coc: initial, onClose, onSaved }: {
  coc: COCWithQuote
  onClose: () => void
  onSaved: (updated: COCWithQuote) => void
}) {
  const [coc, setCOC] = useState<COCWithQuote>(initial)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendEmail, setSendEmail] = useState(initial.sent_to_email ?? '')
  const [sendMsg, setSendMsg] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendError, setSendError] = useState('')

  const hasEditedRef = useRef(false)
  const saveDataRef  = useRef(coc)
  useEffect(() => { saveDataRef.current = coc }, [coc])

  function set(patch: Partial<ElecCOC>) {
    hasEditedRef.current = true
    setCOC(prev => ({ ...prev, ...patch }))
  }

  const autoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isMountRef = useRef(true)
  useEffect(() => {
    if (isMountRef.current) { isMountRef.current = false; return }
    clearTimeout(autoTimer.current)
    autoTimer.current = setTimeout(() => void handleSave(), 1500)
    return () => clearTimeout(autoTimer.current)
  }, [coc]) // eslint-disable-line

  const handleSave = useCallback(async (force = false): Promise<boolean> => {
    if (!hasEditedRef.current && !force) return true
    const current = saveDataRef.current
    setSaveStatus('saving'); setSaveError('')
    try {
      const res = await fetch('/api/supplier-portal/quoting/coc/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
      setSaveStatus('saved')
      onSaved(saveDataRef.current)
      setTimeout(() => setSaveStatus('idle'), 2500)
      return true
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
      setSaveStatus('error')
      return false
    }
  }, [onSaved]) // eslint-disable-line

  async function handleDownload() {
    setDownloading(true)
    clearTimeout(autoTimer.current)
    hasEditedRef.current = true
    const win = window.open('', '_blank')
    const ok = await handleSave(true)
    if (ok && win) win.location.href = `/api/supplier-portal/quoting/coc/${coc.id}/pdf`
    else if (win) win.close()
    setDownloading(false)
  }

  async function handlePrint() {
    clearTimeout(autoTimer.current)
    const win = window.open('', '_blank')
    hasEditedRef.current = true
    const ok = await handleSave(true)
    if (ok && win) win.location.href = `/api/supplier-portal/quoting/coc/${coc.id}/pdf?inline=1`
    else if (win) win.close()
  }

  async function handleSend() {
    if (!sendEmail.trim() || sendStatus === 'sending') return
    setSendStatus('sending'); setSendError('')
    clearTimeout(autoTimer.current)
    hasEditedRef.current = true
    await handleSave(true)
    try {
      const res = await fetch(`/api/supplier-portal/quoting/coc/${coc.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail.trim(), message: sendMsg.trim() || undefined }),
      })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !d.ok) { setSendStatus('error'); setSendError(d.error ?? 'Failed'); return }
      setCOC(prev => ({ ...prev, sent_to_email: sendEmail.trim(), sent_at: new Date().toISOString() }))
      setSendStatus('sent')
    } catch { setSendStatus('error'); setSendError('Network error') }
  }

  function Inp({ label, val, cb, placeholder, type = 'text' }: { label: string; val: string | null; cb: (v: string) => void; placeholder?: string; type?: string }) {
    return (
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{label}</label>
        <input type={type} value={val ?? ''} onChange={e => cb(e.target.value)} placeholder={placeholder}
          className="w-full px-3 py-2 text-sm rounded-lg outline-none"
          style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
          onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
          onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }} />
      </div>
    )
  }

  function Sel({ label, val, cb, options }: { label: string; val: string | null; cb: (v: string) => void; options: { v: string; label: string }[] }) {
    return (
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{label}</label>
        <select value={val ?? ''} onChange={e => cb(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg outline-none"
          style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}>
          {options.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </div>
    )
  }

  function ResultToggle({ val, onChange }: { val: string | null; onChange: (v: TestResult) => void }) {
    const current = (val ?? 'pass') as TestResult
    const opts: { v: TestResult; label: string; color: string; bg: string }[] = [
      { v: 'pass', label: 'Pass', color: S.green,  bg: 'rgba(22,163,74,0.1)'  },
      { v: 'fail', label: 'Fail', color: S.danger, bg: 'rgba(220,38,38,0.1)'  },
      { v: 'n/a',  label: 'N/A',  color: S.muted,  bg: S.bg                   },
    ]
    return (
      <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
        {opts.map(o => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className="flex-1 py-1 text-xs font-semibold"
            style={{ background: current === o.v ? o.bg : '#fff', color: current === o.v ? o.color : S.muted }}>
            {o.label}
          </button>
        ))}
      </div>
    )
  }

  function SectionHead({ letter, title }: { letter: string; title: string }) {
    return (
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: S.accent }}>{letter}</div>
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: S.text }}>{title}</h3>
      </div>
    )
  }

  const title = coc.quote
    ? `${coc.quote.quote_number} — ${coc.quote.project_name}`
    : coc.job_card
    ? `${coc.job_card.job_number} — ${coc.job_card.title}`
    : coc.coc_number

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden my-4"
        style={{ background: S.bg, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono" style={{ color: S.muted }}>{coc.coc_number}</p>
            <p className="text-sm font-semibold truncate mt-0.5" style={{ color: S.text }}>{title}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: S.muted }}>
              {saveStatus === 'saving' && <><Loader2 size={12} className="animate-spin" />Saving…</>}
              {saveStatus === 'saved'  && <><Check size={12} style={{ color: S.green }} /><span style={{ color: S.green }}>Saved</span></>}
              {saveStatus === 'error'  && <><AlertCircle size={12} style={{ color: S.danger }} /><span style={{ color: S.danger }}>{saveError}</span></>}
            </div>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ color: S.muted, background: S.input, border: `1px solid ${S.border}` }}>
              <Printer size={12} /> Print
            </button>
            <button onClick={() => { setSendStatus('idle'); setSendError(''); setShowSendModal(true) }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: coc.sent_at ? 'rgba(22,163,74,0.1)' : 'rgba(58,124,165,0.1)', color: coc.sent_at ? S.green : S.accent, border: `1px solid ${coc.sent_at ? 'rgba(22,163,74,0.3)' : 'rgba(58,124,165,0.3)'}` }}>
              {coc.sent_at ? <><CheckCircle2 size={12} /> Sent</> : <><Send size={12} /> Send</>}
            </button>
            <button onClick={handleDownload} disabled={downloading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ background: S.accent, color: '#fff' }}>
              {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: S.muted }}
              onMouseEnter={e => e.currentTarget.style.background = S.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Form sections */}
        <div className="p-5 space-y-4">

          {/* A — Installation Details */}
          <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <SectionHead letter="A" title="Installation Details" />
            <div className="grid grid-cols-2 gap-4">
              <Inp label="COC Number" val={coc.coc_number} cb={v => set({ coc_number: v })} />
              <Inp label="Issue Date" val={coc.issue_date} cb={v => set({ issue_date: v })} type="date" />
              <Inp label="Linked Doc Number" val={coc.linked_doc_number} cb={v => set({ linked_doc_number: v || null })} placeholder="e.g. INV-2024-001" />
              <Sel label="Work Type" val={coc.work_type} cb={v => set({ work_type: v })}
                options={[{ v: 'new', label: 'New Installation' }, { v: 'addition', label: 'Addition to Existing' }, { v: 'alteration', label: 'Alteration / Rewire' }]} />
              <Sel label="Installation Type" val={coc.installation_type} cb={v => set({ installation_type: v })}
                options={[{ v: 'residential', label: 'Residential' }, { v: 'commercial', label: 'Commercial' }, { v: 'industrial', label: 'Industrial' }, { v: 'agricultural', label: 'Agricultural' }]} />
              <Inp label="Owner / Occupier Name" val={coc.owner_name} cb={v => set({ owner_name: v || null })} />
              <div className="col-span-2">
                <Inp label="Installation Address" val={coc.installation_address} cb={v => set({ installation_address: v || null })} />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Description of Installation</label>
                <textarea value={coc.installation_description} onChange={e => { hasEditedRef.current = true; setCOC(p => ({ ...p, installation_description: e.target.value })) }}
                  rows={3} className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
                  onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
                  onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }} />
              </div>
            </div>
          </div>

          {/* B — Supply Details */}
          <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <SectionHead letter="B" title="Supply Details" />
            <div className="grid grid-cols-3 gap-4">
              <Inp label="Supply Authority" val={coc.supply_authority} cb={v => set({ supply_authority: v || null })} placeholder="e.g. Eskom" />
              <Sel label="Nominal Voltage" val={coc.supply_voltage} cb={v => set({ supply_voltage: v })}
                options={[{ v: '230/400V', label: '230/400V (Standard)' }, { v: '230V', label: '230V (Single Phase)' }, { v: '400V', label: '400V (Three Phase)' }, { v: 'Other', label: 'Other' }]} />
              <Sel label="Supply Phases" val={coc.supply_phases} cb={v => set({ supply_phases: v })}
                options={[{ v: 'single', label: 'Single Phase' }, { v: 'three', label: 'Three Phase' }]} />
              <Sel label="Earthing System" val={coc.supply_earthing} cb={v => set({ supply_earthing: v })}
                options={[{ v: 'TN-C-S', label: 'TN-C-S (MEN)' }, { v: 'TN-S', label: 'TN-S' }, { v: 'TN-C', label: 'TN-C' }, { v: 'TT', label: 'TT' }, { v: 'IT', label: 'IT' }]} />
              <Inp label="Main Breaker (A)" val={coc.main_breaker_amps} cb={v => set({ main_breaker_amps: v || null })} placeholder="e.g. 60A" />
            </div>
          </div>

          {/* C — Test Results */}
          <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <SectionHead letter="C" title="Test Results" />
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'earth_continuity',       label: 'Earth Continuity',               desc: 'All metalwork bonded' },
                { key: 'insulation_resistance',  label: 'Insulation Resistance (500V DC)', desc: 'Min. 1 MΩ' },
                { key: 'polarity',               label: 'Polarity Correct',               desc: 'Live & neutral correct' },
                { key: 'earth_leakage',          label: 'Earth Leakage Protection',        desc: '30mA / 100mA RCD' },
                { key: 'overcurrent_protection', label: 'Overcurrent Protection',          desc: 'Breakers correctly sized' },
                { key: 'phase_rotation',         label: 'Phase Rotation (3-phase)',        desc: 'Correct rotation' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="rounded-xl p-3" style={{ border: `1px solid ${S.border}`, background: S.bg }}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: S.text }}>{label}</p>
                  <p className="text-[10px] mb-2" style={{ color: S.muted }}>{desc}</p>
                  <ResultToggle
                    val={(coc as unknown as Record<string, unknown>)[key] as string | null}
                    onChange={v => set({ [key]: v } as Partial<ElecCOC>)} />
                </div>
              ))}
            </div>
          </div>

          {/* D — Tester */}
          <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <SectionHead letter="D" title="Tester / Inspector Details" />
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Tester Name" val={coc.tester_name} cb={v => set({ tester_name: v })} placeholder="Full name" />
              <Inp label="Registration Number" val={coc.tester_registration_number} cb={v => set({ tester_registration_number: v || null })} placeholder="e.g. WReg/ECA-123456" />
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</label>
                <textarea value={coc.notes ?? ''} onChange={e => { hasEditedRef.current = true; setCOC(p => ({ ...p, notes: e.target.value || null })) }}
                  rows={2} className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
                  onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
                  onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Send modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSendModal(false) }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <h2 className="font-bold text-sm" style={{ color: S.text }}>Send COC to Client</h2>
              <button onClick={() => setShowSendModal(false)} style={{ color: S.muted }}><X size={15} /></button>
            </div>
            {sendStatus === 'sent' ? (
              <div className="px-5 py-10 flex flex-col items-center gap-3">
                <CheckCircle2 size={28} style={{ color: S.green }} />
                <p className="font-semibold text-sm" style={{ color: S.text }}>COC sent!</p>
                <button onClick={() => setShowSendModal(false)} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>Done</button>
              </div>
            ) : (
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Send To *</label>
                  <input type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="client@email.com"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Message <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <textarea value={sendMsg} onChange={e => setSendMsg(e.target.value)} rows={2}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                {sendError && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: S.danger }}>{sendError}</p>}
                <button onClick={() => void handleSend()} disabled={!sendEmail.trim() || sendStatus === 'sending'}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: S.accent }}>
                  {sendStatus === 'sending' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sendStatus === 'sending' ? 'Sending…' : 'Send COC'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── List ──────────────────────────────────────────────────────────────────────
export function COCListClient({ initialCOCs }: Props) {
  const [cocs, setCocs] = useState(initialCOCs)
  const [search, setSearch] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<COCWithQuote | null>(null)

  const projectCOCs    = cocs.filter(c => c.quote !== null)
  const jobCardCOCs    = cocs.filter(c => c.job_card !== null && c.quote === null)
  const standaloneCOCs = cocs.filter(c => c.quote === null && c.job_card === null)

  const filtered = (list: COCWithQuote[]) =>
    list.filter(c =>
      !search ||
      c.coc_number.toLowerCase().includes(search.toLowerCase()) ||
      (c.quote?.project_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.job_card?.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.installation_address ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.owner_name ?? '').toLowerCase().includes(search.toLowerCase())
    )

  function handleSaved(updated: COCWithQuote) {
    setCocs(prev => prev.map(c => c.id === updated.id ? { ...updated, quote: c.quote, job_card: c.job_card } : c))
  }

  async function handleDownload(coc: COCWithQuote, e: React.MouseEvent) {
    e.stopPropagation()
    setDownloadingId(coc.id)
    const win = window.open(`/api/supplier-portal/quoting/coc/${coc.id}/pdf`, '_blank')
    if (!win) window.location.href = `/api/supplier-portal/quoting/coc/${coc.id}/pdf`
    setDownloadingId(null)
  }

  function COCRow({ coc }: { coc: COCWithQuote }) {
    const testsPassed = [coc.earth_continuity, coc.insulation_resistance, coc.polarity, coc.earth_leakage, coc.overcurrent_protection, coc.phase_rotation].filter(r => r === 'pass').length
    const hasFail     = [coc.earth_continuity, coc.insulation_resistance, coc.polarity, coc.earth_leakage, coc.overcurrent_protection, coc.phase_rotation].some(r => r === 'fail')

    return (
      <button
        onClick={() => setEditing(coc)}
        className="w-full flex items-center gap-4 px-4 py-3 text-left transition-colors"
        style={{ borderTop: `1px solid ${S.border}` }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: hasFail ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)' }}>
          <FileCheck size={16} style={{ color: hasFail ? S.danger : S.green }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold font-mono" style={{ color: S.text }}>{coc.coc_number}</span>
            {coc.sent_at && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>
                <CheckCircle2 size={9} className="inline mr-0.5" />Sent
              </span>
            )}
            {coc.linked_doc_number && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: S.bg, color: S.muted, border: `1px solid ${S.border}` }}>
                Doc: {coc.linked_doc_number}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs mt-0.5 flex-wrap" style={{ color: S.muted }}>
            {coc.installation_address && <span>{coc.installation_address}</span>}
            {coc.owner_name && <span>· {coc.owner_name}</span>}
            <span>· {fmtDate(coc.issue_date)}</span>
          </div>
          {coc.quote && (
            <div className="flex items-center gap-1 text-[10px] font-medium mt-0.5" style={{ color: S.accent }}>
              <ExternalLink size={9} />
              {coc.quote.quote_number} — {coc.quote.project_name}
            </div>
          )}
          {coc.job_card && (
            <div className="flex items-center gap-1 text-[10px] font-medium mt-0.5" style={{ color: S.accent }}>
              <ExternalLink size={9} />
              {coc.job_card.job_number} — {coc.job_card.title}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: hasFail ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)', color: hasFail ? S.danger : S.green }}>
            {testsPassed}/6
          </span>
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ color: S.muted, border: `1px solid ${S.border}` }}>
            <Pencil size={11} /> Edit
          </div>
          <button
            onClick={e => void handleDownload(coc, e)}
            disabled={downloadingId === coc.id}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            style={{ background: S.accent, color: '#fff' }}>
            {downloadingId === coc.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            PDF
          </button>
        </div>
      </button>
    )
  }

  function EmptyState({ label }: { label: string }) {
    return (
      <div className="py-12 flex flex-col items-center gap-2">
        <FileCheck size={28} style={{ color: S.border }} />
        <p className="text-sm" style={{ color: S.muted }}>{label}</p>
      </div>
    )
  }

  function Section({ title, list, emptyLabel }: { title: string; list: COCWithQuote[]; emptyLabel: string }) {
    const rows = filtered(list)
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
          {title} · {rows.length}
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {rows.length === 0 ? <EmptyState label={emptyLabel} /> : rows.map(coc => <COCRow key={coc.id} coc={coc} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck size={20} style={{ color: S.accent }} />
          <div>
            <h1 className="font-bold text-sm uppercase tracking-widest" style={{ color: S.muted }}>COC</h1>
            <p className="text-xs mt-0.5" style={{ color: S.muted }}>Certificates of Compliance · {cocs.length} total</p>
          </div>
        </div>
        <Link href="/supplier-portal/quoting/quotes"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
          style={{ background: S.accent, color: '#fff' }}>
          <Plus size={14} /> Add COC via Project
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by COC number, address, owner or project…"
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }} />
      </div>

      <Section title="Linked to Projects" list={projectCOCs} emptyLabel="No project COCs yet — open a project and go to the COC tab" />
      <Section title="Linked to Job Cards" list={jobCardCOCs} emptyLabel="No job card COCs yet — open a job card and go to the COC tab" />
      <Section title="Standalone" list={standaloneCOCs} emptyLabel="No standalone COCs yet" />

      {/* Edit modal */}
      {editing && (
        <COCEditModal
          coc={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => { handleSaved(updated); setEditing(prev => prev ? { ...updated, quote: prev.quote, job_card: prev.job_card } : null) }}
        />
      )}
    </div>
  )
}
