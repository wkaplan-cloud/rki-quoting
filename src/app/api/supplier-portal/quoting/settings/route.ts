import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const body = await req.json() as Record<string, unknown>

    const payload: Record<string, unknown> = {
      portal_account_id:              account.id,
      updated_at:                     new Date().toISOString(),
    }

    if (typeof body.default_vat_rate               === 'number') payload.default_vat_rate               = body.default_vat_rate
    if (typeof body.default_retention_percentage   === 'number') payload.default_retention_percentage   = body.default_retention_percentage
    if (typeof body.default_payment_terms_days     === 'number') payload.default_payment_terms_days     = body.default_payment_terms_days
    if (typeof body.default_defects_liability_days === 'number') payload.default_defects_liability_days = body.default_defects_liability_days
    if (typeof body.quote_prefix                   === 'string') payload.quote_prefix                   = body.quote_prefix
    if (typeof body.claim_prefix                   === 'string') payload.claim_prefix                   = body.claim_prefix
    if (typeof body.vo_prefix                      === 'string') payload.vo_prefix                      = body.vo_prefix
    if (typeof body.coc_prefix                     === 'string') payload.coc_prefix                     = body.coc_prefix
    if (typeof body.email_footer_text              === 'string' || body.email_footer_text === null) payload.email_footer_text      = body.email_footer_text
    if (typeof body.company_code                   === 'string' || body.company_code === null)      payload.company_code           = body.company_code
    if (typeof body.quote_send_bcc_admins          === 'boolean') payload.quote_send_bcc_admins = body.quote_send_bcc_admins

    const { error } = await supabaseAdmin
      .from('elec_settings')
      .upsert(payload, { onConflict: 'portal_account_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
