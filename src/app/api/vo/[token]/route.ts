import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: vo } = await supabaseAdmin
      .from('elec_variation_orders')
      .select('id, vo_number, description, value, notes, requested_by, status, rejection_notes, approved_date, quote:elec_quotes(id, project_name, quote_number, vat_rate, portal_account_id)')
      .eq('share_token', token)
      .single()

    if (!vo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const quote = Array.isArray(vo.quote) ? vo.quote[0] : vo.quote

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('company_name, email, logo_url')
      .eq('id', quote.portal_account_id)
      .maybeSingle()

    return NextResponse.json({
      vo: {
        id: vo.id,
        vo_number: vo.vo_number,
        description: vo.description,
        value: vo.value,
        notes: vo.notes,
        requested_by: vo.requested_by,
        status: vo.status,
        rejection_notes: vo.rejection_notes,
        approved_date: vo.approved_date,
        vat_rate: quote.vat_rate ?? 15,
      },
      project: {
        project_name: quote.project_name,
        quote_number: quote.quote_number,
      },
      company: {
        company_name: account?.company_name ?? null,
        email: account?.email ?? null,
        logo_url: account?.logo_url ?? null,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
