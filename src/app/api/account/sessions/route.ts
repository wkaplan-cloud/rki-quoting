import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { session } } = await supabase.auth.getSession()

  // Decode the JWT to extract the current session ID (lives in the session_id claim)
  let currentSessionId: string | null = null
  if (session?.access_token) {
    try {
      const payload = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString())
      currentSessionId = payload.session_id ?? null
    } catch { /* ignore decode errors */ }
  }

  // Query auth.sessions directly via the admin client (service role bypasses RLS on auth schema)
  const { data: sessions, error } = await supabaseAdmin
    .schema('auth')
    .from('sessions')
    .select('id, created_at, updated_at, not_after')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[account/sessions]', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  return NextResponse.json({
    sessions: (sessions ?? []).map(s => ({
      id: s.id,
      created_at: s.created_at,
      last_active_at: s.updated_at,
      expires_at: s.not_after ?? null,
      is_current: s.id === currentSessionId,
    })),
  })
}
