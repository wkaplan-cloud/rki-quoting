import { createContext, useContext } from 'react'
import type { TradeType } from '@/lib/portal-theme'

/**
 * Colours for the trades PDFs (quote, claim, as-built, variations, recon,
 * snag list, job card). The documents are drawn in the electrician blue; an
 * installer's print in the same layout, in their green.
 *
 * Each PDF keeps its stylesheet written in blue and recolours it through
 * recolorStyles(), so the blue files stay readable and unchanged for
 * electricians. Sub-components read the palette from context.
 */
export interface PdfPalette {
  accent: string
  /** Pale wash behind section headers. */
  tint: string
  /** A step deeper than tint. */
  tint2: string
  /** Dark banner background. */
  dark: string
  /** Light accent text on the dark banner. */
  light: string
}

export const BLUE_PALETTE: PdfPalette = { accent: '#3A7CA5', tint: '#EFF6FF', tint2: '#DBEAFE', dark: '#1E2A38', light: '#7EC8F4' }
export const GREEN_PALETTE: PdfPalette = { accent: '#1F5C45', tint: '#EAF2EE', tint2: '#D5E7DD', dark: '#10261D', light: '#8FCBAE' }

export function pdfPalette(trade: TradeType): PdfPalette {
  return trade === 'installer' ? GREEN_PALETTE : BLUE_PALETTE
}

function swapsFor(p: PdfPalette): Map<string, string> {
  return new Map([
    [BLUE_PALETTE.accent.toLowerCase(), p.accent],
    [BLUE_PALETTE.tint.toLowerCase(), p.tint],
    [BLUE_PALETTE.tint2.toLowerCase(), p.tint2],
    [BLUE_PALETTE.dark.toLowerCase(), p.dark],
    [BLUE_PALETTE.light.toLowerCase(), p.light],
  ])
}

const cache = new WeakMap<object, Map<PdfPalette, unknown>>()

/** The stylesheet with every palette colour swapped. Returns the same object for blue. */
export function recolorStyles<T extends object>(styles: T, palette: PdfPalette): T {
  if (palette === BLUE_PALETTE) return styles
  let byPalette = cache.get(styles)
  if (!byPalette) { byPalette = new Map(); cache.set(styles, byPalette) }
  const hit = byPalette.get(palette)
  if (hit) return hit as T

  const swaps = swapsFor(palette)
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return swaps.get(v.toLowerCase()) ?? v
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  const out = walk(styles) as T
  byPalette.set(palette, out)
  return out
}

const PaletteContext = createContext<PdfPalette>(BLUE_PALETTE)
export const PdfPaletteProvider = PaletteContext.Provider

export function usePdfPalette(): PdfPalette {
  return useContext(PaletteContext)
}

/** For a PDF's sub-components: its stylesheet in the document's palette. */
export function usePdfStyles<T extends object>(styles: T): T {
  return recolorStyles(styles, useContext(PaletteContext))
}
