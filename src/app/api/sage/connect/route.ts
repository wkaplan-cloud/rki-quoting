import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Generate CSRF state token and store in a short-lived cookie
  const state = crypto.randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('sage_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SAGE_CLIENT_ID!,
    redirect_uri: process.env.SAGE_REDIRECT_URI!,
    scope: 'openid email profile',
    state,
    prompt: 'login', // always show login form, never auto-connect from cached session
  })

  const audience = process.env.SAGE_API_AUDIENCE
  if (audience) params.set('audience', audience)

  return NextResponse.redirect(`https://id.sage.com/authorize?${params}`)
}
