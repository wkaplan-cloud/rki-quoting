'use client'
import { memo } from 'react'
import { Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useStudioStore } from '@/lib/studio/store'
import type { TextObject } from '@/lib/studio/types'
import { useObjectInteraction } from './ObjectNode'

export const TextNode = memo(function TextNode({
  obj,
  interactive,
}: {
  obj: TextObject
  interactive: boolean
}) {
  const interaction = useObjectInteraction(obj, interactive)
  const editing = useStudioStore(s => s.editingTextId === obj.id)

  function onTransformEnd(e: KonvaEventObject<Event>) {
    const node = e.target
    const scaleX = node.scaleX()
    node.scale({ x: 1, y: 1 })
    useStudioStore.getState().updateObject(obj.id, {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      width: Math.max(24, obj.width * scaleX),
    })
  }

  return (
    <Text
      {...interaction}
      visible={!editing}
      text={obj.text}
      width={obj.width}
      fontSize={obj.fontSize}
      fontFamily={obj.fontFamily}
      fontStyle={obj.fontStyle}
      textDecoration={obj.textDecoration}
      fill={obj.fill}
      align={obj.align}
      lineHeight={1.3}
      onTransformEnd={onTransformEnd}
      onDblClick={
        interactive && !obj.locked
          ? () => useStudioStore.getState().setEditingText(obj.id)
          : undefined
      }
      onDblTap={
        interactive && !obj.locked
          ? () => useStudioStore.getState().setEditingText(obj.id)
          : undefined
      }
    />
  )
})
