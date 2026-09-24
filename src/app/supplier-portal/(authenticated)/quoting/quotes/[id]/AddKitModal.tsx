'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Package, Loader2, Check } from 'lucide-react'
import type { ElecKit } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: 'var(--qh-accent)',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
}

const NEW_SECTION = '__new__'

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Picks a kit and where its lines go: a new section named after it, or an existing room. */
export function AddKitModal({ sections, onAdd, onClose }: {
  sections: { id: string; title: string }[]
  onAdd: (kit: ElecKit, target: { sectionId: string } | { newSectionTitle: string }) => void
  onClose: () => void
}) {
  const [kits, setKits] = useState<ElecKit[] | null>(null)
  const [error, setError] = useState('')
  const [kitId, setKitId] = useState<string | null>(null)
  const [target, setTarget] = useState(NEW_SECTION)
  const [sectionTitle, setSectionTitle] = useState('')

  useEffect(() => {
    fetch('/api/supplier-portal/quoting/kits')
      .then(r => r.json())
      .then((d: { kits?: ElecKit[]; error?: string }) => {
        if (d.kits) setKits(d.kits)
        else setError(d.error ?? 'Could not load kits')
      })
      .catch(() => setError('Could not load kits'))
  }, [])

  const kit = kits?.find(k => k.id === kitId) ?? null

  function choose(k: ElecKit) {
    setKitId(k.id)
    setSectionTitle(k.name)
  }

  function confirm() {
    if (!kit) return
    onAdd(kit, target === NEW_SECTION ? { newSectionTitle: sectionTitle.trim() || kit.name } : { sectionId: target })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
          <h2 className="font-bold text-base" style={{ color: S.text }}>Add a kit</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: S.muted }} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {kits === null && !error && (
            <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin" style={{ color: S.accent }} /></div>
          )}
          {error && <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>}
          {kits && kits.length === 0 && (
            <div className="py-6 text-center">
              <Package size={28} className="mx-auto mb-2" style={{ color: S.border }} />
              <p className="text-sm" style={{ color: S.muted }}>You haven&apos;t built any kits yet.</p>
              <Link href="/supplier-portal/quoting/kits" className="inline-block mt-3 text-sm font-semibold" style={{ color: S.accent }}>
                Build one on the Kits page →
              </Link>
            </div>
          )}
          {kits && kits.length > 0 && (
            <div className="space-y-1.5">
              {kits.map(k => {
                const total = k.items.reduce((s, i) => s + i.quantity * (i.quoted_unit_rate + (i.labour_rate ?? 0)), 0)
                const active = k.id === kitId
                return (
                  <button key={k.id} onClick={() => choose(k)}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-left"
                    style={{
                      background: active ? 'rgba(var(--qh-accent-rgb),0.08)' : S.bg,
                      border: `1.5px solid ${active ? S.accent : S.border}`,
                    }}>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate" style={{ color: S.text }}>{k.name}</span>
                      <span className="block text-xs" style={{ color: S.muted }}>{k.items.length} line{k.items.length !== 1 ? 's' : ''}</span>
                    </span>
                    <span className="text-sm font-semibold flex-shrink-0" style={{ color: active ? S.accent : S.text }}>{fmtR(total)}</span>
                  </button>
                )
              })}
            </div>
          )}

          {kit && (
            <div className="space-y-3 pt-1">
              <div>
                <label htmlFor="kit-target" className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Add to</label>
                <select id="kit-target" value={target} onChange={e => setTarget(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none" style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}>
                  <option value={NEW_SECTION}>A new section</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.title.trim() || 'Untitled section'}</option>)}
                </select>
              </div>
              {target === NEW_SECTION && (
                <div>
                  <label htmlFor="kit-section-title" className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Section name</label>
                  <input id="kit-section-title" value={sectionTitle} onChange={e => setSectionTitle(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none" style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                  <p className="text-[10px] mt-1" style={{ color: S.muted }}>Usually the room, e.g. &ldquo;Lounge&rdquo; or &ldquo;Driveway&rdquo;</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4" style={{ borderTop: `1px solid ${S.border}` }}>
          <button onClick={confirm} disabled={!kit}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: S.accent }}>
            <Check size={14} /> {kit ? `Add ${kit.items.length} line${kit.items.length !== 1 ? 's' : ''}` : 'Choose a kit'}
          </button>
        </div>
      </div>
    </div>
  )
}
