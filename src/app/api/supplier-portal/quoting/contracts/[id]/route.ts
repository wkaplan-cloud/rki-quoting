import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { CONTRACT_SELECT } from '@/lib/service-contracts'
import { contractFields } from '@/lib/contract-input'

async function accountId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return (await resolvePortalAccount(user.id))?.id ?? null
}

/** GET the contract with its invoices and the job cards it has covered or charged. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const acct = await accountId()
    if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: contract }, { data: invoices }, { data: jobCards }] = await Promise.all([
      supabaseAdmin.from('elec_service_contracts').select(CONTRACT_SELECT).eq('id', id).eq('portal_account_id', acct).maybeSingle(),
      supabaseAdmin.from('elec_contract_invoices').select('*').eq('contract_id', id).eq('portal_account_id', acct).order('period_start', { ascending: false }),
      supabaseAdmin.from('elec_job_cards').select('id, job_number, title, job_type, status, contract_coverage, labour_hours, callout_fee, created_at')
        .eq('service_contract_id', id).eq('portal_account_id', acct).order('created_at', { ascending: false }).limit(50),
    ])
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    return NextResponse.json({ contract, invoices: invoices ?? [], jobCards: jobCards ?? [] })
  } catch (e) {
    return apiError(e)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const acct = await accountId()
    if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Record<string, unknown>
    const parsed = contractFields(body, false)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const fields = parsed.fields
    // Pausing or ending stops the invoice run; resuming picks it up from the
    // date the office gives, or today.
    if (fields.status === 'paused' || fields.status === 'ended') fields.next_invoice_date = null

    const { data, error } = await supabaseAdmin
      .from('elec_service_contracts')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id).eq('portal_account_id', acct)
      .select(CONTRACT_SELECT).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    return NextResponse.json({ contract: data })
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const acct = await accountId()
    if (!acct) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Invoices are the paper trail; a contract that has any is ended, not deleted.
    const { count } = await supabaseAdmin
      .from('elec_contract_invoices').select('id', { count: 'exact', head: true }).eq('contract_id', id).eq('portal_account_id', acct)
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'This plan has invoices — end it instead of deleting it' }, { status: 409 })

    const { error } = await supabaseAdmin.from('elec_service_contracts').delete().eq('id', id).eq('portal_account_id', acct)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
