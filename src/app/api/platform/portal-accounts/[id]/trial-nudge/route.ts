import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { bulkPayload, FROM_MARKETING } from '@/lib/email'
import { apiError } from '@/lib/api-error'
import {
  portalProduct,
  portalTrialDaysLeft,
  portalTrialNudgeHtml,
  portalTrialNudgePreheader,
  portalTrialNudgeSubject,
  portalTrialNudgeText,
} from '@/lib/portal-trial-nudge-email'

const RESEND_API_KEY = process.env.RESEND_API_KEY!

/**
 * Sends the trial / trial-expired nudge to one supplier-portal account.
 *
 * Covers both portal products (manufacturing and electrician/trades) off the
 * same row — the account's plan_category picks the copy. Product suppliers
 * never get a trial, so a non-trialing account is rejected rather than sent a
 * confusing email about a trial it never had.
 */
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

    const { id: accountId } = await params

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, email, contact_name, company_name, plan_category, supplier_category, subscription_status, trial_ends_at')
      .eq('id', accountId)
      .maybeSingle()

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    if (account.subscription_status !== 'trialing') {
      return NextResponse.json({ error: 'Account is not in trial' }, { status: 400 })
    }
    if (!account.email) {
      return NextResponse.json({ error: 'Account has no email address' }, { status: 400 })
    }

    // Nudges are lifecycle marketing — honour the unsubscribe list.
    const { data: optedOut } = await supabaseAdmin
      .from('email_unsubscribes')
      .select('email')
      .eq('email', account.email.toLowerCase())
      .maybeSingle()
    if (optedOut) {
      return NextResponse.json({ ok: true, skipped: 'recipient unsubscribed' })
    }

    const product = portalProduct(account.plan_category, account.supplier_category)
    const days = portalTrialDaysLeft(account.trial_ends_at)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bulkPayload({
        from: FROM_MARKETING,
        to: account.email,
        subject: portalTrialNudgeSubject(product, days),
        preheader: portalTrialNudgePreheader(days),
        html: portalTrialNudgeHtml(product, account.contact_name, account.email, days),
        text: portalTrialNudgeText(product, account.contact_name, days),
      })),
    })

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: body }, { status: 502 })
    }

    const sentAt = new Date().toISOString()
    await supabaseAdmin
      .from('supplier_portal_accounts')
      .update({ trial_nudge_sent_at: sentAt })
      .eq('id', accountId)

    return NextResponse.json({ ok: true, sent_to: account.email, sent_at: sentAt, product, expired: days <= 0 })
  } catch (e) {
    return apiError(e)
  }
}
