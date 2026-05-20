'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// Client-side handler for password reset links.
// Supabase may deliver tokens via hash (implicit flow) or ?code= (PKCE flow).
// Hash fragments never reach the server, so we must handle them here on the client.
export default function AuthResetPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function handle() {
      // --- Implicit flow: tokens in hash ---
      const hash = window.location.hash
      if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.slice(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        const type = params.get('type')
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (error) {
            toast.error('Invalid or expired reset link. Please request a new one.')
            router.replace('/forgot-password')
            return
          }
          window.history.replaceState(null, '', window.location.pathname)
          router.replace(type === 'recovery' ? '/set-password?mode=recovery' : '/dashboard')
          return
        }
      }

      // --- PKCE flow: code in query string ---
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          toast.error('Invalid or expired reset link. Please request a new one.')
          router.replace('/forgot-password')
          return
        }
        router.replace('/set-password?mode=recovery')
        return
      }

      // Nothing to process
      router.replace('/forgot-password')
    }

    handle()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#9A7B4F] border-t-transparent animate-spin" />
    </div>
  )
}
