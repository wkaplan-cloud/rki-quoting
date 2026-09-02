import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { bulkPayload, FROM_MARKETING } from '@/lib/email'
import { nudgeHtml, nudgeText } from '@/lib/nudge-email'

export const maxDuration = 60

const RESEND_API_KEY = process.env.RESEND_API_KEY!

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

  // Nudges are lifecycle marketing — honour the unsubscribe list.
  const { data: optedOut } = await supabase.from('email_unsubscribes').select('email')
  const suppressed = new Set((optedOut ?? []).map((r: { email: string }) => r.email.toLowerCase()))

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const user of toNudge) {
    if (user.email && suppressed.has(user.email.toLowerCase())) { skipped++; continue }
    const fullName = user.user_metadata?.full_name as string | undefined
    const email = user.email!

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bulkPayload({
        from: FROM_MARKETING,
        to: email,
        subject: 'Complete your QuotingHub setup',
        preheader: 'Add your business details and you can start quoting straight away.',
        html: nudgeHtml(fullName, email),
        text: nudgeText(fullName),
      })),
    })

    if (res.ok) {
      await supabase.from('onboarding_nudges').insert({ user_id: user.id })
      sent++
    } else {
      const body = await res.text()
      errors.push(`${email}: ${body}`)
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors: errors.length ? errors : undefined })
}
