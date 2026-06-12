'use client'
import { useEffect, useRef } from 'react'

/**
 * Polls `fn` every `intervalMs`, but only while the browser tab is visible.
 * Hidden tabs skip ticks entirely (no Vercel invocations) and poll once
 * immediately when the tab becomes visible again, so the UI still feels live.
 */
export function useVisiblePoll(
  fn: () => void,
  intervalMs: number,
  { immediate = true, enabled = true }: { immediate?: boolean; enabled?: boolean } = {}
) {
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn })

  useEffect(() => {
    if (!enabled) return

    if (immediate && !document.hidden) fnRef.current()

    const id = setInterval(() => {
      if (!document.hidden) fnRef.current()
    }, intervalMs)

    const onVisibilityChange = () => {
      if (!document.hidden) fnRef.current()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs, immediate, enabled])
}
