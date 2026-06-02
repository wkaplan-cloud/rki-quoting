'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Camera, Plus, X, Loader2, CheckCircle2, FileText, Trash2, AlertTriangle, TrendingDown, ShoppingCart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StaffBottomNav } from '../../StaffBottomNav'
import type { ElecMaterialRequest } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A', gold: '#D9A441',
}

const STATUS_COLOR: Record<string, string> = {
  draft: S.muted, quoted: S.accent, approved: S.green,
  in_progress: S.gold, completed: '#166534', cancelled: S.danger,
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', quoted: 'Quoted', approved: 'Approved',
  in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
}

type Tab = 'details' | 'materials' | 'photos' | 'vo' | 'reporting'

interface Report {
  id: string; quote_id: string; portal_account_id: string
  report_type: string; description: string
  amount: number | null; notes: string | null; photo_url: string | null; created_at: string
}

const REPORT_TYPES = [
  { value: 'damage', label: 'Damage', color: '#DC2626' },
  { value: 'loss',   label: 'Loss',   color: '#D9A441' },
  { value: 'other',  label: 'Other',  color: '#71717A' },
]

interface VOItem { _id: string; description: string; unit: string; qty: string }

function newVOItem(): VOItem {
  return { _id: Math.random().toString(36).slice(2), description: '', unit: 'nr', qty: '1' }
}

interface Props {
  staffId: string
  staffName: string
  portalAccountId: string
  jobsBadge?: number
  projectsBadge?: number
  quote: {
    id: string; quote_number: string; project_name: string
    project_address: string | null; status: string
    client: { id: string; client_name: string; address: string | null } | null
  }
  sections: { id: string; title: string; sort_order: number }[]
  items: { id: string; section_id: string | null; description: string; unit: string | null; quoted_quantity: number; sort_order: number }[]
  photos: { id: string; url: string; caption: string | null; created_at: string }[]
}

export function StaffProject({ staffId: _staffId, staffName: _staffName, portalAccountId, jobsBadge, projectsBadge, quote, sections, items, photos: initialPhotos }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('details')
  const [photos, setPhotos] = useState(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Reporting state
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoaded, setReportsLoaded] = useState(false)
  const [showAddReport, setShowAddReport] = useState(false)
  const [rType, setRType] = useState('damage')
  const [rDesc, setRDesc] = useState('')
  const [rAmount, setRAmount] = useState('')
  const [rNotes, setRNotes] = useState('')
  const [rPhotoUrl, setRPhotoUrl] = useState<string | null>(null)
  const [rSaving, setRSaving] = useState(false)
  const [rUploading, setRUploading] = useState(false)
  const [rError, setRError] = useState('')
  const reportFileRef = useRef<HTMLInputElement>(null)

  // VO form
  const [voDesc, setVODesc] = useState('')
  const [voNotes, setVONotes] = useState('')
  const [voItems, setVOItems] = useState<VOItem[]>([newVOItem()])
  const [voSaving, setVOSaving] = useState(false)
  const [voSuccess, setVOSuccess] = useState(false)
  const [voError, setVOError] = useState('')

  // Material requests
  const [matOrders, setMatOrders] = useState<ElecMaterialRequest[]>([])
  const [matOrdersLoaded, setMatOrdersLoaded] = useState(false)
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [orderDesc, setOrderDesc] = useState('')
  const [orderQty, setOrderQty] = useState('1')
  const [orderUnit, setOrderUnit] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [orderLineItemId, setOrderLineItemId] = useState('')
  const [orderIsVO, setOrderIsVO] = useState(false)
  const [orderSaving, setOrderSaving] = useState(false)

  // Load on tab switch
  if (tab === 'materials' && !matOrdersLoaded) {
    fetch(`/api/supplier-portal/quoting/material-requests?quote_id=${quote.id}`)
      .then(r => r.json())
      .then((d: ElecMaterialRequest[]) => { setMatOrders(d); setMatOrdersLoaded(true) })
      .catch(() => setMatOrdersLoaded(true))
  }

  async function addOrder() {
    if (!orderDesc.trim() || orderSaving) return
    setOrderSaving(true)
    const res = await fetch('/api/supplier-portal/quoting/material-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_type: 'project',
        quote_id: quote.id,
        line_item_id: orderLineItemId || null,
        is_variation: orderIsVO,
        description: orderDesc.trim(),
        qty: parseFloat(orderQty) || 1,
        unit: orderUnit.trim() || null,
        notes: orderNotes.trim() || null,
      }),
    })
    if (res.ok) {
      const m = await res.json() as ElecMaterialRequest
      setMatOrders(prev => [...prev, m])
      setOrderDesc(''); setOrderQty('1'); setOrderUnit(''); setOrderNotes('')
      setOrderLineItemId(''); setOrderIsVO(false); setShowAddOrder(false)
    }
    setOrderSaving(false)
  }

  async function deleteOrder(orderId: string) {
    await fetch(`/api/supplier-portal/quoting/material-requests/${orderId}`, { method: 'DELETE' })
    setMatOrders(prev => prev.filter(o => o.id !== orderId))
  }

  async function loadReports() {
    if (reportsLoaded) return
    const { data } = await supabase
      .from('elec_project_reports')
      .select('*')
      .eq('quote_id', quote.id)
      .order('created_at', { ascending: false })
    setReports((data ?? []) as Report[])
    setReportsLoaded(true)
  }

  async function handleReportPhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setRUploading(true)
    const file = files[0]
    const path = `reports/${portalAccountId}/${quote.id}/${Date.now()}.${file.name.split('.').pop()}`
    const { error: uploadErr } = await supabase.storage.from('job-card-photos').upload(path, file, { contentType: file.type })
    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage.from('job-card-photos').getPublicUrl(path)
      setRPhotoUrl(publicUrl)
    }
    setRUploading(false)
  }

  async function handleReportSave() {
    if (!rDesc.trim() || rSaving) return
    setRSaving(true); setRError('')
    const { data, error: err } = await supabase
      .from('elec_project_reports')
      .insert({
        quote_id: quote.id,
        portal_account_id: portalAccountId,
        report_type: rType,
        description: rDesc.trim(),
        amount: rAmount ? parseFloat(rAmount) : null,
        notes: rNotes.trim() || null,
        photo_url: rPhotoUrl,
      })
      .select()
      .single()
    if (err) { setRError(err.message); setRSaving(false); return }
    setReports(prev => [data as Report, ...prev])
    setRDesc(''); setRAmount(''); setRNotes(''); setRPhotoUrl(null); setShowAddReport(false)
    setRSaving(false)
  }

  async function handleReportDelete(id: string) {
    await supabase.from('elec_project_reports').delete().eq('id', id)
    setReports(prev => prev.filter(r => r.id !== id))
  }

  if (tab === 'reporting' && !reportsLoaded) void loadReports()

  const client = !Array.isArray(quote.client) ? quote.client : null
  const address = quote.project_address || client?.address || null

  const freeItems = items.filter(i => i.section_id === null)
  const statusColor = STATUS_COLOR[quote.status] ?? S.muted
  const statusLabel = STATUS_LABEL[quote.status] ?? quote.status

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/supplier-portal/staff/projects/${quote.id}/photos`, { method: 'POST', body: fd })
      if (res.ok) {
        const p = await res.json()
        setPhotos(prev => [...prev, p])
      }
    }
    setUploading(false)
  }

  async function submitVO() {
    if (!voDesc.trim() || voSaving) return
    setVOSaving(true); setVOError('')
    const res = await fetch(`/api/supplier-portal/staff/projects/${quote.id}/vos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: voDesc.trim(),
        notes: voNotes.trim() || undefined,
        items: voItems.filter(i => i.description.trim()).map(i => ({
          description: i.description.trim(), unit: i.unit, qty: parseFloat(i.qty) || 1,
        })),
      }),
    })
    if (res.ok) {
      setVOSuccess(true)
      setVODesc(''); setVONotes(''); setVOItems([newVOItem()])
      setTimeout(() => setVOSuccess(false), 3000)
    } else {
      const d = await res.json()
      setVOError(d.error ?? 'Failed to submit')
    }
    setVOSaving(false)
  }

  return (
    <div className="staff-portal min-h-screen pb-24" style={{ background: S.bg }}>
      {/* Header */}
      <div style={{ background: '#1E2A38' }} className="px-4 pt-10 pb-5">
        <button onClick={() => router.push('/supplier-portal/staff-home?tab=projects')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold mb-4"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
          <ArrowLeft size={15} /> Projects
        </button>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-mono mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{quote.quote_number}</p>
            <h1 className="text-base font-bold text-white leading-snug">{quote.project_name}</h1>
            {client && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{client.client_name}</p>}
            {address && (
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(address)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 mt-1 text-xs"
                style={{ color: 'rgba(96,165,250,0.9)' }}>
                <MapPin size={10} />{address}
              </a>
            )}
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 px-4 pt-4 pb-2 overflow-x-auto">
        {([
          ['details', 'Line Items'],
          ['materials', `Materials${matOrders.length > 0 ? ` (${matOrders.length})` : ''}`],
          ['photos', `Photos${photos.length > 0 ? ` (${photos.length})` : ''}`],
          ['vo', 'Raise VO'],
          ['reporting', 'Report'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
            style={{
              background: tab === key ? S.accent : S.card,
              color: tab === key ? '#fff' : S.muted,
              border: `1px solid ${tab === key ? S.accent : S.border}`,
            }}>
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-2 space-y-3">

        {/* ── LINE ITEMS TAB ── */}
        {tab === 'details' && (
          <div>
            {sections.length === 0 && freeItems.length === 0 && (
              <div className="rounded-2xl py-10 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <FileText size={28} className="mx-auto mb-2" style={{ color: S.border }} />
                <p className="text-sm" style={{ color: S.muted }}>No line items on this project yet</p>
              </div>
            )}

            {freeItems.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <div className="grid px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1fr 45px 55px', gap: '8px', color: S.muted, background: 'rgba(58,124,165,0.04)', borderBottom: `1px solid ${S.border}` }}>
                  <span>Item</span><span className="text-center">Unit</span><span className="text-right">Qty</span>
                </div>
                {freeItems.map((item, i) => (
                  <div key={item.id} className="grid px-4 py-3 text-sm items-center"
                    style={{ gridTemplateColumns: '1fr 45px 55px', gap: '8px', borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                    <span style={{ color: S.text }}>{item.description}</span>
                    <span className="text-center text-xs" style={{ color: S.muted }}>{item.unit ?? '—'}</span>
                    <span className="text-right font-mono text-xs" style={{ color: S.muted }}>{item.quoted_quantity}</span>
                  </div>
                ))}
              </div>
            )}

            {sections.map(sec => {
              const secItems = items.filter(i => i.section_id === sec.id)
              if (secItems.length === 0) return null
              return (
                <div key={sec.id} className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
                    style={{ color: S.accent, background: 'rgba(58,124,165,0.06)', borderBottom: `1px solid ${S.border}` }}>
                    {sec.title || 'Section'}
                  </div>
                  <div className="grid px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
                    style={{ gridTemplateColumns: '1fr 45px 55px', gap: '8px', color: S.muted, borderBottom: `1px solid ${S.border}` }}>
                    <span>Item</span><span className="text-center">Unit</span><span className="text-right">Qty</span>
                  </div>
                  {secItems.map((item, i) => (
                    <div key={item.id} className="grid px-4 py-3 text-sm items-center"
                      style={{ gridTemplateColumns: '1fr 45px 55px', gap: '8px', borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                      <span style={{ color: S.text }}>{item.description}</span>
                      <span className="text-center text-xs" style={{ color: S.muted }}>{item.unit ?? '—'}</span>
                      <span className="text-right font-mono text-xs" style={{ color: S.muted }}>{item.quoted_quantity}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* ── MATERIALS TAB ── */}
        {tab === 'materials' && (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${S.border}` }}>
                <div className="flex items-center gap-2">
                  <ShoppingCart size={14} style={{ color: S.accent }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: S.accent }}>Materials to Order</span>
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
                <div className="py-8 flex flex-col items-center gap-1">
                  <ShoppingCart size={22} style={{ color: S.border }} />
                  <p className="text-xs" style={{ color: S.muted }}>No material requests yet</p>
                </div>
              )}

              {matOrders.map((o, i) => {
                const statusColor = o.status === 'received' ? S.green : o.status === 'ordered' ? S.accent : S.gold
                const statusLabel = o.status === 'received' ? 'Received' : o.status === 'ordered' ? 'Ordered' : 'Pending'
                return (
                  <div key={o.id} className="px-4 py-3" style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium" style={{ color: S.text }}>{o.description}</p>
                          {o.is_variation && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(217,164,65,0.15)', color: S.gold }}>VO</span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                          {o.qty} {o.unit ?? 'nr'}
                          {o.line_item ? ` · ref: ${(o.line_item as { description: string }).description}` : ''}
                          {o.notes ? ` · ${o.notes}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${statusColor}18`, color: statusColor }}>
                          {statusLabel}
                        </span>
                        {o.status === 'pending' && (
                          <button onClick={() => void deleteOrder(o.id)} style={{ color: S.muted }}>
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {showAddOrder && (
                <div className="px-4 py-3 space-y-2.5" style={{ borderTop: matOrders.length > 0 ? `1px solid ${S.border}` : undefined }}>
                  <input value={orderDesc} onChange={e => setOrderDesc(e.target.value)}
                    placeholder="What do you need? (e.g. 20m 2.5mm cable)"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                  <div className="flex gap-2">
                    <input value={orderQty} onChange={e => setOrderQty(e.target.value)}
                      placeholder="Qty" type="number" min="0.01" step="0.01"
                      className="w-1/4 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                    <input value={orderUnit} onChange={e => setOrderUnit(e.target.value)}
                      placeholder="Unit (m / nr / box)"
                      className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                  </div>
                  {items.length > 0 && (
                    <select value={orderLineItemId} onChange={e => setOrderLineItemId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ border: `1px solid ${S.border}`, background: S.bg, color: orderLineItemId ? S.text : S.muted }}>
                      <option value="">Link to quoted line item (optional)</option>
                      {items.map(item => (
                        <option key={item.id} value={item.id}>{item.description}</option>
                      ))}
                    </select>
                  )}
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={orderIsVO} onChange={e => setOrderIsVO(e.target.checked)}
                      className="rounded" />
                    <span style={{ color: S.text }}>This is extra — flag as Variation Order</span>
                  </label>
                  <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                    placeholder="Notes for office (optional)"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowAddOrder(false); setOrderDesc(''); setOrderQty('1'); setOrderUnit(''); setOrderNotes(''); setOrderLineItemId(''); setOrderIsVO(false) }}
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
          </div>
        )}

        {/* ── PHOTOS TAB ── */}
        {tab === 'photos' && (
          <div>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                {photos.map(p => (
                  <div key={p.id} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption ?? 'Photo'} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-2xl p-6 flex flex-col items-center gap-3"
              style={{ background: S.card, border: `2px dashed ${S.border}` }}>
              <Camera size={28} style={{ color: S.muted }} />
              <p className="text-sm" style={{ color: S.muted }}>{uploading ? 'Uploading…' : 'Add site photos'}</p>
              <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
                onChange={e => void handlePhotoUpload(e.target.files)} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                {uploading ? 'Uploading…' : 'Upload Photos'}
              </button>
            </div>
          </div>
        )}

        {/* ── REPORTING TAB ── */}
        {tab === 'reporting' && (
          <div className="space-y-3">

            {/* Summary */}
            {reports.length > 0 && (() => {
              const total = reports.filter(r => r.report_type !== 'other').reduce((s, r) => s + (r.amount ?? 0), 0)
              return (
                <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
                  style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Total Reported</p>
                    <p className="text-xl font-bold" style={{ color: total > 0 ? S.danger : S.text }}>
                      R {total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{ background: 'rgba(220,38,38,0.08)', color: S.danger }}>
                    {reports.length} report{reports.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )
            })()}

            {/* Report list */}
            {reports.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                {reports.map((r, i) => {
                  const rt = REPORT_TYPES.find(x => x.value === r.report_type) ?? REPORT_TYPES[2]
                  return (
                    <div key={r.id} className="px-4 py-4"
                      style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${rt.color}18` }}>
                          {rt.value === 'loss'
                            ? <TrendingDown size={14} style={{ color: rt.color }} />
                            : <AlertTriangle size={14} style={{ color: rt.color }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: rt.color }}>{rt.label}</span>
                            <span className="text-[10px]" style={{ color: S.muted }}>{new Date(r.created_at).toLocaleDateString('en-ZA')}</span>
                          </div>
                          <p className="text-sm font-medium" style={{ color: S.text }}>{r.description}</p>
                          {r.amount != null && (
                            <p className="text-sm font-bold mt-0.5" style={{ color: rt.color }}>
                              R {r.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                          {r.notes && <p className="text-xs mt-1 italic" style={{ color: S.muted }}>{r.notes}</p>}
                          {r.photo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.photo_url} alt="Report photo" className="mt-2 rounded-lg max-h-40 w-auto"
                              style={{ border: `1px solid ${S.border}` }} />
                          )}
                        </div>
                        <button onClick={() => void handleReportDelete(r.id)} className="p-1.5 flex-shrink-0"
                          style={{ color: S.muted }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add form */}
            {showAddReport ? (
              <div className="rounded-2xl p-4 space-y-4" style={{ background: S.card, border: `1.5px solid ${S.accent}` }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: S.text }}>New Report</p>
                  <button onClick={() => setShowAddReport(false)} style={{ color: S.muted }}><X size={16} /></button>
                </div>

                <div className="flex gap-2">
                  {REPORT_TYPES.map(rt => (
                    <button key={rt.value} onClick={() => setRType(rt.value)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{
                        background: rType === rt.value ? `${rt.color}15` : S.bg,
                        color: rType === rt.value ? rt.color : S.muted,
                        border: `1.5px solid ${rType === rt.value ? rt.color : S.border}`,
                      }}>
                      {rt.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Description *</label>
                  <textarea value={rDesc} onChange={e => setRDesc(e.target.value)}
                    placeholder="Describe the damage or loss…" rows={3}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                    style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Amount (R)</label>
                    <input type="number" value={rAmount} onChange={e => setRAmount(e.target.value)}
                      placeholder="0.00" min="0" step="0.01"
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Photo</label>
                    <input ref={reportFileRef} type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => void handleReportPhotoUpload(e.target.files)} />
                    <button onClick={() => reportFileRef.current?.click()} disabled={rUploading}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                      style={{ border: `1px solid ${S.border}`, background: S.bg, color: rPhotoUrl ? S.green : S.muted }}>
                      {rUploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                      {rUploading ? 'Uploading…' : rPhotoUrl ? 'Added ✓' : 'Add photo'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes (optional)</label>
                  <textarea value={rNotes} onChange={e => setRNotes(e.target.value)}
                    placeholder="Additional notes…" rows={2}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                    style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                </div>

                {rError && <p className="text-xs px-3 py-2 rounded-xl" style={{ background: '#FEF2F2', color: S.danger }}>{rError}</p>}

                <div className="flex gap-2">
                  <button onClick={() => setShowAddReport(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted, background: S.bg }}>
                    Cancel
                  </button>
                  <button onClick={() => void handleReportSave()} disabled={!rDesc.trim() || rSaving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: S.accent }}>
                    {rSaving && <Loader2 size={13} className="animate-spin" />}
                    {rSaving ? 'Saving…' : 'Add Report'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddReport(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ border: `1px solid ${S.border}`, color: S.accent, background: S.card }}>
                <Plus size={14} /> Add Report
              </button>
            )}
          </div>
        )}

        {/* ── RAISE VO TAB ── */}
        {tab === 'vo' && (
          <div className="space-y-4">
            {voSuccess && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(22,163,74,0.08)', border: `1px solid rgba(22,163,74,0.25)` }}>
                <CheckCircle2 size={16} style={{ color: S.green }} />
                <p className="text-sm font-semibold" style={{ color: S.green }}>VO submitted — admin will price it up</p>
              </div>
            )}

            <div className="rounded-2xl p-4 space-y-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <p className="text-xs" style={{ color: S.muted }}>
                Describe the variation work. Admin will review and add pricing before approving.
              </p>

              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Description *</label>
                <textarea value={voDesc} onChange={e => setVODesc(e.target.value)}
                  placeholder="What additional work is needed?" rows={3}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }} />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Notes (optional)</label>
                <textarea value={voNotes} onChange={e => setVONotes(e.target.value)}
                  placeholder="Any additional notes…" rows={2}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }} />
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold" style={{ color: S.muted }}>Line Items (optional)</label>
                  <button onClick={() => setVOItems(prev => [...prev, newVOItem()])}
                    className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
                    style={{ color: S.accent, background: 'rgba(58,124,165,0.08)' }}>
                    <Plus size={11} /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {voItems.map(li => (
                    <div key={li._id} className="flex items-center gap-2">
                      <input value={li.description} onChange={e => setVOItems(prev => prev.map(i => i._id === li._id ? { ...i, description: e.target.value } : i))}
                        placeholder="Description"
                        className="flex-1 px-2.5 py-2 rounded-xl text-sm outline-none"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }} />
                      <select value={li.unit} onChange={e => setVOItems(prev => prev.map(i => i._id === li._id ? { ...i, unit: e.target.value } : i))}
                        className="px-2 py-2 rounded-xl text-sm outline-none"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }}>
                        <option value="nr">nr</option>
                        <option value="m">m</option>
                      </select>
                      <input type="number" value={li.qty} onChange={e => setVOItems(prev => prev.map(i => i._id === li._id ? { ...i, qty: e.target.value } : i))}
                        placeholder="Qty" min="0.01"
                        className="w-16 px-2 py-2 rounded-xl text-sm outline-none text-right"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }} />
                      {voItems.length > 1 && (
                        <button onClick={() => setVOItems(prev => prev.filter(i => i._id !== li._id))}
                          style={{ color: S.muted }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {voError && (
                <p className="text-xs px-3 py-2 rounded-xl" style={{ background: '#FEF2F2', color: S.danger }}>{voError}</p>
              )}

              <button onClick={() => void submitVO()} disabled={!voDesc.trim() || voSaving}
                className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                {voSaving ? <Loader2 size={14} className="animate-spin inline mr-2" /> : null}
                {voSaving ? 'Submitting…' : 'Submit VO for Admin Review'}
              </button>
            </div>
          </div>
        )}
      </div>

      <StaffBottomNav activeTab="projects" jobsBadge={jobsBadge} projectsBadge={projectsBadge} />
    </div>
  )
}
