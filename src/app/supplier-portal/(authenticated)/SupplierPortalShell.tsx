'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SupplierPortalNav } from './SupplierPortalNav'

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
  const portalAccountIdRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  useEffect(() => {
    fetch('/api/supplier-portal/notification-count')
      .then(r => r.json())
      .then((d: { count: number; portalAccountId: string | null }) => {
        setNotificationCount(d.count ?? 0)
        portalAccountIdRef.current = d.portalAccountId

        if (!d.portalAccountId) return

        // Subscribe to new notifications via Realtime
        const channel = supabase
          .channel(`shell-notifications:${d.portalAccountId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'elec_notifications',
            filter: `portal_account_id=eq.${d.portalAccountId}`,
          }, () => {
            setNotificationCount(c => c + 1)
            // Play ring sound
            try { audioRef.current?.play().catch(() => {}) } catch {}
          })
          .subscribe()

        return () => { void supabase.removeChannel(channel) }
      })
      .catch(() => {})
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
