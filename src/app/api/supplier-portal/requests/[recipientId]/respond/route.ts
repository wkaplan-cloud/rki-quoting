import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'

// POST /api/supplier-portal/requests/[recipientId]/respond — submit or decline (session-based)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  const { recipientId } = await params
  const resend = new Resend(process.env.RESEND_API_KEY)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!portalAccount) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

  const { data: recipient } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('id, supplier_name, email, status, sourcing_requests(id, title, user_id, status)')
    .eq('id', recipientId)
    .maybeSingle()

  if (!recipient || recipient.email.toLowerCase() !== portalAccount.email.toLowerCase()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const request = Array.isArray(recipient.sourcing_requests)
    ? recipient.sourcing_requests[0]
    : recipient.sourcing_requests as { id: string; title: string; user_id: string; status: string } | null

  if (!request || ['cancelled', 'pushed'].includes(request.status)) {
    return NextResponse.json({ error: 'This request is no longer accepting responses' }, { status: 410 })
  }

  if (['declined', 'accepted', 'rejected'].includes(recipient.status)) {
    return NextResponse.json({ error: 'You have already responded to this request' }, { status: 400 })
  }

  const body = await req.json() as {
    action: 'respond' | 'decline'
    unit_price?: number
    lead_time_weeks?: number | null
    notes?: string
    valid_until?: string | null
    supplier_edits?: Record<string, unknown> | null
    changed_fields?: string[] | null
    attachment_url?: string | null
  }

  const now = new Date().toISOString()

  if (body.action === 'decline') {
    await supabaseAdmin
      .from('sourcing_request_recipients')
      .update({ status: 'declined', responded_at: now })
      .eq('id', recipientId)
    return NextResponse.json({ success: true, action: 'declined' })
  }

  if (body.unit_price == null || isNaN(Number(body.unit_price))) {
    return NextResponse.json({ error: 'Unit price is required' }, { status: 400 })
  }

  const { error: responseError } = await supabaseAdmin
    .from('sourcing_request_responses')
    .insert({
      recipient_id: recipientId,
      unit_price: Number(body.unit_price),
      lead_time_weeks: body.lead_time_weeks ?? null,
      notes: body.notes?.trim() || null,
      valid_until: body.valid_until || null,
      supplier_edits: body.supplier_edits ?? null,
      changed_fields: body.changed_fields ?? null,
      attachment_url: body.attachment_url ?? null,
    })

  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 })

  await supabaseAdmin
    .from('sourcing_request_recipients')
    .update({ status: 'responded', responded_at: now })
    .eq('id', recipientId)

  if (request.status === 'sent') {
    await supabaseAdmin
      .from('sourcing_requests')
      .update({ status: 'responded' })
      .eq('id', request.id)
  }

  // Notify designer
  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('business_name, email_from')
    .eq('user_id', request.user_id)
    .maybeSingle()

  const designerEmail = settings?.email_from
  if (designerEmail) {
    const requestUrl = `${SITE_URL}/sourcing/${request.id}`
    await resend.emails.send({
      from: 'QuotingHub <no-reply@quotinghub.co.za>',
      to: designerEmail,
      subject: `${recipient.supplier_name} responded to: ${request.title}`,
      html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#F5F2EC;padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
          <table style="max-width:580px;width:100%;" cellpadding="0" cellspacing="0">
            <tr><td style="background:#2C2C2A;padding:28px 40px;border-radius:8px 8px 0 0;">
              <p style="margin:0;font-size:18px;font-weight:600;color:#F5F2EC;">New Pricing Response</p>
            </td></tr>
            <tr><td style="background:#fff;padding:32px 40px;border:1px solid #EDE9E1;border-top:none;">
              <p style="margin:0 0 12px;font-size:15px;color:#2C2C2A;"><strong>${recipient.supplier_name}</strong> submitted a price for <strong>${request.title}</strong>.</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#2C2C2A;">R ${Number(body.unit_price).toFixed(2)}</p>
              ${body.lead_time_weeks ? `<p style="margin:8px 0 0;font-size:13px;color:#8A877F;">Lead time: ${body.lead_time_weeks} weeks</p>` : ''}
              <a href="${requestUrl}" style="display:inline-block;margin-top:20px;background:#2C2C2A;color:#F5F2EC;font-size:13px;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">View &amp; Compare →</a>
            </td></tr>
          </table>
        </td></tr></table>
      </body></html>`,
      text: `${recipient.supplier_name} responded to "${request.title}" with R ${Number(body.unit_price).toFixed(2)}.\n\nView: ${requestUrl}`,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, action: 'responded' })
}
