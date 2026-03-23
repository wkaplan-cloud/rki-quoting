'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Client, Project } from '@/lib/types'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Props {
  client: Client | null
  projects: Pick<Project, 'id' | 'project_name' | 'project_number' | 'status' | 'date'>[]
}

export function ClientForm({ client, projects }: Props) {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    client_name: client?.client_name ?? '',
    company: client?.company ?? '',
    vat_number: client?.vat_number ?? '',
    contact_number: client?.contact_number ?? '',
    address: client?.address ?? '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (client) {
      const { error } = await supabase.from('clients').update(form).eq('id', client.id)
      if (error) { toast.error(error.code === '23505' ? 'A client with this name already exists' : error.message); setSaving(false); return }
      toast.success('Client saved')
      router.refresh()
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: orgId } = await supabase.rpc('get_current_org_id')
      const { data, error } = await supabase.from('clients').insert({ ...form, user_id: user!.id, org_id: orgId }).select().single()
      if (error) { toast.error(error.code === '23505' ? 'A client with this name already exists' : error.message); setSaving(false); return }
      toast.success('Client created')
      router.push(`/clients/${data.id}`)
    }
    setSaving(false)
  }

  async function deleteClient() {
    if (!client) return
    if (!confirm('Delete this client? This cannot be undone.')) return
    await supabase.from('clients').delete().eq('id', client.id)
    toast.success('Client deleted')
    router.push('/clients')
  }

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Client Name" value={form.client_name} onChange={e => set('client_name', e.target.value)} required />
          <Input label="Company" value={form.company} onChange={e => set('company', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="VAT Number" value={form.vat_number} onChange={e => set('vat_number', e.target.value)} />
          <Input label="Contact Number" value={form.contact_number} onChange={e => set('contact_number', e.target.value)} />
        </div>
        <Textarea label="Address" value={form.address} onChange={e => set('address', e.target.value)} rows={2} />
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : client ? 'Save Changes' : 'Create Client'}</Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          {client && <Button type="button" variant="danger" onClick={deleteClient} className="ml-auto">Delete</Button>}
        </div>
      </form>

      {client && projects.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3">Projects</h3>
          <div className="space-y-1.5">
            {projects.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between px-3 py-2 bg-white border border-[#D8D3C8] rounded hover:border-[#9A7B4F] transition-colors">
                <span className="text-sm text-[#2C2C2A] font-medium">{p.project_name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#8A877F] font-mono">{p.project_number}</span>
                  <StatusBadge status={p.status as any} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
