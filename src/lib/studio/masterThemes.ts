import { PAGE_W, PAGE_H } from './constants'
import type { MasterLayoutConfig } from './types'

// A theme is pure data — background, border, margins, typography. Adding a
// future theme means adding one entry here; no rendering, auto-layout or
// settings-panel code changes.

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
    fontVar: '--font-playfair' | '--font-inter'
    fontWeight: number
    fontStyle: 'normal' | 'italic'
    fontSizePt: number
    color: string
    letterSpacing: number
    uppercase: boolean
    // A thin rule spanning the content width directly under the heading
    dividerBelow: boolean
    // Extra clearance auto-layout should leave below the header text —
    // not the header's own draw position, just breathing room for images
    clearanceBelowPt: number
  }
  footer: {
    fontVar: '--font-playfair' | '--font-inter'
    fontWeight: number
    fontSizePt: number
    textColor: string
    logoMaxHeightPt: number
    // A thin rule spanning the content width directly above the footer row
    ruleAbove: boolean
    clearanceAbovePt: number
  }
}

export const MASTER_THEMES: Record<string, MasterTheme> = {
  // Quiet and warm — no rules anywhere, a serif heading, generous
  // breathing room. The gentle default.
  'minimal-white': {
    id: 'minimal-white',
    name: 'Minimal White',
    background: '#FFFFFF',
    border: { color: '#E7E5E2', widthPt: 1, insetMm: 10, cornerRadius: 0 },
    margin: { topMm: 20, rightMm: 20, bottomMm: 20 },
    header: {
      fontVar: '--font-playfair',
      fontWeight: 400,
      fontStyle: 'normal',
      fontSizePt: 28,
      color: '#2A2A2A',
      letterSpacing: 0,
      uppercase: false,
      dividerBelow: false,
      clearanceBelowPt: 64,
    },
    footer: {
      fontVar: '--font-inter',
      fontWeight: 400,
      fontSizePt: 11,
      textColor: '#7E7E7E',
      logoMaxHeightPt: 36,
      ruleAbove: false,
      clearanceAbovePt: 56,
    },
  },

  // Structured and monochrome — a technical-drawing sheet: heavier square
  // border sitting closer to the edge, tighter margins to maximise drawing
  // space, an all-caps letter-spaced sans heading with a rule underneath it
  // (a title-block baseline), cooler ink throughout.
  architectural: {
    id: 'architectural',
    name: 'Architectural',
    background: '#FFFFFF',
    border: { color: '#2A2A2A', widthPt: 1.25, insetMm: 8, cornerRadius: 0 },
    margin: { topMm: 15, rightMm: 15, bottomMm: 15 },
    header: {
      fontVar: '--font-inter',
      fontWeight: 600,
      fontStyle: 'normal',
      fontSizePt: 20,
      color: '#1A1A1A',
      letterSpacing: 2,
      uppercase: true,
      dividerBelow: true,
      clearanceBelowPt: 56,
    },
    footer: {
      fontVar: '--font-inter',
      fontWeight: 400,
      fontSizePt: 10,
      textColor: '#6B6B68',
      logoMaxHeightPt: 32,
      ruleAbove: false,
      clearanceAbovePt: 48,
    },
  },

  // Generous and warm — a coffee-table-book spread: barely-there border set
  // further from the edge, the most whitespace of the three, a large
  // italic serif heading, and a classic magazine running-footer rule.
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    background: '#FFFFFF',
    border: { color: '#EDE8E0', widthPt: 0.75, insetMm: 14, cornerRadius: 0 },
    margin: { topMm: 25, rightMm: 25, bottomMm: 25 },
    header: {
      fontVar: '--font-playfair',
      fontWeight: 500,
      fontStyle: 'italic',
      fontSizePt: 32,
      color: '#3A342C',
      letterSpacing: 0,
      uppercase: false,
      dividerBelow: false,
      clearanceBelowPt: 72,
    },
    footer: {
      fontVar: '--font-inter',
      fontWeight: 400,
      fontSizePt: 10.5,
      textColor: '#9C9284',
      logoMaxHeightPt: 36,
      ruleAbove: true,
      clearanceAbovePt: 60,
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
// MasterGroup's own header/footer positioning, so none of these can ever
// drift apart.
export function getMasterContentArea(config: MasterLayoutConfig) {
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
