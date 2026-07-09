'use client'
import { useState, useEffect } from 'react'
import { todaySA } from '@/lib/dates'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getNextProjectNumber } from '@/lib/projectNumber'
import { Input } from '@/components/ui/Input'
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
    design_fee: '0',
  })

  useEffect(() => {
    async function loadNextNumber() {
      const next = await getNextProjectNumber(supabase)
      if (!next) return
      setForm(f => ({ ...f, project_number: next }))
    }
    loadNextNumber()
  }, [])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleCreateClient(name: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    const { data, error } = await supabase.from('clients').insert({
      user_id: user!.id,
      org_id: orgId,
      client_name: name,
    }).select().single()
    if (error) { toast.error('Failed to create client'); return }
    toast.success(`Client "${name}" created`)
    setClientId(data.id)
    setClientName(name)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    const { data, error } = await supabase.from('projects').insert({
      ...form,
      user_id: user!.id,
      org_id: orgId,
      client_id: clientId || null,
      date: todaySA(),
      status: 'Draft',
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
          required
        />
        <Input
          label="Project Name"
          value={form.project_name}
          onChange={e => set('project_name', e.target.value)}
          required
        />
      </div>

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

      <Input
        label="Design Fee (%)"
        type="number"
        min="0"
        step="0.01"
        value={form.design_fee}
        onChange={e => set('design_fee', e.target.value)}
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
