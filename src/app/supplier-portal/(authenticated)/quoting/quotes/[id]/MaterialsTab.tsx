'use client'
import { useState, useEffect } from 'react'
import { ShoppingCart, CheckCircle2, PackageCheck, Loader2, X } from 'lucide-react'
import type { ElecMaterialRequest, ElecMaterialRequestStatus } from '@/lib/elec-types'

const S = {
  card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A', bg: '#F0F2F5',
}

const STATUS_COLORS: Record<ElecMaterialRequestStatus, string> = {
  pending: S.gold, ordered: S.accent, received: S.green, cancelled: S.muted,
}
const STATUS_LABELS: Record<ElecMaterialRequestStatus, string> = {
  pending: 'Pending', ordered: 'Ordered', received: 'Received', cancelled: 'Cancelled',
}
const NEXT_STATUS: Partial<Record<ElecMaterialRequestStatus, ElecMaterialRequestStatus>> = {
  pending: 'ordered', ordered: 'received',
}
const NEXT_LABEL: Partial<Record<ElecMaterialRequestStatus, string>> = {
  pending: 'Mark Ordered', ordered: 'Mark Received',
}

interface Props {
  quoteId: string
}

export function MaterialsTab({ quoteId }: Props) {
  const [requests, setRequests] = useState<ElecMaterialRequest[]>([])
  const [loaded, setLoaded] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [supplierEdit, setSupplierEdit] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/supplier-portal/quoting/material-requests?quote_id=${quoteId}`)
      .then(r => r.json())
      .then((d: ElecMaterialRequest[]) => { setRequests(d); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [quoteId])

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
    await fetch(`/api/supplier-portal/quoting/material-requests/${id}`, { method: 'DELETE' })
    setRequests(prev => prev.filter(r => r.id !== id))
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: S.muted }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold" style={{ color: S.text }}>Material Requests</h3>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>Materials requested by staff on-site for this project.</p>
        </div>
        {requests.filter(r => r.status === 'pending').length > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(217,164,65,0.15)', color: S.gold }}>
            {requests.filter(r => r.status === 'pending').length} pending
          </span>
        )}
      </div>

      {requests.length === 0 && (
        <div className="rounded-2xl py-16 flex flex-col items-center gap-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <ShoppingCart size={28} style={{ color: S.border }} />
          <p className="text-sm" style={{ color: S.muted }}>No material requests for this project yet</p>
          <p className="text-xs" style={{ color: S.muted }}>Staff can request materials from the mobile app.</p>
        </div>
      )}

      {requests.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {requests.map((req, i) => {
            const statusColor = STATUS_COLORS[req.status]
            const nextStatus = NEXT_STATUS[req.status]
            const nextLabel  = NEXT_LABEL[req.status]
            const isUpdating = updatingId === req.id

            return (
              <div key={req.id} className="px-5 py-4" style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold" style={{ color: S.text }}>{req.description}</p>
                      {req.is_variation && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(217,164,65,0.15)', color: S.gold }}>VO</span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${statusColor}18`, color: statusColor }}>
                        {STATUS_LABELS[req.status]}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: S.muted }}>
                      <span className="font-semibold" style={{ color: S.text }}>{req.qty} {req.unit ?? 'nr'}</span>
                      {req.requested_by_name ? ` · ${req.requested_by_name}` : ''}
                      {req.notes ? ` · ${req.notes}` : ''}
                    </p>
                    {req.line_item && (
                      <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                        Ref: {(req.line_item as { description: string }).description}
                      </p>
                    )}
                    {req.ordered_at && (
                      <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                        Ordered {new Date(req.ordered_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {req.supplier ? ` · ${req.supplier}` : ''}
                      </p>
                    )}
                    {req.received_at && (
                      <p className="text-xs mt-0.5" style={{ color: S.green }}>
                        Received {new Date(req.received_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                    <p className="text-[10px] mt-1" style={{ color: '#B0B8C4' }}>
                      {new Date(req.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {nextStatus && nextLabel && (
                      <div className="flex items-center gap-1.5">
                        {req.status === 'pending' && (
                          <input
                            value={supplierEdit[req.id] ?? ''}
                            onChange={e => setSupplierEdit(prev => ({ ...prev, [req.id]: e.target.value }))}
                            placeholder="Supplier (opt.)"
                            className="px-2 py-1 rounded-lg text-xs outline-none"
                            style={{ border: `1px solid ${S.border}`, width: 110, color: S.text }}
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
                    {req.status === 'pending' && (
                      <button onClick={() => void handleDelete(req.id)}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ color: S.muted, border: `1px solid ${S.border}` }}>
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
