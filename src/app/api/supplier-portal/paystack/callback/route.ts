import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const ref = req.nextUrl.searchParams.get('ref') ?? req.nextUrl.searchParams.get('trxref') ?? req.nextUrl.searchParams.get('reference')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'

    if (!ref) return NextResponse.redirect(`${appUrl}/supplier-portal/upgrade?payment=failed`)

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) return NextResponse.redirect(`${appUrl}/supplier-portal/upgrade?payment=failed`)

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, plan_category, subscription_status')
      .eq('paystack_reference', ref)
      .single()

    if (!account) return NextResponse.redirect(`${appUrl}/supplier-portal/upgrade?payment=failed`)

    // Already activated — idempotent
    if (account.subscription_status === 'active') {
      return NextResponse.redirect(`${appUrl}/supplier-portal/quoting/settings?upgraded=1`)
    }

    // Verify with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const paystackData = await paystackRes.json()

    if (!paystackRes.ok || paystackData.data?.status !== 'success') {
      return NextResponse.redirect(`${appUrl}/supplier-portal/upgrade?payment=failed`)
    }

    const planCategory = account.plan_category ?? paystackData.data?.metadata?.plan_category ?? 'electrician'

    await supabaseAdmin
      .from('supplier_portal_accounts')
      .update({
        plan:                'quoting',
        plan_category:       planCategory,
        subscription_status: 'active',
        paystack_reference:  null,
      })
      .eq('id', account.id)

    // Create default settings record on first upgrade
    await supabaseAdmin
      .from('elec_settings')
      .upsert({ portal_account_id: account.id }, { onConflict: 'portal_account_id', ignoreDuplicates: true })

    return NextResponse.redirect(`${appUrl}/supplier-portal/quoting/settings?upgraded=1`)
  } catch (e) {
    return apiError(e)
  }
}
