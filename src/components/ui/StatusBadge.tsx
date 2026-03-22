'use client'
import type { ProjectStatus } from '@/lib/types'

const styles: Record<ProjectStatus, string> = {
  Quote:     'bg-amber-100 text-amber-800 border border-amber-200',
  Invoice:   'bg-blue-100 text-blue-800 border border-blue-200',
  Completed: 'bg-green-100 text-green-800 border border-green-200',
  Cancelled: 'bg-red-100 text-red-800 border border-red-200',
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium tracking-wide ${styles[status]}`}>
      {status}
    </span>
  )
}
