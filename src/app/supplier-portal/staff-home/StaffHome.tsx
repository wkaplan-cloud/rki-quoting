'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { reverseGeocode } from '@/lib/reverse-geocode'
import {
  MapPin, LogIn, LogOut, Loader2, CheckCircle2, AlertCircle,
  ClipboardList, ChevronRight, Calendar, Clock, X, LogOut as SignOutIcon,
} from 'lucide-react'
import type { ElecStaff, ElecTimePunch, ElecJobCard, ElecJobCardType } from '@/lib/elec-types'
import { StaffBottomNav } from './StaffBottomNav'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', sidebar: '#1E2A38',
  accent: '#3A7CA5', gold: '#D9A441',
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

const JOB_TYPES: { value: ElecJobCardType; label: string }[] = [
  { value: 'callout',     label: 'Callout' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'repair',      label: 'Repair' },
  { value: 'once_off',    label: 'Once-Off' },
]

type Tab = 'home' | 'jobs' | 'history' | 'more'

interface Props {
  staff: Pick<ElecStaff, 'id' | 'name' | 'role' | 'color'>
  companyName: string
  initialPunches: ElecTimePunch[]
  isClockedIn: boolean
  assignedJobCards: ElecJobCard[]
}

export function StaffHome({ staff, companyName, initialPunches, isClockedIn: initClockedIn, assignedJobCards: initJobCards }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('home')
  const [punches, setPunches] = useState<ElecTimePunch[]>(initialPunches)
  const [isClockedIn, setIsClockedIn] = useState(initClockedIn)
  const [clockStatus, setClockStatus] = useState<'idle' | 'locating' | 'punching' | 'done' | 'error'>('idle')
  const [clockMsg, setClockMsg] = useState('')
  const [gpsBlocked, setGpsBlocked] = useState(false)
  const [lastPunchAddress, setLastPunchAddress] = useState<string | null>(null)

  // Geocode the most recent punch's location on load
  useEffect(() => {
    const p = initialPunches[0]
    if (p?.latitude && p.longitude) {
      void reverseGeocode(p.latitude, p.longitude).then(addr => { if (addr) setLastPunchAddress(addr) })
    }
  }, []) // eslint-disable-line

  // New job modal
  const [showNewJob, setShowNewJob] = useState(false)
  const [jobCards, setJobCards] = useState<ElecJobCard[]>(initJobCards)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<ElecJobCardType>('callout')
  const [newLocation, setNewLocation] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Sign out
  const [signingOut, setSigningOut] = useState(false)

  async function handlePunch() {
    const punchType = isClockedIn ? 'clock_out' : 'clock_in'
    setClockStatus('locating')
    setClockMsg('Getting your location…')

    let latitude: number | undefined
    let longitude: number | undefined

    if (!navigator.geolocation) {
      setGpsBlocked(true)
    } else {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            timeout: 10000,
            maximumAge: 0,
            enableHighAccuracy: true,
          })
        )
        latitude = pos.coords.latitude
        longitude = pos.coords.longitude
        setGpsBlocked(false)
      } catch (err) {
        const code = (err as GeolocationPositionError).code
        // code 1 = PERMISSION_DENIED — user blocked location
        setGpsBlocked(code === 1)
      }
    }

    setClockStatus('punching')
    setClockMsg(punchType === 'clock_in' ? 'Clocking in…' : 'Clocking out…')

    try {
      const res = await fetch('/api/supplier-portal/staff/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ punch_type: punchType, latitude, longitude }),
      })
      const data = await res.json() as { ok?: boolean; punch?: ElecTimePunch; address?: string | null; error?: string }
      if (!res.ok || !data.ok) { setClockStatus('error'); setClockMsg(data.error ?? 'Failed'); return }
      setIsClockedIn(punchType === 'clock_in')
      if (data.punch) setPunches(prev => [data.punch!, ...prev])
      if (data.address) setLastPunchAddress(data.address)
      setClockStatus('done')
      const locationTag = data.address ? ` · ${data.address}` : latitude ? ' · GPS ✓' : ' · no GPS'
      setClockMsg((punchType === 'clock_in' ? 'Clocked in ✓' : 'Clocked out ✓') + locationTag)
      setTimeout(() => { setClockStatus('idle'); setClockMsg('') }, 3000)
    } catch {
      setClockStatus('error')
      setClockMsg('Network error — try again')
      setTimeout(() => { setClockStatus('idle'); setClockMsg('') }, 3000)
    }
  }

  async function handleCreateJob() {
    if (!newTitle.trim() || creating) return
    setCreating(true); setCreateError('')
    const res = await fetch('/api/supplier-portal/quoting/job-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), job_type: newType, location: newLocation.trim() || null }),
    })
    const data = await res.json() as ElecJobCard & { error?: string }
    if (!res.ok || data.error) { setCreateError(data.error ?? 'Failed to create'); setCreating(false); return }
    setJobCards(prev => [data, ...prev])
    setShowNewJob(false)
    setNewTitle(''); setNewType('callout'); setNewLocation('')
    setCreating(false)
    router.push(`/supplier-portal/staff-home/job/${data.id}`)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/supplier-portal/login')
  }

  // Timesheet data
  const dayMap: Record<string, ElecTimePunch[]> = {}
  for (const p of punches) {
    const day = p.punched_at.slice(0, 10)
    if (!dayMap[day]) dayMap[day] = []
    dayMap[day].push(p)
  }
  const days = Object.entries(dayMap).sort((a, b) => b[0].localeCompare(a[0]))
  const today = new Date().toISOString().slice(0, 10)
  const todayPunches = dayMap[today] ?? []
  const todayIns  = todayPunches.filter(p => p.punch_type === 'clock_in')
  const todayOuts = todayPunches.filter(p => p.punch_type === 'clock_out')

  const clockBusy = clockStatus === 'locating' || clockStatus === 'punching'

  return (
    <div className="staff-portal min-h-screen flex flex-col" style={{ background: S.bg }}>

      {/* Top bar */}
      <div className="flex-shrink-0 px-4 pt-10 pb-4 flex items-center gap-3" style={{ background: S.sidebar }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: staff.color ?? S.accent }}>
          {staff.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold truncate">{staff.name}</p>
          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{companyName}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: isClockedIn ? 'rgba(22,163,74,0.25)' : 'rgba(255,255,255,0.08)' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: isClockedIn ? S.green : 'rgba(255,255,255,0.3)' }} />
          <span className="text-[11px] font-semibold" style={{ color: isClockedIn ? '#4ADE80' : 'rgba(255,255,255,0.4)' }}>
            {isClockedIn ? 'On site' : 'Off site'}
          </span>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pb-24">

        {/* ── HOME TAB ── */}
        {tab === 'home' && (
          <div className="px-4 pt-4 space-y-4">

            {/* GPS permission banner */}
            {gpsBlocked && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
                <MapPin size={16} className="flex-shrink-0 mt-0.5" style={{ color: S.danger }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: S.danger }}>Location access blocked</p>
                  <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                    Open your browser settings, find &quot;Site permissions&quot; or &quot;Location&quot;, and allow access for this site. Then clock in again.
                  </p>
                </div>
              </div>
            )}

            {/* Clock in/out */}
            <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <div className="px-5 pt-5 pb-2">
                {punches[0] && (
                  <div className="mb-1">
                    <p className="text-xs" style={{ color: S.muted }}>
                      Last: {punches[0].punch_type === 'clock_in' ? 'Clocked in' : 'Clocked out'} at {fmtTime(punches[0].punched_at)}
                    </p>
                    {lastPunchAddress && (
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: S.accent }}>
                        <MapPin size={10} className="flex-shrink-0" />{lastPunchAddress}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="px-5 pb-5">
                <button
                  onClick={() => void handlePunch()}
                  disabled={clockBusy}
                  className="w-full py-5 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-60"
                  style={{ background: isClockedIn ? S.danger : S.green, transition: 'opacity 0.2s' }}>
                  {clockStatus === 'locating' || clockStatus === 'punching' ? <Loader2 size={22} className="animate-spin" />
                    : clockStatus === 'done' ? <CheckCircle2 size={22} />
                    : clockStatus === 'error' ? <AlertCircle size={22} />
                    : isClockedIn ? <LogOut size={22} /> : <LogIn size={22} />}
                  {clockStatus === 'idle'
                    ? (isClockedIn ? 'Clock Out' : 'Clock In')
                    : clockMsg}
                </button>
                {clockStatus === 'idle' && (
                  <p className="text-center text-xs mt-2" style={{ color: S.muted }}>
                    <MapPin size={10} className="inline mr-0.5" />GPS location will be captured
                  </p>
                )}
              </div>
            </div>

            {/* Today's active jobs */}
            {(() => {
              const activeJobs = jobCards.filter(j => j.status === 'pending' || j.status === 'in_progress')
              if (activeJobs.length === 0) return (
                <div className="rounded-2xl py-10 flex flex-col items-center gap-2" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <CheckCircle2 size={28} style={{ color: S.border }} />
                  <p className="text-sm font-semibold" style={{ color: S.muted }}>All caught up</p>
                  <p className="text-xs" style={{ color: S.muted }}>No pending jobs right now</p>
                </div>
              )
              return (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
                    Your Jobs · {activeJobs.length} active
                  </p>
                  <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                    {activeJobs.map((j, i) => {
                      const ss = STATUS_STYLE[j.status] ?? STATUS_STYLE.pending
                      const client = !Array.isArray(j.client) ? j.client : null
                      return (
                        <button key={j.id}
                          onClick={() => router.push(`/supplier-portal/staff-home/job/${j.id}`)}
                          className="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70"
                          style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ss.bg }}>
                            <ClipboardList size={16} style={{ color: ss.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                              {j.scheduled_at && (
                                <span className="text-[10px] flex items-center gap-0.5" style={{ color: S.muted }}>
                                  <Calendar size={9} />{new Date(j.scheduled_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{j.title}</p>
                            <div className="flex items-center gap-3 text-xs mt-0.5 flex-wrap" style={{ color: S.muted }}>
                              {j.location && <span className="flex items-center gap-0.5"><MapPin size={9} />{j.location}</span>}
                              {client && <span>{client.client_name}</span>}
                            </div>
                          </div>
                          <ChevronRight size={15} style={{ color: S.muted }} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── JOBS TAB ── */}
        {tab === 'jobs' && (
          <div className="px-4 pt-4">
            {jobCards.length === 0 ? (
              <div className="rounded-2xl py-16 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <ClipboardList size={28} className="mx-auto mb-3" style={{ color: S.muted }} />
                <p className="font-semibold text-sm mb-1" style={{ color: S.text }}>No jobs assigned</p>
                <p className="text-xs" style={{ color: S.muted }}>Tap + to create a new job card</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                {jobCards.map((j, i) => {
                  const ss = STATUS_STYLE[j.status] ?? STATUS_STYLE.pending
                  const client = !Array.isArray(j.client) ? j.client : null
                  return (
                    <button key={j.id}
                      onClick={() => router.push(`/supplier-portal/staff-home/job/${j.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70"
                      style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: ss.bg }}>
                        <ClipboardList size={16} style={{ color: ss.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-[10px] font-mono" style={{ color: S.muted }}>{j.job_number}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                        </div>
                        <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{j.title}</p>
                        <div className="flex items-center gap-3 text-xs mt-0.5 flex-wrap" style={{ color: S.muted }}>
                          {j.location && <span className="flex items-center gap-0.5"><MapPin size={9} />{j.location}</span>}
                          {j.scheduled_at && <span className="flex items-center gap-0.5"><Calendar size={9} />{new Date(j.scheduled_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>}
                          {client && <span>{client.client_name}</span>}
                        </div>
                      </div>
                      <ChevronRight size={15} style={{ color: S.muted }} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className="px-4 pt-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
              Punch History · 30 days
            </p>
            {days.length === 0 ? (
              <div className="rounded-2xl py-12 flex flex-col items-center gap-2" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <Clock size={28} style={{ color: S.border }} />
                <p className="text-sm" style={{ color: S.muted }}>No punches recorded yet</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                {days.map(([day, dayPunches], di) => (
                  <div key={day} style={{ borderTop: di > 0 ? `1px solid ${S.border}` : undefined }}>
                    <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, background: S.bg }}>
                      {fmtDate(day + 'T12:00:00')}
                    </p>
                    {dayPunches.map(punch => (
                      <div key={punch.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: `1px solid ${S.border}` }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: punch.punch_type === 'clock_in' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)' }}>
                          {punch.punch_type === 'clock_in'
                            ? <LogIn size={12} style={{ color: S.green }} />
                            : <LogOut size={12} style={{ color: S.danger }} />}
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
        )}

        {/* ── MORE TAB ── */}
        {tab === 'more' && (
          <div className="px-4 pt-4">
            <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <button
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="w-full flex items-center gap-3 px-4 py-4 text-left"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(220,38,38,0.08)' }}>
                  {signingOut
                    ? <Loader2 size={18} className="animate-spin" style={{ color: S.danger }} />
                    : <SignOutIcon size={18} style={{ color: S.danger }} />}
                </div>
                <span className="text-sm font-semibold" style={{ color: S.danger }}>
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <StaffBottomNav
        activeTab={tab}
        onTabChange={t => setTab(t)}
        onNewJob={() => setShowNewJob(true)}
        jobsBadge={jobCards.filter(j => j.status === 'pending' || j.status === 'in_progress').length || undefined}
      />

      {/* New Job modal */}
      {showNewJob && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewJob(false) }}>
          <div className="w-full rounded-t-3xl overflow-hidden" style={{ background: S.card, paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <h2 className="font-bold text-base" style={{ color: S.text }}>New Job Card</h2>
              <button onClick={() => setShowNewJob(false)} style={{ color: S.muted }}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>Job Title *</label>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. DB board replacement"
                  autoFocus
                  className="w-full px-3.5 py-3 rounded-xl outline-none"
                  style={{ background: S.bg, border: `1.5px solid ${S.border}`, color: S.text, fontSize: '16px' }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {JOB_TYPES.map(t => (
                    <button key={t.value} onClick={() => setNewType(t.value)}
                      className="py-2.5 rounded-xl text-sm font-semibold"
                      style={{
                        background: newType === t.value ? S.accent : S.bg,
                        color: newType === t.value ? '#fff' : S.muted,
                        border: `1.5px solid ${newType === t.value ? S.accent : S.border}`,
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>Location (optional)</label>
                <input
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  placeholder="e.g. 12 Oak Ave, Sandton"
                  className="w-full px-3.5 py-3 rounded-xl outline-none"
                  style={{ background: S.bg, border: `1.5px solid ${S.border}`, color: S.text, fontSize: '16px' }}
                />
              </div>
              {createError && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: S.danger }}>{createError}</p>
              )}
              <button
                onClick={() => void handleCreateJob()}
                disabled={!newTitle.trim() || creating}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                {creating ? <Loader2 size={16} className="animate-spin inline mr-2" /> : null}
                {creating ? 'Creating…' : 'Create Job Card'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
