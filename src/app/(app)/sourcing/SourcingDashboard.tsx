'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Archive, ArchiveRestore, Trash2, Loader2 } from 'lucide-react'

interface Session {
  id: string
  title: string
  status: string
  archived: boolean
  created_at: string
  project_name: string | null
  item_count: number
  supplier_count: number
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
  const [archiving, setArchiving] = useState<string | null>(null)
  const [unarchiving, setUnarchiving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const comboRef = useRef<HTMLDivElement>(null)

  const active   = sessions.filter(s => !s.archived)
  const archived = sessions.filter(s => s.archived)
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
    setArchiving(id)
    try {
      await fetch(`/api/sourcing/sessions/${id}/archive`, { method: 'POST' })
      startTransition(() => router.refresh())
    } finally {
      setArchiving(null)
    }
  }

  async function handleUnarchive(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setUnarchiving(id)
    try {
      await fetch(`/api/sourcing/sessions/${id}/archive`, { method: 'DELETE' })
      startTransition(() => router.refresh())
    } finally {
      setUnarchiving(null)
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!window.confirm('Permanently delete this price request? This cannot be undone.')) return
    setDeleting(id)
    try {
      await fetch(`/api/sourcing/sessions/${id}`, { method: 'DELETE' })
      startTransition(() => router.refresh())
    } finally {
      setDeleting(null)
    }
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
                    <p className="font-semibold text-sm text-[#2C2C2A] truncate">{s.title}</p>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#8A877F]">
                    {s.project_name ? `${s.project_name} · ` : ''}
                    {s.item_count} item{s.item_count !== 1 ? 's' : ''} · {s.supplier_count} supplier{s.supplier_count !== 1 ? 's' : ''} · {formatDate(s.created_at)}
                  </p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {tab === 'active' ? (
                    <button
                      onClick={e => handleArchive(e, s.id)}
                      disabled={archiving === s.id}
                      title="Archive"
                      className="p-2 text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#F5F2EC] rounded-lg transition-colors"
                    >
                      {archiving === s.id ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => handleUnarchive(e, s.id)}
                        disabled={unarchiving === s.id}
                        title="Unarchive"
                        className="p-2 text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#F5F2EC] rounded-lg transition-colors"
                      >
                        {unarchiving === s.id ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
                      </button>
                      <button
                        onClick={e => handleDelete(e, s.id)}
                        disabled={deleting === s.id}
                        title="Delete permanently"
                        className="p-2 text-[#8A877F] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        {deleting === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
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
