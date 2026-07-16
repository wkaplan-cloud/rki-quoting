'use client'

import { useEffect } from 'react'
import toast from 'react-hot-toast'

// Module-level state so the fetch patch is applied once per page load and the
// redirect fires once, even if multiple layouts render the component.
let patched = false
let redirecting = false
let currentLoginPath = '/login'

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

// Internal API routes signal a dead session with { error: 'Unauthorized' }.
// Login/auth endpoints also return 401 for wrong credentials — never intercept those.
function isInternalApi(url: string): boolean {
  const path = url.startsWith('/') ? url : url.startsWith(window.location.origin) ? url.slice(window.location.origin.length) : null
  if (!path) return false
  return path.startsWith('/api/') && !path.includes('/login') && !path.startsWith('/api/auth')
}

// Direct Supabase data/storage calls carry the user JWT; a 401 there means the
// JWT is expired or invalid. Auth endpoints (/auth/v1/) are excluded — token
// refresh retries must not trigger a redirect.
function isSupabaseData(url: string): boolean {
  return url.includes('/rest/v1/') || url.includes('/storage/v1/')
}

function handleSessionExpired() {
  if (redirecting) return
  redirecting = true
  toast.error('Your session has expired — please log in again.', { duration: 4000 })
  setTimeout(() => {
    window.location.href = currentLoginPath
  }, 1500)
}

export function SessionExpiredHandler({ loginPath = '/login' }: { loginPath?: string }) {
  useEffect(() => {
    currentLoginPath = loginPath
    if (patched) return
    patched = true

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await originalFetch(input, init)
      if (res.status !== 401 || redirecting) return res
      try {
        const url = requestUrl(input)
        if (isSupabaseData(url)) {
          handleSessionExpired()
        } else if (isInternalApi(url)) {
          const body = await res.clone().json().catch(() => null)
          const message = body && typeof body === 'object' ? (body as { error?: unknown }).error : null
          if (message === 'Unauthorized' || message === 'Unauthorised') handleSessionExpired()
        }
      } catch {
        // Detection must never break the response for the caller
      }
      return res
    }
  }, [loginPath])

  return null
}
