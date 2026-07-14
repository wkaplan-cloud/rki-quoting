'use client'
import { useEffect, useState } from 'react'

// Every Studio webfont (Playfair, Inter, and the content-font choices in
// contentFonts.ts) is already loaded app-wide via next/font/google
// (src/app/layout.tsx), but only as CSS variables — nothing on the Studio
// route necessarily REFERENCES a given variable, so its @font-face is never
// actually fetched until something does. Passing next/font's plain family
// name (e.g. "Playfair Display") to Konva wouldn't match its obfuscated
// internal family string anyway, and would silently fall back to a default
// font. This resolves the real family string next/font registered and
// force-loads it before any Konva <Text> using it is allowed to render.
//
// Cached per CSS variable, module-level: many slide thumbnails mount
// simultaneously (SlidePanel.tsx), so a per-component load would fire
// duplicate requests, and a board's content font only needs loading once
// regardless of how many text objects reference it.
const fontPromises = new Map<string, Promise<string>>()

function resolveFamily(cssVar: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
}

export function ensureFontFamilyLoaded(cssVar: string, samplePx = 16): Promise<string> {
  let p = fontPromises.get(cssVar)
  if (!p) {
    p = (async () => {
      const family = resolveFamily(cssVar)
      await document.fonts.load(`400 ${samplePx}px ${family}`)
      return family
    })()
    fontPromises.set(cssVar, p)
  }
  return p
}

export function ensureMasterFontsLoaded(): Promise<{ playfair: string; inter: string }> {
  return Promise.all([
    ensureFontFamilyLoaded('--font-playfair', 28),
    ensureFontFamilyLoaded('--font-inter', 11),
  ]).then(([playfair, inter]) => ({ playfair, inter }))
}

export function useMasterFonts() {
  const [state, setState] = useState<{ ready: boolean; playfair: string; inter: string }>({
    ready: false,
    playfair: '',
    inter: '',
  })
  useEffect(() => {
    let cancelled = false
    void ensureMasterFontsLoaded().then(r => {
      if (!cancelled) setState({ ready: true, ...r })
    })
    return () => {
      cancelled = true
    }
  }, [])
  return state
}

// Board-wide content font (contentFonts.ts) — resolved/loaded on demand
// since which font is needed depends on the board, unlike the fixed
// Playfair/Inter master-chrome pair above.
export function useContentFont(cssVar: string) {
  const [state, setState] = useState<{ ready: boolean; family: string }>({ ready: false, family: '' })
  useEffect(() => {
    let cancelled = false
    setState(s => (s.ready ? { ready: false, family: '' } : s))
    void ensureFontFamilyLoaded(cssVar).then(family => {
      if (!cancelled) setState({ ready: true, family })
    })
    return () => {
      cancelled = true
    }
  }, [cssVar])
  return state
}
