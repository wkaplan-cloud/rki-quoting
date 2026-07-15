'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Camera, Plus, X, Loader2, MapPin, ClipboardCheck, CheckCircle2,
} from 'lucide-react'
import type { ElecJobCard, ElecJobCardMaterial, ElecCOC, COCTestReport } from '@/lib/elec-types'
import { StaffBottomNav } from '../../StaffBottomNav'
import { compressImage } from '@/lib/compressImage'
import { newCOC, DEFAULT_TR } from '../../../(authenticated)/quoting/coc/COCModal'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

interface Props {
  jobCard: ElecJobCard
  initialCOC: ElecCOC | null
  jobsBadge?: number
  projectsBadge?: number
}

type Tab = 'details' | 'tests' | 'materials' | 'report' | 'photos'

function Field({ label, val, cb, placeholder, half }: {
  label: string; val: string | null | undefined; cb: (v: string) => void; placeholder?: string; half?: boolean
}) {
  return (
    <div className={half ? 'w-1/2' : 'w-full'}>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{label}</label>
      <input value={val ?? ''} onChange={e => cb(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
        style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text, fontSize: '16px' }} />
    </div>
  )
}

function Pills({ label, val, cb, options }: {
  label: string; val: string; cb: (v: string) => void; options: { v: string; label: string }[]
}) {
  return (
    <div>
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

const PASS_FAIL: { v: string; label: string }[] = [
  { v: 'compliant', label: 'Pass' }, { v: 'non_compliant', label: 'Fail' }, { v: 'na', label: 'N/A' },
]
const CORRECT_INCORRECT: { v: string; label: string }[] = [
  { v: 'correct', label: 'Correct' }, { v: 'incorrect', label: 'Incorrect' }, { v: 'na', label: 'N/A' },
]
const YES_NO_NA: { v: string; label: string }[] = [
  { v: 'yes', label: 'Yes' }, { v: 'no', label: 'No' }, { v: 'na', label: 'N/A' },
]

export function StaffInspection({ jobCard, initialCOC, jobsBadge, projectsBadge }: Props) {
  const router = useRouter()
  const [coc, setCOC] = useState<ElecCOC>(() => initialCOC ?? newCOC(
    null, jobCard.id, jobCard.location, jobCard.client_name, jobCard.client_email, null,
  ))
  const [materials, setMaterials] = useState<ElecJobCardMaterial[]>(jobCard.materials ?? [])
  const [tab, setTab] = useState<Tab>('details')
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

  function deletePhoto(url: string) {
    set({ photos: (coc.photos ?? []).filter(p => p.url !== url) })
  }

  const photos = coc.photos ?? []

  const STEPS: { key: Tab; label: string; done: boolean }[] = [
    { key: 'details',   label: 'Details',   done: !!coc.installation_address },
    { key: 'tests',     label: 'Tests',     done: !!tr.comments || tr.test_polarity !== DEFAULT_TR.test_polarity },
    { key: 'materials', label: 'Materials', done: materials.length > 0 },
    { key: 'report',    label: 'Report',    done: !!coc.notes },
    { key: 'photos',    label: 'Photos',    done: photos.length > 0 },
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
          <h1 className="text-base font-bold text-white leading-snug">{jobCard.client_name ?? jobCard.title}</h1>
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
          {STEPS.map((s, i) => (
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

        {/* ── DETAILS TAB ── */}
        {tab === 'details' && (
          <div className="rounded-2xl p-4 space-y-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <Field label="Installation Address" val={coc.installation_address} cb={v => set({ installation_address: v || null })} />
            <div className="flex gap-3">
              <Field half label="Name of Building" val={coc.name_of_building} cb={v => set({ name_of_building: v || null })} />
              <Field half label="Suburb / Township" val={coc.suburb_township} cb={v => set({ suburb_township: v || null })} />
            </div>
            <div className="flex gap-3">
              <Field half label="District / Town / City" val={coc.district_town_city} cb={v => set({ district_town_city: v || null })} />
              <Field half label="Owner / Occupier" val={coc.owner_name} cb={v => set({ owner_name: v || null })} />
            </div>
            <Pills label="Supply System" val={tr.supply_system} cb={v => setTR({ supply_system: v })}
              options={['TN-S', 'TN-C-S', 'TN-C', 'TT', 'IT'].map(v => ({ v, label: v }))} />
            <Pills label="Nominal Voltage" val={tr.voltage} cb={v => setTR({ voltage: v })}
              options={[{ v: '230V', label: '230V' }, { v: '400V', label: '400V' }, { v: '525V', label: '525V' }, { v: 'other', label: 'Other' }]} />
            <Pills label="Number of Phases" val={tr.phases} cb={v => setTR({ phases: v })}
              options={[{ v: 'one', label: 'One' }, { v: 'two', label: 'Two' }, { v: 'three', label: 'Three' }]} />
            <Pills label="Main Switch Type" val={tr.main_switch_type} cb={v => setTR({ main_switch_type: v })}
              options={[
                { v: 'switch_disconnector', label: 'Switch disconnector' },
                { v: 'fuse_switch', label: 'Fuse switch' },
                { v: 'circuit_breaker', label: 'Circuit-breaker' },
                { v: 'elcb', label: 'ELCB' },
                { v: 'elsd', label: 'ELSD' },
              ]} />
            <button onClick={() => setTab('tests')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
              Next: Tests →
            </button>
          </div>
        )}

        {/* ── TESTS TAB ── */}
        {tab === 'tests' && (
          <div className="rounded-2xl p-4 space-y-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-xs" style={{ color: S.muted }}>Section 4 — Inspection & Test Results</p>
            <Pills label="Conductors correct rating & capacity" val={tr.inspect_conductors} cb={v => setTR({ inspect_conductors: v })} options={YES_NO_NA} />
            <Pills label="Components correctly selected & installed" val={tr.inspect_components} cb={v => setTR({ inspect_components: v })} options={YES_NO_NA} />
            <Pills label="Disconnecting devices correctly located" val={tr.inspect_disconnecting} cb={v => setTR({ inspect_disconnecting: v })} options={YES_NO_NA} />
            <Pills label="Circuits, fuses, switches, boards labelled" val={tr.inspect_labelled} cb={v => setTR({ inspect_labelled: v })} options={YES_NO_NA} />
            <div style={{ borderTop: `1px solid ${S.border}` }} className="pt-4" />
            <Pills label="Continuity of bonding" val={tr.test_continuity_bonding} cb={v => setTR({ test_continuity_bonding: v })} options={PASS_FAIL} />
            <Pills label="Earth continuity resistance" val={tr.test_earth_resistance} cb={v => setTR({ test_earth_resistance: v })} options={PASS_FAIL} />
            <div className="flex gap-3">
              <Field half label="Earth loop impedance (Ω)" val={tr.test_earth_loop} cb={v => setTR({ test_earth_loop: v })} />
              <Field half label="Insulation resistance (MΩ)" val={tr.test_insulation} cb={v => setTR({ test_insulation: v })} />
            </div>
            <div className="flex gap-3">
              <Field half label="Earth leakage value (mA)" val={tr.test_earth_leakage_value} cb={v => setTR({ test_earth_leakage_value: v })} />
            </div>
            <Pills label="Earth leakage test button" val={tr.test_earth_leakage_button} cb={v => setTR({ test_earth_leakage_button: v })} options={CORRECT_INCORRECT} />
            <Pills label="Polarity of points of consumption" val={tr.test_polarity} cb={v => setTR({ test_polarity: v })} options={CORRECT_INCORRECT} />
            <Pills label="Phase rotation consistent" val={tr.test_phase_rotation} cb={v => setTR({ test_phase_rotation: v })} options={CORRECT_INCORRECT} />
            <Pills label="Switching devices operate correctly" val={tr.test_switching} cb={v => setTR({ test_switching: v })} options={CORRECT_INCORRECT} />
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Comments</label>
              <textarea value={tr.comments} onChange={e => setTR({ comments: e.target.value })} rows={3}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
            </div>
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
              <div className="grid grid-cols-2 gap-3">
                {photos.map(p => (
                  <div key={p.url} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.description ?? 'Photo'} className="w-full h-full object-cover" />
                    <button onClick={() => deletePhoto(p.url)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white"
                      style={{ background: S.danger }}>
                      <X size={11} />
                    </button>
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
