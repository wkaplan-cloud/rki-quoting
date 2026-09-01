'use client'
import { useState, useEffect } from 'react'

/**
 * A render-stable "now".
 *
 * Calling `Date.now()` straight from a component body makes render
 * non-idempotent — two renders of the same state produce different output —
 * which the React Compiler flags and which shows up as values that jump when
 * a component happens to re-render for an unrelated reason.
 *
 * The timestamp is captured once per mount. Pass `intervalMs` when the value
 * genuinely needs to advance on screen (a live elapsed timer, a countdown);
 * leave it off for things read once, like "3 days left" or an age threshold.
 */
export function useNow(intervalMs?: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!intervalMs) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
