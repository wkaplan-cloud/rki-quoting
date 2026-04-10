import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type') // 'signup' for new registrations, absent for invites

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    if (type === 'signup') {
      // Email confirmation for new self-signup — sign them out so they log in fresh
      // on the welcome page (cleaner UX than being silently logged in mid-confirmation)
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/welcome`)
    }

    // Invite flow — link the user to their pending org_members record
    await supabase.rpc('accept_org_invite')
  }

  return NextResponse.redirect(`${origin}/set-password`)
}
