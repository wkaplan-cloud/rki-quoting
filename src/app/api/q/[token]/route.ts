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

    const [{ data: sections }, { data: items }, { data: account }] = await Promise.all([
      supabaseAdmin
        .from('elec_quote_sections')
        .select('id, title, sort_order')
        .eq('quote_id', quoteRaw.id)
        .order('sort_order'),
      supabaseAdmin
        .from('elec_quote_line_items')
        .select('id, section_id, description, unit, quoted_quantity, quoted_unit_rate, labour_rate, is_variation, sort_order')
        .eq('quote_id', quoteRaw.id)
        .order('sort_order'),
      supabaseAdmin
        .from('supplier_portal_accounts')
        .select('company_name, email, logo_url, phone')
        .eq('id', quoteRaw.portal_account_id)
        .single(),
    ])

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
      },
      client: client ?? null,
      sections: sections ?? [],
      items: items ?? [],
      company: account ?? null,
    })
  } catch (e) {
    return apiError(e)
  }
}
