'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, X, Phone, Mail, Building2, Pencil, Trash2, ChevronRight } from 'lucide-react'
import type { ElecClient } from '@/lib/elec-types'

const S = {
  bg:     '#F0F2F5',
  card:   '#FFFFFF',
  accent: '#3A7CA5',
  text:   '#18181B',
  muted:  '#71717A',
  border: '#E4E4E7',
  input:  '#F4F4F5',
  danger: '#DC2626',
}

interface Props {
  portalAccountId: string
  initialClients: ElecClient[]
}

const EMPTY: Partial<ElecClient> = {
  client_name: '', company: '', email: '', contact_number: '',
  vat_number: '', address: '', payment_terms_days: undefined, notes: '',
}

function Input({ label, value, onChange, placeholder, type = 'text', hint }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors"
        style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
        onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
        onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
      />
      {hint && <p className="text-xs mt-1" style={{ color: S.muted }}>{hint}</p>}
    </div>
  )
}

function Modal({ title, onClose, onSave, saving, error, form, setForm }: {
  title: string; onClose: () => void; onSave: () => void
  saving: boolean; error: string; form: Partial<ElecClient>
  setForm: (f: Partial<ElecClient>) => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: S.card, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
          <h2 className="font-bold text-base" style={{ color: S.text }}>{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-colors" style={{ color: S.muted }}
            onMouseEnter={e => e.currentTarget.style.background = S.input}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Client Name *" value={form.client_name ?? ''} onChange={v => setForm({ ...form, client_name: v })} placeholder="e.g. John Smith" />
            </div>
            <div className="col-span-2">
              <Input label="Company" value={form.company ?? ''} onChange={v => setForm({ ...form, company: v })} placeholder="e.g. Smith Properties (Pty) Ltd" />
            </div>
            <Input label="Email" type="email" value={form.email ?? ''} onChange={v => setForm({ ...form, email: v })} placeholder="john@example.com" />
            <Input label="Contact Number" value={form.contact_number ?? ''} onChange={v => setForm({ ...form, contact_number: v })} placeholder="011 123 4567" />
            <Input label="VAT Number" value={form.vat_number ?? ''} onChange={v => setForm({ ...form, vat_number: v })} placeholder="4123456789" />
            <Input
              label="Payment Terms (days)"
              type="number"
              value={form.payment_terms_days != null ? String(form.payment_terms_days) : ''}
              onChange={v => setForm({ ...form, payment_terms_days: v ? parseInt(v) : undefined })}
              placeholder="30"
              hint="Overrides your default setting"
            />
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Address</label>
              <textarea
                value={form.address ?? ''}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Physical or postal address"
                rows={2}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none resize-none transition-colors"
                style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
                onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
                onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Notes</label>
              <textarea
                value={form.notes ?? ''}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Any internal notes about this client"
                rows={2}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none resize-none transition-colors"
                style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
                onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
                onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
              />
            </div>
          </div>

          {error && (
            <p className="px-3 py-2 rounded-lg text-sm" style={{ background: '#FEF2F2', color: S.danger, border: '1px solid #FECACA' }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: `1px solid ${S.border}` }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg transition-colors" style={{ color: S.muted }}
            onMouseEnter={e => e.currentTarget.style.background = S.input}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.client_name?.trim()}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
            style={{ background: S.accent }}
          >
            {saving ? 'Saving…' : 'Save Client'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ClientsClient({ portalAccountId, initialClients }: Props) {
  const supabase = createClient()
  const [clients, setClients] = useState<ElecClient[]>(initialClients)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ElecClient | null>(null)
  const [form, setForm] = useState<Partial<ElecClient>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return (
      c.client_name.toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    )
  })

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setError('')
    setShowModal(true)
  }

  function openEdit(client: ElecClient) {
    setEditing(client)
    setForm({ ...client })
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY)
    setError('')
  }

  async function handleSave() {
    if (!form.client_name?.trim()) return
    setSaving(true)
    setError('')

    const payload = {
      portal_account_id: portalAccountId,
      client_name:       form.client_name.trim(),
      company:           form.company?.trim() || null,
      email:             form.email?.trim() || null,
      contact_number:    form.contact_number?.trim() || null,
      vat_number:        form.vat_number?.trim() || null,
      address:           form.address?.trim() || null,
      payment_terms_days: form.payment_terms_days ?? null,
      notes:             form.notes?.trim() || null,
    }

    if (editing) {
      const { data, error: err } = await supabase
        .from('elec_clients')
        .update(payload)
        .eq('id', editing.id)
        .select()
        .single()
      if (err) { setError(err.message); setSaving(false); return }
      setClients(cs => cs.map(c => c.id === editing.id ? data as ElecClient : c))
    } else {
      const { data, error: err } = await supabase
        .from('elec_clients')
        .insert(payload)
        .select()
        .single()
      if (err) { setError(err.message); setSaving(false); return }
      setClients(cs => [...cs, data as ElecClient].sort((a, b) => a.client_name.localeCompare(b.client_name)))
    }

    setSaving(false)
    closeModal()
  }

  async function handleDelete(client: ElecClient) {
    if (!confirm(`Delete ${client.client_name}? This cannot be undone.`)) return
    setDeleting(client.id)
    await supabase.from('elec_clients').delete().eq('id', client.id)
    setClients(cs => cs.filter(c => c.id !== client.id))
    setDeleting(null)
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: S.text }}>Clients</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity"
          style={{ background: S.accent }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Plus size={15} />
          Add Client
        </button>
      </div>

      {/* Search */}
      {clients.length > 0 && (
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, company or email…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
            style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }}
          />
        </div>
      )}

      {/* Empty state */}
      {clients.length === 0 && (
        <div className="rounded-2xl py-16 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <Building2 size={32} className="mx-auto mb-3" style={{ color: S.border }} />
          <p className="font-semibold mb-1" style={{ color: S.text }}>No clients yet</p>
          <p className="text-sm mb-5" style={{ color: S.muted }}>Add your first client to start creating quotes</p>
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: S.accent }}>
            <Plus size={14} /> Add Client
          </button>
        </div>
      )}

      {/* Client list */}
      {filtered.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {filtered.map((client, i) => (
            <div
              key={client.id}
              className="flex items-center gap-4 px-5 py-4 transition-colors"
              style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'rgba(58,124,165,0.1)', color: S.accent }}>
                {client.client_name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: S.text }}>{client.client_name}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {client.company && (
                    <span className="text-xs flex items-center gap-1" style={{ color: S.muted }}>
                      <Building2 size={11} />{client.company}
                    </span>
                  )}
                  {client.email && (
                    <span className="text-xs flex items-center gap-1" style={{ color: S.muted }}>
                      <Mail size={11} />{client.email}
                    </span>
                  )}
                  {client.contact_number && (
                    <span className="text-xs flex items-center gap-1" style={{ color: S.muted }}>
                      <Phone size={11} />{client.contact_number}
                    </span>
                  )}
                </div>
              </div>

              {/* Payment terms badge */}
              {client.payment_terms_days != null && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(58,124,165,0.08)', color: S.accent }}>
                  Net {client.payment_terms_days}
                </span>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(client)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: S.muted }}
                  onMouseEnter={e => { e.currentTarget.style.background = S.input; e.currentTarget.style.color = S.text }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(client)}
                  disabled={deleting === client.id}
                  className="p-2 rounded-lg transition-colors disabled:opacity-40"
                  style={{ color: S.muted }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = S.danger }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}
                >
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={14} style={{ color: S.border }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No search results */}
      {clients.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl py-10 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <p className="text-sm" style={{ color: S.muted }}>No clients match &ldquo;{search}&rdquo;</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal
          title={editing ? `Edit ${editing.client_name}` : 'Add Client'}
          onClose={closeModal}
          onSave={handleSave}
          saving={saving}
          error={error}
          form={form}
          setForm={setForm}
        />
      )}
    </div>
  )
}
