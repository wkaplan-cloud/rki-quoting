import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ notifications: [], count: 0 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ notifications: [], count: 0 })

    const [{ data: notifications }, { count }] = await Promise.all([
      supabaseAdmin
        .from('org_notifications')
        .select('id, type, title, body, metadata, read_at, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseAdmin
        .from('org_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .is('read_at', null),
    ])

    return NextResponse.json({ notifications: notifications ?? [], count: count ?? 0 })
  } catch (e) {
    return apiError(e)
  }
}
