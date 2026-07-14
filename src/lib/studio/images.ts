'use client'
import { useEffect, useState } from 'react'
import { useStudioStore, newId } from './store'
import { gridPlacements } from './autoLayout'
import { assetFromRow, type ImageObject, type StudioAssetRow } from './types'

// ── Image element cache ─────────────────────────────────────────────────────
// Shared by editor nodes, thumbnails, presentation and export. crossOrigin is
// mandatory — without it stage.toDataURL() throws on a tainted canvas.
// LRU-capped so a 2,000-image board doesn't pin every bitmap in memory —
// evicted entries simply reload on demand.
const CACHE_MAX = 400
const cache = new Map<string, HTMLImageElement>()
const pending = new Map<string, Promise<HTMLImageElement>>()

function cachePut(url: string, img: HTMLImageElement) {
  cache.delete(url)
  cache.set(url, img)
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

function cacheGet(url: string): HTMLImageElement | undefined {
  const img = cache.get(url)
  if (img) {
    // Bump recency
    cache.delete(url)
    cache.set(url, img)
  }
  return img
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = cacheGet(url)
  if (cached) return Promise.resolve(cached)
  const inflight = pending.get(url)
  if (inflight) return inflight
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      cachePut(url, img)
      pending.delete(url)
      resolve(img)
    }
    img.onerror = () => {
      pending.delete(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
  pending.set(url, p)
  return p
}

export function useKonvaImage(url: string | null): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(() => (url ? cacheGet(url) : undefined))
  useEffect(() => {
    if (!url) {
      setImg(undefined)
      return
    }
    const cached = cacheGet(url)
    if (cached) {
      setImg(cached)
      return
    }
    let cancelled = false
    loadImage(url)
      .then(el => {
        if (!cancelled) setImg(el)
      })
      .catch(() => {
        if (!cancelled) setImg(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [url])
  return img
}

// ── Logo whitespace trimming ────────────────────────────────────────────────
// Org logos arrive with wildly different padding and aspect ratios. Trimming
// the transparent/near-white border once (cached per URL) lets the master
// layout size every logo by its actual visible content, so all presentations
// carry the same visual weight bottom-right.

export interface TrimmedLogo {
  image: HTMLImageElement
  crop: { x: number; y: number; width: number; height: number }
}

const trimCache = new Map<string, TrimmedLogo>()

export function computeContentCrop(img: HTMLImageElement): TrimmedLogo['crop'] {
  const full = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }
  try {
    // Analyse at a reduced size — plenty for finding the content box
    const scale = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return full
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)

    let minX = w
    let minY = h
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const a = data[i + 3]
        if (a < 16) continue // transparent
        if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) continue // near-white
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    if (maxX < 0 || maxY < 0) return full // blank/all-white logo

    // Small breathing room around the content
    const pad = Math.max(1, Math.round(Math.max(w, h) * 0.02))
    minX = Math.max(0, minX - pad)
    minY = Math.max(0, minY - pad)
    maxX = Math.min(w - 1, maxX + pad)
    maxY = Math.min(h - 1, maxY + pad)

    return {
      x: minX / scale,
      y: minY / scale,
      width: (maxX - minX + 1) / scale,
      height: (maxY - minY + 1) / scale,
    }
  } catch {
    return full // tainted canvas or decode oddity — use the full image
  }
}

export function useTrimmedLogo(url: string | null): TrimmedLogo | undefined {
  const img = useKonvaImage(url)
  const [trimmed, setTrimmed] = useState<TrimmedLogo | undefined>(() =>
    url ? trimCache.get(url) : undefined
  )
  useEffect(() => {
    if (!url || !img) {
      setTrimmed(undefined)
      return
    }
    const cached = trimCache.get(url)
    if (cached) {
      setTrimmed(cached)
      return
    }
    const result = { image: img, crop: computeContentCrop(img) }
    trimCache.set(url, result)
    setTrimmed(result)
  }, [url, img])
  return trimmed
}

// ── File conversion ─────────────────────────────────────────────────────────
// Anything a designer drops should just work: any picture format the browser
// can decode, HEIC iPhone photos (converted via heic2any) and PDFs (first
// page rendered via pdf.js). Everything is normalised to a bounded JPEG
// before upload, so the input size cap can be generous.

const MAX_INPUT_MB = 25
// 3600px longest side keeps a FULL-BLEED image on A3 at ~218dpi effective
// (grid-sized images land at 300dpi+). Don't lower this — boards are printed.
const MAX_DIM = 3600
const JPEG_QUALITY = 0.85

function looksLikePdf(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

function looksLikeHeic(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

function looksLikeImage(file: File) {
  return (
    file.type.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif|bmp|avif|svg|tiff?|hei[cf])$/i.test(file.name)
  )
}

export function isImportableFile(file: File) {
  return looksLikeImage(file) || looksLikePdf(file)
}

export function extractImageFiles(dt: DataTransfer | null): File[] {
  if (!dt) return []
  return Array.from(dt.files).filter(isImportableFile)
}

function canvasToJpegFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('Could not process image'))
          return
        }
        resolve(new File([blob], name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

// Decode any browser-supported image into a white-backed, size-capped canvas
function decodeToCanvas(src: Blob, name: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(src)
    img.onload = () => {
      URL.revokeObjectURL(url)
      // SVGs can report 0 intrinsic dimensions — default to a sensible size
      let width = img.naturalWidth || 800
      let height = img.naturalHeight || 600
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not process image'))
        return
      }
      // White base so transparency doesn't turn black in JPEG
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Couldn't read ${name}`))
    }
    img.src = url
  })
}

interface PreparedImage {
  file: File
  width: number
  height: number
}

async function pdfFirstPageToJpeg(file: File): Promise<PreparedImage> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() })
  try {
    const doc = await loadingTask.promise
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(MAX_DIM / base.width, MAX_DIM / base.height, 4)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process PDF')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, canvas, viewport }).promise
    return { file: await canvasToJpegFile(canvas, file.name), width: canvas.width, height: canvas.height }
  } finally {
    void loadingTask.destroy()
  }
}

async function prepareImageFile(file: File): Promise<PreparedImage> {
  if (file.size > MAX_INPUT_MB * 1024 * 1024) {
    throw new Error(`${file.name} is too large — please keep files under ${MAX_INPUT_MB}MB`)
  }
  if (looksLikePdf(file)) {
    return pdfFirstPageToJpeg(file)
  }
  try {
    const canvas = await decodeToCanvas(file, file.name)
    return { file: await canvasToJpegFile(canvas, file.name), width: canvas.width, height: canvas.height }
  } catch (err) {
    // HEIC/HEIF photos can't be decoded by most browsers — convert first
    if (looksLikeHeic(file)) {
      const heic2any = (await import('heic2any')).default
      const converted = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })) as Blob
      const canvas = await decodeToCanvas(converted, file.name)
      return { file: await canvasToJpegFile(canvas, file.name), width: canvas.width, height: canvas.height }
    }
    throw err instanceof Error ? err : new Error(`Couldn't read ${file.name}`)
  }
}

// ── Upload pipeline ─────────────────────────────────────────────────────────

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function uploadFile(file: File): Promise<{ url: string; width: number; height: number }> {
  const store = useStudioStore.getState()
  // Normalise/compress in the browser, then upload through the API route —
  // storage buckets in this app only accept writes via supabaseAdmin
  const prepared = await prepareImageFile(file)

  // Instant client-side dedupe: an identical file already in this board's
  // asset library skips the network round-trip entirely
  const hash = await sha256Hex(await prepared.file.arrayBuffer())
  const existing = store.assets.find(a => a.hash === hash)
  if (existing) {
    void loadImage(existing.url).catch(() => {})
    return {
      url: existing.url,
      width: existing.naturalWidth || prepared.width,
      height: existing.naturalHeight || prepared.height,
    }
  }

  const formData = new FormData()
  formData.append('files', prepared.file)
  formData.append('widths', String(prepared.width))
  formData.append('heights', String(prepared.height))
  const res = await fetch(`/api/studio/boards/${store.boardId}/images`, { method: 'POST', body: formData })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.urls?.[0]) throw new Error(data.error ?? 'Upload failed')
  const url: string = data.urls[0]

  // Register in the board's asset library (server deduplicates by hash)
  const assetRow = (data.assets?.[0] ?? null) as StudioAssetRow | null
  if (assetRow) useStudioStore.getState().addAsset(assetFromRow(assetRow))

  void loadImage(url).catch(() => {})
  return { url, width: prepared.width, height: prepared.height }
}

// Import one or more image files onto the current slide. Multiple images are
// auto-arranged into a neat grid; a single image lands at `at` (page coords)
// or centred. The whole import is one undo step.
export async function importImageFiles(files: File[], at?: { x: number; y: number }): Promise<void> {
  const images = files.filter(isImportableFile)
  if (images.length === 0) return

  const uploaded = await Promise.all(images.map(uploadFile))
  const store = useStudioStore.getState()

  const placements = gridPlacements(uploaded.map(u => ({ width: u.width, height: u.height })))
  const objects: ImageObject[] = uploaded.map((u, i) => {
    const p = placements[i]
    const x = uploaded.length === 1 && at ? at.x - p.width / 2 : p.x
    const y = uploaded.length === 1 && at ? at.y - p.height / 2 : p.y
    return {
      id: newId(),
      type: 'image',
      x,
      y,
      width: p.width,
      height: p.height,
      rotation: 0,
      opacity: 1,
      locked: false,
      url: u.url,
      naturalWidth: u.width,
      naturalHeight: u.height,
    }
  })

  store.addObjects(objects)
}

// Place an existing library asset onto the current slide (drag from the
// Asset Library or double-click) — no upload, the file is already stored.
export function addAssetToSlide(asset: { url: string; naturalWidth: number; naturalHeight: number }, at?: { x: number; y: number }): void {
  const width = asset.naturalWidth || 800
  const height = asset.naturalHeight || 600
  const [p] = gridPlacements([{ width, height }])
  const obj: ImageObject = {
    id: newId(),
    type: 'image',
    x: at ? at.x - p.width / 2 : p.x,
    y: at ? at.y - p.height / 2 : p.y,
    width: p.width,
    height: p.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    url: asset.url,
    naturalWidth: width,
    naturalHeight: height,
  }
  useStudioStore.getState().addObjects([obj])
}

// Replace the image inside an existing object's frame: contain-fit the new
// source into the old width/height, clear any crop, keep position/rotation/lock.
export async function replaceImage(objId: string, file: File): Promise<void> {
  if (!isImportableFile(file)) throw new Error('Please choose an image or PDF file')
  const uploaded = await uploadFile(file)
  const store = useStudioStore.getState()
  const slide = store.slides.find(sl => sl.id === store.currentSlideId)
  const obj = slide?.objects.find(o => o.id === objId)
  if (!obj || obj.type !== 'image') return

  const scale = Math.min(obj.width / uploaded.width, obj.height / uploaded.height)
  store.updateObject(objId, {
    url: uploaded.url,
    naturalWidth: uploaded.width,
    naturalHeight: uploaded.height,
    width: uploaded.width * scale,
    height: uploaded.height * scale,
    crop: undefined,
  } as Partial<ImageObject>)
}
