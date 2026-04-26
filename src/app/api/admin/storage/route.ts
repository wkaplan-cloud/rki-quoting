import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/admin/storage — returns total upload storage bytes for the current org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgId } = await supabase.rpc('get_current_org_id')

  // Sum file_size_bytes from sourcing_item_images scoped to this org
  const { data, error } = await supabaseAdmin
    .from('sourcing_item_images')
    .select('file_size_bytes, sourcing_session_items!inner(session:sourcing_sessions!inner(org_id))')
    .eq('sourcing_sessions.org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const totalBytes = (data ?? []).reduce((sum: number, row: any) => sum + (row.file_size_bytes ?? 0), 0)

  return NextResponse.json({ totalBytes, fileCount: (data ?? []).length })
}
