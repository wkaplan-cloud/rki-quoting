'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Search, Presentation, ArrowRight } from 'lucide-react'

interface ProjectRow {
  id: string
  projectNumber: string
  projectName: string
  status: string
  clientName: string
  boardUpdatedAt: string | null
}

export function StudioHome({ projects }: { projects: ProjectRow[] }) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? projects.filter(
        p =>
          p.projectName.toLowerCase().includes(q) ||
          p.projectNumber.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q)
      )
    : projects

  return (
    <div>
      <div className="relative max-w-sm mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A877F]" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search projects or clients…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Presentation size={32} className="mx-auto text-[#D8D3C8] mb-3" />
          <p className="text-sm text-[#8A877F]">
            {projects.length === 0 ? 'Create a project first — boards live inside projects' : 'No projects match your search'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Link
              key={p.id}
              href={`/studio/${p.id}`}
              className="group bg-white rounded-xl border border-[#D8D3C8] p-5 hover:border-[#9A7B4F] transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-[#8A877F] uppercase tracking-widest mb-1">{p.projectNumber}</p>
                  <h3 className="text-sm font-medium text-[#1A1A18] truncate">{p.projectName}</h3>
                  {p.clientName && <p className="text-xs text-[#8A877F] mt-0.5 truncate">{p.clientName}</p>}
                </div>
                <ArrowRight
                  size={15}
                  className="flex-shrink-0 mt-1 text-[#D8D3C8] group-hover:text-[#9A7B4F] group-hover:translate-x-0.5 transition-all"
                />
              </div>
              <p className="text-[11px] text-[#8A877F] mt-4">
                {p.boardUpdatedAt
                  ? `Board edited ${new Date(p.boardUpdatedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'No board yet — click to create'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
