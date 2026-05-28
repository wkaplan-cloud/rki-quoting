'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Save, Camera, Plus, X, Pen, CheckCircle2,
  Loader2, MapPin, Clock, Briefcase
} from 'lucide-react'
import type { ElecJobCard, ElecJobCardMaterial, ElecJobCardPhoto } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

const TYPE_LABEL: Record<string, string> = {
  maintenance: 'Maintenance', repair: 'Repair', once_off: 'Once-Off', callout: 'Callout',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  jobCard: ElecJobCard
  staffName: string
}

type Tab = 'report' | 'materials' | 'photos' | 'signature'

export function StaffJobCard({ jobCard: initial, staffName }: Props) {
  const router = useRouter()
  const [card, setCard] = useState<ElecJobCard>(initial)
  const [tab, setTab] = useState<Tab>('report')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sigCaption, setSigCaption] = useState('')
  const [sigSaving, setSigSaving] = useState(false)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  async function save(patch: Partial<ElecJobCard>) {
    setSaving(true); setSaveMsg('')
    try {
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      setCard(c => ({ ...c, ...patch }))
      setSaveMsg('Saved ✓')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch { setSaveMsg('Error saving') }
    finally { setSaving(false) }
  }

  async function handleSaveReport() {
    await save({
      work_found: card.work_found,
      work_done: card.work_done,
      resolution: card.resolution,
      notes: card.notes,
      status: card.status === 'pending' ? 'in_progress' : card.status,
    })
  }

  async function handleMarkComplete() {
    await save({ status: 'completed', completed_at: new Date().toISOString() })
  }

  async function addMaterial() {
    const desc = prompt('Material description:')
    if (!desc?.trim()) return
    const qty = parseFloat(prompt('Quantity:') ?? '1') || 1
    const price = parseFloat(prompt('Unit price (leave blank if unknown):') ?? '') || null
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/materials`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc.trim(), qty, unit_price: price }),
    })
    if (res.ok) {
      const m = await res.json() as ElecJobCardMaterial
      setCard(c => ({ ...c, materials: [...(c.materials ?? []), m] }))
    }
  }

  async function deleteMaterial(matId: string) {
    await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/materials/${matId}`, { method: 'DELETE' })
    setCard(c => ({ ...c, materials: (c.materials ?? []).filter(m => m.id !== matId) }))
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setPhotoUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/photos`, { method: 'POST', body: fd })
      if (res.ok) {
        const p = await res.json() as ElecJobCardPhoto
        setCard(c => ({ ...c, photos: [...(c.photos ?? []), p] }))
      }
    }
    setPhotoUploading(false)
  }

  async function deletePhoto(photoId: string) {
    await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/photos/${photoId}`, { method: 'DELETE' })
    setCard(c => ({ ...c, photos: (c.photos ?? []).filter(p => p.id !== photoId) }))
  }

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault(); isDrawing.current = true; lastPos.current = getCanvasPos(e)
  }
  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!isDrawing.current || !lastPos.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getCanvasPos(e)
    ctx.strokeStyle = '#18181B'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos
  }
  function endDraw() { isDrawing.current = false; lastPos.current = null }

  async function saveSignature() {
    const canvas = canvasRef.current!
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
    if (!blob) return
    setSigSaving(true)
    const fd = new FormData()
    fd.append('file', blob, 'signature.png')
    fd.append('caption', sigCaption || 'Client signature')
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/photos`, { method: 'POST', body: fd })
    if (res.ok) {
      const p = await res.json() as ElecJobCardPhoto
      await save({ client_signature_url: p.url })
    }
    setSigSaving(false)
  }

  const materials = card.materials ?? []
  const photos = card.photos ?? []
  const client = !Array.isArray(card.client) ? card.client : null

  const tabs: { key: Tab; label: string }[] = [
    { key: 'report',    label: 'Report' },
    { key: 'materials', label: `Materials${materials.length > 0 ? ` (${materials.length})` : ''}` },
    { key: 'photos',    label: `Photos${photos.length > 0 ? ` (${photos.length})` : ''}` },
    { key: 'signature', label: 'Sign' },
  ]

  return (
    <div className="min-h-screen" style={{ background: S.bg }}>
      {/* Header */}
      <div style={{ background: '#1E2A38' }} className="px-4 pt-10 pb-5">
        <button onClick={() => router.push('/supplier-portal/staff-home')}
          className="flex items-center gap-2 text-sm mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <ArrowLeft size={15} /> My Jobs
        </button>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-mono mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{card.job_number}</p>
            <h1 className="text-base font-bold text-white leading-snug">{card.title}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {card.location && <span className="flex items-center gap-1"><MapPin size={10} />{card.location}</span>}
              {card.scheduled_at && <span className="flex items-center gap-1"><Clock size={10} />{fmtDate(card.scheduled_at)}</span>}
              <span><Briefcase size={10} className="inline mr-0.5" />{TYPE_LABEL[card.job_type]}</span>
            </div>
          </div>
          {card.status === 'completed' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
              style={{ background: 'rgba(22,163,74,0.2)', color: '#4ade80' }}>
              <CheckCircle2 size={11} /> Done
            </div>
          )}
        </div>
        {card.work_description && (
          <p className="text-xs mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{card.work_description}</p>
        )}
        {client && (
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Client: {client.client_name}</p>
        )}
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
              style={{
                background: tab === t.key ? S.accent : S.card,
                color: tab === t.key ? '#fff' : S.muted,
                border: `1px solid ${tab === t.key ? S.accent : S.border}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Report tab */}
        {tab === 'report' && (
          <div className="rounded-2xl p-4 space-y-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>What Did You Find?</label>
              <textarea value={card.work_found ?? ''} onChange={e => setCard(c => ({ ...c, work_found: e.target.value || null }))}
                placeholder="Describe what you found on site…" rows={4}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Work Completed</label>
              <textarea value={card.work_done ?? ''} onChange={e => setCard(c => ({ ...c, work_done: e.target.value || null }))}
                placeholder="Describe what you did…" rows={4}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Resolution</label>
              <textarea value={card.resolution ?? ''} onChange={e => setCard(c => ({ ...c, resolution: e.target.value || null }))}
                placeholder="How was it resolved?" rows={3}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Notes</label>
              <textarea value={card.notes ?? ''} onChange={e => setCard(c => ({ ...c, notes: e.target.value || null }))}
                placeholder="Any other notes…" rows={2}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ border: `1px solid ${S.border}`, color: S.text }} />
            </div>

            {saveMsg && <p className="text-xs" style={{ color: saveMsg.includes('Error') ? S.danger : S.green }}>{saveMsg}</p>}

            <div className="flex gap-2">
              <button onClick={() => void handleSaveReport()} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
              {card.status !== 'completed' && (
                <button onClick={() => void handleMarkComplete()} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ background: S.green }}>
                  <CheckCircle2 size={14} /> Mark Complete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Materials tab */}
        {tab === 'materials' && (
          <div>
            <div className="rounded-2xl overflow-hidden mb-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              {materials.length === 0 && (
                <div className="py-8 flex flex-col items-center gap-2">
                  <p className="text-sm" style={{ color: S.muted }}>No materials added</p>
                </div>
              )}
              {materials.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: S.text }}>{m.description}</p>
                    <p className="text-xs" style={{ color: S.muted }}>Qty: {m.qty}{m.unit_price != null ? ` · R${m.unit_price.toFixed(2)}` : ''}</p>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: S.text }}>
                    {m.unit_price != null ? `R${(m.qty * m.unit_price).toFixed(2)}` : '—'}
                  </p>
                  <button onClick={() => void deleteMaterial(m.id)} style={{ color: S.muted }}><X size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={addMaterial}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ border: `1px solid ${S.border}`, color: S.accent }}>
              <Plus size={14} /> Add Material
            </button>
          </div>
        )}

        {/* Photos tab */}
        {tab === 'photos' && (
          <div>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {photos.map(p => (
                  <div key={p.id} className="relative rounded-xl overflow-hidden group" style={{ aspectRatio: '4/3' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption ?? 'Photo'} className="w-full h-full object-cover" />
                    <button onClick={() => void deletePhoto(p.id)}
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
          </div>
        )}

        {/* Signature tab */}
        {tab === 'signature' && (
          <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            {card.client_signature_url ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Signature Captured</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.client_signature_url} alt="Signature" className="max-h-32 w-auto rounded-xl" style={{ border: `1px solid ${S.border}` }} />
                <CheckCircle2 size={20} style={{ color: S.green }} />
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: S.muted }}>Client Signature</p>
                <p className="text-xs mb-3" style={{ color: S.muted }}>Hand the device to the client to sign.</p>
                <div className="rounded-xl overflow-hidden mb-3" style={{ border: `2px solid ${S.border}`, background: '#FAFAFA', touchAction: 'none' }}>
                  <canvas ref={canvasRef} width={600} height={200} className="w-full" style={{ cursor: 'crosshair', display: 'block' }}
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                </div>
                <input value={sigCaption} onChange={e => setSigCaption(e.target.value)}
                  placeholder="Client name" className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-3"
                  style={{ border: `1px solid ${S.border}`, color: S.text }} />
                <div className="flex gap-2">
                  <button onClick={() => { const ctx = canvasRef.current!.getContext('2d')!; ctx.clearRect(0, 0, 600, 200) }}
                    className="px-4 py-2 rounded-xl text-sm" style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                    Clear
                  </button>
                  <button onClick={() => void saveSignature()} disabled={sigSaving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: S.green }}>
                    {sigSaving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Save Signature
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
