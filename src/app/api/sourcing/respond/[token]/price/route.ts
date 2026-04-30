import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { buildNotifEmail } from '@/lib/sourcing-notifications'

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'

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
    }

    const { assignment_id, unit_price, fabric_quantity, fabric_unit, lead_time_weeks, valid_until, notes, attachment_url, supplier_specs } = body

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

    // Block pricing while spec changes are awaiting designer approval
    if (assignment.spec_approval_status === 'pending') {
      return NextResponse.json({ error: 'Awaiting designer spec approval before pricing' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // If specs were approved, use the approved pending_supplier_specs (client supplier_specs takes precedence if also sent)
    const resolvedSupplierSpecs = supplier_specs ?? (
      assignment.spec_approval_status === 'approved' ? assignment.pending_supplier_specs : null
    )

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
          supplier_specs: resolvedSupplierSpecs,
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
        .select('id, status, title, created_by')
        .eq('id', sessionSS.session_id)
        .single()

      if (sessionRow?.status === 'sent') {
        await supabaseAdmin
          .from('sourcing_sessions')
          .update({ status: 'in_progress' })
          .eq('id', sessionSS.session_id)
      }

      // Notify designer that supplier submitted a price
      if (sessionRow?.created_by && process.env.RESEND_API_KEY) {
        try {
          const [{ data: userData }, { data: itemRow }] = await Promise.all([
            supabaseAdmin.auth.admin.getUserById(sessionRow.created_by),
            supabaseAdmin.from('sourcing_session_items').select('title').eq('id', (assignment as any).item_id).maybeSingle(),
          ])
          const designerEmail = userData?.user?.email
          if (designerEmail) {
            const resend = new Resend(process.env.RESEND_API_KEY)
            const supplierName = (ss as any).supplier_name ?? 'A supplier'
            const itemTitle = itemRow?.title ?? 'an item'
            await resend.emails.send({
              from: 'QuotingHub <no-reply@quotinghub.co.za>',
              to: designerEmail,
              subject: `${supplierName} submitted a price — ${sessionRow.title}`,
              html: buildNotifEmail({
                heading: 'New price submitted',
                body: `<strong>${supplierName}</strong> has submitted a price for <strong>${itemTitle}</strong> in your price request &ldquo;${sessionRow.title}&rdquo;. Review and compare with other suppliers.`,
                ctaLabel: 'Review prices',
                ctaUrl: `${APP_URL}/sourcing/${sessionRow.id}`,
              }),
            })
          }
        } catch { /* never break the main response */ }
      }
    }

    return NextResponse.json({ data: response })
  } catch (e) {
    return apiError(e)
  }
}
