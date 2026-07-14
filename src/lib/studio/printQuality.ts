import type { ImageObject } from './types'

// Below this, a printed A3 board starts looking visibly soft — matches the
// common "minimum acceptable" print threshold used by most layout tools
// (300dpi is ideal, ~150dpi is the floor before softness is obvious to the
// eye). Images imported at their default size sit far above this (a full
// bleed placement is ~218dpi); this only fires once a designer manually
// enlarges an image well past its imported footprint.
export const LOW_RES_DPI_THRESHOLD = 150

// Effective print resolution of an image AT ITS CURRENT ON-PAGE SIZE. Uses
// the cropped region's source pixels when the image is cropped, since only
// that portion is actually being stretched onto the page. Takes the lower of
// the two axes so a non-uniform stretch is still caught.
export function effectiveDpi(obj: ImageObject): number {
  const srcW = obj.crop?.width ?? obj.naturalWidth
  const srcH = obj.crop?.height ?? obj.naturalHeight
  if (!obj.width || !obj.height) return Infinity
  const dpiX = (srcW / obj.width) * 72
  const dpiY = (srcH / obj.height) * 72
  return Math.min(dpiX, dpiY)
}

export function isLowRes(obj: ImageObject): boolean {
  return effectiveDpi(obj) < LOW_RES_DPI_THRESHOLD
}
