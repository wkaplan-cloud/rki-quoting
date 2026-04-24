'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Clock, Eye, CheckCircle, XCircle, Bell, BellRing } from 'lucide-react'

interface DashboardRow {
  recipient_id: string
  status: string
  sent_at: string | null
  responded_at: string | null
  request: {
    id: string
    title: string
    work_type: string | null
    status: string
  } | null
  studio_name: string
}

interface Props {
  rows: DashboardRow[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: 'Awaiting response', color: 'text-[#8A877F] bg-[#F5F2EC]', icon: <Clock size={11} /> },
  viewed:    { label: 'Viewed',            color: 'text-blue-600 bg-blue-50',     icon: <Eye size={11} /> },
  responded: { label: 'Responded',         color: 'text-emerald-700 bg-emerald-50', icon: <CheckCircle size={11} /> },
  accepted:  { label: 'Accepted',          color: 'text-emerald-700 bg-emerald-100', icon: <CheckCircle size={11} /> },
  rejected:  { label: 'Not selected',      color: 'text-[#8A877F] bg-[#F5F2EC]', icon: <XCircle size={11} /> },
  declined:  { label: 'Declined',          color: 'text-red-600 bg-red-50',       icon: <XCircle size={11} /> },
}

export function SupplierDashboard({ rows }: Props) {
  const active = rows.filter(r => !['pushed', 'cancelled'].includes(r.request?.status ?? ''))
  const archived = rows.filter(r => ['pushed', 'cancelled'].includes(r.request?.status ?? ''))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-[#2C2C2A]">Price Requests</h1>
        <p className="text-sm text-[#8A877F] mt-0.5">All pricing requests sent to your email address.</p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EDE9E1] p-12 text-center">
          <p className="text-sm font-medium text-[#2C2C2A] mb-1">No price requests yet</p>
          <p className="text-sm text-[#8A877F]">
            Price requests sent to your email address will appear here.<br />
            Make sure you registered with the same email designers use when sending you requests.
          </p>
        </div>
      ) : (
        <>
          <RequestTable rows={active} />
          {archived.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#8A877F] mb-3 px-1">Archived</p>
              <RequestTable rows={archived} dim />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function NotifyButton({ recipientId }: { recipientId: string }) {
  const [phase, setPhase] = useState<'idle' | 'open' | 'sent'>('idle')
  const [sending, setSending] = useState(false)
  const [notes, setNotes] = useState('')

  if (phase === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
        <BellRing size={12} /> Studio notified
      </span>
    )
  }

  if (phase === 'open') {
    return (
      <div className="flex flex-col gap-1.5 items-end">
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional note for studio…"
          className="w-48 text-xs px-2 py-1 border border-[#D8D3C8] rounded resize-none focus:outline-none focus:border-[#9A7B4F]"
        />
        <div className="flex gap-1">
          <button
            onClick={() => { setPhase('idle'); setNotes('') }}
            className="text-xs text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer px-2 py-1 transition-colors"
          >Cancel</button>
          <button
            disabled={sending}
            onClick={async () => {
              setSending(true)
              await fetch('/api/supplier-portal/notify-arrival', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipientId, notes: notes.trim() || undefined }),
              })
              setPhase('sent')
            }}
            className="text-xs bg-[#9A7B4F] text-white px-3 py-1 rounded cursor-pointer hover:bg-[#7d6340] transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send notification'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setPhase('open')}
      className="inline-flex items-center gap-1 text-xs text-[#9A7B4F] hover:text-[#7d6340] font-medium cursor-pointer transition-colors"
    >
      <Bell size={12} /> Notify studio
    </button>
  )
}

function RequestTable({ rows, dim }: { rows: DashboardRow[]; dim?: boolean }) {
  if (rows.length === 0) return null
  return (
    <div className={`bg-white rounded-2xl border border-[#EDE9E1] overflow-hidden ${dim ? 'opacity-60' : ''}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#EDE9E1] bg-[#FAFAF8]">
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#8A877F]">Item</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] hidden sm:table-cell">Studio</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] hidden md:table-cell">Date</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#8A877F]">Status</th>
            <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-[#8A877F]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending
            return (
              <tr key={r.recipient_id} className="border-b border-[#F5F2EC] last:border-0 hover:bg-[#FAFAF8] transition-colors">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-[#2C2C2A]">{r.request?.title ?? '—'}</p>
                  {r.request?.work_type && (
                    <p className="text-xs text-[#8A877F] mt-0.5">{r.request.work_type}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-sm text-[#8A877F] hidden sm:table-cell">{r.studio_name}</td>
                <td className="px-5 py-3.5 text-xs text-[#8A877F] hidden md:table-cell">
                  {r.sent_at ? new Date(r.sent_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.color}`}>
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex flex-col items-end gap-2">
                    <Link
                      href={`/supplier-portal/requests/${r.recipient_id}`}
                      className="text-xs text-[#9A7B4F] hover:underline font-medium"
                    >
                      View →
                    </Link>
                    {!dim && (
                      <NotifyButton recipientId={r.recipient_id} />
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
