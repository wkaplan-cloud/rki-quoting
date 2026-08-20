'use client'
import type { StudioSlide, StudioSpec, MasterLayoutConfig } from './types'

// ── Offline durability layer ────────────────────────────────────────────────
// The editor keeps every unsaved change in memory and flushes to Supabase on a
// debounce. That is fine on a desktop, but on an iPad Safari evicts backgrounded
// tabs aggressively — an app switch on a site with no signal could silently wipe
// an afternoon of work. This mirrors the dirty state into IndexedDB so a reload,
// a tab eviction or a device restart can pick the work back up and flush it.
//
// Everything here fails soft: private-mode Safari, a blocked upgrade or a full
// disk all resolve to null/no-op rather than throwing. Losing the mirror is a
// downgrade to the old behaviour, never a broken editor.

const DB_NAME = 'quotinghub-studio'
const DB_VERSION = 1
const BOARDS = 'boards'
const UPLOADS = 'uploads'

// Bumped whenever the stored snapshot shape changes. A snapshot written under a
// different schema is ignored and dropped rather than merged — a stale shape
// must never be allowed to overwrite live server data.
export const SNAPSHOT_SCHEMA = 1

// Snapshots with nothing unsynced are kept as a read cache for offline opens,
// but only for so long.
const SNAPSHOT_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface BoardSnapshot {
  boardId: string
  schema: number
  orgId: string
  savedAt: number
  slides: StudioSlide[]
  specs: Record<string, StudioSpec>
  dirtySlideIds: string[]
  dirtySpecIds: string[]
  masterLayout: MasterLayoutConfig
  masterLayoutDirty: boolean
}

export interface QueuedUpload {
  id: string
  boardId: string
  blob: Blob
  fileName: string
  mimeType: string
  width: number
  height: number
  attempts: number
  createdAt: number
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise(resolve => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      return resolve(null)
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(BOARDS)) db.createObjectStore(BOARDS, { keyPath: 'boardId' })
      if (!db.objectStoreNames.contains(UPLOADS)) {
        const store = db.createObjectStore(UPLOADS, { keyPath: 'id' })
        store.createIndex('boardId', 'boardId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    // Another tab is holding an older version open — give up quietly rather
    // than hanging every caller behind an upgrade that may never land.
    req.onblocked = () => resolve(null)
  })
  return dbPromise
}

function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest
): Promise<T | null> {
  return openDb().then(
    db =>
      new Promise<T | null>(resolve => {
        if (!db) return resolve(null)
        let tx: IDBTransaction
        try {
          tx = db.transaction(storeName, mode)
        } catch {
          return resolve(null)
        }
        let result: T | null = null
        try {
          const req = fn(tx.objectStore(storeName))
          req.onsuccess = () => {
            result = req.result as T
          }
        } catch {
          return resolve(null)
        }
        tx.oncomplete = () => resolve(result)
        tx.onerror = () => resolve(null)
        tx.onabort = () => resolve(null)
      })
  )
}

// ── Board snapshots ─────────────────────────────────────────────────────────

export function putBoardSnapshot(snapshot: Omit<BoardSnapshot, 'schema' | 'savedAt'>): Promise<void> {
  const record: BoardSnapshot = { ...snapshot, schema: SNAPSHOT_SCHEMA, savedAt: Date.now() }
  return run(BOARDS, 'readwrite', store => store.put(record)).then(() => undefined)
}

export async function getBoardSnapshot(boardId: string): Promise<BoardSnapshot | null> {
  const record = await run<BoardSnapshot | undefined>(BOARDS, 'readonly', store => store.get(boardId))
  if (!record) return null
  // Written by a different build of this file — unusable, and keeping it around
  // only risks a future merge against the wrong shape.
  if (record.schema !== SNAPSHOT_SCHEMA) {
    void deleteBoardSnapshot(boardId)
    return null
  }
  return record
}

export function deleteBoardSnapshot(boardId: string): Promise<void> {
  return run(BOARDS, 'readwrite', store => store.delete(boardId)).then(() => undefined)
}

// Housekeeping: drop fully-synced snapshots older than the TTL. Anything still
// carrying unsynced work is kept regardless of age.
export async function pruneBoardSnapshots(): Promise<void> {
  const all = await run<BoardSnapshot[]>(BOARDS, 'readonly', store => store.getAll())
  if (!all) return
  const cutoff = Date.now() - SNAPSHOT_TTL_MS
  for (const rec of all) {
    const unsynced =
      rec.schema === SNAPSHOT_SCHEMA &&
      (rec.dirtySlideIds?.length || rec.dirtySpecIds?.length || rec.masterLayoutDirty)
    if (!unsynced && rec.savedAt < cutoff) await deleteBoardSnapshot(rec.boardId)
  }
}

// ── Queued image uploads ────────────────────────────────────────────────────

export function putUpload(upload: QueuedUpload): Promise<void> {
  return run(UPLOADS, 'readwrite', store => store.put(upload)).then(() => undefined)
}

export async function listUploads(boardId: string): Promise<QueuedUpload[]> {
  const all = await run<QueuedUpload[]>(UPLOADS, 'readonly', store =>
    store.index('boardId').getAll(IDBKeyRange.only(boardId))
  )
  return all ?? []
}

export async function getUpload(id: string): Promise<QueuedUpload | null> {
  return (await run<QueuedUpload | undefined>(UPLOADS, 'readonly', store => store.get(id))) ?? null
}

export function deleteUpload(id: string): Promise<void> {
  return run(UPLOADS, 'readwrite', store => store.delete(id)).then(() => undefined)
}
