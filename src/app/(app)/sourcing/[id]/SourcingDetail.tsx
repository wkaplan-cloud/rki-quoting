'use client'
import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send, Check, ArrowUpRight, Trash2, Plus, Upload, X, Clock, CheckCircle, XCircle, Eye, AlertCircle, PencilLine
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type {
  SourcingRequestWithRelations,
  SourcingRequestRecipient,
  SourcingRequestResponse,
  SourcingRecipientStatus,
  Supplier,
  Project,
} from '@/lib/types'

interface Props {
  request: SourcingRequestWithRelations
  allSuppliers: Supplier[]
  projects: Pick<Project, 'id' | 'project_number' | 'project_name'>[]
}

const RECIPIENT_STATUS_ICONS: Record<SourcingRecipientStatus, React.ReactNode> = {
  pending:   <Clock size={13} className="text-[#8A877F]" />,
  viewed:    <Eye size={13} className="text-blue-500" />,
  responded: <CheckCircle size={13} className="text-emerald-500" />,
  accepted:  <CheckCircle size={13} className="text-emerald-600" />,
  rejected:  <XCircle size={13} className="text-[#C4BFB5]" />,
  declined:  <XCircle size={13} className="text-red-400" />,
}

const RECIPIENT_STATUS_LABEL: Record<SourcingRecipientStatus, string> = {
  pending:   'Price Request Sent',
  viewed:    'Viewed',
  responded: 'Responded',
  accepted:  'Accepted',
  rejected:  'Not selected',
  declined:  'Declined',
}

const FIELD_LABELS: { key: string; label: string }[] = [
  { key: 'fabric_quantity', label: 'Fabric / Material Qty' },
  { key: 'fabric_unit',     label: 'Fabric Unit' },
  { key: 'supplier_notes',  label: 'Supplier Notes' },
]

function formatZAR(n: number) {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function SourcingDetail({ request, allSuppliers, projects }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isDraft = request.status === 'draft'
  const isSent = ['sent', 'responded'].includes(request.status)
  const isAccepted = request.status === 'accepted'
  const isPushed = request.status === 'pushed'
  const isCancelled = request.status === 'cancelled'
  const isTerminal = isPushed || isCancelled

  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [showPushModal, setShowPushModal] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

  // Already-added supplier ids
  const addedSupplierIds = new Set(request.recipients.map(r => r.supplier_id).filter(Boolean))
  const availableSuppliers = allSuppliers.filter(s => !addedSupplierIds.has(s.id))

  // The accepted response for display
  const acceptedRecipient = request.recipients.find(r => r.id === request.recipients.find(r2 => r2.response?.id === request.accepted_response_id)?.id)
  const acceptedResponse = request.recipients.find(r => r.response?.id === request.accepted_response_id)

  async function post(url: string, body?: object) {
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  }

  async function handleAddSupplier() {
    if (!selectedSupplierId) return
    setLoading('add-supplier')
    setError(null)
    const json = await post(`/api/sourcing/${request.id}/recipients`, { supplier_id: selectedSupplierId })
    if (json.error) { setError(json.error); setLoading(null); return }
    setSelectedSupplierId('')
    setShowAddSupplier(false)
    setLoading(null)
    startTransition(() => router.refresh())
  }

  async function handleRemoveSupplier(recipientId: string) {
    setLoading(`remove-${recipientId}`)
    setError(null)
    await fetch(`/api/sourcing/${request.id}/recipients?recipient_id=${recipientId}`, { method: 'DELETE' })
    setLoading(null)
    startTransition(() => router.refresh())
  }

  async function handleSend() {
    setLoading('send')
    setError(null)
    const json = await post(`/api/sourcing/${request.id}/send`)
    if (json.error) { setError(json.error); setLoading(null); return }
    setLoading(null)
    startTransition(() => router.refresh())
  }

  async function handleAccept(responseId: string) {
    setLoading(`accept-${responseId}`)
    setError(null)
    const json = await post(`/api/sourcing/${request.id}/accept`, { response_id: responseId })
    if (json.error) { setError(json.error); setLoading(null); return }
    setLoading(null)
    startTransition(() => router.refresh())
  }

  async function handlePush() {
    if (!selectedProjectId) return
    setLoading('push')
    setError(null)
    const json = await post(`/api/sourcing/${request.id}/push`, { project_id: selectedProjectId })
    if (json.error) { setError(json.error); setLoading(null); return }
    setLoading(null)
    setShowPushModal(false)
    startTransition(() => router.refresh())
  }

  async function handleCancel() {
    if (!confirm('Cancel this pricing request? This cannot be undone.')) return
    setLoading('cancel')
    const json = await post(`/api/sourcing/${request.id}/cancel`)
    if (json.error) { setError(json.error); setLoading(null); return }
    setLoading(null)
    startTransition(() => router.push('/sourcing'))
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('sourcing_request_id', request.id)
    const res = await fetch('/api/sourcing/images', { method: 'POST', body: form })
    const json = await res.json()
    if (json.error) { setError(json.error); setUploadingImage(false); return }
    setUploadingImage(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    startTransition(() => router.refresh())
  }

  async function handleDeleteImage(imageId: string) {
    await fetch(`/api/sourcing/images?image_id=${imageId}`, { method: 'DELETE' })
    startTransition(() => router.refresh())
  }

  // For push preview: compute sale price using accepted supplier's markup
  const pushRecipient = request.recipients.find(r => r.response?.id === request.accepted_response_id)
  const pushResponse = pushRecipient?.response
  const pushMarkup = pushRecipient?.supplier?.markup_percentage ?? 40
  const pushSalePrice = pushResponse ? pushResponse.unit_price * (1 + pushMarkup / 100) : 0

  return (
    <div className="max-w-4xl space-y-6">
      {/* Send loading overlay */}
      {loading === 'send' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
            <div className="w-10 h-10 border-2 border-[#EDE9E1] border-t-[#9A7B4F] rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold text-[#2C2C2A]">Sending pricing request…</p>
              <p className="text-xs text-[#8A877F] mt-1">Emailing all selected suppliers. This may take a moment.</p>
            </div>
          </div>
        </div>
      )}
      {/* Status banner for terminal states */}
      {isPushed && (() => {
        const pushedProject = projects.find(p => p.id === request.project_id)
        return (
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <CheckCircle size={16} className="text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-purple-800">
                Accepted — pushed to {pushedProject ? `Quote #${pushedProject.project_number} — ${pushedProject.project_name}` : 'quote'}
              </p>
              <p className="text-xs text-purple-600 mt-0.5">
                Added as a new line item on{' '}
                {request.pushed_at ? new Date(request.pushed_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}.
              </p>
            </div>
          </div>
        )
      })()}

      {isCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">This request was cancelled.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Request details ── */}
      <div className="bg-white rounded-xl border border-[#EDE9E1] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EDE9E1]">
          <h2 className="text-sm font-semibold text-[#2C2C2A]">Request Details</h2>
          {isDraft && (
            <p className="text-xs text-[#8A877F] mt-0.5">Edit this request before sending. Fields are locked after sending.</p>
          )}
        </div>
        <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-3">
          <Detail label="Item Name" value={request.title} />
          {request.work_type && <Detail label="Type of Work" value={request.work_type} />}
          {request.item_quantity != null && <Detail label="Quantity of Items" value={String(request.item_quantity)} />}
          {request.dimensions && <Detail label="Size / Dimensions" value={request.dimensions} />}
          {request.colour_finish && <Detail label="Colour / Finish" value={request.colour_finish} />}
          {request.specifications && (
            <div className="col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-1">Description / Notes</p>
              <p className="text-sm text-[#2C2C2A] leading-relaxed whitespace-pre-wrap">{request.specifications}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Images ── */}
      <div className="bg-white rounded-xl border border-[#EDE9E1] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EDE9E1] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#2C2C2A]">Reference Images</h2>
          {isDraft && (
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : 'bg-[#F5F2EC] hover:bg-[#EDE9E1] text-[#2C2C2A] border border-[#D8D3C8]'}`}>
              <Upload size={12} />
              {uploadingImage ? 'Uploading…' : 'Add Image'}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          )}
        </div>
        {uploadingImage && (
          <div className="h-1 bg-[#EDE9E1] overflow-hidden">
            <div className="h-full bg-[#9A7B4F] animate-[progress_1.4s_ease-in-out_infinite]" style={{ width: '40%', animation: 'indeterminate 1.4s ease-in-out infinite' }} />
          </div>
        )}
        <style>{`
          @keyframes indeterminate {
            0% { transform: translateX(-100%) scaleX(0.5); }
            50% { transform: translateX(60%) scaleX(0.8); }
            100% { transform: translateX(300%) scaleX(0.5); }
          }
        `}</style>
        <div className="p-5">
          {request.images.length === 0 ? (
            <p className="text-sm text-[#8A877F] text-center py-4">No images attached yet.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {request.images.map(img => (
                <div key={img.id} className="relative group w-28 h-28 rounded-lg overflow-hidden border border-[#EDE9E1]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.caption ?? ''} className="w-full h-full object-cover" />
                  {isDraft && (
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  )}
                  {img.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] px-1.5 py-0.5 truncate">{img.caption}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Suppliers / Recipients ── */}
      <div className="bg-white rounded-xl border border-[#EDE9E1] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EDE9E1] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#2C2C2A]">Suppliers</h2>
          {isDraft && !showAddSupplier && availableSuppliers.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setShowAddSupplier(true)}>
              <Plus size={12} /> Add Supplier
            </Button>
          )}
        </div>
        <div className="p-5 space-y-3">
          {isDraft && showAddSupplier && (
            <div className="flex gap-2 mb-2">
              <select
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]"
              >
                <option value="">Select a supplier…</option>
                {availableSuppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.supplier_name}{!s.email ? ' (no email)' : ''}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleAddSupplier} disabled={!selectedSupplierId || loading === 'add-supplier'}>
                {loading === 'add-supplier' ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                    Adding…
                  </span>
                ) : 'Add'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddSupplier(false); setSelectedSupplierId('') }}>
                Cancel
              </Button>
            </div>
          )}

          {request.recipients.length === 0 ? (
            <p className="text-sm text-[#8A877F] text-center py-3">No suppliers added yet.</p>
          ) : (
            request.recipients.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-[#F5F2EC] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2C2C2A]">{r.supplier_name}</p>
                  <p className="text-xs text-[#8A877F]">{r.email}</p>
                </div>
                {(r.status !== 'pending' || r.sent_at) && (
                  <div className="flex items-center gap-1.5 text-xs text-[#8A877F]">
                    {RECIPIENT_STATUS_ICONS[r.status]}
                    <span>{RECIPIENT_STATUS_LABEL[r.status]}</span>
                  </div>
                )}
                {isDraft && (
                  <button
                    onClick={() => handleRemoveSupplier(r.id)}
                    disabled={loading === `remove-${r.id}`}
                    className="text-[#C4BFB5] hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Responses comparison (when at least one response received) ── */}
      {(isSent || isAccepted || isPushed) && request.recipients.some(r => r.response) && (
        <div className="bg-white rounded-xl border border-[#EDE9E1] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#EDE9E1]">
            <h2 className="text-sm font-semibold text-[#2C2C2A]">Responses</h2>
          </div>
          <div className="divide-y divide-[#F5F2EC]">
            {request.recipients.filter(r => r.response).map(r => {
              const resp = r.response!
              const isWinner = resp.id === request.accepted_response_id
              const markup = r.supplier?.markup_percentage ?? 40
              const salePrice = resp.unit_price * (1 + markup / 100)

              return (
                <div
                  key={r.id}
                  className={`px-5 py-4 ${isWinner ? 'bg-emerald-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-semibold text-[#2C2C2A]">{r.supplier_name}</p>
                        {isWinner && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded">
                            <Check size={9} /> Accepted
                          </span>
                        )}
                        {r.status === 'rejected' && (
                          <span className="text-[10px] text-[#C4BFB5]">Not selected</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <PricePair label="Cost price" value={formatZAR(resp.unit_price)} />
                        <PricePair label={`Sale price (${markup}% markup)`} value={formatZAR(salePrice)} highlight />
                        {resp.lead_time_weeks != null && (
                          <PricePair label="Lead time" value={`${resp.lead_time_weeks} weeks`} />
                        )}
                        {resp.valid_until && (
                          <PricePair label="Valid until" value={new Date(resp.valid_until).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} />
                        )}
                      </div>
                      {resp.notes && (
                        <p className="mt-2 text-xs text-[#6B6860] leading-relaxed">{resp.notes}</p>
                      )}
                      {resp.attachment_url && (
                        <a href={resp.attachment_url} target="_blank" rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#9A7B4F] hover:underline">
                          <ArrowUpRight size={12} /> View attached document
                        </a>
                      )}
                      {resp.changed_fields && resp.changed_fields.length > 0 && resp.supplier_edits && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 mb-2 flex items-center gap-1">
                            <PencilLine size={10} /> Supplier modified {resp.changed_fields.length} field{resp.changed_fields.length !== 1 ? 's' : ''}
                          </p>
                          <div className="space-y-1.5">
                            {FIELD_LABELS.filter(f => resp.changed_fields!.includes(f.key) && resp.supplier_edits![f.key] != null).map(f => (
                              <div key={f.key} className="text-xs">
                                <span className="text-amber-600 font-medium">{f.label}:</span>
                                <span className="text-amber-800 ml-1">{String(resp.supplier_edits![f.key])}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {isSent && !isAccepted && !isTerminal && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAccept(resp.id)}
                        disabled={loading === `accept-${resp.id}`}
                      >
                        <Check size={12} />
                        {loading === `accept-${resp.id}` ? 'Accepting…' : 'Accept'}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      {!isTerminal && (
        <div className="flex items-center gap-3 flex-wrap">
          {isDraft && request.recipients.length > 0 && (
            <Button
              onClick={handleSend}
              disabled={loading === 'send'}
            >
              <Send size={13} />
              {loading === 'send' ? 'Sending…' : `Send to ${request.recipients.length} supplier${request.recipients.length !== 1 ? 's' : ''}`}
            </Button>
          )}

          {isAccepted && !isPushed && (
            <Button
              onClick={() => setShowPushModal(true)}
            >
              <ArrowUpRight size={13} />
              Push to Quote
            </Button>
          )}

          {!isTerminal && (
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={loading === 'cancel'}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              {loading === 'cancel' ? 'Cancelling…' : 'Cancel Request'}
            </Button>
          )}
        </div>
      )}

      {/* ── Push to Quote modal ── */}
      {showPushModal && pushResponse && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-[#2C2C2A] mb-1">Push to Quote</h3>
            <p className="text-sm text-[#8A877F] mb-5">
              A new line item will be added to the selected project with the accepted price pre-filled.
            </p>

            {/* Price summary */}
            <div className="bg-[#F5F2EC] border border-[#EDE9E1] rounded-xl p-4 mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-2">{pushRecipient?.supplier_name ?? 'Supplier'}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-[#8A877F]">Cost price</p>
                  <p className="text-lg font-bold text-[#2C2C2A]">{formatZAR(pushResponse.unit_price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#8A877F]">Sale price ({pushMarkup}% markup)</p>
                  <p className="text-lg font-bold text-[#9A7B4F]">{formatZAR(pushSalePrice)}</p>
                </div>
              </div>
              {pushResponse.lead_time_weeks && (
                <p className="text-xs text-[#8A877F] mt-2">Lead time: {pushResponse.lead_time_weeks} weeks</p>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">Select project</label>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]"
              >
                <option value="">Choose a project…</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowPushModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePush}
                disabled={!selectedProjectId || loading === 'push'}
              >
                <ArrowUpRight size={13} />
                {loading === 'push' ? 'Pushing…' : 'Confirm & Push'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-0.5">{label}</p>
      <p className="text-sm text-[#2C2C2A]">{value}</p>
    </div>
  )
}

function PricePair({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-[#8A877F] uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-[#9A7B4F]' : 'text-[#2C2C2A]'}`}>{value}</p>
    </div>
  )
}
