import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const code = searchParams.get('code')

  const supabase = await createClient()

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'email',
    })
    if (error) {
      return NextResponse.redirect(`${origin}/supplier-portal/login?error=session_failed`)
    }
    return NextResponse.redirect(`${origin}/supplier-portal/staff-home`)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${origin}/supplier-portal/login?error=session_failed`)
    }
    return NextResponse.redirect(`${origin}/supplier-portal/staff-home`)
  }

  return NextResponse.redirect(`${origin}/supplier-portal/login?error=session_failed`)
}
