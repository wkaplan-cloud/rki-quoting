'use client'
import { useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import type { ElecClient } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
}

export type ClientItem = Pick<ElecClient, 'id' | 'client_name' | 'company' | 'email'>

interface Props {
  clients: ClientItem[]
  selectedId: string | null
  selectedName: string
  onSelect: (id: string | null, name: string) => void
  onClientCreated: (client: ClientItem) => void
  label?: string
}

// Search-existing / create-new-inline client picker, shared by the New Job
// and New Inspection flows so staff use the exact same mechanism everywhere.
export function ClientPicker({ clients, selectedId, selectedName, onSelect, onClientCreated, label = 'Client (optional)' }: Props) {
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)
  const [addingName, setAddingName] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [creating, setCreating] = useState(false)

  async function createAndSelect() {
    const name = addingName?.trim()
    if (!name || creating) return
    setCreating(true)
    const res = await fetch('/api/supplier-portal/staff/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: name,
        email: email.trim() || null,
        contact_number: phone.trim() || null,
      }),
    })
    if (res.ok) {
      const c = await res.json() as ClientItem
      onClientCreated(c)
      onSelect(c.id, c.client_name)
      setSearch(''); setFocused(false); setAddingName(null); setEmail(''); setPhone('')
    }
    setCreating(false)
  }

  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>{label}</label>
      {selectedId ? (
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
          style={{ background: 'rgba(58,124,165,0.08)', border: `1.5px solid ${S.accent}` }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'rgba(58,124,165,0.15)', color: S.accent }}>
            {selectedName.charAt(0).toUpperCase()}
          </div>
          <span className="flex-1 text-sm font-semibold" style={{ color: S.text }}>{selectedName}</span>
          <button onClick={() => { onSelect(null, ''); setSearch('') }}
            className="p-1" style={{ color: S.muted }}>
            <X size={15} />
          </button>
        </div>
      ) : addingName !== null ? (
        <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: 'rgba(58,124,165,0.06)', border: `1.5px solid ${S.accent}` }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: S.text }}>New client: {addingName}</p>
            <button onClick={() => { setAddingName(null); setEmail(''); setPhone('') }}
              className="p-1" style={{ color: S.muted }}>
              <X size={15} />
            </button>
          </div>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email (optional)"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            className="w-full px-3.5 py-3 rounded-xl outline-none"
            style={{ background: S.card, border: `1.5px solid ${S.border}`, color: S.text, fontSize: '16px' }}
          />
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Contact number (optional)"
            type="tel"
            inputMode="tel"
            className="w-full px-3.5 py-3 rounded-xl outline-none"
            style={{ background: S.card, border: `1.5px solid ${S.border}`, color: S.text, fontSize: '16px' }}
          />
          <button
            onClick={() => void createAndSelect()}
            disabled={creating}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: S.accent }}>
            {creating ? <Loader2 size={14} className="animate-spin inline mr-1.5" /> : null}
            {creating ? 'Adding…' : 'Add client'}
          </button>
        </div>
      ) : (
        <div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search or add client…"
            className="w-full px-3.5 py-3 rounded-xl outline-none"
            style={{ background: S.bg, border: `1.5px solid ${focused ? S.accent : S.border}`, color: S.text, fontSize: '16px' }}
          />
          {(focused || search.trim()) && (() => {
            const filtered = search.trim()
              ? clients.filter(c => c.client_name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
              : clients.slice(0, 5)
            const exactMatch = clients.some(c => c.client_name.toLowerCase() === search.trim().toLowerCase())
            if (!filtered.length && !search.trim()) return null
            return (
              <div className="mt-1 rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}`, background: S.card, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                {filtered.map((c, i) => (
                  <button key={c.id}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { onSelect(c.id, c.client_name); setSearch(''); setFocused(false) }}
                    className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
                    style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'rgba(58,124,165,0.1)', color: S.accent }}>
                      {c.client_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: S.text }}>{c.client_name}</p>
                      {c.company && <p className="text-xs truncate" style={{ color: S.muted }}>{c.company}</p>}
                    </div>
                  </button>
                ))}
                {search.trim() && !exactMatch && (
                  <button
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setAddingName(search.trim()); setFocused(false) }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left"
                    style={{ borderTop: filtered.length > 0 ? `1px solid ${S.border}` : undefined }}>
                    <Plus size={14} style={{ color: S.accent }} />
                    <span className="text-sm font-medium" style={{ color: S.accent }}>
                      {`Add "${search.trim()}" as new client`}
                    </span>
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
