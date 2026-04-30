import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/sessions/[id]/assignments/[aId]/approve-specs
// Designer approves or rejects a supplier spec change request
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; aId: string }> }
) {
  try {
    const { id: sessionId, aId: assignmentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    // Verify session belongs to org
    const { data: session } = await supabase
      .from('sourcing_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Verify assignment belongs to a supplier in this session
    const { data: assignment } = await supabaseAdmin
      .from('sourcing_item_assignments')
      .select('id, spec_approval_status, sourcing_session_suppliers!inner(session_id)')
      .eq('id', assignmentId)
      .eq('sourcing_session_suppliers.session_id', sessionId)
      .maybeSingle()

    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    if (assignment.spec_approval_status !== 'pending') {
      return NextResponse.json({ error: 'No pending spec approval request' }, { status: 400 })
    }

    const body = await req.json() as { action: 'approve' | 'reject' }
    const { action } = body
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    if (action === 'approve') {
      const { error } = await supabaseAdmin
        .from('sourcing_item_assignments')
        .update({
          spec_approval_status: 'approved',
          spec_approved_at: new Date().toISOString(),
        })
        .eq('id', assignmentId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabaseAdmin
        .from('sourcing_item_assignments')
        .update({
          spec_approval_status: 'rejected',
          pending_supplier_specs: null,
        })
        .eq('id', assignmentId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
