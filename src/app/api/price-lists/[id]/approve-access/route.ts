import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL
  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orgId, action } = await req.json() as { orgId: string; action: 'active' | 'rejected' }

  const { error } = await supabaseAdmin
    .from('price_list_access')
    .update({ status: action, approved_at: action === 'active' ? new Date().toISOString() : null })
    .eq('org_id', orgId)
    .eq('price_list_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
