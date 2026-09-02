import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { bulkPayload, marketingFooter, FROM_MARKETING } from '@/lib/email'

const RESEND_API_KEY = process.env.RESEND_API_KEY!

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { subject, body, filter } = await req.json()
  if (!subject?.trim() || !body?.trim() || !filter) {
    return NextResponse.json({ error: 'Missing subject, body, or filter' }, { status: 400 })
  }

  // Resolve recipient emails
  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, plan, subscription_status')
    .eq('status', 'active')
    .in('subscription_status', ['active', 'trialing'])

  const orgIds = (orgs ?? []).map(o => o.id)
  const { data: adminMembers } = await supabaseAdmin
    .from('org_members')
    .select('org_id, user_id')
    .in('org_id', orgIds)
    .eq('role', 'admin')
    .eq('status', 'active')

  const orgById = new Map((orgs ?? []).map(o => [o.id, o]))

  const targetEmails: string[] = []
  const batchSize = 50
  const allAdminUserIds = (adminMembers ?? []).map(m => m.user_id).filter(Boolean)

  const userEmails: Record<string, string> = {}
  for (let i = 0; i < allAdminUserIds.length; i += batchSize) {
    const batch = allAdminUserIds.slice(i, i + batchSize)
    await Promise.all(batch.map(async (uid) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(uid)
      if (data.user?.email) userEmails[uid] = data.user.email
    }))
  }

  for (const m of adminMembers ?? []) {
    const org = orgById.get(m.org_id)
    if (!org || !m.user_id) continue
    const email = userEmails[m.user_id]
    if (!email) continue

    const match =
      filter === 'all' ||
      (filter === 'trialing' && org.subscription_status === 'trialing') ||
      (filter === 'solo' && org.subscription_status === 'active' && org.plan === 'solo') ||
      (filter === 'studio' && org.subscription_status === 'active' && org.plan === 'studio') ||
      (filter === 'agency' && org.subscription_status === 'active' && org.plan === 'agency')

    if (match) targetEmails.push(email)
  }

  if (targetEmails.length === 0) {
    return NextResponse.json({ error: 'No recipients matched the filter' }, { status: 400 })
  }

  // Drop anyone who has unsubscribed from marketing mail.
  const { data: optedOut } = await supabaseAdmin
    .from('email_unsubscribes')
    .select('email')
  const suppressed = new Set((optedOut ?? []).map(r => r.email.toLowerCase()))
  const sendTo = targetEmails.filter(e => !suppressed.has(e.toLowerCase()))
  const skipped = targetEmails.length - sendTo.length

  if (sendTo.length === 0) {
    return NextResponse.json({ error: 'All matched recipients have unsubscribed' }, { status: 400 })
  }

  // The footer differs per recipient (each gets their own unsubscribe token),
  // so the body is built inside the loop rather than once up front.
  const escaped = body.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const htmlFor = (email: string) => `<div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #2C2C2A;">
  <img src="https://www.quotinghub.co.za/logo-email.png" alt="QuotingHub" width="48" height="48" style="height: 48px; width: 48px; object-fit: contain; margin-bottom: 32px; display: block; border: 0;" />
  <div style="font-size: 15px; line-height: 1.8; color: #5A5751; white-space: pre-wrap;">${escaped}</div>
  ${marketingFooter(email)}
</div>`

  // Preheader: first line of the message, so the inbox preview is intentional.
  const preheader = body.replace(/\s+/g, ' ').trim().slice(0, 90)

  let sentCount = 0
  const errors: string[] = []

  for (let i = 0; i < sendTo.length; i += 50) {
    const batch = sendTo.slice(i, i + 50)
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.map(to => bulkPayload({
        to,
        subject,
        html: htmlFor(to),
        text: body,
        preheader,
        from: FROM_MARKETING,
      }))),
    })
    if (res.ok) {
      sentCount += batch.length
    } else {
      const errText = await res.text()
      errors.push(errText)
    }
  }

  if (errors.length > 0) {
    console.error('Broadcast partial errors:', errors)
  }

  return NextResponse.json({ sent: sentCount, skipped, errors: errors.length })
}
