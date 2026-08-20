'use client'
import { memo } from 'react'
import { Image as KonvaImage, Rect, Group, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useStudioStore } from '@/lib/studio/store'
import { useKonvaImage } from '@/lib/studio/images'
import { isPendingUrl, pendingId } from '@/lib/studio/offlineUploads'
import type { ImageObject } from '@/lib/studio/types'
import { useObjectInteraction } from './ObjectNode'

export const ImageNode = memo(function ImageNode({
  obj,
  interactive,
}: {
  obj: ImageObject
  interactive: boolean
}) {
  const interaction = useObjectInteraction(obj, interactive)
  const image = useKonvaImage(obj.url)
  const cropping = useStudioStore(s => s.cropTargetId === obj.id)
  // 0 = not processing; otherwise the current zoom, for zoom-independent
  // overlay text. One selector so idle images never re-render on zoom.
  const processingZoom = useStudioStore(s =>
    s.bgRemoval[obj.id] === 'processing' ? s.viewport.zoom : 0
  )
  // Added while offline: the picture is real (drawn from the queued blob) but
  // the file has not reached storage yet. Same zoom-independent trick as above
  // so the badge stays legible at any zoom, and 0 when there is nothing to say.
  const queued = isPendingUrl(obj.url)
  const failed = useStudioStore(s => queued && s.failedUploadIds.includes(pendingId(obj.url)))
  const queuedZoom = useStudioStore(s => (queued ? s.viewport.zoom : 0))

  function onTransformEnd(e: KonvaEventObject<Event>) {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scale({ x: 1, y: 1 })
    useStudioStore.getState().updateObject(obj.id, {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      width: Math.max(8, obj.width * scaleX),
      height: Math.max(8, obj.height * scaleY),
    })
  }

  // While cropping, CropOverlay renders the image itself
  if (cropping) return null

  if (!image) {
    // Placeholder frame while the bitmap loads
    return (
      <Rect
        {...interaction}
        width={obj.width}
        height={obj.height}
        fill="#EDE9E1"
        stroke="#D8D3C8"
        strokeWidth={1}
      />
    )
  }

  return (
    <>
      <KonvaImage
        {...interaction}
        image={image}
        width={obj.width}
        height={obj.height}
        crop={obj.crop}
        perfectDrawEnabled={false}
        stroke={obj.borderWidth ? (obj.borderColor ?? '#2C2C2A') : undefined}
        strokeWidth={obj.borderWidth ?? 0}
        onTransformEnd={onTransformEnd}
        onDblClick={interactive ? () => useStudioStore.getState().setCropTarget(obj.id) : undefined}
      />
      {/* Queued upload marker — editor-only, never exported, never clickable */}
      {interactive && queuedZoom > 0 && (
        <Group x={obj.x} y={obj.y} rotation={obj.rotation} listening={false}>
          <Rect
            x={6 / queuedZoom}
            y={6 / queuedZoom}
            width={112 / queuedZoom}
            height={18 / queuedZoom}
            cornerRadius={4 / queuedZoom}
            fill={failed ? '#B4462F' : '#1A1A18'}
            opacity={0.75}
          />
          <Text
            text={failed ? 'Upload failed' : 'Uploads when online'}
            x={6 / queuedZoom}
            y={11 / queuedZoom}
            width={112 / queuedZoom}
            align="center"
            fontSize={9 / queuedZoom}
            fill="#FFFFFF"
          />
        </Group>
      )}

      {/* Subtle veil while the background is being removed — editor-only,
          never blocks interaction (listening false), never exported */}
      {interactive && processingZoom > 0 && (
        <Group
          x={obj.x}
          y={obj.y}
          rotation={obj.rotation}
          listening={false}
          opacity={obj.opacity}
        >
          <Rect width={obj.width} height={obj.height} fill="#FFFFFF" opacity={0.45} />
          <Text
            text="Removing background…"
            width={obj.width}
            y={obj.height / 2 - 6 / processingZoom}
            align="center"
            fontSize={11 / processingZoom}
            fill="#2C2C2A"
          />
        </Group>
      )}
    </>
  )
})
