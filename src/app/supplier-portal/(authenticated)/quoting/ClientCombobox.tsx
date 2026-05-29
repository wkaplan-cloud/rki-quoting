'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ElecClient } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
}

interface Props {
  clientId: string | null
  displayName: string
  onChange: (id: string | null, name: string) => void
  onNewClient?: (client: Pick<ElecClient, 'id' | 'client_name' | 'company'>) => void
  clients: Pick<ElecClient, 'id' | 'client_name' | 'company'>[]
  portalAccountId: string
  disabled?: boolean
}

export function ClientCombobox({ clientId: _clientId, displayName, onChange, onNewClient, clients, portalAccountId, disabled }: Props) {
  const supabase = createClient()
  const [input, setInput] = useState(displayName)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setInput(displayName) }, [displayName])

  const filtered = input.trim().length > 0
    ? clients.filter(c =>
        c.client_name.toLowerCase().includes(input.toLowerCase()) ||
        (c.company ?? '').toLowerCase().includes(input.toLowerCase())
      ).slice(0, 6)
    : clients.slice(0, 6)

  const exactMatch = clients.some(c => c.client_name.toLowerCase() === input.trim().toLowerCase())

  async function addNew() {
    if (!input.trim() || creating) return
    setCreating(true)
    const { data, error } = await supabase
      .from('elec_clients')
      .insert({ portal_account_id: portalAccountId, client_name: input.trim() })
      .select('id, client_name, company')
      .single()
    if (!error && data) {
      onChange(data.id, data.client_name)
      onNewClient?.({ id: data.id, client_name: data.client_name, company: data.company })
      setOpen(false)
    }
    setCreating(false)
  }

  function select(c: Pick<ElecClient, 'id' | 'client_name' | 'company'>) {
    setInput(c.client_name)
    onChange(c.id, c.client_name)
    setOpen(false)
  }

  function clear() { setInput(''); onChange(null, '') }

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          placeholder="Search or add client…"
          className="w-full px-3 py-2 text-sm rounded-lg outline-none pr-7"
          style={{ background: disabled ? S.bg : S.input, border: `1px solid ${S.border}`, color: S.text }}
        />
        {input && !disabled && (
          <button onMouseDown={e => { e.preventDefault(); clear() }}
            className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: S.muted }}>
            <X size={13} />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute top-full left-0 right-0 z-20 rounded-xl mt-1 overflow-hidden"
          style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>

          {filtered.map(c => (
            <button key={c.id}
              onMouseDown={e => { e.preventDefault(); select(c) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
              onMouseEnter={e => e.currentTarget.style.background = S.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: 'rgba(58,124,165,0.1)', color: S.accent }}>
                {c.client_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm" style={{ color: S.text }}>{c.client_name}</p>
                {c.company && <p className="text-xs truncate" style={{ color: S.muted }}>{c.company}</p>}
              </div>
            </button>
          ))}

          {input.trim() && !exactMatch && (
            <button
              onMouseDown={e => { e.preventDefault(); void addNew() }}
              disabled={creating}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors"
              style={{ borderTop: filtered.length > 0 ? `1px solid ${S.border}` : undefined }}
              onMouseEnter={e => e.currentTarget.style.background = S.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Plus size={13} style={{ color: S.accent }} />
              <span style={{ color: S.accent }}>
                {creating ? 'Adding…' : `Add "${input.trim()}" as new client`}
              </span>
            </button>
          )}

          {filtered.length === 0 && !input.trim() && (
            <p className="px-3 py-3 text-sm" style={{ color: S.muted }}>Start typing to search or add a client</p>
          )}
        </div>
      )}
    </div>
  )
}
