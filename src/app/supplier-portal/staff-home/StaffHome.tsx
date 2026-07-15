'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { reverseGeocode } from '@/lib/reverse-geocode'
import {
  MapPin, LogIn, LogOut, Loader2, CheckCircle2, AlertCircle,
  ClipboardList, ClipboardCheck, ChevronRight, Calendar, Clock, X, LogOut as SignOutIcon, Plus, FolderOpen, RefreshCw, Bell, BellOff, WifiOff,
} from 'lucide-react'
import type { ElecStaff, ElecTimePunch, ElecJobCard, ElecJobCardType, ElecJob } from '@/lib/elec-types'
import { StaffBottomNav } from './StaffBottomNav'
import { OfflineSyncBanner } from './OfflineSyncBanner'
import { ClientPicker, type ClientItem } from './ClientPicker'
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

type Tab = 'home' | 'jobs' | 'projects' | 'history' | 'inspect'

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
      .then((d: { isClockedIn: boolean; punches: { punch_type: string; job_id: string | null }[] }) => {
        // Find the most recent job-linked punch — if it's a clock_in, that job is active
        const lastJobPunch = (d.punches ?? []).find(p => p.job_id)
        if (lastJobPunch?.punch_type === 'clock_in') setActiveJobCardId(lastJobPunch.job_id!)
        else setActiveJobCardId(null)
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

  // New Inspection modal
  const [showNewInspection, setShowNewInspection] = useState(false)
  const [inspClientId, setInspClientId] = useState<string | null>(null)
  const [inspClientName, setInspClientName] = useState('')
  const [inspLocation, setInspLocation] = useState('')
  const [creatingInspection, setCreatingInspection] = useState(false)
  const [inspectionError, setInspectionError] = useState('')

  // Refresh
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 1200)
  }

  // GPS permission — only relevant for iOS standalone PWA where the dialog is buggy.
  // In normal Safari the browser handles GPS natively; no Enable button needed.
  const isIosStandalone =
    typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    (navigator as unknown as { standalone?: boolean }).standalone === true

  const [gpsPermState, setGpsPermState] = useState<'unknown' | 'granted' | 'denied' | 'unsupported' | 'dismissed'>('unknown')
  const [enablingGps, setEnablingGps] = useState(false)

  function dismissGpsBanner() {
    localStorage.setItem('gps_banner_dismissed', '1')
    setGpsPermState('dismissed')
  }

  useEffect(() => {
    if (!isIosStandalone) { setGpsPermState('granted'); return }
    if (localStorage.getItem('gps_banner_dismissed')) { setGpsPermState('dismissed'); return }
    if (!navigator.geolocation) { setGpsPermState('unsupported'); return }
    if (!navigator.permissions) return
    navigator.permissions.query({ name: 'geolocation' }).then(r => {
      if (r.state === 'granted') setGpsPermState('granted')
      else if (r.state === 'denied') setGpsPermState('denied')
    }).catch(() => {})
  }, []) // eslint-disable-line

  function enableGps() {
    if (enablingGps || !navigator.geolocation) return

    setEnablingGps(true)
    navigator.geolocation.getCurrentPosition(
      () => { setGpsPermState('granted'); setGpsBlocked(false); setEnablingGps(false) },
      (err) => {
        // Permission denied — navigate to the GPS recovery page which explains
        // how to reset iOS standalone PWA geolocation permission in Settings.
        if (err.code === 1) {
          window.location.href = '/supplier-portal/staff-gps'
          return
        }
        setEnablingGps(false)
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
    )
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

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

    if (!navigator.geolocation) {
      setGpsBlocked(true)
    } else {
      try {
        // iOS requires enableHighAccuracy:true to trigger the permission dialog on first use.
        // If it times out (common on some iOS devices), fall back to low-accuracy (network-based).
        const getPosition = (highAccuracy: boolean) =>
          new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, {
              timeout: highAccuracy ? 10000 : 8000,
              maximumAge: 60000,
              enableHighAccuracy: highAccuracy,
            })
          )

        let pos: GeolocationPosition
        try {
          pos = await getPosition(true)
        } catch (err) {
          // On iOS, a TIMEOUT from high-accuracy is expected — fall back silently.
          // PERMISSION_DENIED (code 1) means we should not retry.
          if ((err as GeolocationPositionError).code === 1) throw err
          pos = await getPosition(false)
        }

        latitude = pos.coords.latitude
        longitude = pos.coords.longitude
        setGpsBlocked(false)
      } catch (err) {
        const code = (err as GeolocationPositionError).code
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
      const data = await res.json() as { ok?: boolean; punch?: ElecTimePunch; address?: string | null; locationSource?: 'gps' | 'ip' | 'none'; error?: string }
      if (!res.ok || !data.ok) { setClockStatus('error'); setClockMsg(data.error ?? 'Failed'); return }
      setIsClockedIn(punchType === 'clock_in')
      if (data.punch) setPunches(prev => [data.punch!, ...prev])
      if (data.address) setLastPunchAddress(data.address)
      setClockStatus('done')
      const locationTag = data.address
        ? ` · ${data.address}${data.locationSource === 'ip' ? ' (approx)' : ''}`
        : latitude ? ' · GPS ✓' : ' · no GPS'
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

  function addClient(c: ClientItem) {
    setClients(prev => [...prev, c].sort((a, b) => a.client_name.localeCompare(b.client_name)))
  }

  function resetModalState() {
    setShowNewJob(false)
    setNewTitle(''); setNewType('callout'); setNewLocation('')
    setCreateError('')
    setNewClientId(null); setNewClientName('')
  }

  function resetInspectionModalState() {
    setShowNewInspection(false)
    setInspClientId(null); setInspClientName(''); setInspLocation('')
    setInspectionError('')
  }

  async function handleCreateInspection() {
    if (!inspClientId && !inspClientName.trim()) { setInspectionError('Pick or add a client'); return }
    if (creatingInspection) return
    setCreatingInspection(true); setInspectionError('')
    const res = await fetch('/api/supplier-portal/quoting/job-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Inspection — ${inspClientName.trim()}`,
        job_type: 'inspection',
        location: inspLocation.trim() || null,
        client_id: inspClientId || null,
        client_name: inspClientName.trim() || null,
      }),
    })
    const data = await res.json() as ElecJobCard & { error?: string }
    if (!res.ok || data.error) { setInspectionError(data.error ?? 'Failed to create'); setCreatingInspection(false); return }
    setJobCards(prev => [data, ...prev])
    resetInspectionModalState()
    setCreatingInspection(false)
    router.push(`/supplier-portal/staff-home/inspection/${data.id}`)
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
        <button
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="p-2 rounded-lg disabled:opacity-50"
          style={{ background: 'rgba(220,38,38,0.15)', color: '#F87171' }}
          title="Sign out">
          {signingOut ? <Loader2 size={15} className="animate-spin" /> : <SignOutIcon size={15} />}
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

            {/* GPS permission banners */}
            {gpsPermState === 'unknown' && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(58,124,165,0.06)', border: `1px solid rgba(58,124,165,0.2)` }}>
                <MapPin size={16} className="flex-shrink-0" style={{ color: S.accent }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: S.text }}>Enable GPS location</p>
                  <p className="text-xs mt-0.5" style={{ color: S.muted }}>Captures your location when clocking in/out</p>
                </div>
                <button
                  onClick={() => enableGps()}
                  disabled={enablingGps}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: S.accent, color: '#fff' }}>
                  {enablingGps ? <Loader2 size={12} className="animate-spin inline" /> : 'Enable'}
                </button>
                <button
                  onClick={dismissGpsBanner}
                  className="flex-shrink-0 p-1 rounded-full"
                  style={{ color: S.muted, background: 'transparent', border: 'none', cursor: 'pointer' }}
                  aria-label="Dismiss">
                  <X size={14} />
                </button>
              </div>
            )}
            {(gpsPermState === 'denied' || (gpsBlocked && gpsPermState !== 'unknown')) && (() => {
              const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
              return (
                <div className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <MapPin size={16} className="flex-shrink-0 mt-0.5" style={{ color: S.danger }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: S.danger }}>Location access blocked</p>
                    {isIos ? (
                      <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                        Go to <strong>Settings → Privacy &amp; Security → Location Services → Safari Websites</strong> and set to <strong>While Using</strong>. Then try again.
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

        {/* ── INSPECT TAB ── */}
        {tab === 'inspect' && (
          <div className="px-4 pt-4">
            {(() => {
              const inspections = jobCards.filter(j => j.job_type === 'inspection')
              return (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowNewInspection(true)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white"
                    style={{ background: S.accent }}>
                    <Plus size={15} /> New Inspection
                  </button>
                  {inspections.length === 0 ? (
                    <div className="rounded-2xl py-16 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                      <ClipboardCheck size={28} className="mx-auto mb-3" style={{ color: S.muted }} />
                      <p className="font-semibold text-sm mb-1" style={{ color: S.text }}>No inspections yet</p>
                      <p className="text-xs" style={{ color: S.muted }}>Start a COC inspection while you're on site</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                      {inspections.map((j, i) => {
                        const ss = STATUS_STYLE[j.status] ?? STATUS_STYLE.pending
                        const client = !Array.isArray(j.client) ? j.client : null
                        return (
                          <button key={j.id}
                            onClick={() => router.push(`/supplier-portal/staff-home/inspection/${j.id}`)}
                            className="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70"
                            style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ss.bg }}>
                              <ClipboardCheck size={16} style={{ color: ss.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                              </div>
                              <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{client?.client_name ?? j.client_name ?? j.title}</p>
                              {j.location && <p className="text-xs mt-0.5 flex items-center gap-0.5" style={{ color: S.muted }}><MapPin size={9} />{j.location}</p>}
                            </div>
                            <ChevronRight size={15} style={{ color: S.muted }} />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
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
              <ClientPicker
                clients={clients}
                selectedId={newClientId}
                selectedName={newClientName}
                onSelect={(id, name) => { setNewClientId(id); setNewClientName(name) }}
                onClientCreated={addClient}
              />

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

      {/* New Inspection modal */}
      {showNewInspection && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) resetInspectionModalState() }}>
          <div className="w-full rounded-t-3xl" style={{ background: S.card, paddingBottom: 'env(safe-area-inset-bottom)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10" style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
              <h2 className="font-bold text-base" style={{ color: S.text }}>New Inspection</h2>
              <button onClick={() => resetInspectionModalState()} style={{ color: S.muted }}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <ClientPicker
                label="Client *"
                clients={clients}
                selectedId={inspClientId}
                selectedName={inspClientName}
                onSelect={(id, name) => { setInspClientId(id); setInspClientName(name) }}
                onClientCreated={addClient}
              />
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>Installation Address (optional)</label>
                <input
                  value={inspLocation}
                  onChange={e => setInspLocation(e.target.value)}
                  placeholder="e.g. 12 Oak Ave, Sandton"
                  className="w-full px-3.5 py-3 rounded-xl outline-none"
                  style={{ background: S.bg, border: `1.5px solid ${S.border}`, color: S.text, fontSize: '16px' }}
                />
              </div>

              {inspectionError && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: S.danger }}>{inspectionError}</p>
              )}
              <button
                onClick={() => void handleCreateInspection()}
                disabled={(!inspClientId && !inspClientName.trim()) || creatingInspection}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                {creatingInspection ? <Loader2 size={16} className="animate-spin inline mr-2" /> : null}
                {creatingInspection ? 'Creating…' : 'Start Inspection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
