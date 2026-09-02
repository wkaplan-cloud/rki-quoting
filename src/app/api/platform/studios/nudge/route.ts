import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { bulkPayload, FROM_MARKETING } from '@/lib/email'
import { nudgeHtml, nudgeText } from '@/lib/nudge-email'

const RESEND_API_KEY = process.env.RESEND_API_KEY!

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { user_id, email, full_name, test } = await req.json()
  // A test send targets any address and is not recorded against an account.
  if (!email || (!test && !user_id)) {
    return NextResponse.json({ error: 'Missing user_id or email' }, { status: 400 })
  }


  // Nudges are lifecycle marketing — honour the unsubscribe list.
  const { data: optedOut } = await supabaseAdmin
    .from('email_unsubscribes')
    .select('email')
    .eq('email', String(email).toLowerCase())
    .maybeSingle()
  if (optedOut) {
    return NextResponse.json({ ok: true, skipped: 'recipient unsubscribed' })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(bulkPayload({
      from: FROM_MARKETING,
      to: email,
      subject: 'Complete your QuotingHub setup',
      preheader: 'Add your business details and you can start quoting straight away.',
      html: nudgeHtml(full_name, email),
      text: nudgeText(full_name),
    })),
  })

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: body }, { status: 502 })
  }

  if (!test) {
    await supabaseAdmin
      .from('onboarding_nudges')
      .upsert({ user_id, sent_at: new Date().toISOString() })
  }

  return NextResponse.json({ ok: true, from: FROM_MARKETING })
}
