'use client'
import Link from 'next/link'

/** Person and date-range pickers. Plain links so the page stays a server
 *  component and every filtered view is its own shareable URL. */
export function ActivityFilters({
  people,
  who,
  days,
  maxDays,
}: {
  people: string[]
  who: string | null
  days: number
  maxDays: number
}) {
  const ranges = [7, 14, maxDays]

  const href = (next: { who?: string | null; days?: number }) => {
    const params = new URLSearchParams()
    const person = next.who === undefined ? who : next.who
    const range = next.days ?? days
    if (person) params.set('who', person)
    if (range !== 14) params.set('days', String(range))
    const qs = params.toString()
    return qs ? `/studio/activity?${qs}` : '/studio/activity'
  }

  const chip = (active: boolean) =>
    `px-3 py-1.5 text-xs rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7B4F] ${
      active
        ? 'bg-[#1A1A18] border-[#1A1A18] text-white'
        : 'bg-white border-[#D8D3C8] text-[#2C2C2A] hover:border-[#9A7B4F]'
    }`

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[#8A877F] mr-1">Person</span>
        <Link href={href({ who: null })} className={chip(!who)}>
          Everyone
        </Link>
        {people.map(p => (
          <Link key={p} href={href({ who: p })} className={chip(who === p)}>
            {p}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[#8A877F] mr-1">Period</span>
        {ranges.map(r => (
          <Link key={r} href={href({ days: r })} className={chip(days === r)}>
            Last {r} days
          </Link>
        ))}
      </div>
    </div>
  )
}
