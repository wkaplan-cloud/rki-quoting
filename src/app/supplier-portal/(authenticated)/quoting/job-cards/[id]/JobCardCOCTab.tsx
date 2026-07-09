'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { todaySA } from '@/lib/dates'
import { Check, Loader2, AlertCircle, Download, Printer, Send, X, CheckCircle2 } from 'lucide-react'
import type { ElecCOC } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

type TestResult = 'pass' | 'fail' | 'n/a'

interface Props {
  jobCardId: string
  initialCOC: ElecCOC | null
  cocPrefix: string
  companyCode: string
  location?: string | null
  clientName?: string | null
  clientEmail?: string | null
}

export function JobCardCOCTab({ jobCardId, initialCOC, cocPrefix, companyCode, location, clientName, clientEmail }: Props) {
  const year = new Date().getFullYear()
  const defaultCocNumber = companyCode ? `${companyCode}-${cocPrefix}-${year}-001` : `${cocPrefix}-${year}-001`

  const [coc, setCOC] = useState<ElecCOC>(() => initialCOC ?? {
    id: crypto.randomUUID(),
    quote_id: null, job_card_id: jobCardId, portal_account_id: null,
    coc_number: '', certificate_type: 'initial',
    supplement_no: null, to_initial_cert_no: null, initial_cert_date: null,
    issue_date: todaySA(),
    regulation_type: 'a',
    installation_address: location ?? null, name_of_building: null,
    suburb_township: null, district_town_city: null, gps_coordinates: null,
    pole_number: null, erf_lot_no: null, db_supply: null, additional_pages: false,
    owner_name: clientName ?? null,
    tester_name: '', tester_registration_number: null,
    reg_person_id_no: null, reg_person_reg_date: null, reg_person_type: 'master',
    reg_person_address: null, reg_person_tel: null, reg_person_fax: null,
    reg_person_cell: null, reg_person_email: null,
    contractor_name: null, contractor_id_no: null, contractor_reg_no: null,
    contractor_reg_date: null, contractor_address: null, contractor_tel: null,
    contractor_fax: null, contractor_cell: null, contractor_email: null,
    recipient_name: null, recipient_date: null,
    test_report: null,
    installation_description: '', installation_type: null, work_type: null,
    supply_voltage: null, supply_phases: null, supply_earthing: null,
    main_breaker_amps: null, supply_authority: null,
    earth_continuity: null, insulation_resistance: null, polarity: null,
    earth_leakage: null, overcurrent_protection: null, phase_rotation: null,
    linked_doc_number: null, notes: null,
    sent_to_name: null, sent_to_email: clientEmail ?? null,
    sent_at: null, share_token: null, created_at: new Date().toISOString(),
  })

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendEmail, setSendEmail] = useState(clientEmail ?? '')
  const [sendMessage, setSendMessage] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendError, setSendError] = useState('')

  const hasEditedRef = useRef(!!initialCOC)

  function set(patch: Partial<ElecCOC>) {
    hasEditedRef.current = true
    setCOC(prev => ({ ...prev, ...patch }))
  }

  const saveDataRef = useRef(coc)
  useEffect(() => { saveDataRef.current = coc }, [coc])

  const handleSave = useCallback(async (force = false): Promise<boolean> => {
    if (!hasEditedRef.current && !force) return true
    const current = saveDataRef.current
    setSaveStatus('saving'); setSaveError('')
    try {
      const res = await fetch('/api/supplier-portal/quoting/coc/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...current, job_card_id: jobCardId, quote_id: null }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
      return true
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
      setSaveStatus('error')
      return false
    }
  }, [jobCardId]) // eslint-disable-line

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isMountRef = useRef(true)
  useEffect(() => {
    if (isMountRef.current) { isMountRef.current = false; return }
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => void handleSave(), 1500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [coc]) // eslint-disable-line

  async function handleDownload() {
    setDownloading(true)
    clearTimeout(autoSaveTimer.current)
    const win = window.open('', '_blank')
    hasEditedRef.current = true
    const ok = await handleSave(true)
    if (ok && win) win.location.href = `/api/supplier-portal/quoting/coc/${coc.id}/pdf`
    else if (win) win.close()
    setDownloading(false)
  }

  async function handlePrint() {
    clearTimeout(autoSaveTimer.current)
    const win = window.open('', '_blank')
    hasEditedRef.current = true
    const ok = await handleSave(true)
    if (ok && win) win.location.href = `/api/supplier-portal/quoting/coc/${coc.id}/pdf?inline=1`
    else if (win) win.close()
  }

  async function handleSend() {
    if (!sendEmail.trim() || sendStatus === 'sending') return
    setSendStatus('sending'); setSendError('')
    clearTimeout(autoSaveTimer.current)
    hasEditedRef.current = true
    await handleSave(true)
    try {
      const res = await fetch(`/api/supplier-portal/quoting/coc/${coc.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail.trim(), message: sendMessage.trim() || undefined }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setSendStatus('error'); setSendError(data.error ?? 'Failed to send'); return }
      setCOC(prev => ({ ...prev, sent_to_email: sendEmail.trim(), sent_at: new Date().toISOString() }))
      setSendStatus('sent')
    } catch { setSendStatus('error'); setSendError('Network error') }
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
            className="flex-1 py-1 text-xs font-semibold transition-colors"
            style={{ background: current === o.v ? o.bg : '#fff', color: current === o.v ? o.color : S.muted }}>
            {o.label}
          </button>
        ))}
      </div>
    )
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

  function SectionHead({ letter, title }: { letter: string; title: string }) {
    return (
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: S.accent }}>{letter}</div>
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: S.text }}>{title}</h3>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: S.text }}>Certificate of Compliance</p>
          <p className="text-xs" style={{ color: S.muted }}>SANS 10142-1 · OHS Act 85 of 1993 · EIR 2009</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: S.muted }}>
            {saveStatus === 'saving' && <><Loader2 size={12} className="animate-spin" />Saving…</>}
            {saveStatus === 'saved'  && <><Check size={12} style={{ color: S.green }} /><span style={{ color: S.green }}>Saved</span></>}
            {saveStatus === 'error'  && <><AlertCircle size={12} style={{ color: S.danger }} /><span style={{ color: S.danger }}>{saveError}</span></>}
          </div>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ color: S.muted, background: S.input, border: `1px solid ${S.border}` }}
            onMouseEnter={e => (e.currentTarget.style.background = S.border)}
            onMouseLeave={e => (e.currentTarget.style.background = S.input)}>
            <Printer size={12} /> Print
          </button>
          <button onClick={() => { setSendStatus('idle'); setSendError(''); setShowSendModal(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: coc.sent_at ? 'rgba(22,163,74,0.1)' : 'rgba(58,124,165,0.1)', color: coc.sent_at ? S.green : S.accent, border: `1px solid ${coc.sent_at ? 'rgba(22,163,74,0.3)' : 'rgba(58,124,165,0.3)'}` }}>
            {coc.sent_at ? <><CheckCircle2 size={12} /> Sent</> : <><Send size={12} /> Send to Client</>}
          </button>
          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: S.accent, color: '#fff' }}>
            {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {downloading ? 'Generating…' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Section A */}
      <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <SectionHead letter="A" title="Installation Details" />
        <div className="grid grid-cols-2 gap-4">
          <Inp label="COC Number" val={coc.coc_number} cb={v => set({ coc_number: v })} placeholder={defaultCocNumber} />
          <Inp label="Issue Date" val={coc.issue_date} cb={v => set({ issue_date: v })} type="date" />
          <Inp label="Linked Doc Number" val={coc.linked_doc_number} cb={v => set({ linked_doc_number: v || null })} placeholder="e.g. INV-2024-001" />
          <Sel label="Work Type" val={coc.work_type} cb={v => set({ work_type: v })}
            options={[{ v: 'new', label: 'New Installation' }, { v: 'addition', label: 'Addition to Existing' }, { v: 'alteration', label: 'Alteration / Rewire' }]} />
          <Sel label="Installation Type" val={coc.installation_type} cb={v => set({ installation_type: v })}
            options={[{ v: 'residential', label: 'Residential' }, { v: 'commercial', label: 'Commercial' }, { v: 'industrial', label: 'Industrial' }, { v: 'agricultural', label: 'Agricultural' }]} />
          <Inp label="Owner / Occupier Name" val={coc.owner_name} cb={v => set({ owner_name: v || null })} placeholder={clientName ?? ''} />
          <div className="col-span-2">
            <Inp label="Installation Address" val={coc.installation_address} cb={v => set({ installation_address: v || null })} placeholder={location ?? 'Street, City, Province, Postal Code'} />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Description of Installation</label>
            <textarea value={coc.installation_description} onChange={e => { hasEditedRef.current = true; setCOC(p => ({ ...p, installation_description: e.target.value })) }}
              rows={3} placeholder="e.g. Complete wiring of residential dwelling"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
              onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
              onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }} />
          </div>
        </div>
      </div>

      {/* Section B */}
      <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <SectionHead letter="B" title="Supply Details" />
        <div className="grid grid-cols-3 gap-4">
          <Inp label="Supply Authority" val={coc.supply_authority} cb={v => set({ supply_authority: v || null })} placeholder="e.g. Eskom, City Power" />
          <Sel label="Nominal Voltage" val={coc.supply_voltage} cb={v => set({ supply_voltage: v })}
            options={[{ v: '230/400V', label: '230/400V (Standard)' }, { v: '230V', label: '230V (Single Phase)' }, { v: '400V', label: '400V (Three Phase)' }, { v: 'Other', label: 'Other' }]} />
          <Sel label="Supply Phases" val={coc.supply_phases} cb={v => set({ supply_phases: v })}
            options={[{ v: 'single', label: 'Single Phase' }, { v: 'three', label: 'Three Phase' }]} />
          <Sel label="Earthing System" val={coc.supply_earthing} cb={v => set({ supply_earthing: v })}
            options={[{ v: 'TN-C-S', label: 'TN-C-S (MEN)' }, { v: 'TN-S', label: 'TN-S' }, { v: 'TN-C', label: 'TN-C' }, { v: 'TT', label: 'TT' }, { v: 'IT', label: 'IT' }]} />
          <Inp label="Main Breaker / Fuse Size (A)" val={coc.main_breaker_amps} cb={v => set({ main_breaker_amps: v || null })} placeholder="e.g. 60A" />
        </div>
      </div>

      {/* Section C */}
      <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <SectionHead letter="C" title="Test Results" />
        <p className="text-xs mb-4" style={{ color: S.muted }}>Tested in accordance with SANS 10142-1</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'earth_continuity',       label: 'Earth Continuity',               desc: 'All metalwork bonded and continuous' },
            { key: 'insulation_resistance',  label: 'Insulation Resistance (500V DC)', desc: 'Min. 1 MΩ between conductors & earth' },
            { key: 'polarity',               label: 'Polarity Correct',               desc: 'Live & neutral correctly connected' },
            { key: 'earth_leakage',          label: 'Earth Leakage Protection',        desc: 'RCD trips within spec (30mA / 100mA)' },
            { key: 'overcurrent_protection', label: 'Overcurrent Protection',          desc: 'Circuit breakers / fuses correctly sized' },
            { key: 'phase_rotation',         label: 'Phase Rotation (3-phase)',        desc: 'Correct rotation for 3-phase circuits' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="rounded-xl p-3" style={{ border: `1px solid ${S.border}`, background: S.bg }}>
              <p className="text-xs font-semibold mb-0.5" style={{ color: S.text }}>{label}</p>
              <p className="text-[10px] mb-2" style={{ color: S.muted }}>{desc}</p>
              <ResultToggle val={(coc as unknown as Record<string, unknown>)[key] as string | null} onChange={v => set({ [key]: v } as Partial<ElecCOC>)} />
            </div>
          ))}
        </div>
      </div>

      {/* Section D */}
      <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <SectionHead letter="D" title="Tester / Inspector Details" />
        <div className="grid grid-cols-2 gap-4">
          <Inp label="Tester Name" val={coc.tester_name} cb={v => set({ tester_name: v })} placeholder="Full name of registered tester" />
          <Inp label="Registration Number" val={coc.tester_registration_number} cb={v => set({ tester_registration_number: v || null })} placeholder="e.g. WReg/ECA-123456" />
          <div className="col-span-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</label>
            <textarea value={coc.notes ?? ''} onChange={e => { hasEditedRef.current = true; setCOC(p => ({ ...p, notes: e.target.value || null })) }}
              rows={2} placeholder="Any restrictions, exclusions or additional notes"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
              onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
              onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }} />
          </div>
        </div>
      </div>

      {/* Send modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSendModal(false) }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <div>
                <h2 className="font-bold text-sm" style={{ color: S.text }}>Send COC to Client</h2>
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>{coc.coc_number} · PDF attached</p>
              </div>
              <button onClick={() => setShowSendModal(false)} className="p-1.5 rounded-lg" style={{ color: S.muted }}><X size={15} /></button>
            </div>
            {sendStatus === 'sent' ? (
              <div className="px-5 py-10 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.1)' }}>
                  <CheckCircle2 size={22} style={{ color: S.green }} />
                </div>
                <p className="font-semibold text-sm" style={{ color: S.text }}>COC sent successfully!</p>
                <p className="text-xs text-center" style={{ color: S.muted }}>PDF sent to {sendEmail}</p>
                <button onClick={() => setShowSendModal(false)} className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>Done</button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Send To *</label>
                  <input type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="client@email.com"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Message <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)} rows={2} placeholder="Add a personal note…"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                {sendError && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: '#FEF2F2', color: S.danger }}><AlertCircle size={13} />{sendError}</div>}
                <button onClick={() => void handleSend()} disabled={!sendEmail.trim() || sendStatus === 'sending'}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: S.accent }}>
                  {sendStatus === 'sending' ? <><Loader2 size={14} className="animate-spin" />Sending…</> : <><Send size={14} />Send COC</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
