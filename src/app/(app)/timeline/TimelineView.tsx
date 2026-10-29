'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Flag } from 'lucide-react'
import { type DeliveryState, DELIVERY_STATE_LABEL, formatDeliveryDate } from '@/lib/deliveries'
import { STATE_BADGE } from '../projects/[id]/DeliveriesPanel'

export interface TimelineRow {
  id: string
  projectId: string
  supplier: string
  item: string
  date: string | null
  /** True when the item has its own date rather than its supplier's. */
  ownDate: boolean
  state: DeliveryState
}

export interface TimelineProject {
  id: string
  label: string
  client: string | null
  installDeadline: string | null
}

type SortBy = 'date' | 'supplier' | 'project'

type Entry =
  | { kind: 'row'; row: TimelineRow }
  | { kind: 'today' }
  | { kind: 'deadline'; date: string; label: string }

const byDate = (a: TimelineRow, b: TimelineRow) =>
  (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99') || a.item.localeCompare(b.item)

/**
 * Lays out date-sorted rows with a "Today" line and installation deadline
 * markers dropped in where they fall. Undated rows go last, after every marker.
 */
function withMarkers(rows: TimelineRow[], today: string, deadlines: { date: string; label: string }[]): Entry[] {
  const dated = rows.filter(r => r.date)
  const undated = rows.filter(r => !r.date)
  const markers: { date: string; order: number; entry: Entry }[] = [
    // A delivery due today sits after the Today line; one due on the deadline day sits before its marker.
    // With nothing dated there is nothing to place against today, so the line is left out.
    ...(dated.length ? [{ date: today, order: 0, entry: { kind: 'today' } as Entry }] : []),
    ...deadlines.map(d => ({ date: d.date, order: 2, entry: { kind: 'deadline' as const, ...d } })),
  ]
  const items = [
    ...dated.map(r => ({ date: r.date!, order: 1, entry: { kind: 'row' as const, row: r } })),
    ...markers,
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
  return [...items.map(i => i.entry), ...undated.map(row => ({ kind: 'row' as const, row }))]
}

export function TimelineView({ projects, rows, today }: { projects: TimelineProject[]; rows: TimelineRow[]; today: string }) {
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [showReceived, setShowReceived] = useState(false)

  const projectById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])
  const visible = useMemo(() => rows.filter(r => showReceived || r.state !== 'received'), [rows, showReceived])

  const counts = useMemo(() => {
    const c: Record<DeliveryState, number> = { received: 0, late: 0, overdue: 0, due: 0, undated: 0 }
    for (const r of rows) c[r.state]++
    return c
  }, [rows])

  const groups = useMemo(() => {
    const deadlinesFor = (ps: TimelineProject[]) =>
      ps.filter(p => p.installDeadline).map(p => ({ date: p.installDeadline!, label: p.label }))

    if (sortBy === 'date') {
      return [{ key: 'all', title: null as string | null, sub: null as string | null, entries: withMarkers([...visible].sort(byDate), today, deadlinesFor(projects)) }]
    }
    const keyOf = (r: TimelineRow) => sortBy === 'supplier' ? r.supplier : r.projectId
    const grouped = new Map<string, TimelineRow[]>()
    for (const r of visible) grouped.set(keyOf(r), [...(grouped.get(keyOf(r)) ?? []), r])
    return [...grouped.entries()]
      .map(([key, groupRows]) => {
        const sorted = [...groupRows].sort(byDate)
        if (sortBy === 'project') {
          const p = projectById.get(key)
          return {
            key,
            title: p?.label ?? '',
            sub: [p?.client, p?.installDeadline ? `Installation ${formatDeliveryDate(p.installDeadline)}` : 'No installation deadline'].filter(Boolean).join(' · '),
            entries: withMarkers(sorted, today, p ? deadlinesFor([p]) : []),
          }
        }
        const inGroup = projects.filter(p => groupRows.some(r => r.projectId === p.id))
        return { key, title: key, sub: `${groupRows.length} item${groupRows.length === 1 ? '' : 's'}`, entries: withMarkers(sorted, today, deadlinesFor(inGroup)) }
      })
      .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
  }, [sortBy, visible, projects, projectById, today])

  if (rows.length === 0) {
    return (
      <div className="px-4 md:px-8 py-12 text-center">
        <CalendarClock size={28} className="mx-auto text-[#C4BFB5] mb-3" />
        <p className="text-sm text-[#2C2C2A]">No deliveries yet.</p>
        <p className="text-sm text-[#8A877F] mt-1">Open a project and set delivery dates in its Deliveries section.</p>
      </div>
    )
  }

  const tab = (value: SortBy, label: string) => (
    <button
      key={value}
      onClick={() => setSortBy(value)}
      aria-pressed={sortBy === value}
      className={`px-3 py-1.5 text-sm rounded cursor-pointer transition-colors focus-visible:ring-1 focus-visible:ring-[#9A7B4F] outline-none ${
        sortBy === value ? 'bg-[#2C2C2A] text-white' : 'text-[#6E6B63] hover:bg-[#EDE9E1] active:bg-[#E5DFD5]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="px-4 md:px-8 py-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1 bg-white border border-[#E8E4DC] rounded p-1">
          <span className="text-xs text-[#8A877F] px-2">Sort by</span>
          {tab('date', 'Date')}
          {tab('supplier', 'Supplier')}
          {tab('project', 'Project')}
        </div>
        <label className="flex items-center gap-2 text-sm text-[#6E6B63] cursor-pointer">
          <input type="checkbox" checked={showReceived} onChange={e => setShowReceived(e.target.checked)} className="accent-[#7E6036]" />
          Show received ({counts.received})
        </label>
        <div className="flex flex-wrap gap-2 ml-auto text-xs">
          {counts.late > 0 && <span className={`px-2 py-1 rounded ${STATE_BADGE.late}`}>{counts.late} after deadline</span>}
          {counts.overdue > 0 && <span className={`px-2 py-1 rounded ${STATE_BADGE.overdue}`}>{counts.overdue} overdue</span>}
          {counts.undated > 0 && <span className={`px-2 py-1 rounded ${STATE_BADGE.undated}`}>{counts.undated} without a date</span>}
        </div>
      </div>

      <div className="space-y-6">
        {groups.map(g => (
          <section key={g.key} className="bg-white border border-[#E8E4DC] rounded overflow-hidden">
            {g.title && (
              <header className="px-4 py-3 border-b border-[#EDE9E1] bg-[#FDFCF9]">
                {sortBy === 'project'
                  ? <Link href={`/projects/${g.key}`} className="font-medium text-sm text-[#2C2C2A] hover:text-[#7E6036] hover:underline focus-visible:underline">{g.title}</Link>
                  : <p className="font-medium text-sm text-[#2C2C2A]">{g.title}</p>}
                {g.sub && <p className="text-xs text-[#8A877F] mt-0.5">{g.sub}</p>}
              </header>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#8A877F] uppercase tracking-wider border-b border-[#EDE9E1]">
                  <th className="px-4 py-2 font-medium w-32">Date</th>
                  <th className="px-4 py-2 font-medium">Item</th>
                  {sortBy !== 'supplier' && <th className="px-4 py-2 font-medium">Supplier</th>}
                  {sortBy !== 'project' && <th className="px-4 py-2 font-medium">Project</th>}
                  <th className="px-4 py-2 font-medium w-36">Status</th>
                </tr>
              </thead>
              <tbody>
                {g.entries.map((e, i) => {
                  if (e.kind === 'today') {
                    return (
                      <tr key={`today-${i}`} aria-label="Today">
                        <td colSpan={5} className="px-4 py-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-[#9A7B4F]">
                            <span>Today · {formatDeliveryDate(today)}</span>
                            <span className="flex-1 border-t-2 border-[#9A7B4F]" />
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  if (e.kind === 'deadline') {
                    return (
                      <tr key={`deadline-${e.label}-${i}`}>
                        <td colSpan={5} className="px-4 py-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-red-700">
                            <Flag size={12} />
                            <span>Installation deadline · {formatDeliveryDate(e.date)}{sortBy !== 'project' && ` · ${e.label}`}</span>
                            <span className="flex-1 border-t border-dashed border-red-300" />
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  const r = e.row
                  const project = projectById.get(r.projectId)
                  return (
                    <tr key={r.id} className="border-b border-[#F2EFE9] last:border-0">
                      <td className="px-4 py-2 tabular-nums whitespace-nowrap text-[#2C2C2A]">
                        {r.date ? formatDeliveryDate(r.date) : <span className="text-[#A09C93]">—</span>}
                      </td>
                      <td className="px-4 py-2 text-[#2C2C2A]">{r.item}</td>
                      {sortBy !== 'supplier' && <td className="px-4 py-2 text-[#6E6B63]">{r.supplier}</td>}
                      {sortBy !== 'project' && (
                        <td className="px-4 py-2">
                          <Link href={`/projects/${r.projectId}`} className="text-[#6E6B63] hover:text-[#7E6036] hover:underline focus-visible:underline">
                            {project?.label}
                          </Link>
                        </td>
                      )}
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${STATE_BADGE[r.state]}`}>{DELIVERY_STATE_LABEL[r.state]}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  )
}
