import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const code       = searchParams.get('code') // PKCE fallback

  const supabase = await createClient()

  // --- OTP / token_hash flow ---
  // generateLink() (used for both self-signup and invite) produces an OTP-style
  // action link. When the user clicks it, Supabase verifies server-side and redirects
  // to our callback with ?token_hash=xxx&type=xxx (NOT ?code=xxx).
  if (token_hash && type) {
    // Map URL type to verifyOtp type — Supabase sends 'email' for signup confirmations
    // and 'invite' for team invitations.
    const otpType = type === 'invite' ? 'invite' : 'email'
    await supabase.auth.verifyOtp({ token_hash, type: otpType })

    if (type === 'invite') {
      // Link this user to their pending org_members record
      await supabase.rpc('accept_org_invite')
      return NextResponse.redirect(`${origin}/set-password`)
    }

    // Self-signup email confirmation — sign out so they log in fresh on /welcome
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/welcome`)
  }

  // --- PKCE code flow (fallback) ---
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
    await supabase.rpc('accept_org_invite')
    return NextResponse.redirect(`${origin}/set-password`)
  }

  // Should not reach here — redirect somewhere safe
  return NextResponse.redirect(`${origin}/login`)
}
