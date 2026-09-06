'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, CornerDownLeft, ArrowUp, ArrowDown, Loader2,
  Building2, Zap, Hammer, Store, BookOpen, Compass,
} from 'lucide-react'

interface SearchEntry {
  id: string
  group: string
  label: string
  hint: string | null
  href: string
  keywords: string
}

/** Every page the palette can jump to, so ⌘K works before the index loads. */
const DESTINATIONS: SearchEntry[] = [
  { id: 'nav-overview',    group: 'Go to', label: 'Overview',       hint: 'Platform dashboard',        href: '/platform',               keywords: 'dashboard home mrr' },
  { id: 'nav-studios',     group: 'Go to', label: 'Studios',        hint: 'Designer accounts',         href: '/platform/studios',       keywords: 'designers organizations orgs' },
  { id: 'nav-quotes',      group: 'Go to', label: 'Quotes',         hint: 'Quote & invoice tracker',   href: '/platform/quotes',        keywords: 'invoices projects' },
  { id: 'nav-messages',    group: 'Go to', label: 'Messages',       hint: 'Contact submissions',       href: '/platform/messages',      keywords: 'inbox contact enquiries' },
  { id: 'nav-broadcast',   group: 'Go to', label: 'Broadcast',      hint: 'Email all studios',         href: '/platform/broadcast',     keywords: 'email campaign send' },
  { id: 'nav-commissions', group: 'Go to', label: 'Commissions',    hint: 'Rep commissions',           href: '/platform/commissions',   keywords: 'reps sales payouts' },
  { id: 'nav-suppliers',   group: 'Go to', label: 'Suppliers',      hint: 'Registered suppliers',      href: '/platform/suppliers',     keywords: 'vendors accounts' },
  { id: 'nav-sourcing',    group: 'Go to', label: 'Sourcing',       hint: 'Price requests & fees',     href: '/platform/sourcing',      keywords: 'fees rfq price requests' },
  { id: 'nav-pricelists',  group: 'Go to', label: 'Price Lists',    hint: 'Catalogues & access',       href: '/platform/price-lists',   keywords: 'catalogue twinbru access requests' },
  { id: 'nav-mfg',         group: 'Go to', label: 'Manufacturing',  hint: 'Manufacturer accounts',     href: '/platform/manufacturing', keywords: 'factory workshop makers' },
  { id: 'nav-elec',        group: 'Go to', label: 'Contractors',    hint: 'Electrical & trades',       href: '/platform/electricians',  keywords: 'electricians trades sparkies' },
  { id: 'nav-health',      group: 'Go to', label: 'System Health',  hint: 'Env vars & activity pulse', href: '/platform/health',        keywords: 'status uptime env' },
]

const GROUP_ORDER = ['Go to', 'Studios', 'Contractors', 'Manufacturers', 'Suppliers', 'Price lists']

const GROUP_ICON: Record<string, typeof Building2> = {
  'Go to': Compass,
  Studios: Building2,
  Contractors: Zap,
  Manufacturers: Hammer,
  Suppliers: Store,
  'Price lists': BookOpen,
}

const GROUP_ACCENT: Record<string, string> = {
  'Go to': 'text-white/40',
  Studios: 'text-[#C4A46B]',
  Contractors: 'text-amber-400',
  Manufacturers: 'text-orange-400',
  Suppliers: 'text-sky-400',
  'Price lists': 'text-sky-400',
}

/**
 * Subsequence match with a bias toward prefixes and word starts, so typing
 * "nex" ranks "Nexus Electrical" above "Annex Interiors".
 */
function score(haystack: string, needle: string): number {
  if (!needle) return 1
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()

  const direct = h.indexOf(n)
  if (direct === 0) return 1000
  if (direct > 0) return h[direct - 1] === ' ' ? 800 : 600 - Math.min(direct, 100)

  // Fall back to a gappy match: every character in order, penalised by distance.
  let hi = 0
  let points = 300
  for (const ch of n) {
    const found = h.indexOf(ch, hi)
    if (found === -1) return 0
    points -= Math.min(found - hi, 12)
    hi = found + 1
  }
  return Math.max(points, 1)
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<SearchEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // The index is fetched once on first open and reused for the session.
  useEffect(() => {
    if (!open || entries !== null || loading) return
    setLoading(true)
    fetch('/api/platform/search')
      .then(r => (r.ok ? r.json() : { entries: [] }))
      .then((d: { entries?: SearchEntry[] }) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [open, entries, loading])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // Autofocus after the dialog paints, or the caret lands nowhere.
      const t = setTimeout(() => inputRef.current?.focus(), 20)
      return () => clearTimeout(t)
    }
  }, [open])

  const results = useMemo(() => {
    const all = [...DESTINATIONS, ...(entries ?? [])]
    const q = query.trim()
    if (!q) return DESTINATIONS
    return all
      .map(e => ({ e, s: Math.max(score(e.label, q), score(e.keywords, q) * 0.75, score(e.hint ?? '', q) * 0.5) }))
      .filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s || a.e.label.localeCompare(b.e.label))
      .slice(0, 40)
      .map(r => r.e)
  }, [query, entries])

  // Grouping is visual; the flat index it carries is what keyboard nav walks.
  const grouped = useMemo(() => {
    const map = new Map<string, SearchEntry[]>()
    for (const e of results) {
      const list = map.get(e.group)
      if (list) list.push(e)
      else map.set(e.group, [e])
    }
    const sorted = [...map.entries()].sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a[0])
      const bi = GROUP_ORDER.indexOf(b[0])
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    let cursor = 0
    return sorted.map(([group, items]) => ({
      group,
      items: items.map(item => ({ item, index: cursor++ })),
    }))
  }, [results])

  const ordered = useMemo(() => grouped.flatMap(g => g.items.map(i => i.item)), [grouped])

  useEffect(() => { setActive(0) }, [query])

  const go = useCallback((entry: SearchEntry | undefined) => {
    if (!entry) return
    onOpenChange(false)
    router.push(entry.href)
  }, [onOpenChange, router])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => (ordered.length ? (i + 1) % ordered.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => (ordered.length ? (i - 1 + ordered.length) % ordered.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(ordered[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onOpenChange(false)
    }
  }

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search the platform"
    >
      <button
        aria-label="Close search"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px] cursor-default"
      />

      <div
        className="relative w-full max-w-[38rem] rounded-2xl border border-white/12 bg-[#171715] shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_32px_64px_-24px_rgba(0,0,0,0.9)] overflow-hidden"
        style={{ animation: 'qh-pop 180ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-white/8">
          {loading
            ? <Loader2 size={16} className="text-[#C4A46B] animate-spin shrink-0" />
            : <Search size={16} className="text-white/35 shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search studios, contractors, suppliers and pages"
            className="flex-1 bg-transparent text-[15px] text-white outline-none"
          />
          <kbd className="text-[10px] font-medium text-white/30 border border-white/12 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {ordered.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-white/35">
              Nothing matches “{query}”. Try a studio name, an email address, or a page.
            </p>
          )}

          {grouped.map(({ group, items }) => {
            const Icon = GROUP_ICON[group] ?? Compass
            return (
              <div key={group} className="mb-1 last:mb-0">
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">{group}</p>
                {items.map(({ item, index: i }) => {
                  const isActive = i === active
                  return (
                    <button
                      key={item.id}
                      data-idx={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(item)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 ${
                        isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <Icon size={14} className={`shrink-0 ${isActive ? GROUP_ACCENT[group] ?? 'text-white/60' : 'text-white/30'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-white">{item.label}</span>
                        {item.hint && <span className="block truncate text-[11px] text-white/40">{item.hint}</span>}
                      </span>
                      {isActive && <CornerDownLeft size={13} className="text-white/30 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-4 px-4 h-9 border-t border-white/8 bg-white/[0.02] text-[10px] text-white/30">
          <span className="flex items-center gap-1"><ArrowUp size={10} /><ArrowDown size={10} /> navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft size={10} /> open</span>
          <span className="ml-auto tabular-nums">
            {entries === null ? 'loading index…' : `${entries.length.toLocaleString()} records indexed`}
          </span>
        </div>
      </div>
    </div>
  )
}
