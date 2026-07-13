'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Search, Presentation, ArrowRight, UserPlus } from 'lucide-react'

interface ClientRow {
  id: string
  clientName: string
  company: string
  boardCount: number
  lastEdited: string | null
}

export function StudioHome({ clients }: { clients: ClientRow[] }) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? clients.filter(
        c => c.clientName.toLowerCase().includes(q) || c.company.toLowerCase().includes(q)
      )
    : clients

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A877F]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
          />
        </div>
        <Link
          href="/clients/new"
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#D8D3C8] bg-white text-[#2C2C2A] hover:border-[#9A7B4F] transition-colors"
        >
          <UserPlus size={13} /> New client
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Presentation size={32} className="mx-auto text-[#D8D3C8] mb-3" />
          <p className="text-sm text-[#8A877F]">
            {clients.length === 0 ? 'Add your first client to start a presentation board' : 'No clients match your search'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Link
              key={c.id}
              href={`/studio/client/${c.id}`}
              className="group bg-white rounded-xl border border-[#D8D3C8] p-5 hover:border-[#9A7B4F] transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-[#1A1A18] truncate">{c.clientName}</h3>
                  {c.company && <p className="text-xs text-[#8A877F] mt-0.5 truncate">{c.company}</p>}
                </div>
                <ArrowRight
                  size={15}
                  className="flex-shrink-0 mt-1 text-[#D8D3C8] group-hover:text-[#9A7B4F] group-hover:translate-x-0.5 transition-all"
                />
              </div>
              <p className="text-[11px] text-[#8A877F] mt-4">
                {c.boardCount === 0
                  ? 'No boards yet'
                  : `${c.boardCount} board${c.boardCount > 1 ? 's' : ''}${
                      c.lastEdited
                        ? ` · edited ${new Date(c.lastEdited).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`
                        : ''
                    }`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
