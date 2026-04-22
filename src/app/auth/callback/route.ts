import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const code       = searchParams.get('code') // PKCE fallback

  const supabase = await createClient()

  // --- OTP / token_hash flow ---
  // generateLink() produces an OTP-style action link. When clicked, Supabase verifies
  // server-side and redirects to our callback with ?token_hash=xxx&type=xxx (NOT ?code=xxx).
  if (token_hash && type) {
    const otpType = type === 'invite' ? 'invite' : 'email'
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: otpType })

    if (error) {
      // Token invalid or already used — send to login with a message
      return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
    }

    if (type === 'invite') {
      // Invited user — link to their pending org_members record, then set password
      await supabase.rpc('accept_org_invite')
      return NextResponse.redirect(`${origin}/set-password`)
    }

    // Self-signup: verifyOtp already logged them in.
    // Send to /welcome — that page shows a confirmation message with a "Continue" button → /onboarding.
    return NextResponse.redirect(`${origin}/welcome`)
  }

  // --- PKCE code flow (fallback) ---
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
    }
    const next = searchParams.get('next') || '/dashboard'
    const mode = searchParams.get('mode')
    // Only accept org invite for invite flows, not password recovery
    if (mode !== 'recovery') {
      await supabase.rpc('accept_org_invite')
    }
    const modeParam = mode ? `?mode=${mode}` : ''
    return NextResponse.redirect(`${origin}${next}${modeParam}`)
  }

  return NextResponse.redirect(`${origin}/login`)
}
