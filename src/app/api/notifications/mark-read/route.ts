import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ ok: false })

    await supabaseAdmin
      .from('org_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .is('read_at', null)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
