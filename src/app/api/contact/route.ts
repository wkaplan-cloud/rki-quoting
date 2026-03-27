import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL ?? 'warren@kaplan.co.za'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Honeypot check — bots fill this in, humans don't
  if (body._trap) {
    return NextResponse.json({ ok: true }) // silently succeed
  }

  const { name, email, type, message } = body as {
    name?: string
    email?: string
    type?: string
    message?: string
  }

  if (!email || !message?.trim()) {
    return NextResponse.json({ error: 'Email and message are required' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const subject = type
    ? `[QuotingHub] ${type} from ${name || email}`
    : `[QuotingHub] Contact form submission from ${name || email}`

  try {
    await resend.emails.send({
      from: 'QuotingHub <noreply@quotinghub.co.za>',
      to: ADMIN_EMAIL,
      replyTo: email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#F5F2EC;border-radius:8px;">
          <h2 style="margin:0 0 4px;font-size:20px;color:#1A1A18;">${subject}</h2>
          <hr style="border:none;border-top:1px solid #D8D3C8;margin:16px 0;" />
          ${name ? `<p style="margin:0 0 8px;font-size:14px;color:#8A877F;"><strong>Name:</strong> ${name}</p>` : ''}
          <p style="margin:0 0 8px;font-size:14px;color:#8A877F;"><strong>Email:</strong> ${email}</p>
          ${type ? `<p style="margin:0 0 8px;font-size:14px;color:#8A877F;"><strong>Type:</strong> ${type}</p>` : ''}
          <p style="margin:16px 0 4px;font-size:14px;color:#8A877F;"><strong>Message:</strong></p>
          <p style="margin:0;font-size:15px;color:#1A1A18;white-space:pre-wrap;background:#fff;border:1px solid #D8D3C8;border-radius:6px;padding:12px 16px;">${message}</p>
        </div>
      `,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
