'use client'
import type { RefObject } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import type Konva from 'konva'
import { PAGE_W, PAGE_H } from '@/lib/studio/constants'
import { useStudioStore } from '@/lib/studio/store'
import type { StudioSlide } from '@/lib/studio/types'
import { MasterGroup } from './MasterLayer'
import { ObjectNode } from './objects/ObjectNode'
import { getMasterTheme } from '@/lib/studio/masterThemes'

// Read-only rendering of one slide, used by thumbnails, presentation mode and
// PDF export. Renders the identical component tree the editor uses (objects +
// master group) in the same 1191×842 coordinate space — only the scale differs.
export function StaticSlideStage({
  slide,
  pageNumber,
  pageCount,
  width,
  stageRef,
}: {
  slide: StudioSlide
  pageNumber: number
  pageCount: number
  width: number
  stageRef?: RefObject<Konva.Stage | null>
}) {
  const clientName = useStudioStore(s => s.clientName)
  const logoUrl = useStudioStore(s => s.logoUrl)
  const masterLayout = useStudioStore(s => s.masterLayout)
  const scale = width / PAGE_W
  const pageBackground = masterLayout.enabled ? getMasterTheme(masterLayout.themeId).background : '#FFFFFF'

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={PAGE_H * scale}
      scaleX={scale}
      scaleY={scale}
      listening={false}
    >
      <Layer listening={false}>
        <Rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill={pageBackground} />
        {slide.objects.map(obj => (
          <ObjectNode key={obj.id} obj={obj} interactive={false} />
        ))}
        {!slide.isCover && (
          <MasterGroup
            title={clientName}
            heading={slide.heading}
            pageNumber={pageNumber}
            pageCount={pageCount}
            logoUrl={logoUrl}
          />
        )}
      </Layer>
    </Stage>
  )
}
