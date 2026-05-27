'use client'
import Link from 'next/link'
import { ArrowRight, Clock, TrendingUp, Package, Building2, CheckCircle2, Info } from 'lucide-react'

interface AttentionRow {
  id: string
  token: string
  studioName: string
  sessionTitle: string
  requestRef: string | null
  pendingCount: number
}

interface RecentRow {
  id: string
  token: string
  studioName: string
  sessionTitle: string
  requestRef: string | null
  status: string
  sentAt: string | null
}

interface Props {
  companyName: string
  hasQuoting: boolean
  stats: {
    activeRequests: number
    itemsToPrice: number
    studiosConnected: number
    acceptedQuotes: number
  }
  needsAttention: AttentionRow[]
  recentRequests: RecentRow[]
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending:     { label: 'Awaiting response', bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
  viewed:      { label: 'Viewed',            bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
  in_progress: { label: 'In progress',       bg: '#FEF9EC', color: '#92600A', border: '#F6D07A' },
  responded:   { label: 'Responded',         bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  completed:   { label: 'Completed',         bg: '#E6F4EA', color: '#2F7A4F', border: '#A7D7B5' },
  declined:    { label: 'Declined',          bg: '#F8FAFC', color: '#94A3B8', border: '#E2E8F0' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function HomeClient({ companyName, hasQuoting, stats, needsAttention, recentRequests }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const statCards = [
    { label: 'Active Requests',  value: stats.activeRequests,    icon: TrendingUp,   alert: false },
    { label: 'Items to Price',   value: stats.itemsToPrice,      icon: Package,      alert: stats.itemsToPrice > 0 },
    { label: 'Studios',          value: stats.studiosConnected,  icon: Building2,    alert: false },
    { label: 'Accepted Quotes',  value: stats.acceptedQuotes,    icon: CheckCircle2, alert: false },
  ]

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div>
        <p className="text-xs font-medium mb-1" style={{ color: '#94A3B8' }}>{dateStr}</p>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#111827' }}>
          {greeting}, <span style={{ color: '#1E2A38' }}>{companyName}</span>
        </h1>
      </div>

      {/* Platform notice — only for non-quoting (manufacturer) accounts */}
      {!hasQuoting && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(58,124,165,0.06)', border: '1px solid rgba(58,124,165,0.15)' }}>
          <Info size={14} style={{ color: '#3A7CA5', flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs leading-relaxed" style={{ color: '#4B6B8A' }}>
            <span className="font-semibold" style={{ color: '#1E2A38' }}>Price Requests is designed for manufacturers & product suppliers.</span>
            {' '}A <span className="font-semibold">1% platform fee</span> applies to the value of all accepted price requests. This fee is invoiced monthly.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, alert }) => (
          <div
            key={label}
            className="rounded-xl px-5 py-4"
            style={{
              background: '#FFFFFF',
              border: `1px solid ${alert ? '#F6D07A' : '#E5E7EB'}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-2xl font-bold" style={{ color: alert ? '#92600A' : '#111827' }}>{value}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: alert ? '#FEF9EC' : '#F1F5F9' }}>
                <Icon size={15} style={{ color: alert ? '#D9A441' : '#3A7CA5' }} />
              </div>
            </div>
            <p className="text-xs font-medium" style={{ color: '#6B7280' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#D9A441' }} />
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>
              Needs Attention
            </p>
          </div>
          <div className="space-y-2">
            {needsAttention.map(r => (
              <div
                key={r.id}
                className="rounded-xl px-5 py-4 flex items-center gap-4"
                style={{
                  background: '#FFFDF5',
                  border: '1px solid #F6D07A',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: '#D9A441' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium mb-0.5" style={{ color: '#94A3B8' }}>
                    {r.requestRef ? <span className="font-mono mr-1">{r.requestRef} ·</span> : null}{r.studioName}
                  </p>
                  <p className="font-semibold text-sm truncate" style={{ color: '#111827' }}>{r.sessionTitle}</p>
                </div>
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-md shrink-0"
                  style={{ background: '#FEF9EC', color: '#92600A', border: '1px solid #F6D07A' }}
                >
                  {r.pendingCount} to price
                </span>
                <Link
                  href={`/sourcing/respond/${r.token}`}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ background: '#3A7CA5', color: '#FFFFFF' }}
                >
                  Price items <ArrowRight size={11} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent requests */}
      {recentRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#3A7CA5' }} />
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>
                Recent Requests
              </p>
            </div>
            <Link
              href="/supplier-portal/dashboard"
              className="text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: '#3A7CA5' }}
            >
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {recentRequests.map(r => {
              const cfg = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending
              return (
                <Link
                  key={r.id}
                  href={`/sourcing/respond/${r.token}`}
                  className="rounded-xl px-5 py-3.5 flex items-center gap-4 transition-all block"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3A7CA5'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(58,124,165,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium mb-0.5" style={{ color: '#94A3B8' }}>
                      {r.requestRef ? <span className="font-mono mr-1">{r.requestRef} ·</span> : null}{r.studioName}
                    </p>
                    <p className="font-semibold text-sm truncate" style={{ color: '#111827' }}>{r.sessionTitle}</p>
                    {r.sentAt && (
                      <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>
                        Received {formatDate(r.sentAt)}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-md shrink-0"
                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                  >
                    {cfg.label}
                  </span>
                  <ArrowRight size={14} style={{ color: '#CBD5E1' }} />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {recentRequests.length === 0 && needsAttention.length === 0 && (
        <div className="rounded-xl p-14 text-center" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#F1F5F9' }}>
            <Clock size={20} style={{ color: '#94A3B8' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>All caught up</p>
          <p className="text-sm" style={{ color: '#6B7280' }}>
            No price requests yet. They&apos;ll appear here once design studios send them your way.
          </p>
        </div>
      )}
    </div>
  )
}
