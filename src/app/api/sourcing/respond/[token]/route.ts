import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'

// GET /api/sourcing/respond/[token] — fetch request data for supplier page (public, no auth)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Look up recipient by token
  const { data: recipient } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('*, sourcing_requests(*), sourcing_request_responses(*)')
    .eq('token', token)
    .maybeSingle()

  if (!recipient) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  const request = recipient.sourcing_requests as Record<string, unknown>

  if (!request || ['cancelled'].includes(String(request.status))) {
    return NextResponse.json({ error: 'This pricing request is no longer active' }, { status: 410 })
  }

  // Fetch images for the request
  const { data: images } = await supabaseAdmin
    .from('sourcing_request_images')
    .select('*')
    .eq('sourcing_request_id', String(request.id))
    .order('sort_order')

  // Fetch studio name
  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('business_name')
    .eq('user_id', String(request.user_id))
    .maybeSingle()

  return NextResponse.json({
    request: {
      id: request.id,
      title: request.title,
      specifications: request.specifications,
      quantity: request.quantity,
      unit: request.unit,
      dimensions: request.dimensions,
      colour_finish: request.colour_finish,
      status: request.status,
    },
    recipient: {
      id: recipient.id,
      supplier_name: recipient.supplier_name,
      status: recipient.status,
      viewed_at: recipient.viewed_at,
      responded_at: recipient.responded_at,
    },
    response: Array.isArray(recipient.sourcing_request_responses)
      ? (recipient.sourcing_request_responses[0] ?? null)
      : (recipient.sourcing_request_responses ?? null),
    images: images ?? [],
    studio_name: settings?.business_name ?? 'Your Studio',
  })
}

// POST /api/sourcing/respond/[token] — supplier submits a response (public, no auth)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data: recipient } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('*, sourcing_requests(*)')
    .eq('token', token)
    .maybeSingle()

  if (!recipient) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  const request = recipient.sourcing_requests as Record<string, unknown>

  if (!request || ['cancelled', 'pushed'].includes(String(request.status))) {
    return NextResponse.json({ error: 'This pricing request is no longer accepting responses' }, { status: 410 })
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
  }

  const now = new Date().toISOString()

  if (body.action === 'decline') {
    await supabaseAdmin
      .from('sourcing_request_recipients')
      .update({ status: 'declined', responded_at: now })
      .eq('id', recipient.id)

    return NextResponse.json({ success: true, action: 'declined' })
  }

  // Validate response fields
  if (body.unit_price == null || isNaN(Number(body.unit_price))) {
    return NextResponse.json({ error: 'Unit price is required' }, { status: 400 })
  }

  // Insert response
  const { error: responseError } = await supabaseAdmin
    .from('sourcing_request_responses')
    .insert({
      recipient_id: recipient.id,
      unit_price: Number(body.unit_price),
      lead_time_weeks: body.lead_time_weeks ?? null,
      notes: body.notes?.trim() || null,
      valid_until: body.valid_until || null,
      supplier_edits: body.supplier_edits ?? null,
      changed_fields: body.changed_fields ?? null,
    })

  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 })

  // Update recipient status
  await supabaseAdmin
    .from('sourcing_request_recipients')
    .update({ status: 'responded', responded_at: now })
    .eq('id', recipient.id)

  // Promote request to 'responded' if still in 'sent'
  if (request.status === 'sent') {
    await supabaseAdmin
      .from('sourcing_requests')
      .update({ status: 'responded' })
      .eq('id', String(request.id))
  }

  // Notify designer via email
  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('business_name, email_from')
    .eq('user_id', String(request.user_id))
    .maybeSingle()

  const designerEmail = settings?.email_from
  if (designerEmail) {
    const requestUrl = `${SITE_URL}/sourcing/${String(request.id)}`
    await resend.emails.send({
      from: 'QuotingHub <no-reply@quotinghub.co.za>',
      to: designerEmail,
      subject: `${recipient.supplier_name} responded to: ${String(request.title)}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#2C2C2A;padding:28px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:18px;font-weight:600;color:#F5F2EC;">New Pricing Response</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:32px 40px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#2C2C2A;">
              <strong>${recipient.supplier_name}</strong> has submitted a price for <strong>${String(request.title)}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:14px 18px;margin:20px 0;">
              <tr>
                <td style="font-size:13px;color:#8A877F;padding-bottom:4px;">Unit Price</td>
                <td style="font-size:16px;font-weight:600;color:#1A1A18;text-align:right;">R ${Number(body.unit_price).toFixed(2)}</td>
              </tr>
              ${body.lead_time_weeks ? `<tr><td style="font-size:13px;color:#8A877F;padding-top:8px;">Lead Time</td><td style="font-size:13px;color:#2C2C2A;text-align:right;padding-top:8px;">${body.lead_time_weeks} weeks</td></tr>` : ''}
            </table>
            <a href="${requestUrl}" style="display:inline-block;background-color:#2C2C2A;color:#F5F2EC;font-size:13px;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">View &amp; Compare Responses →</a>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:16px 40px;">
            <p style="margin:0;font-size:11px;color:#C4BFB5;">Sent via QuotingHub</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      text: `${recipient.supplier_name} submitted a price for "${String(request.title)}".\n\nUnit Price: R ${Number(body.unit_price).toFixed(2)}\n${body.lead_time_weeks ? 'Lead Time: ' + body.lead_time_weeks + ' weeks\n' : ''}\nView responses: ${requestUrl}`,
    }).catch(() => {
      // Don't fail the response if notification email fails
    })
  }

  return NextResponse.json({ success: true, action: 'responded' })
}
