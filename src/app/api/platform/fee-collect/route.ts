import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { assignmentIds?: string[] }
  const ids = body.assignmentIds
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'assignmentIds required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('sourcing_item_assignments')
    .update({ fee_collected_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
