'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Camera, Plus, X, Pen, CheckCircle2,
  Loader2, MapPin, Clock, Briefcase, Play, Square, ShoppingCart,
} from 'lucide-react'
import type { ElecJobCard, ElecJobCardMaterial, ElecJobCardPhoto, ElecMaterialRequest } from '@/lib/elec-types'
import { StaffBottomNav } from '../../StaffBottomNav'

function fmtElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

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
  jobsBadge?: number
  projectsBadge?: number
}

type Tab = 'report' | 'materials' | 'photos' | 'signature'

export function StaffJobCard({ jobCard: initial, staffName: _staffName, jobsBadge, projectsBadge }: Props) {
  const router = useRouter()
  const [card, setCard] = useState<ElecJobCard>(initial)
  const [tab, setTab] = useState<Tab>('report')
  const prevTab = useRef<Tab>('report')
  const [autoSaving, setAutoSaving] = useState(false)

  // Photo upload
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Signature draw
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sigCaption, setSigCaption] = useState('')
  const [sigSaving, setSigSaving] = useState(false)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const client = !Array.isArray(card.client) ? card.client : null

  // Job clock in/out
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [clockedInAt, setClockedInAt] = useState<Date | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [clockLoading, setClockLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = useCallback((since: Date) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setElapsedSeconds(Math.floor((Date.now() - since.getTime()) / 1000))
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - since.getTime()) / 1000))
    }, 1000)
  }, [])

  useEffect(() => {
    fetch('/api/supplier-portal/staff/punch')
      .then(r => r.json())
      .then((d: { isClockedIn: boolean; lastPunch: { punch_type: string; job_id: string | null; punched_at: string } | null }) => {
        if (d.isClockedIn && d.lastPunch?.job_id === card.id) {
          setIsClockedIn(true)
          const since = new Date(d.lastPunch.punched_at)
          setClockedInAt(since)
          startTimer(since)
        }
      })
      .catch(() => {})
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [card.id, startTimer])

  async function handleClockToggle() {
    if (clockLoading) return
    setClockLoading(true)
    const punch_type = isClockedIn ? 'clock_out' : 'clock_in'
    let latitude: number | undefined
    let longitude: number | undefined
    if (navigator.geolocation) {
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            timeout: 8000,
            maximumAge: 60000,
            enableHighAccuracy: !isIos,
          })
        )
        latitude = pos.coords.latitude
        longitude = pos.coords.longitude
      } catch {}
    }
    const res = await fetch('/api/supplier-portal/staff/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ punch_type, latitude, longitude, job_id: card.id }),
    })
    if (res.ok) {
      if (punch_type === 'clock_in') {
        const since = new Date()
        setIsClockedIn(true)
        setClockedInAt(since)
        startTimer(since)
      } else {
        setIsClockedIn(false)
        setClockedInAt(null)
        if (timerRef.current) clearInterval(timerRef.current)
        setElapsedSeconds(0)
      }
    }
    setClockLoading(false)
  }

  // Mark complete
  const [completing, setCompleting] = useState(false)
  const [completeMsg, setCompleteMsg] = useState('')

  // Materials inline form (Used — no pricing on staff side)
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [matDesc, setMatDesc] = useState('')
  const [matQty, setMatQty] = useState('1')
  const [matSaving, setMatSaving] = useState(false)

  // Material order requests (Need to Order)
  const [matOrders, setMatOrders] = useState<ElecMaterialRequest[]>([])
  const [matOrdersLoaded, setMatOrdersLoaded] = useState(false)
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [orderDesc, setOrderDesc] = useState('')
  const [orderQty, setOrderQty] = useState('1')
  const [orderSaving, setOrderSaving] = useState(false)

  useEffect(() => {
    if (tab === 'materials' && !matOrdersLoaded) {
      fetch(`/api/supplier-portal/quoting/material-requests?job_card_id=${card.id}`)
        .then(r => r.json())
        .then((d: ElecMaterialRequest[]) => { setMatOrders(d); setMatOrdersLoaded(true) })
        .catch(() => setMatOrdersLoaded(true))
    }
  }, [tab, card.id, matOrdersLoaded])

  async function addOrder() {
    if (!orderDesc.trim() || orderSaving) return
    setOrderSaving(true)
    const res = await fetch('/api/supplier-portal/quoting/material-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_type: 'job_card',
        job_card_id: card.id,
        description: orderDesc.trim(),
        qty: parseFloat(orderQty) || 1,
      }),
    })
    if (res.ok) {
      const m = await res.json() as ElecMaterialRequest
      setMatOrders(prev => [...prev, m])
      setOrderDesc(''); setOrderQty('1')
      setShowAddOrder(false)
    }
    setOrderSaving(false)
  }

  async function deleteOrder(orderId: string) {
    await fetch(`/api/supplier-portal/quoting/material-requests/${orderId}`, { method: 'DELETE' })
    setMatOrders(prev => prev.filter(o => o.id !== orderId))
  }

  // Auto-save report when navigating away from it
  useEffect(() => {
    if (prevTab.current === 'report' && tab !== 'report') {
      void autoSaveReport()
    }
    prevTab.current = tab
  }, [tab]) // eslint-disable-line

  async function autoSaveReport() {
    setAutoSaving(true)
    try {
      await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_found: card.work_found,
          work_done: card.work_done,
          resolution: card.resolution,
          notes: card.notes,
          status: card.status === 'pending' ? 'in_progress' : card.status,
        }),
      })
      if (card.status === 'pending') setCard(c => ({ ...c, status: 'in_progress' }))
    } catch {}
    setAutoSaving(false)
  }

  async function handleMarkComplete() {
    setCompleting(true)
    try {
      await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_found: card.work_found,
          work_done: card.work_done,
          resolution: card.resolution,
          notes: card.notes,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }),
      })
      setCard(c => ({ ...c, status: 'completed', completed_at: new Date().toISOString() }))
      setCompleteMsg('Job complete ✓ — returning home…')
      setTimeout(() => router.push('/supplier-portal/staff-home'), 1500)
    } catch { setCompleteMsg('Error — try again') }
    setCompleting(false)
  }

  async function addMaterial() {
    if (!matDesc.trim() || matSaving) return
    setMatSaving(true)
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/materials`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: matDesc.trim(),
        qty: parseFloat(matQty) || 1,
      }),
    })
    if (res.ok) {
      const m = await res.json() as ElecJobCardMaterial
      setCard(c => ({ ...c, materials: [...(c.materials ?? []), m] }))
      setMatDesc(''); setMatQty('1')
    }
    setMatSaving(false)
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

  function getCanvasPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDrawing.current = true; lastPos.current = getCanvasPos(e)
  }
  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
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
      const res2 = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_signature_url: p.url }),
      })
      if (res2.ok) setCard(c => ({ ...c, client_signature_url: p.url }))
    }
    setSigSaving(false)
  }

  const materials = card.materials ?? []
  const photos = (card.photos ?? []).filter(p => p.url !== card.client_signature_url)

  const STEPS: { key: Tab; label: string; done: boolean }[] = [
    { key: 'report',    label: 'Report',    done: !!(card.work_found || card.work_done) },
    { key: 'materials', label: 'Materials', done: materials.length > 0 },
    { key: 'photos',    label: 'Photos',    done: photos.length > 0 },
    { key: 'signature', label: 'Sign',      done: !!(card.client_signature_url || card.sent_at) },
  ]

  return (
    <div className="staff-portal min-h-screen pb-24" style={{ background: S.bg }}>
      {/* Header */}
      <div style={{ background: '#1E2A38' }} className="px-4 pt-10 pb-5">
        <button onClick={() => router.push('/supplier-portal/staff-home?tab=jobs')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold mb-4"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)' }}>
          <ArrowLeft size={15} /> My Jobs
        </button>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{card.job_number}</p>
            <h1 className="text-base font-bold text-white leading-snug">{card.title}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {card.location && (
                <a href={`https://www.google.com/maps/search/${encodeURIComponent(card.location)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1"
                  style={{ color: 'rgba(96,165,250,0.9)' }}
                  onClick={e => e.stopPropagation()}>
                  <MapPin size={10} />{card.location}
                </a>
              )}
              {card.scheduled_at && <span className="flex items-center gap-1"><Clock size={10} />{fmtDate(card.scheduled_at)}</span>}
              <span><Briefcase size={10} className="inline mr-0.5" />{TYPE_LABEL[card.job_type]}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {card.status === 'completed' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(22,163,74,0.2)', color: '#4ade80' }}>
                <CheckCircle2 size={11} /> Done
              </div>
            ) : (
              <button
                onClick={() => void handleClockToggle()}
                disabled={clockLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50"
                style={{
                  background: isClockedIn ? 'rgba(220,38,38,0.85)' : 'rgba(22,163,74,0.85)',
                  color: '#fff',
                  border: `1px solid ${isClockedIn ? 'rgba(220,38,38,0.5)' : 'rgba(22,163,74,0.5)'}`,
                }}>
                {clockLoading
                  ? <Loader2 size={12} className="animate-spin" />
                  : isClockedIn ? <Square size={12} /> : <Play size={12} />}
                {clockLoading ? '…' : isClockedIn ? 'Clock Out' : 'Clock In'}
              </button>
            )}
            {isClockedIn && (
              <span className="font-mono text-[11px] font-semibold tabular-nums"
                style={{ color: 'rgba(74,222,128,0.9)' }}>
                {fmtElapsed(elapsedSeconds)}
              </span>
            )}
          </div>
        </div>
        {(client?.client_name || card.client_name) && (
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Client: {client?.client_name ?? card.client_name}
          </p>
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

        {/* Auto-save indicator */}
        {autoSaving && (
          <p className="text-xs flex items-center gap-1.5" style={{ color: S.muted }}>
            <Loader2 size={11} className="animate-spin" /> Saving…
          </p>
        )}

        {/* ── REPORT TAB ── */}
        {tab === 'report' && (
          <div className="rounded-2xl p-4 space-y-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-xs" style={{ color: S.muted }}>Your report saves automatically when you move to the next step.</p>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>What Was Found</label>
              <textarea value={card.work_found ?? ''} onChange={e => setCard(c => ({ ...c, work_found: e.target.value || null }))}
                placeholder="Describe what you found on site…" rows={5}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Resolution</label>
              <textarea value={card.resolution ?? ''} onChange={e => setCard(c => ({ ...c, resolution: e.target.value || null }))}
                placeholder="How was the issue resolved?" rows={5}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }} />
            </div>
            <button onClick={() => setTab('materials')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: S.accent }}>
              Next: Materials →
            </button>
          </div>
        )}

        {/* ── MATERIALS TAB ── */}
        {tab === 'materials' && (
          <div className="space-y-4">

            {/* ── Need to Order ── */}
            <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${S.border}` }}>
                <div className="flex items-center gap-2">
                  <ShoppingCart size={14} style={{ color: S.accent }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: S.accent }}>Need to Order</span>
                  {matOrders.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(58,124,165,0.12)', color: S.accent }}>{matOrders.length}</span>
                  )}
                </div>
                {!showAddOrder && (
                  <button onClick={() => setShowAddOrder(true)}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ color: S.accent, border: `1px solid rgba(58,124,165,0.3)` }}>
                    <Plus size={11} /> Request
                  </button>
                )}
              </div>

              {matOrders.length === 0 && !showAddOrder && (
                <div className="py-6 flex flex-col items-center gap-1">
                  <p className="text-xs" style={{ color: S.muted }}>No materials requested yet</p>
                </div>
              )}

              {matOrders.map((o, i) => {
                const statusColor = o.status === 'received' ? S.green : o.status === 'ordered' ? S.accent : S.gold
                const statusLabel = o.status === 'received' ? 'Received' : o.status === 'ordered' ? 'Ordered' : 'Pending'
                return (
                  <div key={o.id} className="flex items-start gap-3 px-4 py-3"
                    style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: S.text }}>{o.description}</p>
                      <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                        {o.qty} {o.unit ?? 'nr'}{o.notes ? ` · ${o.notes}` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: `${statusColor}18`, color: statusColor }}>
                      {statusLabel}
                    </span>
                    {o.status === 'pending' && (
                      <button onClick={() => void deleteOrder(o.id)} style={{ color: S.muted, flexShrink: 0 }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )
              })}

              {showAddOrder && (
                <div className="px-4 py-3 space-y-2" style={{ borderTop: matOrders.length > 0 ? `1px solid ${S.border}` : undefined }}>
                  <input value={orderDesc} onChange={e => setOrderDesc(e.target.value)}
                    placeholder="Item (e.g. 20m 2.5mm cable)"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                  <input value={orderQty} onChange={e => setOrderQty(e.target.value)}
                    placeholder="Quantity" type="number" min="0.01" step="0.01"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowAddOrder(false); setOrderDesc(''); setOrderQty('1') }}
                      className="flex-1 py-2 rounded-xl text-sm" style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                      Cancel
                    </button>
                    <button onClick={() => void addOrder()} disabled={!orderDesc.trim() || orderSaving}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: S.accent }}>
                      {orderSaving ? <Loader2 size={13} className="animate-spin inline" /> : 'Send Request'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Materials Used / Charged ── */}
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
                    className="flex items-center gap-2 text-xs font-semibold"
                    style={{ color: S.accent }}>
                    <Plus size={12} /> Log Material Used
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => setTab('photos')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: S.accent }}>
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
                  <div key={p.id} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
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
            <button onClick={() => setTab('signature')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: S.accent }}>
              Next: Sign →
            </button>
          </div>
        )}

        {/* ── SIGNATURE TAB ── */}
        {tab === 'signature' && (
          <div className="space-y-4">

            {/* Already signed */}
            {card.client_signature_url ? (
              <div className="rounded-2xl p-5 flex flex-col items-center gap-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <CheckCircle2 size={28} style={{ color: S.green }} />
                <p className="text-sm font-semibold" style={{ color: S.text }}>Signature captured</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.client_signature_url} alt="Signature" className="max-h-28 w-auto rounded-xl" style={{ border: `1px solid ${S.border}` }} />
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <div className="px-4 pt-3 pb-1" style={{ borderBottom: `1px solid ${S.border}` }}>
                  <div className="flex items-center gap-2">
                    <Pen size={13} style={{ color: S.accent }} />
                    <span className="text-sm font-semibold" style={{ color: S.accent }}>Sign here</span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs" style={{ color: S.muted }}>Hand the device to the client to sign below.</p>
                  <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${S.border}`, background: '#FAFAFA' }}>
                    <canvas ref={canvasRef} width={600} height={200} className="w-full" style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                      onPointerDown={startDraw} onPointerMove={draw} onPointerUp={endDraw} onPointerLeave={endDraw} />
                  </div>
                  <input value={sigCaption} onChange={e => setSigCaption(e.target.value)}
                    placeholder="Client name (optional)"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }} />
                  <div className="flex gap-2">
                    <button onClick={() => { const ctx = canvasRef.current!.getContext('2d')!; ctx.clearRect(0, 0, 600, 200) }}
                      className="px-4 py-2.5 rounded-xl text-sm" style={{ border: `1px solid ${S.border}`, color: S.muted }}>
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
              </div>
            )}

            {/* Mark as Complete — always available on Sign tab */}
            {card.status !== 'completed' && (
              <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <p className="text-xs mb-3" style={{ color: S.muted }}>
                  {card.client_signature_url || card.sent_at
                    ? 'All done — mark this job as complete.'
                    : 'You can still mark complete without a signature.'}
                </p>
                {completeMsg ? (
                  <p className="text-sm font-semibold text-center py-2" style={{ color: S.green }}>{completeMsg}</p>
                ) : (
                  <button onClick={() => void handleMarkComplete()} disabled={completing}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: S.green }}>
                    {completing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {completing ? 'Saving…' : 'Mark Job as Complete'}
                  </button>
                )}
              </div>
            )}

            {card.status === 'completed' && (
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)' }}>
                <CheckCircle2 size={20} style={{ color: S.green }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: S.green }}>Job completed</p>
                  {card.completed_at && <p className="text-xs" style={{ color: S.muted }}>{fmtDate(card.completed_at)}</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <StaffBottomNav activeTab="jobs" jobsBadge={jobsBadge} projectsBadge={projectsBadge} />
    </div>
  )
}
