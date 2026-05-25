import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const body = await req.json() as {
      project_name: string
      client_id?: string | null
      project_type?: string | null
    }
    if (!body.project_name?.trim()) return NextResponse.json({ error: 'Project name required' }, { status: 400 })

    // Get settings for prefix + defaults
    const { data: settings } = await supabaseAdmin
      .from('elec_settings')
      .select('quote_prefix, default_vat_rate, default_retention_percentage, default_payment_terms_days, default_defects_liability_days')
      .eq('portal_account_id', account.id)
      .maybeSingle()

    const prefix = settings?.quote_prefix ?? 'EQ'
    const year   = new Date().getFullYear()

    // Count all quotes for this account to generate next number
    const { count } = await supabaseAdmin
      .from('elec_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('portal_account_id', account.id)

    const num = String((count ?? 0) + 1).padStart(3, '0')
    const quoteNumber = `${prefix}-${year}-${num}`

    const { data: quote, error: err } = await supabaseAdmin
      .from('elec_quotes')
      .insert({
        portal_account_id:             account.id,
        client_id:                     body.client_id ?? null,
        quote_number:                  quoteNumber,
        project_name:                  body.project_name.trim(),
        project_type:                  body.project_type ?? null,
        status:                        'draft',
        vat_rate:                      settings?.default_vat_rate ?? 15,
        retention_percentage:          settings?.default_retention_percentage ?? 0,
        payment_terms_days:            settings?.default_payment_terms_days ?? 30,
        defects_liability_period_days: settings?.default_defects_liability_days ?? 90,
      })
      .select()
      .single()

    if (err) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ id: quote.id, quote_number: quoteNumber })
  } catch (e) {
    return apiError(e)
  }
}
