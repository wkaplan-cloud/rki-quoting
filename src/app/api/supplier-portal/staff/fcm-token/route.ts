import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { fcm_token } = await req.json() as { fcm_token: string }
    if (!fcm_token || typeof fcm_token !== 'string') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    await supabaseAdmin
      .from('elec_staff')
      .update({ fcm_token })
      .eq('auth_user_id', user.id)
      .eq('is_active', true)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
