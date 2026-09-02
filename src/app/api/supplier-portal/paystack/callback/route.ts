import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { sendEmail } from '@/lib/email'

const PLATFORM_EMAIL = process.env.CONTACT_NOTIFICATION_EMAIL ?? 'hello@quotinghub.co.za'

const PLAN_LABEL: Record<string, string> = {
  starter:      'Starter (R999/mo)',
  professional: 'Professional (R1,999/mo)',
  business:     'Business (R3,199/mo)',
  quoting:      'Business — legacy (R1,999/mo)',
  manufacturer: 'Manufacturer (R699/mo)',
}

export async function GET(req: NextRequest) {
  try {
    const ref = req.nextUrl.searchParams.get('ref') ?? req.nextUrl.searchParams.get('trxref') ?? req.nextUrl.searchParams.get('reference')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'

    if (!ref) return NextResponse.redirect(`${appUrl}/supplier-portal/upgrade?payment=failed`)

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) return NextResponse.redirect(`${appUrl}/supplier-portal/upgrade?payment=failed`)

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, email, company_name, plan, plan_category, subscription_status, paystack_subscription_code')
      .eq('paystack_reference', ref)
      .single()

    if (!account) return NextResponse.redirect(`${appUrl}/supplier-portal/upgrade?payment=failed`)

    // Verify with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const paystackData = await paystackRes.json()

    if (!paystackRes.ok || paystackData.data?.status !== 'success') {
      return NextResponse.redirect(`${appUrl}/supplier-portal/upgrade?payment=failed`)
    }

    const planId    = paystackData.data?.metadata?.plan_id ?? 'business'
    const planType  = paystackData.data?.metadata?.type as string ?? 'electrician'
    const isManufacturerUpgrade = planType === 'manufacturer' || planId === 'manufacturer'

    const resolvedPlan = isManufacturerUpgrade
      ? 'manufacturer'
      : (['starter', 'professional', 'business'].includes(planId) ? planId : 'business')

    const newSubCode: string | null = paystackData.data?.subscription?.subscription_code ?? null
    const oldPlan    = account.plan
    const oldSubCode = (account as Record<string, unknown>).paystack_subscription_code as string | null
    const isUpgrade  = account.subscription_status === 'active' && oldPlan && oldPlan !== resolvedPlan

    // Cancel old subscription if upgrading between plans
    if (isUpgrade && oldSubCode) {
      try {
        await fetch(`https://api.paystack.co/subscription/${oldSubCode}/disable`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: oldSubCode, token: paystackData.data?.authorization?.email_token }),
        })
      } catch { /* don't block */ }
    }

    if (isManufacturerUpgrade) {
      // Activate manufacturer module — keeps existing supplier_category if already set,
      // but flips it to 'manufacturer' so the manufacturing nav appears
      await supabaseAdmin
        .from('supplier_portal_accounts')
        .update({
          plan:                       'manufacturer',
          supplier_category:          'manufacturer',
          subscription_status:        'active',
          paystack_reference:         null,
          paystack_subscription_code: newSubCode,
        } as Record<string, unknown>)
        .eq('id', account.id)

      // Bootstrap mfg_settings if this is a first-time activation
      if (!isUpgrade) {
        await supabaseAdmin
          .from('mfg_settings')
          .upsert({ portal_account_id: account.id }, { onConflict: 'portal_account_id', ignoreDuplicates: true })
      }
    } else {
      // Electrician / trades activation (existing flow)
      await supabaseAdmin
        .from('supplier_portal_accounts')
        .update({
          plan:                       resolvedPlan,
          plan_category:              'electrician',
          subscription_status:        'active',
          paystack_reference:         null,
          paystack_subscription_code: newSubCode,
        } as Record<string, unknown>)
        .eq('id', account.id)

      if (!isUpgrade) {
        await supabaseAdmin
          .from('elec_settings')
          .upsert({ portal_account_id: account.id }, { onConflict: 'portal_account_id', ignoreDuplicates: true })
      }
    }

    // Notify Warren
    const companyLabel = account.company_name ?? account.email
    const subject = isUpgrade ? `Plan upgraded — ${companyLabel}` : `New subscriber — ${companyLabel}`
    const body = isUpgrade
      ? `<p><strong>${companyLabel}</strong> (${account.email}) upgraded their plan.</p>
         <table style="border-collapse:collapse;margin:16px 0">
           <tr><td style="padding:4px 12px 4px 0;color:#666">From:</td><td><strong>${PLAN_LABEL[oldPlan ?? ''] ?? oldPlan}</strong></td></tr>
           <tr><td style="padding:4px 12px 4px 0;color:#666">To:</td><td><strong>${PLAN_LABEL[resolvedPlan]}</strong></td></tr>
         </table>
         ${oldSubCode ? `<p style="color:#16a34a">✓ Old subscription (${oldSubCode}) cancelled automatically.</p>` : `<p style="color:#d97706">⚠ No old sub code — check Paystack and cancel manually.</p>`}`
      : `<p><strong>${companyLabel}</strong> (${account.email}) subscribed to <strong>${PLAN_LABEL[resolvedPlan]}</strong>.</p>
         <p>Subscription code: ${newSubCode ?? 'Not yet available — check Paystack'}</p>
         ${!isManufacturerUpgrade ? `<p>Remember to send the <a href="https://paystack.com/buy/setup--training--r2500-once-off-vmoejb">Setup & Training payment link</a> if not already paid.</p>` : ''}`

    await sendEmail({
      from: 'QuotingHub <noreply@quotinghub.co.za>',
      to:   PLATFORM_EMAIL,
      subject,
      html: `<div style="font-family:sans-serif;max-width:520px;padding:24px">${body}</div>`,
    }).catch(() => {})

    const successRedirect = isManufacturerUpgrade
      ? `${appUrl}/supplier-portal/manufacturing/dashboard?upgraded=1`
      : `${appUrl}/supplier-portal/quoting/dashboard?upgraded=1`

    return NextResponse.redirect(successRedirect)
  } catch (e) {
    return apiError(e)
  }
}
