'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Tag, LogOut, User, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  companyName: string
  pendingCount: number
}

const NAV_ITEMS = [
  { href: '/supplier-portal/dashboard', label: 'Price Requests', icon: LayoutDashboard, showBadge: true },
  { href: '/supplier-portal/price-list', label: 'My Price List', icon: Tag, showBadge: false },
]

export function SupplierPortalNav({ companyName, pendingCount }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/supplier-portal/login')
  }

  const labelCls = 'text-xs whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 pr-3'

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-2 h-14" style={{ background: '#18181B' }}>
        <button onClick={() => setMobileOpen(true)} className="text-white/70 hover:text-white transition-colors">
          <Menu size={20} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="QuotingHub" className="h-7 object-contain" style={{ filter: 'invert(1) brightness(0.55)' }} />
        <div className="flex-1" />
        <span className="text-[10px] font-semibold uppercase tracking-widest truncate" style={{ color: '#52525B' }}>Supplier</span>
      </div>

      {/* Sidebar */}
      <aside
        className={`group flex flex-col h-screen fixed left-0 top-0 z-50 overflow-hidden
          w-48 md:w-12 md:hover:w-48 md:transition-[width] md:duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ background: '#18181B' }}
      >
        {/* Mobile close */}
        <div className="md:hidden flex justify-end px-3 pt-3 pb-1">
          <button onClick={() => setMobileOpen(false)} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Logo area */}
        <div className="flex-shrink-0 relative border-b" style={{ borderColor: '#27272A' }}>
          {/* Collapsed icon */}
          <span className="hidden md:flex md:group-hover:opacity-0 absolute inset-0 items-center justify-center font-bold text-base select-none transition-opacity duration-150 pointer-events-none" style={{ color: '#52525B' }}>
            S
          </span>
          {/* Full logo */}
          <div className="px-4 py-5 flex flex-col items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuotingHub" className="w-20 h-auto object-contain" style={{ filter: 'invert(1) brightness(0.55)' }} />
            <p className="text-[9px] font-semibold uppercase tracking-widest mt-2 text-center" style={{ color: '#52525B' }}>
              Supplier Portal
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 pt-4 pb-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map(({ href, label, icon: Icon, showBadge }) => {
            const active = pathname.startsWith(href)
            const badgeCount = showBadge ? pendingCount : 0
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center h-9 rounded mx-1 transition-colors duration-150"
                style={{
                  background: active ? '#27272A' : 'transparent',
                  color: active ? '#FAFAFA' : '#71717A',
                  borderLeft: active ? '3px solid #FFFFFF' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="flex items-center justify-center w-9 flex-shrink-0">
                  <Icon size={15} style={{ color: active ? '#FAFAFA' : '#52525B' }} />
                </span>
                <span className={labelCls} style={{ color: active ? '#FAFAFA' : '#71717A' }}>{label}</span>
                {badgeCount > 0 && (
                  <span className={`${labelCls} ml-auto`}>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center inline-block" style={{ background: '#F59E0B', color: '#18181B' }}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 py-2 border-t space-y-0.5" style={{ borderColor: '#27272A' }}>
          <Link
            href="/supplier-portal/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center h-9 rounded mx-1 transition-colors duration-150"
            style={{ color: '#71717A' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#FAFAFA'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#71717A'; e.currentTarget.style.background = 'transparent' }}
          >
            <span className="flex items-center justify-center w-9 flex-shrink-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: '#27272A', color: '#A1A1AA' }}>
                {companyName.charAt(0).toUpperCase()}
              </div>
            </span>
            <span className={`${labelCls} flex-1 truncate`}>{companyName}</span>
            <User size={11} className={`${labelCls} shrink-0 !pr-2`} style={{ color: '#52525B' }} />
          </Link>

          <button
            onClick={handleSignOut}
            className="flex items-center h-8 rounded mx-1 transition-colors duration-150 w-[calc(100%-8px)]"
            style={{ color: '#52525B' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#A1A1AA'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#52525B'; e.currentTarget.style.background = 'transparent' }}
          >
            <span className="flex items-center justify-center w-9 flex-shrink-0">
              <LogOut size={14} />
            </span>
            <span className={labelCls}>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
