import { PAGE_W } from './constants'

const GUTTER = 16

export interface CellPlacement {
  x: number
  y: number
  width: number
  height: number
}

export interface ContentArea {
  x: number
  y: number
  width: number
  height: number
}

// Arrange n images into a neat grid inside the usable page area (the master
// layout/theme's safe content area, passed in by the caller so placement
// always matches whichever margins are actually active for that board).
// Each image is contain-fitted to its cell and centred. Deterministic — one
// undo step for a whole multi-import.
export function gridPlacements(sizes: { width: number; height: number }[], area: ContentArea): CellPlacement[] {
  const n = sizes.length
  const areaX = area.x
  const areaY = area.y
  const areaW = area.width
  const areaH = area.height

  if (n === 1) {
    // Single image: fit within 40% of page width (or full usable height)
    const maxW = PAGE_W * 0.4
    const maxH = areaH * 0.8
    const s = Math.min(maxW / sizes[0].width, maxH / sizes[0].height, 1_000)
    const w = sizes[0].width * s
    const h = sizes[0].height * s
    return [{ x: (PAGE_W - w) / 2, y: areaY + (areaH - h) / 2, width: w, height: h }]
  }

  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  const cellW = (areaW - GUTTER * (cols - 1)) / cols
  const cellH = (areaH - GUTTER * (rows - 1)) / rows

  return sizes.map((size, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const scale = Math.min(cellW / size.width, cellH / size.height)
    const w = size.width * scale
    const h = size.height * scale
    return {
      x: areaX + col * (cellW + GUTTER) + (cellW - w) / 2,
      y: areaY + row * (cellH + GUTTER) + (cellH - h) / 2,
      width: w,
      height: h,
    }
  })
}
