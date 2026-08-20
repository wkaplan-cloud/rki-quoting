'use client'
import { useStudioStore } from './store'
import { listUploads, putUpload, deleteUpload, getUpload, type QueuedUpload } from './offlineDb'
import { assetFromRow, type StudioAssetRow } from './types'

// ── Offline image uploads ───────────────────────────────────────────────────
// Storage writes have to go through the API route, so an image dropped onto the
// canvas with no signal cannot become a real URL yet. Instead the compressed
// blob is parked in IndexedDB and the object gets a `pending://<id>` URL. The
// canvas resolves that to a local blob URL so the designer keeps working with
// the real picture, and the queue swaps in the permanent URL on reconnect.
//
// The sentinel deliberately survives a save to the database: holding the whole
// slide back until the file uploads would mean losing the layout work too, and
// an older client that reads `pending://` simply draws the standard
// still-loading frame rather than breaking.

export const PENDING_PREFIX = 'pending://'

export function isPendingUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith(PENDING_PREFIX)
}

export function pendingId(url: string): string {
  return url.slice(PENDING_PREFIX.length)
}

// Blob URLs handed out for pending images, so repeat renders reuse one object
// URL per upload instead of leaking a new one every time.
const blobUrls = new Map<string, string>()

export async function resolvePendingUrl(url: string): Promise<string | null> {
  const id = pendingId(url)
  const existing = blobUrls.get(id)
  if (existing) return existing
  const upload = await getUpload(id)
  if (!upload) return null
  const objectUrl = URL.createObjectURL(upload.blob)
  blobUrls.set(id, objectUrl)
  return objectUrl
}

function releasePendingUrl(id: string) {
  const objectUrl = blobUrls.get(id)
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    blobUrls.delete(id)
  }
}

export async function queueImageUpload(
  file: File,
  width: number,
  height: number
): Promise<{ url: string; width: number; height: number }> {
  const { boardId } = useStudioStore.getState()
  const id = crypto.randomUUID()
  await putUpload({
    id,
    boardId,
    blob: file,
    fileName: file.name,
    mimeType: file.type,
    width,
    height,
    attempts: 0,
    createdAt: Date.now(),
  })
  await refreshPendingCount()
  return { url: `${PENDING_PREFIX}${id}`, width, height }
}

export async function refreshPendingCount(): Promise<void> {
  const { boardId } = useStudioStore.getState()
  if (!boardId) return
  const queued = await listUploads(boardId)
  useStudioStore.getState().setPendingUploads(queued.length)
}

// An upload the server keeps rejecting (corrupt blob, type no longer allowed)
// must not wedge the queue forever.
const MAX_ATTEMPTS = 5

let processing = false

export async function processUploadQueue(): Promise<void> {
  if (processing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  const { boardId } = useStudioStore.getState()
  if (!boardId) return

  processing = true
  try {
    const queued = await listUploads(boardId)
    for (const upload of queued) {
      // The board can change under us if the queue is still draining when the
      // designer navigates to another board — stop rather than upload there.
      if (useStudioStore.getState().boardId !== boardId) break
      if (typeof navigator !== 'undefined' && !navigator.onLine) break
      const done = await uploadOne(upload)
      if (!done) break // network is down again; leave the rest queued
    }
  } finally {
    processing = false
    await refreshPendingCount()
  }
}

// Returns false only when the network failed — the caller stops the run and the
// upload stays queued. A rejected-by-the-server upload returns true so the queue
// keeps moving.
async function uploadOne(upload: QueuedUpload): Promise<boolean> {
  const formData = new FormData()
  formData.append('files', new File([upload.blob], upload.fileName, { type: upload.mimeType }))
  formData.append('widths', String(upload.width))
  formData.append('heights', String(upload.height))

  let res: Response
  try {
    res = await fetch(`/api/studio/boards/${upload.boardId}/images`, { method: 'POST', body: formData })
  } catch {
    return false
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.urls?.[0]) {
    // A 401 means the session lapsed while offline. Keep the file — the next
    // run after re-authentication will land it.
    if (res.status === 401 || res.status === 403 || res.status >= 500) return false
    const attempts = upload.attempts + 1
    if (attempts >= MAX_ATTEMPTS) {
      await deleteUpload(upload.id)
      releasePendingUrl(upload.id)
      useStudioStore.getState().failPendingUpload(upload.id)
    } else {
      await putUpload({ ...upload, attempts })
    }
    return true
  }

  const url: string = data.urls[0]
  const assetRow = (data.assets?.[0] ?? null) as StudioAssetRow | null
  if (assetRow) useStudioStore.getState().addAsset(assetFromRow(assetRow))

  useStudioStore.getState().resolvePendingUpload(upload.id, url)
  await deleteUpload(upload.id)
  releasePendingUrl(upload.id)
  return true
}
