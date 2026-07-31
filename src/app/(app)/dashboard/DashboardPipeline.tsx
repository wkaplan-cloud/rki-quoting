'use client'
import { useState } from 'react'
import { KanbanBoard } from '../KanbanBoard'
import { STAGE_CONFIG } from '@/lib/types'
import type { ProjectStages, ProjectStatus } from '@/lib/types'

interface Project {
  id: string
  project_name: string
  project_number: string
  status: ProjectStatus
  date: string
  assigned_to: string | null
  user_id: string | null
  client: { client_name: string } | null
  sage_invoice_id?: string | null
}

interface Props {
  projects: Project[]
  stagesMap: Record<string, ProjectStages>
  sageConnected: boolean
  currentUserId: string
}

export function DashboardPipeline({ projects, stagesMap, sageConnected, currentUserId }: Props) {
  const [myProjects, setMyProjects] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  const filtered = projects
    .filter(p => {
      if (showCompleted ? p.status !== 'Completed' : p.status === 'Completed') return false
      if (myProjects && (p.assigned_to ?? p.user_id) !== currentUserId) return false
      return true
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Project Pipeline</h2>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setMyProjects(v => !v)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors cursor-pointer border ${
              myProjects
                ? 'bg-[#9A7B4F] text-white border-[#9A7B4F]'
                : 'bg-white border-[#D8D3C8] text-[#8A877F] hover:border-[#2C2C2A] hover:text-[#2C2C2A]'
            }`}
          >
            My Projects
          </button>
          <div className="flex items-center border border-[#D8D3C8] rounded overflow-hidden text-xs font-medium">
            <button
              onClick={() => setShowCompleted(false)}
              className={`px-3 py-1 transition-colors cursor-pointer ${
                !showCompleted ? 'bg-[#2C2C2A] text-white' : 'bg-white text-[#8A877F] hover:text-[#2C2C2A]'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setShowCompleted(true)}
              className={`px-3 py-1 transition-colors cursor-pointer border-l border-[#D8D3C8] ${
                showCompleted ? 'bg-[#2C2C2A] text-white' : 'bg-white text-[#8A877F] hover:text-[#2C2C2A]'
              }`}
            >
              Completed
            </button>
          </div>
        </div>
      </div>
      <KanbanBoard
        key={`${myProjects}-${showCompleted}`}
        projects={filtered}
        stagesMap={stagesMap}
        stageConfig={STAGE_CONFIG}
        sageConnected={sageConnected}
      />
    </div>
  )
}
