'use client'
import { Group, Circle } from 'react-konva'
import { useStudioStore } from '@/lib/studio/store'

// Subtle green dot on every object that has a Spec attached. Sits at the
// object's origin corner (which stays on the shape under rotation). Clicking
// it selects the object and opens the Specs panel. Editor-only — never
// rendered in thumbnails, presentation or PDF export.
export function SpecIndicators() {
  const slides = useStudioStore(s => s.slides)
  const currentSlideId = useStudioStore(s => s.currentSlideId)
  const specs = useStudioStore(s => s.specs)
  const zoom = useStudioStore(s => s.viewport.zoom)
  const cropTargetId = useStudioStore(s => s.cropTargetId)

  if (cropTargetId) return null
  const slide = slides.find(sl => sl.id === currentSlideId)
  if (!slide) return null

  const r = 5 / zoom

  return (
    <>
      {slide.objects
        .filter(o => specs[o.id])
        .map(o => {
          const approved = specs[o.id].status === 'approved'
          return (
            <Group
              key={o.id}
              x={o.x}
              y={o.y}
              onClick={e => {
                e.cancelBubble = true
                const store = useStudioStore.getState()
                store.setSelected([o.id])
                store.openSpecs(o.id)
              }}
              onTap={e => {
                e.cancelBubble = true
                const store = useStudioStore.getState()
                store.setSelected([o.id])
                store.openSpecs(o.id)
              }}
              onMouseEnter={e => {
                const container = e.target.getStage()?.container()
                if (container) container.style.cursor = 'pointer'
              }}
              onMouseLeave={e => {
                const container = e.target.getStage()?.container()
                if (container) container.style.cursor = 'default'
              }}
            >
              <Circle radius={r + 2 / zoom} fill="#FFFFFF" opacity={0.9} />
              <Circle radius={r} fill={approved ? '#059669' : '#34D399'} />
            </Group>
          )
        })}
    </>
  )
}
