'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// admin.auth.admin.generateLink({ type: 'magiclink' }) redirects here with the session
// as a URL hash fragment (#access_token=...&refresh_token=...) — fragments never reach
// the server, so this must be picked up client-side, same pattern as AuthRecoveryRedirect.
export default function ImpersonateCallbackPage() {
  const [error, setError] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')

    if (!access_token || !refresh_token) {
      setError(true)
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error: sessionError }) => {
      if (sessionError) {
        setError(true)
        return
      }
      window.location.href = '/dashboard'
    })
  }, [])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F5F2EC]">
      <p style={{ fontFamily: 'Georgia, serif' }} className="text-[#C4A46B] text-xl tracking-wide mb-8">QuotingHub</p>
      {error ? (
        <p className="text-sm text-red-500">Failed to start impersonation session. Please try again.</p>
      ) : (
        <div className="w-7 h-7 rounded-full border-2 border-[#9A7B4F] border-t-transparent animate-spin" />
      )}
    </div>
  )
}
