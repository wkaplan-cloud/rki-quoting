'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { HardDriveDownload, HardDrive, CloudUpload, Loader2 } from 'lucide-react'
import {
  downloadForOffline,
  getOfflineRegistry,
  refreshOfflineCopiesInBackground,
  removeOfflineCopies,
  storageUsedLabel,
  supportsOfflineDownload,
  type DownloadProgress,
} from '@/lib/studio/offlineDownload'
import { registerOfflineWorker } from '@/lib/studio/offlineRuntime'
import { listUnsyncedBoards, offlineBoardHref, syncPendingBoards, type PendingBoard } from '@/lib/studio/offlineBoards'
import { listUnsyncedBoardIds } from '@/lib/studio/offlineDb'
import { EditorCodeWarmup, editorCodeReady } from './EditorCodeWarmup'

// ── Shared offline plumbing for the Studio board lists ──────────────────────

/** Board ids downloaded to this device → when. Empty until mounted (the
 *  registry is device-local, so the server render never knows it). */
export function useOfflineBoards(): Record<string, number> {
  const [boards, setBoards] = useState<Record<string, number>>({})
  useEffect(() => {
    const read = () => setBoards(getOfflineRegistry().boards)
    read()
    window.addEventListener('qh-offline-registry', read)
    return () => window.removeEventListener('qh-offline-registry', read)
  }, [])
  return boards
}

/** Runs on every Studio list: sends boards created offline up when there is
 *  signal, keeps the downloaded copies fresh, and reports what this device is
 *  still holding back. `knownBoardIds` is null on a page that does not list
 *  every board, so stale downloads are never pruned from a partial view. */
export function useStudioOfflineSync(orgId: string, knownBoardIds: string[] | null) {
  const router = useRouter()
  const [pendingBoards, setPendingBoards] = useState<PendingBoard[]>([])
  const [unsyncedIds, setUnsyncedIds] = useState<string[]>([])
  const knownKey = knownBoardIds?.join(',') ?? null

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (listUnsyncedBoards(orgId).length && navigator.onLine) {
        const synced = await syncPendingBoards(orgId)
        // The server list on screen predates them — fetch it again
        if (synced) router.refresh()
      }
      const ids = await listUnsyncedBoardIds(orgId)
      if (cancelled) return
      setPendingBoards(listUnsyncedBoards(orgId))
      setUnsyncedIds(ids)
    }

    registerOfflineWorker()
    void check()
    void refreshOfflineCopiesInBackground(
      knownKey === null ? null : knownKey.split(',').filter(Boolean),
      editorCodeReady
    )
    const onOnline = () => void check()
    window.addEventListener('online', onOnline)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
    }
  }, [orgId, router, knownKey])

  return { pendingBoards, unsyncedIds }
}

function ago(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function progressLabel(p: DownloadProgress): string {
  switch (p.stage) {
    case 'pages':
      return `Boards ${p.done} of ${p.total}`
    case 'files':
      return 'Studio files…'
    case 'images':
      return `Images ${p.done} of ${p.total}`
    case 'tools':
      return p.done ? `Image tools ${p.done}%` : 'Image tools…'
  }
}

// iPad Safari only keeps a site's storage indefinitely once it is a Home Screen
// app, so the tip shows until it is one.
function isInstalled(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const btnClass =
  'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#D8D3C8] bg-white text-[#2C2C2A] hover:border-[#9A7B4F] active:bg-[#EDE9E1] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7B4F]'

export function OfflineDownloadButton({
  boardIds,
  clientIds,
  label,
  allowRemove = false,
}: {
  boardIds: string[]
  clientIds: string[]
  label: string
  /** Offer "Remove offline copies" — only where the button covers every board */
  allowRemove?: boolean
}) {
  const offline = useOfflineBoards()
  const [supported, setSupported] = useState(true)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [used, setUsed] = useState<string | null>(null)
  const [showInstallTip, setShowInstallTip] = useState(false)

  useEffect(() => {
    setSupported(supportsOfflineDownload())
    setShowInstallTip(!isInstalled())
    void storageUsedLabel().then(setUsed)
  }, [offline])

  // The warm-up renders nothing; it is here, on every Studio list, so the
  // editor's code is loaded before any download (or board open) needs it
  if (!supported || boardIds.length === 0) return <EditorCodeWarmup />

  const held = boardIds.filter(id => offline[id])
  const allHeld = held.length === boardIds.length
  const oldest = held.length ? Math.min(...held.map(id => offline[id])) : null

  async function start() {
    if (!navigator.onLine) {
      toast.error('No connection — download while you still have signal')
      return
    }
    setProgress({ stage: 'files', done: 0, total: 1 })
    try {
      const r = await downloadForOffline({ boardIds, clientIds, onProgress: setProgress, editorReady: editorCodeReady })
      if (r.failedBoards) {
        toast.error(`${r.boards} of ${boardIds.length} boards saved — try again for the rest`)
      } else if (r.failedImages) {
        toast(`Boards saved, but ${r.failedImages} image${r.failedImages === 1 ? '' : 's'} could not be downloaded`)
      } else {
        toast.success(`${r.boards} board${r.boards === 1 ? '' : 's'} ready to use offline`)
      }
    } catch (e) {
      toast.error((e as Error).message || 'Download failed')
    } finally {
      setProgress(null)
    }
  }

  async function remove() {
    if (!confirm('Remove the offline copies of every board from this device? Unsynced changes are kept.')) return
    await removeOfflineCopies()
    toast.success('Offline copies removed')
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <EditorCodeWarmup />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void start()} disabled={progress !== null} className={btnClass}>
          {progress ? (
            <>
              <Loader2 size={13} className="animate-spin" /> {progressLabel(progress)}
            </>
          ) : allHeld ? (
            <>
              <HardDrive size={13} className="text-[#9A7B4F]" /> Update offline copy
            </>
          ) : (
            <>
              <HardDriveDownload size={13} /> {label}
            </>
          )}
        </button>
        {allowRemove && held.length > 0 && !progress && (
          <button
            type="button"
            onClick={() => void remove()}
            className="text-[11px] text-[#8A877F] hover:text-[#2C2C2A] active:text-[#1A1A18] underline-offset-2 hover:underline transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7B4F]"
          >
            Remove offline copies
          </button>
        )}
      </div>
      {held.length > 0 && !progress && (
        <p className="text-[11px] text-[#8A877F]">
          {allHeld ? 'All' : `${held.length} of ${boardIds.length}`} on this device
          {oldest && <> · updated {ago(oldest)}</>}
          {used && <> · {used} used</>}
        </p>
      )}
      {held.length > 0 && showInstallTip && !progress && (
        <p className="text-[11px] text-[#8A877F] max-w-xs">
          On iPad, tap Share → Add to Home Screen so Safari keeps these boards on the device.
        </p>
      )}
    </div>
  )
}

export function OfflineBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-[#9A7B4F]"
      title="Saved on this device — opens with no signal"
    >
      <HardDrive size={10} /> Offline
    </span>
  )
}

/** Boards made on this device that the server has not received yet, plus any
 *  board with edits or photos still held here. */
export function UnsyncedBoards({
  pendingBoards,
  unsyncedNames,
}: {
  pendingBoards: PendingBoard[]
  unsyncedNames: { id: string; name: string }[]
}) {
  if (!pendingBoards.length && !unsyncedNames.length) return null
  return (
    <div className="mb-6 rounded-xl border border-[#E4D3B3] bg-[#FBF6EC] px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-[#2C2C2A]">
        <CloudUpload size={13} className="text-[#9A7B4F]" /> Saved on this device only
      </p>
      {pendingBoards.length > 0 && (
        <>
          <p className="text-[11px] text-[#8A877F] mt-1">
            Created offline — these go up automatically the next time this device has signal.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {pendingBoards.map(b => (
              // A plain link, not next/link: see createStudioBoard's callers
              <a
                key={b.id}
                href={offlineBoardHref(b.id)}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#D8D3C8] bg-white text-[#2C2C2A] hover:border-[#9A7B4F] active:bg-[#EDE9E1] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7B4F]"
              >
                {b.boardName}
                <span className="text-[#8A877F]"> · {b.clientName}</span>
              </a>
            ))}
          </div>
        </>
      )}
      {unsyncedNames.length > 0 && (
        <>
          <p className="text-[11px] text-[#8A877F] mt-2">
            Changes made offline — open each board once with signal to send them.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {unsyncedNames.map(b => (
              <Link
                key={b.id}
                href={`/studio/board/${b.id}`}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#D8D3C8] bg-white text-[#2C2C2A] hover:border-[#9A7B4F] active:bg-[#EDE9E1] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7B4F]"
              >
                {b.name}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
