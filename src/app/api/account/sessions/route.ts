import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { session } } = await supabase.auth.getSession()

  // Decode JWT to extract the current session ID from the session_id claim
  let currentSessionId: string | null = null
  if (session?.access_token) {
    try {
      const payload = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString())
      currentSessionId = payload.session_id ?? null
    } catch { /* ignore */ }
  }

  // auth schema isn't exposed via PostgREST — call the SECURITY DEFINER function instead
  const { data: sessions, error } = await supabaseAdmin.rpc('get_user_sessions_admin', { p_user_id: user.id })

  if (error) {
    console.error('[account/sessions]', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  return NextResponse.json({
    sessions: (sessions ?? []).map((s: { id: string; created_at: string; updated_at: string; not_after: string | null }) => ({
      id: s.id,
      created_at: s.created_at,
      last_active_at: s.updated_at,
      expires_at: s.not_after ?? null,
      is_current: s.id === currentSessionId,
    })),
  })
}
