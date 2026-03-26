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

      // Session-only or no flags: valid for this browser session
      // Set the flag so future checks don't sign the user out
      sessionStorage.setItem('rki_session_only', '1')
    }

    check()
  }, [router])

  return null
}
