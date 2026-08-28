import { PAGE_W, PAGE_H, MIN_ZOOM, MAX_ZOOM, ZOOM_PRESETS, FIT_PADDING_X, FIT_PADDING_Y } from './constants'
import type { Viewport } from './store'

export type ViewSize = { w: number; h: number }

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

// Re-zoom while keeping the page point under `anchor` (container pixels)
// pinned in place — the wheel and pinch behaviour.
export function zoomAt(viewport: Viewport, zoom: number, anchor: { x: number; y: number }): Viewport {
  const next = clampZoom(zoom)
  const pageX = (anchor.x - viewport.x) / viewport.zoom
  const pageY = (anchor.y - viewport.y) / viewport.zoom
  return { zoom: next, x: anchor.x - pageX * next, y: anchor.y - pageY * next }
}

// Same, anchored on the middle of the canvas — what the ± buttons and ⌘+/⌘−
// use, since there is no cursor to zoom towards.
export function zoomAtCentre(viewport: Viewport, zoom: number, size: ViewSize): Viewport {
  return zoomAt(viewport, zoom, { x: size.w / 2, y: size.h / 2 })
}

// The whole page, centred, with breathing room — first open and ⌘0.
export function fitViewport(size: ViewSize): Viewport {
  const zoom = clampZoom(
    Math.min((size.w - FIT_PADDING_X) / PAGE_W, (size.h - FIT_PADDING_Y) / PAGE_H)
  )
  return { zoom, x: (size.w - PAGE_W * zoom) / 2, y: (size.h - PAGE_H * zoom) / 2 + 16 }
}

// Centre the page at an exact zoom — the menu presets and ⌘1.
export function centreViewport(zoom: number, size: ViewSize): Viewport {
  const next = clampZoom(zoom)
  return { zoom: next, x: (size.w - PAGE_W * next) / 2, y: (size.h - PAGE_H * next) / 2 }
}

// The next preset above / below the current zoom, so ± lands on round numbers
// instead of drifting to 137%.
export function nextZoomUp(zoom: number) {
  return ZOOM_PRESETS.find(z => z > zoom + 0.001) ?? MAX_ZOOM
}

export function nextZoomDown(zoom: number) {
  return [...ZOOM_PRESETS].reverse().find(z => z < zoom - 0.001) ?? MIN_ZOOM
}

// A mouse wheel arrives as coarse, axis-locked ticks (or in line units); a
// trackpad sends fine two-axis deltas. Wheels zoom — a mouse has no other
// gesture for it — while two-finger scroll keeps panning.
export function isMouseWheel(e: WheelEvent) {
  return e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 100 && Number.isInteger(e.deltaY))
}
