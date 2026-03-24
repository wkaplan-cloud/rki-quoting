'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusBadge, STATUS_LABELS } from '@/components/ui/StatusBadge'
import type { Project, ProjectStatus, LineItem } from '@/lib/types'
import { formatZAR, computeTotals } from '@/lib/quoting'
import { FolderOpen } from 'lucide-react'

const STATUSES: ProjectStatus[] = ['Draft', 'Quote', 'Invoice', 'Completed', 'Cancelled']

interface Props {
  projects: (Project & { client: { client_name: string; company: string | null } | null; line_items: LineItem[] })[]
  userEmailMap: Record<string, string>
}

export function ProjectsTable({ projects, userEmailMap }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'All'>('All')
  const router = useRouter()

  const filtered = projects.filter(p => {
    const matchStatus = statusFilter === 'All' || p.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      p.project_name.toLowerCase().includes(q) ||
      p.project_number.toLowerCase().includes(q) ||
      (p.client?.client_name ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search projects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 bg-white border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F] w-64"
        />
        <div className="flex items-center gap-1">
          {(['All', ...STATUSES] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded font-medium transition-colors cursor-pointer
                ${statusFilter === s
                  ? 'bg-[#2C2C2A] text-white'
                  : 'bg-white border border-[#D8D3C8] text-[#8A877F] hover:border-[#2C2C2A] hover:text-[#2C2C2A]'
                }`}
            >
              {s === 'All' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen size={40} className="text-[#D8D3C8] mb-3" />
          <p className="text-[#8A877F] text-sm">No projects found</p>
          <Link href="/projects/new" className="mt-3 text-sm text-[#9A7B4F] hover:underline">
            Create your first project →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-[#D8D3C8] rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">Project #</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">Created By</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className={`border-b border-[#EDE9E1] hover:bg-[#F5F2EC] cursor-pointer transition-colors ${i === filtered.length - 1 ? 'border-0' : ''}`}
                >
                  <td className="px-4 py-3 text-[#8A877F] font-mono text-xs">{p.project_number}</td>
                  <td className="px-4 py-3 font-medium text-[#2C2C2A]">{p.project_name}</td>
                  <td className="px-4 py-3 text-[#8A877F]">{p.client?.client_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[#8A877F]">{new Date(p.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status as any} /></td>
                  <td className="px-4 py-3 text-[#8A877F] text-xs">
                    {p.user_id ? (userEmailMap[p.user_id]?.split('@')[0] ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[#2C2C2A] whitespace-nowrap">
                    {formatZAR(computeTotals(p.line_items ?? [], p.design_fee ?? 0, 15).grand_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
