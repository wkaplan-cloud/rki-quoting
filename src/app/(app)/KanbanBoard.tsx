'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProjectStages, StageKey } from '@/lib/types'
import { STAGE_CONFIG, statusFromStages } from '@/lib/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import toast from 'react-hot-toast'
import { Check } from 'lucide-react'

type StageConfigItem = typeof STAGE_CONFIG[number]

interface Project {
  id: string
  project_name: string
  project_number: string
  status: string
  client: { client_name: string } | null
}

interface Props {
  projects: Project[]  // passed as initialProjects internally
  stagesMap: Record<string, ProjectStages>
  stageConfig: readonly StageConfigItem[]
}

export function KanbanBoard({ projects: initialProjects, stagesMap, stageConfig }: Props) {
  const [localStages, setLocalStages] = useState<Record<string, ProjectStages>>(stagesMap)
  const [localProjects, setLocalProjects] = useState<Project[]>(initialProjects)
  const supabase = createClient()
  const router = useRouter()

  async function toggleStage(projectId: string, key: StageKey, currentVal: boolean) {
    const now = new Date().toISOString()
    const dateKey = stageConfig.find(s => s.key === key)!.dateKey
    const update = {
      [key]: !currentVal,
      [dateKey]: !currentVal ? now : null,
    }

    const { error } = await supabase
      .from('project_stages')
      .upsert({ project_id: projectId, ...update }, { onConflict: 'project_id' })

    if (error) { toast.error('Failed to update stage'); return }

    const newStages = {
      ...(localStages[projectId] ?? {
        id: '', project_id: projectId,
        quote_sent: false, quote_sent_at: null,
        deposit_received: false, deposit_received_at: null,
        pos_sent: false, pos_sent_at: null,
        fabrics_received: false, fabrics_received_at: null,
        fabrics_sent: false, fabrics_sent_at: null,
        final_invoice_sent: false, final_invoice_sent_at: null,
        final_invoice_paid: false, final_invoice_paid_at: null,
        delivered_installed: false, delivered_installed_at: null,
      }),
      ...update,
    } as ProjectStages

    setLocalStages(prev => ({ ...prev, [projectId]: newStages }))

    // Auto-update project status
    const proj = localProjects.find(p => p.id === projectId)
    if (proj && proj.status !== 'Cancelled') {
      const newStatus = statusFromStages(newStages)
      await supabase.from('projects').update({ status: newStatus }).eq('id', projectId)
      setLocalProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p))
    }

    // Refresh server data so summary cards update
    router.refresh()
  }

  // Short labels for column headers
  const shortLabels: Record<string, string> = {
    quote_sent: 'Quote Sent',
    deposit_received: 'Deposit',
    pos_sent: 'POs Sent',
    fabrics_received: 'Fabrics In',
    fabrics_sent: 'Fabrics Out',
    final_invoice_sent: 'Invoice Sent',
    final_invoice_paid: 'Invoice Paid',
    delivered_installed: 'Delivered',
  }

  if (localProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[#8A877F] text-sm">No active projects</p>
        <Link href="/projects/new" className="mt-2 text-sm text-[#9A7B4F] hover:underline">
          Create your first project →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#D8D3C8] rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider whitespace-nowrap">Project</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider whitespace-nowrap">Client</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">Status</th>
              {stageConfig.map(s => (
                <th key={s.key} className="px-3 py-3 text-center text-xs font-medium text-[#8A877F] uppercase tracking-wider whitespace-nowrap min-w-[80px]">
                  {shortLabels[s.key] ?? s.label}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium text-[#8A877F] uppercase tracking-wider whitespace-nowrap">Progress</th>
            </tr>
          </thead>
          <tbody>
            {localProjects.map((p, i) => {
              const stages = localStages[p.id]
              const completedCount = stages ? stageConfig.filter(s => stages[s.key as StageKey]).length : 0
              const progress = Math.round((completedCount / stageConfig.length) * 100)

              return (
                <tr
                  key={p.id}
                  className={`border-b border-[#EDE9E1] hover:bg-[#FDFCF9] transition-colors ${i === localProjects.length - 1 ? 'border-0' : ''}`}
                >
                  {/* Project info */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors block leading-tight"
                      onClick={e => e.stopPropagation()}
                    >
                      {p.project_name}
                    </Link>
                    <span className="text-xs text-[#8A877F] font-mono">{p.project_number}</span>
                  </td>
                  <td className="px-4 py-3 text-[#8A877F] text-sm whitespace-nowrap">
                    {p.client?.client_name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status as any} />
                  </td>

                  {/* Stage cells */}
                  {stageConfig.map(s => {
                    const done = stages?.[s.key as StageKey] ?? false
                    const dateVal = stages?.[s.dateKey as keyof ProjectStages] as string | null

                    return (
                      <td key={s.key} className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggleStage(p.id, s.key as StageKey, done)}
                          title={done && dateVal ? new Date(dateVal).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : `Mark ${s.label}`}
                          className={`inline-flex flex-col items-center gap-0.5 group cursor-pointer rounded p-1 transition-colors
                            ${done ? 'text-[#9A7B4F]' : 'text-[#D8D3C8] hover:text-[#9A7B4F]/50'}`}
                        >
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors
                            ${done ? 'bg-[#9A7B4F]/10' : 'bg-[#F5F2EC] group-hover:bg-[#9A7B4F]/5'}`}>
                            <Check size={12} strokeWidth={done ? 3 : 2} />
                          </span>
                          {done && dateVal && (
                            <span className="text-[10px] text-[#9A7B4F] leading-none">
                              {new Date(dateVal).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </button>
                      </td>
                    )
                  })}

                  {/* Progress */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-16 h-1.5 bg-[#EDE9E1] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#9A7B4F] rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#8A877F]">{completedCount}/{stageConfig.length}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
