import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''
  const expected = createHmac('sha512', secretKey).update(rawBody).digest('hex')

  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: { event: string; data: { reference: string; status: string; metadata?: { org_id?: string; plan?: string } } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Backup handler: activate subscription if charge.success and we haven't done so yet
  if (event.event === 'charge.success') {
    const { reference, metadata } = event.data
    const orgId = metadata?.org_id

    if (orgId) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('subscription_status, paystack_pending_plan')
        .eq('id', orgId)
        .single()

      // Only activate if not already active (callback may have already done this)
      if (org && org.subscription_status !== 'active') {
        const plan = org.paystack_pending_plan ?? metadata?.plan
        await supabaseAdmin
          .from('organizations')
          .update({
            subscription_status: 'active',
            plan,
            paystack_reference: reference,
            paystack_pending_plan: null,
          })
          .eq('id', orgId)
      }
    }
  }

  return NextResponse.json({ received: true })
}
