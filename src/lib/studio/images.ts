'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compressImage'
import { useStudioStore, newId } from './store'
import { gridPlacements } from './autoLayout'
import { STORAGE_BUCKET } from './constants'
import type { ImageObject } from './types'

// ── Image element cache ─────────────────────────────────────────────────────
// Shared by editor nodes, thumbnails, presentation and export. crossOrigin is
// mandatory — without it stage.toDataURL() throws on a tainted canvas.
const cache = new Map<string, HTMLImageElement>()
const pending = new Map<string, Promise<HTMLImageElement>>()

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = cache.get(url)
  if (cached) return Promise.resolve(cached)
  const inflight = pending.get(url)
  if (inflight) return inflight
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      cache.set(url, img)
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
  const [img, setImg] = useState<HTMLImageElement | undefined>(() => (url ? cache.get(url) : undefined))
  useEffect(() => {
    if (!url) {
      setImg(undefined)
      return
    }
    const cached = cache.get(url)
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

// ── Upload pipeline ─────────────────────────────────────────────────────────

async function uploadFile(file: File): Promise<{ url: string; width: number; height: number }> {
  const { orgId, boardId } = useStudioStore.getState()
  const compressed = await compressImage(file)
  const ext = compressed.type === 'image/png' ? 'png' : 'jpg'
  const path = `${orgId}/${boardId}/${newId()}.${ext}`
  const supabase = createClient()
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, compressed, { contentType: compressed.type })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  const img = await loadImage(data.publicUrl)
  return { url: data.publicUrl, width: img.naturalWidth, height: img.naturalHeight }
}

function isImportableImage(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)
}

export function extractImageFiles(dt: DataTransfer | null): File[] {
  if (!dt) return []
  return Array.from(dt.files).filter(isImportableImage)
}

// Import one or more image files onto the current slide. Multiple images are
// auto-arranged into a neat grid; a single image lands at `at` (page coords)
// or centred. The whole import is one undo step.
export async function importImageFiles(files: File[], at?: { x: number; y: number }): Promise<void> {
  const images = files.filter(isImportableImage)
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

// Replace the image inside an existing object's frame: contain-fit the new
// source into the old width/height, clear any crop, keep position/rotation/lock.
export async function replaceImage(objId: string, file: File): Promise<void> {
  if (!isImportableImage(file)) throw new Error('Please choose an image file')
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
