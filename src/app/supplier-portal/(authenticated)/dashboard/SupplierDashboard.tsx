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
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { return {} }
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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  pending:     { label: 'Awaiting response', bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1', icon: <Clock size={10} /> },
  viewed:      { label: 'Viewed',            bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', icon: <Eye size={10} /> },
  in_progress: { label: 'In progress',       bg: '#FEF9EC', text: '#92600A', border: '#F6D07A', icon: <AlertCircle size={10} /> },
  responded:   { label: 'Responded',         bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: <CheckCircle size={10} /> },
  completed:   { label: 'Completed',         bg: '#E6F4EA', text: '#2F7A4F', border: '#A7D7B5', icon: <CheckCircle size={10} /> },
  declined:    { label: 'Declined',          bg: '#F8FAFC', text: '#94A3B8', border: '#E2E8F0', icon: <Clock size={10} /> },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isClosedStatus(status: string) {
  return ['completed', 'declined'].includes(status)
}

function StudioCard({ studioName, rows, readMap, onClick }: {
  studioName: string
  rows: Row[]
  readMap: Record<string, number>
  onClick: () => void
}) {
  const open   = rows.filter(r => !isClosedStatus(r.status))
  const closed = rows.filter(r => isClosedStatus(r.status))
  const totalMessages = rows.reduce((sum, r) => sum + unreadCount(r, readMap), 0)
  const totalPending  = rows.reduce((sum, r) => sum + r.pending_item_count, 0)

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl px-5 py-4 flex items-center gap-4 transition-all group"
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#3A7CA5'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(58,124,165,0.1)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)' }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
        style={{ background: '#1E2A38', color: '#FFFFFF' }}
      >
        {studioName.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm mb-1 truncate" style={{ color: '#111827' }}>{studioName}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: '#6B7280' }}>
            {open.length} open{closed.length > 0 ? ` · ${closed.length} completed` : ''}
          </span>
          {totalPending > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: '#FEF9EC', color: '#92600A', border: '1px solid #F6D07A' }}>
              <Tag size={9} /> {totalPending} to price
            </span>
          )}
          {totalMessages > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
              <MessageSquare size={9} /> {totalMessages} new
            </span>
          )}
        </div>
      </div>

      <ArrowRight size={14} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: '#CBD5E1' }} />
    </button>
  )
}

function RequestCard({ row, readMap, onOpen }: { row: Row; readMap: Record<string, number>; onOpen: (id: string) => void }) {
  const cfg    = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pending
  const closed = isClosedStatus(row.status)
  const msgCount = unreadCount(row, readMap)

  return (
    <div
      className={`rounded-xl px-5 py-4 flex items-center gap-4 ${closed ? 'opacity-55' : ''}`}
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="font-semibold text-sm" style={{ color: '#111827' }}>
            {row.session?.title ?? '—'}
          </p>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
            style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
            {cfg.icon}
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs" style={{ color: '#9CA3AF' }}>
            {row.session?.project_name ? `${row.session.project_name} · ` : ''}
            {row.sent_at ? `Received ${formatDate(row.sent_at)}` : 'Not yet sent'}
          </p>
          {row.pending_item_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
              style={{ background: '#FEF9EC', color: '#92600A', border: '1px solid #F6D07A' }}>
              <Tag size={9} /> {row.pending_item_count} item{row.pending_item_count !== 1 ? 's' : ''} to price
            </span>
          )}
          {msgCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
              style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
              <MessageSquare size={9} /> {msgCount} new
            </span>
          )}
        </div>
      </div>

      <Link
        href={`/sourcing/respond/${row.token}`}
        onClick={() => onOpen(row.id)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold shrink-0 transition-opacity hover:opacity-80"
        style={{ background: '#3A7CA5', color: '#FFFFFF' }}
      >
        {closed ? 'View' : 'View & Price'} <ArrowRight size={11} />
      </Link>
    </div>
  )
}

function StudioDetail({ studioName, rows, readMap, onBack, onOpen }: {
  studioName: string
  rows: Row[]
  readMap: Record<string, number>
  onBack: () => void
  onOpen: (id: string) => void
}) {
  const open   = rows.filter(r => !isClosedStatus(r.status))
  const closed = rows.filter(r => isClosedStatus(r.status))

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-medium mb-5 transition-opacity hover:opacity-60"
          style={{ color: '#6B7280' }}
        >
          <ChevronLeft size={14} /> All Studios
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: '#1E2A38', color: '#FFFFFF' }}>
            {studioName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight" style={{ color: '#111827' }}>{studioName}</h1>
            <p className="text-xs" style={{ color: '#6B7280' }}>
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
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#CBD5E1' }} />
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Completed</p>
          </div>
          <div className="space-y-2">
            {closed.map(r => <RequestCard key={r.id} row={r} readMap={readMap} onOpen={onOpen} />)}
          </div>
        </div>
      )}
    </div>
  )
}

export function SupplierDashboard({ rows }: { rows: Row[] }) {
  const [selectedStudio, setSelectedStudio] = useState<string | null>(null)
  const [readMap, setReadMap] = useState<Record<string, number>>({})

  useEffect(() => { setReadMap(loadReadMap()) }, [])

  function handleOpen(rowId: string) {
    markRead(rowId)
    setReadMap(prev => ({ ...prev, [rowId]: Date.now() }))
  }

  const studioGroups = rows.reduce<Record<string, Row[]>>((acc, row) => {
    if (!acc[row.studio_name]) acc[row.studio_name] = []
    acc[row.studio_name].push(row)
    return acc
  }, {})

  const studioNames = Object.keys(studioGroups)

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#111827' }}>Price Requests</h1>
        <div className="rounded-xl p-14 text-center" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#F1F5F9' }}>
            <Building2 size={20} style={{ color: '#94A3B8' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>No price requests yet</p>
          <p className="text-sm max-w-xs mx-auto" style={{ color: '#6B7280' }}>
            Pricing requests from design studios will appear here once they send you one.
          </p>
        </div>
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

  const totalOpen   = rows.filter(r => !isClosedStatus(r.status)).length
  const totalClosed = rows.filter(r => isClosedStatus(r.status)).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#111827' }}>Price Requests</h1>
        <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
          {studioNames.length} {studioNames.length === 1 ? 'studio' : 'studios'} · {totalOpen} open{totalClosed > 0 ? ` · ${totalClosed} completed` : ''}
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
