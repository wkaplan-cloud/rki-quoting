'use client'
import type { RefObject } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { PAGE_W, PAGE_H } from '@/lib/studio/constants'
import { useStudioStore } from '@/lib/studio/store'
import { MasterGroup } from './MasterLayer'
import { getMasterTheme } from '@/lib/studio/masterThemes'
import { ObjectNode } from './objects/ObjectNode'
import { SelectionTransformer } from './SelectionTransformer'
import { SmartGuides } from './SmartGuides'
import { CropOverlay } from './CropOverlay'
import { SpecIndicators } from './SpecIndicators'
import { LowResIndicators } from './LowResIndicators'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 4

// The interactive A3 stage. The stage itself is scaled/positioned by the
// viewport, so all child coordinates stay in page points.
export function CanvasStage({
  size,
  panMode,
  stageRef,
}: {
  size: { w: number; h: number }
  panMode: boolean
  stageRef: RefObject<Konva.Stage | null>
}) {
  const viewport = useStudioStore(s => s.viewport)
  const setViewport = useStudioStore(s => s.setViewport)
  const slides = useStudioStore(s => s.slides)
  const currentSlideId = useStudioStore(s => s.currentSlideId)
  const logoUrl = useStudioStore(s => s.logoUrl)
  const cropTargetId = useStudioStore(s => s.cropTargetId)
  const editingHeading = useStudioStore(s => s.editingHeading)
  const masterLayout = useStudioStore(s => s.masterLayout)

  const slideIndex = slides.findIndex(sl => sl.id === currentSlideId)
  const slide = slides[slideIndex]
  const pageBackground = getMasterTheme(masterLayout.themeId).background

  function onWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const stage = stageRef.current
      const pointer = stage?.getPointerPosition()
      if (!pointer) return
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * Math.exp(-e.evt.deltaY * 0.0018)))
      // Keep the page point under the cursor fixed while zooming
      const pageX = (pointer.x - viewport.x) / viewport.zoom
      const pageY = (pointer.y - viewport.y) / viewport.zoom
      setViewport({ zoom: newZoom, x: pointer.x - pageX * newZoom, y: pointer.y - pageY * newZoom })
    } else {
      setViewport({ ...viewport, x: viewport.x - e.evt.deltaX, y: viewport.y - e.evt.deltaY })
    }
  }

  function onStageMouseDown(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (panMode || cropTargetId) return
    const target = e.target
    if (target === target.getStage() || target.name() === 'page-bg') {
      useStudioStore.getState().setSelected([])
    }
  }

  function onStageDragEnd(e: KonvaEventObject<DragEvent>) {
    // Only the stage itself drags in pan mode
    if (e.target !== stageRef.current) return
    setViewport({ ...viewport, x: e.target.x(), y: e.target.y() })
  }

  if (!slide) return null

  return (
    <Stage
      ref={stageRef}
      width={size.w}
      height={size.h}
      scaleX={viewport.zoom}
      scaleY={viewport.zoom}
      x={viewport.x}
      y={viewport.y}
      draggable={panMode}
      onWheel={onWheel}
      onMouseDown={onStageMouseDown}
      onTouchStart={onStageMouseDown}
      onDragEnd={onStageDragEnd}
      style={{ cursor: panMode ? 'grab' : 'default' }}
    >
      <Layer listening={!panMode && !cropTargetId}>
        <Rect
          name="page-bg"
          x={0}
          y={0}
          width={PAGE_W}
          height={PAGE_H}
          fill={pageBackground}
          shadowColor="rgba(26,26,24,0.25)"
          shadowBlur={24}
          shadowOffsetY={6}
        />
        {slide.objects.map(obj => (
          <ObjectNode key={obj.id} obj={obj} interactive />
        ))}
        <MasterGroup
          heading={slide.heading}
          pageNumber={slideIndex + 1}
          logoUrl={logoUrl}
          interactive
          hideHeading={editingHeading}
          onHeadingDblClick={() => useStudioStore.getState().setEditingHeading(true)}
          borderOnly={slide.isCover}
        />
      </Layer>
      <Layer>
        <SpecIndicators />
        <LowResIndicators />
        <SmartGuides />
        <SelectionTransformer />
        <CropOverlay />
      </Layer>
    </Stage>
  )
}
