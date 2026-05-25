import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quoteId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    // Verify quote ownership
    const { data: quote } = await supabaseAdmin
      .from('elec_quotes')
      .select('id')
      .eq('id', quoteId)
      .eq('portal_account_id', account.id)
      .single()
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const body = await req.json() as {
      period_month: string        // YYYY-MM-01
      claim_type: 'invoice' | 'proforma' | 'retention'
      claim_date: string
      sent_to_name?: string | null
      sent_to_email?: string | null
      notes?: string | null
      submit?: boolean
      sent_at?: string | null
      line_items: { quote_line_item_id: string; percentage_claimed: number; amount_claimed: number }[]
      retention_amount?: number
      fixed_amount?: number
      variation_order_id?: string | null
    }

    // Auto-number: count all claims for this account
    const { data: settings } = await supabaseAdmin
      .from('elec_settings')
      .select('claim_prefix')
      .eq('portal_account_id', account.id)
      .maybeSingle()

    const prefix = settings?.claim_prefix ?? 'CLM'
    const year = new Date().getFullYear()

    const { count } = await supabaseAdmin
      .from('elec_claims')
      .select('id', { count: 'exact', head: true })
      .eq('portal_account_id', account.id)

    const num = String((count ?? 0) + 1).padStart(3, '0')
    const claimNumber = `${prefix}-${year}-${num}`

    const totalClaimed = body.claim_type === 'retention'
      ? (body.retention_amount ?? 0)
      : body.line_items.length > 0
        ? body.line_items.reduce((s, li) => s + li.amount_claimed, 0)
        : (body.fixed_amount ?? 0)

    const { data: claim, error: claimErr } = await supabaseAdmin
      .from('elec_claims')
      .insert({
        quote_id:           quoteId,
        portal_account_id:  account.id,
        claim_number:       claimNumber,
        claim_date:         body.claim_date,
        period_month:       body.period_month,
        claim_type:         body.claim_type,
        status:             body.submit ? 'submitted' : 'draft',
        total_claimed:      totalClaimed,
        sent_to_name:       body.sent_to_name ?? null,
        sent_to_email:      body.sent_to_email ?? null,
        sent_at:            body.sent_at ?? null,
        notes:              body.notes ?? null,
        variation_order_id: body.variation_order_id ?? null,
      })
      .select()
      .single()

    if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 })

    if (body.line_items.length > 0) {
      const { error: liErr } = await supabaseAdmin
        .from('elec_claim_line_items')
        .insert(body.line_items.map(li => ({
          claim_id:             claim.id,
          quote_line_item_id:   li.quote_line_item_id,
          percentage_claimed:   li.percentage_claimed,
          amount_claimed:       li.amount_claimed,
        })))
      if (liErr) return NextResponse.json({ error: liErr.message }, { status: 500 })
    }

    return NextResponse.json({ id: claim.id, claim_number: claimNumber })
  } catch (e) {
    return apiError(e)
  }
}
