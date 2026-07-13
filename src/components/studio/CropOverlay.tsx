'use client'
import { useEffect, useRef, useState } from 'react'
import { Group, Image as KonvaImage, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import { PAGE_W, PAGE_H } from '@/lib/studio/constants'
import { useStudioStore } from '@/lib/studio/store'
import { useKonvaImage } from '@/lib/studio/images'
import type { ImageObject } from '@/lib/studio/types'

// FloatingToolbar drives Apply/Cancel through this module-scoped controller —
// the crop draft itself lives inside the overlay component.
export const cropController = {
  apply: () => {},
  cancel: () => {},
}

interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

// Crop editing happens in the OBJECT'S LOCAL SPACE (a group at the object's
// position/rotation), so a rotated image crops correctly. The full source
// image shows dimmed; the crop rect starts as the current visible frame.
export function CropOverlay() {
  const cropTargetId = useStudioStore(s => s.cropTargetId)
  const currentSlideId = useStudioStore(s => s.currentSlideId)
  const slides = useStudioStore(s => s.slides)

  const slide = slides.find(sl => sl.id === currentSlideId)
  const obj = slide?.objects.find(o => o.id === cropTargetId && o.type === 'image') as
    | ImageObject
    | undefined

  if (!obj) return null
  return <CropEditor obj={obj} />
}

function CropEditor({ obj }: { obj: ImageObject }) {
  const image = useKonvaImage(obj.url)
  const rectRef = useRef<Konva.Rect>(null)
  const trRef = useRef<Konva.Transformer>(null)

  const srcCrop = obj.crop ?? { x: 0, y: 0, width: obj.naturalWidth, height: obj.naturalHeight }
  // Display scale: source pixels → local page units
  const sx = obj.width / srcCrop.width
  const sy = obj.height / srcCrop.height
  // Full image placement in local space so the current crop region sits at (0,0)
  const imgX = -srcCrop.x * sx
  const imgY = -srcCrop.y * sy
  const imgW = obj.naturalWidth * sx
  const imgH = obj.naturalHeight * sy

  const [rect, setRect] = useState<CropRect>({ x: 0, y: 0, width: obj.width, height: obj.height })

  useEffect(() => {
    const tr = trRef.current
    const node = rectRef.current
    if (tr && node) tr.nodes([node])
  }, [])

  useEffect(() => {
    cropController.apply = () => {
      const store = useStudioStore.getState()
      const newCrop = {
        x: srcCrop.x + rect.x / sx,
        y: srcCrop.y + rect.y / sy,
        width: rect.width / sx,
        height: rect.height / sy,
      }
      // The rect's local offset, rotated into page space, moves the object origin
      const rad = (obj.rotation * Math.PI) / 180
      const dx = rect.x * Math.cos(rad) - rect.y * Math.sin(rad)
      const dy = rect.x * Math.sin(rad) + rect.y * Math.cos(rad)
      store.updateObject(obj.id, {
        x: obj.x + dx,
        y: obj.y + dy,
        width: rect.width,
        height: rect.height,
        crop: newCrop,
      } as Partial<ImageObject>)
      store.setCropTarget(null)
    }
    cropController.cancel = () => {
      useStudioStore.getState().setCropTarget(null)
    }
    return () => {
      cropController.apply = () => {}
      cropController.cancel = () => {}
    }
  }, [rect, obj, srcCrop.x, srcCrop.y, sx, sy])

  const clamp = (r: CropRect): CropRect => ({
    x: Math.max(imgX, Math.min(r.x, imgX + imgW - r.width)),
    y: Math.max(imgY, Math.min(r.y, imgY + imgH - r.height)),
    width: Math.min(r.width, imgW),
    height: Math.min(r.height, imgH),
  })

  if (!image) return null

  return (
    <>
      {/* Dim everything outside the crop editor */}
      <Rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill="rgba(26,26,24,0.5)" listening={false} />
      <Group x={obj.x} y={obj.y} rotation={obj.rotation}>
        {/* Full source image, dimmed */}
        <KonvaImage image={image} x={imgX} y={imgY} width={imgW} height={imgH} opacity={0.4} listening={false} />
        {/* Bright copy clipped to the crop rect */}
        <Group
          clipFunc={ctx => {
            ctx.rect(rect.x, rect.y, rect.width, rect.height)
          }}
        >
          <KonvaImage image={image} x={imgX} y={imgY} width={imgW} height={imgH} listening={false} />
        </Group>
        <Rect
          ref={rectRef}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          stroke="#FFFFFF"
          strokeWidth={1.5}
          dash={[6, 4]}
          draggable
          onDragMove={e => {
            const node = e.target
            const next = clamp({ ...rect, x: node.x(), y: node.y() })
            node.position({ x: next.x, y: next.y })
            setRect(next)
          }}
          onTransform={e => {
            const node = e.target
            const next = clamp({
              x: node.x(),
              y: node.y(),
              width: Math.max(16, node.width() * node.scaleX()),
              height: Math.max(16, node.height() * node.scaleY()),
            })
            node.setAttrs({ ...next, scaleX: 1, scaleY: 1 })
            setRect(next)
          }}
        />
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          keepRatio={false}
          flipEnabled={false}
          anchorSize={8}
          anchorCornerRadius={4}
          anchorStroke="#FFFFFF"
          anchorFill="#1A1A18"
          borderEnabled={false}
        />
      </Group>
    </>
  )
}
