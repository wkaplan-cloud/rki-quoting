import { PAGE_W, PAGE_H } from './constants'

export interface SnapRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SnapCandidates {
  v: number[] // vertical guide positions (x values)
  h: number[] // horizontal guide positions (y values)
}

export interface SnapResult {
  x: number
  y: number
  guides: { v: number[]; h: number[] }
}

// Guide candidates for a drag: page edges + page centre + every other object's
// edges and centres. Built once at drag-start.
export function buildCandidates(others: SnapRect[]): SnapCandidates {
  const v = [0, PAGE_W / 2, PAGE_W]
  const h = [0, PAGE_H / 2, PAGE_H]
  for (const r of others) {
    v.push(r.x, r.x + r.width / 2, r.x + r.width)
    h.push(r.y, r.y + r.height / 2, r.y + r.height)
  }
  return { v, h }
}

// Snap a dragged rect's edges/centre to the nearest candidates within threshold.
// Returns the adjusted top-left position plus the guide lines that matched.
export function snapRect(rect: SnapRect, candidates: SnapCandidates, threshold: number): SnapResult {
  const edgesV = [rect.x, rect.x + rect.width / 2, rect.x + rect.width]
  const edgesH = [rect.y, rect.y + rect.height / 2, rect.y + rect.height]

  let bestDx: number | null = null
  let guideV: number | null = null
  for (const edge of edgesV) {
    for (const c of candidates.v) {
      const d = c - edge
      if (Math.abs(d) <= threshold && (bestDx === null || Math.abs(d) < Math.abs(bestDx))) {
        bestDx = d
        guideV = c
      }
    }
  }

  let bestDy: number | null = null
  let guideH: number | null = null
  for (const edge of edgesH) {
    for (const c of candidates.h) {
      const d = c - edge
      if (Math.abs(d) <= threshold && (bestDy === null || Math.abs(d) < Math.abs(bestDy))) {
        bestDy = d
        guideH = c
      }
    }
  }

  return {
    x: rect.x + (bestDx ?? 0),
    y: rect.y + (bestDy ?? 0),
    guides: {
      v: guideV !== null ? [guideV] : [],
      h: guideH !== null ? [guideH] : [],
    },
  }
}
