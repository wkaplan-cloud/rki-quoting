'use client'
import { Group, Text, Image as KonvaImage } from 'react-konva'
import { PAGE_W, PAGE_H, MASTER_SIDE, COLORS } from '@/lib/studio/constants'
import { useKonvaImage } from '@/lib/studio/images'

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
  const logo = useKonvaImage(logoUrl)

  // Fit logo into a 140×36 box, bottom-right
  let logoW = 0
  let logoH = 0
  if (logo) {
    const scale = Math.min(140 / logo.naturalWidth, 36 / logo.naturalHeight)
    logoW = logo.naturalWidth * scale
    logoH = logo.naturalHeight * scale
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
          image={logo}
          x={PAGE_W - MASTER_SIDE - logoW}
          y={PAGE_H - 18 - logoH}
          width={logoW}
          height={logoH}
          listening={false}
        />
      )}
    </Group>
  )
}
