import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'

// GET /api/sourcing/[id]/messages?recipient_id=X — designer fetches message thread
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const recipientId = req.nextUrl.searchParams.get('recipient_id')
  if (!recipientId) return NextResponse.json({ error: 'recipient_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership via RLS — sourcing_messages policy covers this
  const { data: messages, error } = await supabase
    .from('sourcing_messages')
    .select('id, sender_type, body, created_at')
    .eq('recipient_id', recipientId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: messages ?? [] })
}

// POST /api/sourcing/[id]/messages — designer sends a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { recipient_id: string; body: string }
  if (!body.recipient_id || !body.body?.trim()) {
    return NextResponse.json({ error: 'recipient_id and body are required' }, { status: 400 })
  }

  // Verify the recipient belongs to this request and the user owns it (RLS)
  const { data: request } = await supabase
    .from('sourcing_requests')
    .select('id, title, user_id')
    .eq('id', id)
    .single()

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch recipient to get email + token for notification
  const { data: recipient } = await supabase
    .from('sourcing_request_recipients')
    .select('id, email, supplier_name, token')
    .eq('id', body.recipient_id)
    .eq('sourcing_request_id', id)
    .single()

  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

  // Fetch studio name for email
  const { data: settings } = await supabase
    .from('settings')
    .select('business_name')
    .maybeSingle()

  const studioName = settings?.business_name ?? 'Your Studio'

  // Insert message
  const { data: message, error: insertError } = await supabase
    .from('sourcing_messages')
    .insert({ recipient_id: body.recipient_id, sender_type: 'designer', body: body.body.trim() })
    .select('id, sender_type, body, created_at')
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Notify supplier by email
  const respondUrl = `${SITE_URL}/sourcing/respond/${recipient.token}`
  await resend.emails.send({
    from: `${studioName} <no-reply@quotinghub.co.za>`,
    to: recipient.email,
    subject: `${studioName} sent you a message — ${request.title}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#2C2C2A;padding:28px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:18px;font-weight:600;color:#F5F2EC;">Message from ${studioName}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:32px 40px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 8px;font-size:13px;color:#8A877F;">Re: <strong style="color:#2C2C2A;">${request.title}</strong></p>
            <div style="background:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:14px 18px;margin:16px 0;">
              <p style="margin:0;font-size:14px;color:#2C2C2A;line-height:1.7;white-space:pre-wrap;">${body.body.trim()}</p>
            </div>
            <a href="${respondUrl}" style="display:inline-block;background-color:#2C2C2A;color:#F5F2EC;font-size:13px;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">View &amp; Reply →</a>
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
    text: `${studioName} sent you a message about "${request.title}":\n\n${body.body.trim()}\n\nReply here: ${respondUrl}`,
  }).catch(() => {})

  return NextResponse.json({ message })
}
