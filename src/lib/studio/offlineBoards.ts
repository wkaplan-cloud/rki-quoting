'use client'
import { createClient } from '@/lib/supabase/client'
import { putBoardSnapshot } from './offlineDb'
import { DEFAULT_MASTER_LAYOUT, type StudioSlide } from './types'

// ── Boards created with no signal ───────────────────────────────────────────
// A board is normally born as a studio_boards row plus two slides, written
// straight to Supabase. With no connection that write cannot happen, so the
// board is born on the device instead: its identity lives here (localStorage —
// small, synchronous, readable before IndexedDB has opened) and its slides in
// the ordinary IndexedDB snapshot the editor already mirrors into.
//
// Every server write the editor makes for a board — slide flush, theme save,
// image upload — first calls ensureBoardCreated(). For a board that was never
// offline it is a no-op; for a pending one it inserts the board row and the
// starting slides, idempotently, before letting the write through. Without
// that gate the slide upserts would fail the board foreign key, a theme save
// would update zero rows and report success, and queued photos would be
// rejected until the upload queue gave up on them.

const STORAGE_KEY = 'qh-studio-pending-boards'

// Synced records are kept a while so the offline editor page can still name
// the board (client, title) if it is reopened before the device is online.
const SYNCED_TTL_MS = 60 * 24 * 60 * 60 * 1000

// Route that opens a board from this device alone. The id rides in the hash so
// the page's HTML is identical for every board — one cached copy serves all.
export const OFFLINE_BOARD_PATH = '/studio/offline-board'

export function offlineBoardHref(boardId: string): string {
  return `${OFFLINE_BOARD_PATH}#${boardId}`
}

export interface PendingBoard {
  id: string
  orgId: string
  clientId: string
  clientName: string
  boardName: string
  createdBy: string
  createdByName: string | null
  createdAt: number
  /** The cover + first slide as composed at creation. Re-inserted (never
   *  overwriting) when the board reaches the server, so it always lands with
   *  its starting slides even if the IndexedDB snapshot was unavailable. */
  initialSlides: StudioSlide[]
  /** Set once the board row exists on the server. */
  syncedAt: number | null
}

function readAll(): Record<string, PendingBoard> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, PendingBoard>) : {}
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, PendingBoard>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // Quota or private mode — the IndexedDB snapshot still carries the slides
  }
}

export function getPendingBoard(boardId: string): PendingBoard | null {
  return readAll()[boardId] ?? null
}

/** Boards made on this device that the server has not received yet. */
export function listUnsyncedBoards(orgId: string): PendingBoard[] {
  return Object.values(readAll())
    .filter(b => b.orgId === orgId && !b.syncedAt)
    .sort((a, b) => b.createdAt - a.createdAt)
}

function prune(all: Record<string, PendingBoard>): Record<string, PendingBoard> {
  const cutoff = Date.now() - SYNCED_TTL_MS
  return Object.fromEntries(Object.entries(all).filter(([, b]) => !b.syncedAt || b.syncedAt > cutoff))
}

export async function createOfflineBoard(
  board: Omit<PendingBoard, 'createdAt' | 'syncedAt'>
): Promise<void> {
  const all = prune(readAll())
  all[board.id] = { ...board, createdAt: Date.now(), syncedAt: null }
  writeAll(all)
  // Seed the editor's own mirror with every starting slide marked dirty, so
  // the normal flush carries them up alongside whatever is added offline.
  await putBoardSnapshot({
    boardId: board.id,
    orgId: board.orgId,
    slides: board.initialSlides,
    specs: {},
    dirtySlideIds: board.initialSlides.map(sl => sl.id),
    dirtySpecIds: [],
    masterLayout: DEFAULT_MASTER_LAYOUT,
    masterLayoutDirty: false,
  })
}

// supabase-js reports a dropped connection as an error object rather than a
// throw, with wording that differs per browser.
export function isNetworkError(message: string | undefined): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  return !!message && /failed to fetch|load failed|networkerror|network request failed/i.test(message)
}

const inflight = new Map<string, Promise<boolean>>()

/** True when the board row exists on the server (or always did). False means
 *  the caller must hold its write back and retry later. */
export function ensureBoardCreated(boardId: string): Promise<boolean> {
  const pending = getPendingBoard(boardId)
  if (!pending || pending.syncedAt) return Promise.resolve(true)
  const running = inflight.get(boardId)
  if (running) return running
  const p = createOnServer(pending).finally(() => inflight.delete(boardId))
  inflight.set(boardId, p)
  return p
}

async function createOnServer(board: PendingBoard): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  try {
    const supabase = createClient()
    const { error: boardError } = await supabase.from('studio_boards').insert({
      id: board.id,
      org_id: board.orgId,
      client_id: board.clientId,
      name: board.boardName,
      created_by: board.createdBy,
      created_by_name: board.createdByName,
    })
    // 23505: an earlier attempt landed the row and lost the response
    if (boardError && boardError.code !== '23505') return false

    // ignoreDuplicates: a slide already on the server is newer than the
    // composition captured at creation — never overwrite it from here
    const { error: slidesError } = await supabase.from('studio_slides').upsert(
      board.initialSlides.map(sl => ({
        id: sl.id,
        board_id: board.id,
        org_id: board.orgId,
        name: sl.name,
        heading: sl.heading,
        sort_order: sl.sortOrder,
        objects: sl.objects,
        is_cover: sl.isCover,
      })),
      { onConflict: 'id', ignoreDuplicates: true }
    )
    if (slidesError) return false
  } catch {
    return false
  }

  const all = readAll()
  if (all[board.id]) {
    all[board.id] = { ...all[board.id], syncedAt: Date.now() }
    writeAll(prune(all))
  }
  return true
}

/** Push every waiting board for this org up. Run from the Studio lists on load
 *  and on reconnect, so a board appears on other devices without having to be
 *  reopened here first. */
export async function syncPendingBoards(orgId: string): Promise<number> {
  let synced = 0
  for (const board of listUnsyncedBoards(orgId)) {
    if (await ensureBoardCreated(board.id)) synced++
    else break // still offline, or the server is refusing — try again later
  }
  return synced
}
