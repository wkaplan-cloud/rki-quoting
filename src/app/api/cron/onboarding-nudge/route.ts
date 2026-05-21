import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM = 'QuotingHub <hello@quotinghub.co.za>'
const ONBOARDING_URL = 'https://quotinghub.co.za/onboarding'

// SAST = UTC+2. Don't send nudges between 22:00 and 07:00 SAST.
function isQuietHoursSAST(): boolean {
  const hourSAST = (new Date().getUTCHours() + 2) % 24
  return hourSAST >= 22 || hourSAST < 7
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isQuietHoursSAST()) {
    return NextResponse.json({ skipped: 'quiet hours' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Find auth users who confirmed their email 23–49 hours ago
  // (wide window so overnight-held nudges aren't missed on the next hourly run)
  const now = new Date()
  const from = new Date(now.getTime() - 49 * 60 * 60 * 1000).toISOString()
  const to   = new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString()

  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  const candidates = authUsers.users.filter(u => {
    const confirmed = u.email_confirmed_at
    if (!confirmed) return false
    return confirmed >= from && confirmed <= to
  })

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no candidates in window' })
  }

  // Filter out users who already have an org (completed onboarding)
  const candidateIds = candidates.map(u => u.id)
  const { data: existingMembers } = await supabase
    .from('org_members')
    .select('user_id')
    .in('user_id', candidateIds)

  const hasOrg = new Set((existingMembers ?? []).map((m: { user_id: string }) => m.user_id))

  // Filter out users who've already been sent a nudge
  const { data: alreadySent } = await supabase
    .from('onboarding_nudges')
    .select('user_id')
    .in('user_id', candidateIds)

  const alreadyNudged = new Set((alreadySent ?? []).map((r: { user_id: string }) => r.user_id))

  const toNudge = candidates.filter(u => !hasOrg.has(u.id) && !alreadyNudged.has(u.id))

  if (toNudge.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'all candidates already onboarded or nudged' })
  }

  let sent = 0
  const errors: string[] = []

  for (const user of toNudge) {
    const firstName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'there'
    const email = user.email!

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

    if (res.ok) {
      await supabase.from('onboarding_nudges').insert({ user_id: user.id })
      sent++
    } else {
      const body = await res.text()
      errors.push(`${email}: ${body}`)
    }
  }

  return NextResponse.json({ ok: true, sent, errors: errors.length ? errors : undefined })
}
