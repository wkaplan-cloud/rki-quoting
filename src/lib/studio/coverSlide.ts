'use client'
import { loadImage, computeContentCrop } from './images'
import { newId } from './store'
import { PAGE_W, PAGE_H, COLORS } from './constants'
import type { StudioObject, ImageObject, TextObject } from './types'

// A board's title slide: client name + project detail, large and centred —
// the client's name is the hero of their own cover page — with a small,
// quiet studio logo signed in the bottom-left corner (matching the same
// bottom-left placement the Master Page footer uses on every other slide).
// Composed as ordinary objects (not a special slide type) so it's fully
// editable like anything else; the only thing that marks it as the cover is
// StudioSlide.isCover, which tells the renderer to skip the usual master
// layout (heading/footer/border) so the two don't clash.
const LOGO_MAX_H = 26
const LOGO_MAX_W = 140
const LOGO_INSET = 40
const GAP_NAME_TO_DETAIL = 14
const NAME_FONT_SIZE = 46
const DETAIL_FONT_SIZE = 18

export async function buildCoverSlideObjects({
  logoUrl,
  clientName,
  projectDetail,
}: {
  logoUrl: string | null
  clientName: string
  projectDetail: string
}): Promise<StudioObject[]> {
  let logo: { url: string; width: number; height: number; naturalWidth: number; naturalHeight: number; crop: NonNullable<ImageObject['crop']> } | null = null
  try {
    if (logoUrl) {
      const img = await loadImage(logoUrl)
      const crop = computeContentCrop(img)
      const scale = Math.min(LOGO_MAX_W / crop.width, LOGO_MAX_H / crop.height, 1)
      logo = {
        url: logoUrl,
        width: crop.width * scale,
        height: crop.height * scale,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        crop,
      }
    }
  } catch {
    // No logo configured, or it failed to load — the cover still reads
    // fine with just the client name and detail
  }

  const nameLineH = NAME_FONT_SIZE * 1.25
  const detail = projectDetail.trim()
  const detailLineH = detail ? DETAIL_FONT_SIZE * 1.3 : 0
  const gapAfterName = detailLineH ? GAP_NAME_TO_DETAIL : 0
  const totalH = nameLineH + gapAfterName + detailLineH
  let y = PAGE_H / 2 - totalH / 2

  const objects: StudioObject[] = []

  const nameObj: TextObject = {
    id: newId(),
    type: 'text',
    x: 0,
    y,
    rotation: 0,
    opacity: 1,
    locked: true,
    text: clientName.trim() || 'Client name',
    width: PAGE_W,
    fontSize: NAME_FONT_SIZE,
    fontFamily: 'Georgia',
    fontStyle: 'normal',
    textDecoration: '',
    fill: COLORS.ink,
    align: 'center',
  }
  objects.push(nameObj)
  y += nameLineH + gapAfterName

  if (detail) {
    const detailObj: TextObject = {
      id: newId(),
      type: 'text',
      x: 0,
      y,
      rotation: 0,
      opacity: 1,
      locked: true,
      text: detail,
      width: PAGE_W,
      fontSize: DETAIL_FONT_SIZE,
      fontFamily: 'Helvetica',
      fontStyle: 'normal',
      textDecoration: '',
      fill: COLORS.muted,
      align: 'center',
    }
    objects.push(detailObj)
  }

  if (logo) {
    const logoObj: ImageObject = {
      id: newId(),
      type: 'image',
      x: LOGO_INSET,
      y: PAGE_H - LOGO_INSET - logo.height,
      rotation: 0,
      opacity: 1,
      locked: true,
      url: logo.url,
      width: logo.width,
      height: logo.height,
      naturalWidth: logo.naturalWidth,
      naturalHeight: logo.naturalHeight,
      crop: logo.crop,
    }
    objects.push(logoObj)
  }

  return objects
}
