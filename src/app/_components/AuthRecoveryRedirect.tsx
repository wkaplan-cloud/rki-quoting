'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function AuthRecoveryRedirect() {
  const router = useRouter()
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    // Case 1: PKCE code in query string
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      setRedirecting(true)
      router.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=/set-password&mode=recovery`)
      return
    }

    // Case 2: Hash tokens (implicit flow after Supabase verify)
    const hash = window.location.hash
    if (hash.includes('access_token=') && hash.includes('type=recovery')) {
      const hp = new URLSearchParams(hash.slice(1))
      const access_token = hp.get('access_token')
      const refresh_token = hp.get('refresh_token')
      if (access_token && refresh_token) {
        setRedirecting(true)
        const supabase = createClient()
        supabase.auth.setSession({ access_token, refresh_token }).then(() => {
          router.replace('/set-password?mode=recovery')
        })
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!redirecting) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F5F2EC]">
      <p style={{ fontFamily: 'Georgia, serif' }} className="text-[#C4A46B] text-xl tracking-wide mb-8">QuotingHub</p>
      <div className="w-7 h-7 rounded-full border-2 border-[#9A7B4F] border-t-transparent animate-spin" />
    </div>
  )
}
