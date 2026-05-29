'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Bell, CheckCheck } from 'lucide-react'

type OrgNotification = {
  id: string
  type: string
  title: string
  body: string | null
  metadata: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

const TYPE_ICONS: Record<string, string> = {
  quote_approved:           '✓',
  quote_declined:           '✗',
  price_request_responded:  '↩',
  payment_deposit:          'R',
  payment_paid:             '✓',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<OrgNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnread(data.count ?? 0)
    } catch {
      // silently ignore network errors on background poll
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const isMobile = window.innerWidth < 768
      if (isMobile) {
        setPanelStyle({ top: rect.bottom + 8, left: 12, right: 12 })
      } else {
        // Position panel to the right of the sidebar button
        setPanelStyle({ top: Math.max(8, rect.top - 8), left: rect.right + 12 })
      }
    }

    const opening = !open
    setOpen(opening)

    if (opening && unread > 0) {
      // Optimistically clear badge
      setUnread(0)
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
      fetch('/api/notifications/mark-read', { method: 'POST' }).catch(() => {})
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative flex items-center justify-center w-6 h-6 rounded text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors mt-1.5"
        aria-label="Notifications"
      >
        <Bell size={12} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[13px] h-[13px] text-[8px] font-bold bg-orange-500 text-white rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {mounted && open && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="fixed z-[70] w-80 max-h-[440px] bg-white rounded-xl shadow-2xl border border-[#EDE9E1] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#EDE9E1] flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] font-semibold text-[#1A1A18] uppercase tracking-widest">
              Notifications
            </span>
            {notifications.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-[#C4BFB5]">
                <CheckCheck size={10} /> all read
              </span>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={18} className="mx-auto text-[#D4CFC7] mb-2.5" />
                <p className="text-[11px] text-[#C4BFB5]">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-[#F5F2EC] last:border-0 flex items-start gap-3 ${!n.read_at ? 'bg-[#FDFAF5]' : ''}`}
                >
                  {/* Type indicator */}
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5
                    ${n.type === 'quote_approved' || n.type === 'payment_paid' ? 'bg-emerald-100 text-emerald-600' :
                      n.type === 'quote_declined' ? 'bg-red-100 text-red-500' :
                      'bg-[#F5F2EC] text-[#9A7B4F]'}`}
                  >
                    {TYPE_ICONS[n.type] ?? '·'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-medium text-[#1A1A18] leading-snug">{n.title}</p>
                      {!n.read_at && (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-[11px] text-[#8A877F] mt-0.5 leading-relaxed">{n.body}</p>
                    )}
                    <p className="text-[10px] text-[#C4BFB5] mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
