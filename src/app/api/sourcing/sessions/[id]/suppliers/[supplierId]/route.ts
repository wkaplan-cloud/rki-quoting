import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// DELETE /api/sourcing/sessions/[id]/suppliers/[supplierId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; supplierId: string }> }) {
  try {
    const { id: sessionId, supplierId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    // Verify session ownership before deleting a supplier record
    const { data: session } = await supabase
      .from('sourcing_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await supabase.from('sourcing_session_suppliers').delete().eq('id', supplierId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
