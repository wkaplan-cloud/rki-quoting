'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { FileCheck, Download, Loader2, Search, CheckCircle2, Plus, X, Check, AlertCircle, Send, Printer, FileX } from 'lucide-react'
import type { ElecCOC } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

type CompletedProject = {
  id: string; quote_number: string; project_name: string; project_address: string | null
  client: { id: string; client_name: string; email: string | null } | null
}
type CompletedJobCard = {
  id: string; job_number: string; title: string; location: string | null
  client_name: string | null; client_email: string | null
}
type TestResult = 'pass' | 'fail' | 'n/a'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  completedProjects: CompletedProject[]
  completedJobCards: CompletedJobCard[]
  cocByQuoteId: Record<string, ElecCOC>
  cocByJobCardId: Record<string, ElecCOC>
  cocPrefix: string
  companyCode: string
}

// ── Edit / Create Modal ───────────────────────────────────────────────────────
function COCModal({ coc: initial, title, onClose, onSaved }: {
  coc: ElecCOC
  title: string
  onClose: () => void
  onSaved: (updated: ElecCOC) => void
}) {
  const [coc, setCOC] = useState<ElecCOC>(initial)
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
  }, [onSaved])

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    return (
      <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
        {([['pass', 'Pass', S.green, 'rgba(22,163,74,0.1)'], ['fail', 'Fail', S.danger, 'rgba(220,38,38,0.1)'], ['n/a', 'N/A', S.muted, S.bg]] as const).map(([v, label, color, bg]) => (
          <button key={v} type="button" onClick={() => onChange(v as TestResult)}
            className="flex-1 py-1 text-xs font-semibold"
            style={{ background: current === v ? bg : '#fff', color: current === v ? color : S.muted }}>
            {label}
          </button>
        ))}
      </div>
    )
  }

  function SectionHead({ letter, title: t }: { letter: string; title: string }) {
    return (
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: S.accent }}>{letter}</div>
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: S.text }}>{t}</h3>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden my-4"
        style={{ background: S.bg, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>

        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs" style={{ color: S.muted }}>{title}</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: S.text }}>{coc.coc_number || 'COC'}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs flex items-center gap-1" style={{ color: S.muted }}>
              {saveStatus === 'saving' && <><Loader2 size={12} className="animate-spin" />Saving…</>}
              {saveStatus === 'saved'  && <><Check size={12} style={{ color: S.green }} /><span style={{ color: S.green }}>Saved</span></>}
              {saveStatus === 'error'  && <><AlertCircle size={12} style={{ color: S.danger }} /><span style={{ color: S.danger }}>{saveError}</span></>}
            </span>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
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
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: S.muted }}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
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
              <div className="col-span-2"><Inp label="Installation Address" val={coc.installation_address} cb={v => set({ installation_address: v || null })} /></div>
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

          <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <SectionHead letter="B" title="Supply Details" />
            <div className="grid grid-cols-3 gap-4">
              <Inp label="Supply Authority" val={coc.supply_authority} cb={v => set({ supply_authority: v || null })} placeholder="e.g. Eskom" />
              <Sel label="Nominal Voltage" val={coc.supply_voltage} cb={v => set({ supply_voltage: v })}
                options={[{ v: '230/400V', label: '230/400V' }, { v: '230V', label: '230V Single' }, { v: '400V', label: '400V Three' }, { v: 'Other', label: 'Other' }]} />
              <Sel label="Supply Phases" val={coc.supply_phases} cb={v => set({ supply_phases: v })}
                options={[{ v: 'single', label: 'Single Phase' }, { v: 'three', label: 'Three Phase' }]} />
              <Sel label="Earthing System" val={coc.supply_earthing} cb={v => set({ supply_earthing: v })}
                options={[{ v: 'TN-C-S', label: 'TN-C-S (MEN)' }, { v: 'TN-S', label: 'TN-S' }, { v: 'TN-C', label: 'TN-C' }, { v: 'TT', label: 'TT' }, { v: 'IT', label: 'IT' }]} />
              <Inp label="Main Breaker (A)" val={coc.main_breaker_amps} cb={v => set({ main_breaker_amps: v || null })} placeholder="e.g. 60A" />
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <SectionHead letter="C" title="Test Results" />
            <div className="grid grid-cols-2 gap-4">
              {([
                ['earth_continuity', 'Earth Continuity', 'All metalwork bonded'],
                ['insulation_resistance', 'Insulation Resistance (500V DC)', 'Min. 1 MΩ'],
                ['polarity', 'Polarity Correct', 'Live & neutral correct'],
                ['earth_leakage', 'Earth Leakage Protection', '30mA / 100mA RCD'],
                ['overcurrent_protection', 'Overcurrent Protection', 'Breakers correctly sized'],
                ['phase_rotation', 'Phase Rotation (3-phase)', 'Correct rotation'],
              ] as const).map(([key, label, desc]) => (
                <div key={key} className="rounded-xl p-3" style={{ border: `1px solid ${S.border}`, background: S.bg }}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: S.text }}>{label}</p>
                  <p className="text-[10px] mb-2" style={{ color: S.muted }}>{desc}</p>
                  <ResultToggle val={(coc as unknown as Record<string, unknown>)[key] as string | null} onChange={v => set({ [key]: v } as Partial<ElecCOC>)} />
                </div>
              ))}
            </div>
          </div>

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

// ── Main list ─────────────────────────────────────────────────────────────────
export function COCListClient({ completedProjects, completedJobCards, cocByQuoteId: initialCocByQuoteId, cocByJobCardId: initialCocByJobCardId, cocPrefix, companyCode }: Props) {
  const [cocByQuoteId, setCocByQuoteId]       = useState(initialCocByQuoteId)
  const [cocByJobCardId, setCocByJobCardId]   = useState(initialCocByJobCardId)
  const [search, setSearch]                   = useState('')
  const [editing, setEditing]                 = useState<{ coc: ElecCOC; title: string; onSaved: (c: ElecCOC) => void } | null>(null)
  const [downloadingId, setDownloadingId]     = useState<string | null>(null)

  const year = new Date().getFullYear()
  function newCOC(quoteId: string | null, jobCardId: string | null, address: string | null, ownerName: string | null, clientEmail: string | null): ElecCOC {
    return {
      id: crypto.randomUUID(),
      quote_id: quoteId,
      job_card_id: jobCardId,
      portal_account_id: null,
      coc_number: companyCode ? `${companyCode}-${cocPrefix}-${year}-001` : `${cocPrefix}-${year}-001`,
      installation_description: '',
      issue_date: new Date().toISOString().split('T')[0],
      tester_name: '',
      tester_registration_number: null,
      linked_doc_number: null,
      notes: null,
      installation_address: address,
      owner_name: ownerName,
      supply_authority: null,
      supply_voltage: '230/400V',
      supply_phases: 'three',
      supply_earthing: 'TN-C-S',
      main_breaker_amps: null,
      work_type: 'new',
      installation_type: 'residential',
      earth_continuity: 'pass',
      insulation_resistance: 'pass',
      polarity: 'pass',
      earth_leakage: 'pass',
      overcurrent_protection: 'pass',
      phase_rotation: 'pass',
      sent_to_name: null,
      sent_to_email: clientEmail,
      sent_at: null,
      share_token: null,
      created_at: new Date().toISOString(),
    }
  }

  function openProject(p: CompletedProject) {
    const existing = cocByQuoteId[p.id]
    const client = !Array.isArray(p.client) ? p.client : null
    const coc = existing ?? newCOC(p.id, null, p.project_address, client?.client_name ?? null, client?.email ?? null)
    setEditing({
      coc,
      title: `${p.quote_number} — ${p.project_name}`,
      onSaved: updated => setCocByQuoteId(prev => ({ ...prev, [p.id]: updated })),
    })
  }

  function openJobCard(jc: CompletedJobCard) {
    const existing = cocByJobCardId[jc.id]
    const coc = existing ?? newCOC(null, jc.id, jc.location, jc.client_name, jc.client_email)
    setEditing({
      coc,
      title: `${jc.job_number} — ${jc.title}`,
      onSaved: updated => setCocByJobCardId(prev => ({ ...prev, [jc.id]: updated })),
    })
  }

  async function handleDownload(cocId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDownloadingId(cocId)
    window.open(`/api/supplier-portal/quoting/coc/${cocId}/pdf`, '_blank')
    setDownloadingId(null)
  }

  const matchProject = (p: CompletedProject) =>
    !search ||
    p.project_name.toLowerCase().includes(search.toLowerCase()) ||
    p.quote_number.toLowerCase().includes(search.toLowerCase()) ||
    (p.client && !Array.isArray(p.client) ? p.client.client_name.toLowerCase().includes(search.toLowerCase()) : false)

  const matchJobCard = (jc: CompletedJobCard) =>
    !search ||
    jc.title.toLowerCase().includes(search.toLowerCase()) ||
    jc.job_number.toLowerCase().includes(search.toLowerCase()) ||
    (jc.client_name ?? '').toLowerCase().includes(search.toLowerCase())

  const filteredProjects  = completedProjects.filter(matchProject)
  const filteredJobCards  = completedJobCards.filter(matchJobCard)

  function ProjectRow({ p }: { p: CompletedProject }) {
    const coc = cocByQuoteId[p.id]
    const client = !Array.isArray(p.client) ? p.client : null
    const hasCOC = !!coc
    const testsPassed = hasCOC ? [coc.earth_continuity, coc.insulation_resistance, coc.polarity, coc.earth_leakage, coc.overcurrent_protection, coc.phase_rotation].filter(r => r === 'pass').length : 0
    const hasFail = hasCOC && [coc.earth_continuity, coc.insulation_resistance, coc.polarity, coc.earth_leakage, coc.overcurrent_protection, coc.phase_rotation].some(r => r === 'fail')

    return (
      <button onClick={() => openProject(p)}
        className="w-full flex items-center gap-4 px-4 py-3 text-left"
        style={{ borderTop: `1px solid ${S.border}` }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: hasCOC ? (hasFail ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)') : S.bg }}>
          {hasCOC
            ? <FileCheck size={16} style={{ color: hasFail ? S.danger : S.green }} />
            : <FileX size={16} style={{ color: S.muted }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate" style={{ color: S.text }}>{p.project_name}</span>
            <span className="text-[10px] font-mono" style={{ color: S.muted }}>{p.quote_number}</span>
            {hasCOC && coc.sent_at && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>
                <CheckCircle2 size={8} className="inline mr-0.5" />Sent
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: S.muted }}>
            {client && <span>{client.client_name}</span>}
            {p.project_address && <span>{p.project_address}</span>}
            {hasCOC && <span style={{ color: S.accent }}>{coc.coc_number}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasCOC ? (
            <>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: hasFail ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)', color: hasFail ? S.danger : S.green }}>
                {testsPassed}/6
              </span>
              <button onClick={e => void handleDownload(coc.id, e)} disabled={downloadingId === coc.id}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ background: S.accent, color: '#fff' }}>
                {downloadingId === coc.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                PDF
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ border: `1px solid ${S.border}`, color: S.accent }}>
              <Plus size={11} /> Add COC
            </span>
          )}
        </div>
      </button>
    )
  }

  function JobCardRow({ jc }: { jc: CompletedJobCard }) {
    const coc = cocByJobCardId[jc.id]
    const hasCOC = !!coc
    const testsPassed = hasCOC ? [coc.earth_continuity, coc.insulation_resistance, coc.polarity, coc.earth_leakage, coc.overcurrent_protection, coc.phase_rotation].filter(r => r === 'pass').length : 0
    const hasFail = hasCOC && [coc.earth_continuity, coc.insulation_resistance, coc.polarity, coc.earth_leakage, coc.overcurrent_protection, coc.phase_rotation].some(r => r === 'fail')

    return (
      <button onClick={() => openJobCard(jc)}
        className="w-full flex items-center gap-4 px-4 py-3 text-left"
        style={{ borderTop: `1px solid ${S.border}` }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: hasCOC ? (hasFail ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)') : S.bg }}>
          {hasCOC
            ? <FileCheck size={16} style={{ color: hasFail ? S.danger : S.green }} />
            : <FileX size={16} style={{ color: S.muted }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate" style={{ color: S.text }}>{jc.title}</span>
            <span className="text-[10px] font-mono" style={{ color: S.muted }}>{jc.job_number}</span>
            {hasCOC && coc.sent_at && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>
                <CheckCircle2 size={8} className="inline mr-0.5" />Sent
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: S.muted }}>
            {jc.client_name && <span>{jc.client_name}</span>}
            {jc.location && <span>{jc.location}</span>}
            {hasCOC && <span style={{ color: S.accent }}>{coc.coc_number}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasCOC ? (
            <>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: hasFail ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)', color: hasFail ? S.danger : S.green }}>
                {testsPassed}/6
              </span>
              <button onClick={e => void handleDownload(coc.id, e)} disabled={downloadingId === coc.id}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ background: S.accent, color: '#fff' }}>
                {downloadingId === coc.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                PDF
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ border: `1px solid ${S.border}`, color: S.accent }}>
              <Plus size={11} /> Add COC
            </span>
          )}
        </div>
      </button>
    )
  }

  const totalWithCOC = Object.keys(cocByQuoteId).length + Object.keys(cocByJobCardId).length

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck size={20} style={{ color: S.accent }} />
          <div>
            <h1 className="font-bold text-sm uppercase tracking-widest" style={{ color: S.muted }}>COC</h1>
            <p className="text-xs mt-0.5" style={{ color: S.muted }}>
              {completedProjects.length + completedJobCards.length} completed · {totalWithCOC} have COC · {(completedProjects.length + completedJobCards.length) - totalWithCOC} outstanding
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by project name, job number or client…"
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }} />
      </div>

      {/* Completed Projects */}
      {filteredProjects.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
            Completed Projects · {filteredProjects.length}
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            {filteredProjects.map(p => <ProjectRow key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {/* Completed Job Cards */}
      {filteredJobCards.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
            Completed Job Cards · {filteredJobCards.length}
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            {filteredJobCards.map(jc => <JobCardRow key={jc.id} jc={jc} />)}
          </div>
        </div>
      )}

      {filteredProjects.length === 0 && filteredJobCards.length === 0 && (
        <div className="rounded-2xl py-16 flex flex-col items-center gap-2" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <FileCheck size={32} style={{ color: S.border }} />
          <p className="text-sm" style={{ color: S.muted }}>No completed projects or job cards yet</p>
        </div>
      )}

      {/* Edit/Create Modal */}
      {editing && (
        <COCModal
          coc={editing.coc}
          title={editing.title}
          onClose={() => setEditing(null)}
          onSaved={updated => { editing.onSaved(updated); setEditing(prev => prev ? { ...prev, coc: updated } : null) }}
        />
      )}
    </div>
  )
}
