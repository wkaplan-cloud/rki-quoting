import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM = 'QuotingHub <hello@quotinghub.co.za>'

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

  // Send via Resend in batches of 50 (Resend batch limit)
  const htmlBody = `<div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #2C2C2A;">
  <img src="https://quotinghub.co.za/logo.png" alt="QuotingHub" style="height: 48px; width: auto; object-fit: contain; margin-bottom: 32px; display: block;" />
  <div style="font-size: 15px; line-height: 1.8; color: #5A5751; white-space: pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  <hr style="border: none; border-top: 1px solid #EDE9E1; margin: 32px 0;" />
  <p style="font-size: 12px; color: #C4BFB5; margin: 0;">QuotingHub · quotinghub.co.za · To unsubscribe, reply to this email.</p>
</div>`

  let sentCount = 0
  const errors: string[] = []

  for (let i = 0; i < targetEmails.length; i += 50) {
    const batch = targetEmails.slice(i, i + 50)
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.map(to => ({
        from: FROM,
        to: [to],
        subject,
        html: htmlBody,
        text: body,
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

  return NextResponse.json({ sent: sentCount, errors: errors.length })
}
