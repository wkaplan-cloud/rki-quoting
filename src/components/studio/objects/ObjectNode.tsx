'use client'
import { useRef, useCallback } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useStudioStore } from '@/lib/studio/store'
import { buildCandidates, snapRect, type SnapCandidates } from '@/lib/studio/snap'
import { SNAP_THRESHOLD } from '@/lib/studio/constants'
import type { StudioObject } from '@/lib/studio/types'
import { ImageNode } from './ImageNode'
import { TextNode } from './TextNode'
import { ShapeNode, LineNode, CrossNode } from './ShapeNode'

export interface ObjectNodeProps {
  obj: StudioObject
  interactive: boolean
}

// Shared interaction behaviour for every object type: select on click,
// group-drag with smart-guide snapping, commit whole gestures on drag end.
// Transform (resize/rotate) commits live in each node's onTransformEnd.
export function useObjectInteraction(obj: StudioObject, interactive: boolean) {
  const candidatesRef = useRef<SnapCandidates>({ v: [], h: [] })
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const siblingStartRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  const onSelect = useCallback(
    (e: KonvaEventObject<MouseEvent> | KonvaEventObject<Event>) => {
      if (!interactive) return
      e.cancelBubble = true
      const { selectedIds, setSelected, cropTargetId } = useStudioStore.getState()
      if (cropTargetId) return
      const multi = 'shiftKey' in e.evt && (e.evt as MouseEvent).shiftKey
      if (multi) {
        setSelected(
          selectedIds.includes(obj.id)
            ? selectedIds.filter(id => id !== obj.id)
            : [...selectedIds, obj.id]
        )
      } else if (!selectedIds.includes(obj.id)) {
        setSelected([obj.id])
      }
    },
    [obj.id, interactive]
  )

  const onDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {
    const node = e.target
    const layer = node.getLayer()
    if (!layer) return
    const { selectedIds, setSelected } = useStudioStore.getState()
    if (!selectedIds.includes(obj.id)) setSelected([obj.id])

    const stage = node.getStage()
    const selected = new Set(useStudioStore.getState().selectedIds)
    const others = (stage?.find('.studio-object') ?? []).filter(
      n => n.id() !== obj.id && !selected.has(n.id()) && n.getLayer() === layer
    )
    candidatesRef.current = buildCandidates(
      others.map(n => n.getClientRect({ relativeTo: layer as unknown as Konva.Container }))
    )
    dragStartRef.current = { x: node.x(), y: node.y() }

    // Record start positions of the other selected nodes for group drag
    siblingStartRef.current = new Map()
    for (const id of selected) {
      if (id === obj.id) continue
      const sib = stage?.findOne(`#${id}`)
      if (sib) siblingStartRef.current.set(id, { x: sib.x(), y: sib.y() })
    }
  }, [obj.id])

  const onDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    const node = e.target
    const layer = node.getLayer()
    if (!layer) return
    const { viewport, setGuides } = useStudioStore.getState()

    const rect = node.getClientRect({ relativeTo: layer as unknown as Konva.Container })
    const snapped = snapRect(rect, candidatesRef.current, SNAP_THRESHOLD / viewport.zoom)
    node.position({
      x: node.x() + (snapped.x - rect.x),
      y: node.y() + (snapped.y - rect.y),
    })
    setGuides(snapped.guides)

    // Move the rest of the selection by the same delta
    const dx = node.x() - dragStartRef.current.x
    const dy = node.y() - dragStartRef.current.y
    const stage = node.getStage()
    siblingStartRef.current.forEach((start, id) => {
      const sib = stage?.findOne(`#${id}`)
      if (sib && !sib.isDragging()) sib.position({ x: start.x + dx, y: start.y + dy })
    })
  }, [])

  const onDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const node = e.target
    const { setGuides, updateObjects } = useStudioStore.getState()
    setGuides({ v: [], h: [] })

    const dx = node.x() - dragStartRef.current.x
    const dy = node.y() - dragStartRef.current.y
    const patches: { id: string; patch: Partial<StudioObject> }[] = [
      { id: obj.id, patch: { x: node.x(), y: node.y() } },
    ]
    siblingStartRef.current.forEach((start, id) => {
      patches.push({ id, patch: { x: start.x + dx, y: start.y + dy } })
    })
    updateObjects(patches)
    siblingStartRef.current = new Map()
  }, [obj.id])

  return {
    id: obj.id,
    name: 'studio-object',
    x: obj.x,
    y: obj.y,
    rotation: obj.rotation,
    opacity: obj.opacity,
    draggable: interactive && !obj.locked,
    listening: interactive,
    onMouseDown: onSelect,
    onTouchStart: onSelect,
    onDragStart,
    onDragMove,
    onDragEnd,
  }
}

export function ObjectNode({ obj, interactive }: ObjectNodeProps) {
  switch (obj.type) {
    case 'image':
      return <ImageNode obj={obj} interactive={interactive} />
    case 'text':
      return <TextNode obj={obj} interactive={interactive} />
    case 'rect':
    case 'ellipse':
      return <ShapeNode obj={obj} interactive={interactive} />
    case 'line':
    case 'arrow':
      return <LineNode obj={obj} interactive={interactive} />
    case 'cross':
      return <CrossNode obj={obj} interactive={interactive} />
    default:
      return null
  }
}
