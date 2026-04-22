'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Supabase password-reset links land on the Site URL (root page).
// After verifying the token it redirects here with either:
//   ?code=xxx          — PKCE code exchange
//   #access_token=xxx  — implicit tokens (hash)
// We detect both and forward to the set-password flow.
export function AuthRecoveryRedirect() {
  const router = useRouter()
  useEffect(() => {
    // Case 1: PKCE code in query string
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      router.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=/set-password&mode=recovery`)
      return
    }

    // Case 2: Hash tokens after Supabase verify (implicit flow)
    const hash = window.location.hash
    if (hash.includes('access_token=') && hash.includes('type=recovery')) {
      const hp = new URLSearchParams(hash.slice(1))
      const access_token = hp.get('access_token')
      const refresh_token = hp.get('refresh_token')
      if (access_token && refresh_token) {
        const supabase = createClient()
        supabase.auth.setSession({ access_token, refresh_token }).then(() => {
          router.replace('/set-password?mode=recovery')
        })
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
