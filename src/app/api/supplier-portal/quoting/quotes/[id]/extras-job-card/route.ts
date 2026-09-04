import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { createJobCardFromExtrasQuote } from '@/lib/job-card-extras'

// POST /api/supplier-portal/quoting/quotes/[id]/extras-job-card
//
// The office-side twin of the client approval link: when an extra-work quote is
// marked approved from the quote editor, this raises the same job card. Safe to
// call on any quote and safe to call twice — it no-ops unless the quote came
// out of a job card and doesn't already have one.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const { data: quote } = await supabaseAdmin
      .from('elec_quotes')
      .select('id, portal_account_id, quote_number, project_name')
      .eq('id', id)
      .eq('portal_account_id', account.id)
      .maybeSingle()
    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const card = await createJobCardFromExtrasQuote(quote.id)
    if (!card) return NextResponse.json({ created: false })

    await supabaseAdmin.from('elec_notifications').insert({
      portal_account_id: account.id,
      type: 'extra_work_approved',
      title: `Extra work approved — ${quote.quote_number}`,
      body: `Job card ${card.job_number} created for ${quote.project_name}. It still needs scheduling.`,
      metadata: { job_card_id: card.id, quote_id: quote.id },
    })

    return NextResponse.json({ created: true, job_card_id: card.id, job_number: card.job_number })
  } catch (e) { return apiError(e) }
}
