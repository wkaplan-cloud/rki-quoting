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
        <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-2 h-14 bg-white border-b border-[#E4E4E7]">
        <button onClick={() => setMobileOpen(true)} className="text-[#71717A] hover:text-[#18181B] transition-colors">
          <Menu size={20} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="QuotingHub" className="h-7 object-contain opacity-70" />
        <div className="flex-1" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#A1A1AA] truncate">Supplier</span>
      </div>

      {/* Sidebar */}
      <aside
        className={`group flex flex-col h-screen fixed left-0 top-0 z-50 overflow-hidden
          w-48 md:w-12 md:hover:w-48 md:transition-[width] md:duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          bg-white border-r border-[#E4E4E7]`}
      >
        {/* Mobile close */}
        <div className="md:hidden flex justify-end px-3 pt-3 pb-1">
          <button onClick={() => setMobileOpen(false)} className="text-[#71717A] hover:text-[#18181B] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Logo area */}
        <div className="flex-shrink-0 relative border-b border-[#E4E4E7]">
          {/* Collapsed icon */}
          <span className="hidden md:flex md:group-hover:opacity-0 absolute inset-0 items-center justify-center font-bold text-sm select-none transition-opacity duration-150 pointer-events-none text-[#A1A1AA]">
            S
          </span>
          {/* Full logo */}
          <div className="px-4 py-5 flex flex-col items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuotingHub" className="w-20 h-auto object-contain opacity-60" />
            <p className="text-[9px] font-semibold uppercase tracking-widest mt-2 text-center text-[#A1A1AA]">
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
                  background: active ? '#F4F4F5' : 'transparent',
                  borderLeft: active ? '3px solid #3F3F46' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9F9F9' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="flex items-center justify-center w-9 flex-shrink-0">
                  <Icon size={15} style={{ color: active ? '#18181B' : '#A1A1AA' }} />
                </span>
                <span className={`${labelCls} font-medium`} style={{ color: active ? '#18181B' : '#71717A' }}>{label}</span>
                {badgeCount > 0 && (
                  <span className={`${labelCls} ml-auto`}>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center inline-block bg-amber-400 text-[#18181B]">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 py-2 border-t border-[#E4E4E7] space-y-0.5">
          <Link
            href="/supplier-portal/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center h-9 rounded mx-1 transition-colors duration-150"
            onMouseEnter={e => { e.currentTarget.style.background = '#F9F9F9' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span className="flex items-center justify-center w-9 flex-shrink-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#E4E4E7] text-[#52525B]">
                {companyName.charAt(0).toUpperCase()}
              </div>
            </span>
            <span className={`${labelCls} flex-1 truncate text-[#71717A]`}>{companyName}</span>
            <User size={11} className={`${labelCls} shrink-0 !pr-2 text-[#A1A1AA]`} />
          </Link>

          <button
            onClick={handleSignOut}
            className="flex items-center h-8 rounded mx-1 transition-colors duration-150 w-[calc(100%-8px)] text-[#A1A1AA] hover:text-[#71717A]"
            onMouseEnter={e => { e.currentTarget.style.background = '#F9F9F9' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
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
