'use client'
import Link from 'next/link'
import { Clock, Eye, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'

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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  pending:     { label: 'Awaiting response', bg: '#EBF0F5', text: '#4A7FA5', icon: <Clock size={11} /> },
  viewed:      { label: 'Viewed',            bg: '#EBF5FF', text: '#2563EB', icon: <Eye size={11} /> },
  in_progress: { label: 'In progress',       bg: '#FFF7ED', text: '#C2610C', icon: <AlertCircle size={11} /> },
  completed:   { label: 'Completed',         bg: '#ECFDF5', text: '#059669', icon: <CheckCircle size={11} /> },
  declined:    { label: 'Declined',          bg: '#F5F5F5', text: '#737373', icon: <Clock size={11} /> },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SupplierDashboard({ rows }: { rows: Row[] }) {
  const active   = rows.filter(r => !['completed', 'declined'].includes(r.status))
  const archived = rows.filter(r => ['completed', 'declined'].includes(r.status))

  return (
    <div className="space-y-7">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#1C2B3A' }}>Price Requests</h1>
          <p className="text-sm mt-0.5" style={{ color: '#5A7A95' }}>
            {active.length} open · {archived.length} completed
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border p-14 text-center" style={{ borderColor: '#D8E4EF' }}>
          <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#EBF0F5' }}>
            <Clock size={20} style={{ color: '#4A7FA5' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#1C2B3A' }}>No price requests yet</p>
          <p className="text-sm max-w-xs mx-auto" style={{ color: '#5A7A95' }}>
            Pricing requests from design studios will appear here once they send you a session.
          </p>
        </div>
      ) : (
        <>
          {active.length > 0 && <RequestTable rows={active} />}
          {archived.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-0.5" style={{ color: '#7A9AB8' }}>Completed</p>
              <RequestTable rows={archived} dim />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RequestTable({ rows, dim }: { rows: Row[]; dim?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${dim ? 'opacity-60' : ''}`} style={{ borderColor: '#D8E4EF' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #E8F0F8', background: '#F7FAFC' }}>
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#7A9AB8' }}>Session</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest hidden sm:table-cell" style={{ color: '#7A9AB8' }}>Studio</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell" style={{ color: '#7A9AB8' }}>Received</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#7A9AB8' }}>Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending
            return (
              <tr key={r.id} className="transition-colors hover:bg-[#F7FAFC]" style={{ borderBottom: '1px solid #F0F4F8' }}>
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-sm" style={{ color: '#1C2B3A' }}>{r.session?.title ?? '—'}</p>
                  {r.session?.project_name && (
                    <p className="text-xs mt-0.5" style={{ color: '#7A9AB8' }}>{r.session.project_name}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-sm hidden sm:table-cell" style={{ color: '#5A7A95' }}>{r.studio_name}</td>
                <td className="px-5 py-3.5 text-xs hidden md:table-cell" style={{ color: '#7A9AB8' }}>
                  {r.sent_at ? formatDate(r.sent_at) : '—'}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background: cfg.bg, color: cfg.text }}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Link
                    href={`/sourcing/respond/${r.token}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                    style={{ color: '#3B82F6' }}
                  >
                    View &amp; Price <ArrowRight size={11} />
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
