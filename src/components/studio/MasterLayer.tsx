'use client'
import { Group, Text, Rect, Image as KonvaImage } from 'react-konva'
import { PAGE_W, PAGE_H, MASTER_SIDE, COLORS } from '@/lib/studio/constants'
import { useTrimmedLogo } from '@/lib/studio/images'
import { useStudioStore } from '@/lib/studio/store'

// Logo sizing: the TRIMMED content (whitespace removed) fits this box, so
// every org's logo carries the same quiet visual weight bottom-right,
// whatever its file dimensions or padding. Sized up from the original
// 110×26 and given a translucent white backing plate — at the old size and
// opacity it disappeared entirely against busy photo backgrounds.
const LOGO_MAX_W = 160
const LOGO_MAX_H = 40
const LOGO_BOTTOM = 22
const LOGO_PAD = 10

// Master layout drawn INSIDE the Konva stage — the same group renders in the
// editor, thumbnails, presentation and PDF export, so all four match exactly.
// These elements are not canvas objects: they can't be selected or moved.
export function MasterGroup({
  title,
  heading,
  pageNumber,
  pageCount,
  logoUrl,
  interactive = false,
  onHeadingDblClick,
  hideHeading = false,
}: {
  title: string
  heading: string
  pageNumber: number
  pageCount: number
  logoUrl: string | null
  interactive?: boolean
  onHeadingDblClick?: () => void
  hideHeading?: boolean
}) {
  // Per-board master layout config (defaults show everything; no UI yet)
  const config = useStudioStore(s => s.masterLayout)
  const logo = useTrimmedLogo(config.showLogo ? logoUrl : null)

  let logoW = 0
  let logoH = 0
  if (logo) {
    const scale = Math.min(LOGO_MAX_W / logo.crop.width, LOGO_MAX_H / logo.crop.height)
    logoW = logo.crop.width * scale
    logoH = logo.crop.height * scale
  }

  const showPlaceholder = interactive && !heading

  return (
    <Group listening={interactive}>
      {config.showTitle && (
        <Text
          x={MASTER_SIDE}
          y={20}
          text={title.toUpperCase()}
          fontSize={11}
          fontFamily="Helvetica"
          fill={COLORS.muted}
          letterSpacing={2}
          listening={false}
        />
      )}
      {config.showHeading && !hideHeading && (
        <Text
          x={MASTER_SIDE}
          y={36}
          width={PAGE_W - MASTER_SIDE * 2}
          text={showPlaceholder ? 'Double-click to add heading' : heading}
          fontSize={26}
          fontFamily="Georgia"
          fill={showPlaceholder ? '#C9C4B8' : COLORS.ink}
          listening={interactive}
          onDblClick={onHeadingDblClick}
          onDblTap={onHeadingDblClick}
        />
      )}
      {config.showPageNumber && (
        <Text
          x={MASTER_SIDE}
          y={PAGE_H - 30}
          text={`${pageNumber} / ${pageCount}`}
          fontSize={10}
          fontFamily="Helvetica"
          fill={COLORS.muted}
          listening={false}
        />
      )}
      {logo && (
        <Group listening={false}>
          <Rect
            x={PAGE_W - MASTER_SIDE - logoW - LOGO_PAD}
            y={PAGE_H - LOGO_BOTTOM - logoH - LOGO_PAD}
            width={logoW + LOGO_PAD * 2}
            height={logoH + LOGO_PAD * 2}
            fill="#FFFFFF"
            opacity={0.82}
            cornerRadius={6}
            shadowColor="rgba(26,26,24,0.18)"
            shadowBlur={10}
            shadowOffsetY={2}
          />
          <KonvaImage
            image={logo.image}
            crop={logo.crop}
            x={PAGE_W - MASTER_SIDE - logoW}
            y={PAGE_H - LOGO_BOTTOM - logoH}
            width={logoW}
            height={logoH}
            listening={false}
          />
        </Group>
      )}
    </Group>
  )
}
