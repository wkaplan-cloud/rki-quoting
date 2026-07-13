'use client'
import { PAGE_W, PAGE_H } from './constants'
import { loadImage } from './images'
import type { StudioSlide } from './types'

// Preload every image referenced by the board (plus the org logo) into the
// shared cache so export stages render complete on first paint.
export async function preloadBoardImages(slides: StudioSlide[], logoUrl: string | null): Promise<void> {
  const urls = new Set<string>()
  if (logoUrl) urls.add(logoUrl)
  for (const slide of slides) {
    for (const obj of slide.objects) {
      if (obj.type === 'image') urls.add(obj.url)
    }
  }
  await Promise.all(Array.from(urls).map(url => loadImage(url).catch(() => null)))
  await document.fonts.ready
}

// Assemble an A3 landscape PDF from per-slide raster renders. `renderSlide`
// must resolve to a JPEG data URL of the full page (provided by ExportRunner,
// which renders each slide into a hidden Konva stage). Slides are rendered
// sequentially — high-DPI rasters are ~64MB of RGBA each.
export async function assemblePdf(
  slideCount: number,
  renderSlide: (index: number) => Promise<string>,
  fileName: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  for (let i = 0; i < slideCount; i++) {
    if (i > 0) pdf.addPage('a3', 'landscape')
    const dataUrl = await renderSlide(i)
    pdf.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH)
    onProgress?.(i + 1, slideCount)
  }

  pdf.save(fileName)
}

// Render a Konva stage to a high-resolution JPEG. pixelRatio 4 on the
// 1191×842pt page gives ~288dpi; falls back to 3 (~216dpi) if the canvas is
// too large for the device.
export function stageToJpeg(stage: { toDataURL: (o: object) => string }): string {
  for (const pixelRatio of [4, 3]) {
    try {
      const url = stage.toDataURL({
        x: 0,
        y: 0,
        width: PAGE_W,
        height: PAGE_H,
        pixelRatio,
        mimeType: 'image/jpeg',
        quality: 0.92,
      })
      if (url && url.length > 100) return url
    } catch {
      // canvas too large — retry at the lower ratio
    }
  }
  throw new Error('Could not render slide for export')
}
