import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL
const REPLY_FROM = process.env.PLATFORM_REPLY_EMAIL ?? 'hello@quotinghub.co.za'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { to, toName, message, id } = await req.json() as { to: string; toName?: string; message: string; id?: string }
  if (!to || !message?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const repliedAt = new Date().toISOString()
    const subject = 'Re: your QuotingHub message'
    await resend.emails.send({
      from: `QuotingHub <${REPLY_FROM}>`,
      to,
      replyTo: REPLY_FROM,
      subject,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#1A1A18;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:22px;font-weight:600;color:#F5F2EC;letter-spacing:0.01em;">QuotingHub</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Message${toName ? ` for ${esc(toName)}` : ''}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0;font-size:15px;line-height:1.7;color:#2C2C2A;white-space:pre-wrap;">${esc(message)}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">QuotingHub &middot; <a href="mailto:${REPLY_FROM}" style="color:#8A877F;text-decoration:none;">${REPLY_FROM}</a></p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4BFB5;">Built for interior designers</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })
    if (id) await supabaseAdmin.from('contact_submissions').update({ replied_at: repliedAt }).eq('id', id)
    return NextResponse.json({ ok: true, replied_at: repliedAt })
  } catch {
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}
