import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolveCreatorName } from '@/lib/resolve-creator'
import { nextQuoteNumber } from '@/lib/elec-quote-number'
import { resolveExtrasContext, extrasEnabled } from '@/lib/job-card-extras'

// POST /api/supplier-portal/quoting/job-cards/[id]/extras/submit
//
// Turns every unsent extra-work item on this job card into a separate DRAFT
// quote with all rates at 0, for the office to price and send to the client.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveExtrasContext(user.id, id)
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    const { ctx } = resolved
    const { card, settings } = ctx

    if (!extrasEnabled(settings)) {
      return NextResponse.json({ error: 'Extra work is switched off for this account' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({})) as { note?: string }
    const note = body.note?.trim() || null

    const { data: extras } = await supabaseAdmin
      .from('elec_job_card_extras')
      .select('*')
      .eq('job_card_id', id)
      .is('quote_id', null)
      .order('created_at')

    if (!extras || extras.length === 0) {
      return NextResponse.json({ error: 'Nothing to send — add at least one item first' }, { status: 400 })
    }

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('company_name')
      .eq('id', ctx.accountId)
      .maybeSingle()

    const quoteNumber = await nextQuoteNumber(ctx.accountId, account?.company_name ?? null, settings)
    const createdByName = ctx.staffName ?? await resolveCreatorName(user.id)

    const descriptionParts = [`Extra work requested on site during job card ${card.job_number} — ${card.title}.`]
    if (note) descriptionParts.push(note)

    const { data: quote, error: quoteErr } = await supabaseAdmin
      .from('elec_quotes')
      .insert({
        portal_account_id:             ctx.accountId,
        client_id:                     card.client_id,
        staff_id:                      card.staff_id,
        quote_number:                  quoteNumber,
        project_name:                  `Extra work — ${card.title}`,
        project_address:               card.location,
        description:                   descriptionParts.join('\n\n'),
        status:                        'draft',
        is_quick_job:                  true,
        source_job_card_id:            card.id,
        vat_rate:                      settings?.default_vat_rate ?? 15,
        retention_percentage:          settings?.default_retention_percentage ?? 0,
        payment_terms_days:            settings?.default_payment_terms_days ?? 30,
        defects_liability_period_days: settings?.default_defects_liability_days ?? 90,
        created_by_name:               createdByName,
      })
      .select('id, quote_number')
      .single()
    if (quoteErr) throw quoteErr

    const { error: itemsErr } = await supabaseAdmin
      .from('elec_quote_line_items')
      .insert(extras.map((x, idx) => ({
        quote_id:        quote.id,
        section_id:      null,
        // Rates stay at 0 — the office prices every line before this goes out.
        description:     x.notes ? `${x.description} (${x.notes})` : x.description,
        unit:            x.unit,
        item_type:       'both' as const,
        quoted_quantity: x.qty ?? 1,
        quoted_unit_rate: 0,
        sort_order:      idx,
      })))
    if (itemsErr) {
      // Don't leave an empty draft behind if the lines couldn't be written.
      await supabaseAdmin.from('elec_quotes').delete().eq('id', quote.id)
      throw itemsErr
    }

    const submittedAt = new Date().toISOString()
    const { error: stampErr } = await supabaseAdmin
      .from('elec_job_card_extras')
      .update({ quote_id: quote.id, submitted_at: submittedAt })
      .in('id', extras.map(x => x.id))
    if (stampErr) throw stampErr

    await supabaseAdmin.from('elec_notifications').insert({
      portal_account_id: ctx.accountId,
      type: 'extra_work',
      title: `Extra work — ${createdByName ?? 'Staff'}`,
      body: `${extras.length} item${extras.length === 1 ? '' : 's'} on ${card.job_number} — ${card.title}. Draft quote ${quote.quote_number} is waiting to be priced.`,
      metadata: { job_card_id: card.id, quote_id: quote.id, staff_id: ctx.staffId },
    })

    return NextResponse.json({ quote_id: quote.id, quote_number: quote.quote_number, count: extras.length }, { status: 201 })
  } catch (e) { return apiError(e) }
}
