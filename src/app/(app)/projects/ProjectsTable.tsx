'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusBadge, STATUS_LABELS } from '@/components/ui/StatusBadge'
import type { Project, ProjectStatus, LineItem } from '@/lib/types'
import { formatZAR, computeTotals } from '@/lib/quoting'
import { FolderOpen, ChevronRight, Archive } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const STATUSES: ProjectStatus[] = ['Draft', 'Quote', 'Invoice', 'Paid', 'Completed', 'Cancelled']

interface Props {
  projects: (Project & { client: { client_name: string; company: string | null } | null; line_items: LineItem[] })[]
  userEmailMap: Record<string, string>
}

export function ProjectsTable({ projects, userEmailMap }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'All'>('All')
  const [showArchived, setShowArchived] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleUnarchive(id: string) {
    await supabase.from('projects').update({ archived_at: null }).eq('id', id)
    router.refresh()
  }

  const active   = projects.filter(p => !p.archived_at)
  const archived = projects.filter(p =>  p.archived_at)

  const filtered = (showArchived ? archived : active)
    .filter(p => {
      const matchStatus = showArchived || statusFilter === 'All' || p.status === statusFilter
      const q = search.toLowerCase()
      const matchSearch = !q ||
        p.project_name.toLowerCase().includes(q) ||
        p.project_number.toLowerCase().includes(q) ||
        (p.client?.client_name ?? '').toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
    .sort((a, b) => {
      const aComp = a.status === 'Completed'
      const bComp = b.status === 'Completed'
      if (aComp !== bComp) return aComp ? 1 : -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <input
          type="text"
          placeholder="Search projects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 bg-white border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F] w-full sm:w-64"
        />
        {!showArchived && (
          <div className="flex items-center gap-1 flex-wrap">
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
        )}
        <button
          onClick={() => setShowArchived(v => !v)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium transition-colors cursor-pointer border ${
            showArchived
              ? 'bg-[#2C2C2A] text-white border-[#2C2C2A]'
              : 'bg-white border-[#D8D3C8] text-[#8A877F] hover:border-[#2C2C2A] hover:text-[#2C2C2A]'
          }`}
        >
          <Archive size={12} />
          {showArchived ? 'Hide Archived' : `Archived${archived.length > 0 ? ` (${archived.length})` : ''}`}
        </button>
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
        <>
        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {filtered.map(p => {
            const total = formatZAR(computeTotals(p.line_items ?? [], p.design_fee ?? 0, 15).grand_total)
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center gap-3 bg-white border border-[#D8D3C8] rounded-lg px-4 py-3 active:bg-[#F5F2EC] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#2C2C2A] truncate">{p.project_name}</p>
                  <p className="text-xs text-[#8A877F] truncate mt-0.5">{p.client?.client_name ?? '—'}</p>
                  <p className="text-[10px] text-[#8A877F] font-mono mt-1">{p.project_number}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <StatusBadge status={p.status as any} />
                  <p className="text-sm font-semibold text-[#2C2C2A]">{total}</p>
                </div>
                <ChevronRight size={16} className="text-[#C4BFB5] flex-shrink-0" />
              </Link>
            )
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-white border border-[#D8D3C8] rounded overflow-x-auto">
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
                  onClick={() => !showArchived && router.push(`/projects/${p.id}`)}
                  className={`border-b border-[#EDE9E1] transition-colors ${i === filtered.length - 1 ? 'border-0' : ''} ${showArchived ? 'opacity-60' : 'hover:bg-[#F5F2EC] cursor-pointer'}`}
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
                  {showArchived && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={e => { e.stopPropagation(); handleUnarchive(p.id) }} className="text-xs text-[#9A7B4F] hover:underline cursor-pointer">Restore</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
