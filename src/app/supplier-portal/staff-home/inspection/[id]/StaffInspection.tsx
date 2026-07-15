'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Camera, Plus, X, Loader2, MapPin, ClipboardCheck, CheckCircle2, Check, Trash2,
} from 'lucide-react'
import type { ElecJobCard, ElecJobCardMaterial, ElecCOC, COCTestReport } from '@/lib/elec-types'
import { StaffBottomNav } from '../../StaffBottomNav'
import { compressImage } from '@/lib/compressImage'
import { newCOC, DEFAULT_TR } from '../../../(authenticated)/quoting/coc/COCModal'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441', input: '#F4F4F5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

interface Props {
  jobCard: ElecJobCard
  initialCOC: ElecCOC | null
  jobsBadge?: number
  projectsBadge?: number
}

type Tab = 'cert' | 'supply' | 'circuits' | 'tests' | 'decl' | 'materials' | 'report' | 'photos'

// ── Form primitives (mobile-styled equivalents of COCModal's Inp/PickGroup/YNA/YesNo) ──

function Field({ label, val, cb, placeholder, type = 'text', half }: {
  label: string; val: string | null | undefined; cb: (v: string) => void
  placeholder?: string; type?: string; half?: boolean
}) {
  return (
    <div className={half ? 'w-1/2' : 'w-full'}>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{label}</label>
      <input type={type} value={val ?? ''} onChange={e => cb(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
        style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text, fontSize: '16px' }} />
    </div>
  )
}

function Area({ label, val, cb }: { label: string; val: string | null | undefined; cb: (v: string) => void }) {
  return (
    <div className="w-full">
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{label}</label>
      <textarea value={val ?? ''} onChange={e => cb(e.target.value)} rows={2}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
        style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
    </div>
  )
}

function Pills({ label, val, cb, options }: {
  label: string; val: string; cb: (v: string) => void; options: { v: string; label: string }[]
}) {
  return (
    <div className="w-full">
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button key={o.v} type="button" onClick={() => cb(o.v)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: val === o.v ? S.accent : S.bg,
              color: val === o.v ? '#fff' : S.muted,
              border: `1.5px solid ${val === o.v ? S.accent : S.border}`,
            }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// 3-way toggle for test/inspection results (mirrors COCModal's YNA)
const TOGGLE_COLOR: Record<string, string> = { yes: S.green, compliant: S.green, correct: S.green, no: S.danger, non_compliant: S.danger, incorrect: S.danger, na: S.muted, measured: S.accent, calculated: S.accent }
const TOGGLE_LABEL: Record<string, string> = { yes: 'Yes', no: 'No', na: 'N/A', compliant: 'Pass', non_compliant: 'Fail', correct: 'Correct', incorrect: 'Incorrect', measured: 'Measured', calculated: 'Calculated' }

function Toggle({ label, val, cb, options = ['yes', 'no', 'na'] }: {
  label: string; val: string; cb: (v: string) => void; options?: string[]
}) {
  return (
    <div className="w-full">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{label}</p>
      <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
        {options.map((v, i) => (
          <button key={v} type="button" onClick={() => cb(v)}
            className="flex-1 py-2 text-xs font-semibold"
            style={{
              background: val === v ? `${TOGGLE_COLOR[v] ?? S.accent}18` : '#fff',
              color: val === v ? (TOGGLE_COLOR[v] ?? S.accent) : S.muted,
              borderLeft: i > 0 ? `1px solid ${S.border}` : undefined,
            }}>
            {TOGGLE_LABEL[v] ?? v}
          </button>
        ))}
      </div>
    </div>
  )
}

function BoolToggle({ label, val, cb }: { label: string; val: boolean; cb: (v: boolean) => void }) {
  return (
    <div className="w-full flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
      <span className="text-sm flex-1 pr-2" style={{ color: S.text }}>{label}</span>
      <div className="flex gap-1.5 flex-shrink-0">
        {[true, false].map(v => (
          <button key={String(v)} type="button" onClick={() => cb(v)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold"
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

function Sec({ letter, title, children }: { letter: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ background: S.accent }}>{letter}</div>
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: S.text }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3">{children}</div>
}

const CIRCUIT_ROWS: [string, string][] = [
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
]

function CircRow({ label, keyBase, tr, setTR }: {
  label: string; keyBase: string; tr: COCTestReport; setTR: (p: Partial<COCTestReport>) => void
}) {
  const nk = `${keyBase}_new` as keyof COCTestReport
  const ek = `${keyBase}_existing` as keyof COCTestReport
  return (
    <div className="flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${S.border}` }}>
      <span className="text-xs flex-1" style={{ color: S.text }}>{label}</span>
      <input value={(tr[nk] as string) ?? ''} onChange={e => setTR({ [nk]: e.target.value } as Partial<COCTestReport>)}
        placeholder="New" inputMode="numeric" className="w-14 px-2 py-1.5 text-xs rounded-md text-center outline-none"
        style={{ background: S.bg, border: `1px solid ${S.border}` }} />
      <input value={(tr[ek] as string) ?? ''} onChange={e => setTR({ [ek]: e.target.value } as Partial<COCTestReport>)}
        placeholder="Exist." inputMode="numeric" className="w-14 px-2 py-1.5 text-xs rounded-md text-center outline-none"
        style={{ background: S.bg, border: `1px solid ${S.border}` }} />
    </div>
  )
}

export function StaffInspection({ jobCard, initialCOC, jobsBadge, projectsBadge }: Props) {
  const router = useRouter()
  const [coc, setCOC] = useState<ElecCOC>(() => initialCOC ?? newCOC(
    null, jobCard.id, jobCard.location, jobCard.client_name, jobCard.client_email, null,
  ))
  const [materials, setMaterials] = useState<ElecJobCardMaterial[]>(jobCard.materials ?? [])
  const [tab, setTab] = useState<Tab>('cert')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const hasEditedRef = useRef(false)
  const saveDataRef = useRef(coc)
  useEffect(() => { saveDataRef.current = coc }, [coc])

  function set(patch: Partial<ElecCOC>) {
    hasEditedRef.current = true
    setCOC(prev => ({ ...prev, ...patch }))
  }
  function setTR(patch: Partial<COCTestReport>) {
    hasEditedRef.current = true
    setCOC(prev => ({ ...prev, test_report: { ...DEFAULT_TR, ...(prev.test_report ?? {}), ...patch } }))
  }

  const tr: COCTestReport = { ...DEFAULT_TR, ...(coc.test_report ?? {}) }

  const autoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isMountRef = useRef(true)
  useEffect(() => {
    if (isMountRef.current) { isMountRef.current = false; return }
    clearTimeout(autoTimer.current)
    autoTimer.current = setTimeout(() => void handleSave(), 1500)
    return () => clearTimeout(autoTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coc])

  async function handleSave(force = false): Promise<boolean> {
    if (!hasEditedRef.current && !force) return true
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/supplier-portal/quoting/coc/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveDataRef.current),
      })
      if (!res.ok) throw new Error()
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      return true
    } catch { setSaveStatus('error'); return false }
  }

  // Mark complete — force-saves the COC, then completes the underlying job
  // card, which triggers the existing admin notification + auto clock-out
  // (same mechanism StaffJobCard uses for "Mark Job as Complete").
  const [completing, setCompleting] = useState(false)
  const [completeMsg, setCompleteMsg] = useState('')

  async function handleMarkComplete() {
    if (completing) return
    setCompleting(true); setCompleteMsg('')
    try {
      const saved = await handleSave(true)
      if (!saved) { setCompleteMsg('Save failed — try again'); setCompleting(false); return }
      await fetch(`/api/supplier-portal/quoting/job-cards/${jobCard.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
      })
      setCompleteMsg('Inspection complete ✓ — returning…')
      setTimeout(() => router.push('/supplier-portal/staff-home?tab=inspect'), 1200)
    } catch { setCompleteMsg('Error — try again') }
    setCompleting(false)
  }

  // Materials
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [matDesc, setMatDesc] = useState('')
  const [matQty, setMatQty] = useState('1')
  const [matSaving, setMatSaving] = useState(false)

  async function addMaterial() {
    if (!matDesc.trim() || matSaving) return
    setMatSaving(true)
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${jobCard.id}/materials`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: matDesc.trim(), qty: parseFloat(matQty) || 1 }),
    })
    if (res.ok) {
      const m = await res.json() as ElecJobCardMaterial
      setMaterials(prev => [...prev, m])
      setMatDesc(''); setMatQty('1'); setShowAddMaterial(false)
    }
    setMatSaving(false)
  }

  async function deleteMaterial(matId: string) {
    await fetch(`/api/supplier-portal/quoting/job-cards/${jobCard.id}/materials/${matId}`, { method: 'DELETE' })
    setMaterials(prev => prev.filter(m => m.id !== matId))
  }

  // Photos
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setPhotoUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', await compressImage(file))
      const res = await fetch('/api/supplier-portal/quoting/coc/photos', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json() as { url: string }
        set({ photos: [...(coc.photos ?? []), { url, description: null }] })
      }
    }
    setPhotoUploading(false)
  }

  function updatePhotoDescription(idx: number, description: string) {
    set({ photos: (coc.photos ?? []).map((p, i) => i === idx ? { ...p, description } : p) })
  }

  function deletePhoto(idx: number) {
    set({ photos: (coc.photos ?? []).filter((_, i) => i !== idx) })
  }

  const photos = coc.photos ?? []

  const TABS: { key: Tab; label: string; done: boolean }[] = [
    { key: 'cert',      label: 'Certificate',    done: !!coc.installation_address },
    { key: 'supply',    label: 'Supply',         done: true },
    { key: 'circuits',  label: 'Circuits',       done: false },
    { key: 'tests',     label: 'Tests',          done: tr.test_polarity !== DEFAULT_TR.test_polarity || !!tr.comments },
    { key: 'decl',      label: 'Declarations',   done: !!coc.tester_name || !!coc.contractor_name },
    { key: 'materials', label: 'Materials',      done: materials.length > 0 },
    { key: 'report',    label: 'Report',         done: !!coc.notes },
    { key: 'photos',    label: 'Photos',         done: photos.length > 0 },
  ]

  return (
    <div className="staff-portal min-h-screen pb-24" style={{ background: S.bg }}>
      {/* Header */}
      <div style={{ background: '#1E2A38' }} className="px-4 pt-10 pb-5">
        <button onClick={() => router.push('/supplier-portal/staff-home?tab=inspect')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold mb-4"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)' }}>
          <ArrowLeft size={15} /> Inspections
        </button>
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
          <h1 className="text-base font-bold text-white leading-snug">
            {coc.coc_number ? `ECA ${coc.coc_number}` : (jobCard.client_name ?? jobCard.title)}
          </h1>
        </div>
        {jobCard.location && (
          <a href={`https://www.google.com/maps/search/${encodeURIComponent(jobCard.location)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 mt-1 text-xs" style={{ color: 'rgba(96,165,250,0.9)' }}>
            <MapPin size={10} />{jobCard.location}
          </a>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Step tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((s, i) => (
            <button key={s.key}
              onClick={() => setTab(s.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0"
              style={{
                background: tab === s.key ? S.accent : S.card,
                color: tab === s.key ? '#fff' : s.done ? S.green : S.muted,
                border: `1px solid ${tab === s.key ? S.accent : s.done ? 'rgba(22,163,74,0.3)' : S.border}`,
              }}>
              {s.done && tab !== s.key ? <CheckCircle2 size={11} style={{ color: S.green }} /> : (
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: tab === s.key ? 'rgba(255,255,255,0.2)' : S.bg }}>
                  {i + 1}
                </span>
              )}
              {s.label}
            </button>
          ))}
        </div>

        {saveStatus !== 'idle' && (
          <p className="text-xs flex items-center gap-1.5" style={{ color: saveStatus === 'error' ? S.danger : S.muted }}>
            {saveStatus === 'saving' && <><Loader2 size={11} className="animate-spin" /> Saving…</>}
            {saveStatus === 'saved' && <><CheckCircle2 size={11} style={{ color: S.green }} /> Saved</>}
            {saveStatus === 'error' && 'Save failed — check connection'}
          </p>
        )}

        {/* ── CERTIFICATE & LOCATION (A + B) ── */}
        {tab === 'cert' && (
          <div className="space-y-4">
            <Sec letter="A" title="COC Certificate">
              <Field label="ECA Certificate No. (blank — electrician assigns)" val={coc.coc_number} cb={v => set({ coc_number: v })} placeholder="e.g. 821804" />
              <Field label="Date of Issue" val={coc.issue_date} cb={v => set({ issue_date: v })} type="date" half />
              <Pills label="Certificate Type" val={coc.certificate_type ?? 'initial'} cb={v => set({ certificate_type: v })}
                options={[{ v: 'initial', label: 'Initial Certificate' }, { v: 'supplementary', label: 'Supplementary Certificate' }]} />
              {coc.certificate_type === 'supplementary' && (
                <>
                  <Row2>
                    <Field half label="Supplement No." val={coc.supplement_no} cb={v => set({ supplement_no: v || null })} />
                    <Field half label="To Initial Cert No." val={coc.to_initial_cert_no} cb={v => set({ to_initial_cert_no: v || null })} />
                  </Row2>
                  <Field label="As Issued On" val={coc.initial_cert_date} cb={v => set({ initial_cert_date: v || null })} type="date" half />
                </>
              )}
              <Field label="Test Report for DB/Supply (which board this covers)" val={coc.db_supply} cb={v => set({ db_supply: v || null })} placeholder="e.g. Main DB, Sub-DB Kitchen" />
            </Sec>

            <Sec letter="B" title="Installation Location">
              <Field label="Physical Address" val={coc.installation_address} cb={v => set({ installation_address: v || null })} />
              <Row2>
                <Field half label="Name of Building" val={coc.name_of_building} cb={v => set({ name_of_building: v || null })} />
                <Field half label="GPS Coordinates" val={coc.gps_coordinates} cb={v => set({ gps_coordinates: v || null })} placeholder="-25.7479, 28.2293" />
              </Row2>
              <Row2>
                <Field half label="Suburb / Township" val={coc.suburb_township} cb={v => set({ suburb_township: v || null })} />
                <Field half label="Pole Number" val={coc.pole_number} cb={v => set({ pole_number: v || null })} />
              </Row2>
              <Row2>
                <Field half label="District / Town / City" val={coc.district_town_city} cb={v => set({ district_town_city: v || null })} />
                <Field half label="Erf / Lot No." val={coc.erf_lot_no} cb={v => set({ erf_lot_no: v || null })} />
              </Row2>
              <Field label="Owner / Occupier Name" val={coc.owner_name} cb={v => set({ owner_name: v || null })} half />
            </Sec>

            <button onClick={() => setTab('supply')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
              Next: Supply System →
            </button>
          </div>
        )}

        {/* ── SUPPLY SYSTEM (C + D + E) ── */}
        {tab === 'supply' && (
          <div className="space-y-4">
            <Sec letter="C" title="Installation Type & Supply System">
              <Pills label="Installation Type" val={tr.installation_permanent ? 'permanent' : 'temporary'}
                cb={v => setTR({ installation_permanent: v === 'permanent' })}
                options={[{ v: 'permanent', label: 'Permanent' }, { v: 'temporary', label: 'Temporary' }]} />
              <Pills label="Type of Electricity Supply System" val={tr.supply_system} cb={v => setTR({ supply_system: v })}
                options={['TN-S', 'TN-C-S', 'TN-C', 'TT', 'IT'].map(v => ({ v, label: v }))} />
              <Pills label="Nominal Voltage" val={tr.voltage} cb={v => setTR({ voltage: v })}
                options={[{ v: '230V', label: '230V' }, { v: '400V', label: '400V' }, { v: '525V', label: '525V' }, { v: 'other', label: 'Other' }]} />
              {tr.voltage === 'other' && <Field half label="Voltage (specify)" val={tr.voltage_other} cb={v => setTR({ voltage_other: v })} />}
              <Pills label="Number of Phases" val={tr.phases} cb={v => setTR({ phases: v })}
                options={[{ v: 'one', label: 'One' }, { v: 'two', label: 'Two' }, { v: 'three', label: 'Three' }]} />
              <Pills label="Phase Rotation" val={tr.phase_rotation} cb={v => setTR({ phase_rotation: v })}
                options={[{ v: 'clockwise', label: 'Clockwise' }, { v: 'anticlockwise', label: 'Anticlockwise' }]} />
              <Pills label="Frequency" val={tr.frequency} cb={v => setTR({ frequency: v })}
                options={[{ v: '50Hz', label: '50Hz' }, { v: 'other', label: 'Other' }, { v: 'dc', label: 'd.c.' }]} />
              {tr.frequency === 'other' && <Field half label="Frequency (specify)" val={tr.frequency_other} cb={v => setTR({ frequency_other: v })} />}
            </Sec>

            <Sec letter="D" title="Main Switch">
              <Pills label="Main Switch Type" val={tr.main_switch_type} cb={v => setTR({ main_switch_type: v })}
                options={[
                  { v: 'switch_disconnector', label: 'Switch disconnector' },
                  { v: 'fuse_switch', label: 'Fuse switch' },
                  { v: 'circuit_breaker', label: 'Circuit-breaker' },
                  { v: 'elcb', label: 'ELCB' },
                  { v: 'elsd', label: 'ELSD' },
                ]} />
              <Row2>
                <Field half label="Number of Poles" val={tr.main_switch_poles} cb={v => setTR({ main_switch_poles: v })} />
                <Field half label="Current Rating (A)" val={tr.main_switch_current_rating} cb={v => setTR({ main_switch_current_rating: v })} />
              </Row2>
              <Field label="Short-circuit / Withstand Rating (kA)" val={tr.main_switch_sc_rating} cb={v => setTR({ main_switch_sc_rating: v })} half />
              <Pills label="Rated Earth Leakage Tripping Current IΔn" val={tr.earth_leakage_current} cb={v => setTR({ earth_leakage_current: v })}
                options={[{ v: '30mA', label: '30mA' }, { v: 'other', label: 'Other' }]} />
              {tr.earth_leakage_current === 'other' && <Field half label="Earth Leakage Current (mA)" val={tr.earth_leakage_current_other} cb={v => setTR({ earth_leakage_current_other: v })} />}
            </Sec>

            <Sec letter="E" title="Additional Flags">
              <BoolToggle label="Surge protection installed?" val={tr.surge_protection} cb={v => setTR({ surge_protection: v })} />
              <BoolToggle label="External lightning protection installed?" val={tr.lightning_protection} cb={v => setTR({ lightning_protection: v })} />
              <BoolToggle label="Alternative power supply installed?" val={tr.alt_power_supply} cb={v => setTR({ alt_power_supply: v })} />
              <BoolToggle label="Any part a specialized electrical installation?" val={tr.specialised_installation} cb={v => setTR({ specialised_installation: v })} />
              <BoolToggle label="Any part at a voltage above 1 kV?" val={tr.above_1kv} cb={v => setTR({ above_1kv: v })} />
            </Sec>

            <button onClick={() => setTab('circuits')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
              Next: Circuits →
            </button>
          </div>
        )}

        {/* ── CIRCUITS (F) ── */}
        {tab === 'circuits' && (
          <div className="space-y-4">
            <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: S.accent }}>F</div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: S.text }}>Circuit Count</h3>
              </div>
              <div className="flex items-center gap-2 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider flex-1" style={{ color: S.muted }}>Type</span>
                <span className="text-[10px] font-bold uppercase tracking-wider w-14 text-center" style={{ color: S.muted }}>New</span>
                <span className="text-[10px] font-bold uppercase tracking-wider w-14 text-center" style={{ color: S.muted }}>Exist.</span>
              </div>
              {CIRCUIT_ROWS.map(([label, key]) => (
                <CircRow key={key} label={label} keyBase={key} tr={tr} setTR={setTR} />
              ))}
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${S.border}` }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: S.muted }}>Earth Leakage Protects</p>
                <div className="flex flex-wrap gap-2">
                  {([['earth_leakage_complete', 'Complete installation'], ['earth_leakage_partial', 'Only part of installation']] as const).map(([key, label]) => (
                    <button key={key} type="button"
                      onClick={() => setTR({ [key]: !(tr as unknown as Record<string, boolean>)[key] } as Partial<COCTestReport>)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: (tr as unknown as Record<string, boolean>)[key] ? 'rgba(58,124,165,0.12)' : S.bg,
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
            <button onClick={() => setTab('tests')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
              Next: Tests →
            </button>
          </div>
        )}

        {/* ── TESTS (G + H) ── */}
        {tab === 'tests' && (
          <div className="space-y-4">
            <Sec letter="G" title="Inspection">
              <Toggle label="1. Conductors correct rating & current-carrying capacity" val={tr.inspect_conductors} cb={v => setTR({ inspect_conductors: v })} />
              <Toggle label="2. Components correctly selected and installed" val={tr.inspect_components} cb={v => setTR({ inspect_components: v })} />
              <Toggle label="3. Disconnecting devices correctly located" val={tr.inspect_disconnecting} cb={v => setTR({ inspect_disconnecting: v })} />
              <Toggle label="4. Circuits, fuses, switches, boards correctly labelled" val={tr.inspect_labelled} cb={v => setTR({ inspect_labelled: v })} />
            </Sec>

            <Sec letter="H" title="Test Results">
              <Toggle label="1. Continuity of bonding" val={tr.test_continuity_bonding} cb={v => setTR({ test_continuity_bonding: v })} options={['compliant', 'non_compliant', 'na']} />
              <Toggle label="2. Resistance of earth continuity conductor" val={tr.test_earth_resistance} cb={v => setTR({ test_earth_resistance: v })} options={['compliant', 'non_compliant', 'na']} />
              <Field label="3. Continuity of ring circuits (if applicable)" val={tr.test_ring_circuits} cb={v => setTR({ test_ring_circuits: v })} placeholder="—" />
              <Row2>
                <Field half label="4. Earth loop impedance (Ω)" val={tr.test_earth_loop} cb={v => setTR({ test_earth_loop: v })} placeholder="0.00" />
                <Field half label="5. Neutral loop impedance (Ω)" val={tr.test_neutral_loop} cb={v => setTR({ test_neutral_loop: v })} placeholder="0.00" />
              </Row2>
              <Field half label="6. PSCC at main/local switch (kA)" val={tr.test_pscc_value} cb={v => setTR({ test_pscc_value: v })} placeholder="0.00" />
              <Pills label="6. PSCC Method" val={tr.test_pscc_method} cb={v => setTR({ test_pscc_method: v })}
                options={[{ v: 'calculated', label: 'Calculated' }, { v: 'measured', label: 'Measured' }]} />
              <Row2>
                <Field half label="7. Elevated voltage → external earth (V)" val={tr.test_elevated_voltage} cb={v => setTR({ test_elevated_voltage: v })} placeholder="0.0" />
                <Field half label="8. Insulation resistance (MΩ)" val={tr.test_insulation} cb={v => setTR({ test_insulation: v })} placeholder="0.00" />
              </Row2>

              <div className="w-full">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>9. Voltage at DB — No load (V) per phase</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['a', 'b', 'c'] as const).map(ph => (
                    <div key={ph}>
                      <label className="block text-[10px] mb-0.5" style={{ color: S.muted }}>Phase {ph.toUpperCase()}</label>
                      <input value={(tr as unknown as Record<string, string>)[`test_voltage_no_load_${ph}`] ?? ''}
                        onChange={e => setTR({ [`test_voltage_no_load_${ph}`]: e.target.value } as Partial<COCTestReport>)}
                        className="w-full px-2 py-2 text-sm rounded-lg outline-none text-center"
                        style={{ background: S.bg, border: `1px solid ${S.border}` }} placeholder="0.0" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>10. Voltage at DB — With load (V) per phase</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['a', 'b', 'c'] as const).map(ph => (
                    <div key={ph}>
                      <label className="block text-[10px] mb-0.5" style={{ color: S.muted }}>Phase {ph.toUpperCase()}</label>
                      <input value={(tr as unknown as Record<string, string>)[`test_voltage_load_${ph}`] ?? ''}
                        onChange={e => setTR({ [`test_voltage_load_${ph}`]: e.target.value } as Partial<COCTestReport>)}
                        className="w-full px-2 py-2 text-sm rounded-lg outline-none text-center"
                        style={{ background: S.bg, border: `1px solid ${S.border}` }} placeholder="0.0" />
                    </div>
                  ))}
                </div>
              </div>

              <Field half label="11. Earth leakage units operation value (mA)" val={tr.test_earth_leakage_value} cb={v => setTR({ test_earth_leakage_value: v })} placeholder="0" />
              <Toggle label="12. Earth leakage test button" val={tr.test_earth_leakage_button} cb={v => setTR({ test_earth_leakage_button: v })} options={['correct', 'incorrect', 'na']} />
              <Toggle label="13. Polarity of points of consumption" val={tr.test_polarity} cb={v => setTR({ test_polarity: v })} options={['correct', 'incorrect', 'na']} />
              <Toggle label="14. Phase rotation consistent (three-phase)" val={tr.test_phase_rotation} cb={v => setTR({ test_phase_rotation: v })} options={['correct', 'incorrect', 'na']} />
              <Toggle label="15. Switching devices, make-and-break circuits" val={tr.test_switching} cb={v => setTR({ test_switching: v })} options={['correct', 'incorrect', 'na']} />
              <Area label="Comments" val={tr.comments} cb={v => setTR({ comments: v })} />
              <Area label="Comments on parts not covered by this report" val={tr.comments_not_covered} cb={v => setTR({ comments_not_covered: v })} />
            </Sec>

            <button onClick={() => setTab('decl')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
              Next: Declarations →
            </button>
          </div>
        )}

        {/* ── DECLARATIONS (I + J + K) ── */}
        {tab === 'decl' && (
          <div className="space-y-4">
            <Sec letter="I" title="Registered Person">
              <Row2>
                <Field half label="Full Name" val={coc.tester_name} cb={v => set({ tester_name: v })} />
                <Field half label="ID Number" val={coc.reg_person_id_no} cb={v => set({ reg_person_id_no: v || null })} />
              </Row2>
              <Row2>
                <Field half label="Registration Certificate No." val={coc.tester_registration_number} cb={v => set({ tester_registration_number: v || null })} />
                <Field half label="Date of Registration" val={coc.reg_person_reg_date} cb={v => set({ reg_person_reg_date: v || null })} type="date" />
              </Row2>
              <Pills label="Type of Registration" val={coc.reg_person_type ?? 'master'} cb={v => set({ reg_person_type: v })}
                options={[
                  { v: 'single_phase', label: 'Tester for single phase' },
                  { v: 'installation', label: 'Installation electrician' },
                  { v: 'master', label: 'Master installation electrician' },
                ]} />
              <Pills label="Regulation — Type of Inspection" val={coc.regulation_type ?? 'a'} cb={v => set({ regulation_type: v })}
                options={[
                  { v: 'a', label: 'a) New installation' },
                  { v: 'b', label: 'b) Existing installation' },
                  { v: 'c', label: 'c) New part to existing' },
                ]} />
              <Field label="Address" val={coc.reg_person_address} cb={v => set({ reg_person_address: v || null })} />
              <Row2>
                <Field half label="Tel. No." val={coc.reg_person_tel} cb={v => set({ reg_person_tel: v || null })} />
                <Field half label="Fax No." val={coc.reg_person_fax} cb={v => set({ reg_person_fax: v || null })} />
              </Row2>
              <Row2>
                <Field half label="Cell No." val={coc.reg_person_cell} cb={v => set({ reg_person_cell: v || null })} />
                <Field half label="Email" val={coc.reg_person_email} cb={v => set({ reg_person_email: v || null })} />
              </Row2>
              <Row2>
                <Field half label="Signature Date" val={tr.section5_date} cb={v => setTR({ section5_date: v })} type="date" />
                <Field half label="Tel No. (Section 5)" val={tr.section5_tel} cb={v => setTR({ section5_tel: v })} />
              </Row2>
            </Sec>

            <Sec letter="J" title="Electrical Contractor Declaration">
              <Row2>
                <Field half label="Contractor Name" val={coc.contractor_name} cb={v => set({ contractor_name: v || null })} />
                <Field half label="ID Number" val={coc.contractor_id_no} cb={v => set({ contractor_id_no: v || null })} />
              </Row2>
              <Row2>
                <Field half label="Contractor Registration No." val={coc.contractor_reg_no} cb={v => set({ contractor_reg_no: v || null })} />
                <Field half label="Date of Registration" val={coc.contractor_reg_date} cb={v => set({ contractor_reg_date: v || null })} type="date" />
              </Row2>
              <Field label="Address" val={coc.contractor_address} cb={v => set({ contractor_address: v || null })} />
              <Row2>
                <Field half label="Tel. No." val={coc.contractor_tel} cb={v => set({ contractor_tel: v || null })} />
                <Field half label="Fax No." val={coc.contractor_fax} cb={v => set({ contractor_fax: v || null })} />
              </Row2>
              <Row2>
                <Field half label="Cell No." val={coc.contractor_cell} cb={v => set({ contractor_cell: v || null })} />
                <Field half label="Email" val={coc.contractor_email} cb={v => set({ contractor_email: v || null })} />
              </Row2>
            </Sec>

            <Sec letter="K" title="Recipient">
              <Row2>
                <Field half label="Recipient Name" val={coc.recipient_name} cb={v => set({ recipient_name: v || null })} />
                <Field half label="Date Received" val={coc.recipient_date} cb={v => set({ recipient_date: v || null })} type="date" />
              </Row2>
            </Sec>

            <button onClick={() => setTab('materials')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
              Next: Materials →
            </button>
          </div>
        )}

        {/* ── MATERIALS TAB ── */}
        {tab === 'materials' && (
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="px-4 py-3" style={{ borderBottom: `1px solid ${S.border}` }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: S.muted }}>Materials Used</span>
              </div>
              {materials.length === 0 && !showAddMaterial && (
                <div className="py-6 flex flex-col items-center gap-1">
                  <p className="text-xs" style={{ color: S.muted }}>No materials logged yet</p>
                </div>
              )}
              {materials.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: S.text }}>{m.description}</p>
                    <p className="text-xs" style={{ color: S.muted }}>Qty: {m.qty}</p>
                  </div>
                  <button onClick={() => void deleteMaterial(m.id)} style={{ color: S.muted }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              {showAddMaterial && (
                <div className="px-4 py-3 space-y-2" style={{ borderTop: materials.length > 0 ? `1px solid ${S.border}` : undefined }}>
                  <input value={matDesc} onChange={e => setMatDesc(e.target.value)}
                    placeholder="Material description"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                  <input value={matQty} onChange={e => setMatQty(e.target.value)}
                    placeholder="Qty" type="number" min="0.01" step="0.01"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowAddMaterial(false); setMatDesc(''); setMatQty('1') }}
                      className="flex-1 py-2 rounded-xl text-sm" style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                      Cancel
                    </button>
                    <button onClick={() => void addMaterial()} disabled={!matDesc.trim() || matSaving}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: S.accent }}>
                      {matSaving ? <Loader2 size={13} className="animate-spin inline" /> : 'Add'}
                    </button>
                  </div>
                </div>
              )}
              {!showAddMaterial && (
                <div className="px-4 py-3" style={{ borderTop: `1px solid ${S.border}` }}>
                  <button onClick={() => setShowAddMaterial(true)}
                    className="flex items-center gap-2 text-xs font-semibold" style={{ color: S.accent }}>
                    <Plus size={12} /> Log Material Used
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setTab('report')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
              Next: Report →
            </button>
          </div>
        )}

        {/* ── REPORT TAB ── */}
        {tab === 'report' && (
          <div className="rounded-2xl p-4 space-y-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-xs" style={{ color: S.muted }}>What needs to be fixed? This is the audit summary for the office.</p>
            <textarea value={coc.notes ?? ''} onChange={e => set({ notes: e.target.value || null })}
              placeholder="Describe defects found and remedial work required…" rows={8}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
              style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }} />
            <button onClick={() => setTab('photos')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
              Next: Photos →
            </button>
          </div>
        )}

        {/* ── PHOTOS TAB ── */}
        {tab === 'photos' && (
          <div className="space-y-3">
            {photos.length > 0 && (
              <div className="space-y-3">
                {photos.map((p, i) => (
                  <div key={`${p.url}-${i}`} className="flex gap-3 p-3 rounded-xl" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.description ?? `Photo ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-lg flex-shrink-0" style={{ border: `1px solid ${S.border}` }} />
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <textarea
                        value={p.description ?? ''}
                        onChange={e => updatePhotoDescription(i, e.target.value)}
                        placeholder="Describe this photo…"
                        rows={2}
                        className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                        style={{ background: S.bg, border: `1px solid ${S.border}`, color: S.text }} />
                      <button onClick={() => deletePhoto(i)}
                        className="self-start flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold"
                        style={{ color: S.danger, background: 'rgba(220,38,38,0.06)' }}>
                        <Trash2 size={11} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-2xl p-5 flex flex-col items-center gap-3" style={{ background: S.card, border: `2px dashed ${S.border}` }}>
              <Camera size={24} style={{ color: S.muted }} />
              <p className="text-sm" style={{ color: S.muted }}>{photoUploading ? 'Uploading…' : 'Take or upload photos'}</p>
              <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
                onChange={e => void handlePhotoUpload(e.target.files)} />
              <button onClick={() => fileInputRef.current?.click()} disabled={photoUploading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                {photoUploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                {photoUploading ? 'Uploading…' : 'Add Photos'}
              </button>
            </div>

            <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <p className="text-xs mb-3" style={{ color: S.muted }}>
                Marking complete saves everything and notifies the office this inspection is ready to review.
              </p>
              {completeMsg ? (
                <p className="text-sm font-semibold text-center py-2" style={{ color: completeMsg.startsWith('Inspection') ? S.green : S.danger }}>{completeMsg}</p>
              ) : (
                <button onClick={() => void handleMarkComplete()} disabled={completing}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: S.green }}>
                  {completing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {completing ? 'Saving…' : 'Mark Inspection Complete'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <StaffBottomNav activeTab="inspect" jobsBadge={jobsBadge} projectsBadge={projectsBadge} />
    </div>
  )
}
