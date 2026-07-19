'use client'
// Per-object font choices for text objects (TextToolbar "Font" select).
// A text object with no fontId follows the board-wide content font
// (contentFonts.ts) exactly as before — picking a font here overrides it
// for that one object only.
//
// Webfonts (cssVar) are the next/font families already loaded app-wide in
// src/app/layout.tsx; system fonts (family) need no loading and are safe in
// both Konva and the HTML edit overlay.
import { useContentFont } from './masterFonts'
import { getContentFont } from './contentFonts'

export interface TextFont {
  id: string
  name: string
  cssVar?: string // next/font CSS variable — must be resolved + force-loaded
  family?: string // plain system font family, usable directly
}

export const TEXT_FONTS: TextFont[] = [
  { id: 'playfair', name: 'Playfair Display', cssVar: '--font-playfair' },
  { id: 'inter', name: 'Inter', cssVar: '--font-inter' },
  { id: 'roboto', name: 'Roboto', cssVar: '--font-roboto' },
  { id: 'montserrat', name: 'Montserrat', cssVar: '--font-montserrat' },
  { id: 'lato', name: 'Lato', cssVar: '--font-lato' },
  { id: 'georgia', name: 'Georgia', family: 'Georgia, serif' },
  { id: 'times', name: 'Times New Roman', family: '"Times New Roman", Times, serif' },
  { id: 'arial', name: 'Arial', family: 'Arial, sans-serif' },
  { id: 'helvetica', name: 'Helvetica', family: 'Helvetica, Arial, sans-serif' },
  { id: 'courier', name: 'Courier New', family: '"Courier New", monospace' },
]

export function getTextFont(id: string | undefined): TextFont | undefined {
  return id ? TEXT_FONTS.find(f => f.id === id) : undefined
}

// Resolves the actual Konva-usable family string for a text object:
// its own fontId if set, otherwise the board content font. Webfonts are
// force-loaded before use so Konva never silently falls back.
export function useTextObjectFamily(fontId: string | undefined, contentFontId: string): string {
  const own = getTextFont(fontId)
  const boardVar = getContentFont(contentFontId).cssVar
  // Hook is called unconditionally (rules of hooks); for system fonts the
  // loaded board font is simply unused.
  const { ready, family } = useContentFont(own?.cssVar ?? boardVar)
  if (own?.family) return own.family
  return ready ? family : 'Helvetica'
}

// Same resolution for the HTML edit overlay (CSS, not Konva)
export function textObjectCssFamily(fontId: string | undefined, contentFontId: string): string {
  const own = getTextFont(fontId)
  if (own?.family) return own.family
  if (own?.cssVar) return `var(${own.cssVar})`
  return `var(${getContentFont(contentFontId).cssVar})`
}
