'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, Presentation, Pencil, Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface BoardRow {
  id: string
  name: string
  updatedAt: string
}

export function ClientBoards({
  orgId,
  clientId,
  initialBoards,
}: {
  orgId: string
  clientId: string
  initialBoards: BoardRow[]
}) {
  const router = useRouter()
  const [boards, setBoards] = useState(initialBoards)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  // Creating a board asks for one thing only: its name
  async function createBoard(name: string) {
    setCreating(false)
    if (!name.trim()) return
    setBusy(true)
    const supabase = createClient()
    try {
      const boardId = crypto.randomUUID()
      const { error } = await supabase
        .from('studio_boards')
        .insert({ id: boardId, org_id: orgId, client_id: clientId, name: name.trim() })
      if (error) throw new Error(error.message)
      const { error: slideError } = await supabase
        .from('studio_slides')
        .insert({ board_id: boardId, org_id: orgId, name: 'Slide 1', sort_order: 0 })
      if (slideError) throw new Error(slideError.message)
      router.push(`/studio/board/${boardId}`)
    } catch (e) {
      toast.error((e as Error).message || 'Could not create board')
      setBusy(false)
    }
  }

  async function renameBoard(id: string, name: string) {
    setRenamingId(null)
    const trimmed = name.trim()
    const board = boards.find(b => b.id === id)
    if (!trimmed || !board || trimmed === board.name) return
    setBoards(bs => bs.map(b => (b.id === id ? { ...b, name: trimmed } : b)))
    const supabase = createClient()
    const { error } = await supabase.from('studio_boards').update({ name: trimmed }).eq('id', id)
    if (error) toast.error('Rename failed')
  }

  async function deleteBoard(id: string, name: string) {
    if (!confirm(`Delete board "${name}"? All its slides will be deleted.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('studio_boards').delete().eq('id', id)
    if (error) {
      toast.error('Delete failed')
      return
    }
    setBoards(bs => bs.filter(b => b.id !== id))
  }

  return (
    <div>
      <div className="mb-6">
        {creating ? (
          <NewBoardInput onDone={name => void createBoard(name)} />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-lg bg-[#1A1A18] text-white hover:bg-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} New board
          </button>
        )}
      </div>

      {boards.length === 0 && !creating ? (
        <div className="text-center py-16">
          <Presentation size={32} className="mx-auto text-[#D8D3C8] mb-3" />
          <p className="text-sm text-[#8A877F]">No boards yet — create the first moodboard for this client</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map(b => (
            <div
              key={b.id}
              onClick={() => router.push(`/studio/board/${b.id}`)}
              className="group bg-white rounded-xl border border-[#D8D3C8] p-5 hover:border-[#9A7B4F] transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                {renamingId === b.id ? (
                  <RenameInput
                    defaultValue={b.name}
                    onDone={name => void renameBoard(b.id, name)}
                  />
                ) : (
                  <h3 className="text-sm font-medium text-[#1A1A18] truncate">{b.name}</h3>
                )}
                <span
                  className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    title="Rename"
                    onClick={() => setRenamingId(b.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => void deleteBoard(b.id, b.name)}
                    className="w-6 h-6 flex items-center justify-center rounded text-[#8A877F] hover:text-red-600 hover:bg-[#EDE9E1] transition-colors cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              </div>
              <p className="text-[11px] text-[#8A877F] mt-3">
                Edited{' '}
                {new Date(b.updatedAt).toLocaleDateString('en-ZA', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewBoardInput({ onDone }: { onDone: (name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <input
      ref={ref}
      placeholder="Board name — e.g. Living room moodboard"
      onBlur={e => onDone(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onDone((e.target as HTMLInputElement).value)
        if (e.key === 'Escape') onDone('')
      }}
      className="w-full max-w-sm text-sm px-3 py-2.5 rounded-lg border border-[#9A7B4F] bg-white outline-none text-[#2C2C2A]"
    />
  )
}

function RenameInput({ defaultValue, onDone }: { defaultValue: string; onDone: (name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <input
      ref={ref}
      defaultValue={defaultValue}
      onClick={e => e.stopPropagation()}
      onBlur={e => onDone(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onDone((e.target as HTMLInputElement).value)
        if (e.key === 'Escape') onDone(defaultValue)
      }}
      className="flex-1 min-w-0 text-sm px-2 py-1 rounded border border-[#9A7B4F] bg-white outline-none text-[#2C2C2A]"
    />
  )
}
