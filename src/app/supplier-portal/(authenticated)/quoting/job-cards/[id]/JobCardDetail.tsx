'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Send, Plus, X, Camera, Pen,
  CheckCircle2, Check, Clock, Play, XCircle, Loader2,
  MapPin, User, Calendar, Briefcase, FileText, Wrench, Image as ImageIcon,
  ChevronDown, Upload, MoreHorizontal, ClipboardCheck, Edit2, Trash2,
  Download, Printer, ShoppingCart, PackageCheck, ReceiptText, FileCheck, Link2, Lock, AlertCircle,
} from 'lucide-react'
import type {
  ElecJobCard, ElecJobCardMaterial, ElecJobCardPhoto,
  ElecJobCardStatus, ElecJobCardType, ElecStaff, ElecClient,
  ElecMaterialRequest, ElecMaterialRequestStatus, ElecJobCardExtra,
  ElecJobCardApprovalMethod,
} from '@/lib/elec-types'
import { ClientCombobox } from '../../ClientCombobox'
import { StaffMultiSelect } from '../../StaffMultiSelect'
import { JobCardCOCTab } from './JobCardCOCTab'
import { useVisiblePoll } from '@/lib/useVisiblePoll'
import { toSADateTimeLocal } from '@/lib/dates'

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
  emergency: 'Emergency', coc: 'C.O.C',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Marks the scope reference image so the Photos gallery can leave it out. */
const REF_IMAGE_CAPTION = 'Work description reference'

const APPROVAL_METHOD_LABEL: Record<string, string> = {
  signature: 'signed online',
  phone: 'by phone',
  whatsapp: 'by WhatsApp',
  email: 'by email',
  in_person: 'in person',
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function fmtR(n: number) {
  // Non-breaking space: "R" and the amount must stay on one line in narrow columns.
  return 'R\u00A0' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

function ExtraRow({ extra, first }: { extra: ElecJobCardExtra; first: boolean }) {
  return (
    <div className="px-5 py-3" style={{ borderTop: first ? undefined : `1px solid ${S.border}` }}>
      <p className="text-sm font-medium" style={{ color: S.text }}>{extra.description}</p>
      <p className="text-xs mt-0.5" style={{ color: S.muted }}>
        <span className="font-semibold">{extra.qty} {extra.unit ?? 'nr'}</span>
        {extra.created_by_name ? ` · ${extra.created_by_name}` : ''}
        {extra.notes ? ` · ${extra.notes}` : ''}
      </p>
    </div>
  )
}

// ── Ownership: who fills a section in ─────────────────────────────────────────

/** Where a section stands: filled in, still owed, or not part of this job. */
type SectionState = 'done' | 'waiting' | 'na'

function StateDot({ state }: { state: SectionState }) {
  return (
    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 shrink-0"
      style={{ background: state === 'done' ? S.green : state === 'waiting' ? S.gold : S.border }} />
  )
}

/**
 * Sits at the top of a tab the technician owns, so an empty box reads as
 * "waiting on site" rather than as the office's own unfinished work.
 */
function OwnerBand({ state, techName, onSite, filledLabel, filledNote, waitingNote, onOverride, overridden }: {
  state: SectionState
  techName: string | null
  onSite: boolean
  filledLabel: string
  filledNote?: string
  waitingNote: string
  onOverride?: () => void
  overridden?: boolean
}) {
  if (state === 'done') {
    return (
      <div className="rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 mb-3"
        style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.25)' }}>
        <CheckCircle2 size={15} style={{ color: S.green, flexShrink: 0, marginTop: 1 }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: S.green }}>{filledLabel}</p>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>
            {filledNote ?? 'Edit it if you need to — the change stays on the card.'}
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 mb-3"
      style={{ background: 'rgba(217,164,65,0.07)', border: '1px solid rgba(217,164,65,0.3)' }}>
      <Clock size={15} style={{ color: S.gold, flexShrink: 0, marginTop: 1 }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: S.gold }}>Waiting on site</p>
        <p className="text-xs mt-0.5" style={{ color: S.muted }}>
          {techName
            ? `${techName} ${onSite ? 'is on site now' : 'is assigned'}. `
            : 'No technician assigned yet. '}
          {waitingNote}
        </p>
      </div>
      {onOverride && !overridden && (
        <button onClick={onOverride}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0"
          style={{ border: '1px solid rgba(217,164,65,0.45)', color: S.gold, background: 'transparent' }}>
          Fill it in myself
        </button>
      )}
    </div>
  )
}

/** Stands in for a field the technician hasn't submitted, so it can't be typed into by mistake. */
function NotSubmittedYet() {
  return (
    <div className="px-3 py-2 rounded-xl text-sm italic"
      style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.muted }}>
      Not submitted yet
    </div>
  )
}

/** One section's standing in the strip under the header. Clicking opens its tab. */
function StatusChip({ sec, onClick }: {
  sec: { chip: string; state: SectionState }
  onClick: () => void
}) {
  const tone = sec.state === 'done'
    ? { color: S.green, border: 'rgba(22,163,74,0.32)', bg: 'rgba(22,163,74,0.08)' }
    : sec.state === 'waiting'
      ? { color: S.gold, border: 'rgba(217,164,65,0.36)', bg: 'rgba(217,164,65,0.09)' }
      : { color: S.muted, border: S.border, bg: 'transparent' }
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold whitespace-nowrap"
      style={{ color: tone.color, border: `1px solid ${tone.border}`, background: tone.bg }}>
      {sec.state === 'done' && <Check size={11} />}
      {sec.chip}
    </button>
  )
}

/** A run of tabs under one owner caption, so the row says who owes what. */
function TabGroup({ caption, sections, tab, onPick }: {
  caption: string
  sections: { key: Tab; label: string; state: SectionState }[]
  tab: Tab
  onPick: (k: Tab) => void
}) {
  return (
    <div className="flex flex-col shrink-0">
      <span className="text-[9.5px] font-bold uppercase tracking-widest pl-4 pb-0.5 whitespace-nowrap"
        style={{ color: '#B0B8C4' }}>{caption}</span>
      <div className="flex">
        {sections.map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => onPick(t.key)}
              className="flex items-center px-4 py-2 text-sm whitespace-nowrap relative"
              style={{ color: active ? S.text : S.muted, fontWeight: active ? 600 : 500 }}>
              <StateDot state={t.state} />
              {t.label}
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: S.accent }} />}
            </button>
          )
        })}
      </div>
    </div>
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
  cocPrefix?: string
  companyCode?: string
  initialCOC?: import('@/lib/elec-types').ElecCOC | null
  bookings?: JobCardBooking[]
  extrasEnabled?: boolean
  /** Off when the org only wants job cards reaching the office, never the client. */
  clientSendEnabled?: boolean
  /** The org's own address — the only recipient when client sending is off. */
  officeEmail?: string | null
  /** The tech who found the extra work this card came from, offered as the obvious pick. */
  suggestedStaff?: { id: string; name: string; fromJobNumber: string } | null
}

/** A slot on the schedule for this job card. */
export interface JobCardBooking {
  id: string
  scheduled_date: string
  start_time: string
  end_time: string
  staff: { id: string; name: string } | null
}

type Tab = 'details' | 'report' | 'materials' | 'job_sheet' | 'extras' | 'photos' | 'signature' | 'coc'

// ── Component ─────────────────────────────────────────────────────────────────

export function JobCardDetail({ jobCard: initial, staff, clients: initialClients, portalAccountId, companyName, vatRate = 15, sageConnected = false, cocPrefix = 'COC', companyCode = '', initialCOC = null, bookings = [], extrasEnabled = true, clientSendEnabled = true, officeEmail = null, suggestedStaff = null }: Props) {
  const router = useRouter()
  const [card, setCard] = useState<ElecJobCard>(initial)
  const [clients, setClients] = useState<Pick<ElecClient, 'id' | 'client_name' | 'company' | 'email' | 'address' | 'vat_number' | 'qs_name' | 'qs_email'>[]>(initialClients)
  const initClient = initialClients.find(c => c.id === initial.client_id)
  const [clientCompany, setClientCompany] = useState(initClient?.company ?? '')
  const [clientVatNumber, setClientVatNumber] = useState(initClient?.vat_number ?? '')
  const [tab, setTab] = useState<Tab>('job_sheet')

  // UI state
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showFinishFlow, setShowFinishFlow] = useState(false)
  // The report is the technician's to write. The office can take it over, but
  // only on purpose — an open textarea invites the wrong person to type.
  const [reportOverride, setReportOverride] = useState(false)

  // Job number — edited deliberately, not autosaved with the rest of the form.
  // It is the card's identity: it prints on the PDF and titles every email.
  const [editingNumber, setEditingNumber] = useState(false)
  const [numberDraft, setNumberDraft] = useState(initial.job_number)
  const [numberErr, setNumberErr] = useState('')

  // Reference image on the work description
  const [refUploading, setRefUploading] = useState(false)
  const [refErr, setRefErr] = useState('')

  // Money fields are typed, not picked. Binding them straight to a parsed
  // number meant "2." became 2 on the next render and the decimal point
  // disappeared as you typed it — so a rate had to be entered several times
  // before it stuck. Hold the raw string, parse it onto the card alongside.
  const [chargeDraft, setChargeDraft] = useState({
    callout: initial.callout_fee  != null ? String(initial.callout_fee)  : '',
    hours:   initial.labour_hours != null ? String(initial.labour_hours) : '',
    rate:    initial.labour_rate  != null ? String(initial.labour_rate)  : '',
  })

  function setCharge(
    key: 'callout' | 'hours' | 'rate',
    field: 'callout_fee' | 'labour_hours' | 'labour_rate',
    raw: string,
  ) {
    setChargeDraft(d => ({ ...d, [key]: raw }))
    const n = parseFloat(raw)
    setField(field, raw.trim() === '' || Number.isNaN(n) ? null : n)
  }

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
  const [sendMethod, setSendMethod] = useState<'link' | 'pdf'>('link')
  const [sigDrawn, setSigDrawn] = useState(false)
  // A card the client has been sent or has signed is a record of something
  // agreed — editing it needs a deliberate act, and marks it for resending.
  const [unlocked, setUnlocked] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [approveBy, setApproveBy] = useState('')
  const [approveMethod, setApproveMethod] = useState<ElecJobCardApprovalMethod>('phone')
  const [approveNote, setApproveNote] = useState('')
  const [approving, setApproving] = useState(false)
  const [approveErr, setApproveErr] = useState('')
  const [sendResult, setSendResult] = useState<'success' | 'error' | ''>('')

  // Sage
  const [showSagePush, setShowSagePush] = useState(false)
  const [sageCustomers, setSageCustomers] = useState<{ id: string; name: string }[]>([])
  const [sageCustomersLoaded, setSageCustomersLoaded] = useState(false)
  const [sageSelectedCustomer, setSageSelectedCustomer] = useState<{ id: string; name: string } | null>(null)
  const [sagePushing, setSagePushing] = useState(false)
  const [sageError, setSageError] = useState('')
  const [sagePushResult, setSagePushResult] = useState<{ ok: boolean; total_incl_vat?: number } | null>(null)

  // Staff time for this job — polls every 30s while the tab is visible
  const [jobPunches, setJobPunches] = useState<{ id: string; staff_id: string; punch_type: string; punched_at: string; staff: { id: string; name: string; color: string } | null }[]>([])
  useVisiblePoll(async () => {
    try {
      const r = await fetch(`/api/supplier-portal/quoting/job-cards/${initial.id}/time`)
      const d = await r.json() as unknown
      if (Array.isArray(d)) setJobPunches(d)
    } catch {}
  }, 30_000)

  // Materials — inline form
  const [newMat, setNewMat] = useState<{ desc: string; qty: string; price: string; cost: string; markup: string } | null>(null)
  const [editingMatId, setEditingMatId] = useState<string | null>(null)
  const [editingMat, setEditingMat] = useState({ desc: '', qty: '', price: '', cost: '', markup: '' })
  const [matSaving, setMatSaving] = useState(false)
  // Only a real edit should save — opening a row for editing must not, or it
  // would stamp the card as amended without anything having changed.
  const [editDirty, setEditDirty] = useState(false)
  const matTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Material order requests (from staff)
  const [matOrders, setMatOrders] = useState<ElecMaterialRequest[]>([])
  const [matOrdersLoaded, setMatOrdersLoaded] = useState(false)
  const [matOrderUpdating, setMatOrderUpdating] = useState<string | null>(null)
  const [matOrderSupplier, setMatOrderSupplier] = useState<Record<string, string>>({})
  const [sentToJobSheet, setSentToJobSheet] = useState<Set<string>>(new Set())

  useEffect(() => {
    if ((tab === 'materials' || tab === 'job_sheet') && !matOrdersLoaded) {
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

  /**
   * `mergeBack` writes the patch onto local state once the save lands. That is
   * right for a discrete action (a status change, a new job number), but wrong
   * for the debounced autosave: the patch is a snapshot taken when the timer
   * fired, so anything typed while the request was in flight got overwritten
   * with the older value — the field visibly snapped back.
   */
  async function save(patch: Partial<ElecJobCard>, mergeBack = true) {
    setSaving(true); setSaveMsg('')
    try {
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      if (mergeBack) setCard(c => ({ ...c, ...patch }))
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch { setSaveMsg('Error saving') }
    finally { setSaving(false) }
  }

  function setField<K extends keyof ElecJobCard>(key: K, val: ElecJobCard[K]) {
    setCard(c => ({ ...c, [key]: val }))
  }

  async function commitJobNumber() {
    const next = numberDraft.trim()
    setNumberErr('')
    if (!next) { setNumberDraft(card.job_number); setEditingNumber(false); return }
    if (next === card.job_number) { setEditingNumber(false); return }
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_number: next }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string }
      setNumberErr(d.error ?? 'Could not save')
      setNumberDraft(card.job_number)
      setEditingNumber(false)
      return
    }
    setCard(c => ({ ...c, job_number: next }))
    setEditingNumber(false)
    setSaveMsg('Saved')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  /** One reference image for the scope — a drawing, a board photo, a marked-up plan. */
  async function handleRefImage(file: File | null) {
    if (!file) return
    setRefUploading(true); setRefErr('')
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed, file.name.replace(/\.[^.]+$/, '.jpg'))
      fd.append('caption', REF_IMAGE_CAPTION)
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/photos`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const photo = await res.json() as ElecJobCardPhoto
      await save({ work_description_image_url: photo.url })
      setCard(c => ({ ...c, photos: [...(c.photos ?? []), photo] }))
    } catch {
      setRefErr('Could not upload that image — try again.')
    }
    setRefUploading(false)
  }

  async function removeRefImage() {
    const url = card.work_description_image_url
    const photo = (card.photos ?? []).find(ph => ph.url === url)
    await save({ work_description_image_url: null })
    if (photo) {
      void fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/photos/${photo.id}`, { method: 'DELETE' })
      setCard(c => ({ ...c, photos: (c.photos ?? []).filter(ph => ph.id !== photo.id) }))
    }
  }

  async function handleStatusChange(status: ElecJobCardStatus) {
    const patch: Partial<ElecJobCard> = { status }
    if (status === 'in_progress' && !card.started_at) patch.started_at = new Date().toISOString()
    if (status === 'completed' && !card.completed_at) patch.completed_at = new Date().toISOString()
    await save(patch)
    setShowStatusMenu(false)
  }

  // Use a ref so the auto-save timer always calls with the latest data
  const autoSaveDataRef = useRef({ card, clientCompany, clientVatNumber })
  useEffect(() => { autoSaveDataRef.current = { card, clientCompany, clientVatNumber } }, [card, clientCompany, clientVatNumber])

  const handleSave = useCallback(async () => {
    const { card, clientCompany, clientVatNumber } = autoSaveDataRef.current
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
    }, false)
    if (card.client_id) {
      const patch: Record<string, string | null> = {}
      if (card.client_email?.trim()) patch.email = card.client_email.trim()
      if (card.location?.trim()) patch.address = card.location.trim()
      if (clientCompany.trim()) patch.company = clientCompany.trim()
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
    clientCompany, clientVatNumber,
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

  // Debounced autosave for the row being edited. The row stays open so the
  // fields never unmount mid-keystroke.
  useEffect(() => {
    if (!editingMatId || !editDirty) return
    clearTimeout(matTimer.current)
    matTimer.current = setTimeout(() => { void updateMaterial(false) }, 800)
    return () => clearTimeout(matTimer.current)
  }, [editingMat, editingMatId, editDirty]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveMaterial() {
    if (!newMat || !newMat.desc.trim()) { setNewMat(null); return }
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

  function editMat(fn: (p: { desc: string; qty: string; price: string; cost: string; markup: string }) => { desc: string; qty: string; price: string; cost: string; markup: string }) {
    setEditingMat(fn)
    setEditDirty(true)
  }

  function startEditMaterial(m: ElecJobCardMaterial) {
    setEditingMatId(m.id)
    setEditDirty(false)
    const cost = m.cost_price != null ? String(m.cost_price) : ''
    const sell = m.unit_price != null ? String(m.unit_price) : ''
    const markup = cost && sell ? computeMarkup(cost, sell) : ''
    setEditingMat({ desc: m.description, qty: String(m.qty), price: sell, cost, markup })
  }

  // Autosaves while the row is open, then commits and closes when focus leaves.
  async function updateMaterial(close = true) {
    if (!editingMatId) return
    if (!editDirty) { if (close) setEditingMatId(null); return }
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
      setEditDirty(false)
      if (close) setEditingMatId(null)
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
    setSigDrawn(true)
    lastPos.current = pos
  }

  function endDraw() { isDrawing.current = false; lastPos.current = null }

  function clearCanvas() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setSigDrawn(false)
  }

  async function saveSignature() {
    const canvas = canvasRef.current!
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
    if (!blob) return
    setSigSaving(true)
    const fd = new FormData()
    fd.append('file', blob, 'signature.png')
    // The caption is the signer's name — it prints on the PDF as who approved
    // the work, so an unnamed signature is worth nothing as proof.
    fd.append('caption', sigCaption.trim())
    const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/photos`, { method: 'POST', body: fd })
    if (res.ok) {
      const p = await res.json() as ElecJobCardPhoto
      await save({ client_signature_url: p.url, sent_to_name: sigCaption.trim() })
      setCard(c => ({ ...c, client_signature_url: p.url, sent_to_name: sigCaption.trim() }))
      setSigning(false); clearCanvas()
    }
    setSigSaving(false)
  }

  // ── Send / Sage ───────────────────────────────────────────────────────────

  async function recordApproval() {
    if (approving || !approveBy.trim()) return
    setApproving(true); setApproveErr('')
    try {
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved_by: approveBy.trim(),
          approval_method: approveMethod,
          approval_note: approveNote.trim() || null,
        }),
      })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (res.ok && d.ok) {
        setCard(c => ({
          ...c,
          approved_at: new Date().toISOString(),
          approved_by: approveBy.trim(),
          approval_method: approveMethod,
          approval_note: approveNote.trim() || null,
          amended_at: null,
          status: c.status === 'pending' ? 'in_progress' : c.status,
        }))
        setShowApprove(false)
      } else {
        setApproveErr(d.error ?? 'Could not record it — try again.')
      }
    } catch {
      setApproveErr('Could not record it — try again.')
    }
    setApproving(false)
  }

  async function handleSend() {
    if (!sendEmail) return
    setSending(true); setSendResult('')
    try {
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail, name: sendName || null, message: sendMsg || null, as_invoice: false, include_link: sendMethod === 'link', client_company: clientCompany.trim() || null }),
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

  // Two different client signatures, deliberately kept apart:
  //   APPROVAL — the client agreeing to the work before it starts (quote signed)
  //   SIGN-OFF — the client confirming the work was done (job signed)
  const isApproved = !!card.approved_at
  const isSignedOff = !!card.client_signature_url
  const isLocked = !!(card.sent_at || isApproved || isSignedOff)
  const editable = !isLocked || unlocked

  // Who signed, off the signature photo's caption — the same place the PDF reads it.
  const signaturePhoto = (card.photos ?? []).find(p => p.url === card.client_signature_url)
  const signedBy = signaturePhoto?.caption?.trim() || card.sent_to_name || null
  const signedAt = signaturePhoto?.uploaded_at ?? null

  // ── Extra work ────────────────────────────────────────────────────────────
  const extras = initial.extras ?? []
  const unsentExtras = extras.filter(x => !x.created_job_card_id && !x.quote_id)
  // Each batch of extras became its own job card.
  const extrasCardGroups = Array.from(
    extras.filter(x => !!x.created_job_card_id).reduce((map, x) => {
      const group = map.get(x.created_job_card_id!)
      if (group) group.items.push(x)
      else map.set(x.created_job_card_id!, { card: x.created_job_card ?? null, items: [x] })
      return map
    }, new Map<string, { card: NonNullable<ElecJobCardExtra['created_job_card']> | null; items: ElecJobCardExtra[] }>()),
  )
  const [extrasSubmitting, setExtrasSubmitting] = useState(false)
  const [extrasMsg, setExtrasMsg] = useState('')

  // Staff normally send the batch themselves; this covers the case where they
  // logged the items and left it to the office.
  async function createExtrasQuote() {
    if (extrasSubmitting) return
    setExtrasSubmitting(true)
    setExtrasMsg('')
    try {
      const res = await fetch(`/api/supplier-portal/quoting/job-cards/${card.id}/extras/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const d = await res.json() as { job_card_id?: string; error?: string }
      if (res.ok && d.job_card_id) {
        router.push(`/supplier-portal/quoting/job-cards/${d.job_card_id}`)
        return
      }
      setExtrasMsg(d.error ?? 'Could not create the job card — try again.')
    } catch {
      setExtrasMsg('Could not create the job card — try again.')
    }
    setExtrasSubmitting(false)
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const ss = STATUS_STYLE[card.status] ?? STATUS_STYLE.pending
  const StatusIcon = ss.icon
  const materials = card.materials ?? []
  // The signature and the scope reference image live in the same table as the
  // site photos but are not part of the gallery.
  const photos = (card.photos ?? []).filter(p =>
    p.url !== card.client_signature_url && p.url !== card.work_description_image_url)
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

  // ── Who fills what in ─────────────────────────────────────────────────────
  // Half of these tabs fill themselves in from the technician's phone. The
  // office needs to read "waiting on site" apart from "I haven't done this yet".
  const assignedTechName = staffMember?.name ?? staff.find(st => st.id === card.staff_id)?.name ?? null
  const techOnSite = staffSummary.some(st => st.onSite)
  const reportDone = !!(card.work_found?.trim() || card.work_done?.trim() || card.resolution?.trim())
  const hasCharges = materials.length > 0 || (card.callout_fee ?? 0) > 0 || (card.labour_hours ?? 0) > 0
  const detailsDone = !!((card.client_id || card.client_name) && card.location)
  const cocRelevant = card.job_type === 'coc' || !!initialCOC
  const pendingOrders = matOrders.filter(o => o.status === 'pending').length

  type Section = {
    key: Tab; label: string; chip: string
    owner: 'office' | 'shared' | 'site'
    state: SectionState
  }
  const sections: Section[] = [
    { key: 'job_sheet', owner: 'office', label: 'Job Sheet', chip: 'Priced',
      state: hasCharges ? 'done' : 'waiting' },
    { key: 'details', owner: 'office', label: 'Details', chip: 'Client & site',
      state: detailsDone ? 'done' : 'waiting' },
    { key: 'coc', owner: 'office', label: 'COC', chip: 'COC',
      state: initialCOC ? 'done' : cocRelevant ? 'waiting' : 'na' },
    { key: 'materials', owner: 'shared',
      label: `Orders${matOrders.length > 0 ? ` (${matOrders.length})` : ''}`,
      chip: pendingOrders > 0 ? `Orders — ${pendingOrders} to action` : 'Orders',
      state: matOrders.length === 0 ? 'na' : pendingOrders > 0 ? 'waiting' : 'done' },
    { key: 'report', owner: 'site', label: 'Report', chip: 'Report',
      state: reportDone ? 'done' : 'waiting' },
    { key: 'photos', owner: 'site',
      label: `Photos${photos.length > 0 ? ` (${photos.length})` : ''}`,
      chip: photos.length > 0 ? `Photos ${photos.length}` : 'Photos',
      state: photos.length > 0 ? 'done' : 'waiting' },
    ...(extrasEnabled
      ? [{ key: 'extras' as Tab, owner: 'site' as const,
          label: `Extra Work${extras.length > 0 ? ` (${extras.length})` : ''}`,
          chip: extras.length > 0 ? `Extra work ${extras.length}` : 'Extra work — none',
          state: (extras.length > 0 ? 'done' : 'na') as SectionState }]
      : []),
    { key: 'signature', owner: 'site', label: 'Signature', chip: 'Signature',
      state: isSignedOff ? 'done' : 'waiting' },
  ]
  const officeSections = sections.filter(x => x.owner === 'office')
  const sharedSections = sections.filter(x => x.owner === 'shared')
  const siteSections   = sections.filter(x => x.owner === 'site')
  const yourChips      = [...officeSections, ...sharedSections]

  // Finish job checklist — same source as the strip, spelled out for the modal
  const checklist = [
    { label: 'Report filled in',  done: reportDone,           tab: 'report'    as Tab, owner: 'site'   as const },
    { label: 'Materials logged',  done: materials.length > 0, tab: 'job_sheet' as Tab, owner: 'office' as const },
    { label: 'Photos taken',      done: photos.length > 0,    tab: 'photos'    as Tab, owner: 'site'   as const },
    { label: 'Client signature',  done: isSignedOff,          tab: 'signature' as Tab, owner: 'site'   as const },
  ]
  const checklistDoneCount = checklist.filter(c => c.done).length

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'details',   label: 'Details',   icon: Briefcase   },
    { key: 'report',    label: 'Report',    icon: FileText    },
    { key: 'materials', label: 'Materials', icon: ShoppingCart },
    { key: 'job_sheet', label: `Job Sheet${materials.length > 0 ? ` (${materials.length})` : ''}`, icon: ReceiptText },
    { key: 'photos',    label: `Photos${photos.length > 0 ? ` (${photos.length})` : ''}`,          icon: ImageIcon  },
    { key: 'signature', label: 'Signature', icon: Pen         },
    { key: 'coc',       label: 'COC',       icon: FileCheck   },
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
          {/* Download — the most-used action, so not buried in the overflow */}
          <button onClick={() => void handleDownload()} disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ border: `1px solid ${S.border}`, color: S.text, background: S.card }}>
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF
          </button>
          <button onClick={() => handlePrint()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ border: `1px solid ${S.border}`, color: S.text, background: S.card }}>
            <Printer size={13} /> Print
          </button>
          {/* Send */}
          <button onClick={() => { setSendEmail(clientSendEnabled ? (card.client_email ?? card.client?.email ?? '') : (officeEmail ?? '')); setSendMethod(isApproved && !card.amended_at ? 'pdf' : 'link'); setShowSend(true) }}
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
                  {sageConnected && (
                    <button onClick={() => { setShowMoreMenu(false); void openSagePush() }}
                      className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
                      style={{ color: S.text }}>
                      <Upload size={14} /> Push to Sage
                    </button>
                  )}
                  {sageConnected && <div style={{ borderTop: `1px solid ${S.border}`, margin: '4px 0' }} />}
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
            <div className="flex items-center gap-1.5 mb-1">
              {editingNumber ? (
                <input
                  value={numberDraft} autoFocus
                  onChange={e => setNumberDraft(e.target.value)}
                  onBlur={() => void commitJobNumber()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); void commitJobNumber() }
                    if (e.key === 'Escape') { setNumberDraft(card.job_number); setEditingNumber(false) }
                  }}
                  aria-label="Job number"
                  className="px-2 py-0.5 rounded-lg text-xs font-mono outline-none"
                  style={{ border: `1px solid ${S.accent}`, color: S.text, background: '#fff', width: 132 }} />
              ) : (
                <>
                  <span className="text-xs font-mono" style={{ color: S.muted }}>{card.job_number}</span>
                  <button
                    onClick={() => { setNumberDraft(card.job_number); setEditingNumber(true) }}
                    aria-label="Edit job number"
                    className="flex items-center justify-center w-5 h-5 rounded-md"
                    style={{ color: S.muted }}
                    onMouseEnter={e => e.currentTarget.style.color = S.accent}
                    onMouseLeave={e => e.currentTarget.style.color = S.muted}>
                    <Edit2 size={11} />
                  </button>
                </>
              )}
              <span className="text-xs font-mono" style={{ color: S.muted }}>· {TYPE_LABEL[card.job_type]}</span>
              {numberErr && <span className="text-xs" style={{ color: S.danger }}>{numberErr}</span>}
            </div>
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

      {/* Unassigned extra-work card — offer the tech who found it */}
      {suggestedStaff && !card.staff_id && (
        <div className="mb-5 rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(217,164,65,0.06)', border: '1px solid rgba(217,164,65,0.3)' }}>
          <User size={15} style={{ color: S.gold, flexShrink: 0 }} />
          <span className="flex-1 text-sm" style={{ color: S.text }}>
            <strong>{suggestedStaff.name}</strong> found this extra work on {suggestedStaff.fromJobNumber}. This card is unassigned.
          </span>
          <button
            onClick={() => setCard(c => ({ ...c, staff_id: suggestedStaff.id }))}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
            style={{ background: S.gold }}>
            Assign to {suggestedStaff.name.split(' ')[0]}
          </button>
        </div>
      )}

      {/* ── Where the card stands — what you owe it vs what site owes it ──── */}
      {canFinish && (
        <div className="mb-4 rounded-2xl px-4 py-3 flex items-center gap-x-3 gap-y-2 flex-wrap"
          style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.muted }}>Yours</span>
          {yourChips.map(sec => <StatusChip key={sec.key} sec={sec} onClick={() => setTab(sec.key)} />)}
          <span className="w-px h-5 mx-1 hidden sm:block" style={{ background: S.border }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.muted }}>From site</span>
          {siteSections.map(sec => <StatusChip key={sec.key} sec={sec} onClick={() => setTab(sec.key)} />)}
          <button onClick={() => setShowFinishFlow(true)}
            className="sm:ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: S.accent }}>
            <ClipboardCheck size={13} /> Finish Job
          </button>
        </div>
      )}

      {/* ── Tabs — grouped by who fills them in ──────────────────────────── */}
      <div className="flex items-end mb-6 overflow-x-auto" style={{ borderBottom: `1px solid ${S.border}` }}>
        <TabGroup caption="You fill in" sections={officeSections} tab={tab} onPick={setTab} />
        {sharedSections.length > 0 && (
          <>
            <span className="w-px self-stretch mx-3.5 shrink-0" style={{ background: S.border }} />
            <TabGroup caption="Site raises, you action" sections={sharedSections} tab={tab} onPick={setTab} />
          </>
        )}
        <span className="w-px self-stretch mx-3.5 shrink-0" style={{ background: S.border }} />
        <TabGroup caption="Comes from site" sections={siteSections} tab={tab} onPick={setTab} />
      </div>

      {/* ── Client copy: sent, approved, or out of date ───────────────────── */}
      {isLocked && (
        <div className="mb-5 space-y-2">
          {card.amended_at ? (
            <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
              style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.4)' }}>
              <AlertCircle size={15} style={{ color: S.gold, flexShrink: 0, marginTop: 1 }} />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: S.gold }}>
                  Edited {fmtDateTime(card.amended_at)} — after it went to the client
                </p>
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                  {isApproved
                    ? 'The approval on file no longer covers this version. Resend it for the client to approve again.'
                    : 'The client is holding an older version. Resend the job card so their copy matches.'}
                </p>
              </div>
              <button onClick={() => { setSendEmail(card.client_email ?? card.client?.email ?? ''); setSendMethod(isApproved && !card.amended_at ? 'pdf' : 'link'); setShowSend(true) }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                style={{ background: S.gold }}>
                Resend
              </button>
            </div>
          ) : (
            <>
              {isApproved && (
                <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
                  style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.25)' }}>
                  <CheckCircle2 size={14} style={{ color: S.green, flexShrink: 0 }} />
                  <p className="text-sm font-semibold" style={{ color: S.green }}>
                    Quote signed — approved by {card.approved_by ?? 'the client'} {APPROVAL_METHOD_LABEL[card.approval_method ?? ''] ?? ''} — {fmtDateTime(card.approved_at)}
                  </p>
                </div>
              )}
              {isSignedOff && (
                <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
                  style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.25)' }}>
                  <CheckCircle2 size={14} style={{ color: S.green, flexShrink: 0 }} />
                  <p className="text-sm font-semibold" style={{ color: S.green }}>
                    Job signed off{signedBy ? ` by ${signedBy}` : ''}{signedAt ? ` — ${fmtDateTime(signedAt)}` : ''}
                  </p>
                </div>
              )}
              {!isApproved && !isSignedOff && card.sent_at && (
                <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
                  style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.25)' }}>
                  <Send size={14} style={{ color: S.green, flexShrink: 0 }} />
                  <p className="text-sm font-semibold" style={{ color: S.green }}>
                    Sent {fmtDateTime(card.sent_at)}{card.sent_to_email ? ` to ${card.sent_to_email}` : ''}
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-2 px-1">
            <Lock size={12} style={{ color: S.muted }} />
            <p className="text-xs flex-1" style={{ color: S.muted }}>
              {editable
                ? 'Editing — any change marks this card as amended and it will need resending.'
                : 'Locked. This card has gone to the client.'}
            </p>
            <button onClick={() => setUnlocked(u => !u)}
              className="text-xs font-semibold" style={{ color: S.accent }}>
              {editable ? 'Lock' : 'Edit anyway'}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Details (grouped) ───────────────────────────────────────── */}
      {tab === 'details' && (
        <fieldset disabled={!editable} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
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
          <Txt label="Work Description" val={card.work_description} cb={v => setField('work_description', v || null)} rows={3} />

          {/* Optional reference image — a drawing, a board photo, a marked-up plan */}
          {card.work_description_image_url ? (
            <div className="flex items-start gap-3">
              <a href={card.work_description_image_url} target="_blank" rel="noopener noreferrer"
                className="block rounded-xl overflow-hidden shrink-0"
                style={{ border: `1px solid ${S.border}`, background: S.bg, width: 132, height: 99 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.work_description_image_url} alt="Work description reference"
                  className="w-full h-full object-contain" />
              </a>
              <div className="flex flex-col items-start gap-1.5 pt-0.5">
                <p className="text-xs font-semibold" style={{ color: S.text }}>Reference image</p>
                <p className="text-xs" style={{ color: S.muted }}>Shown with the scope. Not part of the site photos.</p>
                <button type="button" onClick={() => void removeRefImage()}
                  className="text-xs font-semibold" style={{ color: S.danger }}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                style={{ border: `1px dashed ${S.border}`, color: S.muted }}>
                {refUploading ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
                {refUploading ? 'Uploading…' : 'Add reference image (optional)'}
                <input type="file" accept="image/*" className="hidden" disabled={refUploading}
                  onChange={e => { void handleRefImage(e.target.files?.[0] ?? null); e.target.value = '' }} />
              </label>
              {refErr && <p className="text-xs mt-1.5" style={{ color: S.danger }}>{refErr}</p>}
            </div>
          )}

          <SectionHeader label="Client & Billing" />
          <p className="text-xs -mt-2" style={{ color: S.muted }}>
            Saved onto the client record, not just this job — editing here updates the client everywhere.
          </p>
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
          </div>

          <SectionHeader label="Scheduling" />
          <Inp label="Location / Address" val={card.location} cb={v => setField('location', v || null)} placeholder="Site address" />
          <div className="grid grid-cols-2 gap-4">
            {bookings.length > 0 ? (
              // On the schedule — the slot owns the timing, so editing the
              // target date here would be overwritten on its next save.
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Scheduled</label>
                <div className="rounded-xl px-3 py-2" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
                  {bookings.map(b => (
                    <p key={b.id} className="text-sm" style={{ color: S.text }}>
                      {fmtDate(`${b.scheduled_date}T12:00:00`)} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                      {b.staff && <span style={{ color: S.muted }}> · {b.staff.name}</span>}
                    </p>
                  ))}
                  <a href="/supplier-portal/quoting/schedule" className="text-xs font-semibold mt-1 inline-block" style={{ color: S.accent }}>
                    Change on the schedule →
                  </a>
                </div>
              </div>
            ) : (
              // Not on the schedule yet, so this is a target date, not a slot
              <div>
                <Inp label="Target Date & Time" val={toSADateTimeLocal(card.scheduled_at)} cb={v => setField('scheduled_at', v || null)} type="datetime-local" />
                <p className="text-[11px] mt-1" style={{ color: S.muted }}>
                  Not on the schedule yet — it will show under &ldquo;Due today&rdquo; on that date.
                </p>
              </div>
            )}
            <Inp label="Completed Date" val={toSADateTimeLocal(card.completed_at)} cb={v => setField('completed_at', v || null)} type="datetime-local" />
          </div>
        </div>
        </fieldset>
      )}

      {/* ── Tab: Report — the technician's, unless you take it over ─────── */}
      {tab === 'report' && (
        <div>
          <OwnerBand
            state={reportDone ? 'done' : 'waiting'}
            techName={assignedTechName}
            onSite={techOnSite}
            filledLabel={`Filled in on site${assignedTechName ? ` by ${assignedTechName}` : ''}`}
            waitingNote="The report comes in from the phone on site."
            onOverride={() => setReportOverride(true)}
            overridden={reportOverride}
          />
          <fieldset disabled={!editable} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <div className="rounded-2xl p-5 space-y-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            {reportDone || reportOverride ? (
              <>
                <Txt label="What Was Found" val={card.work_found} cb={v => setField('work_found', v || null)} rows={5} />
                <Txt label="Resolution" val={card.resolution} cb={v => setField('resolution', v || null)} rows={5} />
              </>
            ) : (
              <>
                <Field label="What Was Found"><NotSubmittedYet /></Field>
                <Field label="Resolution"><NotSubmittedYet /></Field>
              </>
            )}
          </div>
          </fieldset>
        </div>
      )}

      {/* ── Tab: Materials ───────────────────────────────────────────────── */}
      {tab === 'materials' && (
        <div>
          {/* ── Materials Used — what actually went into the job ── */}
          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${S.border}` }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: S.text }}>Materials Used</p>
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                  Logged on site as the work is done. Price them on the Job Sheet.
                </p>
              </div>
              <button onClick={() => setTab('job_sheet')}
                className="text-xs font-semibold whitespace-nowrap shrink-0" style={{ color: S.accent }}>
                Job Sheet →
              </button>
            </div>

            {materials.length === 0 && (
              <div className="py-8 flex flex-col items-center gap-2">
                <p className="text-sm" style={{ color: S.muted }}>No materials logged on this job yet</p>
              </div>
            )}

            {materials.map((m, i) => (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-4"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                <p className="text-sm font-medium min-w-0 flex-1" style={{ color: S.text }}>{m.description}</p>
                <span className="text-sm font-mono tabular-nums shrink-0" style={{ color: S.muted }}>
                  {m.qty}
                </span>
                <span className="text-sm font-mono tabular-nums shrink-0 w-24 text-right"
                  style={{ color: m.unit_price != null ? S.text : S.gold }}>
                  {m.unit_price != null ? fmtR(m.qty * m.unit_price) : 'Unpriced'}
                </span>
              </div>
            ))}
          </div>

          {/* ── Materials Ordered — requests raised on site, actioned here ── */}
          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${S.border}` }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: S.text }}>Materials Ordered</p>
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                  Requested from site. Mark each one ordered, then received.
                </p>
              </div>
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
        <fieldset disabled={!editable} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <div>
          {/* Line items */}
          <div className="rounded-2xl overflow-hidden mb-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>

            {/* Column headers */}
            {(materials.length > 0 || newMat !== null) && (
              <div className="grid px-5 py-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ gridTemplateColumns: 'minmax(0,1fr) 58px 108px 74px 108px 132px', gap: '8px', paddingRight: 76, color: S.muted, background: 'rgba(58,124,165,0.04)', borderBottom: `1px solid ${S.border}` }}>
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
                  className={!isEditing && editable ? 'group cursor-pointer' : ''}
                  style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined, background: isEditing ? 'rgba(58,124,165,0.03)' : undefined, position: 'relative' }}
                  onClick={!isEditing && editable ? () => startEditMaterial(m) : undefined}
                  onBlur={isEditing ? e => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void updateMaterial()
                  } : undefined}
                  onKeyDown={isEditing ? e => {
                    if (e.key === 'Enter') { e.preventDefault(); void updateMaterial() }
                    if (e.key === 'Escape') { setEditDirty(false); setEditingMatId(null) }
                  } : undefined}>
                  <div className="grid px-5 items-center"
                    style={{ gridTemplateColumns: 'minmax(0,1fr) 58px 108px 74px 108px 132px', gap: '8px', paddingTop: 10, paddingBottom: 10, paddingRight: 76 }}>
                    {isEditing ? (
                      <input value={editingMat.desc} autoFocus aria-label="Description"
                        onClick={e => e.stopPropagation()}
                        onChange={e => editMat(p => ({ ...p, desc: e.target.value }))}
                        className="w-full px-2 py-1 rounded-lg text-sm outline-none"
                        style={{ border: `1px solid ${S.accent}`, color: S.text, background: '#fff' }} />
                    ) : (
                      <span className="text-sm font-medium truncate group-hover:text-[#3A7CA5]" style={{ color: S.text }}>{m.description}</span>
                    )}
                    {isEditing ? (
                      <input type="number" value={editingMat.qty} min="0.01" step="0.01" aria-label="Quantity"
                        onClick={e => e.stopPropagation()}
                        onChange={e => editMat(p => ({ ...p, qty: e.target.value }))}
                        className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    ) : (
                      <span className="text-sm text-center tabular-nums font-mono whitespace-nowrap" style={{ color: S.muted }}>{m.qty}</span>
                    )}
                    {isEditing ? (
                      <input type="number" value={editingMat.cost} min="0" step="0.01" aria-label="Cost price"
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const cost = e.target.value
                          const sell = editingMat.markup ? computeSell(cost, editingMat.markup) : editingMat.price
                          editMat(p => ({ ...p, cost, price: sell || p.price }))
                        }}
                        className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    ) : (
                      <span className="text-sm text-right tabular-nums font-mono whitespace-nowrap" style={{ color: S.muted }}>{m.cost_price != null ? fmtR(m.cost_price) : '—'}</span>
                    )}
                    {isEditing ? (
                      <input type="number" value={editingMat.markup} min="0" step="0.1" aria-label="Markup percent"
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const markup = e.target.value
                          const sell = editingMat.cost ? computeSell(editingMat.cost, markup) : editingMat.price
                          editMat(p => ({ ...p, markup, price: sell || p.price }))
                        }}
                        className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    ) : (
                      <span className="text-sm text-right tabular-nums whitespace-nowrap" style={{ color: S.muted }}>
                        {m.cost_price != null && m.unit_price != null ? `${computeMarkup(String(m.cost_price), String(m.unit_price))}%` : '—'}
                      </span>
                    )}
                    {isEditing ? (
                      <input type="number" value={editingMat.price} min="0" step="0.01" aria-label="Rate"
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const price = e.target.value
                          const markup = editingMat.cost ? computeMarkup(editingMat.cost, price) : editingMat.markup
                          editMat(p => ({ ...p, price, markup: markup || p.markup }))
                        }}
                        className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                        style={{ border: `1px solid ${S.accent}`, color: S.text, background: '#fff' }} />
                    ) : (
                      <span className="text-sm text-right tabular-nums font-mono whitespace-nowrap" style={{ color: S.text }}>{m.unit_price != null ? fmtR(m.unit_price) : '—'}</span>
                    )}
                    <span className="text-sm text-right font-semibold tabular-nums font-mono whitespace-nowrap" style={{ color: rowTotal > 0 ? S.text : S.muted }}>
                      {rowTotal > 0 ? fmtR(rowTotal) : '—'}
                    </span>
                  </div>
                  {/* Action buttons — absolutely positioned so they don't affect column alignment */}
                  {isEditing ? (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 pr-1"
                      onClick={e => e.stopPropagation()}>
                      {matSaving
                        ? <Loader2 size={12} className="animate-spin" style={{ color: S.muted }} />
                        : editDirty
                          ? <span className="text-[10px]" style={{ color: S.muted }}>Saving…</span>
                          : <Check size={12} style={{ color: S.green }} />}
                    </div>
                  ) : editable ? (
                    <button onClick={e => { e.stopPropagation(); void deleteMaterial(m.id) }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-md"
                      style={{ color: S.muted }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = S.danger }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}>
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </div>
              )
            })}

            {/* Add new row */}
            {newMat !== null && (() => {
              const addTotal = (parseFloat(newMat.qty) || 0) * (parseFloat(newMat.price) || 0)
              return (
                <div style={{ borderTop: materials.length > 0 ? `1px solid ${S.border}` : undefined, background: 'rgba(22,163,74,0.03)', position: 'relative' }}
                  onBlur={e => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void saveMaterial()
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); void saveMaterial() }
                    if (e.key === 'Escape') setNewMat(null)
                  }}>
                  <div className="grid px-5 items-center"
                    style={{ gridTemplateColumns: 'minmax(0,1fr) 58px 108px 74px 108px 132px', gap: '8px', paddingTop: 10, paddingBottom: 10, paddingRight: 76 }}>
                    <input value={newMat.desc} autoFocus aria-label="Description"
                      onChange={e => setNewMat(p => p ? { ...p, desc: e.target.value } : p)}
                      className="w-full px-2 py-1 rounded-lg text-sm outline-none"
                      style={{ border: `1px solid ${S.green}`, color: S.text, background: '#fff' }} />
                    <input type="number" value={newMat.qty} min="0.01" step="0.01" aria-label="Quantity"
                      onChange={e => setNewMat(p => p ? { ...p, qty: e.target.value } : p)}
                      className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                      style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    <input type="number" value={newMat.cost} min="0" step="0.01" aria-label="Cost price"
                      onChange={e => {
                        const cost = e.target.value
                        const sell = newMat.markup ? computeSell(cost, newMat.markup) : newMat.price
                        setNewMat(p => p ? { ...p, cost, price: sell || p.price } : p)
                      }}
                      className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                      style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    <input type="number" value={newMat.markup} min="0" step="0.1" aria-label="Markup percent"
                      onChange={e => {
                        const markup = e.target.value
                        const sell = newMat.cost ? computeSell(newMat.cost, markup) : newMat.price
                        setNewMat(p => p ? { ...p, markup, price: sell || p.price } : p)
                      }}
                      className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                      style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                    <input type="number" value={newMat.price} min="0" step="0.01" aria-label="Rate"
                      onChange={e => {
                        const price = e.target.value
                        const markup = newMat.cost ? computeMarkup(newMat.cost, price) : newMat.markup
                        setNewMat(p => p ? { ...p, price, markup: markup || p.markup } : p)
                      }}
                      className="w-full px-2 py-1 rounded-lg text-sm outline-none text-right"
                      style={{ border: `1px solid ${S.accent}`, color: S.text, background: '#fff' }} />
                    <span className="text-sm text-right font-semibold tabular-nums font-mono whitespace-nowrap" style={{ color: addTotal > 0 ? S.green : S.muted }}>
                      {addTotal > 0 ? fmtR(addTotal) : '—'}
                    </span>
                  </div>
                  {matSaving && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center pr-6">
                      <Loader2 size={12} className="animate-spin" style={{ color: S.muted }} />
                    </div>
                  )}
                  {!matSaving && (
                    <p className="text-[11px] px-5 pb-2 -mt-1" style={{ color: S.muted }}>
                      {newMat.desc.trim() ? 'Saves when you click away' : 'Describe the item to save this line'}
                    </p>
                  )}
                </div>
              )
            })()}

            {/* Materials subtotal */}
            {materials.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: `1px solid ${S.border}`, background: S.bg, paddingRight: 76 }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Subtotal</p>
                <p className="text-sm font-semibold font-mono whitespace-nowrap" style={{ color: S.muted }}>{fmtR(totalMaterials)}</p>
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

          {/* ── Office received orders on job sheet ──────────────────────── */}
          {(() => {
            const receivedOrders = matOrders.filter(o => o.status === 'received')
            if (receivedOrders.length === 0) return null
            return (
              <div className="rounded-2xl overflow-hidden mt-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'rgba(22,163,74,0.04)', borderBottom: `1px solid ${S.border}` }}>
                  <PackageCheck size={13} style={{ color: S.green }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.green }}>
                    Office Orders — Received ({receivedOrders.length})
                  </span>
                </div>
                <div className="grid px-5 py-2 text-[10px] font-bold uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1fr 60px 80px', gap: '6px', color: S.muted, background: S.bg, borderBottom: `1px solid ${S.border}` }}>
                  <span>Description</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Supplier</span>
                </div>
                {receivedOrders.map((o, i) => (
                  <div key={o.id} className="grid px-5 items-center"
                    style={{ gridTemplateColumns: '1fr 60px 80px', gap: '6px', paddingTop: 8, paddingBottom: 8, borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                    <div>
                      <span className="text-sm font-medium" style={{ color: S.text }}>{o.description}</span>
                      {o.unit && <span className="ml-1.5 text-xs" style={{ color: S.muted }}>{o.unit}</span>}
                    </div>
                    <span className="text-sm text-center tabular-nums font-mono whitespace-nowrap" style={{ color: S.muted }}>{o.qty}</span>
                    <span className="text-xs text-right truncate" style={{ color: S.muted }}>{o.supplier ?? '—'}</span>
                  </div>
                ))}
              </div>
            )
          })()}

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
                  type="number" min="0" step="0.01" inputMode="decimal" aria-label="Call-out fee in rand"
                  value={chargeDraft.callout}
                  onChange={e => setCharge('callout', 'callout_fee', e.target.value)}
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
                  type="number" min="0" step="0.25" inputMode="decimal" aria-label="Hours worked"
                  value={chargeDraft.hours}
                  onChange={e => setCharge('hours', 'labour_hours', e.target.value)}
                  className="w-20 px-2.5 py-1.5 rounded-lg text-sm outline-none text-right"
                  style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                <span className="text-xs" style={{ color: S.muted }}>hrs ×</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold" style={{ color: S.muted }}>R</span>
                  <input
                    type="number" min="0" step="1" inputMode="decimal" aria-label="Hourly rate in rand"
                    value={chargeDraft.rate}
                    onChange={e => setCharge('rate', 'labour_rate', e.target.value)}
                    className="w-24 px-2.5 py-1.5 rounded-lg text-sm outline-none text-right"
                    style={{ border: `1px solid ${S.border}`, color: S.text, background: '#fff' }} />
                  <span className="text-xs" style={{ color: S.muted }}>/hr</span>
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
        </fieldset>
      )}

      {/* ── Tab: Extra Work ──────────────────────────────────────────────── */}
      {tab === 'extras' && (
        <div>
          {extras.length > 0 && (
            <OwnerBand
              state="done"
              techName={assignedTechName}
              onSite={techOnSite}
              filledLabel={`${extras.length} item${extras.length === 1 ? '' : 's'} logged on site`}
              filledNote="Price each batch on the new job card it creates, then send it to the client."
              waitingNote=""
            />
          )}
          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="px-5 py-3" style={{ borderBottom: `1px solid ${S.border}` }}>
              <p className="text-sm font-semibold" style={{ color: S.text }}>Extra Work Reported On Site</p>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                Work the client asked for beyond this job card. Each batch becomes its own new job card with the items on its job sheet, unpriced — price it there, then send it to the client to approve.
              </p>
            </div>

            {extras.length === 0 && (
              <div className="py-10 flex flex-col items-center gap-2">
                <Wrench size={28} style={{ color: S.border }} />
                <p className="text-sm" style={{ color: S.muted }}>No extra work reported on this job</p>
              </div>
            )}

            {unsentExtras.length > 0 && (
              <div style={{ borderBottom: extrasCardGroups.length > 0 ? `1px solid ${S.border}` : undefined }}>
                <div className="flex items-center gap-2 px-5 py-2.5" style={{ background: 'rgba(217,164,65,0.06)' }}>
                  <Wrench size={13} style={{ color: S.gold }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.gold }}>
                    Not yet quoted ({unsentExtras.length})
                  </span>
                </div>
                {unsentExtras.map((x, i) => <ExtraRow key={x.id} extra={x} first={i === 0} />)}
                <div className="px-5 py-3" style={{ borderTop: `1px solid ${S.border}` }}>
                  <button onClick={() => void createExtrasQuote()} disabled={extrasSubmitting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: S.gold }}>
                    {extrasSubmitting ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                    {extrasSubmitting ? 'Creating…' : 'Create Job Card'}
                  </button>
                  {extrasMsg && <p className="text-xs mt-2" style={{ color: S.danger }}>{extrasMsg}</p>}
                </div>
              </div>
            )}

            {extrasCardGroups.map(([cardId, group], gi) => (
              <div key={cardId} style={{ borderTop: gi > 0 ? `1px solid ${S.border}` : undefined }}>
                <div className="flex items-center justify-between gap-3 px-5 py-2.5" style={{ background: 'rgba(58,124,165,0.04)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <ClipboardCheck size={13} style={{ color: S.accent }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: S.accent }}>
                      {group.card?.job_number ?? 'Job card'} · {group.items.length} item{group.items.length === 1 ? '' : 's'}
                    </span>
                    {group.card?.status && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: group.card.status === 'pending' ? 'rgba(217,164,65,0.12)' : 'rgba(22,163,74,0.1)',
                                 color: group.card.status === 'pending' ? S.gold : S.green }}>
                        {group.card.status === 'pending' ? 'Needs pricing' : group.card.status.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <Link href={`/supplier-portal/quoting/job-cards/${cardId}`}
                    className="text-xs font-semibold whitespace-nowrap" style={{ color: S.accent }}>
                    Open job card →
                  </Link>
                </div>
                {group.items.map((x, i) => <ExtraRow key={x.id} extra={x} first={i === 0} />)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Photos ──────────────────────────────────────────────────── */}
      {tab === 'photos' && (
        <div>
          <OwnerBand
            state={photos.length > 0 ? 'done' : 'waiting'}
            techName={assignedTechName}
            onSite={techOnSite}
            filledLabel={`${photos.length} photo${photos.length === 1 ? '' : 's'} from site`}
            filledNote="Add your own below if you need to."
            waitingNote="Photos are taken on the job and upload straight here."
          />
          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {photos.map(p => (
                <div key={p.id} className="relative rounded-xl overflow-hidden group"
                  style={{ aspectRatio: '1/1', background: S.bg, border: `1px solid ${S.border}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? 'Photo'} className="w-full h-full object-contain" />
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
        <div className="space-y-4">

        {/* ── 1. QUOTE SIGNED — the client agreeing to the work up front ── */}
        <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.accent }}>1 · Quote Signed</p>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                The client agreeing to the work and the price before it starts.
              </p>
            </div>
            {isApproved && <CheckCircle2 size={18} style={{ color: S.green, flexShrink: 0 }} />}
          </div>

          {isApproved ? (
            <div className="rounded-xl p-4" style={{ background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.2)' }}>
              <p className="text-sm font-semibold" style={{ color: S.green }}>
                Approved by {card.approved_by ?? 'the client'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                {fmtDateTime(card.approved_at)} · {card.approval_method === 'signature'
                  ? 'signed online from the emailed link'
                  : `recorded by the office — ${APPROVAL_METHOD_LABEL[card.approval_method ?? ''] ?? card.approval_method}`}
              </p>
              {card.approval_note && (
                <p className="text-xs mt-2" style={{ color: S.text }}>{card.approval_note}</p>
              )}
              {card.approval_signature_url && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.approval_signature_url} alt="Approval signature"
                    className="mt-3 max-h-32 w-auto rounded-lg bg-white" style={{ border: `1px solid ${S.border}` }} />
                </>
              )}
            </div>
          ) : (
            <div className="rounded-xl p-4" style={{ background: S.bg, border: `1px dashed ${S.border}` }}>
              <p className="text-sm" style={{ color: S.muted }}>Not approved yet.</p>
              <p className="text-xs mt-1" style={{ color: S.muted }}>
                Send the card as <strong>Link + PDF</strong> for the client to approve online, or record an approval they gave you another way.
              </p>
              <button onClick={() => { setApproveBy(card.client_name ?? card.client?.client_name ?? ''); setApproveNote(''); setApproveErr(''); setShowApprove(true) }}
                className="mt-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-white"
                style={{ background: S.accent }}>
                Record Approval
              </button>
            </div>
          )}
        </div>

        {/* ── 2. JOB SIGNED — the client confirming the work was done ── */}
        <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.gold }}>2 · Job Signed</p>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                The client confirming the work was done. Signed on site — never recorded for them.
              </p>
            </div>
            {isSignedOff && <CheckCircle2 size={18} style={{ color: S.green, flexShrink: 0 }} />}
          </div>
          {card.client_signature_url && !signing ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.client_signature_url} alt="Sign-off signature" className="max-h-40 w-auto rounded-xl bg-white" style={{ border: `1px solid ${S.border}` }} />
              {signedBy && (
                <p className="text-xs" style={{ color: S.muted }}>
                  Signed off by {signedBy}{signedAt ? ` — ${fmtDateTime(signedAt)}` : ''}
                </p>
              )}
              <button onClick={() => setSigning(true)}
                className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                Re-capture Signature
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs mb-3" style={{ color: S.muted }}>Hand the device to the client to sign below.</p>
              <div className="rounded-xl overflow-hidden mb-3" style={{ border: `2px solid ${S.border}`, background: '#FAFAFA', touchAction: 'none' }}>
                <canvas ref={canvasRef} width={600} height={200} className="w-full"
                  style={{ cursor: 'crosshair', display: 'block' }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
              </div>
              <div className="mb-3">
                <label htmlFor="sig-caption" className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>
                  Full name of the person signing <span style={{ color: S.danger }}>*</span>
                </label>
                <input id="sig-caption" value={sigCaption} onChange={e => setSigCaption(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${S.border}`, color: S.text }} />
                {(!sigCaption.trim() || !sigDrawn) && (
                  <p className="text-xs mt-1.5" style={{ color: S.muted }}>
                    {!sigDrawn ? 'Sign in the box above, then enter the name.' : 'Enter the name to save.'}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={clearCanvas}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                  Clear
                </button>
                <button onClick={() => void saveSignature()} disabled={sigSaving || !sigCaption.trim() || !sigDrawn}
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: S.text }}>{item.label}</p>
                    {!item.done && (
                      <p className="text-[11px]" style={{ color: S.muted }}>
                        {item.owner === 'site' ? 'Waiting on site' : 'Yours to do'}
                      </p>
                    )}
                  </div>
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
                  setSendMethod(isApproved && !card.amended_at ? 'pdf' : 'link')
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

      {/* ── COC tab ──────────────────────────────────────────────────────── */}
      {tab === 'coc' && (
        <JobCardCOCTab
          jobCardId={card.id}
          initialCOC={initialCOC}
          cocPrefix={cocPrefix}
          companyCode={companyCode}
          location={card.location}
          clientName={card.client_name ?? ((!Array.isArray(card.client) && card.client) ? card.client.client_name : null)}
          clientEmail={card.client_email ?? ((!Array.isArray(card.client) && card.client) ? card.client.email : null)}
          jobTitle={`${card.job_number} — ${card.title}`}
        />
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

      {/* ── Record approval modal — quote signed, given off-app ───────────── */}
      {showApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowApprove(false) }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: S.card }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold" style={{ color: S.text }}>Record Client Approval</h2>
              <button onClick={() => setShowApprove(false)} style={{ color: S.muted }}><X size={18} /></button>
            </div>
            <p className="text-xs mb-5" style={{ color: S.muted }}>
              For an approval the client gave you away from the app. This records the quote as signed off — it is not the job sign-off.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="approve-by" className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>
                  Who approved it <span style={{ color: S.danger }}>*</span>
                </label>
                <input id="approve-by" value={approveBy} onChange={e => setApproveBy(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${S.border}`, color: S.text }} />
              </div>
              <div>
                <label htmlFor="approve-method" className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>
                  How they approved it
                </label>
                <select id="approve-method" value={approveMethod}
                  onChange={e => setApproveMethod(e.target.value as ElecJobCardApprovalMethod)}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ border: `1px solid ${S.border}`, color: S.text }}>
                  <option value="phone">Phone</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="in_person">In person</option>
                </select>
              </div>
              <div>
                <label htmlFor="approve-note" className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>
                  Reference (optional)
                </label>
                <input id="approve-note" value={approveNote} onChange={e => setApproveNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${S.border}`, color: S.text }} />
              </div>
              {approveErr && <p className="text-xs" style={{ color: S.danger }}>{approveErr}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowApprove(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                  Cancel
                </button>
                <button onClick={() => void recordApproval()} disabled={approving || !approveBy.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: S.accent }}>
                  {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {approving ? 'Saving…' : 'Record Approval'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Send modal ───────────────────────────────────────────────────── */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: S.card }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold" style={{ color: S.text }}>
                {clientSendEnabled ? 'Send Job Card' : 'Send to the Office'}
              </h2>
              <button onClick={() => { setShowSend(false); setSendResult('') }} style={{ color: S.muted }}><X size={18} /></button>
            </div>
            {sendResult === 'success' ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <CheckCircle2 size={36} style={{ color: S.green }} />
                <p className="text-sm font-semibold" style={{ color: S.text }}>Sent successfully!</p>
                <p className="text-xs" style={{ color: S.muted }}>
                  {sendMethod === 'link' ? 'Sign link and priced PDF sent to ' : 'Priced job card PDF sent to '}{sendEmail}
                </p>
                <button onClick={() => { setShowSend(false); setSendResult('') }}
                  className="mt-2 px-6 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {!clientSendEnabled && (
                  <div className="rounded-xl px-3.5 py-2.5 flex items-start gap-2.5"
                    style={{ background: 'rgba(58,124,165,0.07)', border: `1px solid rgba(58,124,165,0.3)` }}>
                    <Lock size={14} style={{ color: S.accent, flexShrink: 0, marginTop: 1 }} />
                    <p className="text-xs leading-snug" style={{ color: S.text }}>
                      Sending job cards to clients is switched off for this company, so this goes
                      to the office only. Change it in{' '}
                      <Link href="/supplier-portal/quoting/settings" className="font-semibold" style={{ color: S.accent }}>
                        Settings
                      </Link>.
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>
                    {clientSendEnabled ? 'Client Name' : 'Reference Name'}
                  </label>
                  <input value={sendName} onChange={e => setSendName(e.target.value)} aria-label="Recipient name"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>
                    {clientSendEnabled ? 'Email Address *' : 'Office Address *'}
                  </label>
                  <input value={sendEmail} onChange={e => setSendEmail(e.target.value)} aria-label="Recipient email"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                {clientSendEnabled && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: S.muted }}>
                    How to send
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSendMethod('link')}
                      disabled={isApproved && !card.amended_at}
                      className="flex flex-col items-start gap-1.5 p-3.5 rounded-xl text-left disabled:opacity-50"
                      style={{
                        background: sendMethod === 'link' ? 'rgba(58,124,165,0.08)' : S.bg,
                        border: `1.5px solid ${sendMethod === 'link' ? S.accent : S.border}`,
                      }}>
                      <div className="flex items-center gap-1.5">
                        <Link2 size={13} style={{ color: sendMethod === 'link' ? S.accent : S.muted }} />
                        <span className="text-xs font-semibold" style={{ color: sendMethod === 'link' ? S.accent : S.text }}>
                          Link + PDF
                        </span>
                      </div>
                      <span className="text-[11px] leading-snug" style={{ color: S.muted }}>
                        {isApproved && card.amended_at
                          ? 'Edited since approval — client re-approves online'
                          : isApproved
                            ? 'Already approved — nothing left to approve'
                            : 'Client approves online, priced PDF attached too'}
                      </span>
                    </button>
                    <button
                      onClick={() => setSendMethod('pdf')}
                      className="flex flex-col items-start gap-1.5 p-3.5 rounded-xl text-left"
                      style={{
                        background: sendMethod === 'pdf' ? 'rgba(58,124,165,0.08)' : S.bg,
                        border: `1.5px solid ${sendMethod === 'pdf' ? S.accent : S.border}`,
                      }}>
                      <div className="flex items-center gap-1.5">
                        <FileText size={13} style={{ color: sendMethod === 'pdf' ? S.accent : S.muted }} />
                        <span className="text-xs font-semibold" style={{ color: sendMethod === 'pdf' ? S.accent : S.text }}>
                          PDF Only
                        </span>
                      </div>
                      <span className="text-[11px] leading-snug" style={{ color: S.muted }}>
                        Priced job card PDF attached to the email
                      </span>
                    </button>
                  </div>
                </div>
                )}
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
                    {sending ? 'Sending…' : sendMethod === 'link' ? 'Send Link + PDF' : 'Send PDF'}
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
