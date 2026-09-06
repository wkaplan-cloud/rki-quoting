'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, MessageSquare, BookOpen, LogOut,
  ArrowLeftRight, Store, FolderOpen, Activity, BadgeDollarSign,
  Radio, Zap, Palette, Package, Hammer, Users,
  Search, Menu, X, ChevronRight,
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
        return (
          <div key={section.key} className={si === 0 ? '' : 'mt-6'}>
            <div className="flex items-center gap-2 px-3 mb-2">
              <span className={`w-1.5 h-1.5 rounded-full ${section.dot}`} />
              <SectionIcon size={11} className={section.accent} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                {section.label}
              </span>
            </div>

            <div className="space-y-px">
              {section.items.map(({ href, label, icon, badge = 0 }) => {
                const Icon = ICONS[icon]
                const active = isActive(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center gap-2.5 pl-3 pr-2 py-[7px] rounded-lg text-[13px] transition-colors duration-150 ${
                      active
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/55 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon size={14} className={`shrink-0 transition-colors duration-150 ${active ? section.accent : 'text-white/35 group-hover:text-white/70'}`} />
                    <span className="flex-1 truncate">{label}</span>
                    {badge > 0 && (
                      <span className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full min-w-[19px] text-center ${
                        active ? 'bg-[#C4A46B] text-[#1A1A18]' : 'bg-[#9A7B4F]/25 text-[#C4A46B]'
                      }`}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                    {active && <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-l bg-[#C4A46B]" />}
                  </Link>
                )
              })}
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
        <span className="text-[10px] font-semibold text-[#C4A46B] uppercase tracking-[0.22em] transition-colors duration-150 group-hover:text-[#E0C68C]">
          Control Room
        </span>
      </Link>
    </div>
  )

  const footer = (
    <div className="px-3 py-3 border-t border-white/8">
      <div className="px-3 pb-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Signed in</p>
        <p className="text-[11px] text-white/55 truncate" title={adminEmail}>{adminEmail}</p>
      </div>
      <form action="/api/auth/signout" method="post">
        <button
          type="submit"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors duration-150 w-full text-left cursor-pointer"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </form>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0E0E0C] text-white">
      {/* Desktop rail */}
      <aside className="hidden lg:flex w-[236px] flex-col h-screen fixed left-0 top-0 bg-[#181816] border-r border-white/8 z-40">
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
          <aside className="relative w-[236px] flex flex-col h-full bg-[#181816] border-r border-white/8">
            <button
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-2 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
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
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 sm:px-6 border-b border-white/8 bg-[#0E0E0C]/85 backdrop-blur-md">
          <button
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
          >
            <Menu size={17} />
          </button>

          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-[12px] shrink-0">
            <span className="text-white/30">{current?.section.label ?? 'Platform'}</span>
            {current && (
              <>
                <ChevronRight size={11} className="text-white/20" />
                <span className="text-white/75 font-medium">{current.item.label}</span>
              </>
            )}
          </nav>

          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto sm:ml-4 flex items-center gap-2.5 h-8 pl-3 pr-2 flex-1 max-w-[22rem] rounded-lg border border-white/10 bg-white/[0.03] text-left hover:border-white/20 hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
          >
            <Search size={13} className="text-white/35 shrink-0" />
            <span className="flex-1 truncate text-[12px] text-white/40">Search studios, contractors, suppliers…</span>
            <kbd className="hidden sm:block text-[10px] font-medium text-white/35 border border-white/12 rounded px-1.5 py-0.5">⌘K</kbd>
          </button>

          <div className="hidden md:flex items-center gap-2 ml-auto pl-4 shrink-0">
            {totalBadges > 0 && (
              <span className="text-[11px] text-[#C4A46B] tabular-nums">{totalBadges} waiting</span>
            )}
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.15)]" />
            <span className="text-[11px] text-white/35 tabular-nums">{clock ?? '—'}</span>
          </div>
        </header>

        <main className="flex-1 flex flex-col">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
