import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { todaySA } from '@/lib/dates'
import { finaliseAcceptedQuote } from '@/lib/quote-acceptance'

/**
 * The office marking a quote approved on the client's behalf. Does what the
 * client's approval link does: settles optional lines (keeping the ones
 * ticked in the editor) and raises the deposit, then starts the project.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quoteId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data: quote } = await supabaseAdmin
      .from('elec_quotes')
      .select('id, status')
      .eq('id', quoteId)
      .eq('portal_account_id', account.id)
      .maybeSingle()
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    if (!['draft', 'quoted'].includes(quote.status)) {
      return NextResponse.json({ error: 'This quote has already been approved or closed' }, { status: 409 })
    }

    // Settle the quote before flipping its status: re-running it after a
    // failure is harmless (no optionals left, deposit already raised).
    const result = await finaliseAcceptedQuote({ quoteId, portalAccountId: account.id })

    const approvedDate = todaySA()
    const { error } = await supabaseAdmin
      .from('elec_quotes')
      .update({ status: 'in_progress', approved_date: approvedDate })
      .eq('id', quoteId)
      .eq('portal_account_id', account.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, approved_date: approvedDate, ...result })
  } catch (e) {
    return apiError(e)
  }
}
