'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, CopySlash, Archive, ArchiveRestore } from 'lucide-react'
import type { MfgQuote, MfgClient } from '@/lib/mfg-types'

const S = { card: '#FFFFFF', accent: '#1B4F8A', text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5' }

const STATUS_CONFIG = {
  draft:      { label: 'Draft',      color: '#71717A', bg: '#F4F4F5', icon: FileText },
  sent:       { label: 'Sent',       color: '#D97706', bg: '#FEF3C7', icon: Clock },
  accepted:   { label: 'Accepted',   color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle },
  declined:   { label: 'Declined',   color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
  expired:    { label: 'Expired',    color: '#9A3412', bg: '#FEF3C7', icon: AlertCircle },
  invoiced:   { label: 'Invoiced',   color: '#1B4F8A', bg: '#EFF6FF', icon: RefreshCw },
  superseded: { label: 'Superseded', color: '#71717A', bg: '#F4F4F5', icon: CopySlash },
}

type QuoteWithJob = MfgQuote & { job?: { id: string; job_name: string; client?: { id: string; client_name: string } | null } | null }

const ARCHIVABLE_STATUSES = ['draft', 'declined', 'expired', 'superseded']

interface Props {
  initialQuotes: QuoteWithJob[]
  clients: Pick<MfgClient, 'id' | 'client_name' | 'contact_person'>[]
  defaultMarkup: number
  showArchived?: boolean
}

export function MfgQuotesListClient({ initialQuotes, clients, defaultMarkup, showArchived = false }: Props) {
  const router = useRouter()
  const [quotes, setQuotes]             = useState<QuoteWithJob[]>(initialQuotes)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showNew, setShowNew]           = useState(false)
  const [newClientId, setNewClientId]   = useState('')
  const [newJobName, setNewJobName]     = useState('')
  const [creating, setCreating]         = useState(false)
  const [error, setError]               = useState('')
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null)

  const filtered = quotes.filter(q => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false
    const clientName = q.job?.client?.client_name?.toLowerCase() ?? ''
    const jobName    = q.job?.job_name?.toLowerCase() ?? ''
    if (search && !clientName.includes(search.toLowerCase()) && !jobName.includes(search.toLowerCase()) && !q.quote_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function handleCreate() {
    if (!newJobName.trim()) { setError('Job name is required'); return }
    setCreating(true); setError('')
    const res = await fetch('/api/supplier-portal/manufacturing/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: newClientId || null, job_name: newJobName.trim() }),
    })
    setCreating(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as { error?: string }).error ?? 'Failed to create'); return }
    const newQuote = await res.json()
    router.push(`/supplier-portal/manufacturing/quotes/${newQuote.id}`)
  }

  async function handleArchive(id: string) {
    const res = await fetch(`/api/supplier-portal/manufacturing/quotes/${id}/archive`, { method: 'POST' })
    if (!res.ok) return
    setQuotes(prev => prev.filter(q => q.id !== id))
    setConfirmArchive(null)
  }

  async function handleUnarchive(id: string) {
    const res = await fetch(`/api/supplier-portal/manufacturing/quotes/${id}/archive`, { method: 'DELETE' })
    if (!res.ok) return
    setQuotes(prev => prev.filter(q => q.id !== id))
  }

  function daysSince(dateStr: string) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  }

  function daysUntil(dateStr: string) {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotes, clients, jobs…"
          className="flex-1 min-w-[180px] px-3.5 py-2 text-sm rounded-lg outline-none"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }} />
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
          {(['all','draft','sent','accepted','invoiced'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-2 text-xs font-semibold transition-colors capitalize"
              style={{ background: statusFilter === s ? S.accent : S.card, color: statusFilter === s ? '#fff' : S.muted }}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => router.push(showArchived ? '/supplier-portal/manufacturing/quotes' : '/supplier-portal/manufacturing/quotes?archived=1')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: showArchived ? S.accent : S.input, color: showArchived ? '#fff' : S.muted, border: `1px solid ${S.border}` }}>
          <Archive size={14} /> {showArchived ? 'Hide archived' : 'Archived'}
        </button>
        {!showArchived && (
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90"
            style={{ background: S.accent }}>
            <Plus size={14} /> New Quote
          </button>
        )}
      </div>

      {/* New quote modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setShowNew(false)}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: S.card }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-5" style={{ color: S.text }}>New Quote</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Client</label>
                <select value={newClientId} onChange={e => setNewClientId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                  style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}>
                  <option value="">No client / select later</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Job Name</label>
                <input value={newJobName} onChange={e => setNewJobName(e.target.value)}
                  placeholder="e.g. Master Bedroom Built-ins"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
                  style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()} />
              </div>
            </div>
            {error && <p className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreate} disabled={creating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                {creating ? 'Creating…' : 'Create Quote →'}
              </button>
              <button onClick={() => setShowNew(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Quote list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: S.muted }}>
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{showArchived ? 'No archived quotes.' : search || statusFilter !== 'all' ? 'No quotes match your filters.' : 'No quotes yet. Create your first quote.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(q => {
            const cfg = STATUS_CONFIG[q.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft
            const Icon = cfg.icon
            const days = q.status === 'sent' && q.sent_at ? daysSince(q.sent_at) : null
            const expiry = q.status === 'sent' && q.valid_until ? daysUntil(q.valid_until) : null
            const urgentColor = expiry !== null && expiry <= 3 ? '#DC2626' : expiry !== null && expiry <= 7 ? '#D97706' : null

            return (
              <div key={q.id} onClick={() => router.push(`/supplier-portal/manufacturing/quotes/${q.id}`)}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all"
                style={{ background: S.card, border: `1px solid ${S.border}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.boxShadow = '0 2px 8px rgba(27,79,138,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.boxShadow = 'none' }}>

                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                  <Icon size={15} style={{ color: cfg.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: S.text }}>{q.quote_number}</span>
                    {q.revision_number > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#EFF6FF', color: S.accent }}>v{q.revision_number}</span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: S.muted }}>
                    {q.job?.client?.client_name && <span className="font-medium">{q.job.client.client_name} · </span>}
                    {q.job?.job_name}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: S.text }}>R {q.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                  {days !== null && (
                    <p className="text-[10px] mt-0.5" style={{ color: urgentColor ?? S.muted }}>
                      {expiry !== null && expiry <= 0 ? 'expired' : expiry !== null ? `expires in ${expiry}d` : `sent ${days}d ago`}
                    </p>
                  )}
                  {!days && <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>{new Date(q.created_at).toLocaleDateString('en-ZA')}</p>}
                </div>

                {/* Archive / unarchive */}
                {showArchived ? (
                  <button onClick={e => { e.stopPropagation(); void handleUnarchive(q.id) }}
                    title="Restore from archive"
                    className="ml-2 p-1.5 rounded-lg transition-colors flex-shrink-0"
                    style={{ color: S.muted, background: 'transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.background = S.input; e.currentTarget.style.color = S.accent }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}>
                    <ArchiveRestore size={14} />
                  </button>
                ) : ARCHIVABLE_STATUSES.includes(q.status) ? (
                  confirmArchive === q.id ? (
                    <div className="ml-2 flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => void handleArchive(q.id)}
                        className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                        style={{ background: '#FEE2E2', color: '#DC2626' }}>
                        Confirm
                      </button>
                      <button onClick={() => setConfirmArchive(null)}
                        className="text-[10px] px-2 py-1 rounded-lg"
                        style={{ color: S.muted }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); setConfirmArchive(q.id) }}
                      title="Archive quote"
                      className="ml-2 p-1.5 rounded-lg transition-colors flex-shrink-0"
                      style={{ color: S.muted, background: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.background = S.input; e.currentTarget.style.color = '#DC2626' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}>
                      <Archive size={14} />
                    </button>
                  )
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
