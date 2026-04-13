import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type') // 'signup' for new registrations, absent for invites

  if (code) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.exchangeCodeForSession(code)

    // Self-signup: user set their name + password at registration, so full_name is always
    // in user_metadata. Invited users never have it — they set it on /set-password.
    // Also accept type=signup as a secondary signal in case metadata isn't available yet.
    const isSelfSignup = !!user?.user_metadata?.full_name || type === 'signup'

    if (isSelfSignup) {
      // Sign out so they log in fresh — cleaner than being silently mid-session
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/welcome`)
    }

    // Invite flow — link the user to their pending org_members record
    await supabase.rpc('accept_org_invite')
  }

  return NextResponse.redirect(`${origin}/set-password`)
}
