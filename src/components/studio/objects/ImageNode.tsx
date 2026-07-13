'use client'
import { memo } from 'react'
import { Image as KonvaImage, Rect } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useStudioStore } from '@/lib/studio/store'
import { useKonvaImage } from '@/lib/studio/images'
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
    <KonvaImage
      {...interaction}
      image={image}
      width={obj.width}
      height={obj.height}
      crop={obj.crop}
      stroke={obj.borderWidth ? (obj.borderColor ?? '#2C2C2A') : undefined}
      strokeWidth={obj.borderWidth ?? 0}
      onTransformEnd={onTransformEnd}
      onDblClick={interactive ? () => useStudioStore.getState().setCropTarget(obj.id) : undefined}
    />
  )
})
