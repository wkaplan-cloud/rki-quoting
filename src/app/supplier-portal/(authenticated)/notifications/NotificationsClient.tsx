'use client'
import { useState, useEffect, useRef } from 'react'
import { Bell, LogIn, LogOut, FileText, CheckCircle2, AlertCircle, Info, DollarSign, MapPin } from 'lucide-react'
import type { ElecNotification } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

function typeIcon(type: string) {
  switch (type) {
    case 'clock_in':   return <LogIn size={14} style={{ color: S.green }} />
    case 'clock_out':  return <LogOut size={14} style={{ color: S.danger }} />
    case 'claim':      return <FileText size={14} style={{ color: S.accent }} />
    case 'payment':    return <DollarSign size={14} style={{ color: S.gold }} />
    case 'approved':   return <CheckCircle2 size={14} style={{ color: S.green }} />
    default:           return <Info size={14} style={{ color: S.muted }} />
  }
}

function typeColor(type: string) {
  switch (type) {
    case 'clock_in':  return { bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.2)' }
    case 'clock_out': return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)' }
    case 'claim':     return { bg: 'rgba(58,124,165,0.08)', border: 'rgba(58,124,165,0.2)' }
    case 'payment':   return { bg: 'rgba(217,164,65,0.08)', border: 'rgba(217,164,65,0.2)' }
    default:          return { bg: S.bg, border: S.border }
  }
}

function fmtRelative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

interface Props {
  portalAccountId: string
  initialNotifications: ElecNotification[]
}

export function NotificationsClient({ portalAccountId: _portalAccountId, initialNotifications }: Props) {
  const [notifications, setNotifications] = useState<ElecNotification[]>(initialNotifications)
  const latestCreatedAt = useRef(initialNotifications[0]?.created_at ?? new Date(0).toISOString())

  // Poll every 5 s for new notifications
  useEffect(() => {
    let alive = true

    async function poll() {
      try {
        const res = await fetch(`/api/supplier-portal/notifications?since=${encodeURIComponent(latestCreatedAt.current)}`)
        const d = await res.json() as { notifications: ElecNotification[] }
        if (!alive || !d.notifications?.length) return
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id))
          const fresh = d.notifications.filter(n => !existingIds.has(n.id))
          if (!fresh.length) return prev
          latestCreatedAt.current = fresh[0].created_at
          return [...fresh, ...prev]
        })
      } catch {}
    }

    const interval = setInterval(() => { void poll() }, 5000)
    return () => { alive = false; clearInterval(interval) }
  }, []) // eslint-disable-line

  const unreadCount = notifications.filter(n => !n.read_at).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell size={18} style={{ color: S.accent }} />
          <h1 className="font-bold text-sm uppercase tracking-widest" style={{ color: S.muted }}>Notifications</h1>
          {unreadCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: S.accent }}>{unreadCount}</span>
          )}
        </div>
        <button
          disabled={unreadCount === 0}
          onClick={async () => {
            const now = new Date().toISOString()
            await fetch('/api/supplier-portal/notifications/mark-read', { method: 'POST' })
            setNotifications(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }))
          }}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
          style={unreadCount > 0
            ? { color: '#fff', background: S.accent, border: `1px solid ${S.accent}` }
            : { color: S.muted, background: S.bg, border: `1px solid ${S.border}`, opacity: 0.5 }}>
          Mark all read
        </button>
      </div>

      {notifications.length === 0 && (
        <div className="rounded-2xl py-16 flex flex-col items-center gap-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <Bell size={32} style={{ color: S.border }} />
          <p className="text-sm" style={{ color: S.muted }}>No notifications yet</p>
          <p className="text-xs" style={{ color: S.muted }}>Activity from your team and projects will appear here in real time.</p>
        </div>
      )}

      {notifications.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {notifications.map((n, i) => {
            const colors = typeColor(n.type)
            const isUnread = !n.read_at
            return (
              <div key={n.id}
                className="flex items-start gap-3 px-4 py-3.5"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined, background: isUnread ? 'rgba(58,124,165,0.025)' : undefined }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                  {typeIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug" style={{ color: S.text }}>{n.title}</p>
                    <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: S.muted }}>{fmtRelative(n.created_at)}</span>
                  </div>
                  {n.body && <p className="text-xs mt-0.5" style={{ color: S.muted }}>{n.body}</p>}
                  {(() => {
                    const lat = n.metadata?.latitude as number | undefined
                    const lng = n.metadata?.longitude as number | undefined
                    if (!lat || !lng) return null
                    const addr = n.metadata?.address as string | undefined
                    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`
                    return (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs mt-1"
                        style={{ color: S.accent }}>
                        <MapPin size={10} />
                        {addr ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
                      </a>
                    )
                  })()}
                </div>
                {isUnread && (
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: S.accent }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
