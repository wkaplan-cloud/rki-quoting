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
      .select('id, status, supplier_name')
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
      supplier_specs?: Record<string, string> | null
      installation_included?: boolean | null
      installation_cost?: number | null
      vat_exempt?: boolean
    }

    const { assignment_id, unit_price, fabric_quantity, fabric_unit, lead_time_weeks, valid_until, notes, attachment_url, supplier_specs, installation_included, installation_cost, vat_exempt } = body

    if (!assignment_id) return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 })
    if (unit_price == null || unit_price < 0) return NextResponse.json({ error: 'unit_price is required' }, { status: 400 })

    // Verify assignment belongs to this session supplier
    const { data: assignment } = await supabaseAdmin
      .from('sourcing_item_assignments')
      .select('id, status, spec_approval_status, pending_supplier_specs, item_id')
      .eq('id', assignment_id)
      .eq('session_supplier_id', ss.id)
      .maybeSingle()

    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    const now = new Date().toISOString()

    // Always fetch the item (needed for spec comparison and audit log)
    const { data: itemRow } = await supabaseAdmin
      .from('sourcing_session_items')
      .select('title, item_specs, dimensions, colour_finish')
      .eq('id', assignment.item_id)
      .maybeSingle()

    // Detect whether the supplier changed any specs vs. the original item
    let specApprovalUpdates: Record<string, unknown> = { spec_approval_status: null, pending_supplier_specs: null }
    if (supplier_specs && Object.keys(supplier_specs).length > 0 && itemRow) {
      const origSpecs: Record<string, string> = {
        ...(itemRow.item_specs ?? {}),
        ...(itemRow.dimensions ? { dimensions: itemRow.dimensions } : {}),
        ...(itemRow.colour_finish ? { colour_finish: itemRow.colour_finish } : {}),
      }
      const hasChange = Object.keys({ ...origSpecs, ...supplier_specs }).some(
        k => (supplier_specs[k] ?? '') !== (origSpecs[k] ?? '')
      )
      if (hasChange) {
        specApprovalUpdates = { spec_approval_status: 'pending', pending_supplier_specs: supplier_specs }
      }
    }

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
          supplier_specs: supplier_specs ?? null,
          installation_included: installation_included ?? null,
          installation_cost: installation_cost ?? null,
          vat_exempt: vat_exempt ?? false,
          submitted_at: now,
          updated_at: now,
        },
        { onConflict: 'assignment_id' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update assignment status + spec approval state
    await supabaseAdmin
      .from('sourcing_item_assignments')
      .update({ status: 'responded', responded_at: now, ...specApprovalUpdates })
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

    const supplierJustCompleted = !pending?.length && ss.status !== 'completed'
    if (supplierJustCompleted) {
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
        .select('id, status, org_id, project_id')
        .eq('id', sessionSS.session_id)
        .single()

      if (sessionRow?.status === 'sent') {
        await supabaseAdmin
          .from('sourcing_sessions')
          .update({ status: 'in_progress' })
          .eq('id', sessionSS.session_id)
      }

      // Notify org when supplier completes all items (first time only)
      if (sessionRow && supplierJustCompleted) {
        await supabaseAdmin.from('org_notifications').insert({
          org_id: sessionRow.org_id,
          type: 'price_request_responded',
          title: `${ss.supplier_name} completed price request`,
          body: `${ss.supplier_name} has submitted prices for all requested items`,
          metadata: { session_id: sessionRow.id, project_id: sessionRow.project_id ?? null },
        })
      }

      // Audit log — supplier submitted a price
      if (sessionRow) {
        const isUpdate = !!assignment.status && assignment.status === 'responded'
        await supabaseAdmin.from('audit_logs').insert({
          org_id: sessionRow.org_id,
          project_id: sessionRow.project_id ?? null,
          user_email: null,
          action: isUpdate ? 'updated' : 'responded',
          table_name: 'sourcing_item_responses',
          record_id: assignment_id,
          old_data: null,
          new_data: {
            supplier_name: ss.supplier_name,
            item_title: (itemRow as any)?.title ?? null,
            unit_price: unit_price,
            installation_included: installation_included ?? null,
            installation_cost: installation_cost ?? null,
            vat_exempt: vat_exempt ?? false,
          },
        })
      }
    }

    return NextResponse.json({ data: response })
  } catch (e) {
    return apiError(e)
  }
}
