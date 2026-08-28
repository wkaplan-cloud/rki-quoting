'use client'
import { useState, type RefObject } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { PAGE_W, PAGE_H } from '@/lib/studio/constants'
import { zoomAt, isMouseWheel } from '@/lib/studio/viewport'
import { useStudioStore } from '@/lib/studio/store'
import { MasterGroup } from './MasterLayer'
import { getMasterTheme } from '@/lib/studio/masterThemes'
import { ObjectNode } from './objects/ObjectNode'
import { SelectionTransformer } from './SelectionTransformer'
import { SmartGuides } from './SmartGuides'
import { CropOverlay } from './CropOverlay'
import { SpecIndicators } from './SpecIndicators'
import { LowResIndicators } from './LowResIndicators'

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
  const [panning, setPanning] = useState(false)

  const slideIndex = slides.findIndex(sl => sl.id === currentSlideId)
  const slide = slides[slideIndex]
  const pageBackground = getMasterTheme(masterLayout.themeId).background

  function onWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    // ⌘/Ctrl (or pinch, which browsers report as ctrl+wheel) always zooms; a
    // plain mouse wheel zooms too, since that is the only zoom gesture a mouse
    // has. Trackpad two-finger scroll keeps panning.
    if (e.evt.ctrlKey || e.evt.metaKey || isMouseWheel(e.evt)) {
      const pointer = stageRef.current?.getPointerPosition()
      if (!pointer) return
      // Wheel ticks are far coarser than trackpad deltas — damp them so one
      // notch is a step, not a jump
      const intensity = isMouseWheel(e.evt) && !e.evt.ctrlKey && !e.evt.metaKey ? 0.0012 : 0.0018
      setViewport(zoomAt(viewport, viewport.zoom * Math.exp(-e.evt.deltaY * intensity), pointer))
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
    setPanning(false)
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
      onDragStart={e => {
        if (e.target === stageRef.current) setPanning(true)
      }}
      onDragEnd={onStageDragEnd}
      style={{ cursor: panMode ? (panning ? 'grabbing' : 'grab') : 'default' }}
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
