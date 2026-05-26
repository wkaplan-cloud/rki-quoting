import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: claim } = await supabaseAdmin
      .from('elec_claims')
      .select('id, claim_number, claim_date, period_month, claim_type, status, total_claimed, total_certified, total_invoiced, total_paid, sent_to_name, notes, portal_account_id, quote_id, line_items:elec_claim_line_items(*)')
      .eq('share_token', token)
      .single()

    if (!claim) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [{ data: account }, { data: quoteRaw }, { data: quoteItems }] = await Promise.all([
      supabaseAdmin
        .from('supplier_portal_accounts')
        .select('company_name, email, logo_url, phone')
        .eq('id', claim.portal_account_id)
        .single(),
      supabaseAdmin
        .from('elec_quotes')
        .select('quote_number, project_name, project_address, client:elec_clients(client_name, company)')
        .eq('id', claim.quote_id)
        .single(),
      supabaseAdmin
        .from('elec_quote_line_items')
        .select('id, description, section_id, quoted_quantity, quoted_unit_rate, sort_order')
        .eq('quote_id', claim.quote_id)
        .order('sort_order'),
    ])

    const client = Array.isArray(quoteRaw?.client) ? quoteRaw.client[0] : quoteRaw?.client

    return NextResponse.json({
      claim,
      quote: quoteRaw ? { quote_number: quoteRaw.quote_number, project_name: quoteRaw.project_name, project_address: quoteRaw.project_address } : null,
      client: client ?? null,
      quoteItems: quoteItems ?? [],
      company: account ?? null,
    })
  } catch (e) {
    return apiError(e)
  }
}
