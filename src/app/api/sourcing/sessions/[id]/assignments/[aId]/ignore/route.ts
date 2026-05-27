import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// PATCH /api/sourcing/sessions/[id]/assignments/[aId]/ignore
// Body: { ignored: boolean }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; aId: string }> }) {
  try {
    const { id: sessionId, aId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { data: session } = await supabase
      .from('sourcing_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { ignored } = await req.json() as { ignored: boolean }

    const { error } = await supabase
      .from('sourcing_item_assignments')
      .update({ ignored })
      .eq('id', aId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
