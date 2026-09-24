'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Camera, Plus, X, Loader2, CheckCircle2, FileText, Trash2, ShoppingCart } from 'lucide-react'
import { StaffBottomNav } from '../../StaffBottomNav'
import { useStaffTrade } from '../../StaffTradeContext'
import { DevicesPanel } from '@/components/devices/DevicesPanel'
import type { ElecMaterialRequest } from '@/lib/elec-types'
import { compressImage } from '@/lib/compressImage'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: 'var(--qh-accent)',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A', gold: '#D9A441',
}

const STATUS_COLOR: Record<string, string> = {
  draft: S.muted, quoted: '#3A7CA5', approved: S.green,
  in_progress: S.gold, completed: '#166534', cancelled: S.danger,
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', quoted: 'Quoted', approved: 'Approved',
  in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
}

type Tab = 'details' | 'materials' | 'photos' | 'vo' | 'devices'

interface VOItem {
  _id: string; description: string; unit: string; qty: string
}

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

export function StaffProject({ staffId: _staffId, staffName: _staffName, portalAccountId: _portalAccountId, jobsBadge, projectsBadge, quote, sections, items, photos: initialPhotos }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('details')
  // Installers register each device on site as it goes in.
  const isInstaller = useStaffTrade() === 'installer'
  const [photos, setPhotos] = useState(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
        description: orderDesc.trim(),
        qty: parseFloat(orderQty) || 1,
        unit: orderUnit.trim() || null,
        notes: orderNotes.trim() || null,
      }),
    })
    if (res.ok) {
      const m = await res.json() as ElecMaterialRequest
      setMatOrders(prev => [...prev, m])
      setOrderDesc(''); setOrderQty('1'); setOrderUnit(''); setOrderNotes(''); setShowAddOrder(false)
    }
    setOrderSaving(false)
  }

  async function deleteOrder(orderId: string) {
    await fetch(`/api/supplier-portal/quoting/material-requests/${orderId}`, { method: 'DELETE' })
    setMatOrders(prev => prev.filter(o => o.id !== orderId))
  }

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
      fd.append('file', await compressImage(file))
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
          description: i.description.trim(),
          unit: i.unit,
          qty: parseFloat(i.qty) || 1,
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
          ...(isInstaller ? [['devices', 'Devices'] as [Tab, string]] : []),
          ['vo', 'Raise VO'],
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

        {/* ── DEVICES TAB (installers) ── */}
        {tab === 'devices' && isInstaller && (
          <DevicesPanel quoteId={quote.id} clientId={quote.client?.id ?? null} />
        )}

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
                  style={{ gridTemplateColumns: '1fr 45px 55px', gap: '8px', color: S.muted, background: 'rgba(var(--qh-accent-rgb),0.04)', borderBottom: `1px solid ${S.border}` }}>
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
                    style={{ color: S.accent, background: 'rgba(var(--qh-accent-rgb),0.06)', borderBottom: `1px solid ${S.border}` }}>
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
                    style={{ color: S.accent, border: `1px solid rgba(var(--qh-accent-rgb),0.3)` }}>
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
                const statusColor = o.status === 'received' ? S.green : o.status === 'ordered' ? '#3A7CA5' : S.gold
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
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                  <div className="flex gap-2">
                    <input value={orderQty} onChange={e => setOrderQty(e.target.value)}
                      placeholder="Qty" type="number" min="0.01" step="0.01"
                      className="w-1/3 px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                    <input value={orderUnit} onChange={e => setOrderUnit(e.target.value)}
                      placeholder="Unit (m / nr / box)"
                      className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                  </div>
                  <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                    placeholder="Notes for office (optional)"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowAddOrder(false); setOrderDesc(''); setOrderQty('1'); setOrderUnit(''); setOrderNotes('') }}
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
                  <div key={p.id} className="relative rounded-xl overflow-hidden"
                    style={{ aspectRatio: '1/1', background: S.bg, border: `1px solid ${S.border}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption ?? 'Photo'} className="w-full h-full object-contain" />
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
                    style={{ color: S.accent, background: 'rgba(var(--qh-accent-rgb),0.08)' }}>
                    <Plus size={11} /> Add
                  </button>
                </div>
                <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <div className="grid px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                    style={{ gridTemplateColumns: '1fr 60px 60px 20px', gap: '6px', color: S.muted, background: 'rgba(var(--qh-accent-rgb),0.04)', borderBottom: `1px solid ${S.border}` }}>
                    <span>Description</span>
                    <span className="text-center">Unit</span>
                    <span className="text-right">Qty</span>
                    <span />
                  </div>
                  {voItems.map((li, i) => (
                    <div key={li._id} className="grid px-3 py-2 items-center"
                      style={{ gridTemplateColumns: '1fr 60px 60px 20px', gap: '6px', borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                      <input value={li.description}
                        onChange={e => setVOItems(prev => prev.map(it => it._id === li._id ? { ...it, description: e.target.value } : it))}
                        placeholder="e.g. Extra conduit run"
                        className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }} />
                      <select value={li.unit}
                        onChange={e => setVOItems(prev => prev.map(it => it._id === li._id ? { ...it, unit: e.target.value } : it))}
                        className="w-full px-1 py-1.5 rounded-lg text-xs outline-none text-center"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }}>
                        <option value="nr">nr</option>
                        <option value="m">m</option>
                        <option value="m²">m²</option>
                        <option value="hr">hr</option>
                        <option value="set">set</option>
                        <option value="lot">lot</option>
                      </select>
                      <input type="number" value={li.qty} min="0.01"
                        onChange={e => setVOItems(prev => prev.map(it => it._id === li._id ? { ...it, qty: e.target.value } : it))}
                        className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-right"
                        style={{ border: `1px solid ${S.border}`, color: S.text, background: S.bg }} />
                      <button onClick={() => setVOItems(prev => voItems.length > 1 ? prev.filter(it => it._id !== li._id) : prev)}
                        style={{ color: voItems.length > 1 ? S.muted : 'transparent', pointerEvents: voItems.length > 1 ? 'auto' : 'none' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>{/* line items section */}

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
