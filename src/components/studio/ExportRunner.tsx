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
//
// `slideIds` restricts the run to a subset (in board order) — omit it to
// include every slide. `mode: 'print'` opens the assembled PDF in a new tab
// and requests the system print dialog instead of downloading it; page
// numbers still reflect each slide's original position in the full board
// (see assemblePdf), not its position within the printed subset.
export function ExportRunner({
  onDone,
  slideIds,
  mode = 'download',
}: {
  onDone: () => void
  slideIds?: string[]
  mode?: 'download' | 'print'
}) {
  const [renderIndex, setRenderIndex] = useState(-1)
  const stageRef = useRef<Konva.Stage | null>(null)
  const resolveRef = useRef<((dataUrl: string) => void) | null>(null)
  const rejectRef = useRef<((err: Error) => void) | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const { slides, logoUrl, clientName, boardName, flushSave } = useStudioStore.getState()
    const indices = slideIds
      ? slides.reduce<number[]>((acc, s, i) => (slideIds.includes(s.id) ? [...acc, i] : acc), [])
      : slides.map((_, i) => i)
    const toastId = toast.loading(mode === 'print' ? 'Preparing print…' : 'Preparing export…')

    ;(async () => {
      await flushSave()
      await preloadBoardImages(slides, logoUrl)
      const pdf = await assemblePdf(
        indices,
        i =>
          new Promise<string>((resolve, reject) => {
            resolveRef.current = resolve
            rejectRef.current = reject
            setRenderIndex(i)
          }),
        (done, total) => toast.loading(`Rendering slide ${done} of ${total}…`, { id: toastId })
      )
      if (mode === 'print') {
        const blobUrl = pdf.output('bloburl') as unknown as string
        const win = window.open(blobUrl, '_blank')
        if (win) {
          toast.success("Opened print preview — press ⌘/Ctrl+P if the dialog doesn't appear", { id: toastId })
          // The PDF viewer inside the new tab loads asynchronously — give it a
          // moment before requesting print; some browsers block/ignore this
          // scripted call anyway, which is why the toast above is the actual
          // fallback instruction, not this.
          setTimeout(() => {
            try {
              win.print()
            } catch {
              // ignored — user still has the tab open to print manually
            }
          }, 700)
        } else {
          toast.error('Pop-up blocked — allow pop-ups for this site to print', { id: toastId })
        }
      } else {
        pdf.save(`${clientName || 'Client'} – ${boardName || 'Presentation'}.pdf`)
        toast.success('PDF exported', { id: toastId })
      }
    })()
      .catch((err: Error) => {
        toast.error(err.message || (mode === 'print' ? 'Print failed' : 'Export failed'), { id: toastId })
      })
      .finally(onDone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
