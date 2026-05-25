'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, FileText, X, ChevronRight, Calendar, User } from 'lucide-react'
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
  initialQuotes: (ElecQuote & { client: ElecClient | null })[]
  clients: Pick<ElecClient, 'id' | 'client_name' | 'company'>[]
}

function fmt(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function NewQuoteModal({ clients, onClose, onCreated }: {
  clients: Props['clients']
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [projectName, setProjectName] = useState('')
  const [clientId, setClientId] = useState('')
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
      body: JSON.stringify({ project_name: projectName.trim(), client_id: clientId || null, project_type: projectType || null }),
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
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1.5px solid ${S.border}`, color: clientId ? S.text : S.muted }}>
              <option value="">Select client (optional)</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}{c.company ? ` — ${c.company}` : ''}</option>)}
            </select>
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

export function QuotesList({ initialQuotes, clients }: Props) {
  const router = useRouter()
  const [quotes] = useState(initialQuotes)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ElecQuoteStatus | ''>('')
  const [showNewModal, setShowNewModal] = useState(false)

  const filtered = quotes.filter(q => {
    const matchesSearch = !search ||
      q.project_name.toLowerCase().includes(search.toLowerCase()) ||
      q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
      (q.client?.client_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !statusFilter || q.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: S.text }}>Quotes</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>{quotes.length} quote{quotes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ background: S.accent }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          <Plus size={15} /> New Quote
        </button>
      </div>

      {/* Filters */}
      {quotes.length > 0 && (
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search quotes…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
              style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ElecQuoteStatus | '')}
            className="px-3.5 py-2 text-sm rounded-xl outline-none"
            style={{ background: S.card, border: `1px solid ${S.border}`, color: statusFilter ? S.text : S.muted }}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
        </div>
      )}

      {/* Empty state */}
      {quotes.length === 0 && (
        <div className="rounded-2xl py-20 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <FileText size={36} className="mx-auto mb-3" style={{ color: S.border }} />
          <p className="font-semibold mb-1" style={{ color: S.text }}>No quotes yet</p>
          <p className="text-sm mb-5" style={{ color: S.muted }}>Create your first quote to get started</p>
          <button onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
            style={{ background: S.accent }}>
            <Plus size={14} /> New Quote
          </button>
        </div>
      )}

      {/* Quote list */}
      {filtered.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {filtered.map((q, i) => {
            const st = STATUS_CONFIG[q.status]
            return (
              <button key={q.id} onClick={() => router.push(`/supplier-portal/quoting/quotes/${q.id}`)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}
                onMouseEnter={e => e.currentTarget.style.background = S.bg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(58,124,165,0.08)' }}>
                  <FileText size={16} style={{ color: S.accent }} />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm truncate" style={{ color: S.text }}>{q.project_name}</p>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-mono" style={{ color: S.muted }}>{q.quote_number}</span>
                    {q.client && (
                      <span className="text-xs flex items-center gap-1" style={{ color: S.muted }}>
                        <User size={10} />{q.client.client_name}
                      </span>
                    )}
                    {q.quoted_date && (
                      <span className="text-xs flex items-center gap-1" style={{ color: S.muted }}>
                        <Calendar size={10} />{q.quoted_date}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: S.border, flexShrink: 0 }} />
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

      {showNewModal && (
        <NewQuoteModal
          clients={clients}
          onClose={() => setShowNewModal(false)}
          onCreated={id => router.push(`/supplier-portal/quoting/quotes/${id}`)}
        />
      )}
    </div>
  )
}
