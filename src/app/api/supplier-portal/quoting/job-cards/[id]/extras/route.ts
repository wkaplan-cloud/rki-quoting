import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolveExtrasContext, extrasEnabled } from '@/lib/job-card-extras'

// GET /api/supplier-portal/quoting/job-cards/[id]/extras
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveExtrasContext(user.id, id)
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status })

    const { data, error } = await supabaseAdmin
      .from('elec_job_card_extras')
      .select('*, created_job_card:elec_job_cards!elec_job_card_extras_created_job_card_id_fkey(id,job_number,status)')
      .eq('job_card_id', id)
      .order('created_at')
    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (e) { return apiError(e) }
}

// POST /api/supplier-portal/quoting/job-cards/[id]/extras
// Logs one extra-work item. No pricing — the office prices it on the quote.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveExtrasContext(user.id, id)
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    const { ctx } = resolved

    if (!extrasEnabled(ctx.settings)) {
      return NextResponse.json({ error: 'Extra work is switched off for this account' }, { status: 403 })
    }

    const body = await req.json() as { description?: string; unit?: string | null; qty?: number; notes?: string | null }
    if (!body.description?.trim()) return NextResponse.json({ error: 'Description required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('elec_job_card_extras')
      .insert({
        job_card_id:         id,
        portal_account_id:   ctx.accountId,
        description:         body.description.trim(),
        unit:                body.unit?.trim() || null,
        qty:                 body.qty && body.qty > 0 ? body.qty : 1,
        notes:               body.notes?.trim() || null,
        created_by_staff_id: ctx.staffId,
        created_by_name:     ctx.staffName,
      })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (e) { return apiError(e) }
}
