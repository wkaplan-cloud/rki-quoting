'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import toast from 'react-hot-toast'

interface Props {
  clients: { id: string; client_name: string; company: string | null }[]
}

export function NewProjectForm({ clients }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')

  const [form, setForm] = useState({
    project_number: '',
    project_name: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Quote',
    design_fee: '0',
    notes: '',
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleCreateClient(name: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('clients').insert({
      user_id: user!.id,
      client_name: name,
    }).select().single()
    if (error) { toast.error('Failed to create client'); return { id: '' } }
    toast.success(`Client "${name}" created`)
    return { id: data.id }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('projects').insert({
      ...form,
      user_id: user!.id,
      client_id: clientId || null,
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
        <Combobox
          label="Client"
          options={clients.map(c => ({
            id: c.id,
            label: c.client_name + (c.company ? ` — ${c.company}` : ''),
          }))}
          value={clientId}
          inputValue={clientName}
          onChange={(id, label) => { setClientId(id); setClientName(label) }}
          onCreate={handleCreateClient}
          placeholder="Type to search or create…"
        />
        <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="Quote">Quoting</option>
          <option value="Invoice">Invoiced</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
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
