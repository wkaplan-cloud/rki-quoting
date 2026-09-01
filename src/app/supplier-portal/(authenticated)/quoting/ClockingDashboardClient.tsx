'use client'
import { useState, useEffect } from 'react'
import { MapPin, LogIn, LogOut, Users, Clock, CalendarDays, RefreshCw } from 'lucide-react'
import { get5pmSASTCutoff } from '@/lib/sa-overtime'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A', sidebar: '#1E2A38',
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtHours(ms: number) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

interface StaffMember {
  id: string
  name: string
  color: string
  role: string
}

interface Punch {
  id: string
  staff_id: string
  punch_type: 'clock_in' | 'clock_out'
  punched_at: string
  latitude: number | null
  longitude: number | null
  notes: string | null
  job_id?: string | null
  staff?: StaffMember | null
}

interface Props {
  companyName: string
  staff: StaffMember[]
  todayPunches: Punch[]
  weekPunches: Punch[]
}

function computeHoursMs(punches: Punch[], staffId?: string): number {
  const filtered = staffId ? punches.filter(p => p.staff_id === staffId) : punches
  const sorted = [...filtered].sort((a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime())
  let total = 0
  const openSessions: Record<string, number> = {}
  for (const p of sorted) {
    if (p.punch_type === 'clock_in') {
      openSessions[p.staff_id] = new Date(p.punched_at).getTime()
    } else if (openSessions[p.staff_id]) {
      total += new Date(p.punched_at).getTime() - openSessions[p.staff_id]
      delete openSessions[p.staff_id]
    }
  }
  // Add open sessions, capped at 5pm SAST only if clocked in before 5pm
  const nowMs = Date.now()
  for (const t of Object.values(openSessions)) {
    const cutoff = get5pmSASTCutoff(new Date(t)).getTime()
    const effectiveTo = t < cutoff ? Math.min(nowMs, cutoff) : nowMs
    total += effectiveTo - t
  }
  return total
}

// On-site status only looks at global punches (no job_id) — job-card punches
// track time against a specific job, not overall attendance. Must match
// /api/supplier-portal/staff/punch, the worker's own clocked-in status.
function getOnSite(punches: Punch[], staff: StaffMember[]): StaffMember[] {
  const latestPerStaff: Record<string, Punch> = {}
  for (const p of punches) {
    if (p.job_id) continue
    if (!latestPerStaff[p.staff_id] || new Date(p.punched_at) > new Date(latestPerStaff[p.staff_id].punched_at)) {
      latestPerStaff[p.staff_id] = p
    }
  }
  return staff.filter(s => latestPerStaff[s.id]?.punch_type === 'clock_in')
}

function getClockedInAt(punches: Punch[], staffId: string): string | null {
  const staffPunches = punches.filter(p => p.staff_id === staffId && p.punch_type === 'clock_in' && !p.job_id)
  if (!staffPunches.length) return null
  return staffPunches.sort((a, b) => new Date(b.punched_at).getTime() - new Date(a.punched_at).getTime())[0].punched_at
}

function getLastLocation(punches: Punch[], staffId: string): { lat: number; lng: number } | null {
  const p = punches.filter(p => p.staff_id === staffId && p.punch_type === 'clock_in' && !p.job_id && p.latitude)
    .sort((a, b) => new Date(b.punched_at).getTime() - new Date(a.punched_at).getTime())[0]
  if (!p?.latitude) return null
  return { lat: p.latitude, lng: p.longitude! }
}

export function ClockingDashboardClient({ companyName, staff, todayPunches: initToday, weekPunches: initWeek }: Props) {
  const [todayPunches, setTodayPunches] = useState<Punch[]>(initToday)
  const [weekPunches]  = useState<Punch[]>(initWeek)
  const [now, setNow] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  async function refresh() {
    setRefreshing(true)
    const res = await fetch('/api/supplier-portal/quoting/today-punches')
    if (res.ok) {
      const fresh = await res.json() as Punch[]
      setTodayPunches(fresh)
    }
    setRefreshing(false)
  }

  const onSite   = getOnSite(todayPunches, staff)
  const offSite  = staff.filter(s => !onSite.find(o => o.id === s.id))
  const todayMs  = computeHoursMs(todayPunches)
  const weekMs   = computeHoursMs(weekPunches)

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: S.muted }}>
            {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-2xl font-bold" style={{ color: S.text }}>{greeting}, {companyName}</h1>
        </div>
        <a href="/supplier-portal/quoting/schedule"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: S.accent }}>
          <CalendarDays size={14} />
          Live Schedule
        </a>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'On site now',    value: String(onSite.length),       sub: `of ${staff.length} staff`,         color: onSite.length > 0 ? S.green : S.muted },
          { label: 'Off site',       value: String(offSite.length),      sub: 'not clocked in',                   color: S.muted              },
          { label: 'Hours today',    value: todayMs > 0 ? fmtHours(todayMs) : '—',  sub: 'across all staff',   color: S.accent             },
          { label: 'Hours this week',value: weekMs  > 0 ? fmtHours(weekMs)  : '—',  sub: 'Mon – today',        color: S.accent             },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-2xl font-bold mb-0.5" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs font-semibold" style={{ color: S.text }}>{c.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Live: who's on site */}
      <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(30,42,56,0.03)' }}>
          <div className="flex items-center gap-2">
            {onSite.length > 0 && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: S.green }} />}
            <p className="text-sm font-semibold" style={{ color: S.text }}>
              {onSite.length > 0 ? `${onSite.length} on site right now` : 'No one currently on site'}
            </p>
          </div>
          <button onClick={() => void refresh()} className="flex items-center gap-1.5 text-xs" style={{ color: S.muted }}>
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {onSite.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-1">
            <Users size={24} style={{ color: S.border }} />
            <p className="text-sm" style={{ color: S.muted }}>All staff are off site</p>
          </div>
        ) : (
          onSite.map((s, i) => {
            const clockedAt  = getClockedInAt(todayPunches, s.id)
            const clockedAtMs  = clockedAt ? new Date(clockedAt).getTime() : 0
            const elapsedCap   = clockedAt ? get5pmSASTCutoff(new Date(clockedAt)).getTime() : 0
            const effectiveTo  = clockedAt
              ? (clockedAtMs < elapsedCap ? Math.min(now.getTime(), elapsedCap) : now.getTime())
              : 0
            const elapsed      = clockedAt ? effectiveTo - clockedAtMs : 0
            const loc        = getLastLocation(todayPunches, s.id)
            return (
              <div key={s.id} className="flex items-center gap-4 px-5 py-4"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: s.color }}>
                  {initials(s.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: S.text }}>{s.name}</p>
                  <p className="text-xs" style={{ color: S.muted }}>
                    {s.role} · Clocked in {clockedAt ? `at ${fmtTime(clockedAt)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>
                    {elapsed > 0 ? fmtHours(elapsed) : '< 1m'}
                  </span>
                  {loc && (
                    <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(58,124,165,0.1)', color: S.accent }}>
                      <MapPin size={10} /> Map
                    </a>
                  )}
                </div>
              </div>
            )
          })
        )}

        {offSite.length > 0 && (
          <div className="px-5 py-3 flex items-center gap-3 flex-wrap" style={{ borderTop: `1px solid ${S.border}`, background: S.bg }}>
            <p className="text-xs font-semibold" style={{ color: S.muted }}>Off site:</p>
            {offSite.map(s => (
              <div key={s.id} className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ background: s.color, opacity: 0.5 }}>
                  {initials(s.name)}
                </div>
                <span className="text-xs" style={{ color: S.muted }}>{s.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hours per staff this week */}
      {staff.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="px-5 py-3" style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(30,42,56,0.03)' }}>
            <p className="text-sm font-semibold" style={{ color: S.text }}>Hours this week</p>
            <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>Monday to today, including live open sessions</p>
          </div>
          {staff.map((s, i) => {
            const ms    = computeHoursMs(weekPunches, s.id)
            const today = computeHoursMs(todayPunches, s.id)
            const isOnSite = onSite.find(o => o.id === s.id)
            return (
              <div key={s.id} className="flex items-center gap-4 px-5 py-3"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: s.color }}>
                  {initials(s.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium" style={{ color: S.text }}>{s.name}</p>
                    {isOnSite && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>● On site</span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: S.muted }}>{s.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold font-mono" style={{ color: ms > 0 ? S.accent : S.muted }}>
                    {ms > 0 ? fmtHours(ms) : '—'}
                  </p>
                  {today > 0 && (
                    <p className="text-[10px]" style={{ color: S.muted }}>{fmtHours(today)} today</p>
                  )}
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: `1px solid ${S.border}`, background: S.bg }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Total</p>
            <p className="text-sm font-bold font-mono" style={{ color: S.text }}>
              {weekMs > 0 ? fmtHours(weekMs) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Recent activity feed */}
      {todayPunches.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="px-5 py-3" style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(30,42,56,0.03)' }}>
            <p className="text-sm font-semibold" style={{ color: S.text }}>Today&apos;s activity</p>
          </div>
          {[...todayPunches].sort((a, b) => new Date(b.punched_at).getTime() - new Date(a.punched_at).getTime()).slice(0, 20).map((p, i) => {
            const member = staff.find(s => s.id === p.staff_id)
            const isIn = p.punch_type === 'clock_in'
            const isAuto = !isIn && p.notes?.toLowerCase().includes('auto clocked out')
            return (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: isIn ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)' }}>
                  {isIn
                    ? <LogIn size={13} style={{ color: S.green }} />
                    : <LogOut size={13} style={{ color: S.danger }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm flex items-center gap-2 flex-wrap" style={{ color: S.text }}>
                    <span className="font-semibold">{member?.name ?? 'Unknown'}</span>
                    {isIn ? 'clocked in' : 'clocked out'}
                    {isAuto && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{ background: 'rgba(217,164,65,0.15)', color: S.gold }}>
                        Auto
                      </span>
                    )}
                  </p>
                  {p.latitude && (
                    <a href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] mt-0.5"
                      style={{ color: S.accent }}>
                      <MapPin size={9} /> View location
                    </a>
                  )}
                </div>
                <p className="text-xs flex-shrink-0" style={{ color: S.muted }}>{fmtTime(p.punched_at)}</p>
              </div>
            )
          })}
        </div>
      )}

      {todayPunches.length === 0 && (
        <div className="rounded-2xl py-12 flex flex-col items-center gap-2" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <Clock size={28} style={{ color: S.border }} />
          <p className="text-sm font-semibold" style={{ color: S.text }}>No activity today yet</p>
          <p className="text-xs" style={{ color: S.muted }}>Staff clock in from the QuotingHub mobile app</p>
        </div>
      )}
    </div>
  )
}
