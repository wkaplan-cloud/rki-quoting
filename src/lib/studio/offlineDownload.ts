'use client'
import { registerOfflineWorker, OFFLINE_CACHE, OFFLINE_REGISTRY_KEY } from './offlineRuntime'
import { preloadBgRemovalAssets } from './bgRemoval'
import { OFFLINE_BOARD_PATH } from './offlineBoards'

// ── "Make available offline" ────────────────────────────────────────────────
// Without this, a board works offline only if it happened to be opened, and
// every picture on it scrolled into view, while the device still had signal —
// and even then the image cache is trimmed oldest-first, so a busy week could
// push an older board back out.
//
// This downloads boards deliberately: each page's HTML (which carries the
// whole board — slides, assets, specs — in its embedded server payload), the
// build files those pages and the editor need, and every Storage image the
// payload mentions. Everything lands in its own cache, OFFLINE_CACHE, which is
// never trimmed and survives service-worker version bumps; sw.js falls back to
// it whenever its own caches miss. Sign-out still clears it.
//
// It runs in the page rather than the worker: fetches made here need no
// worker in control (the very first visit has none), and the Cache API is
// shared with the worker anyway.

// Downloaded copies are refreshed quietly from the Studio lists once they are
// this old, so an iPad heading to site carries this morning's boards rather
// than last week's. Images are content-addressed and never fetched twice, so a
// refresh costs one HTML page per board.
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000

interface OfflineRegistry {
  /** boardId → when it was last downloaded */
  boards: Record<string, number>
  clientIds: string[]
  /** Last time the Studio pages and editor code were cached, boards or not */
  shellAt: number
}

export interface DownloadProgress {
  stage: 'pages' | 'files' | 'images' | 'tools'
  done: number
  total: number
}

export interface DownloadResult {
  boards: number
  failedBoards: number
  images: number
  failedImages: number
}

function emptyRegistry(): OfflineRegistry {
  return { boards: {}, clientIds: [], shellAt: 0 }
}

export function getOfflineRegistry(): OfflineRegistry {
  try {
    const raw = localStorage.getItem(OFFLINE_REGISTRY_KEY)
    return raw ? { ...emptyRegistry(), ...(JSON.parse(raw) as Partial<OfflineRegistry>) } : emptyRegistry()
  } catch {
    return emptyRegistry()
  }
}

function saveRegistry(reg: OfflineRegistry): void {
  try {
    localStorage.setItem(OFFLINE_REGISTRY_KEY, JSON.stringify(reg))
  } catch {}
  window.dispatchEvent(new Event('qh-offline-registry'))
}

export function supportsOfflineDownload(): boolean {
  return typeof window !== 'undefined' && 'caches' in window && 'serviceWorker' in navigator
}

/** Drops every downloaded copy from this device. Unsynced work is untouched —
 *  that lives in IndexedDB, not here. */
export async function removeOfflineCopies(): Promise<void> {
  try {
    await caches.delete(OFFLINE_CACHE)
  } catch {}
  try {
    localStorage.removeItem(OFFLINE_REGISTRY_KEY)
  } catch {}
  window.dispatchEvent(new Event('qh-offline-registry'))
}

export async function storageUsedLabel(): Promise<string | null> {
  try {
    const est = await navigator.storage?.estimate?.()
    if (!est?.usage) return null
    const mb = est.usage / (1024 * 1024)
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.max(1, Math.round(mb))} MB`
  } catch {
    return null
  }
}

// ── Extraction ──────────────────────────────────────────────────────────────

// The server payload is a JS string literal inside the HTML, so quotes and
// backslashes bound every URL, and `&` arrives as &.
const STATIC_URL = /\/_next\/static\/[^\s"'<>\\)]+/g
const IMAGE_URL = /https:\/\/[^\s"'<>\\]+?\/storage\/v1\/object\/[^\s"'<>\\)]+/g
const CSS_URL = /url\((?:"|')?(\/_next\/static\/[^"')]+)(?:"|')?\)/g

function unescapePayload(html: string): string {
  return html.replace(/\\u0026/g, '&')
}

function extract(html: string, re: RegExp): string[] {
  return Array.from(new Set(unescapePayload(html).match(re) ?? []))
}

// Every build file this page has loaded so far — the lazily-imported editor
// chunks in particular never appear in any HTML.
function loadedStaticFiles(): string[] {
  try {
    return performance
      .getEntriesByType('resource')
      .map(e => new URL(e.name, location.origin))
      .filter(u => u.origin === location.origin && u.pathname.startsWith('/_next/static/'))
      .map(u => u.pathname + u.search)
  } catch {
    return []
  }
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await fn(item)
    }
  })
  await Promise.all(workers)
}

// ── Download ────────────────────────────────────────────────────────────────

let running: Promise<DownloadResult> | null = null

export function isDownloading(): boolean {
  return running !== null
}

export function downloadForOffline(opts: {
  boardIds: string[]
  clientIds: string[]
  onProgress?: (p: DownloadProgress) => void
  /** Also fetch the background-removal model (~40MB, once per device) */
  includeTools?: boolean
  /** Resolves once the editor's code is loaded in this page (EditorCodeWarmup) */
  editorReady?: Promise<void>
}): Promise<DownloadResult> {
  if (running) return running
  running = run(opts).finally(() => {
    running = null
  })
  return running
}

async function run({
  boardIds,
  clientIds,
  onProgress,
  includeTools = true,
  editorReady,
}: {
  boardIds: string[]
  clientIds: string[]
  onProgress?: (p: DownloadProgress) => void
  includeTools?: boolean
  editorReady?: Promise<void>
}): Promise<DownloadResult> {
  if (!supportsOfflineDownload()) throw new Error('This browser cannot keep boards for offline use')
  if (!navigator.onLine) throw new Error('No connection — download while you still have signal')

  registerOfflineWorker()
  // Ask the browser not to evict this under storage pressure. Granted silently
  // or not at all; a Home Screen app on iOS is the reliable way to keep it.
  void navigator.storage?.persist?.().catch(() => false)

  const cache = await caches.open(OFFLINE_CACHE)

  // The editor's code is in no HTML (see EditorCodeWarmup); wait for it to be
  // loaded here so its files are among what this page has fetched. Capped, so
  // a failed load costs the editor files rather than the whole download.
  onProgress?.({ stage: 'files', done: 0, total: 1 })
  if (editorReady) {
    await Promise.race([editorReady, new Promise(resolve => setTimeout(resolve, 20000))])
  }

  const pages = [
    '/studio',
    OFFLINE_BOARD_PATH,
    ...clientIds.map(id => `/studio/client/${id}`),
    ...boardIds.map(id => `/studio/board/${id}`),
  ]
  const staticFiles = new Set(loadedStaticFiles())
  const images = new Set<string>()
  const okBoards = new Set<string>()

  let pagesDone = 0
  await pool(pages, 3, async path => {
    try {
      const res = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'text/html' } })
      const type = res.headers.get('content-type') ?? ''
      // A bounce to /login (session lapsed) or an error page is not a board
      if (res.ok && !res.redirected && type.includes('text/html')) {
        const html = await res.clone().text()
        await cache.put(new Request(new URL(path, location.origin).href), res)
        extract(html, STATIC_URL).forEach(u => staticFiles.add(u))
        extract(html, IMAGE_URL).forEach(u => images.add(u))
        const boardId = path.startsWith('/studio/board/') ? path.slice('/studio/board/'.length) : null
        if (boardId) okBoards.add(boardId)
      }
    } catch {
      // Counted as failed below — one bad board must not stop the rest
    }
    onProgress?.({ stage: 'pages', done: ++pagesDone, total: pages.length })
  })

  // Build files: content-hashed, so anything already held is final
  const files = Array.from(staticFiles)
  let filesDone = 0
  const fonts = new Set<string>()
  await pool(files, 6, async path => {
    try {
      const req = new Request(new URL(path, location.origin).href)
      const have = await cache.match(req)
      if (!have) {
        const res = await fetch(req)
        if (res.ok) {
          if (path.endsWith('.css')) {
            const css = await res.clone().text()
            for (const m of css.matchAll(CSS_URL)) fonts.add(m[1])
          }
          await cache.put(req, res)
        }
      }
    } catch {}
    onProgress?.({ stage: 'files', done: ++filesDone, total: files.length })
  })
  // Fonts referenced from the stylesheets — text on the canvas falls back to a
  // system face without them
  await pool(Array.from(fonts), 6, async path => {
    try {
      const req = new Request(new URL(path, location.origin).href)
      if (await cache.match(req)) return
      const res = await fetch(req)
      if (res.ok) await cache.put(req, res)
    } catch {}
  })

  // Board images. The same CORS request the canvas makes, so the stored copy
  // satisfies both the canvas and the panels' <img> tags (see sw.js).
  const imageList = Array.from(images)
  let imagesDone = 0
  let failedImages = 0
  await pool(imageList, 4, async url => {
    try {
      if (!(await cache.match(url, { ignoreVary: true }))) {
        // Already in the worker's rolling image cache? Pin that copy rather
        // than downloading it again.
        const held = await caches.match(url, { ignoreVary: true })
        if (held && held.type !== 'opaque' && held.ok) {
          await cache.put(url, held)
        } else {
          const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
          if (res.ok) await cache.put(url, res)
          else failedImages++
        }
      }
    } catch {
      failedImages++
    }
    onProgress?.({ stage: 'images', done: ++imagesDone, total: imageList.length })
  })

  // Background removal model (~40MB, once per device). Cached by the worker
  // when it controls this page; best effort otherwise.
  if (includeTools) {
    onProgress?.({ stage: 'tools', done: 0, total: 100 })
    await new Promise<void>(resolve => {
      let settled = false
      preloadBgRemovalAssets(fraction => {
        if (fraction !== null) {
          onProgress?.({ stage: 'tools', done: Math.round(fraction * 100), total: 100 })
        } else if (!settled) {
          settled = true
          resolve()
        }
      })
    })
  }

  const reg = getOfflineRegistry()
  const now = Date.now()
  okBoards.forEach(id => {
    reg.boards[id] = now
  })
  reg.clientIds = Array.from(new Set([...reg.clientIds, ...clientIds]))
  reg.shellAt = now
  saveRegistry(reg)

  return {
    boards: okBoards.size,
    failedBoards: boardIds.length - okBoards.size,
    images: imageList.length - failedImages,
    failedImages,
  }
}

/** Quiet upkeep from the Studio lists: refresh downloaded boards once they are
 *  stale, forget ones that no longer exist, and keep the Studio pages and the
 *  offline editor cached even on a device that never downloaded anything — so
 *  a board can still be created and opened offline. */
export async function refreshOfflineCopiesInBackground(
  existingBoardIds: string[] | null,
  editorReady?: Promise<void>
): Promise<void> {
  if (!supportsOfflineDownload() || !navigator.onLine || running) return
  const reg = getOfflineRegistry()
  const now = Date.now()

  let boardIds = Object.keys(reg.boards)
  if (existingBoardIds) {
    const exists = new Set(existingBoardIds)
    const gone = boardIds.filter(id => !exists.has(id))
    if (gone.length) {
      gone.forEach(id => delete reg.boards[id])
      saveRegistry(reg)
      boardIds = boardIds.filter(id => exists.has(id))
    }
  }

  const oldest = boardIds.length ? Math.min(...boardIds.map(id => reg.boards[id])) : now
  const boardsStale = now - oldest > REFRESH_AFTER_MS
  const shellStale = now - reg.shellAt > REFRESH_AFTER_MS
  if (!boardsStale && !shellStale) return

  try {
    // Never the 40MB model from here: a background pass must not spend a
    // designer's mobile data on something they did not ask for
    await downloadForOffline({
      boardIds: boardsStale ? boardIds : [],
      clientIds: boardsStale ? reg.clientIds : [],
      includeTools: false,
      editorReady,
    })
  } catch {
    // Background upkeep never surfaces errors; the next visit tries again
  }
}
