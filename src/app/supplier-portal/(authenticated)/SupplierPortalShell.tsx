'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SupplierPortalNav } from './SupplierPortalNav'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Props {
  children: React.ReactNode
  companyName: string
  hasQuoting?: boolean
}

export function SupplierPortalShell({ children, companyName, hasQuoting = false }: Props) {
  const supabase = createClient()
  const [desktopExpanded, setDesktopExpanded] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [notificationCount, setNotificationCount] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('supplier-sidebar-expanded')
    if (saved !== null) setDesktopExpanded(saved === 'true')
  }, [])

  useEffect(() => {
    fetch('/api/supplier-portal/pending-count')
      .then(r => r.json())
      .then(d => setPendingCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  // Pre-unlock audio on first user interaction so autoplay works when notifications arrive
  useEffect(() => {
    const unlock = () => {
      const audio = audioRef.current
      if (!audio) return
      audio.play()
        .then(() => { audio.pause(); audio.currentTime = 0 })
        .catch(() => {})
    }
    document.addEventListener('click', unlock, { once: true })
    document.addEventListener('touchstart', unlock, { once: true })
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
  }, [])

  useEffect(() => {
    let alive = true

    function fetchCount() {
      return fetch('/api/supplier-portal/notification-count')
        .then(r => r.json())
        .then((d: { count: number; portalAccountId: string | null }) => d)
        .catch(() => ({ count: 0, portalAccountId: null }))
    }

    fetchCount().then(d => {
      if (!alive) return
      setNotificationCount(d.count ?? 0)
      if (!d.portalAccountId) return

      const channel = supabase
        .channel(`shell-notifications:${d.portalAccountId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'elec_notifications',
          filter: `portal_account_id=eq.${d.portalAccountId}`,
        }, () => {
          if (!alive) return
          setNotificationCount(c => c + 1)
          try { audioRef.current?.play().catch(() => {}) } catch {}
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'elec_notifications',
          filter: `portal_account_id=eq.${d.portalAccountId}`,
        }, () => {
          if (!alive) return
          fetchCount().then(d2 => { if (alive) setNotificationCount(d2.count ?? 0) })
        })
        .subscribe()

      channelRef.current = channel
    })

    // Poll every 60 s as a fallback — corrects any count drift if Realtime events are missed
    const poll = setInterval(() => {
      if (alive) fetchCount().then(d => { if (alive) setNotificationCount(d.count ?? 0) })
    }, 60_000)

    return () => {
      alive = false
      clearInterval(poll)
      if (channelRef.current) void supabase.removeChannel(channelRef.current)
    }
  }, []) // eslint-disable-line

  return (
    <div className="flex min-h-screen" style={{ background: '#F5F7F9' }}>
      {/* Hidden notification sound */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="auto">
        <source src="/notification.wav" type="audio/wav" />
      </audio>

      <SupplierPortalNav
        companyName={companyName}
        pendingCount={pendingCount}
        hasQuoting={hasQuoting}
        notificationCount={notificationCount}
        desktopExpanded={desktopExpanded}
        onDesktopToggle={() => setDesktopExpanded(e => {
          const next = !e
          localStorage.setItem('supplier-sidebar-expanded', String(next))
          return next
        })}
      />
      <main className={`${desktopExpanded ? 'md:ml-52' : 'md:ml-12'} flex-1 pt-14 md:pt-0 md:transition-[margin-left] md:duration-200`}>
        <div className="px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
