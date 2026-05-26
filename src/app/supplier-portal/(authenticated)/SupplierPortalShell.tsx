'use client'
import { useState, useEffect } from 'react'
import { SupplierPortalNav } from './SupplierPortalNav'

interface Props {
  children: React.ReactNode
  companyName: string
  hasQuoting?: boolean
}

export function SupplierPortalShell({ children, companyName, hasQuoting = false }: Props) {
  const [desktopExpanded, setDesktopExpanded] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

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

  return (
    <div className="flex min-h-screen" style={{ background: '#F5F7F9' }}>
      <SupplierPortalNav
        companyName={companyName}
        pendingCount={pendingCount}
        hasQuoting={hasQuoting}
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
