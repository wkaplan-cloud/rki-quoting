'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Tag, ChevronRight, Clock, CheckCircle, Send, XCircle, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { SourcingRequest, SourcingRequestStatus, SourcingRecipientStatus } from '@/lib/types'

interface RecipientRow {
  sourcing_request_id: string
  status: SourcingRecipientStatus
}

interface Props {
  requests: SourcingRequest[]
  recipients: RecipientRow[]
}

const STATUS_CONFIG: Record<SourcingRequestStatus, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-[#EDE9E1] text-[#6B6860]' },
  sent:      { label: 'Sent',      color: 'bg-blue-50 text-blue-700' },
  responded: { label: 'Responded', color: 'bg-amber-50 text-amber-700' },
  accepted:  { label: 'Accepted',  color: 'bg-emerald-50 text-emerald-700' },
  pushed:    { label: 'Pushed',    color: 'bg-purple-50 text-purple-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-600' },
}

function StatusBadge({ status }: { status: SourcingRequestStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function recipientSummary(reqs: RecipientRow[], requestId: string): string {
  const rows = reqs.filter(r => r.sourcing_request_id === requestId)
  if (rows.length === 0) return 'No suppliers added'
  const responded = rows.filter(r => ['responded', 'accepted', 'rejected'].includes(r.status)).length
  return `${responded} / ${rows.length} responded`
}

export function SourcingDashboard({ requests, recipients }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    const res = await fetch('/api/sourcing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); return }
    startTransition(() => {
      router.push(`/sourcing/${json.data.id}`)
    })
  }

  if (requests.length === 0 && !creating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-full bg-[#EDE9E1] flex items-center justify-center mb-5">
          <Tag size={22} className="text-[#9A7B4F]" />
        </div>
        <h2 className="text-lg font-semibold text-[#2C2C2A] mb-2">No pricing requests yet</h2>
        <p className="text-sm text-[#8A877F] max-w-xs mb-8">
          Request pricing from suppliers by sending them images and specs. Compare responses and push the best price into your quote.
        </p>
        <Button onClick={() => setCreating(true)}>
          <Plus size={14} /> New Request
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      {/* New request inline form */}
      {creating ? (
        <form
          onSubmit={handleCreate}
          className="mb-6 bg-white rounded-xl border border-[#EDE9E1] p-5 shadow-sm"
        >
          <p className="text-sm font-semibold text-[#2C2C2A] mb-3">New Pricing Request</p>
          <input
            autoFocus
            type="text"
            placeholder="What item needs pricing? e.g. Custom sectional sofa"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F] mb-3"
          />
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={!title.trim() || isPending}>
              <Plus size={13} /> Create
            </Button>
            <Button variant="ghost" type="button" onClick={() => { setCreating(false); setTitle('') }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex justify-end mb-4">
          <Button onClick={() => setCreating(true)} size="sm">
            <Plus size={13} /> New Request
          </Button>
        </div>
      )}

      {/* Request list */}
      <div className="space-y-2">
        {requests.map(req => (
          <button
            key={req.id}
            onClick={() => router.push(`/sourcing/${req.id}`)}
            className="w-full text-left bg-white rounded-xl border border-[#EDE9E1] px-5 py-4 hover:border-[#C4A46B] hover:shadow-sm transition-all duration-150 flex items-center gap-4 group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={req.status} />
                <span className="text-[11px] text-[#C4BFB5]">
                  {new Date(req.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p className="text-sm font-medium text-[#2C2C2A] truncate">{req.title}</p>
              <p className="text-xs text-[#8A877F] mt-0.5">{recipientSummary(recipients, req.id)}</p>
            </div>
            <ChevronRight size={15} className="text-[#C4BFB5] group-hover:text-[#9A7B4F] flex-shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  )
}
