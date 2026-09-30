import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isPendingSelfSignup, resendSignupConfirmation } from '@/lib/signup-confirmation'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const { data, error: getError } = await supabaseAdmin.auth.admin.getUserById(user_id)
  if (getError || !data.user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!isPendingSelfSignup(data.user)) {
    return NextResponse.json({ error: 'This account is already confirmed' }, { status: 400 })
  }

  const { error } = await resendSignupConfirmation(data.user)
  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ ok: true })
}
