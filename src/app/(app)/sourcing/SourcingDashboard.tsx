'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Archive, ArchiveRestore, Loader2, Trash2 } from 'lucide-react'

interface Session {
  id: string
  title: string
  status: string
  archived: boolean
  created_at: string
  project_name: string | null
  item_count: number
  supplier_count: number
  request_number: number | null
  creator_name: string | null
  new_response_count: number
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:       { label: 'Draft',       color: 'bg-[#F5F2EC] text-[#8A877F] border border-[#D4CFC7]' },
  sent:        { label: 'Sent',        color: 'bg-blue-50 text-blue-600 border border-blue-200' },
  in_progress: { label: 'In Progress', color: 'bg-amber-50 text-amber-600 border border-amber-200' },
  completed:   { label: 'Completed',   color: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  archived:    { label: 'Archived',    color: 'bg-[#F5F2EC] text-[#8A877F] border border-[#D4CFC7]' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SourcingDashboard({ sessions, clients }: { sessions: Session[]; clients: { id: string; client_name: string }[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [showNewForm, setShowNewForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newRef, setNewRef] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [localSessions, setLocalSessions] = useState(sessions)
  const comboRef = useRef<HTMLDivElement>(null)

  // Sync local state when server re-renders after router.refresh()
  useEffect(() => { setLocalSessions(sessions) }, [sessions])

  // Force a fresh server fetch on every mount so the new-responses pill is always accurate
  useEffect(() => { router.refresh() }, [])

  const active   = localSessions.filter(s => !s.archived)
  const archived = localSessions.filter(s => s.archived)
  const displayed = tab === 'active' ? active : archived

  const filteredClients = newRef.trim() === ''
    ? clients
    : clients.filter(c => c.client_name.toLowerCase().includes(newRef.toLowerCase()))

  function pickClient(c: { id: string; client_name: string }) {
    setNewRef(c.client_name)
    setShowSuggestions(false)
  }

  function handleRefChange(v: string) {
    setNewRef(v)
    setShowSuggestions(true)
  }

  function resetForm() {
    setNewRef('')
    setShowSuggestions(false)
    setShowNewForm(false)
  }

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newRef.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/sourcing/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newRef.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      resetForm()
      startTransition(() => router.push(`/sourcing/${json.data.id}`))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleArchive(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setLocalSessions(prev => prev.map(s => s.id === id ? { ...s, archived: true } : s))
    const res = await fetch(`/api/sourcing/sessions/${id}/archive`, { method: 'POST' })
    if (!res.ok) {
      setLocalSessions(prev => prev.map(s => s.id === id ? { ...s, archived: false } : s))
    } else {
      startTransition(() => router.refresh())
    }
  }

  async function handleUnarchive(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setLocalSessions(prev => prev.map(s => s.id === id ? { ...s, archived: false } : s))
    const res = await fetch(`/api/sourcing/sessions/${id}/archive`, { method: 'DELETE' })
    if (!res.ok) {
      setLocalSessions(prev => prev.map(s => s.id === id ? { ...s, archived: true } : s))
    } else {
      startTransition(() => router.refresh())
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setDeleting(id)
    setConfirmDelete(null)
    setLocalSessions(prev => prev.filter(s => s.id !== id))
    const res = await fetch(`/api/sourcing/sessions/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const prev = sessions.find(s => s.id === id)
      if (prev) setLocalSessions(curr => [...curr, prev].sort((a, b) => b.created_at.localeCompare(a.created_at)))
    } else {
      startTransition(() => router.refresh())
    }
    setDeleting(null)
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* New session — button that expands into form */}
      {showNewForm ? (
        <form onSubmit={handleCreate} className="border border-[#C4A46B] rounded-xl p-4 space-y-3 bg-[#FEFDF9]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8A877F]">Client / Reference</p>

          {/* Combo input */}
          <div ref={comboRef} className="relative">
            <input
              value={newRef}
              onChange={e => handleRefChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="e.g. Smith Residence, QH-2024-01, Cape Town Apartment…"
              className="w-full px-3 py-2.5 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white"
              autoFocus
              autoComplete="off"
            />

            {/* Suggestions dropdown */}
            {showSuggestions && filteredClients.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-[#D4CFC7] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#A89F91]">Existing clients</p>
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => pickClient(c)}
                    className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] transition-colors"
                  >
                    {c.client_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newRef.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold rounded-lg hover:bg-[#3D3D3B] disabled:opacity-50 transition-colors"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold rounded-lg hover:bg-[#3D3D3B] transition-colors"
        >
          <Plus size={14} />
          New Price Request
        </button>
      )}

      {/* Tabs */}
      {archived.length > 0 && (
        <div className="flex gap-1 bg-[#EFECE5] p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab('active')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'active' ? 'bg-white text-[#2C2C2A] shadow-sm' : 'text-[#8A877F] hover:text-[#2C2C2A]'}`}
          >
            Active ({active.length})
          </button>
          <button
            onClick={() => setTab('archived')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'archived' ? 'bg-white text-[#2C2C2A] shadow-sm' : 'text-[#8A877F] hover:text-[#2C2C2A]'}`}
          >
            Archived ({archived.length})
          </button>
        </div>
      )}

      {/* Session list */}
      {displayed.length === 0 ? (
        <div className="bg-white border border-[#EDE9E1] rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-[#2C2C2A] mb-1">No price requests yet</p>
          <p className="text-xs text-[#8A877F]">Create a new price request to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(s => {
            const badge = STATUS_LABELS[s.status] ?? STATUS_LABELS.draft
            return (
              <div
                key={s.id}
                className="group bg-white border border-[#EDE9E1] rounded-xl px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-[#C4A46B] hover:shadow-sm transition-all"
                onClick={() => router.push(`/sourcing/${s.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {s.request_number != null && (
                      <span className="shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded text-[#9A7B4F] bg-[#F5F2EC] border border-[#D4CFC7]">
                        PR-{String(s.request_number).padStart(3, '0')}
                      </span>
                    )}
                    <p className="font-semibold text-sm text-[#2C2C2A] truncate">{s.title}</p>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                    {s.new_response_count > 0 && (
                      <span className="flex items-center gap-1 shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FFFBEB', color: '#92600A', border: '1px solid #FDE68A' }}>
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#F59E0B' }} />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#F59E0B' }} />
                        </span>
                        {s.new_response_count} new {s.new_response_count === 1 ? 'response' : 'responses'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8A877F]">
                    {s.project_name ? `${s.project_name} · ` : ''}
                    {s.item_count} item{s.item_count !== 1 ? 's' : ''} · {s.supplier_count} supplier{s.supplier_count !== 1 ? 's' : ''} · {formatDate(s.created_at)}
                    {s.creator_name ? ` · ${s.creator_name}` : ''}
                  </p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1">
                  {tab === 'active' ? (
                    <button
                      onClick={e => handleArchive(e, s.id)}
                      title="Archive"
                      className="p-2 text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#F5F2EC] rounded-lg transition-colors"
                    >
                      <Archive size={14} />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={e => handleUnarchive(e, s.id)}
                        title="Unarchive"
                        className="p-2 text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#F5F2EC] rounded-lg transition-colors"
                      >
                        <ArchiveRestore size={14} />
                      </button>
                      {confirmDelete === s.id ? (
                        <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <span className="text-xs text-[#C0392B] font-medium">Delete?</span>
                          <button
                            onClick={e => handleDelete(e, s.id)}
                            disabled={deleting === s.id}
                            className="px-2 py-0.5 text-xs font-semibold bg-[#C0392B] text-white rounded hover:bg-[#A93226] transition-colors disabled:opacity-50"
                          >
                            {deleting === s.id ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDelete(null) }}
                            className="px-2 py-0.5 text-xs font-semibold bg-[#F5F2EC] text-[#8A877F] rounded hover:bg-[#EDE9E1] transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDelete(s.id) }}
                          title="Delete permanently"
                          className="p-2 text-[#8A877F] hover:text-[#C0392B] hover:bg-[#FEF2F2] rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
