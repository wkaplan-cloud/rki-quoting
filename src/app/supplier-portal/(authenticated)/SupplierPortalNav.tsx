'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Home, Inbox, Tag, LogOut, User, Menu, X, PanelLeft, PanelLeftClose, FileText, Zap, Settings, Users, LayoutDashboard, HardHat, CalendarDays, Bell, ClipboardList, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  companyName: string
  pendingCount: number
  hasQuoting: boolean
  notificationCount?: number
  desktopExpanded: boolean
  onDesktopToggle: () => void
}

const NAV_ITEMS = [
  { href: '/supplier-portal/home',       label: 'Home',           icon: Home,  showBadge: false },
  { href: '/supplier-portal/price-requests', label: 'Price Requests', icon: Inbox, showBadge: true  },
  { href: '/supplier-portal/price-list', label: 'My Price List',  icon: Tag,   showBadge: false },
]

const QUOTING_NAV_ITEMS = [
  { href: '/supplier-portal/quoting/dashboard',     label: 'Dashboard', icon: LayoutDashboard, exact: true,  badge: null           },
  { href: '/supplier-portal/quoting/quotes',       label: 'Quotes',    icon: FileText,        exact: false, badge: 'Long term'    },
  { href: '/supplier-portal/quoting/job-cards',    label: 'Job Cards', icon: ClipboardList,   exact: false, badge: 'Daily'        },
  { href: '/supplier-portal/quoting/clients',      label: 'Clients',   icon: Users,           exact: false, badge: null           },
]

const TEAM_NAV_ITEMS = [
  { href: '/supplier-portal/quoting/schedule', label: 'Schedule', icon: CalendarDays, exact: false },
  { href: '/supplier-portal/quoting/staff',    label: 'Staff',    icon: HardHat,      exact: false },
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

export function SupplierPortalNav({ companyName, pendingCount, hasQuoting, notificationCount = 0, desktopExpanded, onDesktopToggle }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/supplier-portal/login')
  }

  const labelCls = `text-xs whitespace-nowrap transition-opacity duration-150 pr-3 ${desktopExpanded ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`

  function NavLink({ href, label, icon: Icon, badge, pendingBadge, exact = false }: {
    href: string; label: string; icon: React.ElementType
    badge?: string | null; pendingBadge?: number; exact?: boolean
  }) {
    const active = exact ? pathname === href : pathname.startsWith(href)
    return (
      <Link
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
        <span className="flex items-center justify-center w-9 flex-shrink-0 relative">
          <Icon size={15} style={{ color: active ? S.textLight : S.textMuted }} />
        </span>
        <span className={`${labelCls} font-medium flex-1`} style={{ color: active ? S.textLight : S.textMuted }}>
          {label}
        </span>
        {badge && (
          <span className={`${labelCls} mr-1`}>
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.07)', color: S.textMuted }}>
              {badge}
            </span>
          </span>
        )}
        {(pendingBadge ?? 0) > 0 && (
          <span className={`${labelCls} ml-auto`}>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center inline-block" style={{ background: '#D9A441', color: '#1E2A38' }}>
              {(pendingBadge ?? 0) > 99 ? '99+' : pendingBadge}
            </span>
          </span>
        )}
      </Link>
    )
  }

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
        <img src="/logo.png" alt="QuotingHub" className="h-10 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)', opacity: 0.85 }} />
        <div className="flex-1" />
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: S.textMuted }}>Supplier</span>
      </div>

      {/* Sidebar */}
      <aside
        className={`group flex flex-col h-screen fixed left-0 top-0 z-50 overflow-hidden md:transition-[width] md:duration-200
          w-52 ${desktopExpanded ? 'md:w-52' : 'md:w-12 md:hover:w-52'}
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
          <button
            onClick={onDesktopToggle}
            className={`hidden md:flex absolute inset-0 items-center justify-center transition-colors z-10 ${desktopExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100 md:group-hover:opacity-0'}`}
            style={{ color: S.textMuted }}
            aria-label="Pin navigation open"
          >
            <PanelLeft size={15} />
          </button>
          <button
            onClick={onDesktopToggle}
            className={`hidden md:flex absolute top-3 right-3 w-6 h-6 items-center justify-center rounded transition-colors z-10 ${desktopExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none md:group-hover:opacity-100'}`}
            style={{ color: S.textMuted }}
            aria-label="Unpin navigation"
          >
            <PanelLeftClose size={15} />
          </button>
          <div className={`px-5 py-5 flex flex-col items-center text-center transition-opacity duration-150 ${desktopExpanded ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:pointer-events-none'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuotingHub" className="w-28 h-auto object-contain mb-3" style={{ filter: 'brightness(0) invert(1)', opacity: 0.85 }} />
            <p className="text-xs font-semibold max-w-full" style={{ color: S.textLight }}>{companyName}</p>
            <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: S.textMuted }}>Supplier Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 pt-3 pb-2 overflow-y-auto overflow-x-hidden space-y-0.5">

          {/* Marketplace — hidden for electrician/quoting accounts */}
          {!hasQuoting && (
            <>
              <NavLink href="/supplier-portal/home"       label="Home"           icon={Home}  />
              <NavLink href="/supplier-portal/dashboard"  label="Price Requests" icon={Inbox} pendingBadge={pendingCount} />
              <NavLink href="/supplier-portal/price-list" label="My Price List"  icon={Tag}   />
            </>
          )}

          {/* Business tools */}
          {hasQuoting ? (
            <>
              <div className="pt-1 mx-2" style={{ borderTop: `1px solid ${S.sidebarBorder}`, marginTop: '8px' }} />

              <NavLink href="/supplier-portal/quoting"           label="Dashboard" icon={LayoutDashboard} exact />
              <NavLink href="/supplier-portal/quoting/quotes"    label="Quotes"    icon={FileText}        badge="Long term" />
              <NavLink href="/supplier-portal/quoting/job-cards" label="Job Cards" icon={ClipboardList}   badge="Daily" />
              <NavLink href="/supplier-portal/quoting/clients"    label="Clients"     icon={Users}      />
              <NavLink href="/supplier-portal/quoting/price-book" label="Price Book" icon={BookOpen}   />

              <div className="pt-1 mx-2" style={{ borderTop: `1px solid ${S.sidebarBorder}`, marginTop: '8px' }} />

              <NavLink href="/supplier-portal/quoting/schedule" label="Schedule" icon={CalendarDays} />
              <NavLink href="/supplier-portal/quoting/staff"    label="Staff"    icon={HardHat}      />

              <div className="pt-1 mx-2" style={{ borderTop: `1px solid ${S.sidebarBorder}`, marginTop: '8px' }} />

              {/* Notifications */}
              {(() => {
                const href = '/supplier-portal/notifications'
                const active = pathname.startsWith(href)
                return (
                  <Link href={href} onClick={() => setMobileOpen(false)}
                    className="flex items-center h-9 mx-2 rounded-lg transition-colors duration-150"
                    style={{ background: active ? S.activeBg : 'transparent', borderLeft: active ? `3px solid ${S.activeAccent}` : '3px solid transparent' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = S.hoverBg }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                    <span className="flex items-center justify-center w-9 flex-shrink-0 relative">
                      <Bell size={15} style={{ color: active ? S.textLight : S.textMuted }} />
                      {notificationCount > 0 && (
                        <span className="absolute top-0 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ background: '#DC2626' }}>
                          {notificationCount > 9 ? '9+' : notificationCount}
                        </span>
                      )}
                    </span>
                    <span className={`${labelCls} font-medium flex-1`} style={{ color: active ? S.textLight : S.textMuted }}>
                      Notifications
                    </span>
                  </Link>
                )
              })()}
            </>
          ) : (
            <>
              <div className="pt-1 mx-2" style={{ borderTop: `1px solid ${S.sidebarBorder}`, marginTop: '8px' }} />
              <Link
                href="/supplier-portal/upgrade"
                onClick={() => setMobileOpen(false)}
                className="flex items-center h-9 mx-2 rounded-lg transition-colors duration-150"
                onMouseEnter={e => { e.currentTarget.style.background = S.hoverBg }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <span className="flex items-center justify-center w-9 flex-shrink-0">
                  <Zap size={14} style={{ color: '#D9A441' }} />
                </span>
                <span className={`${labelCls} font-semibold flex-1`} style={{ color: '#D9A441' }}>
                  Electrician Quoting
                </span>
              </Link>
            </>
          )}
        </nav>

        {/* Settings */}
        {hasQuoting && (() => {
          const active = pathname.startsWith('/supplier-portal/quoting/settings')
          return (
            <div className="pb-1" style={{ borderTop: `1px solid ${S.sidebarBorder}` }}>
              <Link
                href="/supplier-portal/quoting/settings"
                onClick={() => setMobileOpen(false)}
                className="flex items-center h-9 mx-2 mt-1 rounded-lg transition-colors duration-150"
                style={{
                  background: active ? S.activeBg : 'transparent',
                  borderLeft: active ? `3px solid ${S.activeAccent}` : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = S.hoverBg }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="flex items-center justify-center w-9 flex-shrink-0">
                  <Settings size={15} style={{ color: active ? S.textLight : S.textMuted }} />
                </span>
                <span className={`${labelCls} font-medium flex-1`} style={{ color: active ? S.textLight : S.textMuted }}>
                  Settings
                </span>
              </Link>
            </div>
          )
        })()}

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
