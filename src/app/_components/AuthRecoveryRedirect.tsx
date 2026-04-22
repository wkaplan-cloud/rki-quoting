'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function hasRecoveryTokens() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('code')) return true
  const hash = window.location.hash
  return hash.includes('access_token=') && hash.includes('type=recovery')
}

export function AuthRecoveryRedirect() {
  const router = useRouter()
  // Initialise synchronously so the loading screen blocks the homepage on frame 1
  const [redirecting] = useState(hasRecoveryTokens)

  useEffect(() => {
    if (!redirecting) return

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      router.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=/set-password&mode=recovery`)
      return
    }

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
  }, [redirecting]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!redirecting) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F5F2EC]">
      <p style={{ fontFamily: 'Georgia, serif' }} className="text-[#C4A46B] text-xl tracking-wide mb-8">QuotingHub</p>
      <div className="w-7 h-7 rounded-full border-2 border-[#9A7B4F] border-t-transparent animate-spin" />
    </div>
  )
}
