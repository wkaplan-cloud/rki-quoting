import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolveCreatorName } from '@/lib/resolve-creator'
import { resolvePortalAccount } from '@/lib/portal-account'
import { nextQuoteNumber } from '@/lib/elec-quote-number'

/**
 * Returns the client id to attach to a new project, creating the client when the
 * name typed on the modal is not one we already hold. An email/number typed for an
 * existing client is written back onto that client (blank fields are left alone).
 */
async function resolveClientId(
  portalAccountId: string,
  body: { client_id?: string | null; client_name?: string | null; client_email?: string | null; client_phone?: string | null },
): Promise<string | null> {
  const email = body.client_email?.trim() || null
  const phone = body.client_phone?.trim() || null
  const name  = body.client_name?.trim() || null

  if (body.client_id) {
    if (email || phone) {
      await supabaseAdmin
        .from('elec_clients')
        .update({ ...(email ? { email } : {}), ...(phone ? { contact_number: phone } : {}) })
        .eq('id', body.client_id)
        .eq('portal_account_id', portalAccountId)
    }
    return body.client_id
  }

  if (!name) return null

  // A name typed but never picked from the list may still be an existing client.
  const { data: existing } = await supabaseAdmin
    .from('elec_clients')
    .select('id')
    .eq('portal_account_id', portalAccountId)
    .ilike('client_name', name.replace(/[%_]/g, m => `\\${m}`))
    .limit(1)
    .maybeSingle()

  if (existing) {
    if (email || phone) {
      await supabaseAdmin
        .from('elec_clients')
        .update({ ...(email ? { email } : {}), ...(phone ? { contact_number: phone } : {}) })
        .eq('id', existing.id)
    }
    return existing.id
  }

  const { data: created } = await supabaseAdmin
    .from('elec_clients')
    .insert({ portal_account_id: portalAccountId, client_name: name, email, contact_number: phone })
    .select('id')
    .single()

  return created?.id ?? null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const body = await req.json() as {
      project_name: string
      client_id?: string | null
      client_name?: string | null
      client_email?: string | null
      client_phone?: string | null
      project_type?: string | null
      is_quick_job?: boolean
    }
    if (!body.project_name?.trim()) return NextResponse.json({ error: 'Project name required' }, { status: 400 })

    // Client details can be captured straight on the new project, so the client
    // does not have to exist in the Clients section first.
    const clientId = await resolveClientId(account.id, body)

    // Get settings for prefix + defaults
    const { data: settings } = await supabaseAdmin
      .from('elec_settings')
      .select('company_code, quote_prefix, default_vat_rate, default_retention_percentage, default_payment_terms_days, default_defects_liability_days')
      .eq('portal_account_id', account.id)
      .maybeSingle()

    const quoteNumber = await nextQuoteNumber(account.id, account.company_name, settings)

    const createdByName = await resolveCreatorName(user.id)

    const insertRow = {
      portal_account_id:             account.id,
      client_id:                     clientId,
      quote_number:                  quoteNumber,
      project_name:                  body.project_name.trim(),
      project_type:                  body.project_type ?? null,
      is_quick_job:                  body.is_quick_job ?? false,
      status:                        'draft',
      vat_rate:                      settings?.default_vat_rate ?? 15,
      retention_percentage:          settings?.default_retention_percentage ?? 0,
      payment_terms_days:            settings?.default_payment_terms_days ?? 30,
      defects_liability_period_days: settings?.default_defects_liability_days ?? 90,
      created_by_name:               createdByName,
    }

    let { data: quote, error: err } = await supabaseAdmin
      .from('elec_quotes')
      .insert(insertRow)
      .select()
      .single()

    // Fallback while the is_quick_job migration hasn't been run yet
    if (err?.code === '42703') {
      const { is_quick_job: _skip, ...withoutQuickJob } = insertRow
      ;({ data: quote, error: err } = await supabaseAdmin
        .from('elec_quotes')
        .insert(withoutQuickJob)
        .select()
        .single())
    }

    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ id: quote.id, quote_number: quoteNumber })
  } catch (e) {
    return apiError(e)
  }
}
