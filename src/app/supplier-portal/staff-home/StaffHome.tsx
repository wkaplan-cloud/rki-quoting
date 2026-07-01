'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { reverseGeocode } from '@/lib/reverse-geocode'
import {
  MapPin, LogIn, LogOut, Loader2, CheckCircle2, AlertCircle,
  ClipboardList, ChevronRight, Calendar, Clock, X, LogOut as SignOutIcon, Plus, FolderOpen, RefreshCw, Bell, BellOff, WifiOff,
} from 'lucide-react'
import type { ElecStaff, ElecTimePunch, ElecJobCard, ElecJobCardType, ElecClient, ElecJob } from '@/lib/elec-types'
import { StaffBottomNav } from './StaffBottomNav'
import { OfflineSyncBanner } from './OfflineSyncBanner'
import { enqueue, pendingCount } from '@/lib/offline-punch-queue'

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

type Tab = 'home' | 'jobs' | 'projects' | 'history' | 'more'

type ClientItem = Pick<ElecClient, 'id' | 'client_name' | 'company' | 'email'>

interface Props {
  staff: Pick<ElecStaff, 'id' | 'name' | 'role' | 'color'>
  companyName: string
  portalAccountId: string
  initialPunches: ElecTimePunch[]
  isClockedIn: boolean
  assignedJobCards: ElecJobCard[]
  initialClients: ClientItem[]
  assignedProjects: { id: string; quote_number: string; project_name: string; project_address: string | null; status: string; client: { id: string; client_name: string } | null }[]
  scheduledToday?: ElecJob[]
  initialTab?: Tab
}

export function StaffHome({ staff, companyName, portalAccountId: _portalAccountId, initialPunches, isClockedIn: initClockedIn, assignedJobCards: initJobCards, initialClients, assignedProjects, scheduledToday = [], initialTab = 'home' }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>(initialTab)
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

  // Active clock-in job tracking
  const [activeJobCardId, setActiveJobCardId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/supplier-portal/staff/punch')
      .then(r => r.json())
      .then((d: { isClockedIn: boolean; lastPunch: { job_id: string | null } | null }) => {
        if (d.isClockedIn && d.lastPunch?.job_id) setActiveJobCardId(d.lastPunch.job_id)
      })
      .catch(() => {})
  }, [])

  // New job modal
  const [showNewJob, setShowNewJob] = useState(false)
  const [jobCards, setJobCards] = useState<ElecJobCard[]>(initJobCards)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<ElecJobCardType>('callout')
  const [newLocation, setNewLocation] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Client picker in new-job modal
  const [clients, setClients] = useState<ClientItem[]>(initialClients)
  const [newClientId, setNewClientId] = useState<string | null>(null)
  const [newClientName, setNewClientName] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clientFocused, setClientFocused] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)

  // Refresh
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 1200)
  }

  // Push notifications
  const [notifState, setNotifState] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown')
  const [enablingNotifs, setEnablingNotifs] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotifState('unsupported')
      return
    }
    setNotifState(Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'unknown')

    // Register service worker (Web Push for browser users)
    navigator.serviceWorker.register('/sw.js').catch(() => {})

    function registerFcmToken(token: string) {
      fetch('/api/supplier-portal/staff/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcm_token: token }),
      }).catch(() => {})
      setNotifState('granted')
    }

    // Check immediately — token may already be set before React mounted
    const immediate = (window as unknown as { __fcmToken?: string }).__fcmToken
    if (immediate) { registerFcmToken(immediate); return }

    // Poll for up to 4 seconds — Android WebView sometimes injects __fcmToken
    // slightly after the page finishes mounting
    let attempts = 0
    const poll = setInterval(() => {
      const token = (window as unknown as { __fcmToken?: string }).__fcmToken
      if (token) { clearInterval(poll); registerFcmToken(token); return }
      if (++attempts >= 40) clearInterval(poll)
    }, 100)

    return () => clearInterval(poll)
  }, [])

  async function enableNotifications() {
    if (enablingNotifs) return
    setEnablingNotifs(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setNotifState('denied'); setEnablingNotifs(false); return }
      setNotifState('granted')

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { setEnablingNotifs(false); return }

      // Convert VAPID public key to Uint8Array
      const key = vapidKey.replace(/-/g, '+').replace(/_/g, '/')
      const raw = Uint8Array.from(atob(key), c => c.charCodeAt(0))

      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw })
      const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }

      await fetch('/api/supplier-portal/staff/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subJson),
      })
    } catch {}
    setEnablingNotifs(false)
  }

  // Sign out
  const [signingOut, setSigningOut] = useState(false)

  const [offlinePending, setOfflinePending] = useState(() => (typeof window !== 'undefined' ? pendingCount() : 0))
  const [isOnline, setIsOnline] = useState(() => (typeof window !== 'undefined' ? navigator.onLine : true))

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  async function handlePunch() {
    const punchType = isClockedIn ? 'clock_out' : 'clock_in'
    const punchedAt = new Date().toISOString()
    setClockStatus('locating')
    setClockMsg('Getting your location…')

    let latitude: number | undefined
    let longitude: number | undefined

    // iOS standalone PWA blocks high-accuracy GPS requests; Android does not
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

    if (!navigator.geolocation) {
      setGpsBlocked(true)
    } else {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            timeout: 15000,
            maximumAge: 60000,
            enableHighAccuracy: !isIos,
          })
        )
        latitude = pos.coords.latitude
        longitude = pos.coords.longitude
        setGpsBlocked(false)
      } catch (err) {
        const code = (err as GeolocationPositionError).code
        // On iOS PWA: any GPS failure (permission denied=1, unavailable=2, timeout=3)
        // means no location will be captured — surface the banner so the user can act.
        setGpsBlocked(isIos ? true : code === 1)
      }
    }

    setClockStatus('punching')
    setClockMsg(punchType === 'clock_in' ? 'Clocking in…' : 'Clocking out…')

    try {
      const res = await fetch('/api/supplier-portal/staff/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ punch_type: punchType, punched_at: punchedAt, latitude, longitude }),
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
      // No internet — save to local queue with the exact timestamp
      enqueue({ punch_type: punchType, punched_at: punchedAt, latitude, longitude })
      setOfflinePending(pendingCount())
      // Optimistically update UI so the worker knows their action was captured
      setIsClockedIn(punchType === 'clock_in')
      setClockStatus('done')
      setClockMsg((punchType === 'clock_in' ? 'Clocked in ✓' : 'Clocked out ✓') + ' · saved offline')
      setTimeout(() => { setClockStatus('idle'); setClockMsg('') }, 3000)
    }
  }

  async function handleCreateJob() {
    if (!newTitle.trim() || creating) return
    setCreating(true); setCreateError('')
    const res = await fetch('/api/supplier-portal/quoting/job-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        job_type: newType,
        location: newLocation.trim() || null,
        client_id: newClientId || null,
        client_name: newClientName.trim() || null,
      }),
    })
    const data = await res.json() as ElecJobCard & { error?: string }
    if (!res.ok || data.error) { setCreateError(data.error ?? 'Failed to create'); setCreating(false); return }
    setJobCards(prev => [data, ...prev])
    resetModalState()
    setCreating(false)
    router.push(`/supplier-portal/staff-home/job/${data.id}`)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/supplier-portal/login')
  }

  async function createAndSelectClient() {
    const name = clientSearch.trim()
    if (!name || creatingClient) return
    setCreatingClient(true)
    const res = await fetch('/api/supplier-portal/staff/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: name }),
    })
    if (res.ok) {
      const c = await res.json() as ClientItem
      setClients(prev => [...prev, c].sort((a, b) => a.client_name.localeCompare(b.client_name)))
      setNewClientId(c.id)
      setNewClientName(c.client_name)
      setClientSearch('')
      setClientFocused(false)
    }
    setCreatingClient(false)
  }

  function resetModalState() {
    setShowNewJob(false)
    setNewTitle(''); setNewType('callout'); setNewLocation('')
    setCreateError('')
    setNewClientId(null); setNewClientName(''); setClientSearch(''); setClientFocused(false)
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
        <button
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="p-2 rounded-lg disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
          title="Refresh">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
        {!isOnline && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0"
            style={{ background: 'rgba(217,164,65,0.2)' }}>
            <WifiOff size={11} style={{ color: S.gold }} />
            <span className="text-[11px] font-semibold" style={{ color: S.gold }}>Offline</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: isClockedIn ? 'rgba(22,163,74,0.25)' : 'rgba(255,255,255,0.08)' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: isClockedIn ? S.green : 'rgba(255,255,255,0.3)' }} />
          <span className="text-[11px] font-semibold" style={{ color: isClockedIn ? '#4ADE80' : 'rgba(255,255,255,0.4)' }}>
            {isClockedIn ? 'On site' : 'Off site'}
          </span>
        </div>
      </div>

      {/* Offline sync banner — shown whenever there are queued punches */}
      <OfflineSyncBanner onSynced={() => setOfflinePending(0)} />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pb-24">

        {/* ── HOME TAB ── */}
        {tab === 'home' && (
          <div className="px-4 pt-4 space-y-4">

            {/* GPS permission banner */}
            {gpsBlocked && (() => {
              const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
              return (
                <div className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <MapPin size={16} className="flex-shrink-0 mt-0.5" style={{ color: S.danger }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: S.danger }}>Location access blocked</p>
                    {isIos ? (
                      <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                        Go to <strong>Settings → Privacy &amp; Security → Location Services</strong>, find <strong>QuotingHub</strong> (or this website) and set to <strong>While Using</strong>. Then try again.
                      </p>
                    ) : (
                      <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                        Tap the <strong>lock icon</strong> in your browser&apos;s address bar → <strong>Permissions → Location → Allow</strong>. Then try again.
                      </p>
                    )}
                  </div>
                </div>
              )
            })()}

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

            {/* Enable notifications banner — shown once until granted */}
            {notifState === 'unknown' && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(58,124,165,0.06)', border: `1px solid rgba(58,124,165,0.2)` }}>
                <Bell size={16} className="flex-shrink-0" style={{ color: S.accent }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: S.text }}>Enable clock-in reminders</p>
                  <p className="text-xs mt-0.5" style={{ color: S.muted }}>Get notified at 5pm and 7:30pm to clock in/out</p>
                </div>
                <button
                  onClick={() => void enableNotifications()}
                  disabled={enablingNotifs}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: S.accent, color: '#fff' }}>
                  {enablingNotifs ? <Loader2 size={12} className="animate-spin inline" /> : 'Enable'}
                </button>
              </div>
            )}
            {notifState === 'denied' && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(113,113,122,0.06)', border: `1px solid rgba(113,113,122,0.2)` }}>
                <BellOff size={15} className="flex-shrink-0" style={{ color: S.muted }} />
                <p className="text-xs" style={{ color: S.muted }}>
                  Notifications blocked — enable them in your browser settings to receive clock-in reminders.
                </p>
              </div>
            )}

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
                      const isActive = activeJobCardId === j.id
                      return (
                        <button key={j.id}
                          onClick={() => router.push(`/supplier-portal/staff-home/job/${j.id}`)}
                          className="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70"
                          style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative" style={{ background: isActive ? 'rgba(22,163,74,0.12)' : ss.bg }}>
                            <ClipboardList size={16} style={{ color: isActive ? S.green : ss.color }} />
                            {isActive && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: S.green }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                              {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(22,163,74,0.12)', color: S.green }}>● Active</span>}
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

            {/* Today's scheduled calendar jobs */}
            {scheduledToday.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
                  Scheduled Today · {scheduledToday.length} job{scheduledToday.length !== 1 ? 's' : ''}
                </p>
                <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  {scheduledToday.map((j, i) => {
                    const linked = !Array.isArray(j.quote) ? j.quote : null
                    return (
                      <div key={j.id} className="flex items-center gap-3 px-4 py-3.5"
                        style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(58,124,165,0.1)' }}>
                          <Calendar size={16} style={{ color: S.accent }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{j.title}</p>
                          <div className="flex items-center gap-3 text-xs mt-0.5 flex-wrap" style={{ color: S.muted }}>
                            <span className="flex items-center gap-0.5">
                              <Clock size={9} />{j.start_time.slice(0,5)} – {j.end_time.slice(0,5)}
                            </span>
                            {j.address && <span className="flex items-center gap-0.5"><MapPin size={9} />{j.address}</span>}
                            {linked && <span>{linked.project_name}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── JOBS TAB ── */}
        {tab === 'jobs' && (
          <div className="px-4 pt-4">
            {(() => {
              const activeJobCards = jobCards.filter(j => j.status !== 'completed' && j.status !== 'cancelled')
              if (activeJobCards.length === 0) return (
                <div className="rounded-2xl py-16 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <ClipboardList size={28} className="mx-auto mb-3" style={{ color: S.muted }} />
                  <p className="font-semibold text-sm mb-1" style={{ color: S.text }}>No active jobs</p>
                  <p className="text-xs" style={{ color: S.muted }}>Tap + to create a new job card</p>
                </div>
              )
              return (
              <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                {activeJobCards.map((j, i) => {
                  const ss = STATUS_STYLE[j.status] ?? STATUS_STYLE.pending
                  const client = !Array.isArray(j.client) ? j.client : null
                  const isActive = activeJobCardId === j.id
                  return (
                    <button key={j.id}
                      onClick={() => router.push(`/supplier-portal/staff-home/job/${j.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70"
                      style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                        style={{ background: isActive ? 'rgba(22,163,74,0.12)' : ss.bg }}>
                        <ClipboardList size={16} style={{ color: isActive ? S.green : ss.color }} />
                        {isActive && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: S.green }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-[10px] font-mono" style={{ color: S.muted }}>{j.job_number}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                          {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(22,163,74,0.12)', color: S.green }}>● Active</span>}
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
              )
            })()}
          </div>
        )}

        {/* ── PROJECTS TAB ── */}
        {tab === 'projects' && (
          <div className="px-4 pt-4">
            {(() => {
              const activeProjects = assignedProjects.filter(p => p.status !== 'completed' && p.status !== 'cancelled')
              if (activeProjects.length === 0) return (
                <div className="rounded-2xl py-16 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <FolderOpen size={28} className="mx-auto mb-3" style={{ color: S.muted }} />
                  <p className="font-semibold text-sm mb-1" style={{ color: S.text }}>No active projects</p>
                  <p className="text-xs" style={{ color: S.muted }}>Active projects assigned to you will appear here</p>
                </div>
              )
              return (
              <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                {activeProjects.map((p, i) => {
                  const client = !Array.isArray(p.client) ? p.client : null
                  return (
                    <button key={p.id}
                      onClick={() => router.push(`/supplier-portal/staff-home/project/${p.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70"
                      style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                        style={{ background: isClockedIn ? 'rgba(22,163,74,0.1)' : 'rgba(58,124,165,0.1)' }}>
                        <FolderOpen size={16} style={{ color: isClockedIn ? S.green : S.accent }} />
                        {isClockedIn && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: S.green }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-[10px] font-mono" style={{ color: S.muted }}>{p.quote_number}</p>
                          {isClockedIn && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>● On Site</span>}
                        </div>
                        <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{p.project_name}</p>
                        <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: S.muted }}>
                          {client && <span>{client.client_name}</span>}
                          {p.project_address && <span className="flex items-center gap-0.5"><MapPin size={9} />{p.project_address}</span>}
                        </div>
                      </div>
                      <ChevronRight size={15} style={{ color: S.muted }} />
                    </button>
                  )
                })}
              </div>
              )
            })()}
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
        projectsBadge={assignedProjects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').length || undefined}
      />

      {/* New Job modal */}
      {showNewJob && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) resetModalState() }}>
          <div className="w-full rounded-t-3xl" style={{ background: S.card, paddingBottom: 'env(safe-area-inset-bottom)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10" style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
              <h2 className="font-bold text-base" style={{ color: S.text }}>New Job Card</h2>
              <button onClick={() => resetModalState()} style={{ color: S.muted }}><X size={18} /></button>
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

              {/* Client picker */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>Client (optional)</label>
                {newClientId ? (
                  <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
                    style={{ background: 'rgba(58,124,165,0.08)', border: `1.5px solid ${S.accent}` }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'rgba(58,124,165,0.15)', color: S.accent }}>
                      {newClientName.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm font-semibold" style={{ color: S.text }}>{newClientName}</span>
                    <button onClick={() => { setNewClientId(null); setNewClientName(''); setClientSearch('') }}
                      className="p-1" style={{ color: S.muted }}>
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      onFocus={() => setClientFocused(true)}
                      onBlur={() => setTimeout(() => setClientFocused(false), 150)}
                      placeholder="Search or add client…"
                      className="w-full px-3.5 py-3 rounded-xl outline-none"
                      style={{ background: S.bg, border: `1.5px solid ${clientFocused ? S.accent : S.border}`, color: S.text, fontSize: '16px' }}
                    />
                    {(clientFocused || clientSearch.trim()) && (() => {
                      const filtered = clientSearch.trim()
                        ? clients.filter(c => c.client_name.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 6)
                        : clients.slice(0, 5)
                      const exactMatch = clients.some(c => c.client_name.toLowerCase() === clientSearch.trim().toLowerCase())
                      if (!filtered.length && !clientSearch.trim()) return null
                      return (
                        <div className="mt-1 rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}`, background: S.card, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                          {filtered.map((c, i) => (
                            <button key={c.id}
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => { setNewClientId(c.id); setNewClientName(c.client_name); setClientSearch(''); setClientFocused(false) }}
                              className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
                              style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                                style={{ background: 'rgba(58,124,165,0.1)', color: S.accent }}>
                                {c.client_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium" style={{ color: S.text }}>{c.client_name}</p>
                                {c.company && <p className="text-xs truncate" style={{ color: S.muted }}>{c.company}</p>}
                              </div>
                            </button>
                          ))}
                          {clientSearch.trim() && !exactMatch && (
                            <button
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => void createAndSelectClient()}
                              disabled={creatingClient}
                              className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left"
                              style={{ borderTop: filtered.length > 0 ? `1px solid ${S.border}` : undefined }}>
                              {creatingClient
                                ? <Loader2 size={14} className="animate-spin" style={{ color: S.accent }} />
                                : <Plus size={14} style={{ color: S.accent }} />}
                              <span className="text-sm font-medium" style={{ color: S.accent }}>
                                {creatingClient ? 'Adding…' : `Add "${clientSearch.trim()}" as new client`}
                              </span>
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
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
