import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { verifyUnsubscribeToken } from '@/lib/email'

/**
 * Unsubscribe endpoint.
 *
 * POST — RFC 8058 one-click. Gmail and Yahoo POST here directly from the
 *        "Unsubscribe" button in the client. It must succeed on a single POST
 *        with no authentication and no confirmation step.
 * GET  — the visible footer link, for humans. Same effect, plus a page.
 */

async function suppress(email: string, source: string, userAgent: string | null) {
  await supabaseAdmin
    .from('email_unsubscribes')
    .upsert(
      { email: email.toLowerCase(), source, user_agent: userAgent },
      { onConflict: 'email' },
    )
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? ''
  const email = verifyUnsubscribeToken(token)
  // Always 200: a mail client retrying a failed one-click looks like a complaint.
  if (!email) return new NextResponse('OK', { status: 200 })

  await suppress(email, 'one-click', req.headers.get('user-agent'))
  return new NextResponse('OK', { status: 200 })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? ''
  const email = verifyUnsubscribeToken(token)

  const page = (heading: string, body: string) => new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Unsubscribe · QuotingHub</title></head>
<body style="margin:0;background:#F5F2EC;font-family:Georgia,serif;color:#2C2C2A;">
<div style="max-width:520px;margin:0 auto;padding:64px 24px;">
  <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-0.01em;">${heading}</h1>
  <p style="font-size:15px;line-height:1.7;color:#5A5751;margin:0 0 24px;">${body}</p>
  <p style="font-size:13px;color:#8A877F;margin:0;">You will still receive essential account emails such as
  password resets, quotes and invoices.</p>
  <p style="margin:32px 0 0;"><a href="https://quotinghub.co.za"
    style="font-size:13px;color:#9A7B4F;">Back to quotinghub.co.za</a></p>
</div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )

  if (!email) {
    return page(
      'This link has expired',
      'We could not verify this unsubscribe link. Email <a href="mailto:hello@quotinghub.co.za" style="color:#9A7B4F;">hello@quotinghub.co.za</a> and we will remove you manually.',
    )
  }

  await suppress(email, 'link', req.headers.get('user-agent'))
  return page(
    'You have been unsubscribed',
    `<strong>${email}</strong> has been removed from QuotingHub marketing emails.`,
  )
}
