'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Project, ProjectStages, StageKey } from '@/lib/types'
import { STAGE_CONFIG } from '@/lib/types'
import toast from 'react-hot-toast'
import { Pencil, Check, X, Ban, Trash2 } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'

interface Props {
  project: Project & { client: { client_name: string; company: string | null } | null }
  clients: { id: string; client_name: string; company: string | null }[]
  stages: ProjectStages | null
  onProjectUpdate: (p: any) => void
  onStagesUpdate: (s: ProjectStages) => void
}

const EMPTY_STAGES: ProjectStages = {
  id: '', project_id: '',
  quote_sent: false, quote_sent_at: null,
  deposit_received: false, deposit_received_at: null,
  pos_sent: false, pos_sent_at: null,
  fabrics_received: false, fabrics_received_at: null,
  fabrics_sent: false, fabrics_sent_at: null,
  final_invoice_sent: false, final_invoice_sent_at: null,
  final_invoice_paid: false, final_invoice_paid_at: null,
  delivered_installed: false, delivered_installed_at: null,
}

export function ProjectHeader({ project, clients, stages, onProjectUpdate, onStagesUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [togglingStage, setTogglingStage] = useState<string | null>(null)
  const [form, setForm] = useState({
    project_name: project.project_name,
    project_number: project.project_number,
    client_id: project.client_id ?? '',
    date: project.date,
    notes: project.notes ?? '',
  })
  const [clientName, setClientName] = useState(project.client?.client_name ?? '')
  const supabase = createClient()

  async function handleCreateClient(name: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    const { data, error } = await supabase.from('clients').insert({ user_id: user!.id, org_id: orgId, client_name: name }).select().single()
    if (error) { toast.error('Failed to create client'); return { id: '' } }
    toast.success(`Client "${name}" created`)
    return { id: data.id }
  }

  async function saveClient(clientId: string, label: string) {
    const newClientId = clientId || null
    const { error } = await supabase.from('projects').update({ client_id: newClientId }).eq('id', project.id)
    if (error) { toast.error(error.message); return }
    onProjectUpdate({
      ...project,
      ...form,
      client_id: newClientId,
      client: newClientId ? { client_name: label.split(' — ')[0], company: label.includes(' — ') ? label.split(' — ')[1] : null } : null,
    })
    setEditing(false)
  }

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

  async function handleCancel() {
    if (!confirm('Cancel this project?')) return
    const { error } = await supabase.from('projects').update({ status: 'Cancelled' }).eq('id', project.id)
    if (error) { toast.error(error.message); return }
    onProjectUpdate({ ...project, status: 'Cancelled' })
    toast.success('Project cancelled')
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this project and all its line items? This cannot be undone.')) return
    await supabase.from('line_items').delete().eq('project_id', project.id)
    const { error } = await supabase.from('projects').delete().eq('id', project.id)
    if (error) { toast.error(error.message); return }
    window.location.href = '/projects'
  }

  async function toggleStage(key: StageKey, currentVal: boolean) {
    setTogglingStage(key)
    const now = new Date().toISOString()
    const stageCfg = STAGE_CONFIG.find(s => s.key === key)!
    const update = {
      [key]: !currentVal,
      [stageCfg.dateKey]: !currentVal ? now : null,
    }

    const { error } = await supabase
      .from('project_stages')
      .upsert({ project_id: project.id, ...update }, { onConflict: 'project_id' })

    if (error) { toast.error('Failed to update stage'); setTogglingStage(null); return }

    const newStages = { ...(stages ?? { ...EMPTY_STAGES, project_id: project.id }), ...update } as ProjectStages
    onStagesUpdate(newStages)

    // Auto-derive and save status (don't override Cancelled)
    if (project.status !== 'Cancelled') {
      const { statusFromStages } = await import('@/lib/types')
      const newStatus = statusFromStages(newStages)
      await supabase.from('projects').update({ status: newStatus }).eq('id', project.id)
      onProjectUpdate({ ...project, status: newStatus })
    }

    setTogglingStage(null)
  }

  return (
    <div className="px-4 md:px-8 py-4 md:py-5 border-b border-[#D8D3C8] bg-[#F5F2EC]">
      {/* Top row: project info + status/cancel */}
      <div className="flex items-start justify-between gap-4">
        {editing ? (
          <div className="flex-1 grid grid-cols-2 gap-3">
            <input value={form.project_name} onChange={e => setForm(f => ({...f, project_name: e.target.value}))}
              className="px-3 py-1.5 border border-[#9A7B4F] rounded text-lg font-serif text-[#1A1A18] outline-none bg-white col-span-2" />
            <input value={form.project_number} onChange={e => setForm(f => ({...f, project_number: e.target.value}))}
              className="px-3 py-1.5 border border-[#D8D3C8] rounded text-sm outline-none bg-white" placeholder="Project #" />
            <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
              className="px-3 py-1.5 border border-[#D8D3C8] rounded text-sm outline-none bg-white" />
            <div className="col-span-2">
              <Combobox
                options={clients.map(c => ({ id: c.id, label: c.client_name + (c.company ? ` — ${c.company}` : '') }))}
                value={form.client_id}
                inputValue={clientName}
                onChange={(id, label) => { setForm(f => ({ ...f, client_id: id })); setClientName(label); saveClient(id, label) }}
                onCreate={handleCreateClient}
                placeholder="Type to search or create client…"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <h1 className="font-serif text-xl md:text-2xl text-[#1A1A18] font-medium">{project.project_name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-[#8A877F]">
              <span className="font-mono">{project.project_number}</span>
              {project.client
                ? <><span>·</span><span>{project.client.client_name}</span></>
                : <button onClick={() => setEditing(true)} className="text-[#9A7B4F] hover:underline cursor-pointer">+ Add client</button>
              }
              <span>·</span>
              <span>{new Date(project.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setEditing(true)} className="p-1 rounded border border-[#D8D3C8] text-[#8A877F] hover:border-[#2C2C2A] hover:text-[#2C2C2A] transition-colors cursor-pointer">
                <Pencil size={12} />
              </button>
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
              <StatusBadge status={project.status as any} />
              {project.status !== 'Cancelled' && project.status !== 'Completed' && (
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-[#8A877F] border border-[#D8D3C8] rounded hover:text-red-500 hover:border-red-300 transition-colors cursor-pointer"
                >
                  <Ban size={11} /> Cancel
                </button>
              )}
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 border border-red-300 rounded hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 size={11} /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stage pipeline strip */}
      {project.status !== 'Cancelled' && (
        <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1 flex-nowrap md:flex-wrap">
          {STAGE_CONFIG.map((s, i) => {
            const done = stages?.[s.key as StageKey] ?? false
            const toggling = togglingStage === s.key
            return (
              <div key={s.key} className="flex items-center gap-1">
                <button
                  onClick={() => toggleStage(s.key as StageKey, done)}
                  disabled={toggling}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer border
                    ${done
                      ? 'bg-[#9A7B4F] text-white border-[#9A7B4F]'
                      : 'bg-white text-[#8A877F] border-[#D8D3C8] hover:border-[#9A7B4F] hover:text-[#9A7B4F]'
                    } ${toggling ? 'opacity-50' : ''}`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${done ? 'border-white bg-white/20' : 'border-[#D8D3C8]'}`}>
                    {done && <Check size={9} strokeWidth={3} className="text-white" />}
                  </span>
                  {s.label}
                </button>
                {i < STAGE_CONFIG.length - 1 && (
                  <span className="text-[#D8D3C8] text-xs">›</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
