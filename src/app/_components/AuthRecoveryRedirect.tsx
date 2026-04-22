'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// When Supabase redirects back after verifying a password-reset token it lands on
// the Site URL (root page) with ?code=xxx. This component detects that and
// forwards to /auth/callback so the PKCE code can be exchanged for a session.
export function AuthRecoveryRedirect() {
  const router = useRouter()
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      router.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=/set-password&mode=recovery`)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
