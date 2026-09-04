'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { todaySA } from '@/lib/dates'
import {
  Download, Loader2, CheckCircle2, X,
  Check, AlertCircle, Send, Printer, Camera, Trash2,
} from 'lucide-react'
import type { ElecCOC, ElecSettings, COCTestReport } from '@/lib/elec-types'
import { compressImage } from '@/lib/compressImage'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

type Tab = 'cert' | 'supply' | 'circuits' | 'tests' | 'decl' | 'report' | 'photos'

// ── Default test report ───────────────────────────────────────────────────────

export const DEFAULT_TR: COCTestReport = {
  installation_permanent: true, supply_system: 'TN-C-S',
  voltage: '230V', voltage_other: '', phases: 'three',
  phase_rotation: 'clockwise', frequency: '50Hz', frequency_other: '',
  main_switch_type: 'circuit_breaker', main_switch_poles: '',
  main_switch_current_rating: '', main_switch_sc_rating: '',
  earth_leakage_current: '30mA', earth_leakage_current_other: '',
  surge_protection: false, lightning_protection: false,
  alt_power_supply: false, specialised_installation: false, above_1kv: false,
  lighting_circuits_new: '', lighting_circuits_existing: '',
  lighting_points_new: '', lighting_points_existing: '',
  socket_outlet_circuits_new: '', socket_outlet_circuits_existing: '',
  socket_outlets_new: '', socket_outlets_existing: '',
  ac_circuits_new: '', ac_circuits_existing: '',
  transformer_lighting_new: '', transformer_lighting_existing: '',
  transformer_bell_new: '', transformer_bell_existing: '',
  transformer_other_new: '', transformer_other_existing: '',
  heating_new: '', heating_existing: '',
  alt_power_new: '', alt_power_existing: '',
  fan_circuits_new: '', fan_circuits_existing: '',
  cooking_new: '', cooking_existing: '',
  geyser_new: '', geyser_existing: '',
  pool_pump_new: '', pool_pump_existing: '',
  borehole_pump_new: '', borehole_pump_existing: '',
  fixed_other_new: '', fixed_other_existing: '',
  earth_leakage_complete: true, earth_leakage_partial: false,
  inspect_conductors: 'yes', inspect_components: 'yes',
  inspect_disconnecting: 'yes', inspect_labelled: 'yes',
  test_continuity_bonding: 'compliant', test_earth_resistance: 'compliant',
  test_ring_circuits: '', test_earth_loop: '', test_neutral_loop: '',
  test_pscc_value: '', test_pscc_method: 'measured',
  test_elevated_voltage: '', test_insulation: '',
  test_voltage_no_load_a: '', test_voltage_no_load_b: '', test_voltage_no_load_c: '',
  test_voltage_load_a: '', test_voltage_load_b: '', test_voltage_load_c: '',
  test_earth_leakage_value: '',
  test_earth_leakage_button: 'correct', test_polarity: 'correct',
  test_phase_rotation: 'correct', test_switching: 'correct',
  comments: '', comments_not_covered: '', section5_date: '', section5_tel: '',
}

// ── New COC factory (shared by main COC section and job card COC tab) ─────────

export function newCOC(
  quoteId: string | null,
  jobCardId: string | null,
  address: string | null,
  ownerName: string | null,
  clientEmail: string | null,
  settings: ElecSettings | null,
): ElecCOC {
  return {
    id: crypto.randomUUID(),
    quote_id: quoteId, job_card_id: jobCardId, portal_account_id: null,
    coc_number: '',   // ECA number — blank, electrician assigns
    certificate_type: 'initial',
    supplement_no: null, to_initial_cert_no: null, initial_cert_date: null,
    issue_date: todaySA(),
    regulation_type: 'a',
    installation_address: address, name_of_building: null,
    suburb_township: null, district_town_city: null,
    gps_coordinates: null, pole_number: null, erf_lot_no: null,
    db_supply: null, additional_pages: false,
    owner_name: ownerName,
    // Pre-fill from settings
    tester_name: settings?.reg_person_name ?? '',
    tester_registration_number: settings?.reg_person_reg_no ?? null,
    reg_person_id_no: settings?.reg_person_id_no ?? null,
    reg_person_reg_date: settings?.reg_person_reg_date ?? null,
    reg_person_type: settings?.reg_person_type ?? 'master',
    reg_person_address: settings?.reg_person_address ?? null,
    reg_person_tel: settings?.reg_person_tel ?? null,
    reg_person_fax: settings?.reg_person_fax ?? null,
    reg_person_cell: settings?.reg_person_cell ?? null,
    reg_person_email: settings?.reg_person_email ?? null,
    contractor_name: settings?.contractor_name ?? null,
    contractor_id_no: settings?.contractor_id_no ?? null,
    contractor_reg_no: settings?.contractor_reg_no ?? null,
    contractor_reg_date: settings?.contractor_reg_date ?? null,
    contractor_address: settings?.contractor_address ?? null,
    contractor_tel: settings?.contractor_tel ?? null,
    contractor_fax: settings?.contractor_fax ?? null,
    contractor_cell: settings?.contractor_cell ?? null,
    contractor_email: settings?.contractor_email ?? null,
    recipient_name: null, recipient_date: null,
    test_report: { ...DEFAULT_TR },
    report_items: [],
    photos: [],
    // Legacy fields
    installation_description: '', installation_type: null, work_type: null,
    supply_voltage: null, supply_phases: null, supply_earthing: null,
    main_breaker_amps: null, supply_authority: null,
    earth_continuity: null, insulation_resistance: null, polarity: null,
    earth_leakage: null, overcurrent_protection: null, phase_rotation: null,
    linked_doc_number: null, notes: null,
    sent_to_name: null, sent_to_email: clientEmail, sent_at: null, share_token: null,
    created_at: new Date().toISOString(),
  }
}

// ── Form primitives ───────────────────────────────────────────────────────────

function Inp({ label, val, cb, placeholder, type = 'text', half }: {
  label: string; val: string | null | undefined; cb: (v: string) => void
  placeholder?: string; type?: string; half?: boolean
}) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{label}</label>
      <input type={type} value={val ?? ''} onChange={e => cb(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg outline-none"
        style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
        onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
        onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }} />
    </div>
  )
}

function TextArea({ label, val, cb }: { label: string; val: string | null | undefined; cb: (v: string) => void }) {
  return (
    <div className="col-span-2">
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{label}</label>
      <textarea value={val ?? ''} onChange={e => cb(e.target.value)}
        rows={2} className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
        style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
        onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
        onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }} />
    </div>
  )
}

// Checkbox options group (inline)
function PickGroup({ label, val, cb, options }: {
  label: string; val: string; cb: (v: string) => void; options: { v: string; label: string }[]
}) {
  return (
    <div className="col-span-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button key={o.v} type="button" onClick={() => cb(o.v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: val === o.v ? `rgba(58,124,165,0.12)` : S.input,
              border: `1.5px solid ${val === o.v ? S.accent : S.border}`,
              color: val === o.v ? S.accent : S.text,
            }}>
            <span className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0"
              style={{ borderColor: val === o.v ? S.accent : S.muted, background: val === o.v ? S.accent : 'transparent' }}>
              {val === o.v && <Check size={9} color="#fff" strokeWidth={3} />}
            </span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Yes / No / N/A toggle for test results
function YNA({ label, val, cb, options = ['yes', 'no', 'na'] }: {
  label: string; val: string; cb: (v: string) => void; options?: string[]
}) {
  const COLOR: Record<string, string> = { yes: S.green, compliant: S.green, correct: S.green, no: S.danger, non_compliant: S.danger, incorrect: S.danger, na: S.muted, measured: S.accent, calculated: S.accent }
  const LABEL: Record<string, string> = { yes: 'Yes', no: 'No', na: 'N/A', compliant: 'Compliant', non_compliant: 'Non-compliant', correct: 'Correct', incorrect: 'Incorrect', measured: 'Measured', calculated: 'Calculated' }
  return (
    <div className="col-span-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{label}</p>
      <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
        {options.map(v => (
          <button key={v} type="button" onClick={() => cb(v)}
            className="flex-1 py-1.5 text-xs font-semibold"
            style={{
              background: val === v ? `${COLOR[v] ?? S.accent}18` : '#fff',
              color: val === v ? (COLOR[v] ?? S.accent) : S.muted,
              borderRight: `1px solid ${S.border}`,
            }}>
            {LABEL[v] ?? v}
          </button>
        ))}
      </div>
    </div>
  )
}

// Bool toggle (Yes/No)
function YesNo({ label, val, cb }: { label: string; val: boolean; cb: (v: boolean) => void }) {
  return (
    <div className="col-span-2 flex items-center justify-between rounded-lg px-3 py-2"
      style={{ background: S.input, border: `1px solid ${S.border}` }}>
      <span className="text-sm" style={{ color: S.text }}>{label}</span>
      <div className="flex gap-1.5">
        {[true, false].map(v => (
          <button key={String(v)} type="button" onClick={() => cb(v)}
            className="px-3 py-1 rounded-md text-xs font-semibold"
            style={{
              background: val === v ? (v ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)') : 'transparent',
              color: val === v ? (v ? S.green : S.danger) : S.muted,
              border: `1px solid ${val === v ? (v ? 'rgba(22,163,74,0.4)' : 'rgba(220,38,38,0.4)') : 'transparent'}`,
            }}>
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  )
}

// Section card wrapper
function SecCard({ letter, title, children }: { letter: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ background: S.accent }}>{letter}</div>
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: S.text }}>{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

// Circuit row for Section 3
function CircRow({ label, keyBase, tr, setTR }: {
  label: string; keyBase: string
  tr: COCTestReport; setTR: (p: Partial<COCTestReport>) => void
}) {
  const nk = `${keyBase}_new` as keyof COCTestReport
  const ek = `${keyBase}_existing` as keyof COCTestReport
  return (
    <div className="flex items-center gap-2 py-1.5 border-b" style={{ borderColor: S.border }}>
      <span className="text-xs flex-1" style={{ color: S.text }}>{label}</span>
      <input value={(tr[nk] as string) ?? ''} onChange={e => setTR({ [nk]: e.target.value })}
        placeholder="New" className="w-14 px-2 py-1 text-xs rounded-md text-center outline-none"
        style={{ background: S.input, border: `1px solid ${S.border}` }} />
      <input value={(tr[ek] as string) ?? ''} onChange={e => setTR({ [ek]: e.target.value })}
        placeholder="Existing" className="w-16 px-2 py-1 text-xs rounded-md text-center outline-none"
        style={{ background: S.input, border: `1px solid ${S.border}` }} />
    </div>
  )
}

// ── COC Modal ─────────────────────────────────────────────────────────────────

export function COCModal({ coc: initial, title, onClose, onSaved }: {
  coc: ElecCOC; title: string; onClose: () => void; onSaved: (c: ElecCOC) => void
}) {
  const [coc, setCOC] = useState<ElecCOC>(initial)
  const [tab, setTab] = useState<Tab>('cert')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [sendEmail, setSendEmail] = useState(initial.sent_to_email ?? '')
  const [sendMsg, setSendMsg] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendError, setSendError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [newFinding, setNewFinding] = useState('')

  const hasEditedRef = useRef(false)
  const saveDataRef = useRef(coc)
  useEffect(() => { saveDataRef.current = coc }, [coc])

  function set(patch: Partial<ElecCOC>) {
    hasEditedRef.current = true
    setCOC(prev => ({ ...prev, ...patch }))
  }
  function setTR(patch: Partial<COCTestReport>) {
    hasEditedRef.current = true
    setCOC(prev => ({
      ...prev,
      test_report: { ...DEFAULT_TR, ...(prev.test_report ?? {}), ...patch },
    }))
  }

  const tr: COCTestReport = { ...DEFAULT_TR, ...(coc.test_report ?? {}) }

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
    setSaveStatus('saving'); setSaveError('')
    try {
      const res = await fetch('/api/supplier-portal/quoting/coc/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveDataRef.current),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
      setSaveStatus('saved'); onSaved(saveDataRef.current)
      setTimeout(() => setSaveStatus('idle'), 2500)
      return true
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
      setSaveStatus('error'); return false
    }
  }, [onSaved])

  async function handleDownload() {
    setDownloading(true); clearTimeout(autoTimer.current); hasEditedRef.current = true
    const win = window.open('', '_blank')
    const ok = await handleSave(true)
    if (ok && win) win.location.href = `/api/supplier-portal/quoting/coc/${coc.id}/pdf`
    else if (win) win.close()
    setDownloading(false)
  }

  async function handlePrint() {
    clearTimeout(autoTimer.current); hasEditedRef.current = true
    const win = window.open('', '_blank')
    const ok = await handleSave(true)
    if (ok && win) win.location.href = `/api/supplier-portal/quoting/coc/${coc.id}/pdf?inline=1`
    else if (win) win.close()
  }

  async function handleSend() {
    if (!sendEmail.trim() || sendStatus === 'sending') return
    setSendStatus('sending'); setSendError('')
    clearTimeout(autoTimer.current); hasEditedRef.current = true
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploadingPhoto(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', await compressImage(file))
      const res = await fetch('/api/supplier-portal/quoting/coc/photos', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json() as { url: string }
        hasEditedRef.current = true
        setCOC(prev => ({ ...prev, photos: [...(prev.photos ?? []), { url, description: '' }] }))
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string }
        alert(d.error ?? 'Photo upload failed')
      }
    }
    setUploadingPhoto(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  function updatePhotoDescription(idx: number, description: string) {
    set({ photos: (coc.photos ?? []).map((p, i) => i === idx ? { ...p, description } : p) })
  }

  function removePhoto(idx: number) {
    set({ photos: (coc.photos ?? []).filter((_, i) => i !== idx) })
  }

  function addFinding() {
    const description = newFinding.trim()
    if (!description) return
    set({ report_items: [...(coc.report_items ?? []), { id: crypto.randomUUID(), description }] })
    setNewFinding('')
  }

  function removeFinding(id: string) {
    set({ report_items: (coc.report_items ?? []).filter(r => r.id !== id) })
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'cert', label: 'Certificate & Location' },
    { id: 'supply', label: 'Supply System' },
    { id: 'circuits', label: 'Circuits' },
    { id: 'tests', label: 'Tests' },
    { id: 'decl', label: 'Declarations' },
    { id: 'report', label: `Report${(coc.report_items?.length ?? 0) > 0 ? ` (${coc.report_items!.length})` : ''}` },
    { id: 'photos', label: `Photos${(coc.photos?.length ?? 0) > 0 ? ` (${coc.photos!.length})` : ''}` },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden my-4"
        style={{ background: S.bg, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>

        {/* ── Header ── */}
        <div className="sticky top-0 z-10" style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: S.muted }}>{title}</p>
              <p className="text-sm font-bold truncate" style={{ color: S.text }}>
                {coc.coc_number ? `ECA ${coc.coc_number}` : 'Certificate of Compliance'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs flex items-center gap-1" style={{ color: S.muted }}>
                {saveStatus === 'saving' && <><Loader2 size={11} className="animate-spin" />Saving…</>}
                {saveStatus === 'saved' && <><Check size={11} style={{ color: S.green }} /><span style={{ color: S.green }}>Saved</span></>}
                {saveStatus === 'error' && <><AlertCircle size={11} style={{ color: S.danger }} /><span style={{ color: S.danger }}>{saveError}</span></>}
              </span>
              <button onClick={handlePrint} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: S.muted, background: S.input, border: `1px solid ${S.border}` }}>
                <Printer size={11} /> Print
              </button>
              <button onClick={() => { setSendStatus('idle'); setSendError(''); setShowSend(true) }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: coc.sent_at ? 'rgba(22,163,74,0.1)' : 'rgba(58,124,165,0.1)', color: coc.sent_at ? S.green : S.accent, border: `1px solid ${coc.sent_at ? 'rgba(22,163,74,0.3)' : 'rgba(58,124,165,0.3)'}` }}>
                {coc.sent_at ? <><CheckCircle2 size={11} />Sent</> : <><Send size={11} />Send</>}
              </button>
              <button onClick={handleDownload} disabled={downloading}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: S.accent, color: '#fff' }}>
                {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} PDF
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: S.muted }}><X size={14} /></button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto px-4 gap-0.5 pb-0" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg"
                style={{
                  color: tab === t.id ? S.accent : S.muted,
                  borderBottom: tab === t.id ? `2px solid ${S.accent}` : '2px solid transparent',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="p-4 space-y-4">

          {/* ── Tab: Certificate & Location ── */}
          {tab === 'cert' && (
            <>
              <SecCard letter="A" title="COC Certificate">
                <Inp label="ECA Certificate No. (blank — electrician assigns)" val={coc.coc_number} cb={v => set({ coc_number: v })} placeholder="e.g. 821804" />
                <Inp label="Date of Issue" val={coc.issue_date} cb={v => set({ issue_date: v })} type="date" half />
                <PickGroup label="Certificate Type" val={coc.certificate_type ?? 'initial'} cb={v => set({ certificate_type: v })}
                  options={[{ v: 'initial', label: 'Initial Certificate' }, { v: 'supplementary', label: 'Supplementary Certificate' }]} />
                {coc.certificate_type === 'supplementary' && (
                  <>
                    <Inp label="Supplement No." val={coc.supplement_no} cb={v => set({ supplement_no: v || null })} half />
                    <Inp label="To Initial Certificate No." val={coc.to_initial_cert_no} cb={v => set({ to_initial_cert_no: v || null })} half />
                    <Inp label="As Issued On" val={coc.initial_cert_date} cb={v => set({ initial_cert_date: v || null })} type="date" half />
                  </>
                )}
                <Inp label="Test Report for DB/Supply (which distribution board this covers)" val={coc.db_supply} cb={v => set({ db_supply: v || null })} placeholder="e.g. Main DB, Sub-DB Kitchen" />
              </SecCard>

              <SecCard letter="B" title="Installation Location">
                <Inp label="Physical Address" val={coc.installation_address} cb={v => set({ installation_address: v || null })} />
                <Inp label="Name of Building" val={coc.name_of_building} cb={v => set({ name_of_building: v || null })} half />
                <Inp label="GPS Coordinates" val={coc.gps_coordinates} cb={v => set({ gps_coordinates: v || null })} half placeholder="-25.7479, 28.2293" />
                <Inp label="Suburb / Township" val={coc.suburb_township} cb={v => set({ suburb_township: v || null })} half />
                <Inp label="Pole Number" val={coc.pole_number} cb={v => set({ pole_number: v || null })} half />
                <Inp label="District / Town / City" val={coc.district_town_city} cb={v => set({ district_town_city: v || null })} half />
                <Inp label="Erf / Lot No." val={coc.erf_lot_no} cb={v => set({ erf_lot_no: v || null })} half />
                <Inp label="Owner / Occupier Name" val={coc.owner_name} cb={v => set({ owner_name: v || null })} half />
              </SecCard>
            </>
          )}

          {/* ── Tab: Supply System ── */}
          {tab === 'supply' && (
            <>
              <SecCard letter="C" title="Section 2 — Installation Type & Supply System">
                <PickGroup label="Installation Type" val={tr.installation_permanent ? 'permanent' : 'temporary'}
                  cb={v => setTR({ installation_permanent: v === 'permanent' })}
                  options={[{ v: 'permanent', label: 'Permanent' }, { v: 'temporary', label: 'Temporary' }]} />
                <PickGroup label="Type of Electricity Supply System" val={tr.supply_system}
                  cb={v => setTR({ supply_system: v })}
                  options={['TN-S', 'TN-C-S', 'TN-C', 'TT', 'IT'].map(v => ({ v, label: v }))} />
                <PickGroup label="Nominal Voltage" val={tr.voltage}
                  cb={v => setTR({ voltage: v })}
                  options={[{ v: '230V', label: '230 V' }, { v: '400V', label: '400 V' }, { v: '525V', label: '525 V' }, { v: 'other', label: 'Other' }]} />
                {tr.voltage === 'other' && <Inp label="Voltage (specify)" val={tr.voltage_other} cb={v => setTR({ voltage_other: v })} half />}
                <PickGroup label="Number of Phases" val={tr.phases}
                  cb={v => setTR({ phases: v })}
                  options={[{ v: 'one', label: 'One' }, { v: 'two', label: 'Two' }, { v: 'three', label: 'Three' }]} />
                <PickGroup label="Phase Rotation" val={tr.phase_rotation}
                  cb={v => setTR({ phase_rotation: v })}
                  options={[{ v: 'clockwise', label: 'Clockwise' }, { v: 'anticlockwise', label: 'Anticlockwise' }]} />
                <PickGroup label="Frequency" val={tr.frequency}
                  cb={v => setTR({ frequency: v })}
                  options={[{ v: '50Hz', label: '50 Hz' }, { v: 'other', label: 'Other' }, { v: 'dc', label: 'd.c.' }]} />
                {tr.frequency === 'other' && <Inp label="Frequency (specify)" val={tr.frequency_other} cb={v => setTR({ frequency_other: v })} half />}
              </SecCard>

              <SecCard letter="D" title="Main Switch">
                <PickGroup label="Main Switch Type" val={tr.main_switch_type}
                  cb={v => setTR({ main_switch_type: v })}
                  options={[
                    { v: 'switch_disconnector', label: 'Switch disconnector' },
                    { v: 'fuse_switch', label: 'Fuse switch' },
                    { v: 'circuit_breaker', label: 'Circuit-breaker' },
                    { v: 'elcb', label: 'Earth leakage circuit-breaker' },
                    { v: 'elsd', label: 'Earth leakage switch disconnector' },
                  ]} />
                <Inp label="Number of Poles" val={tr.main_switch_poles} cb={v => setTR({ main_switch_poles: v })} half />
                <Inp label="Current Rating (A)" val={tr.main_switch_current_rating} cb={v => setTR({ main_switch_current_rating: v })} half />
                <Inp label="Short-circuit / Withstand Rating (kA)" val={tr.main_switch_sc_rating} cb={v => setTR({ main_switch_sc_rating: v })} half />
                <PickGroup label="Rated Earth Leakage Tripping Current IΔn" val={tr.earth_leakage_current}
                  cb={v => setTR({ earth_leakage_current: v })}
                  options={[{ v: '30mA', label: '30 mA' }, { v: 'other', label: 'Other' }]} />
                {tr.earth_leakage_current === 'other' && <Inp label="Earth Leakage Current (mA)" val={tr.earth_leakage_current_other} cb={v => setTR({ earth_leakage_current_other: v })} half />}
              </SecCard>

              <SecCard letter="E" title="Additional Flags">
                <YesNo label="Is surge protection installed?" val={tr.surge_protection} cb={v => setTR({ surge_protection: v })} />
                <YesNo label="Is external lightning protection installed?" val={tr.lightning_protection} cb={v => setTR({ lightning_protection: v })} />
                <YesNo label="Is alternative power supply installed?" val={tr.alt_power_supply} cb={v => setTR({ alt_power_supply: v })} />
                <YesNo label="Is any part a specialized electrical installation?" val={tr.specialised_installation} cb={v => setTR({ specialised_installation: v })} />
                <YesNo label="Is any part at a voltage above 1 kV?" val={tr.above_1kv} cb={v => setTR({ above_1kv: v })} />
              </SecCard>
            </>
          )}

          {/* ── Tab: Circuits ── */}
          {tab === 'circuits' && (
            <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ background: S.accent }}>F</div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: S.text }}>Section 3 — Circuit Count</h3>
              </div>

              {/* Header */}
              <div className="flex items-center gap-2 py-1.5 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider flex-1" style={{ color: S.muted }}>Circuit / Point Type</span>
                <span className="text-[10px] font-bold uppercase tracking-wider w-14 text-center" style={{ color: S.muted }}>New</span>
                <span className="text-[10px] font-bold uppercase tracking-wider w-16 text-center" style={{ color: S.muted }}>Existing</span>
              </div>

              {[
                ['Lighting circuits', 'lighting_circuits'],
                ['Lighting points', 'lighting_points'],
                ['Socket-outlet circuits', 'socket_outlet_circuits'],
                ['Socket-outlets', 'socket_outlets'],
                ['Air-conditioning circuits', 'ac_circuits'],
                ['Transformer circuits — Lighting', 'transformer_lighting'],
                ['Transformer circuits — Bell', 'transformer_bell'],
                ['Transformer circuits — Other', 'transformer_other'],
                ['Heating circuits', 'heating'],
                ['Alternative power supply connections', 'alt_power'],
                ['Fan circuits', 'fan_circuits'],
                ['Fixed appliance — Cooking', 'cooking'],
                ['Fixed appliance — Geyser', 'geyser'],
                ['Fixed appliance — Pool pump', 'pool_pump'],
                ['Fixed appliance — Borehole pump', 'borehole_pump'],
                ['Fixed appliance — Other', 'fixed_other'],
              ].map(([label, key]) => (
                <CircRow key={key} label={label} keyBase={key} tr={tr} setTR={setTR} />
              ))}

              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${S.border}` }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: S.muted }}>Earth Leakage Protects</p>
                <div className="flex gap-3">
                  {[['earth_leakage_complete', 'Complete installation'], ['earth_leakage_partial', 'Only part of installation']].map(([key, label]) => (
                    <button key={key} type="button"
                      onClick={() => setTR({ [key]: !(tr as unknown as Record<string, boolean>)[key] } as Partial<COCTestReport>)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: (tr as unknown as Record<string, boolean>)[key] ? 'rgba(58,124,165,0.12)' : S.input,
                        border: `1.5px solid ${(tr as unknown as Record<string, boolean>)[key] ? S.accent : S.border}`,
                        color: (tr as unknown as Record<string, boolean>)[key] ? S.accent : S.text,
                      }}>
                      <span className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: (tr as unknown as Record<string, boolean>)[key] ? S.accent : S.muted, background: (tr as unknown as Record<string, boolean>)[key] ? S.accent : 'transparent' }}>
                        {(tr as unknown as Record<string, boolean>)[key] && <Check size={9} color="#fff" strokeWidth={3} />}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Inspections & Tests ── */}
          {tab === 'tests' && (
            <>
              <SecCard letter="G" title="Section 4 — Inspection">
                <YNA label="1. Conductors correct rating & current-carrying capacity" val={tr.inspect_conductors} cb={v => setTR({ inspect_conductors: v })} />
                <YNA label="2. Components correctly selected and installed" val={tr.inspect_components} cb={v => setTR({ inspect_components: v })} />
                <YNA label="3. Disconnecting devices correctly located" val={tr.inspect_disconnecting} cb={v => setTR({ inspect_disconnecting: v })} />
                <YNA label="4. Circuits, fuses, switches, boards correctly labelled" val={tr.inspect_labelled} cb={v => setTR({ inspect_labelled: v })} />
              </SecCard>

              <SecCard letter="H" title="Section 4 — Test Results">
                <YNA label="1. Continuity of bonding" val={tr.test_continuity_bonding} cb={v => setTR({ test_continuity_bonding: v })}
                  options={['compliant', 'non_compliant', 'na']} />
                <YNA label="2. Resistance of earth continuity conductor" val={tr.test_earth_resistance} cb={v => setTR({ test_earth_resistance: v })}
                  options={['compliant', 'non_compliant', 'na']} />
                <Inp label="3. Continuity of ring circuits (if applicable)" val={tr.test_ring_circuits} cb={v => setTR({ test_ring_circuits: v })} placeholder="—" />
                <Inp label="4. Earth loop impedance — at main/local switch (Ω)" val={tr.test_earth_loop} cb={v => setTR({ test_earth_loop: v })} half placeholder="0.00" />
                <Inp label="5. Neutral loop impedance — at main/local switch (Ω)" val={tr.test_neutral_loop} cb={v => setTR({ test_neutral_loop: v })} half placeholder="0.00" />
                <Inp label="6. PSCC at main/local switch (kA)" val={tr.test_pscc_value} cb={v => setTR({ test_pscc_value: v })} half placeholder="0.00" />
                <PickGroup label="6. PSCC Method" val={tr.test_pscc_method}
                  cb={v => setTR({ test_pscc_method: v })}
                  options={[{ v: 'calculated', label: 'Calculated' }, { v: 'measured', label: 'Measured' }]} />
                <Inp label="7. Elevated voltage neutral → external earth (V)" val={tr.test_elevated_voltage} cb={v => setTR({ test_elevated_voltage: v })} half placeholder="0.0" />
                <Inp label="8. Insulation resistance (MΩ)" val={tr.test_insulation} cb={v => setTR({ test_insulation: v })} half placeholder="0.00" />

                <div className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>9. Voltage at DB — No load (V) per phase</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['a', 'b', 'c'] as const).map(ph => (
                      <div key={ph}>
                        <label className="block text-[10px] mb-0.5" style={{ color: S.muted }}>Phase {ph.toUpperCase()}</label>
                        <input value={(tr as unknown as Record<string, string>)[`test_voltage_no_load_${ph}`] ?? ''}
                          onChange={e => setTR({ [`test_voltage_no_load_${ph}`]: e.target.value } as Partial<COCTestReport>)}
                          className="w-full px-2 py-1.5 text-sm rounded-lg outline-none text-center"
                          style={{ background: S.input, border: `1px solid ${S.border}` }} placeholder="0.0" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>10. Voltage at DB — With load (V) per phase</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['a', 'b', 'c'] as const).map(ph => (
                      <div key={ph}>
                        <label className="block text-[10px] mb-0.5" style={{ color: S.muted }}>Phase {ph.toUpperCase()}</label>
                        <input value={(tr as unknown as Record<string, string>)[`test_voltage_load_${ph}`] ?? ''}
                          onChange={e => setTR({ [`test_voltage_load_${ph}`]: e.target.value } as Partial<COCTestReport>)}
                          className="w-full px-2 py-1.5 text-sm rounded-lg outline-none text-center"
                          style={{ background: S.input, border: `1px solid ${S.border}` }} placeholder="0.0" />
                      </div>
                    ))}
                  </div>
                </div>

                <Inp label="11. Earth leakage units operation value (mA)" val={tr.test_earth_leakage_value} cb={v => setTR({ test_earth_leakage_value: v })} half placeholder="0" />
                <YNA label="12. Earth leakage test button" val={tr.test_earth_leakage_button} cb={v => setTR({ test_earth_leakage_button: v })}
                  options={['correct', 'incorrect', 'na']} />
                <YNA label="13. Polarity of points of consumption" val={tr.test_polarity} cb={v => setTR({ test_polarity: v })}
                  options={['correct', 'incorrect', 'na']} />
                <YNA label="14. Phase rotation consistent (three-phase)" val={tr.test_phase_rotation} cb={v => setTR({ test_phase_rotation: v })}
                  options={['correct', 'incorrect', 'na']} />
                <YNA label="15. Switching devices, make-and-break circuits" val={tr.test_switching} cb={v => setTR({ test_switching: v })}
                  options={['correct', 'incorrect', 'na']} />
                <TextArea label="Comments" val={tr.comments} cb={v => setTR({ comments: v })} />
                <TextArea label="Comments on parts not covered by this report" val={tr.comments_not_covered} cb={v => setTR({ comments_not_covered: v })} />
              </SecCard>
            </>
          )}

          {/* ── Tab: Declarations ── */}
          {tab === 'decl' && (
            <>
              <SecCard letter="I" title="Registered Person (Section 5 + CoC Declaration)">
                <Inp label="Full Name" val={coc.tester_name} cb={v => set({ tester_name: v })} half />
                <Inp label="ID Number" val={coc.reg_person_id_no} cb={v => set({ reg_person_id_no: v || null })} half />
                <Inp label="Registration Certificate No." val={coc.tester_registration_number} cb={v => set({ tester_registration_number: v || null })} half />
                <Inp label="Date of Registration" val={coc.reg_person_reg_date} cb={v => set({ reg_person_reg_date: v || null })} half type="date" />
                <PickGroup label="Type of Registration" val={coc.reg_person_type ?? 'master'}
                  cb={v => set({ reg_person_type: v })}
                  options={[
                    { v: 'single_phase', label: 'Electrical tester for single phase' },
                    { v: 'installation', label: 'Installation electrician' },
                    { v: 'master', label: 'Master installation electrician' },
                  ]} />
                <PickGroup label="Regulation — Type of Inspection" val={coc.regulation_type ?? 'a'}
                  cb={v => set({ regulation_type: v })}
                  options={[
                    { v: 'a', label: 'a) New electrical installation' },
                    { v: 'b', label: 'b) Existing electrical installation' },
                    { v: 'c', label: 'c) New part to existing installation' },
                  ]} />
                <Inp label="Address" val={coc.reg_person_address} cb={v => set({ reg_person_address: v || null })} />
                <Inp label="Tel. No." val={coc.reg_person_tel} cb={v => set({ reg_person_tel: v || null })} half />
                <Inp label="Fax No." val={coc.reg_person_fax} cb={v => set({ reg_person_fax: v || null })} half />
                <Inp label="Cell No." val={coc.reg_person_cell} cb={v => set({ reg_person_cell: v || null })} half />
                <Inp label="Email" val={coc.reg_person_email} cb={v => set({ reg_person_email: v || null })} half />
                <Inp label="Signature Date" val={tr.section5_date} cb={v => setTR({ section5_date: v })} half type="date" />
                <Inp label="Tel No. (Section 5)" val={tr.section5_tel} cb={v => setTR({ section5_tel: v })} half />
              </SecCard>

              <SecCard letter="J" title="Electrical Contractor Declaration">
                <Inp label="Contractor Name" val={coc.contractor_name} cb={v => set({ contractor_name: v || null })} half />
                <Inp label="ID Number" val={coc.contractor_id_no} cb={v => set({ contractor_id_no: v || null })} half />
                <Inp label="Contractor Registration No." val={coc.contractor_reg_no} cb={v => set({ contractor_reg_no: v || null })} half />
                <Inp label="Date of Registration" val={coc.contractor_reg_date} cb={v => set({ contractor_reg_date: v || null })} half type="date" />
                <Inp label="Address" val={coc.contractor_address} cb={v => set({ contractor_address: v || null })} />
                <Inp label="Tel. No." val={coc.contractor_tel} cb={v => set({ contractor_tel: v || null })} half />
                <Inp label="Fax No." val={coc.contractor_fax} cb={v => set({ contractor_fax: v || null })} half />
                <Inp label="Cell No." val={coc.contractor_cell} cb={v => set({ contractor_cell: v || null })} half />
                <Inp label="Email" val={coc.contractor_email} cb={v => set({ contractor_email: v || null })} half />
              </SecCard>

              <SecCard letter="K" title="Recipient">
                <Inp label="Recipient Name" val={coc.recipient_name} cb={v => set({ recipient_name: v || null })} half />
                <Inp label="Date Received" val={coc.recipient_date} cb={v => set({ recipient_date: v || null })} half type="date" />
              </SecCard>
            </>
          )}

          {/* ── Tab: Report (staff discoveries) ── */}
          {tab === 'report' && (
            <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ background: S.accent }}>L</div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: S.text }}>Report — Discoveries</h3>
              </div>
              <p className="text-xs mb-4" style={{ color: S.muted }}>
                Line-item findings from the on-site inspection — what was discovered and needs to be fixed.
              </p>

              <div className="space-y-2 mb-4">
                {(coc.report_items ?? []).map((item, i) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(58,124,165,0.12)', color: S.accent }}>{i + 1}</span>
                    <p className="flex-1 text-sm" style={{ color: S.text }}>{item.description}</p>
                    <button onClick={() => removeFinding(item.id)}
                      className="flex-shrink-0 p-1 rounded-md" style={{ color: S.danger }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {(coc.report_items ?? []).length === 0 && (
                  <p className="text-xs py-4 text-center" style={{ color: S.muted }}>No findings logged yet</p>
                )}
              </div>

              <div className="flex gap-2">
                <input value={newFinding} onChange={e => setNewFinding(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFinding() } }}
                  placeholder="Describe a finding — e.g. Damaged DB cover in kitchen"
                  className="flex-1 px-3 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                <button onClick={addFinding} disabled={!newFinding.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: S.accent }}>
                  Add
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: Photos ── */}
          {tab === 'photos' && (
            <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ background: S.accent }}>M</div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: S.text }}>Installation Photos</h3>
              </div>
              <p className="text-xs mb-4" style={{ color: S.muted }}>
                Photos are printed at the end of the COC, each with its description.
              </p>

              <div className="space-y-3">
                {(coc.photos ?? []).map((p, i) => (
                  <div key={`${p.url}-${i}`} className="flex gap-3 p-3 rounded-xl" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.description ?? `Photo ${i + 1}`}
                      className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                      style={{ border: `1px solid ${S.border}` }} />
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <textarea
                        value={p.description ?? ''}
                        onChange={e => updatePhotoDescription(i, e.target.value)}
                        placeholder="Describe this photo — e.g. Main DB after rewire"
                        rows={2}
                        className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                        style={{ background: '#fff', border: `1px solid ${S.border}`, color: S.text }} />
                      <button onClick={() => removePhoto(i)}
                        className="self-start flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold"
                        style={{ color: S.danger, background: 'rgba(220,38,38,0.06)' }}>
                        <Trash2 size={11} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => void handlePhotoUpload(e)} />
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ border: `1.5px dashed ${S.accent}`, color: S.accent, background: 'rgba(58,124,165,0.04)' }}>
                {uploadingPhoto ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                {uploadingPhoto ? 'Uploading…' : 'Add photos'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Send modal */}
      {showSend && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSend(false) }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <h2 className="font-bold text-sm" style={{ color: S.text }}>Send COC to Client</h2>
              <button onClick={() => setShowSend(false)} style={{ color: S.muted }}><X size={15} /></button>
            </div>
            {sendStatus === 'sent' ? (
              <div className="px-5 py-10 flex flex-col items-center gap-3">
                <CheckCircle2 size={28} style={{ color: S.green }} />
                <p className="font-semibold text-sm" style={{ color: S.text }}>COC sent!</p>
                <button onClick={() => setShowSend(false)} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>Done</button>
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
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Message (optional)</label>
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
