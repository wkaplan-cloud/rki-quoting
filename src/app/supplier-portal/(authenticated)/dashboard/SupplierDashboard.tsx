'use client'
import Link from 'next/link'
import { Clock, Eye, CheckCircle, AlertCircle } from 'lucide-react'

interface Row {
  id: string
  status: string
  sent_at: string | null
  token: string
  session: {
    id: string
    title: string
    status: string
    project_name: string | null
  } | null
  studio_name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:     { label: 'Awaiting your prices', color: 'text-[#8A877F] bg-[#F5F2EC]',       icon: <Clock size={11} /> },
  viewed:      { label: 'Viewed',               color: 'text-blue-600 bg-blue-50',          icon: <Eye size={11} /> },
  in_progress: { label: 'In progress',          color: 'text-amber-600 bg-amber-50',        icon: <AlertCircle size={11} /> },
  completed:   { label: 'All prices submitted', color: 'text-emerald-700 bg-emerald-50',    icon: <CheckCircle size={11} /> },
  declined:    { label: 'Declined',             color: 'text-[#8A877F] bg-[#F5F2EC]',       icon: <Clock size={11} /> },
}

export function SupplierDashboard({ rows }: { rows: Row[] }) {
  const active   = rows.filter(r => !['completed', 'declined'].includes(r.status))
  const archived = rows.filter(r => ['completed', 'declined'].includes(r.status))

  if (rows.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-[#2C2C2A] mb-1">Price Requests</h1>
        <p className="text-sm text-[#8A877F] mb-8">All pricing requests sent to your email address.</p>
        <div className="bg-white rounded-2xl border border-[#EDE9E1] p-12 text-center">
          <p className="text-sm font-medium text-[#2C2C2A] mb-1">No price requests yet</p>
          <p className="text-sm text-[#8A877F] max-w-sm mx-auto">
            Pricing requests from design studios will appear here. Make sure designers have your registered email address.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-[#2C2C2A]">Price Requests</h1>
        <p className="text-sm text-[#8A877F] mt-0.5">{active.length} open, {archived.length} completed</p>
      </div>

      {active.length > 0 && <RequestTable rows={active} />}

      {archived.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8A877F] mb-3 px-1">Completed</p>
          <RequestTable rows={archived} dim />
        </div>
      )}
    </div>
  )
}

function RequestTable({ rows, dim }: { rows: Row[]; dim?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#EDE9E1] overflow-hidden ${dim ? 'opacity-60' : ''}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#EDE9E1] bg-[#FAFAF8]">
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#8A877F]">Session</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] hidden sm:table-cell">Studio</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] hidden md:table-cell">Received</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#8A877F]">Status</th>
            <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-[#8A877F]"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending
            return (
              <tr key={r.id} className="border-b border-[#F5F2EC] last:border-0 hover:bg-[#FAFAF8] transition-colors">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-[#2C2C2A]">{r.session?.title ?? '—'}</p>
                  {r.session?.project_name && (
                    <p className="text-xs text-[#8A877F] mt-0.5">{r.session.project_name}</p>
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
                  <Link
                    href={`/sourcing/respond/${r.token}`}
                    className="text-xs text-[#9A7B4F] hover:underline font-medium"
                  >
                    View &amp; Price →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
