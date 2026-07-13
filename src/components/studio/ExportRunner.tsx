'use client'
import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import toast from 'react-hot-toast'
import { PAGE_W } from '@/lib/studio/constants'
import { useStudioStore } from '@/lib/studio/store'
import { preloadBoardImages, assemblePdf, stageToJpeg } from '@/lib/studio/exportPdf'
import { StaticSlideStage } from './StaticSlideStage'

// Renders each slide into a hidden full-size stage, rasterises it at high DPI
// and assembles the PDF — sequentially, to keep peak memory at one slide.
export function ExportRunner({ onDone }: { onDone: () => void }) {
  const [renderIndex, setRenderIndex] = useState(-1)
  const stageRef = useRef<Konva.Stage | null>(null)
  const resolveRef = useRef<((dataUrl: string) => void) | null>(null)
  const rejectRef = useRef<((err: Error) => void) | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const { slides, logoUrl, clientName, boardName, flushSave } = useStudioStore.getState()
    const toastId = toast.loading('Preparing export…')

    ;(async () => {
      await flushSave()
      await preloadBoardImages(slides, logoUrl)
      await assemblePdf(
        slides.length,
        i =>
          new Promise<string>((resolve, reject) => {
            resolveRef.current = resolve
            rejectRef.current = reject
            setRenderIndex(i)
          }),
        `${clientName || 'Client'} – ${boardName || 'Presentation'}.pdf`,
        (done, total) => toast.loading(`Rendering slide ${done} of ${total}…`, { id: toastId })
      )
      toast.success('PDF exported', { id: toastId })
    })()
      .catch((err: Error) => {
        toast.error(err.message || 'Export failed', { id: toastId })
      })
      .finally(onDone)
  }, [onDone])

  // After the hidden stage paints the requested slide, snapshot it.
  // Images are pre-cached, so the first paint is already complete — the
  // double rAF just guarantees Konva has drawn.
  useEffect(() => {
    if (renderIndex < 0) return
    let cancelled = false
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (cancelled) return
        const stage = stageRef.current
        const resolve = resolveRef.current
        const reject = rejectRef.current
        if (!stage || !resolve) return
        try {
          resolve(stageToJpeg(stage))
        } catch (err) {
          reject?.(err as Error)
        }
      })
    )
    return () => {
      cancelled = true
    }
  }, [renderIndex])

  const slides = useStudioStore(s => s.slides)
  const slide = renderIndex >= 0 ? slides[renderIndex] : null
  if (!slide) return null

  return (
    <div style={{ position: 'fixed', left: -20000, top: 0 }} aria-hidden>
      <StaticSlideStage
        slide={slide}
        pageNumber={renderIndex + 1}
        pageCount={slides.length}
        width={PAGE_W}
        stageRef={stageRef}
      />
    </div>
  )
}
