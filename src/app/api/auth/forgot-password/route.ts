import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase/admin'

const SITE_URL = 'https://quotinghub.co.za'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: normalizedEmail,
    options: { redirectTo: `${SITE_URL}/auth/reset` },
  })

  // Never reveal whether the account exists — always report success.
  if (linkError || !linkData) {
    return NextResponse.json({ ok: true })
  }

  const resetUrl = linkData.properties.action_link

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'QuotingHub <noreply@quotinghub.co.za>',
    replyTo: 'hello@quotinghub.co.za',
    to: normalizedEmail,
    subject: 'Reset your QuotingHub password',
    text: `Hi,\n\nWe received a request to reset your QuotingHub password. Click the link below to choose a new one:\n\n${resetUrl}\n\nThis link expires shortly. If you didn't request this, you can safely ignore this email.\n\nThe QuotingHub Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset your QuotingHub password</title></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background-color:#1A1A18;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:600;color:#F5F2EC;letter-spacing:0.01em;">QuotingHub</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Password Reset</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Hi,</p>
            <p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">We received a request to reset your QuotingHub password. Click the button below to choose a new one.</p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:6px;background-color:#9A7B4F;">
                  <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Reset my password</a>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 8px;font-size:13px;color:#8A877F;line-height:1.6;">Or copy and paste this link into your browser:</p>
            <p style="margin:0;font-size:12px;color:#C4A46B;word-break:break-all;">${resetUrl}</p>
            <p style="margin:24px 0 0;font-size:13px;color:#8A877F;line-height:1.6;">If you didn't request this, you can safely ignore this email.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">QuotingHub &middot; <a href="https://quotinghub.co.za" style="color:#8A877F;text-decoration:none;">quotinghub.co.za</a></p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4BFB5;">Built for interior designers</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })

  return NextResponse.json({ ok: true })
}
