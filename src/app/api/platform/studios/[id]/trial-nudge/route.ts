import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { bulkPayload, FROM_MARKETING } from '@/lib/email'
import { apiError } from '@/lib/api-error'
import {
  trialDaysLeft,
  trialNudgeHtml,
  trialNudgePreheader,
  trialNudgeSubject,
  trialNudgeText,
} from '@/lib/trial-nudge-email'

const RESEND_API_KEY = process.env.RESEND_API_KEY!

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Platform-admin only — matches the guard on every other /api/platform route.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: orgId } = await params

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('subscription_status, trial_ends_at')
      .eq('id', orgId)
      .maybeSingle()

    if (!org) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 })
    }
    // Only trialing studios get this email — an active subscriber being told
    // their trial is ending would be alarming and wrong.
    if (org.subscription_status !== 'trialing') {
      return NextResponse.json({ error: 'Studio is not in trial' }, { status: 400 })
    }

    const { data: admin } = await supabaseAdmin
      .from('org_members')
      .select('invited_email, full_name')
      .eq('org_id', orgId)
      .eq('role', 'admin')
      .order('status', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!admin?.invited_email) {
      return NextResponse.json({ error: 'No admin email found for this studio' }, { status: 400 })
    }
    const email = admin.invited_email.toLowerCase()

    // Nudges are lifecycle marketing — honour the unsubscribe list.
    const { data: optedOut } = await supabaseAdmin
      .from('email_unsubscribes')
      .select('email')
      .eq('email', email)
      .maybeSingle()
    if (optedOut) {
      return NextResponse.json({ ok: true, skipped: 'recipient unsubscribed' })
    }

    const days = trialDaysLeft(org.trial_ends_at)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bulkPayload({
        from: FROM_MARKETING,
        to: admin.invited_email,
        subject: trialNudgeSubject(days),
        preheader: trialNudgePreheader(days),
        html: trialNudgeHtml(admin.full_name, admin.invited_email, days),
        text: trialNudgeText(admin.full_name, days),
      })),
    })

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: body }, { status: 502 })
    }

    const sentAt = new Date().toISOString()
    await supabaseAdmin
      .from('organizations')
      .update({ trial_nudge_sent_at: sentAt })
      .eq('id', orgId)

    return NextResponse.json({ ok: true, sent_to: admin.invited_email, sent_at: sentAt, expired: days <= 0 })
  } catch (e) {
    return apiError(e)
  }
}
