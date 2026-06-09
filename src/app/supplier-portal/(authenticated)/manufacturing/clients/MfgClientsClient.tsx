'use client'
import { useState } from 'react'
import { Plus, X, Check, Archive, Pencil, User, Building2 } from 'lucide-react'
import type { MfgClient, MfgClientType } from '@/lib/mfg-types'

const S = { card: '#FFFFFF', accent: '#1B4F8A', text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5' }

const BLANK = (): Partial<MfgClient> => ({
  client_type: 'individual', client_name: '', contact_person: '', email: '',
  phone: '', address: '', vat_number: '', notes: '', referred_by: '',
})

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors"
      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
      onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
      onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
    />
  )
}

interface Props { initialClients: MfgClient[] }

export function MfgClientsClient({ initialClients }: Props) {
  const [clients, setClients]   = useState<MfgClient[]>(initialClients)
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft]       = useState<Partial<MfgClient>>(BLANK())
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)

  const filtered = clients.filter(c =>
    !search || c.client_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function startEdit(c: MfgClient) { setDraft({ ...c }); setEditingId(c.id); setShowForm(true) }
  function resetForm() { setDraft(BLANK()); setEditingId(null); setShowForm(false); setError('') }

  async function handleSave() {
    if (!draft.client_name?.trim()) { setError('Client name is required'); return }
    setSaving(true); setError('')
    const payload = {
      client_type: draft.client_type, client_name: draft.client_name.trim(),
      contact_person: draft.contact_person || null, email: draft.email || null,
      phone: draft.phone || null, address: draft.address || null,
      vat_number: draft.vat_number || null, notes: draft.notes || null,
      referred_by: draft.referred_by || null,
    }
    const url = editingId ? `/api/supplier-portal/manufacturing/clients/${editingId}` : '/api/supplier-portal/manufacturing/clients'
    const res = await fetch(url, { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as { error?: string }).error ?? 'Save failed'); return }
    const saved = await res.json()
    if (editingId) { setClients(prev => prev.map(c => c.id === editingId ? { ...c, ...payload } as MfgClient : c)) }
    else { setClients(prev => [...prev, saved as MfgClient]) }
    resetForm()
  }

  async function handleArchive(id: string) {
    const res = await fetch(`/api/supplier-portal/manufacturing/clients/${id}`, { method: 'DELETE' })
    if (res.ok) { setClients(prev => prev.filter(c => c.id !== id)); setConfirmArchiveId(null) }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
          className="flex-1 px-3.5 py-2 text-sm rounded-lg outline-none"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }} />
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90"
          style={{ background: S.accent }}>
          <Plus size={14} /> New Client
        </button>
      </div>

      {/* Client list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: S.muted }}>
          <p className="text-sm">{search ? 'No clients match your search.' : 'No clients yet. Add your first client.'}</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
          {filtered.map((client, idx) => (
            <div key={client.id} className="flex items-center gap-4 px-5 py-4 transition-colors"
              style={{ background: S.card, borderTop: idx > 0 ? `1px solid ${S.border}` : undefined }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = S.card)}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'rgba(27,79,138,0.1)', color: S.accent }}>
                {client.client_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{client.client_name}</p>
                <p className="text-xs truncate" style={{ color: S.muted }}>
                  {client.contact_person && `${client.contact_person} · `}
                  {client.email ?? client.phone ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); startEdit(client) }} className="p-1.5 rounded-lg transition-colors"
                  style={{ color: S.muted }}
                  onMouseEnter={e => (e.currentTarget.style.background = S.input)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <Pencil size={13} />
                </button>
                <button onClick={e => { e.stopPropagation(); setConfirmArchiveId(client.id) }} className="p-1.5 rounded-lg transition-colors"
                  style={{ color: S.muted }}
                  onMouseEnter={e => (e.currentTarget.style.background = S.input)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <Archive size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={resetForm}>
          <div className="rounded-2xl p-6 w-full max-w-lg shadow-2xl" style={{ background: S.card }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: S.text }}>{editingId ? 'Edit Client' : 'New Client'}</h3>
              <button onClick={resetForm} style={{ color: S.muted }}><X size={18} /></button>
            </div>

            {/* Type toggle */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Client Type</label>
              <div className="flex rounded-lg overflow-hidden w-fit" style={{ border: `1px solid ${S.border}` }}>
                {(['individual','company'] as MfgClientType[]).map(t => (
                  <button key={t} onClick={() => setDraft(d => ({ ...d, client_type: t }))}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors"
                    style={{ background: draft.client_type === t ? S.accent : S.card, color: draft.client_type === t ? '#fff' : S.muted }}>
                    {t === 'individual' ? <User size={12} /> : <Building2 size={12} />}
                    {t === 'individual' ? 'Individual' : 'Company'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>
                  {draft.client_type === 'company' ? 'Company Name' : 'Full Name'}
                </label>
                <Input value={draft.client_name ?? ''} onChange={v => setDraft(d => ({ ...d, client_name: v }))}
                  placeholder={draft.client_type === 'company' ? 'Smith Homes (Pty) Ltd' : 'John Smith'} />
              </div>
              {draft.client_type === 'company' && (
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Contact Person</label>
                  <Input value={draft.contact_person ?? ''} onChange={v => setDraft(d => ({ ...d, contact_person: v }))} placeholder="John Smith" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Email</label>
                <Input type="email" value={draft.email ?? ''} onChange={v => setDraft(d => ({ ...d, email: v }))} placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Phone</label>
                <Input value={draft.phone ?? ''} onChange={v => setDraft(d => ({ ...d, phone: v }))} placeholder="082 555 0123" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Address</label>
                <Input value={draft.address ?? ''} onChange={v => setDraft(d => ({ ...d, address: v }))} placeholder="123 Oak Avenue, Cape Town" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>VAT Number (optional)</label>
                <Input value={draft.vat_number ?? ''} onChange={v => setDraft(d => ({ ...d, vat_number: v }))} placeholder="4560123456" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Referred by (optional)</label>
                <Input value={draft.referred_by ?? ''} onChange={v => setDraft(d => ({ ...d, referred_by: v }))} placeholder="Previous client or source" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Notes (internal — never on PDF)</label>
                <Input value={draft.notes ?? ''} onChange={v => setDraft(d => ({ ...d, notes: v }))} placeholder="Prefers WhatsApp. Usually wants 2 revisions." />
              </div>
            </div>

            {error && <p className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                <Check size={14} /> {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Client'}
              </button>
              <button onClick={resetForm} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirm modal */}
      {confirmArchiveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setConfirmArchiveId(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ background: S.card }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-2" style={{ color: S.text }}>Archive client?</h3>
            <p className="text-sm mb-5" style={{ color: S.muted }}>This client will be hidden. Their quotes and invoices are preserved.</p>
            <div className="flex gap-3">
              <button onClick={() => handleArchive(confirmArchiveId)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#DC2626' }}>
                Archive
              </button>
              <button onClick={() => setConfirmArchiveId(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
