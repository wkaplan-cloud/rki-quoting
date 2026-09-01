'use client'
import type { ProjectStatus } from '@/lib/types'

const styles: Record<ProjectStatus, string> = {
  Draft:     'bg-[#F5F2EC] text-[#8A877F] border border-[#D8D3C8]',
  Quote:     'bg-amber-100 text-amber-800 border border-amber-200',
  Approved:  'bg-emerald-100 text-emerald-800 border border-emerald-200',
  Deposit:   'bg-violet-100 text-violet-800 border border-violet-200',
  Invoice:   'bg-blue-100 text-blue-800 border border-blue-200',
  Paid:      'bg-green-100 text-green-800 border border-green-200',
  Completed: 'bg-[#9A7B4F]/10 text-[#7d6340] border border-[#9A7B4F]/30',
  Cancelled: 'bg-red-100 text-red-800 border border-red-200',
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  Draft:     'Draft',
  Quote:     'Quoted',
  Approved:  'Approved',
  Deposit:   'Deposit Paid',
  Invoice:   'Invoiced',
  Paid:      'Paid',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
}

const UNKNOWN_STYLE = 'bg-[#F5F2EC] text-[#8A877F] border border-[#D8D3C8]'

/**
 * Accepts a plain string as well as ProjectStatus: statuses arrive from
 * untyped Supabase rows, and every caller used to cast through `any` to get
 * here. An unrecognised value now renders itself in the neutral style instead
 * of producing `undefined` class names and a blank label.
 */
export function StatusBadge({ status }: { status: ProjectStatus | string }) {
  const known = status in styles
  const cls   = known ? styles[status as ProjectStatus] : UNKNOWN_STYLE
  const label = known ? STATUS_LABELS[status as ProjectStatus] : status
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium tracking-wide ${cls}`}>
      {label}
    </span>
  )
}
