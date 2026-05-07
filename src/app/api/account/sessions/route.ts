import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { session } } = await supabase.auth.getSession()

  // The current session ID lives in the JWT's session_id claim
  let currentSessionId: string | null = null
  if (session?.access_token) {
    try {
      const payload = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString())
      currentSessionId = payload.session_id ?? null
    } catch { /* ignore decode errors */ }
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}/sessions`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })

  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })

  const data = await res.json()
  const sessions = (data.sessions ?? []) as Array<{ id: string; created_at: string; updated_at: string; not_after?: string }>

  return NextResponse.json({
    sessions: sessions.map(s => ({
      id: s.id,
      created_at: s.created_at,
      last_active_at: s.updated_at,
      expires_at: s.not_after ?? null,
      is_current: s.id === currentSessionId,
    })),
  })
}
