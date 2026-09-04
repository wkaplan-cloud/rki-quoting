'use client'
import { useState, useEffect, useRef, useId } from 'react'
import { Plus, X } from 'lucide-react'
import type { MfgClient } from '@/lib/mfg-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#1B4F8A',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
}

type ClientOption = Pick<MfgClient, 'id' | 'client_name' | 'contact_person'>

interface Props {
  clientId: string | null
  displayName: string
  onChange: (id: string | null, name: string) => void
  onNewClient?: (client: ClientOption) => void
  clients: ClientOption[]
  disabled?: boolean
  ariaLabel?: string
}

export function MfgClientCombobox({ clientId, displayName, onChange, onNewClient, clients, disabled, ariaLabel = 'Client' }: Props) {
  const [input, setInput] = useState(displayName)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => { setInput(displayName) }, [displayName])

  const filtered = input.trim().length > 0
    ? clients.filter(c =>
        c.client_name.toLowerCase().includes(input.toLowerCase()) ||
        (c.contact_person ?? '').toLowerCase().includes(input.toLowerCase())
      ).slice(0, 6)
    : clients.slice(0, 6)

  const exactMatch = clients.some(c => c.client_name.toLowerCase() === input.trim().toLowerCase())
  const showCreate = input.trim().length > 0 && !exactMatch
  const rowCount = filtered.length + (showCreate ? 1 : 0)

  async function addNew() {
    const name = input.trim()
    if (!name || creating) return
    setCreating(true); setError('')
    const res = await fetch('/api/supplier-portal/manufacturing/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: name }),
    })
    setCreating(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? 'Could not add client')
      return
    }
    const created = await res.json() as MfgClient
    setInput(created.client_name)
    onChange(created.id, created.client_name)
    onNewClient?.({ id: created.id, client_name: created.client_name, contact_person: created.contact_person })
    setOpen(false)
    setHighlight(-1)
  }

  function select(c: ClientOption) {
    setInput(c.client_name)
    onChange(c.id, c.client_name)
    setOpen(false)
    setHighlight(-1)
  }

  function clear() { setInput(''); onChange(null, ''); setError(''); setHighlight(-1) }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || rowCount === 0) return
    if (e.key === 'ArrowDown')      { e.preventDefault(); setHighlight(h => (h + 1) % rowCount) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => (h <= 0 ? rowCount - 1 : h - 1)) }
    else if (e.key === 'Escape')    { setOpen(false); setHighlight(-1) }
    else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      if (highlight < filtered.length) select(filtered[highlight])
      else void addNew()
    }
  }

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
          aria-label={ariaLabel}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={e => { setInput(e.target.value); onChange(null, e.target.value); setOpen(true); setHighlight(-1); setError('') }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="w-full px-3 py-2.5 text-sm rounded-lg outline-none pr-7"
          style={{ background: disabled ? S.bg : S.input, border: `1.5px solid ${S.border}`, color: S.text }}
        />
        {input && !disabled && (
          <button type="button" aria-label="Clear client"
            onMouseDown={e => { e.preventDefault(); clear() }}
            className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: S.muted }}>
            <X size={13} />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div id={listId} role="listbox" className="absolute top-full left-0 right-0 z-20 rounded-xl mt-1 overflow-hidden"
          style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>

          {filtered.map((c, i) => (
            <button key={c.id} type="button"
              onMouseDown={e => { e.preventDefault(); select(c) }}
              onMouseEnter={() => setHighlight(i)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
              style={{ background: highlight === i || c.id === clientId ? S.bg : 'transparent' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: 'rgba(27,79,138,0.1)', color: S.accent }}>
                {c.client_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: S.text }}>{c.client_name}</p>
                {c.contact_person && <p className="text-xs truncate" style={{ color: S.muted }}>{c.contact_person}</p>}
              </div>
            </button>
          ))}

          {showCreate && (
            <button type="button"
              onMouseDown={e => { e.preventDefault(); void addNew() }}
              onMouseEnter={() => setHighlight(filtered.length)}
              disabled={creating}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors"
              style={{
                borderTop: filtered.length > 0 ? `1px solid ${S.border}` : undefined,
                background: highlight === filtered.length ? S.bg : 'transparent',
              }}>
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

      {error && <p className="mt-1.5 text-xs" style={{ color: '#DC2626' }}>{error}</p>}
    </div>
  )
}
