import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { disablePaystackSubscription } from '@/lib/paystack'

/** The parts of a Paystack webhook payload this handler reads. */
interface PaystackEvent {
  event?: string
  data?: {
    reference?: string
    status?: string
    paid_at?: string | null
    subscription_code?: string
    subscription?: { subscription_code?: string }
    customer?: { customer_code?: string; email?: string }
    metadata?: {
      type?: string
      org_id?: string
      plan?: string
      plan_category?: string
      portal_account_id?: string
    }
  }
}

/** Tables keyed by a Paystack subscription, in the order we try them. */
const SUBSCRIBER_TABLES = ['organizations', 'supplier_portal_accounts'] as const

/**
 * Set subscription_status on whichever subscriber row this event belongs to.
 *
 * Matches on paystack_subscription_code first. When nothing matches — the code
 * is missing from the payload, or subscription.create never landed and the row
 * was left with a null code — falls back to paystack_customer_code, so a
 * cancellation can't be silently swallowed.
 *
 * The fallback only touches rows with NO subscription code. A row already
 * holding a different code is on a newer subscription (a plan change cancels the
 * one it replaces), and must not be cancelled by that older subscription's event.
 */
async function setSubscriptionStatus(
  status: string,
  subscriptionCode: string | undefined,
  customerCode: string | undefined,
) {
  for (const table of SUBSCRIBER_TABLES) {
    let matched = 0

    if (subscriptionCode) {
      const { data } = await supabaseAdmin.from(table)
        .update({ subscription_status: status })
        .eq('paystack_subscription_code', subscriptionCode)
        .select('id')
      matched = data?.length ?? 0
    }

    if (matched === 0 && customerCode) {
      await supabaseAdmin.from(table)
        .update({ subscription_status: status })
        .eq('paystack_customer_code', customerCode)
        .is('paystack_subscription_code', null)
        .select('id')
    }
  }
}

export async function POST(req: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''
  const expected = createHmac('sha512', secretKey).update(rawBody).digest('hex')
  if (signature !== expected) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  let event: PaystackEvent
  try { event = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { event: eventType, data } = event

  switch (eventType) {

    // ── First payment success — activate org (backup if callback missed) ──────
    case 'charge.success': {
      // Supplier quoting upgrade
      if (data?.metadata?.type === 'supplier_quoting') {
        const portalAccountId = data?.metadata?.portal_account_id
        const planCategory    = data?.metadata?.plan_category
        if (!portalAccountId) break
        const { data: acc } = await supabaseAdmin
          .from('supplier_portal_accounts')
          .select('subscription_status')
          .eq('id', portalAccountId)
          .single()
        if (acc && acc.subscription_status !== 'active') {
          await supabaseAdmin.from('supplier_portal_accounts').update({
            plan:                'quoting',
            plan_category:       planCategory ?? 'electrician',
            subscription_status: 'active',
            paystack_reference:  null,
          }).eq('id', portalAccountId)
          await supabaseAdmin
            .from('elec_settings')
            .upsert({ portal_account_id: portalAccountId }, { onConflict: 'portal_account_id', ignoreDuplicates: true })
        }
        break
      }

      // Designer org subscription
      const orgId = data?.metadata?.org_id
      const planId = data?.metadata?.plan
      if (!orgId) break
      const { data: org } = await supabaseAdmin.from('organizations')
        .select('subscription_status, paystack_pending_plan, paystack_previous_subscription_code')
        .eq('id', orgId).single()
      // Apply on new subscription OR on plan-change (upgrade/downgrade)
      if (org && (org.subscription_status !== 'active' || org.paystack_pending_plan)) {
        // Backup for the callback: cancel the subscription this payment replaces.
        const oldSubCode: string | null = org.paystack_previous_subscription_code ?? null
        if (oldSubCode && oldSubCode !== data?.subscription_code) {
          await disablePaystackSubscription(oldSubCode, secretKey)
        }

        await supabaseAdmin.from('organizations').update({
          subscription_status: 'active',
          plan: planId ?? org.paystack_pending_plan,
          paystack_pending_plan: null,
          paystack_previous_subscription_code: null,
          paystack_reference: data.reference,
        }).eq('id', orgId)
      }
      break
    }

    // ── Subscription created — store subscription_code and customer_code ──────
    case 'subscription.create': {
      const subscriptionCode = data?.subscription_code
      const customerCode = data?.customer?.customer_code
      const customerEmail = data?.customer?.email
      if (!subscriptionCode || !customerEmail) break

      // Look up org via the member's email
      const { data: member } = await supabaseAdmin
        .from('org_members')
        .select('org_id')
        .eq('invited_email', customerEmail.toLowerCase())
        .eq('status', 'active')
        .maybeSingle()

      if (member?.org_id) {
        await supabaseAdmin.from('organizations').update({
          paystack_subscription_code: subscriptionCode,
          paystack_customer_code: customerCode ?? null,
        }).eq('id', member.org_id)
      }
      break
    }

    // ── Monthly renewal succeeded — keep org active ───────────────────────────
    case 'invoice.update': {
      const paid = data?.status === 'success' && data?.paid_at
      if (!paid) break

      await setSubscriptionStatus('active', data?.subscription?.subscription_code, data?.customer?.customer_code)
      break
    }

    // ── Monthly renewal failed — mark as past_due ─────────────────────────────
    case 'invoice.payment_failed': {
      await setSubscriptionStatus('past_due', data?.subscription?.subscription_code, data?.customer?.customer_code)
      break
    }

    // ── Subscription cancelled/disabled — deactivate org + supplier ──────────
    case 'subscription.disable':
    case 'subscription.not_renew': {
      await setSubscriptionStatus('cancelled', data?.subscription_code, data?.customer?.customer_code)
      break
    }
  }

  return NextResponse.json({ received: true })
}
