'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, FileText, X, ChevronRight, Calendar, User, Archive, RotateCcw, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ElecQuote, ElecClient, ElecQuoteStatus } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
}

const STATUS_CONFIG: Record<ElecQuoteStatus, { label: string; bg: string; color: string }> = {
  draft:       { label: 'Draft',       bg: '#F4F4F5',              color: '#71717A' },
  quoted:      { label: 'Quoted',      bg: 'rgba(58,124,165,0.1)', color: '#3A7CA5' },
  approved:    { label: 'Approved',    bg: 'rgba(22,163,74,0.1)',  color: '#16A34A' },
  in_progress: { label: 'In Progress', bg: 'rgba(217,164,65,0.1)', color: '#D9A441' },
  completed:   { label: 'Completed',   bg: 'rgba(22,101,52,0.1)',  color: '#166534' },
  cancelled:   { label: 'Cancelled',   bg: '#FEF2F2',              color: '#DC2626' },
}

const PROJECT_TYPES = [
  { value: '',             label: 'Select type (optional)' },
  { value: 'residential',  label: 'Residential' },
  { value: 'commercial',   label: 'Commercial' },
  { value: 'industrial',   label: 'Industrial' },
  { value: 'retail',       label: 'Retail' },
]

interface Props {
  portalAccountId: string
  initialQuotes: (ElecQuote & { client: ElecClient | null })[]
  initialArchivedQuotes: (ElecQuote & { client: ElecClient | null })[]
  clients: Pick<ElecClient, 'id' | 'client_name' | 'company'>[]
}

type ClientOption = Pick<ElecClient, 'id' | 'client_name' | 'company'>

function ClientCombobox({ clients, portalAccountId, value, onChange }: {
  clients: ClientOption[]
  portalAccountId: string
  value: string
  onChange: (id: string | null, name: string) => void
}) {
  const supabase = createClient()
  const [input, setInput] = useState(value)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
      .select('id, client_name')
      .single()
    if (!error && data) { onChange(data.id, data.client_name); setOpen(false) }
    setCreating(false)
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
          onChange={e => { setInput(e.target.value); setOpen(true) }}
          placeholder="Search or add client…"
          className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none pr-7"
          style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
          onFocus={e => { setOpen(true); e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
          onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
        />
        {input && (
          <button onMouseDown={e => { e.preventDefault(); setInput(''); onChange(null, '') }}
            className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: S.muted }}>
            <X size={13} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-20 rounded-xl mt-1 overflow-hidden"
          style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {filtered.map(c => (
            <button key={c.id}
              onMouseDown={e => { e.preventDefault(); setInput(c.client_name); onChange(c.id, c.client_name); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
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
              onMouseDown={e => { e.preventDefault(); addNew() }}
              disabled={creating}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm"
              style={{ borderTop: filtered.length > 0 ? `1px solid ${S.border}` : undefined }}
              onMouseEnter={e => e.currentTarget.style.background = S.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Plus size={13} style={{ color: S.accent }} />
              <span style={{ color: S.accent }}>{creating ? 'Adding…' : `Add "${input.trim()}" as new client`}</span>
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

function fmt(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function NewQuoteModal({ clients, portalAccountId, onClose, onCreated }: {
  clients: Props['clients']
  portalAccountId: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [projectName, setProjectName] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [projectType, setProjectType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  async function handleCreate() {
    if (!projectName.trim()) { setError('Project name is required'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/supplier-portal/quoting/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_name: projectName.trim(), client_id: clientId, project_type: projectType || null }),
    })
    const data = await res.json() as { id?: string; error?: string }
    if (!res.ok || !data.id) { setError(data.error ?? 'Failed to create quote'); setLoading(false); return }
    onCreated(data.id)
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: S.card, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
          <h2 className="font-bold" style={{ color: S.text }}>New Quote</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: S.muted }}
            onMouseEnter={e => e.currentTarget.style.background = S.input}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Project Name *</label>
            <input
              autoFocus
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder="e.g. Sandton Office Rewire"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
              onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
              onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Client</label>
            <ClientCombobox
              clients={clients}
              portalAccountId={portalAccountId}
              value=""
              onChange={(id) => setClientId(id)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Project Type</label>
            <select value={projectType} onChange={e => setProjectType(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1.5px solid ${S.border}`, color: projectType ? S.text : S.muted }}>
              {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: `1px solid ${S.border}` }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg" style={{ color: S.muted }}
            onMouseEnter={e => e.currentTarget.style.background = S.input}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Cancel</button>
          <button onClick={handleCreate} disabled={loading || !projectName.trim()}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: S.accent }}>
            {loading ? 'Creating…' : 'Create Quote'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function QuotesList({ portalAccountId, initialQuotes, initialArchivedQuotes, clients }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [quotes] = useState(initialQuotes)
  const [archivedQuotes, setArchivedQuotes] = useState(initialArchivedQuotes)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ElecQuoteStatus | 'all'>('all')
  const [showNewModal, setShowNewModal] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [unarchiving, setUnarchiving] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function deleteArchived(id: string) {
    if (!confirm('Permanently delete this project? This cannot be undone.')) return
    setDeletingId(id)
    const res = await fetch(`/api/supplier-portal/quoting/quotes/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Delete failed'); setDeletingId(null); return }
    setArchivedQuotes(prev => prev.filter(q => q.id !== id))
    setDeletingId(null)
  }

  async function unarchive(id: string) {
    setUnarchiving(id)
    const { error } = await supabase.from('elec_quotes').update({ archived_at: null }).eq('id', id)
    if (error) { alert(error.message); setUnarchiving(null); return }
    setArchivedQuotes(prev => prev.filter(q => q.id !== id))
    setUnarchiving(null)
  }

  const filtered = quotes.filter(q => {
    const matchesSearch = !search ||
      q.project_name.toLowerCase().includes(search.toLowerCase()) ||
      q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
      (q.client?.client_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const counts: Record<string, number> = { all: quotes.length }
  quotes.forEach(q => { counts[q.status] = (counts[q.status] ?? 0) + 1 })

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: S.text }}>Projects</h1>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>{quotes.length} total</p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: S.accent }}>
          <Plus size={15} /> New Quote
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['all', 'draft', 'quoted', 'approved', 'in_progress', 'completed'] as const).map(s => {
          const cfg = s === 'all' ? null : STATUS_CONFIG[s]
          const active = statusFilter === s
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
              style={{
                background: active ? S.accent : S.card,
                color: active ? '#fff' : S.muted,
                border: `1px solid ${active ? S.accent : S.border}`,
              }}>
              {s === 'all' ? 'All' : cfg!.label}
              <span className="text-[10px] opacity-70">{counts[s] ?? 0}</span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by project name, number, or client…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }} />
        </div>
      </div>

      {/* Empty state */}
      {quotes.length === 0 && (
        <div className="rounded-2xl py-16 flex flex-col items-center gap-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <FileText size={32} style={{ color: S.border }} />
          <p className="text-sm" style={{ color: S.muted }}>No quotes yet</p>
          <p className="text-xs" style={{ color: S.muted }}>Create your first quote to get started.</p>
        </div>
      )}

      {/* Quote list */}
      {filtered.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {filtered.map((q, i) => {
            const st = STATUS_CONFIG[q.status]
            return (
              <button key={q.id} onClick={() => router.push(`/supplier-portal/quoting/quotes/${q.id}`)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: st.bg }}>
                  <FileText size={15} style={{ color: st.color }} />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono" style={{ color: S.muted }}>{q.quote_number}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{q.project_name}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {q.client && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: S.muted }}>
                        <User size={10} />{q.client.client_name}
                      </span>
                    )}
                    {q.created_by_name && (
                      <span className="text-xs" style={{ color: S.muted }}>by {q.created_by_name}</span>
                    )}
                  </div>
                </div>
                {/* Date + arrow */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs" style={{ color: S.muted }}>
                      {q.quoted_date ? fmtDate(q.quoted_date) : fmtDate(q.created_at)}
                    </p>
                    <p className="text-[10px] flex items-center justify-end gap-1 mt-0.5" style={{ color: S.muted }}>
                      <Calendar size={9} />{q.quoted_date ? 'Quoted' : 'Created'}
                    </p>
                  </div>
                  <ChevronRight size={16} style={{ color: S.muted }} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {quotes.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl py-10 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <p className="text-sm" style={{ color: S.muted }}>No quotes match your filters</p>
        </div>
      )}

      {/* Archived section */}
      {archivedQuotes.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowArchived(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold mb-3 transition-opacity hover:opacity-75"
            style={{ color: S.muted }}>
            <Archive size={14} />
            Archived ({archivedQuotes.length})
            <ChevronRight size={13} style={{ transform: showArchived ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>

          {showArchived && (
            <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              {archivedQuotes.map((q, i) => (
                <div key={q.id}
                  className="flex items-center gap-4 px-5 py-4"
                  style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined, opacity: 0.7 }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: S.input }}>
                    <Archive size={14} style={{ color: S.muted }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: S.text }}>{q.project_name}</p>
                    <div className="flex items-center gap-3 flex-wrap mt-0.5">
                      <span className="text-xs font-mono" style={{ color: S.muted }}>{q.quote_number}</span>
                      {q.client && (
                        <span className="text-xs flex items-center gap-1" style={{ color: S.muted }}>
                          <User size={10} />{q.client.client_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => unarchive(q.id)}
                      disabled={unarchiving === q.id || deletingId === q.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-75"
                      style={{ background: 'rgba(58,124,165,0.08)', color: S.accent }}>
                      <RotateCcw size={11} />
                      {unarchiving === q.id ? 'Restoring…' : 'Unarchive'}
                    </button>
                    <button
                      onClick={() => void deleteArchived(q.id)}
                      disabled={deletingId === q.id || unarchiving === q.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-75"
                      style={{ background: 'rgba(220,38,38,0.06)', color: '#DC2626' }}>
                      <Trash2 size={11} />
                      {deletingId === q.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showNewModal && (
        <NewQuoteModal
          clients={clients}
          portalAccountId={portalAccountId}
          onClose={() => setShowNewModal(false)}
          onCreated={id => router.push(`/supplier-portal/quoting/quotes/${id}`)}
        />
      )}
    </div>
  )
}
