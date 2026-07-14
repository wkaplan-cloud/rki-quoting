import { PAGE_W, PAGE_H, MASTER_SIDE, MASTER_TOP, MASTER_BOTTOM } from './constants'
import type { MasterLayoutConfig } from './types'

// A theme is pure data — background, border, margins, typography. Adding a
// future theme (Architectural, Editorial, Hospitality) means adding one
// entry here; no rendering, auto-layout or settings-panel code changes.

export const MM_PER_INCH = 25.4
export const PT_PER_INCH = 72

export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * PT_PER_INCH
}

export interface MasterTheme {
  id: string
  name: string
  background: string
  border: { color: string; widthPt: number; insetMm: number; cornerRadius: number }
  // Fixed per theme — only the board's own bindingMarginMm (left) varies
  margin: { topMm: number; rightMm: number; bottomMm: number }
  header: {
    fontVar: '--font-playfair'
    fontWeight: number
    fontSizePt: number
    color: string
    // Extra clearance auto-layout should leave below the header text —
    // not the header's own draw position, just breathing room for images
    clearanceBelowPt: number
  }
  footer: {
    fontVar: '--font-inter'
    fontWeight: number
    fontSizePt: number
    textColor: string
    logoMaxHeightPt: number
    clearanceAbovePt: number
  }
}

export const MASTER_THEMES: Record<string, MasterTheme> = {
  'minimal-white': {
    id: 'minimal-white',
    name: 'Minimal White',
    background: '#FFFFFF',
    border: { color: '#E7E5E2', widthPt: 1, insetMm: 10, cornerRadius: 0 },
    margin: { topMm: 20, rightMm: 20, bottomMm: 20 },
    header: {
      fontVar: '--font-playfair',
      fontWeight: 400,
      fontSizePt: 28,
      color: '#2A2A2A',
      clearanceBelowPt: 64,
    },
    footer: {
      fontVar: '--font-inter',
      fontWeight: 400,
      fontSizePt: 11,
      textColor: '#7E7E7E',
      logoMaxHeightPt: 20,
      clearanceAbovePt: 48,
    },
  },
}

export function getMasterTheme(themeId: string): MasterTheme {
  return MASTER_THEMES[themeId] ?? MASTER_THEMES['minimal-white']
}

// The four margin edges in points — left comes from the board's own
// binding-margin setting, the rest are fixed by the active theme.
export function getMasterMarginRect(config: MasterLayoutConfig) {
  const theme = getMasterTheme(config.themeId)
  return {
    left: mmToPt(config.bindingMarginMm),
    right: mmToPt(theme.margin.rightMm),
    top: mmToPt(theme.margin.topMm),
    bottom: mmToPt(theme.margin.bottomMm),
  }
}

// Single source of truth for the safe content rectangle — used by
// auto-layout (gridPlacements), the heading-edit overlay, and implicitly by
// ThemedMasterGroup's own header/footer positioning, so none of these can
// ever drift apart. Falls back to the legacy fixed bands when Master Page
// is disabled, so existing boards' auto-layout behaviour is also untouched.
export function getMasterContentArea(config: MasterLayoutConfig) {
  if (!config.enabled) {
    return {
      x: MASTER_SIDE,
      y: MASTER_TOP,
      width: PAGE_W - MASTER_SIDE * 2,
      height: PAGE_H - MASTER_TOP - MASTER_BOTTOM,
    }
  }
  const theme = getMasterTheme(config.themeId)
  const m = getMasterMarginRect(config)
  const headerClearance = config.showHeader ? theme.header.clearanceBelowPt : 0
  const footerClearance = config.showFooter ? theme.footer.clearanceAbovePt : 0
  return {
    x: m.left,
    y: m.top + headerClearance,
    width: PAGE_W - m.left - m.right,
    height: PAGE_H - m.top - headerClearance - m.bottom - footerClearance,
  }
}
