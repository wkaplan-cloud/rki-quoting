'use client'
import { useEffect } from 'react'

// Selects the full value of any number input on focus, so typing replaces
// the stale "0" instead of appending to it. Mounted once per portal layout.
export function NumberInputAutoSelect() {
  useEffect(() => {
    const handler = (e: FocusEvent) => {
      const t = e.target
      if (t instanceof HTMLInputElement && t.type === 'number') {
        // Defer so the select isn't undone by the browser's own focus caret placement
        setTimeout(() => t.select(), 0)
      }
    }
    document.addEventListener('focusin', handler)
    return () => document.removeEventListener('focusin', handler)
  }, [])
  return null
}
