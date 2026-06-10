import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { PLANS, MANUFACTURER_PLAN } from '@/lib/plan-features'

const PLAN_MAP: Record<string, { price: number; planCode: string; label: string; type: 'electrician' | 'manufacturer' }> = {
  ...Object.fromEntries(
    PLANS.map(p => [p.id, { price: p.price, planCode: process.env[p.envKey] ?? '', label: p.label, type: 'electrician' as const }])
  ),
  [MANUFACTURER_PLAN.id]: {
    price:    MANUFACTURER_PLAN.price,
    planCode: process.env[MANUFACTURER_PLAN.envKey] ?? '',
    label:    MANUFACTURER_PLAN.label,
    type:     'manufacturer',
  },
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { planId } = await req.json() as { planId: string }
    const plan = PLAN_MAP[planId]
    if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    if (!plan.planCode) return NextResponse.json({ error: 'Plan not configured' }, { status: 500 })

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) return NextResponse.json({ error: 'Paystack not configured' }, { status: 500 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, email, subscription_status')
      .eq('auth_user_id', user.id)
      .single()

    if (!account) return NextResponse.json({ error: 'No supplier account found' }, { status: 404 })

    const reference = `QH-sup-${account.id.slice(0, 8)}-${planId}-${Date.now()}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'
    const callbackUrl = `${appUrl}/api/supplier-portal/paystack/callback?ref=${reference}`

    await supabaseAdmin
      .from('supplier_portal_accounts')
      .update({ paystack_reference: reference })
      .eq('id', account.id)

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:        account.email,
        amount:       plan.price * 100,
        reference,
        currency:     'ZAR',
        callback_url: callbackUrl,
        plan:         plan.planCode,
        metadata: {
          portal_account_id: account.id,
          plan_id:           planId,
          type:              plan.type,
          user_email:        account.email,
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
