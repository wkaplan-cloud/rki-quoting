import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type') // 'signup' for new registrations, absent for invites

  if (code) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.exchangeCodeForSession(code)

    // app_metadata.is_self_signup is set server-side (admin only) at registration time.
    // This is the only reliable signal — URL params like ?type=signup are not always
    // preserved by Supabase's redirect chain when appending the &code= parameter.
    const isSelfSignup = !!user?.app_metadata?.is_self_signup

    if (isSelfSignup) {
      // Sign out so they land on /welcome and log in fresh — cleaner UX
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/welcome`)
    }

    // Invite flow — link the user to their pending org_members record
    await supabase.rpc('accept_org_invite')
  }

  return NextResponse.redirect(`${origin}/set-password`)
}
