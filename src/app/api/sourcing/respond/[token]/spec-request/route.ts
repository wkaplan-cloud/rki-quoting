import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/respond/[token]/spec-request
// Supplier submits spec edits for designer approval (no price yet)
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: ss } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('id')
      .eq('token', token)
      .maybeSingle()

    if (!ss) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as {
      assignment_id: string
      specs: Record<string, string>
    }

    const { assignment_id, specs } = body
    if (!assignment_id) return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 })
    if (!specs || typeof specs !== 'object') return NextResponse.json({ error: 'specs is required' }, { status: 400 })

    const { data: assignment } = await supabaseAdmin
      .from('sourcing_item_assignments')
      .select('id, status')
      .eq('id', assignment_id)
      .eq('session_supplier_id', ss.id)
      .maybeSingle()

    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    if (['accepted', 'supplier_declined'].includes(assignment.status)) {
      return NextResponse.json({ error: 'Assignment is locked' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('sourcing_item_assignments')
      .update({
        pending_supplier_specs: specs,
        spec_approval_status: 'pending',
      })
      .eq('id', assignment_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
