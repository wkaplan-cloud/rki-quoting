'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { ProjectStages, StageKey, STAGE_CONFIG } from '@/lib/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import toast from 'react-hot-toast'

type StageConfigItem = typeof STAGE_CONFIG[number]

interface Project {
  id: string
  project_name: string
  project_number: string
  status: string
  client: { client_name: string } | null
}

interface Props {
  projects: Project[]
  stagesMap: Record<string, ProjectStages>
  stageConfig: readonly StageConfigItem[]
}

// Determine which kanban column a project belongs to
// = the LAST completed stage, or "Not Started" if none
function getProjectColumn(stages: ProjectStages | undefined, stageConfig: readonly StageConfigItem[]): number {
  if (!stages) return -1
  let last = -1
  stageConfig.forEach((s, i) => {
    if (stages[s.key as StageKey]) last = i
  })
  return last
}

export function KanbanBoard({ projects, stagesMap, stageConfig }: Props) {
  const [localStages, setLocalStages] = useState<Record<string, ProjectStages>>(stagesMap)
  const supabase = createClient()

  async function toggleStage(projectId: string, key: StageKey, currentVal: boolean) {
    const now = new Date().toISOString()
    const dateKey = stageConfig.find(s => s.key === key)!.dateKey
    const update = {
      [key]: !currentVal,
      [dateKey]: !currentVal ? now : null,
    }

    // Upsert the stage row
    const { error } = await supabase
      .from('project_stages')
      .upsert({ project_id: projectId, ...update }, { onConflict: 'project_id' })

    if (error) { toast.error('Failed to update stage'); return }

    setLocalStages(prev => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] ?? { id: '', project_id: projectId, quote_sent: false, quote_sent_at: null, deposit_received: false, deposit_received_at: null, pos_sent: false, pos_sent_at: null, items_received: false, items_received_at: null, fabrics_sent: false, fabrics_sent_at: null, final_invoice_sent: false, final_invoice_sent_at: null, delivered_installed: false, delivered_installed_at: null }),
        ...update,
      } as ProjectStages,
    }))

    toast.success(!currentVal ? `✓ ${stageConfig.find(s => s.key === key)!.label}` : `Unmarked`)
  }

  // Column 0 = Not Started, columns 1-7 = each stage
  const columns = [
    { label: 'Not Started', index: -1 },
    ...stageConfig.map((s, i) => ({ label: s.label, index: i })),
  ]

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map(col => {
        const colProjects = projects.filter(p => getProjectColumn(localStages[p.id], stageConfig) === col.index)

        return (
          <div key={col.label} className="flex-shrink-0 w-52">
            {/* Column header */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider truncate">{col.label}</h3>
              {colProjects.length > 0 && (
                <span className="text-xs bg-[#E5DFD5] text-[#8A877F] rounded-full px-1.5 py-0.5 ml-1 flex-shrink-0">{colProjects.length}</span>
              )}
            </div>

            {/* Cards */}
            <div className="space-y-2 min-h-[100px]">
              {colProjects.length === 0 && (
                <div className="border-2 border-dashed border-[#E5DFD5] rounded h-16" />
              )}
              {colProjects.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  stages={localStages[p.id]}
                  stageConfig={stageConfig}
                  onToggle={toggleStage}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProjectCard({ project, stages, stageConfig, onToggle }: {
  project: Project
  stages: ProjectStages | undefined
  stageConfig: readonly StageConfigItem[]
  onToggle: (projectId: string, key: StageKey, current: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const completedCount = stages
    ? stageConfig.filter(s => stages[s.key as StageKey]).length
    : 0
  const progress = Math.round((completedCount / stageConfig.length) * 100)

  return (
    <div className="bg-white border border-[#D8D3C8] rounded p-3 shadow-sm hover:border-[#9A7B4F] transition-colors">
      {/* Project name + link */}
      <Link href={`/projects/${project.id}`} className="block font-medium text-[#2C2C2A] text-sm leading-tight hover:text-[#9A7B4F] transition-colors">
        {project.project_name}
      </Link>
      {project.client && (
        <p className="text-xs text-[#8A877F] mt-0.5">{project.client.client_name}</p>
      )}
      <p className="text-xs text-[#8A877F] font-mono mt-0.5">{project.project_number}</p>

      {/* Progress bar */}
      <div className="mt-2 h-1 bg-[#EDE9E1] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#9A7B4F] rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-[#8A877F] mt-1">{completedCount}/{stageConfig.length} stages</p>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="mt-2 text-xs text-[#9A7B4F] hover:underline cursor-pointer"
      >
        {expanded ? 'Hide stages ↑' : 'Update stages ↓'}
      </button>

      {/* Stage toggles */}
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-[#EDE9E1] pt-2">
          {stageConfig.map(s => {
            const done = stages?.[s.key as StageKey] ?? false
            const date = stages?.[s.dateKey as keyof ProjectStages] as string | null

            return (
              <div key={s.key} className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={`text-xs truncate ${done ? 'text-[#2C2C2A] font-medium' : 'text-[#8A877F]'}`}>
                    {s.label}
                  </p>
                  {done && date && (
                    <p className="text-xs text-[#8A877F]">
                      {new Date(date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
                {/* Toggle switch */}
                <button
                  onClick={() => onToggle(project.id, s.key as StageKey, done)}
                  className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors duration-200 cursor-pointer focus:outline-none
                    ${done ? 'bg-[#9A7B4F]' : 'bg-[#D8D3C8]'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200
                    ${done ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
