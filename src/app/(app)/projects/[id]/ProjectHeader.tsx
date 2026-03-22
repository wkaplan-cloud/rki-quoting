'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Select } from '@/components/ui/Select'
import type { Project, ProjectStatus } from '@/lib/types'
import toast from 'react-hot-toast'
import { Pencil, Check, X } from 'lucide-react'

interface Props {
  project: Project & { client: { client_name: string; company: string | null } | null }
  clients: { id: string; client_name: string; company: string | null }[]
  onStatusChange: (status: ProjectStatus) => void
  onProjectUpdate: (p: any) => void
}

export function ProjectHeader({ project, clients, onStatusChange, onProjectUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    project_name: project.project_name,
    project_number: project.project_number,
    client_id: project.client_id ?? '',
    date: project.date,
    notes: project.notes ?? '',
  })
  const supabase = createClient()

  async function save() {
    const { error } = await supabase.from('projects').update({
      ...form,
      client_id: form.client_id || null,
    }).eq('id', project.id)
    if (error) { toast.error(error.message); return }
    onProjectUpdate({ ...project, ...form, client_id: form.client_id || null })
    toast.success('Project updated')
    setEditing(false)
  }

  function cancel() {
    setForm({ project_name: project.project_name, project_number: project.project_number, client_id: project.client_id ?? '', date: project.date, notes: project.notes ?? '' })
    setEditing(false)
  }

  return (
    <div className="px-8 py-5 border-b border-[#D8D3C8] bg-[#F5F2EC]">
      <div className="flex items-start justify-between gap-4">
        {editing ? (
          <div className="flex-1 grid grid-cols-2 gap-3">
            <input value={form.project_name} onChange={e => setForm(f => ({...f, project_name: e.target.value}))}
              className="px-3 py-1.5 border border-[#9A7B4F] rounded text-lg font-serif text-[#1A1A18] outline-none bg-white col-span-2" />
            <input value={form.project_number} onChange={e => setForm(f => ({...f, project_number: e.target.value}))}
              className="px-3 py-1.5 border border-[#D8D3C8] rounded text-sm outline-none bg-white" placeholder="Project #" />
            <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
              className="px-3 py-1.5 border border-[#D8D3C8] rounded text-sm outline-none bg-white" />
            <select value={form.client_id} onChange={e => setForm(f => ({...f, client_id: e.target.value}))}
              className="px-3 py-1.5 border border-[#D8D3C8] rounded text-sm outline-none bg-white col-span-2">
              <option value="">— No client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
            </select>
          </div>
        ) : (
          <div className="flex-1">
            <h1 className="font-serif text-2xl text-[#1A1A18] font-medium">{project.project_name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-[#8A877F]">
              <span className="font-mono">{project.project_number}</span>
              {project.client && <><span>·</span><span>{project.client.client_name}</span></>}
              <span>·</span>
              <span>{new Date(project.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={save} className="p-1.5 rounded bg-[#9A7B4F] text-white hover:bg-[#7d6340] transition-colors cursor-pointer"><Check size={14} /></button>
              <button onClick={cancel} className="p-1.5 rounded bg-white border border-[#D8D3C8] text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"><X size={14} /></button>
            </>
          ) : (
            <>
              <Select
                value={project.status}
                onChange={e => onStatusChange(e.target.value as ProjectStatus)}
                className="text-xs py-1.5 !w-auto"
              >
                <option>Quote</option>
                <option>Invoice</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </Select>
              <button onClick={() => setEditing(true)} className="p-1.5 rounded border border-[#D8D3C8] text-[#8A877F] hover:border-[#2C2C2A] hover:text-[#2C2C2A] transition-colors cursor-pointer">
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
