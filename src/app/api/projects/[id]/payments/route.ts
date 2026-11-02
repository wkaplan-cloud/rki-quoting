import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { todaySA } from '@/lib/dates'
import { applyStageUpdate } from '@/lib/stages'
import { statementsEnabled, PAYMENT_METHOD_LABELS } from '@/lib/statement'
import { apiError } from '@/lib/api-error'
import type { PaymentMethod, ProjectPayment, ProjectStatus } from '@/lib/types'

const PAYMENT_COLUMNS = 'id, project_id, amount, paid_on, method, reference, note, created_at'

interface ProjectRow {
  id: string
  org_id: string
  status: ProjectStatus
  sage_invoice_id: string | null
}

/**
 * Shared gate for every method: signed in, switch on, project visible through
 * RLS, and not linked to a Sage invoice (Sage owns those payments).
 */
async function resolveProject(projectId: string): Promise<
  { ok: true; supabase: SupabaseClient; project: ProjectRow; userId: string } | { ok: false; res: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  if (!(await statementsEnabled(supabase))) {
    return { ok: false, res: NextResponse.json({ error: 'Payments are not switched on for this studio' }, { status: 403 }) }
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, org_id, status, sage_invoice_id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  return { ok: true, supabase, project: project as ProjectRow, userId: user.id }
}

/** Payments, the paid total the trigger keeps on the project, and stage/status after any sync. */
async function respond(supabase: SupabaseClient, project: ProjectRow) {
  const [{ data: payments, error }, { data: fresh }, { data: stages }] = await Promise.all([
    supabase.from('project_payments').select(PAYMENT_COLUMNS).eq('project_id', project.id).order('paid_on').order('created_at'),
    supabase.from('projects').select('deposit_amount_received').eq('id', project.id).single(),
    supabase.from('project_stages').select('deposit_received, client_approved').eq('project_id', project.id).maybeSingle(),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const paid = fresh?.deposit_amount_received ?? null

  // Keep the Deposit Received stage in step with money received — the same rule
  // the old single deposit box follows.
  let newStatus = project.status
  let stageUpdate: Record<string, boolean | string | null> | null = null
  if (paid != null && !stages?.deposit_received) {
    const now = new Date().toISOString()
    stageUpdate = { deposit_received: true, deposit_received_at: now }
    if (!stages?.client_approved) Object.assign(stageUpdate, { client_approved: true, client_approved_at: now })
  } else if (paid == null && stages?.deposit_received) {
    stageUpdate = { deposit_received: false, deposit_received_at: null }
  }
  let updatedStages = null
  if (stageUpdate) {
    const result = await applyStageUpdate(project.id, project.status, stageUpdate)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
    newStatus = result.newStatus
    updatedStages = result.stages
  }

  return NextResponse.json({ payments: (payments ?? []) as ProjectPayment[], paid, stages: updatedStages, newStatus })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await resolveProject(id)
    if (!r.ok) return r.res
    if (r.project.sage_invoice_id) {
      return NextResponse.json({ error: 'This project is linked to Sage — payments come from Sage' }, { status: 409 })
    }

    const body = await req.json() as { amount?: unknown; paid_on?: unknown; method?: unknown; reference?: unknown; note?: unknown }

    const amount = Math.round(Number(body.amount) * 100) / 100
    if (!Number.isFinite(amount) || amount <= 0 || amount >= 1e10) {
      return NextResponse.json({ error: 'Enter an amount greater than zero' }, { status: 400 })
    }
    const paidOn = typeof body.paid_on === 'string' && body.paid_on ? body.paid_on : todaySA()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || Number.isNaN(Date.parse(paidOn))) {
      return NextResponse.json({ error: 'Invalid payment date' }, { status: 400 })
    }
    const method = typeof body.method === 'string' && body.method in PAYMENT_METHOD_LABELS ? body.method as PaymentMethod : null
    const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null)

    const { error } = await r.supabase.from('project_payments').insert({
      org_id: r.project.org_id,
      project_id: id,
      amount,
      paid_on: paidOn,
      method,
      reference: text(body.reference),
      note: text(body.note),
      created_by: r.userId,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return respond(r.supabase, r.project)
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const paymentId = req.nextUrl.searchParams.get('paymentId')
    if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 })

    const r = await resolveProject(id)
    if (!r.ok) return r.res
    if (r.project.sage_invoice_id) {
      return NextResponse.json({ error: 'This project is linked to Sage — payments come from Sage' }, { status: 409 })
    }

    const { data: deleted, error } = await r.supabase
      .from('project_payments').delete().eq('id', paymentId).eq('project_id', id).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!deleted?.length) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    return respond(r.supabase, r.project)
  } catch (e) {
    return apiError(e)
  }
}
