'use client'
import { memo } from 'react'
import { Group, Rect, Ellipse, Line, Arrow } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useStudioStore } from '@/lib/studio/store'
import type { RectObject, EllipseObject, LineObject, CrossObject } from '@/lib/studio/types'
import { useObjectInteraction } from './ObjectNode'

// Rect + ellipse share a Group root so both rotate/resize around the same
// top-left origin as every other object type.
export const ShapeNode = memo(function ShapeNode({
  obj,
  interactive,
}: {
  obj: RectObject | EllipseObject
  interactive: boolean
}) {
  const interaction = useObjectInteraction(obj, interactive)

  function onTransformEnd(e: KonvaEventObject<Event>) {
    const node = e.currentTarget
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

  return (
    <Group {...interaction} onTransformEnd={onTransformEnd}>
      {obj.type === 'rect' ? (
        <Rect
          width={obj.width}
          height={obj.height}
          fill={obj.fill}
          stroke={obj.strokeWidth ? obj.stroke : undefined}
          strokeWidth={obj.strokeWidth}
          cornerRadius={obj.cornerRadius}
          listening={interactive}
        />
      ) : (
        <Ellipse
          x={obj.width / 2}
          y={obj.height / 2}
          radiusX={obj.width / 2}
          radiusY={obj.height / 2}
          fill={obj.fill}
          stroke={obj.strokeWidth ? obj.stroke : undefined}
          strokeWidth={obj.strokeWidth}
          listening={interactive}
        />
      )}
    </Group>
  )
})

// ✕ mark: two strokes across the object's width × height box, resizing like
// a rect so it can be squashed or stretched over whatever it's marking.
export const CrossNode = memo(function CrossNode({
  obj,
  interactive,
}: {
  obj: CrossObject
  interactive: boolean
}) {
  const interaction = useObjectInteraction(obj, interactive)

  function onTransformEnd(e: KonvaEventObject<Event>) {
    const node = e.currentTarget
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

  const common = {
    stroke: obj.stroke,
    strokeWidth: obj.strokeWidth,
    lineCap: 'round' as const,
    hitStrokeWidth: 16,
    listening: interactive,
  }

  return (
    <Group {...interaction} onTransformEnd={onTransformEnd}>
      <Line {...common} points={[0, 0, obj.width, obj.height]} />
      <Line {...common} points={[obj.width, 0, 0, obj.height]} />
    </Group>
  )
})

export const LineNode = memo(function LineNode({
  obj,
  interactive,
}: {
  obj: LineObject
  interactive: boolean
}) {
  const interaction = useObjectInteraction(obj, interactive)

  function onTransformEnd(e: KonvaEventObject<Event>) {
    const node = e.currentTarget
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scale({ x: 1, y: 1 })
    const [x1, y1, x2, y2] = obj.points
    useStudioStore.getState().updateObject(obj.id, {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      points: [x1 * scaleX, y1 * scaleY, x2 * scaleX, y2 * scaleY],
    })
  }

  const common = {
    points: obj.points as unknown as number[],
    stroke: obj.stroke,
    strokeWidth: obj.strokeWidth,
    hitStrokeWidth: 16,
    listening: interactive,
  }

  return (
    <Group {...interaction} onTransformEnd={onTransformEnd}>
      {obj.type === 'arrow' ? (
        <Arrow {...common} fill={obj.stroke} pointerLength={12} pointerWidth={12} />
      ) : (
        <Line {...common} />
      )}
    </Group>
  )
})
