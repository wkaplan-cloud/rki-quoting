import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''
  const expected = createHmac('sha512', secretKey).update(rawBody).digest('hex')
  if (signature !== expected) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  let event: Record<string, any>
  try { event = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { event: eventType, data } = event

  switch (eventType) {

    // ── First payment success — activate org (backup if callback missed) ──────
    case 'charge.success': {
      const orgId = data?.metadata?.org_id
      const planId = data?.metadata?.plan
      if (!orgId) break
      const { data: org } = await supabaseAdmin.from('organizations').select('subscription_status, paystack_pending_plan').eq('id', orgId).single()
      if (org && org.subscription_status !== 'active') {
        await supabaseAdmin.from('organizations').update({
          subscription_status: 'active',
          plan: planId ?? org.paystack_pending_plan,
          paystack_pending_plan: null,
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
      const subscriptionCode = data?.subscription?.subscription_code
      const paid = data?.status === 'success' && data?.paid_at
      if (!subscriptionCode || !paid) break

      await supabaseAdmin.from('organizations')
        .update({ subscription_status: 'active' })
        .eq('paystack_subscription_code', subscriptionCode)
      break
    }

    // ── Monthly renewal failed — mark as past_due ─────────────────────────────
    case 'invoice.payment_failed': {
      const subscriptionCode = data?.subscription?.subscription_code
      if (!subscriptionCode) break

      await supabaseAdmin.from('organizations')
        .update({ subscription_status: 'past_due' })
        .eq('paystack_subscription_code', subscriptionCode)
      break
    }

    // ── Subscription cancelled/disabled — deactivate org ─────────────────────
    case 'subscription.disable':
    case 'subscription.not_renew': {
      const subscriptionCode = data?.subscription_code
      if (!subscriptionCode) break

      await supabaseAdmin.from('organizations')
        .update({ subscription_status: 'cancelled' })
        .eq('paystack_subscription_code', subscriptionCode)
      break
    }
  }

  return NextResponse.json({ received: true })
}
