import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const PLANS: Record<string, { price: number; planCode: string }> = {
  solo:   { price: 699,  planCode: process.env.PAYSTACK_PLAN_SOLO   ?? '' },
  studio: { price: 1499, planCode: process.env.PAYSTACK_PLAN_STUDIO ?? '' },
  agency: { price: 2499, planCode: process.env.PAYSTACK_PLAN_AGENCY ?? '' },
}

export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { planId } = await req.json() as { planId: string }
  const plan = PLANS[planId]
  if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  if (!plan.planCode) return NextResponse.json({ error: 'Plan not configured' }, { status: 500 })

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: 'Paystack not configured' }, { status: 500 })

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })

  // Fetch org to check for existing active subscription
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('plan, subscription_status, paystack_subscription_code')
    .eq('id', orgId)
    .single()

  if (org?.plan === planId && org?.subscription_status === 'active') {
    return NextResponse.json({ error: 'You are already on this plan.' }, { status: 400 })
  }

  // Upgrade/downgrade: cancel existing Paystack subscription before creating a new one
  if (org?.paystack_subscription_code && org.subscription_status === 'active') {
    const subRes = await fetch(`https://api.paystack.co/subscription/${org.paystack_subscription_code}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const subData = await subRes.json()
    const emailToken = subData?.data?.email_token

    if (emailToken) {
      await fetch('https://api.paystack.co/subscription/disable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: org.paystack_subscription_code, token: emailToken }),
      })
    }

    // Clear old subscription code — new code arrives via subscription.create webhook
    await supabaseAdmin
      .from('organizations')
      .update({ paystack_subscription_code: null })
      .eq('id', orgId)
  }

  // Enforce user limits per plan
  if (planId === 'solo' || planId === 'studio') {
    const { count } = await supabaseAdmin
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'active')
    if (planId === 'solo' && (count ?? 0) > 1) {
      return NextResponse.json({ error: 'Solo plan is limited to 1 user. Please select the Studio or Agency plan.' }, { status: 400 })
    }
    if (planId === 'studio' && (count ?? 0) > 5) {
      return NextResponse.json({ error: 'Studio plan supports up to 5 users. Please select the Agency plan.' }, { status: 400 })
    }
  }

  const reference = `QH-sub-${orgId.slice(0, 8)}-${planId}-${Date.now()}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'
  const callbackUrl = `${appUrl}/api/paystack/subscription-callback?ref=${reference}`

  // Store pending reference on org
  await supabaseAdmin
    .from('organizations')
    .update({ paystack_reference: reference, paystack_pending_plan: planId })
    .eq('id', orgId)

  // Initialize transaction with plan code — Paystack auto-creates subscription after first payment
  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      amount: plan.price * 100, // kobo
      reference,
      currency: 'ZAR',
      callback_url: callbackUrl,
      plan: plan.planCode,
      metadata: {
        org_id: orgId,
        plan: planId,
        user_email: user.email,
      },
    }),
  })

  const paystackData = await paystackRes.json()
  if (!paystackRes.ok || !paystackData.status) {
    return NextResponse.json({ error: paystackData.message ?? 'Paystack error' }, { status: 500 })
  }

  return NextResponse.json({ authorization_url: paystackData.data.authorization_url })
  } catch (e) {
    return apiError(e)
  }
}
