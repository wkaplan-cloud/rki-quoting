'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

interface Props {
  clients: { id: string; client_name: string; company: string | null }[]
}

export function NewProjectForm({ clients }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    project_number: '',
    project_name: '',
    client_id: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Quote',
    design_fee: '0',
    notes: '',
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('projects').insert({
      ...form,
      user_id: user!.id,
      client_id: form.client_id || null,
      design_fee: parseFloat(form.design_fee) || 0,
    }).select().single()

    if (error) {
      toast.error(error.message)
      setSaving(false)
    } else {
      toast.success('Project created')
      router.push(`/projects/${data.id}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Project Number"
          value={form.project_number}
          onChange={e => set('project_number', e.target.value)}
          placeholder="RKI-001"
          required
        />
        <Input
          label="Project Name"
          value={form.project_name}
          onChange={e => set('project_name', e.target.value)}
          placeholder="Smith Living Room"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select label="Client" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
          <option value="">— Select client —</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>
              {c.client_name}{c.company ? ` — ${c.company}` : ''}
            </option>
          ))}
        </Select>
        <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          <option>Quote</option>
          <option>Invoice</option>
          <option>Completed</option>
          <option>Cancelled</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Date"
          type="date"
          value={form.date}
          onChange={e => set('date', e.target.value)}
          required
        />
        <Input
          label="Design Fee (R)"
          type="number"
          min="0"
          step="0.01"
          value={form.design_fee}
          onChange={e => set('design_fee', e.target.value)}
        />
      </div>

      <Textarea
        label="Notes"
        value={form.notes}
        onChange={e => set('notes', e.target.value)}
        rows={3}
        placeholder="Any project notes…"
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Creating…' : 'Create Project'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
