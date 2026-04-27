import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/respond/[token]/decline
// Body: { assignment_id?: string, reason?: string }
//   - With assignment_id: declines that single item
//   - Without: declines entire request (all assignments + session_supplier)
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: ss } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('id')
      .eq('token', token)
      .maybeSingle()

    if (!ss) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { assignment_id, reason } = await req.json() as { assignment_id?: string; reason?: string }

    if (assignment_id) {
      // Decline single item — verify ownership
      const { data: assignment } = await supabaseAdmin
        .from('sourcing_item_assignments')
        .select('id')
        .eq('id', assignment_id)
        .eq('session_supplier_id', ss.id)
        .maybeSingle()

      if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

      await supabaseAdmin
        .from('sourcing_item_assignments')
        .update({ status: 'supplier_declined' })
        .eq('id', assignment_id)

      // Upsert a response with the reason in notes so the designer can see it
      if (reason?.trim()) {
        await supabaseAdmin
          .from('sourcing_item_responses')
          .upsert({
            assignment_id,
            unit_price: 0,
            notes: `[CAN'T SUPPLY] ${reason.trim()}`,
          }, { onConflict: 'assignment_id' })
      }
    } else {
      // Decline entire request
      await supabaseAdmin
        .from('sourcing_item_assignments')
        .update({ status: 'supplier_declined' })
        .eq('session_supplier_id', ss.id)
        .in('status', ['pending', 'viewed'])

      await supabaseAdmin
        .from('sourcing_session_suppliers')
        .update({ status: 'declined' })
        .eq('id', ss.id)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
