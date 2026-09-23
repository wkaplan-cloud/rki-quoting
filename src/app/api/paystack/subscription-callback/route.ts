import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { disablePaystackSubscription } from '@/lib/paystack'

export async function GET(req: NextRequest) {
  try {
  const ref = req.nextUrl.searchParams.get('ref') ?? req.nextUrl.searchParams.get('trxref') ?? req.nextUrl.searchParams.get('reference')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'

  if (!ref) return NextResponse.redirect(`${appUrl}/subscribe?payment=failed`)

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) return NextResponse.redirect(`${appUrl}/subscribe?payment=failed`)

  // Look up the org by the pending reference
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, paystack_pending_plan, subscription_status, paystack_subscription_code, paystack_previous_subscription_code')
    .eq('paystack_reference', ref)
    .single()

  if (!org) return NextResponse.redirect(`${appUrl}/subscribe?payment=failed`)

  // Verify with Paystack
  const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const paystackData = await paystackRes.json()

  if (!paystackRes.ok || paystackData.data?.status !== 'success') {
    return NextResponse.redirect(`${appUrl}/subscribe?payment=failed`)
  }

  const newSubCode: string | null = paystackData.data?.subscription?.subscription_code ?? null
  const oldSubCode: string | null = org.paystack_previous_subscription_code ?? null

  // Plan change: now that the new payment has cleared, cancel the subscription it
  // replaces. Skipped when the two codes match — subscription.create may already
  // have written the new code over the old one.
  if (oldSubCode && oldSubCode !== newSubCode) {
    await disablePaystackSubscription(oldSubCode, secretKey)
  }

  // Apply plan — works for both new subscriptions and upgrades/downgrades
  const plan = org.paystack_pending_plan ?? paystackData.data?.metadata?.plan
  await supabaseAdmin
    .from('organizations')
    .update({
      subscription_status: 'active',
      plan,
      paystack_pending_plan: null,
      paystack_reference: null,
      paystack_previous_subscription_code: null,
      paystack_subscription_code: newSubCode ?? org.paystack_subscription_code,
    })
    .eq('id', org.id)

  return NextResponse.redirect(`${appUrl}/dashboard?subscribed=1`)
  } catch (e) {
    return apiError(e)
  }
}
