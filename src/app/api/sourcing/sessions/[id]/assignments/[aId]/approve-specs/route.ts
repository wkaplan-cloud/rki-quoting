import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { buildNotifEmail } from '@/lib/sourcing-notifications'

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'
const SUPPLIER_PORTAL_URL = process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL ?? 'https://quotinghub.co.za'

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

    const body = await req.json() as { action: 'approve' | 'reject'; final_specs?: Record<string, string> }
    const { action, final_specs } = body
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    if (action === 'approve') {
      const now = new Date().toISOString()

      // Fetch item_id so we can write the finalised specs back to the item
      const { data: aRow } = await supabaseAdmin
        .from('sourcing_item_assignments')
        .select('item_id')
        .eq('id', assignmentId)
        .single()

      const updates: Record<string, unknown> = {
        spec_approval_status: 'approved',
        spec_approved_at: now,
        // Auto-select: spec approval = price acceptance in the new one-step flow
        status: 'accepted',
        accepted_at: now,
      }
      if (final_specs) updates.pending_supplier_specs = final_specs

      const { error: updateErr } = await supabaseAdmin
        .from('sourcing_item_assignments')
        .update(updates)
        .eq('id', assignmentId)
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

      if (aRow?.item_id) {
        await Promise.all([
          // Mark item as accepted
          supabaseAdmin.from('sourcing_session_items')
            .update({ status: 'accepted', ...(final_specs ? { item_specs: final_specs } : {}) })
            .eq('id', aRow.item_id),
          // Mark all other assignments for this item as declined
          supabaseAdmin.from('sourcing_item_assignments')
            .update({ status: 'declined' })
            .eq('item_id', aRow.item_id)
            .neq('id', assignmentId),
        ])
      }
    } else {
      // Delete the supplier's response so they must re-quote from scratch
      await supabaseAdmin
        .from('sourcing_item_responses')
        .delete()
        .eq('assignment_id', assignmentId)

      const { error } = await supabaseAdmin
        .from('sourcing_item_assignments')
        .update({
          spec_approval_status: 'rejected',
          pending_supplier_specs: null,
          status: 'pending',
          responded_at: null,
        })
        .eq('id', assignmentId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // On reject, notify the supplier they need to re-quote with original specs
    if (action === 'reject' && process.env.RESEND_API_KEY) {
      try {
        const { data: aRow } = await supabaseAdmin
          .from('sourcing_item_assignments')
          .select('item_id, session_supplier_id')
          .eq('id', assignmentId)
          .single()

        if (aRow) {
          const [{ data: ssRow }, { data: itemRow }, { data: sessionRow }] = await Promise.all([
              supabaseAdmin.from('sourcing_session_suppliers').select('email, supplier_name, token, portal_account_id').eq('id', aRow.session_supplier_id).single(),
              supabaseAdmin.from('sourcing_session_items').select('title').eq('id', aRow.item_id).maybeSingle(),
              supabaseAdmin.from('sourcing_sessions').select('id, title').eq('id', sessionId).single(),
            ])

            if (ssRow?.email && sessionRow) {
              const respondUrl = ssRow.portal_account_id
                ? `${SUPPLIER_PORTAL_URL}/requests/${aRow.session_supplier_id}`
                : `${APP_URL}/sourcing/respond/${ssRow.token}`

              const resend = new Resend(process.env.RESEND_API_KEY)
              await resend.emails.send({
                from: 'QuotingHub <no-reply@quotinghub.co.za>',
                to: ssRow.email,
                subject: `Spec change not accepted — ${sessionRow.title}`,
                html: buildNotifEmail({
                  heading: 'Specification change not accepted',
                  body: `Your specification change for <strong>${itemRow?.title ?? 'an item'}</strong> in &ldquo;${sessionRow.title}&rdquo; was not accepted. Your response has been removed &mdash; please re-submit your price with the original specifications.`,
                  ctaLabel: 'Re-submit your price',
                  ctaUrl: respondUrl,
                }),
              })
            }
        }
      } catch { /* never break the main response */ }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
