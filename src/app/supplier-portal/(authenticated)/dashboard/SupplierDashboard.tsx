'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Clock, Eye, CheckCircle, AlertCircle, ArrowRight, ChevronLeft, Building2, MessageSquare, Tag } from 'lucide-react'

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
  designer_message_timestamps: string[]
  pending_item_count: number
}

const LS_KEY = 'qh_supplier_read'

function loadReadMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function markRead(rowId: string) {
  try {
    const map = loadReadMap()
    map[rowId] = Date.now()
    localStorage.setItem(LS_KEY, JSON.stringify(map))
  } catch {}
}

function unreadCount(row: Row, readMap: Record<string, number>): number {
  const lastRead = readMap[row.id] ?? 0
  return row.designer_message_timestamps.filter(ts => new Date(ts).getTime() > lastRead).length
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

function isClosedStatus(status: string) {
  return ['completed', 'declined'].includes(status)
}

// ---- Studio Cards (Level 1) ----
function StudioCard({ studioName, rows, readMap, onClick }: {
  studioName: string
  rows: Row[]
  readMap: Record<string, number>
  onClick: () => void
}) {
  const open = rows.filter(r => !isClosedStatus(r.status))
  const closed = rows.filter(r => isClosedStatus(r.status))
  const totalMessages = rows.reduce((sum, r) => sum + unreadCount(r, readMap), 0)
  const totalPending = rows.reduce((sum, r) => sum + r.pending_item_count, 0)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl px-5 py-4 flex items-center gap-4 transition-all hover:shadow-sm group"
      style={{ border: '1px solid #E4E4E7' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#A1A1AA')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
    >
      <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0"
        style={{ background: '#34495E', color: '#FFFFFF' }}>
        {studioName.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate mb-1" style={{ color: '#18181B' }}>{studioName}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: '#71717A' }}>
            {open.length} open{closed.length > 0 ? ` · ${closed.length} completed` : ''}
          </span>
          {totalPending > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: '#FFF7ED', color: '#C2610C', border: '1px solid #FED7AA' }}>
              <Tag size={9} /> {totalPending} to price
            </span>
          )}
          {totalMessages > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
              <MessageSquare size={9} /> {totalMessages} new message{totalMessages !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <ArrowRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: '#A1A1AA' }} />
    </button>
  )
}

// ---- Request Cards (Level 2) ----
function RequestCard({ row, readMap, onOpen }: { row: Row; readMap: Record<string, number>; onOpen: (id: string) => void }) {
  const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pending
  const closed = isClosedStatus(row.status)
  const msgCount = unreadCount(row, readMap)

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
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs" style={{ color: '#A1A1AA' }}>
            {row.session?.project_name ? `${row.session.project_name} · ` : ''}
            {row.sent_at ? `Received ${formatDate(row.sent_at)}` : 'Not yet sent'}
          </p>
          {row.pending_item_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: '#FFF7ED', color: '#C2610C', border: '1px solid #FED7AA' }}>
              <Tag size={9} /> {row.pending_item_count} item{row.pending_item_count !== 1 ? 's' : ''} to price
            </span>
          )}
          {msgCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
              <MessageSquare size={9} /> {msgCount} new message{msgCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <Link
        href={`/sourcing/respond/${row.token}`}
        onClick={() => onOpen(row.id)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold shrink-0 transition-opacity hover:opacity-70"
        style={{ background: '#34495E', color: '#FFFFFF' }}
      >
        View &amp; Price <ArrowRight size={11} />
      </Link>
    </div>
  )
}

// ---- Studio Detail (Level 2 view) ----
function StudioDetail({ studioName, rows, readMap, onBack, onOpen }: {
  studioName: string
  rows: Row[]
  readMap: Record<string, number>
  onBack: () => void
  onOpen: (id: string) => void
}) {
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
            style={{ background: '#34495E', color: '#FFFFFF' }}>
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
          {open.map(r => <RequestCard key={r.id} row={r} readMap={readMap} onOpen={onOpen} />)}
        </div>
      )}

      {closed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#A1A1AA' }}>Completed</p>
          {closed.map(r => <RequestCard key={r.id} row={r} readMap={readMap} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  )
}

// ---- Main ----
export function SupplierDashboard({ rows }: { rows: Row[] }) {
  const [selectedStudio, setSelectedStudio] = useState<string | null>(null)
  const [readMap, setReadMap] = useState<Record<string, number>>({})

  useEffect(() => {
    setReadMap(loadReadMap())
  }, [])

  function handleOpen(rowId: string) {
    markRead(rowId)
    setReadMap(prev => ({ ...prev, [rowId]: Date.now() }))
  }

  const studioGroups = rows.reduce<Record<string, Row[]>>((acc, row) => {
    const key = row.studio_name
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
  }, {})

  const studioNames = Object.keys(studioGroups)

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
            {open.map(r => <RequestCard key={r.id} row={r} readMap={readMap} onOpen={handleOpen} />)}
          </div>
        )}
        {closed.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#A1A1AA' }}>Completed</p>
            {closed.map(r => <RequestCard key={r.id} row={r} readMap={readMap} onOpen={handleOpen} />)}
          </div>
        )}
      </div>
    )
  }

  if (selectedStudio) {
    return (
      <StudioDetail
        studioName={selectedStudio}
        rows={studioGroups[selectedStudio]}
        readMap={readMap}
        onBack={() => setSelectedStudio(null)}
        onOpen={handleOpen}
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
            readMap={readMap}
            onClick={() => setSelectedStudio(name)}
          />
        ))}
      </div>
    </div>
  )
}
