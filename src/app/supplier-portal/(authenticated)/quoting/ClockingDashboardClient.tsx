'use client'
import { useState, useEffect } from 'react'
import { MapPin, LogIn, LogOut, Users, Clock, CalendarDays, RefreshCw, Printer } from 'lucide-react'

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
  job_id?: string | null
  job?: { job_number: string; title: string } | null
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
  const now = Date.now()
  for (const t of Object.values(openSessions)) total += now - t
  return total
}

function getOnSite(punches: Punch[], staff: StaffMember[]): StaffMember[] {
  const latestPerStaff: Record<string, Punch> = {}
  for (const p of punches) {
    if (!latestPerStaff[p.staff_id] || new Date(p.punched_at) > new Date(latestPerStaff[p.staff_id].punched_at)) {
      latestPerStaff[p.staff_id] = p
    }
  }
  return staff.filter(s => latestPerStaff[s.id]?.punch_type === 'clock_in')
}

function getClockedInAt(punches: Punch[], staffId: string): string | null {
  const staffPunches = punches.filter(p => p.staff_id === staffId && p.punch_type === 'clock_in')
  if (!staffPunches.length) return null
  return staffPunches.sort((a, b) => new Date(b.punched_at).getTime() - new Date(a.punched_at).getTime())[0].punched_at
}

function getLastLocation(punches: Punch[], staffId: string): { lat: number; lng: number } | null {
  const p = punches.filter(p => p.staff_id === staffId && p.punch_type === 'clock_in' && p.latitude)
    .sort((a, b) => new Date(b.punched_at).getTime() - new Date(a.punched_at).getTime())[0]
  if (!p?.latitude) return null
  return { lat: p.latitude, lng: p.longitude! }
}

function buildSessions(punches: Punch[], staffId: string): { in: Punch; out: Punch | null }[] {
  const sorted = [...punches.filter(p => p.staff_id === staffId)]
    .sort((a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime())
  const sessions: { in: Punch; out: Punch | null }[] = []
  let openIn: Punch | null = null
  for (const p of sorted) {
    if (p.punch_type === 'clock_in') {
      openIn = p
    } else if (openIn) {
      sessions.push({ in: openIn, out: p })
      openIn = null
    }
  }
  if (openIn) sessions.push({ in: openIn, out: null })
  return sessions
}

function printWeeklyTimesheet(weekPunches: Punch[], staff: StaffMember[], companyName: string) {
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date()

  const staffRows: string[] = []

  for (const member of staff) {
    const sessions = buildSessions(weekPunches, member.id)
    if (sessions.length === 0) continue

    const totalMs = sessions.reduce((s, ses) => {
      const end = ses.out ? new Date(ses.out.punched_at).getTime() : Date.now()
      return s + end - new Date(ses.in.punched_at).getTime()
    }, 0)

    const sessionRows = sessions.map(ses => {
      const inTime  = new Date(ses.in.punched_at)
      const outTime = ses.out ? new Date(ses.out.punched_at) : null
      const durMs   = outTime ? outTime.getTime() - inTime.getTime() : Date.now() - inTime.getTime()
      const job     = ses.in.job && !Array.isArray(ses.in.job) ? ses.in.job : null
      const inGps   = ses.in.latitude  ? `${ses.in.latitude.toFixed(5)}, ${ses.in.longitude?.toFixed(5)}` : '—'
      const outGps  = ses.out?.latitude ? `${ses.out.latitude.toFixed(5)}, ${ses.out.longitude?.toFixed(5)}` : '—'
      return `
        <tr>
          <td>${fmtDate(ses.in.punched_at)}</td>
          <td>${inTime.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${outTime ? outTime.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '<span class="open">On site</span>'}</td>
          <td><strong>${fmtHours(durMs)}</strong></td>
          <td>${job ? `<strong>${job.job_number}</strong><br/><span class="sub">${job.title}</span>` : '—'}</td>
          <td class="gps">${inGps}</td>
          <td class="gps">${outGps}</td>
        </tr>`
    }).join('')

    staffRows.push(`
      <div class="staff-section">
        <div class="staff-header">
          <div class="avatar" style="background:${member.color}">${initials(member.name)}</div>
          <div>
            <div class="staff-name">${member.name}</div>
            <div class="staff-meta">${member.role} &nbsp;·&nbsp; <strong>${fmtHours(totalMs)}</strong> this week &nbsp;·&nbsp; ${sessions.length} session${sessions.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Clock In</th><th>Clock Out</th><th>Duration</th><th>Job</th><th>GPS In</th><th>GPS Out</th>
            </tr>
          </thead>
          <tbody>${sessionRows}</tbody>
        </table>
      </div>`)
  }

  const periodStr = `${weekStart.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })} – ${weekEnd.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`
  const totalWeekMs = computeHoursMs(weekPunches)

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Weekly Timesheet · ${periodStr}</title>
  <meta charset="utf-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#18181b;padding:32px;background:#fff}
    .print-btn{position:fixed;top:20px;right:20px;background:#3a7ca5;color:#fff;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600}
    @media print{.print-btn{display:none}}
    .doc-header{margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #1e2a38;display:flex;justify-content:space-between;align-items:flex-end}
    .doc-title{font-size:20px;font-weight:700;color:#1e2a38}
    .doc-period{font-size:12px;color:#71717a;margin-top:3px}
    .doc-total{text-align:right;font-size:13px;font-weight:700;color:#3a7ca5}
    .staff-section{margin-bottom:32px;page-break-inside:avoid}
    .staff-header{display:flex;align-items:center;gap:10px;margin-bottom:10px}
    .avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:11px;flex-shrink:0}
    .staff-name{font-size:14px;font-weight:700;color:#18181b}
    .staff-meta{font-size:11px;color:#71717a;margin-top:2px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#f0f2f5;padding:6px 9px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#71717a;border:1px solid #e4e4e7}
    td{padding:6px 9px;border:1px solid #e4e4e7;vertical-align:top}
    tr:nth-child(even) td{background:#fafafa}
    .open{color:#16a34a;font-weight:600}
    .gps{font-family:monospace;font-size:10px;color:#71717a}
    .sub{color:#71717a;font-size:10px}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Print</button>
  <div class="doc-header">
    <div>
      <div class="doc-title">${companyName} — Weekly Timesheet</div>
      <div class="doc-period">${periodStr}</div>
    </div>
    <div class="doc-total">Total: ${totalWeekMs > 0 ? fmtHours(totalWeekMs) : '—'} across all staff</div>
  </div>
  ${staffRows.length > 0 ? staffRows.join('') : '<p style="color:#71717a;text-align:center;padding:40px">No time data for this week</p>'}
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
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
    await fetch('/api/supplier-portal/quoting/staff-live')
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
          { label: 'On site now',     value: String(onSite.length),                                   sub: `of ${staff.length} staff`,  color: onSite.length > 0 ? S.green : S.muted },
          { label: 'Off site',        value: String(offSite.length),                                  sub: 'not clocked in',             color: S.muted  },
          { label: 'Hours today',     value: todayMs > 0 ? fmtHours(todayMs) : '—',                  sub: 'across all staff',           color: S.accent },
          { label: 'Hours this week', value: weekMs  > 0 ? fmtHours(weekMs)  : '—',                  sub: 'Mon – today',                color: S.accent },
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
            const clockedAt = getClockedInAt(todayPunches, s.id)
            const elapsed   = clockedAt ? Date.now() - new Date(clockedAt).getTime() : 0
            const loc       = getLastLocation(todayPunches, s.id)
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
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(30,42,56,0.03)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: S.text }}>Hours this week</p>
              <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>Monday to today, including live open sessions</p>
            </div>
            <button
              onClick={() => printWeeklyTimesheet(weekPunches, staff, companyName)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ border: `1px solid ${S.border}`, color: S.muted, background: S.bg }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.color = S.accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.muted }}>
              <Printer size={13} /> Print Timesheet
            </button>
          </div>
          {staff.map((s, i) => {
            const ms       = computeHoursMs(weekPunches, s.id)
            const today    = computeHoursMs(todayPunches, s.id)
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
            <p className="text-sm font-semibold" style={{ color: S.text }}>Today's activity</p>
          </div>
          {[...todayPunches].sort((a, b) => new Date(b.punched_at).getTime() - new Date(a.punched_at).getTime()).slice(0, 20).map((p, i) => {
            const member = staff.find(s => s.id === p.staff_id)
            const isIn   = p.punch_type === 'clock_in'
            return (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: isIn ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)' }}>
                  {isIn
                    ? <LogIn  size={13} style={{ color: S.green  }} />
                    : <LogOut size={13} style={{ color: S.danger }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: S.text }}>
                    <span className="font-semibold">{member?.name ?? 'Unknown'}</span>
                    {' '}{isIn ? 'clocked in' : 'clocked out'}
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
