'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, MessageSquare, BookOpen, LogOut,
  ArrowLeftRight, Store, FolderOpen, Activity, BadgeDollarSign,
  Radio, Zap, Palette, Package, Hammer, Users,
  Search, Menu, X, ChevronRight, ChevronDown,
} from 'lucide-react'
import { CommandPalette } from './CommandPalette'

/**
 * Icons cross the server/client boundary as names, not components — a layout
 * that is a server component can't hand a function to a client child.
 */
const ICONS = {
  LayoutDashboard, Building2, MessageSquare, BookOpen, ArrowLeftRight, Store,
  FolderOpen, Activity, BadgeDollarSign, Radio, Zap, Palette, Package, Hammer, Users,
} as const

export type IconName = keyof typeof ICONS

export interface NavItem {
  href: string
  label: string
  icon: IconName
  badge?: number
  /**
   * Overrides the section accent. Portal Accounts holds three portals that
   * each own a hue, so the colour has to travel with the item, not the group.
   */
  accent?: string
}

export interface NavSection {
  key: string
  label: string
  icon: IconName
  /** Tailwind text colour for the section's accent — one hue per portal. */
  accent: string
  /** Matching dot colour, so the rail reads at a glance when collapsed. */
  dot: string
  items: NavItem[]
}

function isActive(pathname: string, href: string) {
  if (href === '/platform') return pathname === '/platform'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PlatformShell({
  sections,
  adminEmail,
  children,
}: {
  sections: NavSection[]
  adminEmail: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [clock, setClock] = useState<string | null>(null)

  // Rendered after mount only — the server has no business guessing the clock.
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A section is open when it holds the current page. Clicking a heading
  // overrides that, and the overrides are dropped as soon as you navigate into
  // a different section, so the rule reasserts itself on every move.
  const activeSectionKey = sections.find(sec =>
    sec.items.some(i => isActive(pathname, i.href)),
  )?.key ?? null

  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({})
  const [lastSectionKey, setLastSectionKey] = useState(activeSectionKey)
  if (lastSectionKey !== activeSectionKey) {
    setLastSectionKey(activeSectionKey)
    setOpenOverrides({})
  }

  const isOpen = (key: string) => openOverrides[key] ?? key === activeSectionKey
  const toggleSection = (key: string) =>
    setOpenOverrides(prev => ({ ...prev, [key]: !isOpen(key) }))

  const current = sections
    .flatMap(s => s.items.map(i => ({ section: s, item: i })))
    .filter(({ item }) => isActive(pathname, item.href))
    .sort((a, b) => b.item.href.length - a.item.href.length)[0]

  const totalBadges = sections.reduce(
    (n, s) => n + s.items.reduce((m, i) => m + (i.badge ?? 0), 0), 0,
  )

  const nav = (
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      {sections.map((section, si) => {
        const SectionIcon = ICONS[section.icon]
        const open = isOpen(section.key)
        const sectionBadge = section.items.reduce((n, i) => n + (i.badge ?? 0), 0)
        return (
          <div key={section.key} className={si === 0 ? '' : 'mt-1.5'}>
            <button
              type="button"
              onClick={() => toggleSection(section.key)}
              aria-expanded={open}
              aria-controls={`nav-section-${section.key}`}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${section.dot}`} />
              <SectionIcon size={11} className={`${section.accent} shrink-0`} />
              <span className="flex-1 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8F8B81]">
                {section.label}
              </span>
              {/* A collapsed section must not swallow the fact that it is waiting on you. */}
              {!open && sectionBadge > 0 && (
                <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-[#D8BA84]/20 text-[#D8BA84]">
                  {sectionBadge > 99 ? '99+' : sectionBadge}
                </span>
              )}
              <ChevronDown
                size={12}
                className={`text-[#6F6B62] shrink-0 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
              />
            </button>

            {/* 0fr -> 1fr collapses to the content's own height with no magic numbers. */}
            <div
              id={`nav-section-${section.key}`}
              className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
              style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="space-y-px pt-1 pb-1">
                  {section.items.map(({ href, label, icon, badge = 0, accent }) => {
                    const Icon = ICONS[icon]
                    const active = isActive(pathname, href)
                    const itemAccent = accent ?? section.accent
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setDrawerOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        tabIndex={open ? undefined : -1}
                        className={`group relative flex items-center gap-2.5 pl-3 pr-2 py-2.5 lg:py-[7px] rounded-lg text-[13px] transition-colors duration-150 ${
                          active
                            ? 'bg-white/[0.10] text-white'
                            : 'text-[#B4B0A6] hover:text-white hover:bg-white/[0.06]'
                        }`}
                      >
                        <Icon size={14} className={`shrink-0 transition-colors duration-150 ${active ? itemAccent : 'text-[#8F8B81] group-hover:text-[#D6D2C8]'}`} />
                        <span className="flex-1 truncate">{label}</span>
                        {badge > 0 && (
                          <span className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full min-w-[19px] text-center ${
                            active ? 'bg-[#D8BA84] text-[#1A1A18]' : 'bg-[#D8BA84]/20 text-[#D8BA84]'
                          }`}>
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                        {active && <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-l bg-[#D8BA84]" />}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </nav>
  )

  const brand = (
    <div className="px-5 pt-5 pb-4 border-b border-white/8">
      <Link href="/platform" className="flex flex-col items-center gap-2 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="QuotingHub" className="w-24 h-auto object-contain" style={{ filter: 'invert(1)' }} />
        <span className="text-[10px] font-semibold text-[#D8BA84] uppercase tracking-[0.22em] transition-colors duration-150 group-hover:text-[#EBD3A6]">
          Control Room
        </span>
      </Link>
    </div>
  )

  const footer = (
    <div className="px-3 py-3 border-t border-white/8">
      <div className="px-3 pb-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-[#8F8B81]">Signed in</p>
        <p className="text-[11px] text-[#B4B0A6] truncate" title={adminEmail}>{adminEmail}</p>
      </div>
      <form action="/api/auth/signout" method="post">
        <button
          type="submit"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] text-[#B4B0A6] hover:text-white hover:bg-white/[0.07] transition-colors duration-150 w-full text-left cursor-pointer"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </form>
    </div>
  )

  return (
    <div className="platform-root min-h-screen bg-[#F5F2EC] text-[#1A1A18]">
      {/* Desktop rail */}
      <aside className="hidden lg:flex w-[236px] flex-col h-screen fixed left-0 top-0 bg-[#181816] z-40">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/70 cursor-default"
          />
          <aside className="relative w-[236px] max-w-[82vw] flex flex-col h-full bg-[#181816] overflow-y-auto">
            <button
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-2 p-2.5 rounded-lg text-[#B4B0A6] hover:text-white hover:bg-white/[0.08] transition-colors duration-150 cursor-pointer"
            >
              <X size={16} />
            </button>
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <div className="lg:ml-[236px] flex flex-col min-h-screen">
        {/* Command bar */}
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 sm:px-6 border-b border-[#DED8CC] bg-[#F5F2EC]/90 backdrop-blur-md">
          <button
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg text-[#5C5A54] hover:text-[#1A1A18] hover:bg-[#E9E4DA] transition-colors duration-150 cursor-pointer"
          >
            <Menu size={17} />
          </button>

          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-[12px] shrink-0">
            <span className="text-[#6E6B63]">{current?.section.label ?? 'Platform'}</span>
            {current && (
              <>
                <ChevronRight size={11} className="text-[#A8A398]" />
                <span className="text-[#1A1A18] font-medium">{current.item.label}</span>
              </>
            )}
          </nav>

          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto sm:ml-4 flex items-center gap-2.5 h-8 pl-3 pr-2 flex-1 max-w-[22rem] rounded-lg border border-[#DED8CC] bg-[#FDFCF9] text-left hover:border-[#7E6036]/50 hover:bg-white transition-colors duration-150 cursor-pointer"
          >
            <Search size={13} className="text-[#6E6B63] shrink-0" />
            <span className="flex-1 truncate text-[12px] text-[#6E6B63]">
              <span className="sm:hidden">Search…</span>
              <span className="hidden sm:inline">Search studios, contractors, suppliers…</span>
            </span>
            <kbd className="hidden sm:block text-[10px] font-medium text-[#5C5A54] bg-[#EFEBE3] border border-[#DED8CC] rounded px-1.5 py-0.5">⌘K</kbd>
          </button>

          <div className="flex items-center gap-2 ml-auto md:pl-4 shrink-0">
            {totalBadges > 0 && (
              <span className="text-[11px] font-medium text-[#7E6036] tabular-nums">
                {totalBadges}<span className="hidden sm:inline"> waiting</span>
              </span>
            )}
            <span className="w-1.5 h-1.5 rounded-full bg-[#047857] shadow-[0_0_0_3px_rgba(4,120,87,0.14)]" />
            <span className="hidden md:inline text-[11px] text-[#5C5A54] tabular-nums">{clock ?? '—'}</span>
          </div>
        </header>

        <main className="flex-1 flex flex-col">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
