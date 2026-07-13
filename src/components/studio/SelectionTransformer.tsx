'use client'
import { useEffect, useRef } from 'react'
import { Transformer } from 'react-konva'
import type Konva from 'konva'
import { useStudioStore } from '@/lib/studio/store'

export function SelectionTransformer() {
  const trRef = useRef<Konva.Transformer>(null)
  const selectedIds = useStudioStore(s => s.selectedIds)
  const currentSlideId = useStudioStore(s => s.currentSlideId)
  const slides = useStudioStore(s => s.slides)
  const cropTargetId = useStudioStore(s => s.cropTargetId)
  const editingTextId = useStudioStore(s => s.editingTextId)

  const slide = slides.find(sl => sl.id === currentSlideId)
  const selectedObjs = (slide?.objects ?? []).filter(o => selectedIds.includes(o.id))
  const anyLocked = selectedObjs.some(o => o.locked)
  const single = selectedObjs.length === 1 ? selectedObjs[0] : null

  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const stage = tr.getStage()
    if (!stage) return
    if (cropTargetId || editingTextId || anyLocked) {
      tr.nodes([])
      return
    }
    const nodes = selectedIds
      .map(id => stage.findOne(`#${id}`))
      .filter((n): n is Konva.Node => !!n)
    tr.nodes(nodes)
  }, [selectedIds, currentSlideId, slides, cropTargetId, editingTextId, anyLocked])

  const isText = single?.type === 'text'
  const isImage = single?.type === 'image'

  return (
    <Transformer
      ref={trRef}
      rotateEnabled
      keepRatio={isImage}
      enabledAnchors={
        isText
          ? ['middle-left', 'middle-right']
          : ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
      }
      anchorSize={8}
      anchorCornerRadius={4}
      anchorStroke="#9A7B4F"
      anchorFill="#FFFFFF"
      borderStroke="#9A7B4F"
      rotateAnchorOffset={24}
      flipEnabled={false}
      boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
    />
  )
}
