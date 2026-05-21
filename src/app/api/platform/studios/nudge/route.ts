import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM = 'QuotingHub <hello@quotinghub.co.za>'
const ONBOARDING_URL = 'https://quotinghub.co.za/onboarding'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { user_id, email, full_name } = await req.json()
  if (!user_id || !email) return NextResponse.json({ error: 'Missing user_id or email' }, { status: 400 })

  const firstName = (full_name as string | undefined)?.split(' ')[0] ?? 'there'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: 'Complete your QuotingHub setup',
      html: `<div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #2C2C2A;">
  <img src="https://quotinghub.co.za/logo.png" alt="QuotingHub" style="height: 48px; width: auto; object-fit: contain; margin-bottom: 32px; display: block;" />
  <h1 style="font-size: 24px; font-weight: normal; color: #1A1A18; margin: 0 0 12px;">You are almost set up, ${firstName}!</h1>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 16px;">You confirmed your account but your studio setup is not quite finished yet. Add your business details and you will be ready to start quoting straight away.</p>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 28px;">It only takes about 2 minutes.</p>
  <a href="${ONBOARDING_URL}" style="display: inline-block; background-color: #9A7B4F; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-size: 14px; font-family: Arial, sans-serif; font-weight: 600;">Complete your setup →</a>
  <p style="font-size: 13px; color: #8A877F; margin: 32px 0 0; line-height: 1.6;">If you have any questions or run into any issues, just reply to this email — we are happy to help.</p>
  <hr style="border: none; border-top: 1px solid #EDE9E1; margin: 32px 0;" />
  <p style="font-size: 12px; color: #C4BFB5; margin: 0;">QuotingHub · quotinghub.co.za</p>
</div>`,
      text: `Hi ${firstName},\n\nYou confirmed your QuotingHub account but your studio setup is not quite finished yet.\n\nIt only takes about 2 minutes — just add your business details and you will be ready to start quoting.\n\nComplete your setup here:\n${ONBOARDING_URL}\n\nIf you have any questions, just reply to this email — we are happy to help.\n\n— The QuotingHub Team\nquotinghub.co.za`,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: body }, { status: 502 })
  }

  await supabaseAdmin
    .from('onboarding_nudges')
    .upsert({ user_id, sent_at: new Date().toISOString() })

  return NextResponse.json({ ok: true })
}
