'use client'
import { useState, useEffect } from 'react'
import { Router, Search, Plus, Loader2 } from 'lucide-react'
import type { ElecDevice } from '@/lib/elec-types'
import { DeviceCard, DeviceEditor } from '@/components/devices/DevicesPanel'
import { warrantyState } from '@/lib/device-categories'
import { todaySA } from '@/lib/dates'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: 'var(--qh-accent)',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
}

type Filter = 'all' | 'expiring'

/**
 * Every device across every client. Built for the support call: type whatever
 * the caller has — a serial, a MAC, an IP, a model or their name.
 */
export function DevicesClient({ clients }: { clients: { id: string; client_name: string }[] }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [devices, setDevices] = useState<ElecDevice[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<ElecDevice | 'new' | null>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/supplier-portal/quoting/devices${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
      const d = await res.json() as { devices?: ElecDevice[] }
      setDevices(d.devices ?? [])
      setLoading(false)
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q])

  const today = todaySA()
  const shown = (devices ?? []).filter(d => filter === 'all' || ['soon', 'expired'].includes(warrantyState(d.warranty_until, today)))
  const byClient = new Map<string, { name: string; list: ElecDevice[] }>()
  for (const d of shown) {
    const key = d.client_id ?? 'none'
    const entry = byClient.get(key) ?? { name: d.client?.client_name ?? 'No client', list: [] }
    entry.list.push(d)
    byClient.set(key, entry)
  }

  return (
    <div className="min-h-screen" style={{ background: S.bg }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(var(--qh-accent-rgb),0.1)' }}>
              <Router size={18} style={{ color: S.accent }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: S.text }}>Devices</h1>
              <p className="text-xs" style={{ color: S.muted }}>Everything you&apos;ve installed, at every site</p>
            </div>
          </div>
          <button onClick={() => setEditing('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
            <Plus size={15} /> Add device
          </button>
        </div>

        <div className="rounded-2xl p-4 mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <label htmlFor="device-search" className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>
            Search by serial, MAC, IP, model or client
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
            <input id="device-search" value={q} onChange={e => setQ(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl outline-none" style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: S.muted }} />}
          </div>
          <div className="flex gap-1.5 mt-3">
            {([['all', 'All devices'], ['expiring', 'Warranty ending or ended']] as [Filter, string][]).map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)} className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: filter === v ? S.accent : S.input, color: filter === v ? '#fff' : S.muted, border: `1px solid ${filter === v ? S.accent : S.border}` }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {devices === null ? (
          <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin" style={{ color: S.accent }} /></div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <Router size={30} className="mx-auto mb-3" style={{ color: S.border }} />
            <p className="text-sm font-medium" style={{ color: S.text }}>{q || filter !== 'all' ? 'Nothing matches' : 'No devices registered yet'}</p>
            <p className="text-xs mt-1" style={{ color: S.muted }}>
              {q || filter !== 'all' ? 'Try a shorter search or a different filter.' : 'Techs add devices from the project on their phone as they install — or add them here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {[...byClient.entries()].map(([key, { name, list }]) => (
              <div key={key}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: S.accent }}>{name} <span style={{ color: S.muted }}>· {list.length}</span></p>
                <div className="space-y-2">
                  {list.map(d => (
                    <div key={d.id}>
                      {(d.room || d.quote) && (
                        <p className="text-[11px] mb-1 ml-1" style={{ color: S.muted }}>
                          {[d.room, d.quote ? `${d.quote.quote_number} · ${d.quote.project_name}` : null].filter(Boolean).join(' — ')}
                        </p>
                      )}
                      <DeviceCard device={d} onEdit={() => setEditing(d)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <DeviceEditor
          device={editing === 'new' ? null : editing}
          clients={clients}
          rooms={[...new Set((devices ?? []).map(d => d.room).filter((r): r is string => !!r))]}
          onClose={() => setEditing(null)}
          onSaved={saved => {
            setDevices(ds => {
              const list = ds ?? []
              return list.some(x => x.id === saved.id) ? list.map(x => x.id === saved.id ? saved : x) : [saved, ...list]
            })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
