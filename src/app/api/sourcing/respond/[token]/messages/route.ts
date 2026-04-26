import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { apiError } from '@/lib/api-error'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'

// GET /api/sourcing/respond/[token]/messages — supplier fetches message thread (public, token-based)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const { data: recipient } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('id')
    .eq('token', token)
    .maybeSingle()

  if (!recipient) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

  const { data: messages, error } = await supabaseAdmin
    .from('sourcing_messages')
    .select('id, sender_type, body, created_at')
    .eq('recipient_id', recipient.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: messages ?? [] })
}

// POST /api/sourcing/respond/[token]/messages — supplier sends a message (public, token-based)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
  const { token } = await params
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data: recipient } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('id, supplier_name, sourcing_request_id, sourcing_requests(id, title, user_id, status)')
    .eq('token', token)
    .maybeSingle()

  if (!recipient) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

  const request = Array.isArray(recipient.sourcing_requests)
    ? recipient.sourcing_requests[0]
    : recipient.sourcing_requests as { id: string; title: string; user_id: string; status: string } | null

  if (!request || request.status === 'cancelled') {
    return NextResponse.json({ error: 'This request is no longer active' }, { status: 410 })
  }

  const body = await req.json() as { body: string }
  if (!body.body?.trim()) return NextResponse.json({ error: 'Message body required' }, { status: 400 })

  // Insert message
  const { data: message, error: insertError } = await supabaseAdmin
    .from('sourcing_messages')
    .insert({ recipient_id: recipient.id, sender_type: 'supplier', body: body.body.trim() })
    .select('id, sender_type, body, created_at')
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Notify designer via email
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
      subject: `${recipient.supplier_name} sent a message about: ${request.title}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#2C2C2A;padding:28px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:18px;font-weight:600;color:#F5F2EC;">Message from ${recipient.supplier_name}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:32px 40px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 8px;font-size:13px;color:#8A877F;">Re: <strong style="color:#2C2C2A;">${request.title}</strong></p>
            <div style="background:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:14px 18px;margin:16px 0;">
              <p style="margin:0;font-size:14px;color:#2C2C2A;line-height:1.7;white-space:pre-wrap;">${body.body.trim()}</p>
            </div>
            <a href="${requestUrl}" style="display:inline-block;background-color:#2C2C2A;color:#F5F2EC;font-size:13px;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View Request →</a>
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
      text: `${recipient.supplier_name} sent a message about "${request.title}":\n\n${body.body.trim()}\n\nView request: ${requestUrl}`,
    }).catch((err: unknown) => {
      console.error('[sourcing/respond/messages] designer notification email failed:', err)
    })
  }

  return NextResponse.json({ message })
  } catch (e) {
    return apiError(e)
  }
}
