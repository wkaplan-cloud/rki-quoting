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

      // No rememberUntil flag. If rki_session_only is absent from sessionStorage
      // it means the browser was restarted after a "don't remember me" login —
      // sign the user out so the session doesn't silently persist.
      if (!sessionOnly) {
        await supabase.auth.signOut()
        router.push('/login')
        return
      }

      // sessionOnly is present — still within the same browser session, nothing to do.
    }

    check()
  }, [router])

  return null
}
