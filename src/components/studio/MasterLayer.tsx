'use client'
import { useEffect, useRef } from 'react'
import Konva from 'konva'
import { Group, Text, Rect, Image as KonvaImage } from 'react-konva'
import { PAGE_W, PAGE_H, MASTER_SIDE, COLORS } from '@/lib/studio/constants'
import { useTrimmedLogo } from '@/lib/studio/images'
import { useStudioStore } from '@/lib/studio/store'
import { getMasterTheme, getMasterMarginRect, mmToPt } from '@/lib/studio/masterThemes'
import { useMasterFonts } from '@/lib/studio/masterFonts'
import type { MasterLayoutConfig } from '@/lib/studio/types'

// Legacy corner-logo sizing (LegacyMasterGroup only — frozen, do not change).
const LEGACY_LOGO_MAX_W = 160
const LEGACY_LOGO_MAX_H = 40
const LEGACY_LOGO_BOTTOM = 22
const LEGACY_LOGO_PAD = 10

interface MasterGroupProps {
  title: string
  heading: string
  pageNumber: number
  pageCount: number
  logoUrl: string | null
  interactive?: boolean
  onHeadingDblClick?: () => void
  hideHeading?: boolean
}

// Master layout drawn INSIDE the Konva stage — the same group renders in the
// editor, thumbnails, presentation and PDF export, so all four match exactly.
// These elements are not canvas objects: they can't be selected or moved.
//
// `masterLayout.enabled` is a permanent fork, not a migration flag: every
// board created before the Master Page system keeps rendering through
// LegacyMasterGroup, frozen, forever — flipping Enabled in the Theme panel
// is itself the one-time opt-in into ThemedMasterGroup, nothing else
// migrates or changes underneath a board that hasn't opted in.
export function MasterGroup(props: MasterGroupProps) {
  const config = useStudioStore(s => s.masterLayout)
  const businessName = useStudioStore(s => s.businessName)
  if (!config.enabled) return <LegacyMasterGroup {...props} config={config} />
  return <ThemedMasterGroup {...props} config={config} businessName={businessName} />
}

// Today's exact heading/logo treatment, byte-for-byte — only field names
// were renamed to match the new config shape (showHeading→showHeader). The
// small client-name label this used to gate behind `showTitle` is gone from
// the type entirely, but that's not a behaviour change: it already
// defaulted off with no UI ever able to turn it on, for every board.
function LegacyMasterGroup({
  heading,
  pageNumber,
  pageCount,
  logoUrl,
  interactive = false,
  onHeadingDblClick,
  hideHeading = false,
  config,
}: MasterGroupProps & { config: MasterLayoutConfig }) {
  const logo = useTrimmedLogo(config.showLogo ? logoUrl : null)

  let logoW = 0
  let logoH = 0
  if (logo) {
    const scale = Math.min(LEGACY_LOGO_MAX_W / logo.crop.width, LEGACY_LOGO_MAX_H / logo.crop.height)
    logoW = logo.crop.width * scale
    logoH = logo.crop.height * scale
  }

  const showPlaceholder = interactive && !heading

  return (
    <Group listening={interactive}>
      {config.showHeader && !hideHeading && (
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
            x={PAGE_W - MASTER_SIDE - logoW - LEGACY_LOGO_PAD}
            y={PAGE_H - LEGACY_LOGO_BOTTOM - logoH - LEGACY_LOGO_PAD}
            width={logoW + LEGACY_LOGO_PAD * 2}
            height={logoH + LEGACY_LOGO_PAD * 2}
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
            y={PAGE_H - LEGACY_LOGO_BOTTOM - logoH}
            width={logoW}
            height={logoH}
            listening={false}
          />
        </Group>
      )}
    </Group>
  )
}

// Minimal White (and future themes) — border, header, footer, all derived
// from the active theme + the board's own binding margin. Content margins
// double as the auto-layout safe area (see masterThemes.getMasterContentArea)
// so imported images and the master chrome can never overlap.
function ThemedMasterGroup({
  heading,
  pageNumber,
  logoUrl,
  interactive = false,
  onHeadingDblClick,
  hideHeading = false,
  config,
  businessName,
}: MasterGroupProps & { config: MasterLayoutConfig; businessName: string }) {
  const theme = getMasterTheme(config.themeId)
  const margin = getMasterMarginRect(config)
  const logo = useTrimmedLogo(config.showLogo ? logoUrl : null)
  const { ready, playfair, inter } = useMasterFonts()
  const logoRef = useRef<Konva.Image>(null)

  useEffect(() => {
    const node = logoRef.current
    if (node && logo) {
      node.cache()
      node.filters([Konva.Filters.Grayscale])
      node.getLayer()?.batchDraw()
    }
  }, [logo?.image, logo?.crop.x, logo?.crop.y, logo?.crop.width, logo?.crop.height])

  const borderInset = mmToPt(theme.border.insetMm)
  const footerBaselineY = PAGE_H - margin.bottom
  const showPlaceholder = interactive && !heading

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

      {config.showHeader && !hideHeading && ready && (
        <Text
          x={margin.left}
          y={margin.top}
          width={PAGE_W - margin.left - margin.right}
          text={showPlaceholder ? 'Double-click to add heading' : heading}
          fontSize={theme.header.fontSizePt}
          fontFamily={playfair}
          fontStyle="normal"
          fill={showPlaceholder ? '#C9C4B8' : theme.header.color}
          listening={interactive}
          onDblClick={onHeadingDblClick}
          onDblTap={onHeadingDblClick}
        />
      )}

      {config.showFooter && (
        <>
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
                  fontFamily={inter}
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
              fontFamily={inter}
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
