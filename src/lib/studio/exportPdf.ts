'use client'
import { PAGE_W, PAGE_H } from './constants'
import { loadImage } from './images'
import { ensureMasterFontsLoaded, ensureFontFamilyLoaded } from './masterFonts'
import { getContentFont } from './contentFonts'
import { useStudioStore } from './store'
import type { StudioSlide } from './types'

// Preload every image referenced by the board (plus the org logo) into the
// shared cache so export stages render complete on first paint. Also force
// -loads the Master Page's Playfair/Inter fonts and the board's chosen
// content font — without this, `document.fonts.ready` below is a no-op on
// this route (nothing else here ever triggers these @font-face fetches),
// and the export could silently rasterize text in a fallback font.
export async function preloadBoardImages(slides: StudioSlide[], logoUrl: string | null): Promise<void> {
  const urls = new Set<string>()
  if (logoUrl) urls.add(logoUrl)
  for (const slide of slides) {
    for (const obj of slide.objects) {
      if (obj.type === 'image') urls.add(obj.url)
    }
  }
  await Promise.all(Array.from(urls).map(url => loadImage(url).catch(() => null)))
  const contentFont = getContentFont(useStudioStore.getState().masterLayout.contentFontId)
  await Promise.all([ensureMasterFontsLoaded(), ensureFontFamilyLoaded(contentFont.cssVar)])
  await document.fonts.ready
}

// Assemble an A3 landscape PDF from per-slide raster renders. `renderSlide`
// must resolve to a JPEG data URL of the full page (provided by ExportRunner,
// which renders each slide into a hidden Konva stage). Slides are rendered
// sequentially — high-DPI rasters are ~64MB of RGBA each.
//
// `slideIndices` is the board's own slide indices to include, in order (not
// necessarily 0..N-1 or contiguous) — this is what lets a caller print only a
// selected subset while `renderSlide(i)` still renders each one at its
// original position, so the footer page number ("12 / 40") always reflects
// where that slide actually sits in the full board, not its position within
// the subset. Returns the assembled document — saving to disk vs. opening it
// for printing is the caller's call, not this function's.
export async function assemblePdf(
  slideIndices: number[],
  renderSlide: (index: number) => Promise<string>,
  onProgress?: (done: number, total: number) => void
) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  for (let n = 0; n < slideIndices.length; n++) {
    if (n > 0) pdf.addPage('a3', 'landscape')
    const dataUrl = await renderSlide(slideIndices[n])
    pdf.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH)
    onProgress?.(n + 1, slideIndices.length)
  }

  return pdf
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
