import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PLAN_PRICES: Record<string, number> = {
  solo: 599,
  studio: 1099,
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { planId } = await req.json() as { planId: string }
  if (!PLAN_PRICES[planId]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: 'Paystack not configured' }, { status: 500 })

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 404 })

  // Enforce: Solo plan only available for single-user studios
  if (planId === 'solo') {
    const { count } = await supabaseAdmin
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'active')
    if ((count ?? 0) > 1) {
      return NextResponse.json({ error: 'Solo plan is not available for studios with multiple users. Please select the Studio plan.' }, { status: 400 })
    }
  }

  const amountZar = PLAN_PRICES[planId]
  const reference = `QH-sub-${orgId.slice(0, 8)}-${planId}-${Date.now()}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'
  const callbackUrl = `${appUrl}/api/paystack/subscription-callback?ref=${reference}`

  // Store the pending reference on the org so the callback can look it up
  await supabaseAdmin
    .from('organizations')
    .update({ paystack_reference: reference, paystack_pending_plan: planId })
    .eq('id', orgId)

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      amount: amountZar * 100, // kobo
      reference,
      currency: 'ZAR',
      callback_url: callbackUrl,
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
}
