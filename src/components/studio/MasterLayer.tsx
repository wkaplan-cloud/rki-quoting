'use client'
import { Group, Text, Image as KonvaImage } from 'react-konva'
import { PAGE_W, PAGE_H, MASTER_SIDE, COLORS } from '@/lib/studio/constants'
import { useTrimmedLogo } from '@/lib/studio/images'

// Logo sizing: the TRIMMED content (whitespace removed) fits this box, so
// every org's logo carries the same quiet visual weight bottom-right,
// whatever its file dimensions or padding.
const LOGO_MAX_W = 110
const LOGO_MAX_H = 26
const LOGO_BOTTOM = 20

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
  const logo = useTrimmedLogo(logoUrl)

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
      {!hideHeading && (
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
      <Text
        x={MASTER_SIDE}
        y={PAGE_H - 30}
        text={`${pageNumber} / ${pageCount}`}
        fontSize={10}
        fontFamily="Helvetica"
        fill={COLORS.muted}
        listening={false}
      />
      {logo && (
        <KonvaImage
          image={logo.image}
          crop={logo.crop}
          x={PAGE_W - MASTER_SIDE - logoW}
          y={PAGE_H - LOGO_BOTTOM - logoH}
          width={logoW}
          height={logoH}
          opacity={0.92}
          listening={false}
        />
      )}
    </Group>
  )
}
