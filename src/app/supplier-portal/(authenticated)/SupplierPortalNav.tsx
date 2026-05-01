'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Home, Inbox, Tag, LogOut, User, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  companyName: string
  pendingCount: number
}

const NAV_ITEMS = [
  { href: '/supplier-portal/home',       label: 'Dashboard',      icon: Home,  showBadge: false },
  { href: '/supplier-portal/dashboard',  label: 'Price Requests', icon: Inbox, showBadge: true  },
  { href: '/supplier-portal/price-list', label: 'My Price List',  icon: Tag,   showBadge: false },
]

const S = {
  sidebar:      '#1E2A38',
  sidebarBorder:'rgba(255,255,255,0.07)',
  textMuted:    '#94A3B8',
  textLight:    '#E2E8F0',
  activeAccent: '#3A7CA5',
  activeBg:     'rgba(58,124,165,0.15)',
  hoverBg:      'rgba(255,255,255,0.05)',
}

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
        <div className="md:hidden fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-14" style={{ background: S.sidebar, borderBottom: `1px solid ${S.sidebarBorder}` }}>
        <button onClick={() => setMobileOpen(true)} style={{ color: S.textMuted }}>
          <Menu size={20} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="QuotingHub" className="h-6 object-contain" style={{ filter: 'brightness(0) invert(1)', opacity: 0.6 }} />
        <div className="flex-1" />
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: S.textMuted }}>Supplier</span>
      </div>

      {/* Sidebar */}
      <aside
        className={`group flex flex-col h-screen fixed left-0 top-0 z-50 overflow-hidden
          w-52 md:w-12 md:hover:w-52 md:transition-[width] md:duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ background: S.sidebar, borderRight: `1px solid ${S.sidebarBorder}` }}
      >
        {/* Mobile close */}
        <div className="md:hidden flex justify-end px-3 pt-3 pb-1">
          <button onClick={() => setMobileOpen(false)} style={{ color: S.textMuted }}>
            <X size={18} />
          </button>
        </div>

        {/* Logo / brand area */}
        <div className="flex-shrink-0 relative" style={{ borderBottom: `1px solid ${S.sidebarBorder}` }}>
          {/* Collapsed: initials */}
          <span className="hidden md:flex md:group-hover:hidden absolute inset-0 items-center justify-center text-xs font-bold select-none pointer-events-none" style={{ color: S.textMuted }}>
            SP
          </span>
          {/* Expanded */}
          <div className="px-5 py-5 flex flex-col items-center text-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuotingHub" className="w-40 h-auto object-contain mb-3" style={{ filter: 'brightness(0) invert(1)', opacity: 0.85 }} />
            <p className="text-xs font-semibold max-w-full" style={{ color: S.textLight }}>{companyName}</p>
            <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: S.textMuted }}>Supplier Portal</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 pt-3 pb-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map(({ href, label, icon: Icon, showBadge }) => {
            const active = pathname.startsWith(href)
            const badge = showBadge ? pendingCount : 0
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center h-9 mx-2 rounded-lg transition-colors duration-150"
                style={{
                  background: active ? S.activeBg : 'transparent',
                  borderLeft: active ? `3px solid ${S.activeAccent}` : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = S.hoverBg }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="flex items-center justify-center w-9 flex-shrink-0">
                  <Icon size={15} style={{ color: active ? S.textLight : S.textMuted }} />
                </span>
                <span className={`${labelCls} font-medium flex-1`} style={{ color: active ? S.textLight : S.textMuted }}>
                  {label}
                </span>
                {badge > 0 && (
                  <span className={`${labelCls} ml-auto`}>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center inline-block" style={{ background: '#D9A441', color: '#1E2A38' }}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 py-2 space-y-0.5" style={{ borderTop: `1px solid ${S.sidebarBorder}` }}>
          <Link
            href="/supplier-portal/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center h-9 mx-2 rounded-lg transition-colors duration-150"
            onMouseEnter={e => { e.currentTarget.style.background = S.hoverBg }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span className="flex items-center justify-center w-9 flex-shrink-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: S.activeAccent, color: '#fff' }}>
                {companyName.charAt(0).toUpperCase()}
              </div>
            </span>
            <span className={`${labelCls} flex-1 truncate`} style={{ color: S.textMuted }}>{companyName}</span>
            <User size={11} className={`${labelCls} shrink-0 !pr-2`} style={{ color: S.textMuted }} />
          </Link>

          <button
            onClick={handleSignOut}
            className="flex items-center h-8 mx-2 rounded-lg w-[calc(100%-16px)] transition-colors duration-150"
            onMouseEnter={e => { e.currentTarget.style.background = S.hoverBg }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span className="flex items-center justify-center w-9 flex-shrink-0">
              <LogOut size={14} style={{ color: S.textMuted }} />
            </span>
            <span className={labelCls} style={{ color: S.textMuted }}>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
