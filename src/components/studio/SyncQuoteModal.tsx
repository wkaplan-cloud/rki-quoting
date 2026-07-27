'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, RefreshCw, Plus, Trash2, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStudioStore } from '@/lib/studio/store'

interface Diff {
  projectId: string
  projectNumber: string | null
  locked: boolean
  added: { name: string }[]
  removed: { lineItemId: string; name: string }[]
}

// Update an already-converted quote from the board. Adds are automatic;
// removals are opt-in per row (a quote line often carries pricing work, so it
// is never deleted just because the board changed). Previews first via GET,
// applies via POST. Mirrors ConvertToQuoteModal's shell + Studio type scale.
export function SyncQuoteModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const boardId = useStudioStore(s => s.boardId)

  const [diff, setDiff] = useState<Diff | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toRemove, setToRemove] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Make sure the latest board edits are in the DB before the server diffs
      await useStudioStore.getState().flushSave()
      try {
        const res = await fetch(`/api/studio/boards/${boardId}/sync-to-project`)
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setLoadError(json.error ?? 'Could not check the quote')
          return
        }
        setDiff(json as Diff)
      } catch {
        if (!cancelled) setLoadError('Could not check the quote')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [boardId])

  function toggleRemove(id: string) {
    setToRemove(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function apply() {
    if (!diff) return
    setApplying(true)
    try {
      const res = await fetch(`/api/studio/boards/${boardId}/sync-to-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLineItemIds: [...toRemove] }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to update quote')
        setApplying(false)
        return
      }
      const bits = [
        json.added ? `${json.added} added` : null,
        json.removed ? `${json.removed} removed` : null,
      ].filter(Boolean)
      toast.success(bits.length ? `Quote updated — ${bits.join(', ')}` : 'Quote updated')
      router.push(`/projects/${diff.projectId}`)
    } catch {
      toast.error('Failed to update quote')
      setApplying(false)
    }
  }

  const nothingToDo = diff && !diff.locked && diff.added.length === 0 && diff.removed.length === 0

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-[#F5F2EC] border border-[#D8D3C8] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8D3C8]">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
            <RefreshCw size={12} /> Update quote from board
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            title="Close"
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Loading */}
          {!diff && !loadError && (
            <div className="flex items-center gap-2 py-4 text-[11px] text-[#8A877F]">
              <Loader2 size={13} className="animate-spin" /> Checking the quote against the board…
            </div>
          )}

          {/* Load failed */}
          {loadError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-red-600" />
              <p className="text-[11px] text-red-800 leading-relaxed">{loadError}</p>
            </div>
          )}

          {/* Locked — quote already sent */}
          {diff?.locked && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <p className="text-[11px] text-amber-800 leading-relaxed">
                This quote has already been sent, so it can&apos;t be updated from the board. Open it
                to make changes directly.
              </p>
            </div>
          )}

          {/* Already in sync */}
          {nothingToDo && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5">
              <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5 text-emerald-600" />
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                This quote already matches the board — nothing to add or remove.
              </p>
            </div>
          )}

          {/* Diff */}
          {diff && !diff.locked && !nothingToDo && (
            <>
              {diff.added.length > 0 && (
                <div>
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest mb-1.5">
                    <Plus size={11} /> Added · {diff.added.length}
                  </span>
                  <ul className="space-y-0.5">
                    {diff.added.map((a, i) => (
                      <li key={i} className="text-[11px] text-[#2C2C2A] truncate">
                        {a.name}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-[#8A877F] mt-1">
                    New items come in unpriced — set costs in the project.
                  </p>
                </div>
              )}

              {diff.removed.length > 0 && (
                <div>
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest mb-1.5">
                    <Trash2 size={11} /> Removed from board · {diff.removed.length}
                  </span>
                  <p className="text-[10px] text-[#8A877F] mb-1.5">
                    These are still on the quote. Tick any you also want removed — pricing you&apos;ve
                    done on them will be lost.
                  </p>
                  <ul className="space-y-0.5">
                    {diff.removed.map(r => (
                      <li key={r.lineItemId}>
                        <label className="flex items-center gap-2 py-0.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={toRemove.has(r.lineItemId)}
                            onChange={() => toggleRemove(r.lineItemId)}
                            className="flex-shrink-0 w-3.5 h-3.5 accent-[#9A7B4F] cursor-pointer"
                          />
                          <span className="text-[11px] text-[#2C2C2A] truncate">{r.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#D8D3C8]">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="h-8 px-3 text-xs text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] rounded-lg transition-colors cursor-pointer"
          >
            {diff && (diff.locked || nothingToDo) ? 'Close' : 'Cancel'}
          </button>

          {diff && (diff.locked || nothingToDo) ? (
            <button
              type="button"
              onClick={() => router.push(`/projects/${diff.projectId}`)}
              className="h-8 px-3 text-xs font-medium bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors cursor-pointer"
            >
              Open quote
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void apply()}
              disabled={!diff || applying}
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-[#C4A46B] text-[#1A1A18] rounded-lg hover:bg-[#D4B47B] transition-colors cursor-pointer disabled:opacity-50"
            >
              {applying ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Updating…
                </>
              ) : (
                <>Update quote</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
