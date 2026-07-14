'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createStudioBoard } from '@/lib/studio/createBoard'
import { Combobox } from '@/components/ui/Combobox'

interface ClientOption {
  id: string
  clientName: string
  company: string
}

// Boards still belong to clients under the hood — this is the one place on
// the boards-first Studio home where that's asked for, folding "pick or add
// a client" and "name the board" into a single step.
export function NewBoardModal({
  orgId,
  logoUrl,
  clients,
  onClose,
}: {
  orgId: string
  logoUrl: string | null
  clients: ClientOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const [localClients, setLocalClients] = useState(clients)
  const [clientId, setClientId] = useState('')
  const [clientLabel, setClientLabel] = useState('')
  const [boardName, setBoardName] = useState('')
  const [creating, setCreating] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  async function handleCreateClient(name: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('clients')
      .insert({ user_id: user!.id, org_id: orgId, client_name: name })
      .select()
      .single()
    if (error) {
      toast.error('Failed to create client')
      return
    }
    setLocalClients(cs => [...cs, { id: data.id, clientName: name, company: '' }])
    setClientId(data.id)
    setClientLabel(name)
    nameRef.current?.focus()
  }

  async function handleCreate() {
    if (!clientId) {
      toast.error('Choose or add a client')
      return
    }
    if (!boardName.trim()) {
      toast.error('Give the board a name')
      return
    }
    setCreating(true)
    try {
      const client = localClients.find(c => c.id === clientId)
      const boardId = await createStudioBoard({
        orgId,
        clientId,
        clientName: client?.clientName ?? clientLabel,
        boardName: boardName.trim(),
        logoUrl,
      })
      router.push(`/studio/board/${boardId}`)
    } catch (e) {
      toast.error((e as Error).message || 'Could not create board')
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-[#F5F2EC] border border-[#D8D3C8] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8D3C8]">
          <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">New board</span>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            title="Close"
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <Combobox
            label="Client"
            options={localClients.map(c => ({
              id: c.id,
              label: c.clientName + (c.company ? ` — ${c.company}` : ''),
            }))}
            value={clientId}
            inputValue={clientLabel}
            onChange={(id, label) => {
              setClientId(id)
              setClientLabel(label)
            }}
            onCreate={name => void handleCreateClient(name)}
            placeholder="Type to search or create…"
          />
          <label className="block">
            <span className="block text-[10px] text-[#8A877F] mb-0.5">Board name</span>
            <input
              ref={nameRef}
              value={boardName}
              onChange={e => setBoardName(e.target.value)}
              placeholder="e.g. Living room moodboard"
              onKeyDown={e => {
                if (e.key === 'Enter') void handleCreate()
              }}
              className="w-full text-[13px] px-2.5 py-2 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#D8D3C8]">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="h-8 px-3 text-xs text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-50"
          >
            {creating ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Creating…
              </>
            ) : (
              'Create board'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
