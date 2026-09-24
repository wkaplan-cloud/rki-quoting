import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: quoteRaw } = await supabaseAdmin
      .from('elec_quotes')
      .select('*, client:elec_clients(id, client_name, company, email, contact_number, address)')
      .eq('share_token', token)
      .single()

    if (!quoteRaw) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Columns are named, never '*': this goes to the client's browser, and
    // cost prices and markups must not. The optional-line flags are asked for
    // separately so a database without them still serves the quote.
    const lineItems = (cols: string) => supabaseAdmin
      .from('elec_quote_line_items')
      .select(cols)
      .eq('quote_id', quoteRaw.id)
      .order('variation_order_id', { nullsFirst: true })
      .order('sort_order')
      .order('created_at')
    const PUBLIC_ITEM_COLS = 'id, section_id, description, unit, quoted_quantity, quoted_unit_rate, labour_rate, is_variation, sort_order'

    const [{ data: sections }, itemsWithOptions, { data: account }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from('elec_quote_sections')
        .select('id, title, sort_order')
        .eq('quote_id', quoteRaw.id)
        .order('sort_order'),
      lineItems(`${PUBLIC_ITEM_COLS}, is_optional, optional_selected`),
      supabaseAdmin
        .from('supplier_portal_accounts')
        .select('company_name, email, logo_url, phone')
        .eq('id', quoteRaw.portal_account_id)
        .single(),
      supabaseAdmin
        .from('elec_settings')
        .select('vat_registration_number, company_registration_number, cidb_registration_number, bank_name, bank_account_number, bank_branch_code, bank_account_type')
        .eq('portal_account_id', quoteRaw.portal_account_id)
        .maybeSingle(),
    ])

    const items = itemsWithOptions.error
      ? (await lineItems(PUBLIC_ITEM_COLS)).data
      : itemsWithOptions.data

    const client = Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client

    return NextResponse.json({
      quote: {
        id: quoteRaw.id,
        quote_number: quoteRaw.quote_number,
        project_name: quoteRaw.project_name,
        project_address: quoteRaw.project_address,
        project_type: quoteRaw.project_type,
        contract_type: quoteRaw.contract_type,
        status: quoteRaw.status,
        vat_rate: quoteRaw.vat_rate,
        retention_percentage: quoteRaw.retention_percentage,
        payment_terms_days: quoteRaw.payment_terms_days,
        notes: quoteRaw.notes,
        quoted_date: quoteRaw.quoted_date,
        expected_completion_date: quoteRaw.expected_completion_date,
        approved_date: quoteRaw.approved_date,
        drawing_reference: quoteRaw.drawing_reference ?? null,
        deposit_percentage: quoteRaw.deposit_percentage ?? 0,
      },
      client: client ?? null,
      sections: sections ?? [],
      items: items ?? [],
      company: account ?? null,
      settings: settings ?? null,
    })
  } catch (e) {
    return apiError(e)
  }
}
