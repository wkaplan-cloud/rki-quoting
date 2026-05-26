'use client'
import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, Loader2, UserCircle2, Phone, Mail, Power } from 'lucide-react'
import type { ElecStaff, ElecStaffRole } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

const ROLES: { value: ElecStaffRole; label: string }[] = [
  { value: 'electrician',   label: 'Electrician' },
  { value: 'apprentice',    label: 'Apprentice' },
  { value: 'site_foreman',  label: 'Site Foreman' },
  { value: 'helper',        label: 'Helper' },
  { value: 'admin',         label: 'Admin' },
]

const COLORS = [
  '#3A7CA5', '#16A34A', '#D9A441', '#DC2626',
  '#7C3AED', '#0891B2', '#EA580C', '#64748B',
]

function roleBg(role: ElecStaffRole) {
  const map: Record<ElecStaffRole, string> = {
    electrician:  'rgba(58,124,165,0.12)',
    apprentice:   'rgba(217,164,65,0.12)',
    site_foreman: 'rgba(22,163,74,0.12)',
    helper:       'rgba(100,116,139,0.12)',
    admin:        'rgba(124,58,237,0.12)',
  }
  return map[role] ?? S.bg
}
function roleColor(role: ElecStaffRole) {
  const map: Record<ElecStaffRole, string> = {
    electrician:  '#3A7CA5',
    apprentice:   '#D9A441',
    site_foreman: '#16A34A',
    helper:       '#64748B',
    admin:        '#7C3AED',
  }
  return map[role] ?? S.muted
}

interface FormState {
  name: string
  role: ElecStaffRole
  phone: string
  email: string
  color: string
}

const EMPTY_FORM: FormState = { name: '', role: 'electrician', phone: '', email: '', color: '#3A7CA5' }

export function StaffManager({ initialStaff }: { initialStaff: ElecStaff[] }) {
  const [staff, setStaff] = useState(initialStaff)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(s: ElecStaff) {
    setEditingId(s.id)
    setForm({ name: s.name, role: s.role, phone: s.phone ?? '', email: s.email ?? '', color: s.color })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return
    setSaving(true)
    const payload = { name: form.name.trim(), role: form.role, phone: form.phone.trim() || null, email: form.email.trim() || null, color: form.color }

    if (editingId) {
      const res = await fetch(`/api/supplier-portal/quoting/staff/${editingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const updated = await res.json() as ElecStaff
      setStaff(ss => ss.map(s => s.id === editingId ? updated : s))
    } else {
      const res = await fetch('/api/supplier-portal/quoting/staff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const created = await res.json() as ElecStaff
      setStaff(ss => [...ss, created])
    }
    setSaving(false)
    closeForm()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this team member?')) return
    setDeletingId(id)
    await fetch(`/api/supplier-portal/quoting/staff/${id}`, { method: 'DELETE' })
    setStaff(ss => ss.filter(s => s.id !== id))
    setDeletingId(null)
  }

  async function handleToggleActive(s: ElecStaff) {
    setTogglingId(s.id)
    const res = await fetch(`/api/supplier-portal/quoting/staff/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !s.is_active }),
    })
    const updated = await res.json() as ElecStaff
    setStaff(ss => ss.map(m => m.id === s.id ? updated : m))
    setTogglingId(null)
  }

  const active = staff.filter(s => s.is_active)
  const inactive = staff.filter(s => !s.is_active)

  return (
    <div className="max-w-3xl mx-auto pb-16">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: S.text }}>Team</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>
            {active.length} active member{active.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: S.accent }}>
          <Plus size={14} /> Add Member
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-2xl p-5 mb-5" style={{ background: S.card, border: `1.5px solid ${S.accent}` }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: S.text }}>
              {editingId ? 'Edit Member' : 'New Team Member'}
            </h2>
            <button onClick={closeForm} className="p-1.5 rounded-lg" style={{ color: S.muted }}
              onMouseEnter={e => e.currentTarget.style.background = S.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Full Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. John Dlamini"
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as ElecStaffRole }))}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. 082 555 1234"
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="e.g. john@example.com"
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: S.muted }}>Calendar Colour</label>
              <div className="flex items-center gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-transform"
                    style={{ background: c, transform: form.color === c ? 'scale(1.25)' : 'scale(1)', boxShadow: form.color === c ? `0 0 0 2px #fff, 0 0 0 3.5px ${c}` : 'none' }}>
                    {form.color === c && <Check size={12} color="#fff" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: S.bg, color: S.muted }}>
              Cancel
            </button>
            <button onClick={() => void handleSave()} disabled={!form.name.trim() || saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: S.accent }}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {staff.length === 0 && !showForm && (
        <div className="rounded-2xl py-16 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(58,124,165,0.1)' }}>
            <UserCircle2 size={22} style={{ color: S.accent }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: S.text }}>No team members yet</p>
          <p className="text-sm mb-5" style={{ color: S.muted }}>Add your electricians, apprentices, and other staff.</p>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white mx-auto"
            style={{ background: S.accent }}>
            <Plus size={13} /> Add First Member
          </button>
        </div>
      )}

      {/* Active staff */}
      {active.length > 0 && (
        <div className="space-y-2 mb-6">
          {active.map(s => (
            <StaffCard key={s.id} staff={s}
              onEdit={() => openEdit(s)}
              onDelete={() => void handleDelete(s.id)}
              onToggle={() => void handleToggleActive(s)}
              deleting={deletingId === s.id}
              toggling={togglingId === s.id}
            />
          ))}
        </div>
      )}

      {/* Inactive staff */}
      {inactive.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
            Inactive
          </p>
          <div className="space-y-2">
            {inactive.map(s => (
              <StaffCard key={s.id} staff={s}
                onEdit={() => openEdit(s)}
                onDelete={() => void handleDelete(s.id)}
                onToggle={() => void handleToggleActive(s)}
                deleting={deletingId === s.id}
                toggling={togglingId === s.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StaffCard({ staff: s, onEdit, onDelete, onToggle, deleting, toggling }: {
  staff: ElecStaff
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  deleting: boolean
  toggling: boolean
}) {
  const roleLabel = ROLES.find(r => r.value === s.role)?.label ?? s.role
  const inactive = !s.is_active

  return (
    <div className="rounded-2xl p-4 flex items-center gap-4"
      style={{ background: S.card, border: `1px solid ${S.border}`, opacity: inactive ? 0.55 : 1 }}>

      {/* Color avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
        style={{ background: s.color }}>
        {s.name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm" style={{ color: S.text }}>{s.name}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: roleBg(s.role), color: roleColor(s.role) }}>
            {roleLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {s.phone && (
            <span className="flex items-center gap-1 text-xs" style={{ color: S.muted }}>
              <Phone size={10} /> {s.phone}
            </span>
          )}
          {s.email && (
            <span className="flex items-center gap-1 text-xs" style={{ color: S.muted }}>
              <Mail size={10} /> {s.email}
            </span>
          )}
          {!s.phone && !s.email && (
            <span className="text-xs" style={{ color: S.muted }}>No contact details</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onToggle} disabled={toggling} title={s.is_active ? 'Deactivate' : 'Activate'}
          className="p-2 rounded-lg disabled:opacity-50 transition-colors"
          style={{ color: s.is_active ? S.muted : S.green }}
          onMouseEnter={e => e.currentTarget.style.background = S.bg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {toggling ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
        </button>
        <button onClick={onEdit}
          className="p-2 rounded-lg transition-colors" style={{ color: S.muted }}
          onMouseEnter={e => e.currentTarget.style.background = S.bg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} disabled={deleting}
          className="p-2 rounded-lg disabled:opacity-50 transition-colors" style={{ color: S.muted }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = S.danger }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}>
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  )
}
