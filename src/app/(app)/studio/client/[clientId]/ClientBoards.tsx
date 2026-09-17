'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, Presentation, Pencil, Trash2, Loader2, FolderInput, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createStudioBoard } from '@/lib/studio/createBoard'
import { Combobox } from '@/components/ui/Combobox'

interface BoardRow {
  id: string
  name: string
  updatedAt: string
  /** Set once the board has been converted to a project. A board in that
   *  state can't be moved — projects.client_id was copied from the board at
   *  conversion and moving one without the other splits them. */
  projectId: string | null
  /** Who filed this board under this client. null for boards created before
   *  the board carried a creator. */
  createdByName: string | null
}

interface ClientOption {
  id: string
  clientName: string
  company: string
}

export function ClientBoards({
  orgId,
  clientId,
  clientName,
  userId,
  userName,
  logoUrl,
  clients,
  initialBoards,
}: {
  orgId: string
  clientId: string
  clientName: string
  userId: string
  userName: string | null
  logoUrl: string | null
  clients: ClientOption[]
  initialBoards: BoardRow[]
}) {
  const router = useRouter()
  const [boards, setBoards] = useState(initialBoards)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [movingBoard, setMovingBoard] = useState<BoardRow | null>(null)

  // Creating a board asks for one thing only: its name — the cover slide
  // (logo + client name + this name centred) and first content slide are
  // composed automatically
  async function createBoard(name: string) {
    setCreating(false)
    if (!name.trim()) return
    setBusy(true)
    try {
      const boardId = await createStudioBoard({
        orgId,
        clientId,
        clientName,
        boardName: name.trim(),
        logoUrl,
        createdBy: userId,
        createdByName: userName,
      })
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

  // Re-files a board under a different client. The board keeps its slides,
  // assets and specs — only the filing changes — but its cover slide still
  // shows the old client's name, so the caller is told to check it.
  async function moveBoard(board: BoardRow, toClientId: string, toClientName: string) {
    setMovingBoard(null)
    const supabase = createClient()
    const { error } = await supabase.from('studio_boards').update({ client_id: toClientId }).eq('id', board.id)
    if (error) {
      toast.error('Move failed')
      return
    }
    setBoards(bs => bs.filter(b => b.id !== board.id))
    toast.success(`"${board.name}" moved to ${toClientName} — check its cover slide`)
    router.refresh()
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
          <NewBoardInput clientName={clientName} onDone={name => void createBoard(name)} />
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
                    disabled={!!b.projectId}
                    title={
                      b.projectId
                        ? 'Linked to a project — move the project to change its client'
                        : 'Move to another client'
                    }
                    onClick={() => setMovingBoard(b)}
                    className="w-6 h-6 flex items-center justify-center rounded text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#8A877F] disabled:hover:bg-transparent"
                  >
                    <FolderInput size={11} />
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
              {b.createdByName && (
                <p className="text-[11px] text-[#8A877F] mt-0.5">Filed here by {b.createdByName}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {movingBoard && (
        <MoveBoardModal
          board={movingBoard}
          currentClientId={clientId}
          clients={clients}
          onClose={() => setMovingBoard(null)}
          onMove={(toId, toName) => void moveBoard(movingBoard, toId, toName)}
        />
      )}
    </div>
  )
}

// The client is taken from the page you're standing on and never asked for,
// so it's named in the label — a board filed under the wrong client is
// invisible at the moment it's created and expensive to notice later.
function NewBoardInput({ clientName, onDone }: { clientName: string; onDone: (name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <label className="block max-w-sm">
      <span className="block text-[11px] text-[#8A877F] mb-1">
        New board for <span className="font-medium text-[#2C2C2A]">{clientName}</span>
      </span>
      <input
        ref={ref}
        aria-label={`Board name for ${clientName}`}
        onBlur={e => onDone(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onDone((e.target as HTMLInputElement).value)
          if (e.key === 'Escape') onDone('')
        }}
        className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#9A7B4F] bg-white outline-none text-[#2C2C2A]"
      />
    </label>
  )
}

function MoveBoardModal({
  board,
  currentClientId,
  clients,
  onClose,
  onMove,
}: {
  board: BoardRow
  currentClientId: string
  clients: ClientOption[]
  onClose: () => void
  onMove: (toClientId: string, toClientName: string) => void
}) {
  const [targetId, setTargetId] = useState('')
  const [targetLabel, setTargetLabel] = useState('')

  const options = clients
    .filter(c => c.id !== currentClientId)
    .map(c => ({ id: c.id, label: c.clientName + (c.company ? ` — ${c.company}` : '') }))

  function handleMove() {
    if (!targetId) {
      toast.error('Choose a client')
      return
    }
    onMove(targetId, clients.find(c => c.id === targetId)?.clientName ?? targetLabel)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-[#F5F2EC] border border-[#D8D3C8] shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8D3C8]">
          <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">Move board</span>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <p className="text-[13px] text-[#2C2C2A]">
            Move <span className="font-medium">{board.name}</span> to another client. Its slides, images and specs
            come with it — the client name on the cover slide does not, so check it afterwards.
          </p>
          <Combobox
            label="Move to client"
            options={options}
            value={targetId}
            inputValue={targetLabel}
            onChange={(id, label) => {
              setTargetId(id)
              setTargetLabel(label)
            }}
          />
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#D8D3C8]">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 text-xs text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMove}
            className="h-8 px-3 text-xs font-medium bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors cursor-pointer"
          >
            Move board
          </button>
        </div>
      </div>
    </div>
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
      aria-label="Board name"
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
