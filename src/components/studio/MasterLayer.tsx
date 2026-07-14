'use client'
import { useEffect, useRef } from 'react'
import Konva from 'konva'
import { Group, Text, Rect, Image as KonvaImage } from 'react-konva'
import { PAGE_W, PAGE_H } from '@/lib/studio/constants'
import { useTrimmedLogo } from '@/lib/studio/images'
import { useStudioStore } from '@/lib/studio/store'
import { getMasterTheme, getMasterMarginRect, mmToPt } from '@/lib/studio/masterThemes'
import { useMasterFonts } from '@/lib/studio/masterFonts'

interface MasterGroupProps {
  heading: string
  pageNumber: number
  logoUrl: string | null
  interactive?: boolean
  onHeadingDblClick?: () => void
  hideHeading?: boolean
  // Cover slides get the theme's border only — their heading/logo/page
  // number are the custom centred composition built in coverSlide.ts, not
  // the regular header/footer, so those stay suppressed here
  borderOnly?: boolean
}

// Master layout drawn INSIDE the Konva stage — the same group renders in the
// editor, thumbnails, presentation and PDF export, so all four match exactly.
// These elements are not canvas objects: they can't be selected or moved.
// Every board has one active theme (masterThemes.ts) — border, header,
// footer, all derived from it plus the board's own binding margin. Content
// margins double as the auto-layout safe area (getMasterContentArea) so
// imported images and the master chrome can never overlap.
export function MasterGroup({
  heading,
  pageNumber,
  logoUrl,
  interactive = false,
  onHeadingDblClick,
  hideHeading = false,
  borderOnly = false,
}: MasterGroupProps) {
  const config = useStudioStore(s => s.masterLayout)
  const businessName = useStudioStore(s => s.businessName)
  const theme = getMasterTheme(config.themeId)
  const margin = getMasterMarginRect(config)
  const logo = useTrimmedLogo(!borderOnly && config.showLogo ? logoUrl : null)
  const { ready, playfair, inter } = useMasterFonts()
  const logoRef = useRef<Konva.Image>(null)

  useEffect(() => {
    const node = logoRef.current
    if (node && logo) {
      // Konva's .cache() rasterizes the node ONCE, at its current on-screen
      // size, and every later scale-up (editor zoom, or the export's
      // pixelRatio 3–4 toDataURL snapshot) just stretches that one bitmap —
      // it never redraws from the source image. Left at the default, the
      // footer logo (a small ~20pt box, often further shrunk by editor
      // zoom-to-fit) got cached as a tiny, blurry raster that then got
      // magnified for both on-screen viewing and the PDF export. Forcing a
      // high pixelRatio here bakes in enough resolution for both.
      node.cache({ pixelRatio: 6 })
      node.filters([Konva.Filters.Grayscale])
      node.getLayer()?.batchDraw()
    }
  }, [logo?.image, logo?.crop.x, logo?.crop.y, logo?.crop.width, logo?.crop.height])

  const resolveFont = (fontVar: '--font-playfair' | '--font-inter') =>
    fontVar === '--font-playfair' ? playfair : inter

  const borderInset = mmToPt(theme.border.insetMm)
  const footerBaselineY = PAGE_H - margin.bottom
  const showPlaceholder = interactive && !heading
  const headerText = showPlaceholder
    ? 'Double-click to add heading'
    : theme.header.uppercase
      ? heading.toUpperCase()
      : heading

  let logoW = 0
  const logoH = theme.footer.logoMaxHeightPt
  if (logo) {
    const safeAreaW = PAGE_W - margin.left - margin.right
    logoW = Math.min((logo.crop.width / logo.crop.height) * logoH, safeAreaW * 0.5)
  }

  return (
    <Group listening={interactive}>
      {config.showBorder && (
        <Rect
          x={borderInset}
          y={borderInset}
          width={PAGE_W - borderInset * 2}
          height={PAGE_H - borderInset * 2}
          stroke={theme.border.color}
          strokeWidth={theme.border.widthPt}
          cornerRadius={theme.border.cornerRadius}
          listening={false}
        />
      )}

      {!borderOnly && config.showHeader && !hideHeading && ready && (
        <>
          <Text
            x={margin.left}
            y={margin.top}
            width={PAGE_W - margin.left - margin.right}
            text={headerText}
            fontSize={theme.header.fontSizePt}
            fontFamily={resolveFont(theme.header.fontVar)}
            fontStyle={showPlaceholder ? 'normal' : theme.header.fontStyle}
            letterSpacing={theme.header.letterSpacing}
            fill={showPlaceholder ? '#C9C4B8' : theme.header.color}
            listening={interactive}
            onDblClick={onHeadingDblClick}
            onDblTap={onHeadingDblClick}
          />
          {theme.header.dividerBelow && (
            <Rect
              x={margin.left}
              y={margin.top + theme.header.fontSizePt * 1.5}
              width={PAGE_W - margin.left - margin.right}
              height={theme.border.widthPt}
              fill={theme.border.color}
              listening={false}
            />
          )}
        </>
      )}

      {!borderOnly && config.showFooter && (
        <>
          {theme.footer.ruleAbove && (
            <Rect
              x={margin.left}
              y={footerBaselineY - logoH - 12}
              width={PAGE_W - margin.left - margin.right}
              height={theme.border.widthPt}
              fill={theme.border.color}
              listening={false}
            />
          )}

          {config.showLogo &&
            (logo ? (
              <KonvaImage
                ref={logoRef}
                image={logo.image}
                crop={logo.crop}
                x={margin.left}
                y={footerBaselineY - logoH}
                width={logoW}
                height={logoH}
                listening={false}
              />
            ) : (
              ready && (
                <Text
                  x={margin.left}
                  y={footerBaselineY - theme.footer.fontSizePt * 1.2}
                  text={businessName}
                  fontSize={theme.footer.fontSizePt}
                  fontFamily={resolveFont(theme.footer.fontVar)}
                  fontStyle="normal"
                  fill={theme.footer.textColor}
                  listening={false}
                />
              )
            ))}

          {config.showPageNumber && ready && (
            <Text
              x={PAGE_W - margin.right - 40}
              y={footerBaselineY - theme.footer.fontSizePt * 1.2}
              width={40}
              align="right"
              text={String(pageNumber).padStart(2, '0')}
              fontSize={theme.footer.fontSizePt}
              fontFamily={resolveFont(theme.footer.fontVar)}
              fontStyle="normal"
              fill={theme.footer.textColor}
              listening={false}
            />
          )}
        </>
      )}
    </Group>
  )
}
