'use client'
import { useState, useEffect, useRef } from 'react'
import { SupplierPortalNav } from './SupplierPortalNav'

interface Props {
  children: React.ReactNode
  companyName: string
  hasQuoting?: boolean
  quotingPlan?: string | null
  supplierCategory?: string
}

export function SupplierPortalShell({ children, companyName, hasQuoting = false, quotingPlan = null, supplierCategory = 'manufacturer' }: Props) {
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

  useEffect(() => {
    function fetchMaterials() {
      fetch('/api/supplier-portal/quoting/material-requests?status=pending&count=1')
        .then(r => r.json())
        .then((d: { count?: number }) => setPendingMaterialsCount(d.count ?? 0))
        .catch(() => {})
    }
    fetchMaterials()
    const id = setInterval(fetchMaterials, 60_000)
    return () => clearInterval(id)
  }, [])

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

  // Poll every 5 s — fast enough to feel live, works regardless of RLS/Realtime setup
  useEffect(() => {
    let alive = true

    async function poll() {
      try {
        const res = await fetch('/api/supplier-portal/notifications')
        const d = await res.json() as { count: number }
        if (!alive) return
        const newCount = d.count ?? 0
        if (prevCountRef.current >= 0 && newCount > prevCountRef.current) {
          // New notification(s) arrived after initial load — play sound
          try { audioRef.current?.play().catch(() => {}) } catch {}
        }
        prevCountRef.current = newCount
        setNotificationCount(newCount)
      } catch {}
    }

    void poll() // immediate first fetch
    const interval = setInterval(() => { void poll() }, 5000)

    return () => { alive = false; clearInterval(interval) }
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
        quotingPlan={quotingPlan}
        supplierCategory={supplierCategory}
        notificationCount={notificationCount}
        pendingMaterialsCount={pendingMaterialsCount}
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
