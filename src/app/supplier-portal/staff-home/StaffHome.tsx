'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Clock, LogIn, LogOut, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, ClipboardList, ChevronRight, Calendar } from 'lucide-react'
import type { ElecStaff, ElecTimePunch, ElecJobCard } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtDuration(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:     { bg: 'rgba(217,164,65,0.1)',  color: '#D9A441', label: 'Pending' },
  in_progress: { bg: 'rgba(58,124,165,0.1)',  color: '#3A7CA5', label: 'In Progress' },
  completed:   { bg: 'rgba(22,163,74,0.1)',   color: '#16A34A', label: 'Completed' },
  cancelled:   { bg: 'rgba(113,113,122,0.1)', color: '#71717A', label: 'Cancelled' },
}

const TYPE_LABEL: Record<string, string> = {
  maintenance: 'Maintenance', repair: 'Repair', once_off: 'Once-Off', callout: 'Callout',
}

interface Props {
  staff: Pick<ElecStaff, 'id' | 'name' | 'role' | 'color'>
  companyName: string
  initialPunches: ElecTimePunch[]
  isClockedIn: boolean
  assignedJobCards: ElecJobCard[]
}

export function StaffHome({ staff, companyName, initialPunches, isClockedIn: initClockedIn, assignedJobCards }: Props) {
  const router = useRouter()
  const [punches, setPunches] = useState<ElecTimePunch[]>(initialPunches)
  const [isClockedIn, setIsClockedIn] = useState(initClockedIn)
  const [status, setStatus] = useState<'idle' | 'locating' | 'punching' | 'done' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  async function handlePunch() {
    const punchType = isClockedIn ? 'clock_out' : 'clock_in'
    setStatus('locating')
    setStatusMsg('Getting your location…')

    let latitude: number | undefined
    let longitude: number | undefined

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 30000 })
      )
      latitude = pos.coords.latitude
      longitude = pos.coords.longitude
    } catch {
      // GPS not available — continue without it
    }

    setStatus('punching')
    setStatusMsg(punchType === 'clock_in' ? 'Clocking in…' : 'Clocking out…')

    try {
      const res = await fetch('/api/supplier-portal/staff/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ punch_type: punchType, latitude, longitude }),
      })
      const data = await res.json() as { ok?: boolean; punch?: ElecTimePunch; error?: string }
      if (!res.ok || !data.ok) { setStatus('error'); setStatusMsg(data.error ?? 'Failed'); return }

      setIsClockedIn(punchType === 'clock_in')
      if (data.punch) setPunches(prev => [data.punch!, ...prev])
      setStatus('done')
      setStatusMsg(punchType === 'clock_in' ? 'Clocked in ✓' : 'Clocked out ✓')
      setTimeout(() => { setStatus('idle'); setStatusMsg('') }, 3000)
    } catch {
      setStatus('error')
      setStatusMsg('Network error — try again')
      setTimeout(() => { setStatus('idle'); setStatusMsg('') }, 3000)
    }
  }

  // Group punches into day pairs for timesheet
  const dayMap: Record<string, ElecTimePunch[]> = {}
  for (const p of punches) {
    const day = p.punched_at.slice(0, 10)
    if (!dayMap[day]) dayMap[day] = []
    dayMap[day].push(p)
  }
  const days = Object.entries(dayMap).sort((a, b) => b[0].localeCompare(a[0]))

  const clockButtonDisabled = status === 'locating' || status === 'punching'

  return (
    <div className="min-h-screen" style={{ background: S.bg }}>
      {/* Header */}
      <div style={{ background: '#1E2A38' }} className="px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: staff.color ?? S.accent }}>
            {staff.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-bold">{staff.name}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{companyName}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4 pb-8">
        {/* Clock In/Out card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <div className="px-5 pt-5 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: isClockedIn ? S.green : S.muted }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: isClockedIn ? S.green : S.muted }}>
                {isClockedIn ? 'Currently Clocked In' : 'Currently Clocked Out'}
              </span>
            </div>
            {punches[0] && (
              <p className="text-xs" style={{ color: S.muted }}>
                Last punch: {fmtTime(punches[0].punched_at)} · {fmtDate(punches[0].punched_at)}
                {punches[0].latitude && <span> · <MapPin size={9} className="inline" /> GPS</span>}
              </p>
            )}
          </div>

          <div className="px-5 pb-5 pt-3">
            <button
              onClick={() => void handlePunch()}
              disabled={clockButtonDisabled}
              className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 disabled:opacity-60"
              style={{ background: isClockedIn ? S.danger : S.green, transition: 'opacity 0.2s' }}>
              {status === 'locating' || status === 'punching' ? (
                <Loader2 size={20} className="animate-spin" />
              ) : status === 'done' ? (
                <CheckCircle2 size={20} />
              ) : status === 'error' ? (
                <AlertCircle size={20} />
              ) : isClockedIn ? (
                <LogOut size={20} />
              ) : (
                <LogIn size={20} />
              )}
              {status === 'idle'
                ? (isClockedIn ? 'Clock Out' : 'Clock In')
                : statusMsg || (isClockedIn ? 'Clocking out…' : 'Clocking in…')}
            </button>

            {status === 'idle' && (
              <p className="text-center text-xs mt-2" style={{ color: S.muted }}>
                <MapPin size={10} className="inline mr-0.5" />Your GPS location will be captured
              </p>
            )}
          </div>
        </div>

        {/* Today's summary */}
        {days.length > 0 && (() => {
          const today = new Date().toISOString().slice(0, 10)
          const todayPunches = dayMap[today] ?? []
          if (todayPunches.length === 0) return null
          const ins = todayPunches.filter(p => p.punch_type === 'clock_in')
          const outs = todayPunches.filter(p => p.punch_type === 'clock_out')
          return (
            <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: S.muted }}>Today</p>
              <div className="grid grid-cols-2 gap-3">
                {ins.map((punch, i) => (
                  <div key={punch.id} className="rounded-xl p-3" style={{ background: 'rgba(22,163,74,0.06)', border: `1px solid rgba(22,163,74,0.2)` }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <LogIn size={11} style={{ color: S.green }} />
                      <span className="text-[10px] font-semibold uppercase" style={{ color: S.green }}>In</span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: S.text }}>{fmtTime(punch.punched_at)}</p>
                    {punch.latitude && <p className="text-[10px] mt-0.5" style={{ color: S.muted }}><MapPin size={9} className="inline" /> GPS</p>}
                  </div>
                ))}
                {outs.map((punch, i) => (
                  <div key={punch.id} className="rounded-xl p-3" style={{ background: 'rgba(220,38,38,0.06)', border: `1px solid rgba(220,38,38,0.2)` }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <LogOut size={11} style={{ color: S.danger }} />
                      <span className="text-[10px] font-semibold uppercase" style={{ color: S.danger }}>Out</span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: S.text }}>{fmtTime(punch.punched_at)}</p>
                    {punch.latitude && <p className="text-[10px] mt-0.5" style={{ color: S.muted }}><MapPin size={9} className="inline" /> GPS</p>}
                  </div>
                ))}
              </div>
              {ins.length > 0 && outs.length > 0 && (() => {
                const firstIn = ins[ins.length - 1]
                const lastOut = outs[0]
                return (
                  <div className="mt-2 px-3 py-2 rounded-xl flex items-center gap-2"
                    style={{ background: 'rgba(58,124,165,0.06)', border: `1px solid rgba(58,124,165,0.15)` }}>
                    <Clock size={11} style={{ color: S.accent }} />
                    <span className="text-xs" style={{ color: S.accent }}>
                      Total today: <strong>{fmtDuration(firstIn.punched_at, lastOut.punched_at)}</strong>
                    </span>
                  </div>
                )
              })()}
            </div>
          )
        })()}

        {/* Assigned Job Cards */}
        {assignedJobCards.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
              <ClipboardList size={11} className="inline mr-1" />My Jobs ({assignedJobCards.length})
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              {assignedJobCards.map((j, i) => {
                const ss = STATUS_STYLE[j.status] ?? STATUS_STYLE.pending
                const client = !Array.isArray(j.client) ? j.client : null
                return (
                  <button key={j.id}
                    onClick={() => router.push(`/supplier-portal/staff-home/job/${j.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                    style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: ss.bg }}>
                      <ClipboardList size={15} style={{ color: ss.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-mono" style={{ color: S.muted }}>{j.job_number}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                        <span className="text-[10px]" style={{ color: S.muted }}>{TYPE_LABEL[j.job_type]}</span>
                      </div>
                      <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{j.title}</p>
                      <div className="flex items-center gap-3 text-xs mt-0.5 flex-wrap" style={{ color: S.muted }}>
                        {j.location && <span className="flex items-center gap-0.5"><MapPin size={9} />{j.location}</span>}
                        {j.scheduled_at && <span className="flex items-center gap-0.5"><Calendar size={9} />{new Date(j.scheduled_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                        {client && <span>{client.client_name}</span>}
                      </div>
                    </div>
                    <ChevronRight size={15} style={{ color: S.muted }} />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Punch history */}
        {days.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <button
              onClick={() => setShowHistory(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3"
              style={{ borderBottom: showHistory ? `1px solid ${S.border}` : undefined }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Punch History (30 days)</p>
              {showHistory ? <ChevronUp size={14} style={{ color: S.muted }} /> : <ChevronDown size={14} style={{ color: S.muted }} />}
            </button>
            {showHistory && days.map(([day, dayPunches]) => (
              <div key={day} style={{ borderBottom: `1px solid ${S.border}` }}>
                <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, background: S.bg }}>
                  {fmtDate(day + 'T12:00:00')}
                </p>
                {dayPunches.map(punch => (
                  <div key={punch.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: `1px solid ${S.border}` }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: punch.punch_type === 'clock_in' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)' }}>
                      {punch.punch_type === 'clock_in'
                        ? <LogIn size={11} style={{ color: S.green }} />
                        : <LogOut size={11} style={{ color: S.danger }} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: S.text }}>
                        {punch.punch_type === 'clock_in' ? 'Clocked In' : 'Clocked Out'} · {fmtTime(punch.punched_at)}
                      </p>
                      {punch.latitude && (
                        <p className="text-[10px]" style={{ color: S.muted }}>
                          <MapPin size={9} className="inline" /> {punch.latitude.toFixed(4)}, {punch.longitude?.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
