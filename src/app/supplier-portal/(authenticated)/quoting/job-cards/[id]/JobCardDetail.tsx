'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Save, Trash2, Send, Plus, X, Camera, Pen,
  CheckCircle2, Clock, Play, XCircle, Loader2, Download,
  MapPin, User, Calendar, Briefcase, FileText, Wrench, Image as ImageIcon
} from 'lucide-react'
import type {
  ElecJobCard, ElecJobCardMaterial, ElecJobCardPhoto,
  ElecJobCardStatus, ElecJobCardType, ElecStaff, ElecClient
} from '@/lib/elec-types'
import { ClientCombobox } from '../../ClientCombobox'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string; icon: React.ElementType }> = {
  pending:     { bg: 'rgba(217,164,65,0.1)',  color: S.gold,    label: 'Pending',     icon: Clock },
  in_progress: { bg: 'rgba(58,124,165,0.1)',  color: S.accent,  label: 'In Progress', icon: Play },
  completed:   { bg: 'rgba(22,163,74,0.1)',   color: S.green,   label: 'Completed',   icon: CheckCircle2 },
  cancelled:   { bg: 'rgba(113,113,122,0.1)', color: S.muted,   label: 'Cancelled',   icon: XCircle },
}

const TYPE_LABEL: Record<string, string> = {
  maintenance: 'Maintenance', repair: 'Repair', once_off: 'Once-Off', callout: 'Callout',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>{label}</label>
      {children}
    </div>
  )
}

function Inp({ label, val, cb, placeholder, type = 'text' }: { label: string; val: string | null; cb: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <Field label={label}>
      <input type={type} value={val ?? ''} onChange={e => cb(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
    </Field>
  )
}

function Txt({ label, val, cb, placeholder, rows = 3 }: { label: string; val: string | null; cb: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <Field label={label}>
      <textarea value={val ?? ''} onChange={e => cb(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
        style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
    </Field>
  )
}

interface Props {
  jobCard: ElecJobCard
  staff: ElecStaff[]
  clients: ElecClient[]
  portalAccountId: string
  companyName: string
}

type Tab = 'details' | 'report' | 'materials' | 'photos' | 'signature'

export function JobCardDetail({ jobCard: initial, staff, clients: initialClients, portalAccountId, companyName }: Props) {
  const router = useRouter()
  const [card, setCard] = useState<ElecJobCard>(initial)
  const [clients, setClients] = useState<Pick<ElecClient, 'id' | 'client_name' | 'company'>[]>(initialClients)
  const [tab, setTab] = useState<Tab>('details')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [sendEmail, setSendEmail] = useState(card.client_email ?? card.client?.email ?? '')
  const [sendName, setSendName] = useState(card.client_name ?? card.client?.client_name ?? '')
  const [sendMsg, setSendMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<'success' | 'error' | ''>('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [signing, setSigning] = useState(false)
  const [sigCaption, setSigCaption] = useState('')
  const [sigSaving, setSigSaving] = useState(false)

  // Drawing state
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // ── persist helpers ─────────────────────────────────────────────────────────

  async function save(patch: Partial<ElecJobCard>) {
    setSaving(true); setSaveMsg('')
    try {
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      setCard(c => ({ ...c, ...patch }))
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch { setSaveMsg('Error saving') }
    finally { setSaving(false) }
  }

  function setField<K extends keyof ElecJobCard>(key: K, val: ElecJobCard[K]) {
    setCard(c => ({ ...c, [key]: val }))
  }

  async function handleStatusChange(status: ElecJobCardStatus) {
    const patch: Partial<ElecJobCard> = { status }
    if (status === 'in_progress' && !card.started_at) patch.started_at = new Date().toISOString()
    if (status === 'completed' && !card.completed_at) patch.completed_at = new Date().toISOString()
    await save(patch)
  }

  async function handleSave() {
    await save({
      title: card.title,
      job_type: card.job_type,
      staff_id: card.staff_id,
      client_id: card.client_id,
      client_name: card.client_name,
      client_email: card.client_email,
      location: card.location,
      scheduled_at: card.scheduled_at,
      work_description: card.work_description,
      work_found: card.work_found,
      work_done: card.work_done,
      resolution: card.resolution,
      notes: card.notes,
    })
  }

  async function handleDelete() {
    if (!confirm('Delete this job card? This cannot be undone.')) return
    setDeleting(true)
    await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}`, { method: 'DELETE' })
    router.push('/supplier-portal/quoting/job-cards')
  }

  // ── materials ───────────────────────────────────────────────────────────────

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

  // ── photos ──────────────────────────────────────────────────────────────────

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setPhotoUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const caption = ''
      if (caption) fd.append('caption', caption)
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/photos`, {
        method: 'POST', body: fd,
      })
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

  // ── signature canvas ─────────────────────────────────────────────────────────

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
    e.preventDefault()
    isDrawing.current = true
    lastPos.current = getCanvasPos(e)
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!isDrawing.current || !lastPos.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getCanvasPos(e)
    ctx.strokeStyle = '#18181B'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  function endDraw() { isDrawing.current = false; lastPos.current = null }

  function clearCanvas() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  async function saveSignature() {
    const canvas = canvasRef.current!
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
    if (!blob) return
    setSigSaving(true)
    const fd = new FormData()
    fd.append('file', blob, 'signature.png')
    fd.append('caption', sigCaption || 'Client signature')
    // Upload to photos endpoint then mark as signature
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/photos`, { method: 'POST', body: fd })
    if (res.ok) {
      const p = await res.json() as ElecJobCardPhoto
      // Save as client_signature_url
      await save({ client_signature_url: p.url })
      setCard(c => ({ ...c, client_signature_url: p.url }))
      setSigning(false)
      clearCanvas()
    }
    setSigSaving(false)
  }

  // ── send ────────────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!sendEmail) return
    setSending(true); setSendResult('')
    try {
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail, name: sendName || null, message: sendMsg || null }),
      })
      setSendResult(res.ok ? 'success' : 'error')
      if (res.ok) setCard(c => ({ ...c, sent_to_email: sendEmail, sent_to_name: sendName || null, sent_at: new Date().toISOString() }))
    } catch { setSendResult('error') }
    finally { setSending(false) }
  }

  const ss = STATUS_STYLE[card.status] ?? STATUS_STYLE.pending
  const StatusIcon = ss.icon
  const materials = card.materials ?? []
  const photos = card.photos ?? []
  const staffMember = !Array.isArray(card.staff) ? card.staff : null
  const totalMaterials = materials.reduce((a, m) => a + m.qty * (m.unit_price ?? 0), 0)

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'details',   label: 'Details',   icon: Briefcase },
    { key: 'report',    label: 'Report',    icon: FileText },
    { key: 'materials', label: 'Materials', icon: Wrench },
    { key: 'photos',    label: `Photos${photos.length > 0 ? ` (${photos.length})` : ''}`, icon: ImageIcon },
    { key: 'signature', label: 'Signature', icon: Pen },
  ]

  return (
    <div>
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/supplier-portal/quoting/job-cards')}
          className="flex items-center gap-2 text-sm" style={{ color: S.muted }}>
          <ArrowLeft size={16} /> Job Cards
        </button>
        <div className="flex items-center gap-2">
          {saveMsg && <span className="text-xs" style={{ color: saveMsg === 'Saved' ? S.green : S.danger }}>{saveMsg}</span>}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ border: `1px solid ${S.border}`, color: S.muted }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
          </button>
          <button onClick={() => setShowSend(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: S.accent }}>
            <Send size={13} /> Send to Client
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ border: `1px solid S.border`, color: S.danger }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono" style={{ color: S.muted }}>{card.job_number}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: S.bg, color: S.muted }}>{TYPE_LABEL[card.job_type]}</span>
            </div>
            <h1 className="text-lg font-bold truncate" style={{ color: S.text }}>{card.title}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs" style={{ color: S.muted }}>
              {card.location && <span className="flex items-center gap-1"><MapPin size={11} />{card.location}</span>}
              {card.scheduled_at && <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(card.scheduled_at)}</span>}
            </div>
          </div>
          {/* Status selector */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-right" style={{ color: S.muted }}>Status</p>
            <div className="flex flex-col gap-1">
              {(['pending', 'in_progress', 'completed', 'cancelled'] as ElecJobCardStatus[]).map(s => {
                const st = STATUS_STYLE[s]
                const Icon = st.icon
                const active = card.status === s
                return (
                  <button key={s}
                    onClick={() => void handleStatusChange(s)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-opacity"
                    style={{
                      background: active ? st.bg : 'transparent',
                      color: active ? st.color : S.muted,
                      border: `1px solid ${active ? st.color + '33' : S.border}`,
                      opacity: active ? 1 : 0.7,
                    }}>
                    <Icon size={11} />{st.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Created by / sent info */}
        <div className="mt-3 pt-3 flex items-center gap-4 text-xs flex-wrap" style={{ borderTop: `1px solid ${S.border}`, color: S.muted }}>
          <span className="flex items-center gap-1"><Clock size={10} />Created {fmtDate(card.created_at)}</span>
          {staffMember && <span className="flex items-center gap-1"><User size={10} />Created by {staffMember.name}</span>}
          {card.sent_at && (
            <span className="flex items-center gap-1">
              <Send size={10} />Sent to {card.sent_to_name ?? card.sent_to_email} on {fmtDate(card.sent_at)}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
              style={{
                background: active ? S.accent : S.card,
                color: active ? '#fff' : S.muted,
                border: `1px solid ${active ? S.accent : S.border}`,
              }}>
              <Icon size={13} />{t.label}
            </button>
          )
        })}
      </div>

      {/* Tab: Details */}
      {tab === 'details' && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <Inp label="Title" val={card.title} cb={v => setField('title', v)} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Job Type">
              <select value={card.job_type} onChange={e => setField('job_type', e.target.value as ElecJobCardType)}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ border: `1px solid ${S.border}`, color: S.text }}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Assign Technician">
              <select value={card.staff_id ?? ''} onChange={e => setField('staff_id', e.target.value || null)}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ border: `1px solid ${S.border}`, color: S.text }}>
                <option value="">Unassigned</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client">
              <ClientCombobox
                clientId={card.client_id ?? null}
                displayName={card.client_name ?? card.client?.client_name ?? ''}
                clients={clients}
                portalAccountId={portalAccountId}
                onChange={(id, name) => {
                  const existing = clients.find(c => c.id === id)
                  setCard(prev => ({
                    ...prev,
                    client_id: id,
                    client_name: name || null,
                    client_email: (existing as ElecClient | undefined)?.email ?? prev.client_email,
                  }))
                }}
                onNewClient={c => setClients(prev => [...prev, c])}
              />
            </Field>
            <Inp label="Client Email (for sending)" val={card.client_email} cb={v => setField('client_email', v || null)} placeholder="client@example.com" />
          </div>
          <Inp label="Location / Address" val={card.location} cb={v => setField('location', v || null)} placeholder="Site address" />
          <div className="grid grid-cols-2 gap-4">
            <Inp label="Scheduled Date & Time" val={card.scheduled_at ? card.scheduled_at.slice(0, 16) : ''} cb={v => setField('scheduled_at', v || null)} type="datetime-local" />
            <Inp label="Completed Date" val={card.completed_at ? card.completed_at.slice(0, 16) : ''} cb={v => setField('completed_at', v || null)} type="datetime-local" />
          </div>
          <Txt label="Work Description" val={card.work_description} cb={v => setField('work_description', v || null)} placeholder="Describe the work required…" rows={3} />
          <Txt label="Notes" val={card.notes} cb={v => setField('notes', v || null)} placeholder="Any additional notes…" rows={2} />
        </div>
      )}

      {/* Tab: Report */}
      {tab === 'report' && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <Txt label="What Was Found" val={card.work_found} cb={v => setField('work_found', v || null)} placeholder="Describe what the technician found on site…" rows={4} />
          <Txt label="Work Completed" val={card.work_done} cb={v => setField('work_done', v || null)} placeholder="Describe the work that was carried out…" rows={4} />
          <Txt label="Resolution" val={card.resolution} cb={v => setField('resolution', v || null)} placeholder="How was the issue resolved?" rows={3} />
        </div>
      )}

      {/* Tab: Materials */}
      {tab === 'materials' && (
        <div>
          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            {materials.length === 0 && (
              <div className="py-10 flex flex-col items-center gap-2">
                <Wrench size={28} style={{ color: S.border }} />
                <p className="text-sm" style={{ color: S.muted }}>No materials added yet</p>
              </div>
            )}
            {materials.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: S.text }}>{m.description}</p>
                  <p className="text-xs" style={{ color: S.muted }}>
                    Qty: {m.qty}{m.unit_price != null ? ` · R${m.unit_price.toFixed(2)} each` : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold" style={{ color: S.text }}>
                  {m.unit_price != null ? `R${(m.qty * m.unit_price).toFixed(2)}` : '—'}
                </p>
                <button onClick={() => void deleteMaterial(m.id)} style={{ color: S.muted }}>
                  <X size={14} />
                </button>
              </div>
            ))}
            {materials.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: `1px solid ${S.border}`, background: S.bg }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Total</p>
                <p className="text-sm font-bold" style={{ color: S.text }}>R{totalMaterials.toFixed(2)}</p>
              </div>
            )}
          </div>
          <button onClick={addMaterial}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ border: `1px solid ${S.border}`, color: S.accent }}>
            <Plus size={14} /> Add Material
          </button>
        </div>
      )}

      {/* Tab: Photos */}
      {tab === 'photos' && (
        <div>
          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {photos.map(p => (
                <div key={p.id} className="relative rounded-xl overflow-hidden group" style={{ aspectRatio: '4/3' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? 'Photo'} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-between p-2">
                    {p.caption && (
                      <span className="text-[10px] text-white opacity-0 group-hover:opacity-100 bg-black/50 px-1.5 py-0.5 rounded truncate max-w-[70%]">{p.caption}</span>
                    )}
                    <button onClick={() => void deletePhoto(p.id)}
                      className="opacity-0 group-hover:opacity-100 ml-auto w-6 h-6 rounded-full flex items-center justify-center text-white"
                      style={{ background: S.danger }}>
                      <X size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-2xl p-6 flex flex-col items-center gap-3" style={{ background: S.card, border: `2px dashed ${S.border}` }}>
            <Camera size={28} style={{ color: S.muted }} />
            <p className="text-sm" style={{ color: S.muted }}>{photoUploading ? 'Uploading…' : 'Add site photos'}</p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
              onChange={e => void handlePhotoUpload(e.target.files)} />
            <div className="flex gap-2">
              <button onClick={() => fileInputRef.current?.click()} disabled={photoUploading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                {photoUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                {photoUploading ? 'Uploading…' : 'Upload Photos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Signature */}
      {tab === 'signature' && (
        <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {card.client_signature_url && !signing ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Captured Signature</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.client_signature_url} alt="Signature" className="max-h-40 w-auto rounded-xl" style={{ border: `1px solid ${S.border}` }} />
              <button onClick={() => setSigning(true)}
                className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                Re-capture Signature
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: S.muted }}>Client Signature</p>
              <p className="text-xs mb-3" style={{ color: S.muted }}>Hand the device to the client to sign below.</p>
              <div className="rounded-xl overflow-hidden mb-3" style={{ border: `2px solid ${S.border}`, background: '#FAFAFA', touchAction: 'none' }}>
                <canvas
                  ref={canvasRef}
                  width={600} height={200}
                  className="w-full"
                  style={{ cursor: 'crosshair', display: 'block' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
              </div>
              <div className="mb-3">
                <input value={sigCaption} onChange={e => setSigCaption(e.target.value)}
                  placeholder="Client name (e.g. John Smith)"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${S.border}`, color: S.text }} />
              </div>
              <div className="flex gap-2">
                <button onClick={clearCanvas}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                  Clear
                </button>
                <button onClick={() => void saveSignature()} disabled={sigSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: S.green }}>
                  {sigSaving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Save Signature
                </button>
                {card.client_signature_url && (
                  <button onClick={() => setSigning(false)}
                    className="px-4 py-2 rounded-xl text-sm" style={{ color: S.muted }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Send modal */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: S.card }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold" style={{ color: S.text }}>Send Job Card</h2>
              <button onClick={() => { setShowSend(false); setSendResult('') }} style={{ color: S.muted }}><X size={18} /></button>
            </div>
            {sendResult === 'success' ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <CheckCircle2 size={36} style={{ color: S.green }} />
                <p className="text-sm font-semibold" style={{ color: S.text }}>Sent successfully!</p>
                <p className="text-xs" style={{ color: S.muted }}>Job card PDF sent to {sendEmail}</p>
                <button onClick={() => { setShowSend(false); setSendResult('') }}
                  className="mt-2 px-6 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Client Name</label>
                  <input value={sendName} onChange={e => setSendName(e.target.value)} placeholder="Client name"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Email Address *</label>
                  <input value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="client@example.com"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Message (optional)</label>
                  <textarea value={sendMsg} onChange={e => setSendMsg(e.target.value)} rows={3}
                    placeholder="Any message to include in the email…"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                    style={{ border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                {sendResult === 'error' && <p className="text-xs" style={{ color: S.danger }}>Failed to send. Please try again.</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowSend(false); setSendResult('') }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                    Cancel
                  </button>
                  <button onClick={() => void handleSend()} disabled={sending || !sendEmail}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: S.accent }}>
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {sending ? 'Sending…' : 'Send PDF'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
