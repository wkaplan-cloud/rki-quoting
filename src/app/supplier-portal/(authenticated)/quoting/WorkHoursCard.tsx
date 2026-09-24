'use client'
import { useEffect, useState } from 'react'
import { Clock, Loader2 } from 'lucide-react'

const S = { card: '#FFFFFF', accent: 'var(--qh-accent)', text: '#18181B', muted: '#71717A', border: '#E4E4E7', gold: '#B7862F' }

interface Hours {
  install: number
  programming: number
  jobCards: number
  staff: { id: string; name: string; install: number; programming: number }[]
}

const h = (n: number) => `${Math.round(n * 10) / 10}h`

/** Install vs programming hours clocked on a job card, or across a project's job cards. */
export function WorkHoursCard({ quoteId, jobCardId }: { quoteId?: string; jobCardId?: string }) {
  const [hours, setHours] = useState<Hours | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const qs = jobCardId ? `job_card_id=${jobCardId}` : `quote_id=${quoteId}`
    let cancelled = false
    fetch(`/api/supplier-portal/quoting/work-hours?${qs}`)
      .then(r => r.json())
      .then((d: Hours & { error?: string }) => { if (!cancelled) { if (d.error) setError(true); else setHours(d) } })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [quoteId, jobCardId])

  const total = hours ? hours.install + hours.programming : 0

  return (
    <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-3" style={{ color: S.muted }}>
        <Clock size={11} /> Time clocked{quoteId && hours ? ` · ${hours.jobCards} job card${hours.jobCards === 1 ? '' : 's'}` : ''}
      </p>
      {!hours && !error && <Loader2 size={16} className="animate-spin" style={{ color: S.accent }} />}
      {error && <p className="text-xs" style={{ color: S.muted }}>Could not load hours.</p>}
      {hours && total === 0 && (
        <p className="text-xs" style={{ color: S.muted }}>
          No finished sessions yet. Hours appear once techs clock in and out on {quoteId ? "this project's job cards" : 'this job card'}.
        </p>
      )}
      {hours && total > 0 && (
        <>
          <div className="flex gap-6 mb-3">
            <div><p className="text-lg font-bold" style={{ color: S.text }}>{h(hours.install)}</p><p className="text-[11px]" style={{ color: S.muted }}>Install</p></div>
            <div><p className="text-lg font-bold" style={{ color: S.gold }}>{h(hours.programming)}</p><p className="text-[11px]" style={{ color: S.muted }}>Programming</p></div>
            <div><p className="text-lg font-bold" style={{ color: S.accent }}>{h(total)}</p><p className="text-[11px]" style={{ color: S.muted }}>Total</p></div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden flex mb-3" style={{ background: '#F0F2F5' }}>
            <div style={{ width: `${hours.install / total * 100}%`, background: S.accent }} />
            <div style={{ width: `${hours.programming / total * 100}%`, background: S.gold }} />
          </div>
          <div className="space-y-1">
            {hours.staff.map(s => (
              <div key={s.id} className="flex justify-between text-xs">
                <span style={{ color: S.text }}>{s.name}</span>
                <span style={{ color: S.muted }}>{h(s.install)} install · {h(s.programming)} programming</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
