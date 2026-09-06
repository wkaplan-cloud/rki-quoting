import Link from 'next/link'
import {
  Building2, FolderOpen, ArrowLeftRight, MessageSquare, BookOpen, Store, Zap, Hammer,
} from 'lucide-react'
import type { ActivityEvent, ActivityKind } from '@/lib/platform-activity'

const KIND_ICON: Record<ActivityKind, typeof Building2> = {
  studio: Building2,
  project: FolderOpen,
  sourcing: ArrowLeftRight,
  message: MessageSquare,
  'price-list': BookOpen,
  supplier: Store,
  contractor: Zap,
  manufacturer: Hammer,
}

const KIND_COLOR: Record<ActivityKind, string> = {
  studio: 'text-[#7E6036]',
  project: 'text-[#047857]',
  sourcing: 'text-[#0369A1]',
  message: 'text-[#B91C1C]',
  'price-list': 'text-[#0369A1]',
  supplier: 'text-[#0369A1]',
  contractor: 'text-[#8F5706]',
  manufacturer: 'text-[#C2410C]',
}

function dayLabel(iso: string, now: Date) {
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}

export function ActivityFeed({ events, nowIso }: { events: ActivityEvent[]; nowIso: string }) {
  const now = new Date(nowIso)

  if (events.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-[13px] text-[#6E6B63]">
        No platform activity recorded yet. Signups, projects, price requests and messages land here as they happen.
      </p>
    )
  }

  // Day headers are resolved up-front so the render pass stays free of state.
  const rows = events.map((event, i) => {
    const day = dayLabel(event.at, now)
    const prev = i > 0 ? dayLabel(events[i - 1].at, now) : null
    return { event, day, showDay: day !== prev }
  })

  return (
    <ol className="px-2 py-1">
      {rows.map(({ event, day, showDay }) => {
        const Icon = KIND_ICON[event.kind]
        const time = new Date(event.at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })

        const row = (
          <>
            <span className="relative flex items-center justify-center w-6 shrink-0">
              {/* The rail is the spine of the timeline; the icon sits on it. */}
              <span className="absolute top-0 bottom-0 w-px bg-[#E2DCD1]" aria-hidden />
              <span className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-[#FDFCF9] border border-[#DED8CC]">
                <Icon size={11} className={KIND_COLOR[event.kind]} />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-[#2C2C2A]">{event.title}</span>
              {event.subject && <span className="block truncate text-[11px] text-[#6E6B63]">{event.subject}</span>}
            </span>
            <span className="text-[11px] text-[#6E6B63] tabular-nums shrink-0 pt-0.5">{time}</span>
          </>
        )

        return (
          <li key={event.id}>
            {showDay && (
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E6B63]">{day}</p>
            )}
            {event.href ? (
              <Link href={event.href} className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[#EFEBE3] transition-colors duration-150">
                {row}
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-3 py-2">{row}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
