import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/respond/[token]/price
// Public: supplier submits or updates a price for one assignment
// Body: { assignment_id, unit_price, fabric_quantity?, fabric_unit?, lead_time_weeks?, valid_until?, notes?, attachment_url? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: ss } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('id, status')
      .eq('token', token)
      .maybeSingle()

    if (!ss) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as {
      assignment_id: string
      unit_price: number
      fabric_quantity?: number | null
      fabric_unit?: string | null
      lead_time_weeks?: number | null
      valid_until?: string | null
      notes?: string | null
      attachment_url?: string | null
    }

    const { assignment_id, unit_price, fabric_quantity, fabric_unit, lead_time_weeks, valid_until, notes, attachment_url } = body

    if (!assignment_id) return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 })
    if (unit_price == null || unit_price < 0) return NextResponse.json({ error: 'unit_price is required' }, { status: 400 })

    // Verify assignment belongs to this session supplier
    const { data: assignment } = await supabaseAdmin
      .from('sourcing_item_assignments')
      .select('id, status')
      .eq('id', assignment_id)
      .eq('session_supplier_id', ss.id)
      .maybeSingle()

    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    const now = new Date().toISOString()

    // Upsert response (unique on assignment_id)
    const { data: response, error } = await supabaseAdmin
      .from('sourcing_item_responses')
      .upsert(
        {
          assignment_id,
          unit_price,
          fabric_quantity: fabric_quantity ?? null,
          fabric_unit: fabric_unit ?? null,
          lead_time_weeks: lead_time_weeks ?? null,
          valid_until: valid_until ?? null,
          notes: notes ?? null,
          attachment_url: attachment_url ?? null,
          submitted_at: now,
          updated_at: now,
        },
        { onConflict: 'assignment_id' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update assignment status to responded
    await supabaseAdmin
      .from('sourcing_item_assignments')
      .update({ status: 'responded', responded_at: now })
      .eq('id', assignment_id)

    // Update session supplier status to in_progress if still pending/viewed
    if (['pending', 'viewed'].includes(ss.status)) {
      await supabaseAdmin
        .from('sourcing_session_suppliers')
        .update({ status: 'in_progress' })
        .eq('id', ss.id)
    }

    // Check if all assignments are responded — mark supplier completed
    const { data: pending } = await supabaseAdmin
      .from('sourcing_item_assignments')
      .select('id')
      .eq('session_supplier_id', ss.id)
      .eq('status', 'pending')

    if (!pending?.length) {
      await supabaseAdmin
        .from('sourcing_session_suppliers')
        .update({ status: 'completed' })
        .eq('id', ss.id)
    }

    // Update session status to in_progress if it was 'sent'
    const { data: sessionSS } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('session_id')
      .eq('id', ss.id)
      .single()

    if (sessionSS) {
      const { data: sessionRow } = await supabaseAdmin
        .from('sourcing_sessions')
        .select('status')
        .eq('id', sessionSS.session_id)
        .single()

      if (sessionRow?.status === 'sent') {
        await supabaseAdmin
          .from('sourcing_sessions')
          .update({ status: 'in_progress' })
          .eq('id', sessionSS.session_id)
      }
    }

    return NextResponse.json({ data: response })
  } catch (e) {
    return apiError(e)
  }
}
