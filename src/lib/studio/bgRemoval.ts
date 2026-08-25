'use client'
import toast from 'react-hot-toast'
import { useStudioStore } from './store'
import { loadImage } from './images'
import type { ImageObject, StudioObject, StudioSlide } from './types'

// Background removal (Phase 5). Runs entirely in the browser via
// @imgly/background-removal (ONNX/WASM, lazy-loaded on first use — the model
// downloads once and is cached by the browser). No API keys, no per-image
// cost, images never leave the user's machine for processing.
//
// Invariants the rest of Studio relies on:
// - Output has the SAME pixel dimensions as the input, so the object's crop /
//   naturalWidth / naturalHeight stay valid for both variants.
// - Only `url`, `originalUrl` and `processedUrl` on the object change —
//   position, size, rotation, layer order and specs are untouched.
// - Every swap goes through store.commit → one undo step + autosave.

// Silent model warm-up, called when a board opens. The ONNX model downloads
// ONCE PER DEVICE (~40MB) — not per board, not per removal — so after the
// first board this completes instantly and nothing is shown. "Once per device"
// depends on sw.js caching the imgly CDN (see isModelAsset there); without it
// this falls back to the browser's HTTP cache, which iOS evicts freely.
// onProgress receives 0..1 while downloading, then null when done/failed.
let preloadStarted = false
export function preloadBgRemovalAssets(onProgress: (fraction: number | null) => void): void {
  if (preloadStarted) {
    onProgress(null)
    return
  }
  preloadStarted = true
  const perFile = new Map<string, { current: number; total: number }>()
  void (async () => {
    try {
      const { preload } = await import('@imgly/background-removal')
      await preload({
        progress: (key: string, current: number, total: number) => {
          perFile.set(key, { current, total })
          let cur = 0
          let tot = 0
          perFile.forEach(v => {
            cur += v.current
            tot += v.total
          })
          onProgress(tot > 0 ? Math.min(1, cur / tot) : 0)
        },
      })
    } catch {
      // Silent by design — if the warm-up fails (offline, CDN hiccup), the
      // first Remove Background click retries the download and surfaces
      // its own error. Allow the next board open to try warming up again.
      preloadStarted = false
    } finally {
      onProgress(null)
    }
  })()
}

function findObject(objId: string): { slide: StudioSlide; obj: ImageObject } | null {
  for (const slide of useStudioStore.getState().slides) {
    const obj = slide.objects.find(o => o.id === objId)
    if (obj) return obj.type === 'image' ? { slide, obj } : null
  }
  return null
}

// Patch the object on WHOSE slide it lives (it may not be the current slide
// by the time processing finishes) — one undo step, marks only that slide dirty
function patchObject(slideId: string, objId: string, patch: Partial<ImageObject>) {
  useStudioStore.getState().commit(slides =>
    slides.map(sl =>
      sl.id !== slideId
        ? sl
        : {
            ...sl,
            objects: sl.objects.map(o => (o.id === objId ? ({ ...o, ...patch } as StudioObject) : o)),
          }
    )
  )
}

// Transparent results are heavy as PNG. WebP keeps alpha at a fraction of the
// size — use it when this browser can encode it (Chrome/Edge; Safari can't,
// which is why the upload route accepts large PNGs too).
async function encodeForUpload(png: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(png)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return png
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const webp = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.92))
    // Browsers without WebP encoding silently return PNG — check the type
    if (webp && webp.type === 'image/webp' && webp.size < png.size) return webp
    return png
  } catch {
    return png
  }
}

async function uploadProcessed(blob: Blob): Promise<string> {
  const boardId = useStudioStore.getState().boardId
  const formData = new FormData()
  const ext = blob.type === 'image/webp' ? 'webp' : 'png'
  formData.append('file', new File([blob], `bg-removed.${ext}`, { type: blob.type }))
  const res = await fetch(`/api/studio/boards/${boardId}/processed-images`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.url) throw new Error(data.error ?? 'Upload failed')
  return data.url as string
}

export function isBgRemoved(obj: ImageObject): boolean {
  return !!obj.processedUrl && obj.url === obj.processedUrl
}

// Remove Background action. Reuses the cached result when one exists;
// otherwise processes, uploads and swaps. Safe to call repeatedly.
export async function removeBackground(objId: string): Promise<void> {
  const store = useStudioStore.getState()
  const found = findObject(objId)
  if (!found) return
  const { slide, obj } = found

  if (isBgRemoved(obj)) return
  if (store.bgRemoval[objId] === 'processing') return

  // Cached from an earlier removal — instant swap, no reprocessing
  if (obj.processedUrl) {
    void loadImage(obj.processedUrl).catch(() => {})
    patchObject(slide.id, objId, {
      url: obj.processedUrl,
      originalUrl: obj.originalUrl ?? obj.url,
    })
    return
  }

  store.setBgRemoval(objId, 'processing')
  try {
    const { removeBackground: imglyRemoveBackground } = await import('@imgly/background-removal')
    // Process the CURRENT variant's source (always the original here since
    // there's no processedUrl yet). PNG keeps the alpha edges crisp.
    const png = await imglyRemoveBackground(obj.url, { output: { format: 'image/png' } })
    const url = await uploadProcessed(await encodeForUpload(png))

    // Warm the cache so the canvas swap doesn't flash a placeholder
    await loadImage(url).catch(() => {})

    // The object may have been deleted or undone away while we worked
    const now = findObject(objId)
    if (!now) {
      useStudioStore.getState().setBgRemoval(objId, null)
      return
    }
    patchObject(now.slide.id, objId, {
      url,
      processedUrl: url,
      originalUrl: now.obj.originalUrl ?? now.obj.url,
    })
    useStudioStore.getState().setBgRemoval(objId, null)
  } catch (e) {
    useStudioStore.getState().setBgRemoval(objId, 'error')
    toast.error(e instanceof Error && e.message ? e.message : 'Background removal failed — try again')
  }
}

// Restore Original action — swaps the url back; position, size, crop and
// rotation are untouched. The processed result stays cached on the object.
export function restoreOriginal(objId: string): void {
  const found = findObject(objId)
  if (!found || !found.obj.originalUrl) return
  if (found.obj.url === found.obj.originalUrl) return
  void loadImage(found.obj.originalUrl).catch(() => {})
  patchObject(found.slide.id, objId, { url: found.obj.originalUrl })
}
