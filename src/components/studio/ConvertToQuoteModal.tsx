'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, FileText, AlertTriangle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStudioStore } from '@/lib/studio/store'

// Confirm step for pulling a board into a new quoting project. Every spec
// converts regardless of draft/approved status — this is just the "is
// everything approved for quoting?" heads-up when drafts remain, not a gate.
export function ConvertToQuoteModal({
  approvedCount,
  draftCount,
  onClose,
}: {
  approvedCount: number
  draftCount: number
  onClose: () => void
}) {
  const totalCount = approvedCount + draftCount
  const router = useRouter()
  const boardId = useStudioStore(s => s.boardId)
  const boardName = useStudioStore(s => s.boardName)
  const [name, setName] = useState(boardName)
  const [creating, setCreating] = useState(false)

  async function create() {
    setCreating(true)
    try {
      // Make sure every spec edit is in the DB before the server reads them
      await useStudioStore.getState().flushSave()
      const res = await fetch(`/api/studio/boards/${boardId}/convert-to-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: name.trim() || boardName }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to create quote')
        setCreating(false)
        return
      }
      toast.success(
        `Quote created — ${json.itemCount} items${json.materialCount ? ` + ${json.materialCount} materials` : ''}`
      )
      router.push(`/projects/${json.projectId}`)
    } catch {
      toast.error('Failed to create quote')
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-[#F5F2EC] border border-[#D8D3C8] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8D3C8]">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
            <FileText size={12} /> Create quote from board
          </span>
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
          <label className="block">
            <span className="block text-[10px] text-[#8A877F] mb-0.5">Project name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="w-full text-[12px] px-2.5 py-2 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
            />
          </label>

          <p className="text-[11px] text-[#2C2C2A] leading-relaxed">
            {totalCount} spec{totalCount === 1 ? '' : 's'} will become line items, grouped under
            this board&apos;s slide headings. Items come in unpriced — costs and markup are set in
            the project.
          </p>

          {draftCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Is everything approved for quoting? {draftCount} spec{draftCount === 1 ? ' is' : 's are'} still
                draft — they&apos;ll be included too, so double-check they&apos;re actually ready.
              </p>
            </div>
          )}
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
            onClick={() => void create()}
            disabled={creating || totalCount === 0}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-[#C4A46B] text-[#1A1A18] rounded-lg hover:bg-[#D4B47B] transition-colors cursor-pointer disabled:opacity-50"
          >
            {creating ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Creating…
              </>
            ) : (
              <>Create quote · {totalCount}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
