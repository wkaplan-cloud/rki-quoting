'use client'
import { useEffect, useState, type RefObject } from 'react'
import type Konva from 'konva'
import { Unlock, Copy, Trash2, Check, X, ClipboardList } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import { TBtn, TDivider } from './toolbars/atoms'
import { ImageToolbar } from './toolbars/ImageToolbar'
import { TextToolbar } from './toolbars/TextToolbar'
import { ShapeToolbar } from './toolbars/ShapeToolbar'
import { cropController } from './CropOverlay'

interface Bbox {
  x: number
  y: number
  width: number
  height: number
}

// Appears only when something is selected, hovering above the selection.
// Contents depend on the selected object's type (per the spec).
export function FloatingToolbar({
  stageRef,
  containerSize,
}: {
  stageRef: RefObject<Konva.Stage | null>
  containerSize: { w: number; h: number }
}) {
  const selectedIds = useStudioStore(s => s.selectedIds)
  const slides = useStudioStore(s => s.slides)
  const currentSlideId = useStudioStore(s => s.currentSlideId)
  const viewport = useStudioStore(s => s.viewport)
  const cropTargetId = useStudioStore(s => s.cropTargetId)
  const editingTextId = useStudioStore(s => s.editingTextId)
  const specsMap = useStudioStore(s => s.specs)

  const [bbox, setBbox] = useState<Bbox | null>(null)

  const ids = cropTargetId ? [cropTargetId] : selectedIds

  // Selection bounding box in page coords, from the live Konva nodes
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || ids.length === 0) {
      setBbox(null)
      return
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let found = false
    for (const id of ids) {
      const node = stage.findOne(`#${id}`)
      if (!node) continue
      const r = node.getClientRect({ relativeTo: stage as unknown as Konva.Container })
      minX = Math.min(minX, r.x)
      minY = Math.min(minY, r.y)
      maxX = Math.max(maxX, r.x + r.width)
      maxY = Math.max(maxY, r.y + r.height)
      found = true
    }
    // While cropping the node is hidden — fall back to the object's frame
    if (!found && cropTargetId) {
      const slide = slides.find(sl => sl.id === currentSlideId)
      const obj = slide?.objects.find(o => o.id === cropTargetId)
      if (obj && obj.type === 'image') {
        minX = obj.x
        minY = obj.y
        maxX = obj.x + obj.width
        maxY = obj.y + obj.height
        found = true
      }
    }
    setBbox(found ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null)
    // slides in deps: object moves/resizes recompute the box
  }, [ids.join(','), slides, currentSlideId, viewport, cropTargetId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!bbox || editingTextId || ids.length === 0) return null

  const slide = slides.find(sl => sl.id === currentSlideId)
  const objs = (slide?.objects ?? []).filter(o => ids.includes(o.id))
  if (objs.length === 0) return null

  // Page → screen
  const screenX = viewport.x + (bbox.x + bbox.width / 2) * viewport.zoom
  const screenTop = viewport.y + bbox.y * viewport.zoom
  // Konva's rotate handle floats above the selection's top-center, offset by
  // rotateAnchorOffset (24 page points — see SelectionTransformer.tsx) scaled
  // by the current zoom. At typical fit-to-screen zoom (~0.6-0.7x) the old
  // fixed 52px gap put the toolbar's own body right on top of that handle,
  // hiding it entirely. Scaling the gap with zoom keeps it clear at any zoom.
  const clearance = Math.max(52, 30 * viewport.zoom + 52)
  const top = screenTop < clearance + 24 ? viewport.y + (bbox.y + bbox.height) * viewport.zoom + 16 : screenTop - clearance
  const left = Math.min(Math.max(screenX, 140), Math.max(containerSize.w - 140, 140))

  const single = objs.length === 1 ? objs[0] : null
  const locked = objs.some(o => o.locked)
  const store = useStudioStore

  return (
    <div
      className="absolute z-40 flex items-center gap-0.5 bg-white rounded-xl border border-[#D8D3C8] px-1.5 py-1"
      style={{
        left,
        top: Math.max(8, top),
        transform: 'translateX(-50%)',
        boxShadow: '0 2px 8px rgba(26,26,24,0.08), 0 8px 24px rgba(26,26,24,0.12)',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {cropTargetId ? (
        <>
          <button
            type="button"
            onClick={() => cropController.apply()}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors cursor-pointer"
          >
            <Check size={13} /> Apply crop
          </button>
          <button
            type="button"
            onClick={() => cropController.cancel()}
            className="flex items-center gap-1.5 h-8 px-3 text-xs text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
          >
            <X size={13} /> Cancel
          </button>
        </>
      ) : locked ? (
        <TBtn
          icon={Unlock}
          label="Unlock"
          onClick={() =>
            store.getState().updateObjects(objs.map(o => ({ id: o.id, patch: { locked: false } })))
          }
        />
      ) : single ? (
        <>
          {single.type === 'image' && (
            <>
              {/* Deliberately louder than the other buttons — specs are the
                  step designers forget, so it gets the gold treatment.
                  Filled spec = deep gold + white, none yet = bright gold. */}
              <button
                type="button"
                title={specsMap[single.id] ? 'Specs — added' : 'Add specs'}
                aria-label="Specs"
                onMouseDown={e => e.preventDefault()}
                onClick={() => store.getState().openSpecs(single.id)}
                className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer active:scale-95 focus-visible:outline-2 focus-visible:outline-[#9A7B4F] ${
                  specsMap[single.id]
                    ? 'bg-[#9A7B4F] text-white hover:bg-[#8A6B3F]'
                    : 'bg-[#C4A46B] text-[#1A1A18] hover:bg-[#D4B47B]'
                }`}
              >
                <ClipboardList size={15} />
              </button>
              <TDivider />
            </>
          )}
          {single.type === 'image' ? (
            <ImageToolbar obj={single} />
          ) : single.type === 'text' ? (
            <TextToolbar obj={single} />
          ) : (
            <ShapeToolbar obj={single} />
          )}
        </>
      ) : (
        <>
          <TBtn icon={Copy} label="Duplicate (⌘D)" onClick={() => store.getState().duplicateSelected()} />
          <TDivider />
          <TBtn icon={Trash2} label="Delete" onClick={() => store.getState().deleteSelected()} />
        </>
      )}
    </div>
  )
}
