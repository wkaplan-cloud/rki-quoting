'use client'
import { Line } from 'react-konva'
import { PAGE_W, PAGE_H } from '@/lib/studio/constants'
import { useStudioStore } from '@/lib/studio/store'

// Draws the alignment guide lines produced by drag snapping (snap.ts)
export function SmartGuides() {
  const guides = useStudioStore(s => s.guides)
  const zoom = useStudioStore(s => s.viewport.zoom)
  const w = 1 / zoom

  return (
    <>
      {guides.v.map(x => (
        <Line key={`v${x}`} points={[x, 0, x, PAGE_H]} stroke="#E8735A" strokeWidth={w} dash={[4 / zoom, 4 / zoom]} listening={false} />
      ))}
      {guides.h.map(y => (
        <Line key={`h${y}`} points={[0, y, PAGE_W, y]} stroke="#E8735A" strokeWidth={w} dash={[4 / zoom, 4 / zoom]} listening={false} />
      ))}
    </>
  )
}
