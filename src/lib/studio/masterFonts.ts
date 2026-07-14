'use client'
import { useEffect, useState } from 'react'

// Playfair Display + Inter are already loaded app-wide via next/font/google
// (src/app/layout.tsx), but only as CSS variables — nothing on the Studio
// route references --font-playfair today, so its @font-face is never
// actually fetched there. Passing the literal string "Playfair Display" to
// Konva wouldn't match next/font's obfuscated internal family name anyway,
// and would silently fall back to a default serif. This resolves the real
// family string next/font registered and force-loads both before any
// Konva <Text> using them is allowed to render.
//
// Module-level singleton: many slide thumbnails mount simultaneously
// (SlidePanel.tsx), so a per-component load would fire duplicate requests.
let fontsPromise: Promise<{ playfair: string; inter: string }> | null = null

function resolveFamily(cssVar: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
}

export function ensureMasterFontsLoaded(): Promise<{ playfair: string; inter: string }> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const playfair = resolveFamily('--font-playfair')
      const inter = resolveFamily('--font-inter')
      await Promise.all([
        document.fonts.load(`400 28px ${playfair}`),
        document.fonts.load(`400 11px ${inter}`),
      ])
      return { playfair, inter }
    })()
  }
  return fontsPromise
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
