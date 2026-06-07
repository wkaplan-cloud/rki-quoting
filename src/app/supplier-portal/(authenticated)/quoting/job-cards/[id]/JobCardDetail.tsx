'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Send, Plus, X, Camera, Pen,
  CheckCircle2, Check, Clock, Play, XCircle, Loader2,
  MapPin, User, Calendar, Briefcase, FileText, Wrench, Image as ImageIcon,
  ChevronDown, Upload, MoreHorizontal, ClipboardCheck, Edit2, Trash2,
  Download, Printer, ShoppingCart, PackageCheck, ReceiptText,
} from 'lucide-react'
import type {
  ElecJobCard, ElecJobCardMaterial, ElecJobCardPhoto,
  ElecJobCardStatus, ElecJobCardType, ElecStaff, ElecClient,
  ElecMaterialRequest, ElecMaterialRequestStatus,
} from '@/lib/elec-types'
import { ClientCombobox } from '../../ClientCombobox'
import { StaffMultiSelect } from '../../StaffMultiSelect'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string; icon: React.ElementType }> = {
  pending:     { bg: 'rgba(217,164,65,0.12)',  color: S.gold,    label: 'Pending',     icon: Clock        },
  in_progress: { bg: 'rgba(58,124,165,0.12)',  color: S.accent,  label: 'In Progress', icon: Play         },
  completed:   { bg: 'rgba(22,163,74,0.12)',   color: S.green,   label: 'Completed',   icon: CheckCircle2 },
  cancelled:   { bg: 'rgba(113,113,122,0.12)', color: S.muted,   label: 'Cancelled',   icon: XCircle      },
}

const TYPE_LABEL: Record<string, string> = {
  maintenance: 'Maintenance', repair: 'Repair', once_off: 'Once-Off', callout: 'Callout',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Form primitives ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest shrink-0" style={{ color: '#B0B8C4' }}>{label}</p>
      <div className="flex-1 h-px" style={{ background: S.border }} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>{label}</label>
      {children}
    </div>
  )
}

function Inp({ label, val, cb, placeholder, type = 'text' }: {
  label: string; val: string | null; cb: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <Field label={label}>
      <input type={type} value={val ?? ''} onChange={e => cb(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
    </Field>
  )
}

function Txt({ label, val, cb, placeholder, rows = 3 }: {
  label: string; val: string | null; cb: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <Field label={label}>
      <textarea value={val ?? ''} onChange={e => cb(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
        style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
    </Field>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  jobCard: ElecJobCard
  staff: ElecStaff[]
  clients: ElecClient[]
  portalAccountId: string
  companyName: string
  vatRate?: number
  sageConnected?: boolean
}

type Tab = 'details' | 'report' | 'materials' | 'job_sheet' | 'photos' | 'signature'

// ── Component ─────────────────────────────────────────────────────────────────

export function JobCardDetail({ jobCard: initial, staff, clients: initialClients, portalAccountId, companyName, vatRate = 15, sageConnected = false }: Props) {
  const router = useRouter()
  const [card, setCard] = useState<ElecJobCard>(initial)
  const [clients, setClients] = useState<Pick<ElecClient, 'id' | 'client_name' | 'company' | 'email' | 'address' | 'vat_number' | 'qs_name' | 'qs_email'>[]>(initialClients)
  const initClient = initialClients.find(c => c.id === initial.client_id)
  const [clientCompany, setClientCompany] = useState(initClient?.company ?? '')
  const [clientQsName, setClientQsName] = useState(initClient?.qs_name ?? '')
  const [clientQsEmail, setClientQsEmail] = useState(initClient?.qs_email ?? '')
  const [clientVatNumber, setClientVatNumber] = useState(initClient?.vat_number ?? '')
  const [tab, setTab] = useState<Tab>('job_sheet')

  // UI state
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showFinishFlow, setShowFinishFlow] = useState(false)

  // Download / print
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    const win = window.open('', '_blank')
    if (win) win.location.href = `/api/supplier-portal/quoting/job-cards/${card.id}/pdf`
    setDownloading(false)
  }

  async function handlePrint() {
    const win = window.open(`/api/supplier-portal/quoting/job-cards/${card.id}/pdf?inline=1`, '_blank')
    if (win) win.focus()
  }

  // Send state
  const [showSend, setShowSend] = useState(false)
  const [sendEmail, setSendEmail] = useState(card.client_email ?? card.client?.email ?? '')
  const [sendName, setSendName] = useState(card.client_name ?? card.client?.client_name ?? '')
  const [sendMsg, setSendMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<'success' | 'error' | ''>('')

  // Sage
  const [showSagePush, setShowSagePush] = useState(false)
  const [sageCustomers, setSageCustomers] = useState<{ id: string; name: string }[]>([])
  const [sageCustomersLoaded, setSageCustomersLoaded] = useState(false)
  const [sageSelectedCustomer, setSageSelectedCustomer] = useState<{ id: string; name: string } | null>(null)
  const [sagePushing, setSagePushing] = useState(false)
  const [sageError, setSageError] = useState('')
  const [sagePushResult, setSagePushResult] = useState<{ ok: boolean; total_incl_vat?: number } | null>(null)

  // Staff time for this job — polls every 10s
  const [jobPunches, setJobPunches] = useState<{ id: string; staff_id: string; punch_type: string; punched_at: string; staff: { id: string; name: string; color: string } | null }[]>([])
  useEffect(() => {
    let alive = true
    async function fetchPunches() {
      try {
        const r = await fetch(`/api/supplier-portal/quoting/job-cards/${initial.id}/time`)
        const d = await r.json() as unknown
        if (!alive) return
        if (Array.isArray(d)) setJobPunches(d)
      } catch {}
    }
    void fetchPunches()
    const id = setInterval(() => { void fetchPunches() }, 10_000)
    return () => { alive = false; clearInterval(id) }
  }, [initial.id])

  // Materials — inline form
  const [newMat, setNewMat] = useState<{ desc: string; qty: string; price: string; cost: string; markup: string } | null>(null)
  const [editingMatId, setEditingMatId] = useState<string | null>(null)
  const [editingMat, setEditingMat] = useState({ desc: '', qty: '', price: '', cost: '', markup: '' })
  const [matSaving, setMatSaving] = useState(false)

  // Material order requests (from staff)
  const [matOrders, setMatOrders] = useState<ElecMaterialRequest[]>([])
  const [matOrdersLoaded, setMatOrdersLoaded] = useState(false)
  const [matOrderUpdating, setMatOrderUpdating] = useState<string | null>(null)
  const [matOrderSupplier, setMatOrderSupplier] = useState<Record<string, string>>({})
  const [sentToJobSheet, setSentToJobSheet] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (tab === 'materials' && !matOrdersLoaded) {
      fetch(`/api/supplier-portal/quoting/material-requests?job_card_id=${initial.id}`)
        .then(r => r.json())
        .then((d: ElecMaterialRequest[]) => { setMatOrders(d); setMatOrdersLoaded(true) })
        .catch(() => setMatOrdersLoaded(true))
    }
  }, [tab, initial.id, matOrdersLoaded])

  async function updateOrderStatus(req: ElecMaterialRequest, newStatus: ElecMaterialRequestStatus) {
    setMatOrderUpdating(req.id)
    const body: Record<string, unknown> = { status: newStatus }
    if (matOrderSupplier[req.id]) body.supplier = matOrderSupplier[req.id]
    const res = await fetch(`/api/supplier-portal/quoting/material-requests/${req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const updated = await res.json() as ElecMaterialRequest
      setMatOrders(prev => prev.map(r => r.id === req.id ? updated : r))

      // Auto-add to job sheet materials when received
      if (newStatus === 'received') {
        const matRes = await fetch(`/api/supplier-portal/quoting/job-cards/${initial.id}/materials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: req.description,
            qty: req.qty,
            unit_price: null,
            cost_price: null,
          }),
        })
        if (matRes.ok) {
          const m = await matRes.json() as ElecJobCardMaterial
          setCard(c => ({ ...c, materials: [...(c.materials ?? []), m] }))
          setSentToJobSheet(prev => new Set(prev).add(req.id))
        }
      }
    }
    setMatOrderUpdating(null)
  }

  // Photos
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Signature
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [signing, setSigning] = useState(false)
  const [sigCaption, setSigCaption] = useState('')
  const [sigSaving, setSigSaving] = useState(false)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // ── Persist helpers ───────────────────────────────────────────────────────

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
    setShowStatusMenu(false)
  }

  // Use a ref so the auto-save timer always calls with the latest data
  const autoSaveDataRef = useRef({ card, clientCompany, clientQsName, clientQsEmail, clientVatNumber })
  useEffect(() => { autoSaveDataRef.current = { card, clientCompany, clientQsName, clientQsEmail, clientVatNumber } }, [card, clientCompany, clientQsName, clientQsEmail, clientVatNumber])

  const handleSave = useCallback(async () => {
    const { card, clientCompany, clientQsName, clientQsEmail, clientVatNumber } = autoSaveDataRef.current
    await save({
      title: card.title,
      job_type: card.job_type,
      staff_id: card.staff_id,
      additional_staff_ids: card.additional_staff_ids ?? [],
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
      callout_fee: card.callout_fee,
      labour_hours: card.labour_hours,
      labour_rate: card.labour_rate,
    })
    if (card.client_id) {
      const patch: Record<string, string | null> = {}
      if (card.client_email?.trim()) patch.email = card.client_email.trim()
      if (card.location?.trim()) patch.address = card.location.trim()
      if (clientCompany.trim()) patch.company = clientCompany.trim()
      if (clientQsName.trim()) patch.qs_name = clientQsName.trim()
      if (clientQsEmail.trim()) patch.qs_email = clientQsEmail.trim()
      patch.vat_number = clientVatNumber.trim() || null
      if (Object.keys(patch).length > 0) {
        fetch(`/api/supplier-portal/quoting/clients/${card.client_id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
        })
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save: 1.5s debounce after any editable field changes
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isMountRef = useRef(true)
  useEffect(() => {
    if (isMountRef.current) { isMountRef.current = false; return }
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => void handleSave(), 1500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    card.title, card.job_type, card.staff_id, card.additional_staff_ids?.join(','), card.client_id, card.client_name,
    card.client_email, card.location, card.scheduled_at, card.work_description,
    card.work_found, card.work_done, card.resolution, card.notes,
    card.callout_fee, card.labour_hours, card.labour_rate,
    clientCompany, clientQsName, clientQsEmail, clientVatNumber,
  ])

  async function handleDelete() {
    if (!confirm('Delete this job card? This cannot be undone.')) return
    setDeleting(true)
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Delete failed'); setDeleting(false); return }
    router.push('/supplier-portal/quoting/job-cards')
  }

  // ── Materials ─────────────────────────────────────────────────────────────

  function computeSell(cost: string, markup: string): string {
    const c = parseFloat(cost); const m = parseFloat(markup)
    if (isNaN(c) || isNaN(m)) return ''
    return (c * (1 + m / 100)).toFixed(2)
  }
  function computeMarkup(cost: string, sell: string): string {
    const c = parseFloat(cost); const s = parseFloat(sell)
    if (isNaN(c) || isNaN(s) || c === 0) return ''
    return (((s - c) / c) * 100).toFixed(1)
  }

  async function saveMaterial() {
    if (!newMat || !newMat.desc.trim()) return
    setMatSaving(true)
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/materials`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: newMat.desc.trim(),
        qty: parseFloat(newMat.qty) || 1,
        unit_price: newMat.price !== '' ? parseFloat(newMat.price) : null,
        cost_price: newMat.cost !== '' ? parseFloat(newMat.cost) : null,
      }),
    })
    if (res.ok) {
      const m = await res.json() as ElecJobCardMaterial
      setCard(c => ({ ...c, materials: [...(c.materials ?? []), m] }))
      setNewMat(null)
    }
    setMatSaving(false)
  }

  function startEditMaterial(m: ElecJobCardMaterial) {
    setEditingMatId(m.id)
    const cost = m.cost_price != null ? String(m.cost_price) : ''
    const sell = m.unit_price != null ? String(m.unit_price) : ''
    const markup = cost && sell ? computeMarkup(cost, sell) : ''
    setEditingMat({ desc: m.description, qty: String(m.qty), price: sell, cost, markup })
  }

  async function updateMaterial() {
    if (!editingMatId) return
    setMatSaving(true)
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/materials/${editingMatId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: editingMat.desc.trim(),
        qty: parseFloat(editingMat.qty) || 1,
        unit_price: editingMat.price !== '' ? parseFloat(editingMat.price) : null,
        cost_price: editingMat.cost !== '' ? parseFloat(editingMat.cost) : null,
      }),
    })
    if (res.ok) {
      const updated = (await res.json() as { ok: boolean; material: ElecJobCardMaterial }).material
      setCard(c => ({ ...c, materials: (c.materials ?? []).map(m => m.id === editingMatId ? updated : m) }))
      setEditingMatId(null)
    }
    setMatSaving(false)
  }

  async function deleteMaterial(matId: string) {
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/materials/${matId}`, { method: 'DELETE' })
    if (!res.ok) { alert('Failed to delete material'); return }
    setCard(c => ({ ...c, materials: (c.materials ?? []).filter(m => m.id !== matId) }))
    if (editingMatId === matId) setEditingMatId(null)
  }

  // ── Photos ────────────────────────────────────────────────────────────────

  async function compressImage(file: File, maxWidth = 1920, quality = 0.82): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img')
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compression failed')), 'image/jpeg', quality)
      }
      img.onerror = reject
      img.src = url
    })
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setPhotoUploading(true)
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed, file.name.replace(/\.[^.]+$/, '.jpg'))
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/photos`, { method: 'POST', body: fd })
      if (res.ok) {
        const p = await res.json() as ElecJobCardPhoto
        setCard(c => ({ ...c, photos: [...(c.photos ?? []), p] }))
      }
    }
    setPhotoUploading(false)
  }

  async function deletePhoto(photoId: string) {
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/photos/${photoId}`, { method: 'DELETE' })
    if (!res.ok) { alert('Failed to delete photo'); return }
    setCard(c => ({ ...c, photos: (c.photos ?? []).filter(p => p.id !== photoId) }))
  }

  // ── Signature canvas ──────────────────────────────────────────────────────

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

  function clearCanvas() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
  }

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
      setCard(c => ({ ...c, client_signature_url: p.url }))
      setSigning(false); clearCanvas()
    }
    setSigSaving(false)
  }

  // ── Send / Sage ───────────────────────────────────────────────────────────

  async function handleSend() {
    if (!sendEmail) return
    setSending(true); setSendResult('')
    try {
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail, name: sendName || null, message: sendMsg || null, as_invoice: false, client_company: clientCompany.trim() || null, client_qs_name: clientQsName.trim() || null, client_qs_email: clientQsEmail.trim() || null }),
      })
      setSendResult(res.ok ? 'success' : 'error')
      if (res.ok) setCard(c => ({ ...c, sent_to_email: sendEmail, sent_to_name: sendName || null, sent_at: new Date().toISOString(), client_email: sendEmail }))
    } catch { setSendResult('error') }
    finally { setSending(false) }
  }

  async function openSagePush() {
    setSageError(''); setSageSelectedCustomer(null); setSagePushResult(null); setShowSagePush(true)
    if (!sageCustomersLoaded) {
      const res = await fetch('/api/supplier-portal/quoting/sage/customers')
      const data = await res.json()
      if (res.ok) { setSageCustomers(data.customers ?? []); setSageCustomersLoaded(true) }
      else setSageError(data.error ?? 'Failed to load customers')
    }
  }

  async function handleSagePush() {
    if (!sageSelectedCustomer) { setSageError('Select a Sage customer'); return }
    setSagePushing(true); setSageError('')
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/push-sage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sageCustomerId: sageSelectedCustomer.id, sageCustomerName: sageSelectedCustomer.name }),
    })
    const data = await res.json()
    setSagePushing(false)
    if (!res.ok) { setSageError(data.error ?? 'Push failed'); return }
    setSagePushResult({ ok: true, total_incl_vat: data.total_incl_vat })
    setCard(c => ({ ...c, sage_invoice_id: String(data.sage_invoice_id), sage_invoice_status: String(data.sage_invoice_status), sage_customer_name: sageSelectedCustomer.name }))
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const ss = STATUS_STYLE[card.status] ?? STATUS_STYLE.pending
  const StatusIcon = ss.icon
  const materials = card.materials ?? []
  const photos = (card.photos ?? []).filter(p => p.url !== card.client_signature_url)
  const staffMember = !Array.isArray(card.staff) ? card.staff : null
  const totalMaterials = materials.reduce((a, m) => a + m.qty * (m.unit_price ?? 0), 0)
  const totalMaterialsCost = materials.reduce((a, m) => a + m.qty * (m.cost_price ?? 0), 0)
  const labourCharge = (card.labour_hours ?? 0) * (card.labour_rate ?? 0)
  const totalCharge = (card.callout_fee ?? 0) + labourCharge + totalMaterials
  const jobProfit = (totalMaterials - totalMaterialsCost) + labourCharge + (card.callout_fee ?? 0)
  const canFinish = card.status !== 'completed' && card.status !== 'cancelled'

  // Staff time summary (shared by header compact strip + Job Sheet full table)
  function fmtDur(ms: number) {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }
  const staffSummary = (() => {
    const byStaff: Record<string, { name: string; color: string; sessions: { in: Date; out: Date | null }[]; lastPunchType: string }> = {}
    const openSessions: Record<string, Date> = {}
    for (const p of jobPunches) { // sorted by punched_at ASC from API
      const staffObj = !Array.isArray(p.staff) ? p.staff : null
      const name = staffObj?.name ?? 'Unknown'
      const color = staffObj?.color ?? S.accent
      if (!byStaff[p.staff_id]) byStaff[p.staff_id] = { name, color, sessions: [], lastPunchType: '' }
      byStaff[p.staff_id].lastPunchType = p.punch_type // track last punch — ground truth for on-site status
      if (p.punch_type === 'clock_in') {
        openSessions[p.staff_id] = new Date(p.punched_at)
      } else if (p.punch_type === 'clock_out' && openSessions[p.staff_id]) {
        byStaff[p.staff_id].sessions.push({ in: openSessions[p.staff_id], out: new Date(p.punched_at) })
        delete openSessions[p.staff_id]
      }
    }
    for (const [staffId, inTime] of Object.entries(openSessions)) {
      byStaff[staffId]?.sessions.push({ in: inTime, out: null })
    }
    return Object.values(byStaff).map(s => ({ ...s, onSite: s.lastPunchType === 'clock_in' }))
  })()

  // Finish job checklist
  const checklist = [
    { label: 'Report filled in',    done: !!(card.work_found?.trim() || card.work_done?.trim()), tab: 'report'    as Tab },
    { label: 'Materials logged',     done: materials.length > 0,                                  tab: 'materials' as Tab },
    { label: 'Photos taken',         done: photos.length > 0,                                     tab: 'photos'    as Tab },
    { label: 'Client signature',     done: !!card.client_signature_url,                            tab: 'signature' as Tab },
  ]
  const checklistDoneCount = checklist.filter(c => c.done).length

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'details',   label: 'Details',   icon: Briefcase   },
    { key: 'report',    label: 'Report',    icon: FileText    },
    { key: 'materials', label: 'Materials', icon: ShoppingCart },
    { key: 'job_sheet', label: `Job Sheet${materials.length > 0 ? ` (${materials.length})` : ''}`, icon: ReceiptText },
    { key: 'photos',    label: `Photos${photos.length > 0 ? ` (${photos.length})` : ''}`,          icon: ImageIcon  },
    { key: 'signature', label: 'Signature', icon: Pen         },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <button onClick={() => router.push('/supplier-portal/quoting/job-cards')}
          className="flex items-center gap-1.5 text-sm font-medium" style={{ color: S.muted }}
          onMouseEnter={e => e.currentTarget.style.color = S.text}
          onMouseLeave={e => e.currentTarget.style.color = S.muted}>
          <ArrowLeft size={15} /> Job Cards
        </button>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs" style={{ color: S.muted }}>Saving…</span>}
          {!saving && saveMsg && <span className="text-xs" style={{ color: saveMsg === 'Saved' ? S.green : S.danger }}>{saveMsg}</span>}
          {/* Mark Complete */}
          {card.status === 'in_progress' && (
            <button onClick={() => void handleStatusChange('completed')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: S.green }}>
              <Check size={13} /> Mark Complete
            </button>
          )}
          {/* Send */}
          <button onClick={() => { setSendEmail(card.client_email ?? card.client?.email ?? ''); setShowSend(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: S.accent }}>
            <Send size={13} /> Send
          </button>
          {/* Overflow */}
          <div className="relative">
            <button onClick={() => setShowMoreMenu(m => !m)}
              className="flex items-center px-2.5 py-1.5 rounded-lg"
              style={{ border: `1px solid ${S.border}`, color: S.muted, background: S.card }}>
              <MoreHorizontal size={15} />
            </button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 rounded-xl shadow-lg py-1 min-w-[160px]"
                  style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <button onClick={() => { setShowMoreMenu(false); void handleDownload() }} disabled={downloading}
                    className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50"
                    style={{ color: S.text }}>
                    <Download size={14} /> Download PDF
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); handlePrint() }}
                    className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
                    style={{ color: S.text }}>
                    <Printer size={14} /> Print
                  </button>
                  {sageConnected && (
                    <button onClick={() => { setShowMoreMenu(false); void openSagePush() }}
                      className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
                      style={{ color: S.text }}>
                      <Upload size={14} /> Push to Sage
                    </button>
                  )}
                  <div style={{ borderTop: `1px solid ${S.border}`, margin: '4px 0' }} />
                  <button onClick={() => { setShowMoreMenu(false); void handleDelete() }} disabled={deleting}
                    className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50"
                    style={{ color: S.danger }}>
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono mb-1" style={{ color: S.muted }}>{card.job_number} · {TYPE_LABEL[card.job_type]}</p>
            <h1 className="text-xl font-bold leading-snug" style={{ color: S.text }}>{card.title}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-sm flex-wrap" style={{ color: S.muted }}>
              {(card.client_name ?? card.client?.client_name) && <span style={{ color: S.text, fontWeight: 500 }}>{card.client_name ?? card.client?.client_name}</span>}
              {card.location && <span className="flex items-center gap-1"><MapPin size={12} />{card.location}</span>}
              {card.scheduled_at && <span className="flex items-center gap-1"><Calendar size={12} />{fmtDate(card.scheduled_at)}</span>}
            </div>
          </div>
          {/* Status dropdown */}
          <div className="relative shrink-0">
            <button onClick={() => setShowStatusMenu(m => !m)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}33` }}>
              <StatusIcon size={12} />{ss.label}<ChevronDown size={10} style={{ opacity: 0.6 }} />
            </button>
            {showStatusMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 rounded-xl shadow-lg py-1 min-w-[152px]"
                  style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  {(['pending', 'in_progress', 'completed', 'cancelled'] as ElecJobCardStatus[]).map(s => {
                    const st = STATUS_STYLE[s]
                    const Icon = st.icon
                    const isCurrent = card.status === s
                    return (
                      <button key={s}
                        onClick={() => void handleStatusChange(s)}
                        className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50"
                        style={{ color: isCurrent ? st.color : S.text, fontWeight: isCurrent ? 600 : 400 }}>
                        <Icon size={13} style={{ color: st.color }} />
                        {st.label}
                        {isCurrent && <span className="ml-auto text-[9px]">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {(staffMember || staffSummary.length > 0) && (
              <div className="flex flex-col items-end gap-1.5 mt-2">
                {(() => {
                  const items: { key: string; name: string; color: string; onSite: boolean; totalMs: number }[] = []
                  if (staffMember) {
                    const punch = staffSummary.find(s => s.name === staffMember.name)
                    const totalMs = punch ? punch.sessions.reduce((a, ses) => a + (ses.out ? ses.out.getTime() - ses.in.getTime() : Date.now() - ses.in.getTime()), 0) : 0
                    items.push({ key: staffMember.id, name: staffMember.name, color: staffMember.color, onSite: punch?.onSite ?? false, totalMs })
                  }
                  for (const s of staffSummary) {
                    if (!items.find(i => i.name === s.name)) {
                      const totalMs = s.sessions.reduce((a, ses) => a + (ses.out ? ses.out.getTime() - ses.in.getTime() : Date.now() - ses.in.getTime()), 0)
                      items.push({ key: s.name, name: s.name, color: s.color, onSite: s.onSite, totalMs })
                    }
                  }
                  return items.map(({ key, name, color, onSite, totalMs }) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: onSite ? '#16A34A' : '#DC2626' }}
                        title={onSite ? 'On site' : 'Not on site'} />
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                        style={{ background: color }}>
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium" style={{ color: S.text }}>{name}</span>
                      {totalMs > 0 && <span className="text-xs font-mono font-semibold" style={{ color: S.accent }}>{fmtDur(totalMs)}</span>}
                    </div>
                  ))
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Staff time — compact row */}
        {staffSummary.length > 0 && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {staffSummary.map(({ name, color, sessions, onSite }) => {
              const totalMs = sessions.reduce((s, ses) => s + (ses.out ? ses.out.getTime() - ses.in.getTime() : Date.now() - ses.in.getTime()), 0)
              return (
                <div key={name} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${onSite ? 'bg-green-500' : ''}`} style={!onSite ? { background: S.border } : {}} />
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                    style={{ background: color }}>{name.slice(0, 1)}</div>
                  <span className="text-xs" style={{ color: S.muted }}>{name}</span>
                  <span className="text-xs font-mono font-semibold" style={{ color: S.accent }}>{fmtDur(totalMs)}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: S.muted }}>
          <span>{fmtDate(card.created_at)}</span>
          {(card.created_by_name ?? staffMember?.name) && <span>· {card.created_by_name ?? staffMember?.name}</span>}
          {card.sent_at && <span>· Sent {fmtDate(card.sent_at)}</span>}
        </div>
      </div>

      {/* ── Tabs — flat, clean ───────────────────────────────────────────── */}
      <div className="flex gap-0 mb-6" style={{ borderBottom: `1px solid ${S.border}` }}>
        {/* Job Sheet — primary tab, separated from the rest */}
        {(() => {
          const active = tab === 'job_sheet'
          return (
            <button onClick={() => setTab('job_sheet')}
              className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap relative mr-8"
              style={{ color: active ? S.text : S.muted }}>
              Job Sheet
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: S.accent }} />}
            </button>
          )
        })()}
        {/* Secondary tabs */}
        {([
          { key: 'details',   label: 'Details'   },
          { key: 'report',    label: 'Report'     },
          { key: 'materials', label: `Orders${matOrders.length > 0 ? ` (${matOrders.length})` : ''}` },
          { key: 'photos',    label: `Photos${photos.length > 0 ? ` (${photos.length})` : ''}` },
          { key: 'signature', label: 'Signature'  },
        ] as { key: Tab; label: string }[]).map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2.5 text-sm font-medium whitespace-nowrap relative"
              style={{ color: active ? S.text : S.muted }}>
              {t.label}
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: S.accent }} />}
            </button>
          )
        })}
      </div>

      {/* ── Tab: Details (grouped) ───────────────────────────────────────── */}
      {tab === 'details' && (
        <div className="rounded-2xl p-5 space-y-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>

          <SectionHeader label="Job Info" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Job Type">
              <select value={card.job_type} onChange={e => setField('job_type', e.target.value as ElecJobCardType)}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ border: `1px solid ${S.border}`, color: S.text }}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Technicians">
              <StaffMultiSelect
                selectedIds={[
                  ...(card.staff_id ? [card.staff_id] : []),
                  ...(card.additional_staff_ids ?? []),
                ]}
                staff={staff}
                onChange={ids => setCard(c => ({
                  ...c,
                  staff_id: ids[0] ?? null,
                  additional_staff_ids: ids.slice(1),
                }))}
              />
            </Field>
          </div>
          <Txt label="Work Description" val={card.work_description} cb={v => setField('work_description', v || null)} placeholder="Describe the work required…" rows={3} />

          <SectionHeader label="Client & Billing" />
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
                    title: name || prev.title,
                    client_email: existing?.email ?? prev.client_email,
                    location: prev.location || existing?.address || prev.location,
                  }))
                  setClientCompany(existing?.company ?? '')
                  setClientQsName(existing?.qs_name ?? '')
                  setClientQsEmail(existing?.qs_email ?? '')
                  setClientVatNumber(existing?.vat_number ?? '')
                }}
                onNewClient={c => setClients(prev => [...prev, { ...c, email: null, address: null, vat_number: null, qs_name: null, qs_email: null }])}
              />
            </Field>
            <Inp label="Client Email" val={card.client_email} cb={v => setField('client_email', v || null)} placeholder="client@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company Name">
              <input value={clientCompany} onChange={e => setClientCompany(e.target.value)}
                placeholder="Client company"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
            </Field>
            <Field label="Tax / VAT Number">
              <input value={clientVatNumber} onChange={e => setClientVatNumber(e.target.value)}
                placeholder="4123456789"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
            </Field>
            <Field label="QS Name">
              <input value={clientQsName} onChange={e => setClientQsName(e.target.value)}
                placeholder="Quantity surveyor"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
            </Field>
            <Field label="QS Email">
              <input type="email" value={clientQsEmail} onChange={e => setClientQsEmail(e.target.value)}
                placeholder="qs@example.com"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
            </Field>
          </div>

          <SectionHeader label="Scheduling" />
          <Inp label="Location / Address" val={card.location} cb={v => setField('location', v || null)} placeholder="Site address" />
          <div className="grid grid-cols-2 gap-4">
            <Inp label="Scheduled Date & Time" val={card.scheduled_at ? card.scheduled_at.slice(0, 16) : ''} cb={v => setField('scheduled_at', v || null)} type="datetime-local" />
            <Inp label="Completed Date" val={card.completed_at ? card.completed_at.slice(0, 16) : ''} cb={v => setField('completed_at', v || null)} type="datetime-local" />
          </div>
          <Txt label="Notes" val={card.notes} cb={v => setField('notes', v || null)} placeholder="Any additional notes…" rows={2} />
        </div>
      )}

      {/* ── Tab: Report ──────────────────────────────────────────────────── */}
      {tab === 'report' && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <Txt label="What Was Found" val={card.work_found} cb={v => setField('work_found', v || null)} placeholder="Describe what the technician found on site…" rows={5} />
          <Txt label="Resolution" val={card.resolution} cb={v => setField('resolution', v || null)} placeholder="How was the issue resolved?" rows={5} />
        </div>
      )}

      {/* ── Tab: Materials ───────────────────────────────────────────────── */}
      {tab === 'materials' && (
        <div>
          {/* ── Staff Material Order Requests ── */}
          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${S.border}` }}>
              <p className="text-sm font-semibold" style={{ color: S.text }}>Material Orders</p>
              {matOrders.filter(o => o.status === 'pending').length > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(217,164,65,0.12)', color: S.gold }}>
                  {matOrders.filter(o => o.status === 'pending').length} pending
                </span>
              )}
            </div>

            {!matOrdersLoaded && (
              <div className="py-8 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin" style={{ color: S.muted }} />
              </div>
            )}

            {matOrdersLoaded && matOrders.length === 0 && (
              <div className="py-8 flex flex-col items-center gap-2">
                <p className="text-sm" style={{ color: S.muted }}>No material requests from staff yet</p>
              </div>
            )}

            {matOrders.map((req, i) => {
              const statusColors: Record<string, string> = { pending: S.gold, ordered: S.accent, received: S.green, cancelled: S.muted }
              const statusLabels: Record<string, string> = { pending: 'Pending', ordered: 'Ordered', received: 'Received', cancelled: 'Cancelled' }
              const nextStatus: Partial<Record<string, ElecMaterialRequestStatus>> = { pending: 'ordered', ordered: 'received' }
              const nextLabel: Partial<Record<string, string>> = { pending: 'Mark Ordered', ordered: 'Mark Received' }
              const isUpdating = matOrderUpdating === req.id
              return (
                <div key={req.id} className="px-5 py-4" style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium" style={{ color: S.text }}>{req.description}</p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${statusColors[req.status]}18`, color: statusColors[req.status] }}>
                          {statusLabels[req.status]}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                        <span className="font-semibold">{req.qty} {req.unit ?? 'nr'}</span>
                        {req.requested_by_name ? ` · ${req.requested_by_name}` : ''}
                        {req.notes ? ` · ${req.notes}` : ''}
                      </p>
                      {req.ordered_at && <p className="text-xs mt-0.5" style={{ color: S.muted }}>Ordered {new Date(req.ordered_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}{req.supplier ? ` from ${req.supplier}` : ''}</p>}
                      {req.received_at && <p className="text-xs mt-0.5" style={{ color: S.green }}>Received {new Date(req.received_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</p>}
                      {sentToJobSheet.has(req.id) && (
                        <p className="text-xs mt-0.5 font-medium" style={{ color: S.accent }}>→ Added to Job Sheet</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {nextStatus[req.status] && (
                        <div className="flex items-center gap-1.5">
                          {req.status === 'pending' && (
                            <input
                              value={matOrderSupplier[req.id] ?? ''}
                              onChange={e => setMatOrderSupplier(p => ({ ...p, [req.id]: e.target.value }))}
                              placeholder="Supplier"
                              className="px-2 py-1 rounded-lg text-xs outline-none"
                              style={{ border: `1px solid ${S.border}`, width: 100, color: S.text }}
                            />
                          )}
                          <button
                            onClick={() => void updateOrderStatus(req, nextStatus[req.status]!)}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                            style={{ background: nextStatus[req.status] === 'received' ? S.green : S.accent }}>
                            {isUpdating
                              ? <Loader2 size={11} className="animate-spin" />
                              : nextStatus[req.status] === 'received' ? <PackageCheck size={11} /> : <CheckCircle2 size={11} />}
                            {isUpdating ? '…' : nextLabel[req.status]}
                          </button>
                        </div>
                      )}
                      {req.status === 'received' && <CheckCircle2 size={16} style={{ color: S.green }} />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}

      {/* ── Tab: Job Sheet ─────────────────────────────────────────────────── */}
      {tab === 'job_sheet' && (
        <div>
          {/* Line items */}
          <div className="rounded-2xl overflow-hidden mb-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>

            {/* Column headers */}
            {(materials.length > 0 || newMat !== null) && (
              <div className="grid px-5 py-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ gridTemplateColumns: '1fr 55px 85px 65px 85px 90px', gap: '6px', color: S.muted, background: 'rgba(58,124,165,0.04)', borderBottom: `1px solid ${S.border}` }}>
                <span>Description</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Cost</span>
                <span className="text-right">Mkup%</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Total</span>
              </div>
            )}

            {materials.length === 0 && !newMat && (
              <div className="py-10 flex flex-col items-center gap-2">
                <Wrench size={28} style={{ color: S.border }} />
                <p className="text-sm" style={{ color: S.muted }}>No materials added yet</p>
              </div>
            )}

            {/* Material rows */}
            {materials.map((m, i) => {
              const isEditing = editingMatId === m.id
              const rowTotal = (parseFloat(isEditing ? editingMat.qty : String(m.qty)) || 0) * (parseFloat(isEditing ? editingMat.price : String(m.unit_price ?? 0)) || 0)
              return (
                <div key={m.id}
                  className={!isEditing ? 'group cursor-pointer' : ''}
                  style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined, background: isEditing ? 'rgba(58,124,165,0.03)' : undefined, position: 'relative' }}
                  onClick={!isEditing ? () => startEditMaterial(m) : undefined}>
                  <div className="grid px-5 items-center"
                    style={{ gridTemplateColumns: '1fr 55px 85px 65px 85px 90px', gap: '6px', paddingTop: 10, paddingBottom: 10 }}>
                    {isEditing ? (
                      <input value={editingMat.desc} autoFocus
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditingMat(p => ({ ...p, desc: e.target.value }))}
                        className="w-full px-2 py-1 rounded-lg text-sm outline-none"
                        style={{ border: `1px solid ${S.accent}`, color: S.text, background: '#fff' }} />
                    ) : (
                      <span className="text-sm font-medium truncate group-hover:text-[#3A7CA5]" style={{ color: S.text }}>{m.description}</span>
                    )}
                    {isEditing ? (
                      <input type="number" value={editingMat.qty} min="0.01" step="0.01"
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditingMat(p => ({ ...p, qty: e.target.value }))}
                        className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    ) : (
                      <span className="text-sm text-center tabular-nums font-mono" style={{ color: S.muted }}>{m.qty}</span>
                    )}
                    {isEditing ? (
                      <input type="number" value={editingMat.cost} min="0" step="0.01" placeholder="0"
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const cost = e.target.value
                          const sell = editingMat.markup ? computeSell(cost, editingMat.markup) : editingMat.price
                          setEditingMat(p => ({ ...p, cost, price: sell || p.price }))
                        }}
                        className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    ) : (
                      <span className="text-sm text-right tabular-nums font-mono" style={{ color: S.muted }}>{m.cost_price != null ? fmtR(m.cost_price) : '—'}</span>
                    )}
                    {isEditing ? (
                      <input type="number" value={editingMat.markup} min="0" step="0.1" placeholder="0"
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const markup = e.target.value
                          const sell = editingMat.cost ? computeSell(editingMat.cost, markup) : editingMat.price
                          setEditingMat(p => ({ ...p, markup, price: sell || p.price }))
                        }}
                        className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    ) : (
                      <span className="text-sm text-right tabular-nums" style={{ color: S.muted }}>
                        {m.cost_price != null && m.unit_price != null ? `${computeMarkup(String(m.cost_price), String(m.unit_price))}%` : '—'}
                      </span>
                    )}
                    {isEditing ? (
                      <input type="number" value={editingMat.price} min="0" step="0.01" placeholder="0"
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const price = e.target.value
                          const markup = editingMat.cost ? computeMarkup(editingMat.cost, price) : editingMat.markup
                          setEditingMat(p => ({ ...p, price, markup: markup || p.markup }))
                        }}
                        className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                        style={{ border: `1px solid ${S.accent}`, color: S.text, background: '#fff' }} />
                    ) : (
                      <span className="text-sm text-right tabular-nums font-mono" style={{ color: S.text }}>{m.unit_price != null ? fmtR(m.unit_price) : '—'}</span>
                    )}
                    <span className="text-sm text-right font-semibold tabular-nums font-mono" style={{ color: rowTotal > 0 ? S.text : S.muted }}>
                      {rowTotal > 0 ? fmtR(rowTotal) : '—'}
                    </span>
                  </div>
                  {/* Action buttons — absolutely positioned so they don't affect column alignment */}
                  {isEditing ? (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1 py-0.5 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
                      onClick={e => e.stopPropagation()}>
                      <button onClick={() => void updateMaterial()} disabled={matSaving}
                        className="flex items-center justify-center w-6 h-6 rounded-md disabled:opacity-50"
                        style={{ background: S.accent, color: '#fff' }}>
                        {matSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      </button>
                      <button onClick={() => setEditingMatId(null)}
                        className="flex items-center justify-center w-6 h-6 rounded-md"
                        style={{ background: S.bg, color: S.muted }}>
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); void deleteMaterial(m.id) }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-md"
                      style={{ color: S.muted }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = S.danger }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )
            })}

            {/* Add new row */}
            {newMat !== null && (() => {
              const addTotal = (parseFloat(newMat.qty) || 0) * (parseFloat(newMat.price) || 0)
              return (
                <div style={{ borderTop: materials.length > 0 ? `1px solid ${S.border}` : undefined, background: 'rgba(22,163,74,0.03)', position: 'relative' }}>
                  <div className="grid px-5 items-center"
                    style={{ gridTemplateColumns: '1fr 55px 85px 65px 85px 90px', gap: '6px', paddingTop: 10, paddingBottom: 10 }}>
                    <input value={newMat.desc} autoFocus
                      onChange={e => setNewMat(p => p ? { ...p, desc: e.target.value } : p)}
                      placeholder="Description"
                      className="w-full px-2 py-1 rounded-lg text-sm outline-none"
                      style={{ border: `1px solid ${S.green}`, color: S.text, background: '#fff' }} />
                    <input type="number" value={newMat.qty} min="0.01" step="0.01"
                      onChange={e => setNewMat(p => p ? { ...p, qty: e.target.value } : p)}
                      placeholder="1"
                      className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                      style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    <input type="number" value={newMat.cost} min="0" step="0.01" placeholder="0"
                      onChange={e => {
                        const cost = e.target.value
                        const sell = newMat.markup ? computeSell(cost, newMat.markup) : newMat.price
                        setNewMat(p => p ? { ...p, cost, price: sell || p.price } : p)
                      }}
                      className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                      style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    <input type="number" value={newMat.markup} min="0" step="0.1" placeholder="0"
                      onChange={e => {
                        const markup = e.target.value
                        const sell = newMat.cost ? computeSell(newMat.cost, markup) : newMat.price
                        setNewMat(p => p ? { ...p, markup, price: sell || p.price } : p)
                      }}
                      className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                      style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    <input type="number" value={newMat.price} min="0" step="0.01" placeholder="0"
                      onChange={e => {
                        const price = e.target.value
                        const markup = newMat.cost ? computeMarkup(newMat.cost, price) : newMat.markup
                        setNewMat(p => p ? { ...p, price, markup: markup || p.markup } : p)
                      }}
                      className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                      style={{ border: `1px solid ${S.accent}`, color: S.text, background: '#fff' }} />
                    <span className="text-sm text-right font-semibold tabular-nums font-mono" style={{ color: addTotal > 0 ? S.green : S.muted }}>
                      {addTotal > 0 ? fmtR(addTotal) : '—'}
                    </span>
                  </div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1 py-0.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                    <button onClick={() => void saveMaterial()} disabled={matSaving || !newMat.desc.trim()}
                      className="flex items-center justify-center w-6 h-6 rounded-md disabled:opacity-40"
                      style={{ background: S.green, color: '#fff' }}>
                      {matSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    </button>
                    <button onClick={() => setNewMat(null)}
                      className="flex items-center justify-center w-6 h-6 rounded-md"
                      style={{ background: S.bg, color: S.muted }}>
                      <X size={11} />
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Materials subtotal */}
            {materials.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: `1px solid ${S.border}`, background: S.bg }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Subtotal</p>
                <p className="text-sm font-semibold font-mono" style={{ color: S.muted }}>{fmtR(totalMaterials)}</p>
              </div>
            )}
          </div>

          {newMat === null && (
            <button onClick={() => setNewMat({ desc: '', qty: '1', price: '', cost: '', markup: '' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold mt-3"
              style={{ border: `1px solid ${S.border}`, color: S.accent, background: S.card }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = S.card}>
              <Plus size={13} /> Add Item
            </button>
          )}

          {/* ── Charges section ─────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden mt-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>

            {/* Call-out fee */}
            <div className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: `1px solid ${S.border}` }}>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: S.text }}>Call-out Fee</p>
                <p className="text-xs" style={{ color: S.muted }}>Flat fee for attending site</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold" style={{ color: S.muted }}>R</span>
                <input
                  type="number" min="0" step="0.01"
                  value={card.callout_fee ?? ''}
                  onChange={e => setField('callout_fee', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  className="w-28 px-2.5 py-1.5 rounded-lg text-sm outline-none text-right"
                  style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
              </div>
            </div>

            {/* Labour */}
            <div className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: `1px solid ${S.border}` }}>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: S.text }}>Labour</p>
                <p className="text-xs" style={{ color: S.muted }}>Hours worked × hourly rate</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" step="0.25"
                  value={card.labour_hours ?? ''}
                  onChange={e => setField('labour_hours', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Hrs"
                  className="w-20 px-2.5 py-1.5 rounded-lg text-sm outline-none text-right"
                  style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                <span className="text-xs" style={{ color: S.muted }}>×</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold" style={{ color: S.muted }}>R</span>
                  <input
                    type="number" min="0" step="1"
                    value={card.labour_rate ?? ''}
                    onChange={e => setField('labour_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Rate/hr"
                    className="w-24 px-2.5 py-1.5 rounded-lg text-sm outline-none text-right"
                    style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                </div>
                {labourCharge > 0 && (
                  <span className="text-sm font-semibold font-mono w-24 text-right shrink-0" style={{ color: S.text }}>
                    {fmtR(labourCharge)}
                  </span>
                )}
              </div>
            </div>

            {/* Totals breakdown */}
            <div style={{ borderTop: `1px solid ${S.border}`, marginTop: '16px' }}>
              {/* Subtotal ex VAT */}
              <div className="flex items-center justify-between px-5 py-2.5">
                <p className="text-xs font-semibold" style={{ color: S.muted }}>Subtotal (ex VAT)</p>
                <p className="text-sm font-semibold font-mono" style={{ color: S.text }}>{fmtR(totalCharge)}</p>
              </div>
              {/* VAT */}
              <div className="flex items-center justify-between px-5 py-2.5" style={{ borderTop: `1px solid ${S.border}` }}>
                <p className="text-xs font-semibold" style={{ color: S.muted }}>VAT ({vatRate}%)</p>
                <p className="text-sm font-semibold font-mono" style={{ color: S.muted }}>{fmtR(totalCharge * vatRate / 100)}</p>
              </div>
              {/* Total incl. VAT */}
              <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: `1px solid ${S.border}`, background: S.bg }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: S.text }}>Total (incl. VAT)</p>
                <p className="text-base font-bold font-mono" style={{ color: totalCharge > 0 ? S.accent : S.muted }}>
                  {fmtR(totalCharge * (1 + vatRate / 100))}
                </p>
              </div>
              {/* Profit */}
              {(totalMaterials > 0 || labourCharge > 0 || (card.callout_fee ?? 0) > 0) && (
                <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: `2px solid ${S.border}`, background: jobProfit >= 0 ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)' }}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: jobProfit >= 0 ? '#16A34A' : '#DC2626' }}>Profit</p>
                    <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>
                      Materials margin + labour + call-out · excl. VAT
                    </p>
                  </div>
                  <p className="text-base font-bold font-mono" style={{ color: jobProfit >= 0 ? '#16A34A' : '#DC2626' }}>
                    {fmtR(jobProfit)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Staff time for this job ──────────────────────────────────── */}
          {staffSummary.length > 0 && (
            <div className="rounded-2xl overflow-hidden mt-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="px-5 py-3" style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(58,124,165,0.03)' }}>
                <p className="text-sm font-semibold" style={{ color: S.text }}>Staff Time on Job</p>
                <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>Clocked in/out via the job card on mobile</p>
              </div>
              {staffSummary.map(({ name, color, sessions, onSite }) => {
                const totalMs = sessions.reduce((s, ses) => s + (ses.out ? ses.out.getTime() - ses.in.getTime() : Date.now() - ses.in.getTime()), 0)
                return (
                  <div key={name} className="px-5 py-3 flex items-center justify-between gap-4"
                    style={{ borderTop: `1px solid ${S.border}` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: color }}>
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: S.text }}>{name}</p>
                        <p className="text-[10px]" style={{ color: S.muted }}>
                          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                          {onSite ? ' · currently on site' : ''}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold font-mono" style={{ color: S.accent }}>{fmtDur(totalMs)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Photos ──────────────────────────────────────────────────── */}
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
                      <span className="text-[10px] text-white opacity-0 group-hover:opacity-100 bg-black/50 px-1.5 py-0.5 rounded truncate max-w-[70%]">
                        {p.caption}
                      </span>
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
            <button onClick={() => fileInputRef.current?.click()} disabled={photoUploading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: S.accent }}>
              {photoUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              {photoUploading ? 'Uploading…' : 'Upload Photos'}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Signature ───────────────────────────────────────────────── */}
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
              <p className="text-xs font-semibold mb-1" style={{ color: S.muted }}>Client Signature</p>
              <p className="text-xs mb-3" style={{ color: S.muted }}>Hand the device to the client to sign below.</p>
              <div className="rounded-xl overflow-hidden mb-3" style={{ border: `2px solid ${S.border}`, background: '#FAFAFA', touchAction: 'none' }}>
                <canvas ref={canvasRef} width={600} height={200} className="w-full"
                  style={{ cursor: 'crosshair', display: 'block' }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
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
                  <button onClick={() => setSigning(false)} className="px-4 py-2 rounded-xl text-sm" style={{ color: S.muted }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Finish Job modal ─────────────────────────────────────────────── */}
      {showFinishFlow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowFinishFlow(false) }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: S.card }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold" style={{ color: S.text }}>Finish Job</h2>
              <button onClick={() => setShowFinishFlow(false)} style={{ color: S.muted }}><X size={18} /></button>
            </div>
            <p className="text-xs mb-5" style={{ color: S.muted }}>
              {checklistDoneCount === checklist.length
                ? 'All steps complete. Ready to mark as done and send.'
                : `${checklist.length - checklistDoneCount} step${checklist.length - checklistDoneCount !== 1 ? 's' : ''} remaining before closing out.`}
            </p>

            <div className="space-y-2 mb-5">
              {checklist.map(item => (
                <div key={item.tab} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: item.done ? 'rgba(22,163,74,0.06)' : 'rgba(217,164,65,0.06)', border: `1px solid ${item.done ? 'rgba(22,163,74,0.15)' : 'rgba(217,164,65,0.2)'}` }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: item.done ? S.green : S.gold }}>
                    {item.done
                      ? <CheckCircle2 size={12} color="#fff" />
                      : <span className="text-[9px] text-white font-bold">!</span>}
                  </div>
                  <p className="flex-1 text-sm font-medium" style={{ color: S.text }}>{item.label}</p>
                  {!item.done && (
                    <button
                      onClick={() => { setTab(item.tab); setShowFinishFlow(false) }}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: 'rgba(217,164,65,0.15)', color: S.gold }}>
                      Go →
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {card.status !== 'completed' && (
                <button
                  onClick={() => { void handleStatusChange('completed'); setShowFinishFlow(false) }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: S.green }}>
                  <CheckCircle2 size={15} /> Mark as Completed
                </button>
              )}
              <button
                onClick={() => {
                  setSendEmail(card.client_email ?? card.client?.email ?? '')
                  setShowFinishFlow(false)
                  setShowSend(true)
                }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ border: `1px solid ${S.accent}`, color: S.accent }}>
                <Send size={15} /> Send to Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sage push modal ──────────────────────────────────────────────── */}
      {showSagePush && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSagePush(false) }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: S.card }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold" style={{ color: S.text }}>Push to Sage</h2>
              <button onClick={() => setShowSagePush(false)} style={{ color: S.muted }}><X size={18} /></button>
            </div>
            {sagePushResult?.ok ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <CheckCircle2 size={36} style={{ color: S.green }} />
                <p className="text-sm font-semibold" style={{ color: S.text }}>Invoice pushed to Sage!</p>
                {sagePushResult.total_incl_vat != null && (
                  <p className="text-xs" style={{ color: S.muted }}>Total: {fmtR(sagePushResult.total_incl_vat)} incl. VAT</p>
                )}
                <button onClick={() => setShowSagePush(false)}
                  className="mt-2 px-6 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm" style={{ color: S.muted }}>Select the Sage customer this invoice should be raised against.</p>
                {!sageCustomersLoaded && !sageError && (
                  <p className="text-sm flex items-center gap-2" style={{ color: S.muted }}>
                    <Loader2 size={14} className="animate-spin" /> Loading customers…
                  </p>
                )}
                {sageCustomers.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Sage Customer</label>
                    <select value={sageSelectedCustomer?.id ?? ''}
                      onChange={e => setSageSelectedCustomer(sageCustomers.find(c => c.id === e.target.value) ?? null)}
                      className="w-full px-3 py-2 rounded-xl text-sm"
                      style={{ border: `1px solid ${S.border}`, color: S.text }}>
                      <option value="">— Select customer —</option>
                      {sageCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {sageError && (
                  <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: S.danger }}>{sageError}</p>
                )}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowSagePush(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                    Cancel
                  </button>
                  <button onClick={() => void handleSagePush()} disabled={sagePushing || !sageSelectedCustomer}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: S.accent }}>
                    {sagePushing && <Loader2 size={14} className="animate-spin" />}
                    {sagePushing ? 'Pushing…' : 'Push to Sage'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Send modal ───────────────────────────────────────────────────── */}
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
