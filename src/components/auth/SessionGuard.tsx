'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  browsingSessionIsLive,
  clearRememberUntil,
  markTabInSession,
  readRememberUntil,
  startHeartbeat,
  tabIsMarked,
} from '@/lib/session-prefs'

export function SessionGuard() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let stopHeartbeat: (() => void) | null = null

    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return // not signed in, middleware/server will handle

      const rememberUntil = readRememberUntil()

      // Storage unreadable (private browsing, blocked site data) — we cannot tell
      // what the user chose, so fail open rather than signing them out.
      if (rememberUntil === undefined) return

      if (rememberUntil !== null) {
        // Remember me: sign out once the expiry has passed
        if (Date.now() > rememberUntil) {
          clearRememberUntil()
          await supabase.auth.signOut()
          router.push('/login')
          return
        }
        stopHeartbeat = startHeartbeat()
        return
      }

      // Session-only login. This tab is fine if it was the one that logged in,
      // or if another tab was alive moments ago — a second tab and a link opened
      // from an email both land here and must not end the session.
      if (!tabIsMarked() && !browsingSessionIsLive()) {
        // Nothing has been open recently: the browser was closed and reopened.
        await supabase.auth.signOut()
        router.push('/login')
        return
      }

      markTabInSession()
      stopHeartbeat = startHeartbeat()
    }

    check()
    return () => { stopHeartbeat?.() }
  }, [router])

  return null
}
