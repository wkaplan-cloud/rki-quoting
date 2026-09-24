/**
 * Which trade a trades-portal account is, and the look that goes with it.
 *
 * Client-safe on purpose (no server imports): the nav, shell and page clients
 * all read the theme. The server-side lookup lives in lib/trade-type.ts.
 */

import type { CSSProperties } from 'react'

export type TradeType = 'electrician' | 'installer'

export interface PortalTheme {
  /** Buttons, links, active states on the white page. */
  accent: string
  /** The accent as "r,g,b" so pages can write rgba(var(--qh-accent-rgb), 0.1). */
  accentRgb: string
  sidebar: string
  /** Active-link marker on the sidebar — lighter than accent to read on the dark sidebar. */
  navAccent: string
  navAccentRgb: string
  navMuted: string
}

export const PORTAL_THEMES: Record<TradeType, PortalTheme> = {
  electrician: {
    accent: '#3A7CA5', accentRgb: '58,124,165',
    sidebar: '#1E2A38',
    navAccent: '#3A7CA5', navAccentRgb: '58,124,165',
    navMuted: '#94A3B8',
  },
  // Deep bottle green.
  installer: {
    accent: '#1F5C45', accentRgb: '31,92,69',
    sidebar: '#10261D',
    navAccent: '#6FAF8F', navAccentRgb: '111,175,143',
    navMuted: '#9FB5AA',
  },
}

export function isTradeType(v: unknown): v is TradeType {
  return v === 'electrician' || v === 'installer'
}

/** CSS custom properties for a theme, to spread into a root element's style. */
export function themeVars(trade: TradeType): CSSProperties {
  const t = PORTAL_THEMES[trade]
  return {
    '--qh-accent': t.accent,
    '--qh-accent-rgb': t.accentRgb,
    '--qh-sidebar': t.sidebar,
    '--qh-nav-accent': t.navAccent,
    '--qh-nav-accent-rgb': t.navAccentRgb,
    '--qh-nav-muted': t.navMuted,
  } as CSSProperties
}

/** Units offered on quote lines and catalogue items. */
export function tradeUnits(trade: TradeType): string[] {
  return trade === 'installer' ? ['nr', 'm', 'hr', 'day', 'lot'] : ['nr', 'm']
}
