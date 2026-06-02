'use client'
import { useState } from 'react'
import { ShoppingCart, CheckCircle2, PackageCheck, X, ChevronDown, Filter, RefreshCw, Loader2, ExternalLink } from 'lucide-react'
import type { ElecMaterialRequest, ElecMaterialRequestStatus } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

const STATUS_CONFIG: Record<ElecMaterialRequestStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#D9A441', bg: 'rgba(217,164,65,0.1)'  },
  ordered:   { label: 'Ordered',   color: '#3A7CA5', bg: 'rgba(58,124,165,0.1)'  },
  received:  { label: 'Received',  color: '#16A34A', bg: 'rgba(22,163,74,0.1)'   },
  cancelled: { label: 'Cancelled', color: '#71717A', bg: 'rgba(113,113,122,0.1)' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  initialRequests: ElecMaterialRequest[]
  companyName: string
}

const NEXT_STATUS: Partial<Record<ElecMaterialRequestStatus, ElecMaterialRequestStatus>> = {
  pending:  'ordered',
  ordered:  'received',
}
const NEXT_LABEL: Partial<Record<ElecMaterialRequestStatus, string>> = {
  pending:  'Mark Ordered',
  ordered:  'Mark Received',
}

export function MaterialsClient({ initialRequests }: Props) {
  const [requests, setRequests] = useState<ElecMaterialRequest[]>(initialRequests)
  const [filterStatus, setFilterStatus] = useState<string>('active')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [supplierEdit, setSupplierEdit] = useState<Record<string, string>>({})
  const [refreshing, setRefreshing] = useState(false)

  const filtered = requests.filter(r => {
    const matchStatus = filterStatus === 'all'
      ? true
      : filterStatus === 'active'
        ? (r.status === 'pending' || r.status === 'ordered')
        : r.status === filterStatus
    const matchSource = filterSource === 'all' || r.source_type === filterSource
    return matchStatus && matchSource
  })

  const pendingCount  = requests.filter(r => r.status === 'pending').length
  const orderedCount  = requests.filter(r => r.status === 'ordered').length
  const receivedCount = requests.filter(r => r.status === 'received').length

  async function updateStatus(req: ElecMaterialRequest, newStatus: ElecMaterialRequestStatus) {
    setUpdatingId(req.id)
    const body: Record<string, unknown> = { status: newStatus }
    if (supplierEdit[req.id]) body.supplier = supplierEdit[req.id]
    const res = await fetch(`/api/supplier-portal/quoting/material-requests/${req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const updated = await res.json() as ElecMaterialRequest
      setRequests(prev => prev.map(r => r.id === req.id ? updated : r))
    }
    setUpdatingId(null)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await fetch(`/api/supplier-portal/quoting/material-requests/${id}`, { method: 'DELETE' })
    setRequests(prev => prev.filter(r => r.id !== id))
    setDeletingId(null)
  }

  async function refresh() {
    setRefreshing(true)
    const res = await fetch('/api/supplier-portal/quoting/material-requests')
    if (res.ok) {
      const d = await res.json() as ElecMaterialRequest[]
      setRequests(d)
    }
    setRefreshing(false)
  }

  const grouped = filtered.reduce((acc, r) => {
    const key = r.source_type === 'job_card'
      ? `job_card:${r.job_card_id}`
      : `project:${r.quote_id}`
    if (!acc[key]) acc[key] = { label: '', href: '', items: [] }
    if (r.source_type === 'job_card' && r.job_card) {
      const jc = r.job_card as { id: string; job_number: string; title: string }
      acc[key].label = `${jc.job_number} — ${jc.title}`
      acc[key].href  = `/supplier-portal/quoting/job-cards/${jc.id}`
    } else if (r.source_type === 'project' && r.quote) {
      const q = r.quote as { id: string; quote_number: string; project_name: string }
      acc[key].label = `${q.quote_number} — ${q.project_name}`
      acc[key].href  = `/supplier-portal/quoting/quotes/${q.id}`
    }
    acc[key].items.push(r)
    return acc
  }, {} as Record<string, { label: string; href: string; items: ElecMaterialRequest[] }>)

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: S.text }}>Materials</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>Track what staff need ordered, across all jobs and projects.</p>
        </div>
        <button onClick={() => void refresh()} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ border: `1px solid ${S.border}`, color: S.muted, background: S.card }}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending',  count: pendingCount,  color: STATUS_CONFIG.pending.color,  bg: STATUS_CONFIG.pending.bg,  key: 'pending'  },
          { label: 'Ordered',  count: orderedCount,  color: STATUS_CONFIG.ordered.color,  bg: STATUS_CONFIG.ordered.bg,  key: 'ordered'  },
          { label: 'Received', count: receivedCount, color: STATUS_CONFIG.received.color, bg: STATUS_CONFIG.received.bg, key: 'received' },
        ].map(s => (
          <button key={s.key} onClick={() => setFilterStatus(filterStatus === s.key ? 'all' : s.key)}
            className="rounded-2xl p-4 text-left transition-all"
            style={{
              background: filterStatus === s.key ? s.bg : S.card,
              border: `1px solid ${filterStatus === s.key ? s.color : S.border}`,
            }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</p>
            <p className="text-xs mt-0.5 font-semibold" style={{ color: S.muted }}>{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={14} style={{ color: S.muted }} />
        <div className="flex gap-2 flex-wrap">
          {[
            { val: 'active',    label: 'Active (pending + ordered)' },
            { val: 'all',       label: 'All' },
            { val: 'pending',   label: 'Pending' },
            { val: 'ordered',   label: 'Ordered' },
            { val: 'received',  label: 'Received' },
          ].map(f => (
            <button key={f.val} onClick={() => setFilterStatus(f.val)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: filterStatus === f.val ? S.accent : S.card,
                color: filterStatus === f.val ? '#fff' : S.muted,
                border: `1px solid ${filterStatus === f.val ? S.accent : S.border}`,
              }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          {['all', 'job_card', 'project'].map(src => (
            <button key={src} onClick={() => setFilterSource(src)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: filterSource === src ? '#1E2A38' : S.card,
                color: filterSource === src ? '#fff' : S.muted,
                border: `1px solid ${filterSource === src ? '#1E2A38' : S.border}`,
              }}>
              {src === 'all' ? 'All sources' : src === 'job_card' ? 'Job Cards' : 'Projects'}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-2xl py-16 flex flex-col items-center gap-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <ShoppingCart size={32} style={{ color: S.border }} />
          <p className="text-sm font-semibold" style={{ color: S.text }}>No material requests</p>
          <p className="text-xs" style={{ color: S.muted }}>Staff can request materials from the mobile app.</p>
        </div>
      )}

      {/* Grouped by job/project */}
      {Object.entries(grouped).map(([key, group]) => (
        <div key={key} className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {/* Group header */}
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(30,42,56,0.03)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: key.startsWith('job_card') ? 'rgba(58,124,165,0.1)' : 'rgba(217,164,65,0.1)', color: key.startsWith('job_card') ? S.accent : S.gold }}>
                {key.startsWith('job_card') ? 'Job Card' : 'Project'}
              </span>
              <span className="text-sm font-semibold truncate" style={{ color: S.text }}>{group.label || 'Unknown'}</span>
            </div>
            {group.href && (
              <a href={group.href}
                className="flex items-center gap-1 text-xs flex-shrink-0 ml-2"
                style={{ color: S.accent }}>
                <ExternalLink size={12} /> Open
              </a>
            )}
          </div>

          {/* Requests in this group */}
          {group.items.map((req, i) => {
            const cfg = STATUS_CONFIG[req.status]
            const nextStatus = NEXT_STATUS[req.status]
            const nextLabel  = NEXT_LABEL[req.status]
            const isUpdating = updatingId === req.id
            const isDeleting = deletingId === req.id

            return (
              <div key={req.id} className="px-5 py-4"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                <div className="flex items-start gap-4">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold" style={{ color: S.text }}>{req.description}</p>
                      {req.is_variation && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(217,164,65,0.15)', color: S.gold }}>VO</span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-xs" style={{ color: S.muted }}>
                        <span className="font-semibold" style={{ color: S.text }}>{req.qty} {req.unit ?? 'nr'}</span>
                        {req.requested_by_name ? ` · Requested by ${req.requested_by_name}` : ''}
                        {req.notes ? ` · ${req.notes}` : ''}
                      </p>
                    </div>

                    {req.line_item && (
                      <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                        Ref: {(req.line_item as { description: string }).description}
                      </p>
                    )}

                    {req.status === 'ordered' && req.ordered_at && (
                      <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                        Ordered {fmtDate(req.ordered_at)}{req.supplier ? ` · ${req.supplier}` : ''}
                      </p>
                    )}
                    {req.status === 'received' && req.received_at && (
                      <p className="text-xs mt-0.5" style={{ color: S.green }}>
                        Received {fmtDate(req.received_at)}
                      </p>
                    )}

                    <p className="text-[10px] mt-1" style={{ color: '#B0B8C4' }}>
                      {fmtDate(req.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {nextStatus && nextLabel && (
                      <div className="flex items-center gap-1.5">
                        {req.status === 'pending' && (
                          <input
                            value={supplierEdit[req.id] ?? ''}
                            onChange={e => setSupplierEdit(prev => ({ ...prev, [req.id]: e.target.value }))}
                            placeholder="Supplier (opt.)"
                            className="px-2 py-1 rounded-lg text-xs outline-none"
                            style={{ border: `1px solid ${S.border}`, width: 120, color: S.text }}
                          />
                        )}
                        <button
                          onClick={() => void updateStatus(req, nextStatus)}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                          style={{ background: nextStatus === 'received' ? S.green : S.accent }}>
                          {isUpdating
                            ? <Loader2 size={11} className="animate-spin" />
                            : nextStatus === 'received' ? <PackageCheck size={11} /> : <CheckCircle2 size={11} />}
                          {isUpdating ? '…' : nextLabel}
                        </button>
                      </div>
                    )}
                    {req.status === 'received' && (
                      <div className="flex items-center gap-1" style={{ color: S.green }}>
                        <CheckCircle2 size={14} />
                        <span className="text-xs font-semibold">Complete</span>
                      </div>
                    )}
                    {(req.status === 'pending' || req.status === 'cancelled') && (
                      <button onClick={() => void handleDelete(req.id)} disabled={isDeleting}
                        className="text-xs px-2 py-1 rounded-lg disabled:opacity-50"
                        style={{ color: S.muted, border: `1px solid ${S.border}` }}>
                        {isDeleting ? <Loader2 size={11} className="animate-spin inline" /> : <X size={11} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* Status legend */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap px-1">
          {(Object.entries(STATUS_CONFIG) as [ElecMaterialRequestStatus, typeof STATUS_CONFIG[ElecMaterialRequestStatus]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: cfg.color }} />
              <span className="text-xs" style={{ color: S.muted }}>{cfg.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
