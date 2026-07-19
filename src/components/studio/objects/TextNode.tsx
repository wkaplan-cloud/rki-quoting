'use client'
import { memo } from 'react'
import { Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useStudioStore } from '@/lib/studio/store'
import { useTextObjectFamily } from '@/lib/studio/textFonts'
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
  // Object's own font when set, board-wide content font otherwise
  const contentFontId = useStudioStore(s => s.masterLayout.contentFontId)
  const family = useTextObjectFamily(obj.fontId, contentFontId)

  // Resizing must re-wrap the text live, not stretch the glyphs: convert the
  // transformer's scale into width on every tick so the node never renders
  // scaled.
  function onTransform(e: KonvaEventObject<Event>) {
    const node = e.target
    if (node.scaleX() !== 1 || node.scaleY() !== 1) {
      node.setAttrs({
        width: Math.max(24, node.width() * node.scaleX()),
        scaleX: 1,
        scaleY: 1,
      })
    }
  }

  function onTransformEnd(e: KonvaEventObject<Event>) {
    const node = e.target
    const width = Math.max(24, node.width() * node.scaleX())
    node.scale({ x: 1, y: 1 })
    useStudioStore.getState().updateObject(obj.id, {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      width,
    })
  }

  return (
    <Text
      {...interaction}
      visible={!editing}
      text={obj.text}
      width={obj.width}
      wrap="word"
      fontSize={obj.fontSize}
      fontFamily={family}
      fontStyle={obj.fontStyle}
      textDecoration={obj.textDecoration}
      fill={obj.fill}
      align={obj.align}
      lineHeight={obj.lineHeight ?? 1.3}
      onTransform={onTransform}
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
