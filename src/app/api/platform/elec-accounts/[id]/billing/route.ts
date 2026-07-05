import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL

async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) return null
  return user
}

// GET /api/platform/elec-accounts/[id]/billing
// Live Paystack subscription + recent transaction history for a contractor account
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requirePlatformAdmin()
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: account, error } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, email, paystack_subscription_code, paystack_customer_code, paystack_reference')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) return NextResponse.json({ error: 'Paystack not configured' }, { status: 500 })

    if (!account.paystack_subscription_code) {
      return NextResponse.json({ configured: false, email: account.email })
    }

    const headers = { Authorization: `Bearer ${secretKey}` }

    const subRes = await fetch(`https://api.paystack.co/subscription/${account.paystack_subscription_code}`, { headers })
    const subJson = await subRes.json()
    if (!subRes.ok || !subJson.status) {
      return NextResponse.json({ error: subJson.message ?? 'Could not reach Paystack' }, { status: 502 })
    }
    const sub = subJson.data

    let transactions: Array<{ id: number; amount: number; status: string; paid_at: string | null; reference: string }> = []
    const customerId = sub?.customer?.id ?? sub?.customer?.customer_code
    if (customerId) {
      const txRes = await fetch(`https://api.paystack.co/transaction?customer=${customerId}&perPage=8`, { headers })
      const txJson = await txRes.json()
      if (txRes.ok && txJson.status) {
        transactions = (txJson.data ?? []).map((t: Record<string, unknown>) => ({
          id: t.id, amount: t.amount, status: t.status, paid_at: t.paid_at, reference: t.reference,
        }))
      }
    }

    return NextResponse.json({
      configured: true,
      subscriptionCode: sub.subscription_code,
      status: sub.status,
      amount: sub.amount,
      nextPaymentDate: sub.next_payment_date,
      planName: sub.plan?.name ?? null,
      planInterval: sub.plan?.interval ?? null,
      card: sub.authorization ? {
        brand: sub.authorization.brand ?? sub.authorization.card_type ?? null,
        last4: sub.authorization.last4 ?? null,
        expMonth: sub.authorization.exp_month ?? null,
        expYear: sub.authorization.exp_year ?? null,
        bank: sub.authorization.bank ?? null,
      } : null,
      transactions,
    })
  } catch (e) { return apiError(e) }
}
