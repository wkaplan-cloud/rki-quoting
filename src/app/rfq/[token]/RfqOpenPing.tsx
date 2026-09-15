'use client'
import { useEffect } from 'react'

// Records that a human opened this pricing link. Mounted for expired links too
// — a supplier arriving too late is worth knowing about.
//
// Fires once per page load and ignores its own result: nothing about the
// pricing form should depend on this succeeding.
export function RfqOpenPing({ token }: { token: string }) {
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/rfq/${encodeURIComponent(token)}/opened`, {
      method: 'POST',
      signal: controller.signal,
    }).catch(() => {})
    return () => controller.abort()
  }, [token])

  return null
}
