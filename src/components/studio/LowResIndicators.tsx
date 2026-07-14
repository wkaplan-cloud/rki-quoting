'use client'
import { Group, Circle, Text } from 'react-konva'
import { useStudioStore } from '@/lib/studio/store'
import { isLowRes } from '@/lib/studio/printQuality'
import type { ImageObject } from '@/lib/studio/types'

// Small amber warning badge on any image stretched past a print-safe size —
// bottom-right corner (opposite SpecIndicators' top-left dot, so the two
// never collide on a spec'd fabric image). Editor-only: never rendered in
// thumbnails, presentation or PDF export, and purely informational — nothing
// to click, it just tracks the object's current width/height live.
export function LowResIndicators() {
  const slides = useStudioStore(s => s.slides)
  const currentSlideId = useStudioStore(s => s.currentSlideId)
  const zoom = useStudioStore(s => s.viewport.zoom)
  const cropTargetId = useStudioStore(s => s.cropTargetId)

  if (cropTargetId) return null
  const slide = slides.find(sl => sl.id === currentSlideId)
  if (!slide) return null

  const r = 6 / zoom

  return (
    <>
      {slide.objects
        .filter((o): o is ImageObject => o.type === 'image' && isLowRes(o))
        .map(o => (
          <Group key={o.id} x={o.x + o.width} y={o.y + o.height} rotation={o.rotation} listening={false}>
            <Circle radius={r + 2 / zoom} fill="#FFFFFF" opacity={0.9} />
            <Circle radius={r} fill="#D97706" />
            <Text
              text="!"
              fontFamily="Helvetica"
              fontStyle="bold"
              fontSize={(r * 1.3)}
              fill="#FFFFFF"
              width={r * 2}
              height={r * 2}
              offsetX={r}
              offsetY={r - (r * 0.05)}
              align="center"
              verticalAlign="middle"
            />
          </Group>
        ))}
    </>
  )
}
