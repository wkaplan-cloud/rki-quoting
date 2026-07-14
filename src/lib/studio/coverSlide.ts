'use client'
import { loadImage, computeContentCrop } from './images'
import { newId } from './store'
import { PAGE_W, PAGE_H, COLORS } from './constants'
import type { StudioObject, ImageObject, TextObject } from './types'

// A board's title slide: large centred logo, client name, project detail —
// stacked and centred under each other. Composed as ordinary objects (not a
// special slide type) so it's fully editable like anything else; the only
// thing that marks it as the cover is StudioSlide.isCover, which tells the
// renderer to skip the usual master layout (heading/title/page number/
// corner logo) so the two don't clash.
const LOGO_MAX_W = 300
const LOGO_MAX_H = 170
const GAP_LOGO_TO_NAME = 32
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
    // fine with just the client name and detail, centred on their own
  }

  const nameLineH = NAME_FONT_SIZE * 1.25
  const detail = projectDetail.trim()
  const detailLineH = detail ? DETAIL_FONT_SIZE * 1.3 : 0
  const gapAfterLogo = logo ? GAP_LOGO_TO_NAME : 0
  const gapAfterName = detailLineH ? GAP_NAME_TO_DETAIL : 0
  const totalH = (logo?.height ?? 0) + gapAfterLogo + nameLineH + gapAfterName + detailLineH
  let y = PAGE_H / 2 - totalH / 2

  const objects: StudioObject[] = []

  if (logo) {
    const logoObj: ImageObject = {
      id: newId(),
      type: 'image',
      x: (PAGE_W - logo.width) / 2,
      y,
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
    y += logo.height + gapAfterLogo
  }

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

  return objects
}
