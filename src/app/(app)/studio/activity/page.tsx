export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { ActivityFilters } from './ActivityFilters'

/**
 * Who worked on which moodboard, and when.
 *
 * Built from studio_slide_revisions — the snapshot the autosave already writes,
 * throttled to one row per slide per five minutes of active editing. That makes
 * it a record of *when someone was editing*, not of every keystroke, and it is
 * pruned at 30 days by the studio-storage-cleanup cron.
 *
 * Rows written before the attribution migration carry no author and are shown
 * as "Unattributed" rather than guessed at.
 */

/** Revision history is pruned at 30 days — there is nothing older to show. */
const MAX_DAYS = 30
const DEFAULT_DAYS = 14
/** SAST is UTC+2 year-round. Grouping by UTC day would split a working day. */
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000

interface RevisionRow {
  board_id: string
  slide_id: string
  name: string
  edited_by: string | null
  edited_by_name: string | null
  created_at: string
}

/** One person's work on one board on one day. */
interface Session {
  person: string
  boardId: string
  boardName: string
  clientName: string
  slides: string[]
  first: string
  last: string
  checkpoints: number
}

function sastDayKey(iso: string): string {
  return new Date(Date.parse(iso) + SAST_OFFSET_MS).toISOString().slice(0, 10)
}

function sastTime(iso: string): string {
  return new Date(Date.parse(iso) + SAST_OFFSET_MS).toISOString().slice(11, 16)
}

/** The one clock reading for the whole request. Taking it once keeps the
 *  window, "Today" and "Yesterday" consistent even across midnight, and keeps
 *  the impure call out of the render body. */
function requestNow(): number {
  return Date.now()
}

function dayLabel(key: string, now: number): string {
  const today = sastDayKey(new Date(now).toISOString())
  const yesterday = sastDayKey(new Date(now - 86400000).toISOString())
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default async function StudioActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; days?: string }>
}) {
  const { who, days: daysParam } = await searchParams
  const days = Math.min(MAX_DAYS, Math.max(1, Number(daysParam) || DEFAULT_DAYS))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) redirect('/dashboard')

  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('studio_enabled')
    .eq('org_id', orgId)
    .maybeSingle()
  if (!settings?.studio_enabled) redirect('/dashboard')

  const now = requestNow()
  const since = new Date(now - days * 86400000).toISOString()

  const [{ data: revisions }, { data: boards }] = await Promise.all([
    supabase
      .from('studio_slide_revisions')
      .select('board_id, slide_id, name, edited_by, edited_by_name, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('studio_boards').select('id, name, clients(client_name)'),
  ])

  const boardInfo = new Map<string, { name: string; clientName: string }>()
  for (const b of boards ?? []) {
    // Supabase FK joins come back as an array even for a to-one relation
    const client = Array.isArray(b.clients) ? b.clients[0] : b.clients
    boardInfo.set(b.id as string, {
      name: b.name as string,
      clientName: (client?.client_name as string | undefined) ?? '',
    })
  }

  const rows = (revisions ?? []) as RevisionRow[]
  const people = Array.from(
    new Set(rows.map(r => r.edited_by_name).filter((n): n is string => !!n))
  ).sort()

  const visible = who ? rows.filter(r => r.edited_by_name === who) : rows

  // Collapse the checkpoint stream into one entry per person / board / day.
  const sessions = new Map<string, Map<string, Session>>()
  for (const r of visible) {
    const day = sastDayKey(r.created_at)
    const person = r.edited_by_name ?? 'Unattributed'
    const key = `${person}|${r.board_id}`
    if (!sessions.has(day)) sessions.set(day, new Map())
    const forDay = sessions.get(day)!
    const info = boardInfo.get(r.board_id)
    const existing = forDay.get(key)
    if (existing) {
      // Rows arrive newest-first, so each one pushes `first` earlier
      existing.first = r.created_at
      existing.checkpoints += 1
      if (r.name && !existing.slides.includes(r.name)) existing.slides.push(r.name)
    } else {
      forDay.set(key, {
        person,
        boardId: r.board_id,
        boardName: info?.name ?? 'Deleted board',
        clientName: info?.clientName ?? '',
        slides: r.name ? [r.name] : [],
        first: r.created_at,
        last: r.created_at,
        checkpoints: 1,
      })
    }
  }

  const dayKeys = Array.from(sessions.keys()).sort().reverse()

  return (
    <div>
      <PageHeader
        title="Studio activity"
        subtitle={`Who edited which board, over the last ${days} days`}
      />
      <div className="p-6 lg:p-8">
        <ActivityFilters people={people} who={who ?? null} days={days} maxDays={MAX_DAYS} />

        {dayKeys.length === 0 ? (
          <p className="text-sm text-[#8A877F] mt-8">
            No Studio edits recorded in this period.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {dayKeys.map(day => {
              const entries = Array.from(sessions.get(day)!.values()).sort(
                (a, b) => Date.parse(b.last) - Date.parse(a.last)
              )
              return (
                <section key={day}>
                  <h2 className="font-serif text-base text-[#1A1A18] mb-3">{dayLabel(day, now)}</h2>
                  <div className="space-y-2">
                    {entries.map(e => (
                      <div
                        key={`${e.person}|${e.boardId}`}
                        className="relative bg-white rounded-xl border border-[#D8D3C8] p-4 hover:border-[#9A7B4F] transition-colors"
                      >
                        <Link
                          href={`/studio/board/${e.boardId}`}
                          className="absolute inset-0 rounded-xl"
                          aria-label={`Open ${e.boardName}`}
                        />
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                          <p className="text-sm text-[#1A1A18]">
                            <span className="font-medium">{e.person}</span>
                            <span className="text-[#8A877F]"> edited </span>
                            <span className="font-medium">{e.boardName}</span>
                            {e.clientName && (
                              <span className="text-[#8A877F]"> · {e.clientName}</span>
                            )}
                          </p>
                          <p className="text-[11px] text-[#8A877F] tabular-nums">
                            {sastTime(e.first)}
                            {e.last !== e.first && <> – {sastTime(e.last)}</>}
                          </p>
                        </div>
                        {e.slides.length > 0 && (
                          <p className="text-xs text-[#8A877F] mt-1.5">
                            {e.slides.length === 1 ? 'Slide: ' : 'Slides: '}
                            {e.slides.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        <p className="text-[11px] text-[#8A877F] mt-10 leading-relaxed max-w-2xl">
          Studio saves a history snapshot at most once every five minutes per slide, so
          this shows the windows someone was working in — not every individual change.
          History is kept for {MAX_DAYS} days. Edits made before activity tracking was
          switched on appear as “Unattributed”.
        </p>
      </div>
    </div>
  )
}
