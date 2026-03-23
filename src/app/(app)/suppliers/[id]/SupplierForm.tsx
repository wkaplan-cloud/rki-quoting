'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import type { Supplier } from '@/lib/types'
import toast from 'react-hot-toast'

export function SupplierForm({ supplier }: { supplier: Supplier | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    supplier_name: supplier?.supplier_name ?? '',
    category: supplier?.category ?? '',
    contact_person: supplier?.contact_person ?? '',
    contact_number: supplier?.contact_number ?? '',
    rep_name: supplier?.rep_name ?? '',
    rep_number: supplier?.rep_number ?? '',
    email: supplier?.email ?? '',
    delivery_address: supplier?.delivery_address ?? '',
    markup_percentage: String(supplier?.markup_percentage ?? 40),
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, markup_percentage: parseFloat(form.markup_percentage) || 40 }
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

  return (
    <form onSubmit={save} className="space-y-5">
      {/* Markup — prominent */}
      <div className="bg-[#9A7B4F]/8 border border-[#9A7B4F]/30 rounded p-4">
        <label className="text-xs font-medium text-[#9A7B4F] uppercase tracking-wider block mb-2">Default Markup %</label>
        <div className="flex items-center gap-2">
          <input
            type="number" min="0" step="0.1"
            value={form.markup_percentage}
            onChange={e => set('markup_percentage', e.target.value)}
            className="w-28 px-3 py-2 bg-white border border-[#D8D3C8] rounded text-xl font-semibold text-[#9A7B4F] text-center outline-none focus:border-[#9A7B4F]"
          />
          <span className="text-[#8A877F] text-sm">% — auto-fills into new line items</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Supplier Name" value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} required />
        <Input label="Category" value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Furniture, Lighting" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Contact Person" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
        <Input label="Contact Number" value={form.contact_number} onChange={e => set('contact_number', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Rep Name" value={form.rep_name} onChange={e => set('rep_name', e.target.value)} />
        <Input label="Rep Number" value={form.rep_number} onChange={e => set('rep_number', e.target.value)} />
      </div>
      <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
      <Textarea label="Delivery Address" value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} rows={2} />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : supplier ? 'Save Changes' : 'Create Supplier'}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        {supplier && <Button type="button" variant="danger" onClick={deleteSupplier} className="ml-auto">Delete</Button>}
      </div>
    </form>
  )
}
