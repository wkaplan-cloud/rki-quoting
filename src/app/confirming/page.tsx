'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// This page is the redirect target for all Supabase email confirmation links.
// It always renders a full-screen spinner — no form — so there is never a
// flash of login UI. The hash tokens are parsed client-side after hydration.
export default function ConfirmingPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token=')) {
      // No tokens in hash — something unexpected. Send to login.
      router.replace('/login')
      return
    }

    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const type = params.get('type')

    if (!access_token || !refresh_token) {
      router.replace('/login')
      return
    }

    supabase.auth.setSession({ access_token, refresh_token }).then(({ data: { session }, error }) => {
      if (error || !session) {
        router.replace('/login?error=confirmation_failed')
        return
      }
      if (type === 'invite') {
        supabase.rpc('accept_org_invite').then(() => router.replace('/set-password'))
      } else {
        // signup or any other type → welcome → onboarding
        router.replace('/welcome')
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundImage: 'url(/login-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="w-8 h-8 rounded-full border-2 border-[#C4A46B] border-t-transparent animate-spin" />
    </div>
  )
}
