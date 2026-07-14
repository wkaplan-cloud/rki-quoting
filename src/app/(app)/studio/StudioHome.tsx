'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Presentation, Plus, UserPlus } from 'lucide-react'
import { NewBoardModal } from './NewBoardModal'

interface ClientOption {
  id: string
  clientName: string
  company: string
}

interface BoardRow {
  id: string
  name: string
  updatedAt: string
  clientId: string
  clientName: string
  company: string
}

const RECENT_COUNT = 6

export function StudioHome({
  orgId,
  logoUrl,
  clients,
  boards,
}: {
  orgId: string
  logoUrl: string | null
  clients: ClientOption[]
  boards: BoardRow[]
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const q = query.trim().toLowerCase()
  const filtered = q
    ? boards.filter(
        b =>
          b.name.toLowerCase().includes(q) ||
          b.clientName.toLowerCase().includes(q) ||
          b.company.toLowerCase().includes(q)
      )
    : boards

  // boards already arrives sorted by updated_at desc from the server
  const { recent, rest, showSplit } = useMemo(() => {
    if (q || filtered.length <= RECENT_COUNT) {
      return { recent: [] as BoardRow[], rest: filtered, showSplit: false }
    }
    return { recent: filtered.slice(0, RECENT_COUNT), rest: filtered.slice(RECENT_COUNT), showSplit: true }
  }, [filtered, q])

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A877F]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search boards or clients…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
          />
        </div>
        <Link
          href="/clients/new"
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#D8D3C8] bg-white text-[#2C2C2A] hover:border-[#9A7B4F] transition-colors"
        >
          <UserPlus size={13} /> New client
        </Link>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-lg bg-[#1A1A18] text-white hover:bg-[#9A7B4F] transition-colors cursor-pointer"
        >
          <Plus size={13} /> New board
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Presentation size={32} className="mx-auto text-[#D8D3C8] mb-3" />
          <p className="text-sm text-[#8A877F]">
            {boards.length === 0 ? 'Create your first presentation board' : 'No boards match your search'}
          </p>
        </div>
      ) : showSplit ? (
        <>
          <SectionHeading>Recent</SectionHeading>
          <BoardGrid boards={recent} />
          <div className="h-px bg-[#D8D3C8] my-6" />
          <SectionHeading>All boards</SectionHeading>
          <BoardGrid boards={rest} />
        </>
      ) : (
        <BoardGrid boards={rest} />
      )}

      {creating && (
        <NewBoardModal orgId={orgId} logoUrl={logoUrl} clients={clients} onClose={() => setCreating(false)} />
      )}
    </div>
  )
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest mb-3">{children}</h2>
  )
}

function BoardGrid({ boards }: { boards: BoardRow[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {boards.map(b => (
        <Link
          key={b.id}
          href={`/studio/board/${b.id}`}
          className="group bg-white rounded-xl border border-[#D8D3C8] p-5 hover:border-[#9A7B4F] transition-colors"
        >
          <h3 className="text-sm font-medium text-[#1A1A18] truncate">{b.name}</h3>
          <p className="text-xs text-[#8A877F] mt-0.5 truncate">
            {b.clientName}
            {b.company && ` — ${b.company}`}
          </p>
          <p className="text-[11px] text-[#8A877F] mt-4">
            Edited{' '}
            {new Date(b.updatedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </Link>
      ))}
    </div>
  )
}
