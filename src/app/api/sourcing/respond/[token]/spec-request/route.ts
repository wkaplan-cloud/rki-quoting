import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { buildNotifEmail } from '@/lib/sourcing-notifications'

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'

// POST /api/sourcing/respond/[token]/spec-request
// Supplier submits spec edits for designer approval (no price yet)
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: ss } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('id, supplier_name, session_id')
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
      .select('id, status, item_id')
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

    // Notify designer that supplier has requested a spec change
    if ((ss as any).session_id && process.env.RESEND_API_KEY) {
      try {
        const [{ data: sessionRow }, { data: itemRow }] = await Promise.all([
          supabaseAdmin.from('sourcing_sessions').select('id, title, created_by').eq('id', (ss as any).session_id).single(),
          supabaseAdmin.from('sourcing_session_items').select('title').eq('id', (assignment as any).item_id).maybeSingle(),
        ])
        if (sessionRow?.created_by) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(sessionRow.created_by)
          const designerEmail = userData?.user?.email
          if (designerEmail) {
            const resend = new Resend(process.env.RESEND_API_KEY)
            const supplierName = (ss as any).supplier_name ?? 'A supplier'
            const itemTitle = itemRow?.title ?? 'an item'
            await resend.emails.send({
              from: 'QuotingHub <no-reply@quotinghub.co.za>',
              to: designerEmail,
              subject: `${supplierName} requested a spec change — ${sessionRow.title}`,
              html: buildNotifEmail({
                heading: 'Spec change requested',
                body: `<strong>${supplierName}</strong> has requested a specification change for <strong>${itemTitle}</strong> in &ldquo;${sessionRow.title}&rdquo;. Please review and approve or reject the change before they can submit a price.`,
                ctaLabel: 'Review spec change',
                ctaUrl: `${APP_URL}/sourcing/${sessionRow.id}`,
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
