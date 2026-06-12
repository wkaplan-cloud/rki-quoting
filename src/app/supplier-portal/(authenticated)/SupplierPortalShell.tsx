'use client'
import { useState, useEffect, useRef } from 'react'
import { SupplierPortalNav } from './SupplierPortalNav'
import { useVisiblePoll } from '@/lib/useVisiblePoll'

interface Props {
  children: React.ReactNode
  companyName: string
  hasQuoting?: boolean
  quotingPlan?: string | null
  supplierCategory?: string
  setupFeePaid?: boolean
  staffCount?: number
  accountCreatedAt?: string
  receivePriceRequests?: boolean
}

export function SupplierPortalShell({ children, companyName, hasQuoting = false, quotingPlan = null, supplierCategory = 'manufacturer', setupFeePaid = true, staffCount = 0, accountCreatedAt, receivePriceRequests = false }: Props) {
  const [desktopExpanded, setDesktopExpanded] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [notificationCount, setNotificationCount] = useState(0)
  const [pendingMaterialsCount, setPendingMaterialsCount] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const prevCountRef = useRef(-1) // -1 = not yet initialised; skip sound on first poll

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

  useVisiblePoll(() => {
    fetch('/api/supplier-portal/quoting/material-requests?status=pending&count=1')
      .then(r => r.json())
      .then((d: { count?: number }) => setPendingMaterialsCount(d.count ?? 0))
      .catch(() => {})
  }, 60_000)

  // Pre-unlock audio silently on first user interaction so autoplay works for real notifications
  useEffect(() => {
    const unlock = () => {
      const audio = audioRef.current
      if (!audio) return
      audio.volume = 0
      audio.play()
        .then(() => { audio.pause(); audio.currentTime = 0; audio.volume = 1 })
        .catch(() => {})
    }
    document.addEventListener('click', unlock, { once: true })
    document.addEventListener('touchstart', unlock, { once: true })
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
  }, [])

  // Poll every 30 s, paused while the tab is hidden — keeps Vercel CPU usage down
  useVisiblePoll(async () => {
    try {
      const res = await fetch('/api/supplier-portal/notifications')
      const d = await res.json() as { count: number }
      const newCount = d.count ?? 0
      if (prevCountRef.current >= 0 && newCount > prevCountRef.current) {
        // New notification(s) arrived after initial load — play sound
        try { audioRef.current?.play().catch(() => {}) } catch {}
      }
      prevCountRef.current = newCount
      setNotificationCount(newCount)
    } catch {}
  }, 30_000)

  return (
    <div className="flex min-h-screen" style={{ background: '#F5F7F9' }}>
      {/* Hidden notification sound */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="auto" playsInline>
        <source src="/notification.wav" type="audio/wav" />
      </audio>

      <SupplierPortalNav
        companyName={companyName}
        pendingCount={pendingCount}
        hasQuoting={hasQuoting}
        quotingPlan={quotingPlan}
        supplierCategory={supplierCategory}
        notificationCount={notificationCount}
        pendingMaterialsCount={pendingMaterialsCount}
        desktopExpanded={desktopExpanded}
        receivePriceRequests={receivePriceRequests}
        onDesktopToggle={() => setDesktopExpanded(e => {
          const next = !e
          localStorage.setItem('supplier-sidebar-expanded', String(next))
          return next
        })}
      />
      <main className={`${desktopExpanded ? 'md:ml-52' : 'md:ml-12'} flex-1 pt-14 md:pt-0 md:transition-[margin-left] md:duration-200`}>
        {/* Setup & Training fee banner — shown only after 20 days from account creation */}
        {!setupFeePaid && accountCreatedAt && Math.floor((Date.now() - new Date(accountCreatedAt).getTime()) / 86400000) >= 20 && (
          <div className="px-6 py-3 flex items-center justify-between gap-4 flex-wrap"
            style={{ background: '#D97706', color: '#fff' }}>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold">⚠</span>
              <span>
                <span className="font-semibold">Setup & Training fee outstanding — R2,500 once-off.</span>
                {' '}Pay now to complete your onboarding.
              </span>
            </div>
            <a
              href="https://paystack.com/buy/setup--training--r2500-once-off-vmoejb"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
              style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff' }}
            >
              Pay R2,500 →
            </a>
          </div>
        )}

        <div className="px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
