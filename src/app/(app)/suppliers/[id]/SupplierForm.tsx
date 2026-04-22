'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import type { Supplier } from '@/lib/types'
import { Globe, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { WORK_CATEGORIES } from '@/lib/categories'

const toTitleCase = (s: string) => s.trim().replace(/\b\w/g, c => c.toUpperCase())

function SpecialityPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (s: string) => onChange(value.includes(s) ? value.filter(x => x !== s) : [...value, s])
  return (
    <div className="flex flex-wrap gap-1.5">
      {WORK_CATEGORIES.map(s => (
        <button
          key={s}
          type="button"
          onClick={() => toggle(s)}
          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
            value.includes(s)
              ? 'bg-[#9A7B4F] text-white border-[#9A7B4F]'
              : 'bg-white text-[#8A877F] border-[#D8D3C8] hover:border-[#9A7B4F] hover:text-[#9A7B4F]'
          }`}
        >
          {s}
          {value.includes(s) && <X size={10} className="inline ml-1 -mt-px" />}
        </button>
      ))}
    </div>
  )
}

interface PlatformContact {
  id: string
  supplier_id: string
  org_id: string
  email: string | null
  email_cc: string | null
  rep_name: string | null
  rep_number: string | null
  markup_percentage: number | null
}

export function SupplierForm({ supplier, platformContact }: { supplier: Supplier | null; platformContact: PlatformContact | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  // Platform supplier — only the org contact fields are editable
  const [contact, setContact] = useState({
    email: platformContact?.email ?? '',
    email_cc: platformContact?.email_cc ?? '',
    rep_name: platformContact?.rep_name ?? '',
    rep_number: platformContact?.rep_number ?? '',
    markup_percentage: String(platformContact?.markup_percentage ?? supplier?.markup_percentage ?? 0),
  })
  const setC = (k: string, v: string) => setContact(f => ({ ...f, [k]: v }))

  async function savePlatformContact(e: React.FormEvent) {
    e.preventDefault()
    if (!supplier) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!user || !orgId) { toast.error('Session error'); setSaving(false); return }

    const payload = { org_id: orgId, supplier_id: supplier.id, ...contact, markup_percentage: parseFloat(contact.markup_percentage) || null }
    const { error } = platformContact
      ? await supabase.from('platform_supplier_contacts').update(payload).eq('id', platformContact.id)
      : await supabase.from('platform_supplier_contacts').insert(payload)

    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Contact saved')
    router.refresh()
    setSaving(false)
  }

  // Regular supplier form state
  const [form, setForm] = useState({
    supplier_name: supplier?.supplier_name ?? '',
    category: supplier?.category ?? '',
    contact_person: supplier?.contact_person ?? '',
    rep_name: supplier?.rep_name ?? '',
    email: supplier?.email ?? '',
    email_cc: supplier?.email_cc ?? '',
    delivery_address: supplier?.delivery_address ?? '',
    markup_percentage: String(supplier?.markup_percentage ?? 0),
    notes: (supplier as any)?.notes ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const [specialities, setSpecialities] = useState<string[]>(() => {
    const raw = supplier?.category ?? ''
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : raw ? [raw] : [] }
    catch { return raw ? [raw] : [] }
  })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      supplier_name: toTitleCase(form.supplier_name),
      markup_percentage: parseFloat(form.markup_percentage) || 0,
      category: JSON.stringify(specialities),
    }
    if (supplier) {
      const { error } = await supabase.from('suppliers').update(payload).eq('id', supplier.id)
      if (error) { toast.error(error.code === '23505' ? 'A supplier with this name already exists' : error.message); setSaving(false); return }
      toast.success('Supplier saved')
      router.refresh()
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: orgId } = await supabase.rpc('get_current_org_id')
      const { data, error } = await supabase.from('suppliers').insert({ ...payload, user_id: user!.id, org_id: orgId }).select().single()
      if (error) { toast.error(error.code === '23505' ? 'A supplier with this name already exists' : error.message); setSaving(false); return }
      toast.success('Supplier created')
      router.push(`/suppliers/${data.id}`)
    }
    setSaving(false)
  }

  async function deleteSupplier() {
    if (!supplier) return
    if (!confirm('Delete this supplier?')) return
    await supabase.from('suppliers').delete().eq('id', supplier.id)
    router.push('/suppliers')
  }

  // ── Platform supplier view ──────────────────────────────────────────
  if (supplier?.is_platform) {
    return (
      <div className="space-y-6">
        {/* Read-only platform info */}
        <div className="bg-[#9A7B4F]/8 border border-[#9A7B4F]/30 rounded p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-[#9A7B4F]" />
            <span className="text-xs font-medium text-[#9A7B4F] uppercase tracking-wider">Platform Supplier</span>
          </div>
          <p className="text-sm text-[#8A877F]">
            This supplier is managed by QuotingHub and is shared across all studios. The price list and supplier details are platform-wide — only your studio's rep contact details can be edited below.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[#8A877F] text-xs uppercase tracking-wider">Supplier</span>
              <p className="font-medium text-[#2C2C2A] mt-0.5">{supplier.supplier_name}</p>
            </div>
            {supplier.category && (
              <div>
                <span className="text-[#8A877F] text-xs uppercase tracking-wider">Category</span>
                <p className="font-medium text-[#2C2C2A] mt-0.5">{supplier.category}</p>
              </div>
            )}
          </div>
        </div>

        {/* Editable org contact */}
        <form onSubmit={savePlatformContact} className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-[#2C2C2A] mb-1">Your Studio's Settings</h3>
            <p className="text-xs text-[#8A877F]">These details are specific to your studio and will be used when sending purchase orders to {supplier.supplier_name}.</p>
          </div>
          <div className="bg-[#9A7B4F]/8 border border-[#9A7B4F]/30 rounded p-4">
            <label className="text-xs font-medium text-[#9A7B4F] uppercase tracking-wider block mb-2">Default Markup %</label>
            <div className="flex items-center gap-2">
              <input
                type="text" inputMode="decimal"
                value={contact.markup_percentage}
                onChange={e => setC('markup_percentage', e.target.value.replace(',', '.'))}
                className="w-28 px-3 py-2 bg-white border border-[#D8D3C8] rounded text-xl font-semibold text-[#9A7B4F] text-center outline-none focus:border-[#9A7B4F]"
              />
              <span className="text-[#8A877F] text-sm">% — auto-fills into new line items</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Rep Name" placeholder="Your dedicated sales rep" value={contact.rep_name} onChange={e => setC('rep_name', e.target.value)} />
            <Input label="Rep Number" value={contact.rep_number} onChange={e => setC('rep_number', e.target.value)} />
          </div>
          <p className="text-xs text-[#8A877F] -mt-2">The rep name is used to address purchase orders. The rep email is where POs are sent.</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Rep Email (PO recipient)" type="email" value={contact.email} onChange={e => setC('email', e.target.value)} />
            <Input label="CC Email (PO copies)" type="email" value={contact.email_cc} onChange={e => setC('email_cc', e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Contact'}</Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </div>
    )
  }

  // ── Regular supplier form ───────────────────────────────────────────
  return (
    <form onSubmit={save} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — identity */}
        <div className="bg-white rounded-xl border border-[#EDE9E1] p-6 space-y-5">
          <h3 className="text-sm font-semibold text-[#2C2C2A]">Supplier Details</h3>

          <div className="bg-[#9A7B4F]/8 border border-[#9A7B4F]/30 rounded p-4">
            <label className="text-xs font-medium text-[#9A7B4F] uppercase tracking-wider block mb-2">Default Markup %</label>
            <div className="flex items-center gap-2">
              <input
                type="text" inputMode="decimal"
                value={form.markup_percentage}
                onChange={e => set('markup_percentage', e.target.value)}
                className="w-28 px-3 py-2 bg-white border border-[#D8D3C8] rounded text-xl font-semibold text-[#9A7B4F] text-center outline-none focus:border-[#9A7B4F]"
              />
              <span className="text-[#8A877F] text-sm">% — auto-fills into new line items</span>
            </div>
          </div>

          <Input label="Supplier Name" value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} required />

          <div>
            <label className="text-xs font-medium text-[#8A877F] block mb-2">Specialities</label>
            <SpecialityPicker value={specialities} onChange={setSpecialities} />
          </div>
        </div>

        {/* Right — contacts */}
        <div className="bg-white rounded-xl border border-[#EDE9E1] p-6 space-y-5">
          <h3 className="text-sm font-semibold text-[#2C2C2A]">Contact &amp; Ordering</h3>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Accounts Contact" placeholder="Head office / accounts" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
            <Input label="Rep Name" placeholder="Your dedicated sales rep" value={form.rep_name} onChange={e => set('rep_name', e.target.value)} />
          </div>
          <p className="text-xs text-[#8A877F] -mt-2">Rep name is used to address purchase orders. Rep email is where POs are sent.</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Rep Email (PO recipient)" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            <Input label="CC Email (PO copies)" type="email" value={form.email_cc} onChange={e => set('email_cc', e.target.value)} />
          </div>
          <Textarea label="Delivery Address" value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} rows={2} />
          <Textarea label="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : supplier ? 'Save Changes' : 'Create Supplier'}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        {supplier && <Button type="button" variant="danger" onClick={deleteSupplier} className="ml-auto">Delete</Button>}
      </div>
    </form>
  )
}
