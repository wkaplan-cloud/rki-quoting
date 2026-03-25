import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
    // Link the invited user to their pending org_members record
    await supabase.rpc('accept_org_invite')
  }

  return NextResponse.redirect(`${origin}/set-password`)
}
