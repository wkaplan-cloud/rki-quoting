import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolveCreatorName } from '@/lib/resolve-creator'
import { resolveExtrasContext, extrasEnabled, notifyExtraWorkSubmitted } from '@/lib/job-card-extras'

// POST /api/supplier-portal/quoting/job-cards/[id]/extras/submit
//
// Turns every unsent extra-work item into a NEW JOB CARD — not a project quote.
// Extra work on a job card is job-card work: the office prices it on the new
// card's job sheet, sends that card for the client to approve, and the work is
// signed off on it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveExtrasContext(user.id, id)
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    const { ctx } = resolved
    const { card } = ctx

    if (!extrasEnabled(ctx.settings)) {
      return NextResponse.json({ error: 'Extra work is switched off for this account' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({})) as { note?: string }
    const note = body.note?.trim() || null

    const { data: extras } = await supabaseAdmin
      .from('elec_job_card_extras')
      .select('*')
      .eq('job_card_id', id)
      .is('created_job_card_id', null)
      .is('quote_id', null)
      .order('created_at')

    if (!extras || extras.length === 0) {
      return NextResponse.json({ error: 'Nothing to send — add at least one item first' }, { status: 400 })
    }

    const createdByName = ctx.staffName ?? await resolveCreatorName(user.id)

    const descriptionParts = [
      `Extra work the client asked for on job card ${card.job_number} — ${card.title}.`,
      ...extras.map(x => `• ${x.description}${x.notes ? ` (${x.notes})` : ''} — ${x.qty ?? 1} ${x.unit ?? 'nr'}`),
    ]
    if (note) descriptionParts.push(note)

    const { count } = await supabaseAdmin
      .from('elec_job_cards')
      .select('id', { count: 'exact', head: true })
      .eq('portal_account_id', ctx.accountId)

    const { data: newCard, error: cardErr } = await supabaseAdmin
      .from('elec_job_cards')
      .insert({
        portal_account_id:       ctx.accountId,
        client_id:               card.client_id,
        job_number:              `JC-${String((count ?? 0) + 1).padStart(4, '0')}`,
        job_type:                'once_off',
        status:                  'pending',
        title:                   `Extra work — ${card.title}`,
        location:                card.location,
        work_description:        descriptionParts.join('\n'),
        extras_from_job_card_id: card.id,
        created_by_name:         createdByName,
        // Unassigned on purpose — who does it and when is the office's call.
      })
      .select('id, job_number')
      .single()
    if (cardErr) throw cardErr

    // Items land on the job sheet with no price. The office rates them there.
    const { error: matErr } = await supabaseAdmin
      .from('elec_job_card_materials')
      .insert(extras.map(x => ({
        job_card_id: newCard.id,
        description: x.notes ? `${x.description} (${x.notes})` : x.description,
        qty:         x.qty ?? 1,
        unit_price:  null,
      })))
    if (matErr) {
      await supabaseAdmin.from('elec_job_cards').delete().eq('id', newCard.id)
      throw matErr
    }

    const { error: stampErr } = await supabaseAdmin
      .from('elec_job_card_extras')
      .update({ created_job_card_id: newCard.id, submitted_at: new Date().toISOString() })
      .in('id', extras.map(x => x.id))
    if (stampErr) throw stampErr

    void notifyExtraWorkSubmitted({
      accountId: ctx.accountId,
      sourceCard: { id: card.id, job_number: card.job_number, title: card.title },
      newCard,
      items: extras.map(x => ({ description: x.description, qty: x.qty ?? 1, unit: x.unit, notes: x.notes })),
      reportedBy: createdByName,
      staffId: ctx.staffId,
      note,
    }).catch(e => console.error('[extras/submit] notify failed', e))

    return NextResponse.json(
      { job_card_id: newCard.id, job_number: newCard.job_number, count: extras.length },
      { status: 201 },
    )
  } catch (e) { return apiError(e) }
}
