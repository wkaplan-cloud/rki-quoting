import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { buildNotifEmail } from '@/lib/sourcing-notifications'

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'
const SUPPLIER_PORTAL_URL = process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL ?? 'https://suppliers.quotinghub.co.za'

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

    // Notify supplier of the decision
    if (process.env.RESEND_API_KEY) {
      try {
        // Fetch what we need: supplier email/name/token, item title, session title
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
            const resend = new Resend(process.env.RESEND_API_KEY)
            const itemTitle = itemRow?.title ?? 'an item'
            const isApproved = action === 'approve'
            const respondUrl = ssRow.portal_account_id
              ? `${SUPPLIER_PORTAL_URL}/requests/${aRow.session_supplier_id}`
              : `${APP_URL}/sourcing/respond/${ssRow.token}`

            await resend.emails.send({
              from: 'QuotingHub <no-reply@quotinghub.co.za>',
              to: ssRow.email,
              subject: isApproved
                ? `Spec change approved — ${sessionRow.title}`
                : `Spec change not approved — ${sessionRow.title}`,
              html: buildNotifEmail({
                heading: isApproved ? 'Specification change approved' : 'Specification change not approved',
                body: isApproved
                  ? `Your specification change for <strong>${itemTitle}</strong> in &ldquo;${sessionRow.title}&rdquo; has been approved. You can now submit your price.`
                  : `Your specification change for <strong>${itemTitle}</strong> in &ldquo;${sessionRow.title}&rdquo; was not approved. Please review the original specifications and submit your price as specified.`,
                ctaLabel: isApproved ? 'Submit your price' : 'View request',
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
