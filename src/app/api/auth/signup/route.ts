import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase/admin'

const SITE_URL = 'https://quotinghub.co.za'

export async function POST(req: NextRequest) {
  const { email, password, full_name } = await req.json()

  if (!email || !password || !full_name?.trim()) {
    return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!/[A-Z]/.test(password)) {
    return NextResponse.json({ error: 'Password must contain at least one uppercase letter' }, { status: 400 })
  }
  if (!/[0-9]/.test(password)) {
    return NextResponse.json({ error: 'Password must contain at least one number' }, { status: 400 })
  }

  // Create user without auto-confirming — we send our own branded email.
  // app_metadata.is_self_signup is an admin-only flag used in /auth/callback to
  // reliably distinguish self-signup (→ /welcome) from invited users (→ /set-password).
  // URL params are not reliable because Supabase may not preserve them through its redirect chain.
  const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: false,
    user_metadata: { full_name: full_name.trim() },
    app_metadata: { is_self_signup: true },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  // Generate a signup confirmation link (includes token, redirects via Supabase then to our callback)
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'signup',
    email: email.toLowerCase().trim(),
    password, // required by Supabase SDK for signup type
    options: { redirectTo: `${SITE_URL}/auth/callback?type=signup` },
  })

  if (linkError || !linkData) {
    await supabaseAdmin.auth.admin.deleteUser(user!.id)
    return NextResponse.json({ error: 'Failed to generate confirmation link' }, { status: 500 })
  }

  const confirmUrl = linkData.properties.action_link
  const firstName = full_name.trim().split(' ')[0]

  // Send branded confirmation email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: emailError } = await resend.emails.send({
    from: 'QuotingHub <noreply@quotinghub.co.za>',
    to: email.toLowerCase().trim(),
    subject: 'Confirm your QuotingHub account',
    text: `Hi ${firstName},\n\nWelcome to QuotingHub! Please confirm your email address to activate your account:\n\n${confirmUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't sign up for QuotingHub, you can safely ignore this email.\n\nThe QuotingHub Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm your QuotingHub account</title></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background-color:#1A1A18;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:600;color:#F5F2EC;letter-spacing:0.01em;">QuotingHub</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Email Confirmation</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Hi ${firstName},</p>
            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Welcome to QuotingHub! You're one step away from replacing your old system with a proper quoting platform.</p>
            <p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Click the button below to confirm your email address and activate your account.</p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:6px;background-color:#9A7B4F;">
                  <a href="${confirmUrl}" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Confirm my account</a>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 8px;font-size:13px;color:#8A877F;line-height:1.6;">Or copy and paste this link into your browser:</p>
            <p style="margin:0;font-size:12px;color:#C4A46B;word-break:break-all;">${confirmUrl}</p>
            <p style="margin:24px 0 0;font-size:13px;color:#8A877F;line-height:1.6;">This link expires in 24 hours. If you didn't create an account on QuotingHub, you can safely ignore this email.</p>
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

  if (emailError) {
    // Roll back — don't leave an unconfirmed orphan user
    await supabaseAdmin.auth.admin.deleteUser(user!.id)
    return NextResponse.json({ error: 'Failed to send confirmation email. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
