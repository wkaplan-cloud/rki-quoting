'use client'
import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'

interface AttentionRow {
  id: string
  token: string
  studioName: string
  sessionTitle: string
  pendingCount: number
}

interface RecentRow {
  id: string
  token: string
  studioName: string
  sessionTitle: string
  status: string
  sentAt: string | null
}

interface Props {
  companyName: string
  stats: {
    activeRequests: number
    itemsToPrice: number
    studiosConnected: number
    acceptedQuotes: number
  }
  needsAttention: AttentionRow[]
  recentRequests: RecentRow[]
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  pending:     { label: 'Awaiting response', bg: '#F4F4F5', color: '#71717A' },
  viewed:      { label: 'Viewed',            bg: '#F4F4F5', color: '#52525B' },
  in_progress: { label: 'In progress',       bg: '#FFF7ED', color: '#C2610C' },
  responded:   { label: 'Responded',         bg: '#EFF6FF', color: '#2563EB' },
  completed:   { label: 'Completed',         bg: '#ECFDF5', color: '#059669' },
  declined:    { label: 'Declined',          bg: '#F4F4F5', color: '#A1A1AA' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function HomeClient({ companyName, stats, needsAttention, recentRequests }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Greeting */}
      <div>
        <p className="text-xs mb-1" style={{ color: '#A1A1AA' }}>{dateStr}</p>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#18181B' }}>
          {greeting}, {companyName}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active Requests', value: stats.activeRequests },
          { label: 'Items to Price',  value: stats.itemsToPrice,   highlight: stats.itemsToPrice > 0 },
          { label: 'Studios',         value: stats.studiosConnected },
          { label: 'Accepted Quotes', value: stats.acceptedQuotes },
        ].map(s => (
          <div
            key={s.label}
            className="bg-white rounded-xl px-5 py-4"
            style={{ border: `1px solid ${s.highlight ? '#FED7AA' : '#E4E4E7'}` }}
          >
            <p className="text-2xl font-bold mb-1" style={{ color: s.highlight ? '#C2610C' : '#18181B' }}>
              {s.value}
            </p>
            <p className="text-xs" style={{ color: '#71717A' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#A1A1AA' }}>
            Needs Your Attention
          </p>
          <div className="space-y-2">
            {needsAttention.map(r => (
              <div
                key={r.id}
                className="rounded-xl px-5 py-4 flex items-center gap-4"
                style={{ background: '#FFFBF7', border: '1px solid #FED7AA' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-0.5" style={{ color: '#A1A1AA' }}>{r.studioName}</p>
                  <p className="font-semibold text-sm truncate" style={{ color: '#18181B' }}>{r.sessionTitle}</p>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                  style={{ background: '#FFF7ED', color: '#C2610C', border: '1px solid #FED7AA' }}
                >
                  {r.pendingCount} to price
                </span>
                <Link
                  href={`/sourcing/respond/${r.token}`}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
                  style={{ background: '#34495E', color: '#FFFFFF' }}
                >
                  Price <ArrowRight size={11} />
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
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#A1A1AA' }}>
              Recent Requests
            </p>
            <Link
              href="/supplier-portal/dashboard"
              className="text-xs font-medium transition-opacity hover:opacity-60"
              style={{ color: '#9A7B4F' }}
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
                  className="bg-white rounded-xl px-5 py-3.5 flex items-center gap-4 transition-colors block"
                  style={{ border: '1px solid #E4E4E7' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#A1A1AA')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs mb-0.5" style={{ color: '#A1A1AA' }}>{r.studioName}</p>
                    <p className="font-medium text-sm truncate" style={{ color: '#18181B' }}>{r.sessionTitle}</p>
                    {r.sentAt && (
                      <p className="text-[10px] mt-0.5" style={{ color: '#A1A1AA' }}>
                        Received {formatDate(r.sentAt)}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {recentRequests.length === 0 && needsAttention.length === 0 && (
        <div className="bg-white rounded-2xl p-14 text-center" style={{ border: '1px solid #E4E4E7' }}>
          <div
            className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: '#F4F4F5' }}
          >
            <Clock size={20} style={{ color: '#A1A1AA' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#18181B' }}>All caught up</p>
          <p className="text-sm" style={{ color: '#71717A' }}>
            No price requests yet. They&apos;ll appear here once design studios send them.
          </p>
        </div>
      )}
    </div>
  )
}
