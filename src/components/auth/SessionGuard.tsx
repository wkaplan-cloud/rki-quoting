'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SessionGuard() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return // not signed in, middleware/server will handle

      const rememberUntil = localStorage.getItem('rki_remember_until')
      const sessionOnly = sessionStorage.getItem('rki_session_only')

      if (rememberUntil) {
        // Remember me: check if the timestamp has expired
        if (Date.now() > parseInt(rememberUntil, 10)) {
          localStorage.removeItem('rki_remember_until')
          await supabase.auth.signOut()
          router.push('/login')
        }
        return
      }

      if (sessionOnly) {
        // Session-only: valid as long as sessionStorage key exists (cleared on tab/browser close)
        return
      }

      // No flags at all — sign out for safety (e.g. new tab after browser reopen with no sessionStorage)
      await supabase.auth.signOut()
      router.push('/login')
    }

    check()
  }, [router])

  return null
}
