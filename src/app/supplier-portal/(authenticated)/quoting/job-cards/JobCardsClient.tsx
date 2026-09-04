'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Briefcase, MapPin, Clock, User, Search, ChevronRight, X, CheckSquare, Square, Send, CheckCircle2 } from 'lucide-react'
import type { ElecJobCard, ElecJobCardType, ElecStaff, ElecClient } from '@/lib/elec-types'
import { ClientCombobox } from '../ClientCombobox'
import { StaffMultiSelect } from '../StaffMultiSelect'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

function fmtSentAt(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:     { bg: 'rgba(217,164,65,0.1)',  color: S.gold,    label: 'Pending' },
  in_progress: { bg: 'rgba(58,124,165,0.1)',  color: S.accent,  label: 'In Progress' },
  completed:   { bg: 'rgba(22,163,74,0.1)',   color: S.green,   label: 'Completed' },
  cancelled:   { bg: 'rgba(113,113,122,0.1)', color: S.muted,   label: 'Cancelled' },
}

const TYPE_LABEL: Record<string, string> = {
  maintenance: 'Maintenance', repair: 'Repair', once_off: 'Once-Off', callout: 'Callout', coc: 'C.O.C',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  initialJobCards: ElecJobCard[]
  staff: ElecStaff[]
  clients: ElecClient[]
  portalAccountId: string
}

const EMPTY_FORM = {
  title: '', job_type: 'callout' as ElecJobCardType, staff_id: '', staff_ids: [] as string[], client_id: '',
  client_display_name: '',
  location: '', scheduled_at: '', work_description: '',
}

export function JobCardsClient({ initialJobCards, staff, clients: initialClients, portalAccountId }: Props) {
  const router = useRouter()
  const [jobCards, setJobCards] = useState<ElecJobCard[]>(initialJobCards)
  const [clients, setClients] = useState<ElecClient[]>(initialClients)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filtered = jobCards.filter(j => {
    const clientObj = !Array.isArray(j.client) ? j.client : null
    const matchSearch = !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.job_number.toLowerCase().includes(search.toLowerCase()) ||
      (j.location ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (clientObj?.client_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all'
      || (filterStatus === 'not_invoiced' ? j.status === 'completed' && !j.invoiced : j.status === filterStatus)
    const matchType = filterType === 'all' || j.job_type === filterType
    return matchSearch && matchStatus && matchType
  })

  async function toggleInvoiced(id: string, current: boolean, e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    const next = !current
    setJobCards(prev => prev.map(j => j.id === id ? { ...j, invoiced: next } : j))
    await fetch(`/api/supplier-portal/quoting/job-cards/${id}/invoiced`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiced: next }),
    })
  }

  async function handleCreate() {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        job_type: form.job_type,
        staff_id: form.staff_ids[0] ?? null,
        additional_staff_ids: form.staff_ids.slice(1),
        client_id: form.client_id || null,
        location: form.location || null,
        scheduled_at: form.scheduled_at || null,
        work_description: form.work_description || null,
      }
      if (form.client_id) {
        body.client_name = form.client_display_name || null
        const c = clients.find(cl => cl.id === form.client_id)
        if (c) body.client_email = c.email ?? null
      }
      const res = await fetch('/api/supplier-portal/quoting/job-cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const created = await res.json() as ElecJobCard
      setJobCards(prev => [created, ...prev])
      setShowCreate(false)
      setForm(EMPTY_FORM)
      router.push(`/supplier-portal/quoting/job-cards/${created.id}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  const counts = { all: jobCards.length, pending: 0, in_progress: 0, completed: 0, not_invoiced: 0 }
  jobCards.forEach(j => {
    if (j.status in counts) (counts as Record<string, number>)[j.status]++
    if (j.status === 'completed' && !j.invoiced) counts.not_invoiced++
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: S.text }}>Job Cards</h1>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>{jobCards.length} total</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: S.accent }}>
          <Plus size={15} /> New Job Card
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['all', 'pending', 'in_progress', 'completed', 'not_invoiced'] as const).map(s => (
          <button key={s}
            onClick={() => setFilterStatus(s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{
              background: filterStatus === s ? S.accent : S.card,
              color: filterStatus === s ? '#fff' : S.muted,
              border: `1px solid ${filterStatus === s ? S.accent : S.border}`,
            }}>
            {s === 'all' ? 'All' : s === 'not_invoiced' ? 'Not Invoiced' : STATUS_STYLE[s]?.label}
            <span className="text-[10px] opacity-70">{counts[s as keyof typeof counts]}</span>
          </button>
        ))}
      </div>

      {/* Search + filter row */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, number, client, or location…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }} />
        </div>
        <select
          value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }}>
          <option value="all">All types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 && (
        <div className="rounded-2xl py-16 flex flex-col items-center gap-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <Briefcase size={32} style={{ color: S.border }} />
          <p className="text-sm" style={{ color: S.muted }}>No job cards yet</p>
          <p className="text-xs" style={{ color: S.muted }}>Create a job card for a callout, repair, or maintenance visit.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {filtered.map((j, i) => {
            const ss = STATUS_STYLE[j.status] ?? STATUS_STYLE.pending
            const staffMember = !Array.isArray(j.staff) ? j.staff : null
            const client = !Array.isArray(j.client) ? j.client : null
            return (
              <button key={j.id}
                onClick={() => router.push(`/supplier-portal/quoting/job-cards/${j.id}`)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: ss.bg }}>
                  <Briefcase size={15} style={{ color: ss.color }} />
                </div>
                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono" style={{ color: S.muted }}>{j.job_number}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: S.bg, color: S.muted }}>{TYPE_LABEL[j.job_type]}</span>
                  </div>
                  <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{j.title}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {j.location && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: S.muted }}>
                        <MapPin size={10} />{j.location}
                      </span>
                    )}
                    {(j.created_by_name ?? staffMember?.name) && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: S.muted }}>
                        <User size={10} />{j.created_by_name ?? staffMember?.name}
                      </span>
                    )}
                    {client && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: S.muted }}>
                        {client.client_name}
                      </span>
                    )}
                    {j.sent_at && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: S.green }}>
                        <Send size={10} />Sent {fmtSentAt(j.sent_at)}
                      </span>
                    )}
                    {j.client_signature_url && (
                      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: S.green }}>
                        <CheckCircle2 size={10} />Client approved
                      </span>
                    )}
                  </div>
                </div>
                {/* Invoiced checkbox — completed only */}
                {j.status === 'completed' && (
                  <button
                    onClick={e => void toggleInvoiced(j.id, !!j.invoiced, e)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                    style={{
                      background: j.invoiced ? 'rgba(22,163,74,0.1)' : S.bg,
                      border: `1.5px solid ${j.invoiced ? 'rgba(22,163,74,0.4)' : S.border}`,
                      color: j.invoiced ? S.green : S.muted,
                    }}>
                    {j.invoiced
                      ? <CheckSquare size={13} style={{ color: S.green }} />
                      : <Square size={13} />}
                    Invoiced
                  </button>
                )}
                {/* Date + arrow */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs" style={{ color: S.muted }}>
                      {j.scheduled_at ? fmtDate(j.scheduled_at) : fmtDate(j.created_at)}
                    </p>
                    <p className="text-[10px] flex items-center justify-end gap-1 mt-0.5" style={{ color: S.muted }}>
                      <Clock size={9} />{j.scheduled_at ? 'Target' : 'Created'}
                    </p>
                  </div>
                  <ChevronRight size={16} style={{ color: S.muted }} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: S.card, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold" style={{ color: S.text }}>New Job Card</h2>
              <button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setError('') }}
                style={{ color: S.muted }}><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. DB board fault — Unit 4"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${S.border}`, color: S.text }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Job Type</label>
                  <select value={form.job_type} onChange={e => setForm(f => ({ ...f, job_type: e.target.value as ElecJobCardType }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ border: `1px solid ${S.border}`, color: S.text }}>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Technicians</label>
                  <StaffMultiSelect
                    selectedIds={form.staff_ids}
                    staff={staff}
                    onChange={ids => setForm(f => ({ ...f, staff_ids: ids }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Client</label>
                <ClientCombobox
                  clientId={form.client_id || null}
                  displayName={form.client_display_name}
                  clients={clients}
                  portalAccountId={portalAccountId}
                  onChange={(id, name) => setForm(f => ({ ...f, client_id: id ?? '', client_display_name: name }))}
                  onNewClient={c => setClients(prev => [...prev, { ...c, portal_account_id: portalAccountId, email: null, contact_number: null, vat_number: null, address: null, payment_terms_days: null, notes: null, qs_name: null, qs_email: null, created_at: new Date().toISOString() }].sort((a, b) => a.client_name.localeCompare(b.client_name)))}
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Target Date & Time</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ border: `1px solid ${S.border}`, color: S.text }} />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Location / Address</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Site address or description"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${S.border}`, color: S.text }} />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>Work Description</label>
                <textarea value={form.work_description} onChange={e => setForm(f => ({ ...f, work_description: e.target.value }))}
                  placeholder="What needs to be done…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ border: `1px solid ${S.border}`, color: S.text }} />
              </div>
            </div>

            {error && <p className="mt-3 text-xs" style={{ color: S.danger }}>{error}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setError('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                {saving ? 'Creating…' : 'Create Job Card'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
