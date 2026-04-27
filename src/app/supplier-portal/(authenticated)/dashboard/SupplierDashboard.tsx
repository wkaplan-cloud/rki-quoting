'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Clock, Eye, CheckCircle, AlertCircle, ArrowRight, ChevronLeft, Building2 } from 'lucide-react'

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
  pending:     { label: 'Awaiting response', bg: '#F4F4F5', text: '#71717A',  icon: <Clock size={11} /> },
  viewed:      { label: 'Viewed',            bg: '#F4F4F5', text: '#52525B',  icon: <Eye size={11} /> },
  in_progress: { label: 'In progress',       bg: '#FFF7ED', text: '#C2610C',  icon: <AlertCircle size={11} /> },
  responded:   { label: 'Responded',         bg: '#EFF6FF', text: '#2563EB',  icon: <CheckCircle size={11} /> },
  completed:   { label: 'Completed',         bg: '#ECFDF5', text: '#059669',  icon: <CheckCircle size={11} /> },
  declined:    { label: 'Declined',          bg: '#F4F4F5', text: '#A1A1AA',  icon: <Clock size={11} /> },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function needsAction(status: string) {
  return ['pending', 'viewed', 'in_progress'].includes(status)
}

function isClosedStatus(status: string) {
  return ['completed', 'declined'].includes(status)
}

// ---- Studio Cards (Level 1) ----
function StudioCard({ studioName, rows, onClick }: { studioName: string; rows: Row[]; onClick: () => void }) {
  const open = rows.filter(r => !isClosedStatus(r.status))
  const closed = rows.filter(r => isClosedStatus(r.status))
  const actionCount = rows.filter(r => needsAction(r.status)).length

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl px-5 py-4 flex items-center gap-4 transition-all hover:shadow-sm group"
      style={{ border: '1px solid #E4E4E7' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#A1A1AA')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
    >
      {/* Avatar */}
      <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0"
        style={{ background: '#3F3F46', color: '#FAFAFA' }}>
        {studioName.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold text-sm truncate" style={{ color: '#18181B' }}>{studioName}</p>
          {actionCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: '#F59E0B', color: '#18181B' }}>
              {actionCount} pending
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: '#71717A' }}>
          {open.length} open{closed.length > 0 ? ` · ${closed.length} completed` : ''}
        </p>
      </div>

      <ArrowRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: '#A1A1AA' }} />
    </button>
  )
}

// ---- Request Cards (Level 2) ----
function RequestCard({ row }: { row: Row }) {
  const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pending
  const closed = isClosedStatus(row.status)

  return (
    <div className={`bg-white rounded-xl px-5 py-4 flex items-center gap-4 ${closed ? 'opacity-60' : ''}`}
      style={{ border: '1px solid #E4E4E7' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="font-semibold text-sm" style={{ color: '#18181B' }}>
            {row.session?.title ?? '—'}
          </p>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
            style={{ background: cfg.bg, color: cfg.text }}>
            {cfg.icon}
            {cfg.label}
          </span>
        </div>
        <p className="text-xs" style={{ color: '#A1A1AA' }}>
          {row.session?.project_name ? `${row.session.project_name} · ` : ''}
          {row.sent_at ? `Received ${formatDate(row.sent_at)}` : 'Not yet sent'}
        </p>
      </div>

      <Link
        href={`/sourcing/respond/${row.token}`}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold shrink-0 transition-opacity hover:opacity-70"
        style={{ background: '#3F3F46', color: '#FAFAFA' }}
      >
        View &amp; Price <ArrowRight size={11} />
      </Link>
    </div>
  )
}

// ---- Studio Detail (Level 2 view) ----
function StudioDetail({ studioName, rows, onBack }: { studioName: string; rows: Row[]; onBack: () => void }) {
  const open = rows.filter(r => !isClosedStatus(r.status))
  const closed = rows.filter(r => isClosedStatus(r.status))

  return (
    <div className="space-y-6">
      <div>
        <button onClick={onBack}
          className="flex items-center gap-1 text-sm mb-4 transition-opacity hover:opacity-60"
          style={{ color: '#71717A' }}>
          <ChevronLeft size={15} /> All Studios
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: '#3F3F46', color: '#FAFAFA' }}>
            {studioName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight" style={{ color: '#18181B' }}>{studioName}</h1>
            <p className="text-xs" style={{ color: '#71717A' }}>
              {open.length} open · {closed.length} completed
            </p>
          </div>
        </div>
      </div>

      {open.length > 0 && (
        <div className="space-y-2">
          {open.map(r => <RequestCard key={r.id} row={r} />)}
        </div>
      )}

      {closed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#A1A1AA' }}>Completed</p>
          {closed.map(r => <RequestCard key={r.id} row={r} />)}
        </div>
      )}
    </div>
  )
}

// ---- Main ----
export function SupplierDashboard({ rows }: { rows: Row[] }) {
  const [selectedStudio, setSelectedStudio] = useState<string | null>(null)

  // Group by studio
  const studioGroups = rows.reduce<Record<string, Row[]>>((acc, row) => {
    const key = row.studio_name
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
  }, {})

  const studioNames = Object.keys(studioGroups)

  // Empty state
  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181B' }}>Price Requests</h1>
        <div className="bg-white rounded-xl p-14 text-center" style={{ border: '1px solid #E4E4E7' }}>
          <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#F4F4F5' }}>
            <Building2 size={20} style={{ color: '#71717A' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#18181B' }}>No price requests yet</p>
          <p className="text-sm max-w-xs mx-auto" style={{ color: '#71717A' }}>
            Pricing requests from design studios will appear here once they send you one.
          </p>
        </div>
      </div>
    )
  }

  // Single studio — skip level 1, go straight to their requests
  if (studioNames.length === 1) {
    const name = studioNames[0]
    const open = studioGroups[name].filter(r => !isClosedStatus(r.status))
    const closed = studioGroups[name].filter(r => isClosedStatus(r.status))

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181B' }}>Price Requests</h1>
          <p className="text-xs mt-0.5" style={{ color: '#71717A' }}>
            From {name} · {open.length} open{closed.length > 0 ? ` · ${closed.length} completed` : ''}
          </p>
        </div>
        {open.length > 0 && (
          <div className="space-y-2">
            {open.map(r => <RequestCard key={r.id} row={r} />)}
          </div>
        )}
        {closed.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#A1A1AA' }}>Completed</p>
            {closed.map(r => <RequestCard key={r.id} row={r} />)}
          </div>
        )}
      </div>
    )
  }

  // Multiple studios — show studio cards, drill in on click
  if (selectedStudio) {
    return (
      <StudioDetail
        studioName={selectedStudio}
        rows={studioGroups[selectedStudio]}
        onBack={() => setSelectedStudio(null)}
      />
    )
  }

  const totalOpen = rows.filter(r => !isClosedStatus(r.status)).length
  const totalClosed = rows.filter(r => isClosedStatus(r.status)).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181B' }}>Price Requests</h1>
        <p className="text-xs mt-0.5" style={{ color: '#71717A' }}>
          {studioNames.length} studios · {totalOpen} open{totalClosed > 0 ? ` · ${totalClosed} completed` : ''}
        </p>
      </div>

      <div className="space-y-2">
        {studioNames.map(name => (
          <StudioCard
            key={name}
            studioName={name}
            rows={studioGroups[name]}
            onClick={() => setSelectedStudio(name)}
          />
        ))}
      </div>
    </div>
  )
}
