import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase/admin'

const NOTIFICATION_EMAIL = process.env.CONTACT_NOTIFICATION_EMAIL ?? 'wkaplan@gmail.com'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Honeypot check — bots fill this in, humans don't
  if (body._trap) {
    return NextResponse.json({ ok: true }) // silently succeed
  }

  const { name, email, type, message, company, cf_token } = body as {
    name?: string
    email?: string
    type?: string
    message?: string
    company?: string
    cf_token?: string
  }

  if (!email || !message?.trim()) {
    return NextResponse.json({ error: 'Email and message are required' }, { status: 400 })
  }

  // Verify Turnstile token if secret key is configured
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
  if (turnstileSecret) {
    if (!cf_token) {
      return NextResponse.json({ error: 'Security check required' }, { status: 400 })
    }
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: turnstileSecret, response: cf_token }),
    })
    const verifyData = await verify.json()
    if (!verifyData.success) {
      return NextResponse.json({ error: 'Security check failed. Please try again.' }, { status: 400 })
    }
  }

  // Save to database
  await supabaseAdmin.from('contact_submissions').insert({ name, email, type: type ?? null, message })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const subject = type
    ? `[QuotingHub] ${type} from ${name || email}`
    : `[QuotingHub] Contact form submission from ${name || email}`

  try {
    await resend.emails.send({
      from: 'QuotingHub <noreply@quotinghub.co.za>',
      to: NOTIFICATION_EMAIL,
      replyTo: email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#F5F2EC;border-radius:8px;">
          <h2 style="margin:0 0 4px;font-size:20px;color:#1A1A18;">${subject}</h2>
          <hr style="border:none;border-top:1px solid #D8D3C8;margin:16px 0;" />
          ${company ? `<p style="margin:0 0 8px;font-size:14px;color:#8A877F;"><strong>Studio:</strong> ${company}</p>` : ''}
          ${name ? `<p style="margin:0 0 8px;font-size:14px;color:#8A877F;"><strong>Name:</strong> ${name}</p>` : ''}
          <p style="margin:0 0 8px;font-size:14px;color:#8A877F;"><strong>Email:</strong> ${email}</p>
          ${type ? `<p style="margin:0 0 8px;font-size:14px;color:#8A877F;"><strong>Type:</strong> ${type}</p>` : ''}
          <p style="margin:16px 0 4px;font-size:14px;color:#8A877F;"><strong>Message:</strong></p>
          <p style="margin:0;font-size:15px;color:#1A1A18;white-space:pre-wrap;background:#fff;border:1px solid #D8D3C8;border-radius:6px;padding:12px 16px;">${message}</p>
          <hr style="border:none;border-top:1px solid #D8D3C8;margin:24px 0 16px;" />
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#1A1A18;border-radius:6px;padding:10px 20px;">
                <a href="https://quotinghub.co.za/platform/messages" target="_blank" style="color:#F5F2EC;text-decoration:none;font-size:13px;font-weight:500;font-family:sans-serif;">View in Platform Admin &rarr;</a>
              </td>
            </tr>
          </table>
          <p style="margin:12px 0 0;font-size:11px;color:#8A877F;">Or copy this link: https://quotinghub.co.za/platform/messages</p>
        </div>
      `,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
