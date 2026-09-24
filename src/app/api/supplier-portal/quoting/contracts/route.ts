import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { CONTRACT_SELECT } from '@/lib/service-contracts'
import { contractFields } from '@/lib/contract-input'
import { contractYear } from '@/lib/contract-format'
import { todaySA } from '@/lib/dates'
import type { ElecServiceContract } from '@/lib/elec-types'

/**
 * GET  every contract, with its last-12-months money: invoiced vs the value of
 *      the covered work given (covered hours at the plan's callout rate).
 * POST a new contract.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    const [{ data: contracts, error }, { data: invoices }, { data: cards }] = await Promise.all([
      supabaseAdmin.from('elec_service_contracts').select(CONTRACT_SELECT).eq('portal_account_id', account.id).order('created_at', { ascending: false }),
      supabaseAdmin.from('elec_contract_invoices').select('contract_id, amount, status, invoice_date')
        .eq('portal_account_id', account.id).gte('invoice_date', since).neq('status', 'void'),
      supabaseAdmin.from('elec_job_cards').select('service_contract_id, contract_coverage, labour_hours, created_at, status')
        .eq('portal_account_id', account.id).not('service_contract_id', 'is', null).gte('created_at', `${since}T00:00:00+02:00`),
    ])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const today = todaySA()
    const rows = ((contracts ?? []) as ElecServiceContract[]).map(c => {
      const inv = (invoices ?? []).filter(i => i.contract_id === c.id)
      const covered = (cards ?? []).filter(j => j.service_contract_id === c.id && j.contract_coverage === 'covered' && j.status !== 'cancelled')
      const year = contractYear(c)
      const coveredHours = covered.reduce((s, j) => s + Number(j.labour_hours ?? 0), 0)
      return {
        ...c,
        stats: {
          invoiced12: inv.reduce((s, i) => s + Number(i.amount), 0),
          unpaid: inv.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.amount), 0),
          coveredVisits12: covered.length,
          coveredHours12: Math.round(coveredHours * 10) / 10,
          workValue12: c.callout_rate != null ? Math.round(coveredHours * Number(c.callout_rate) * 100) / 100 : null,
          visitsThisYear: covered.filter(j => j.created_at.slice(0, 10) >= year.start && j.created_at.slice(0, 10) < year.end).length,
          renewsInDays: Math.round((Date.parse(c.renewal_date) - Date.parse(today)) / 86400000),
        },
      }
    })
    return NextResponse.json({ contracts: rows })
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const body = await req.json() as Record<string, unknown>
    const clientId = typeof body.client_id === 'string' ? body.client_id : ''
    const { data: client } = await supabaseAdmin
      .from('elec_clients').select('id').eq('id', clientId).eq('portal_account_id', account.id).maybeSingle()
    if (!client) return NextResponse.json({ error: 'Choose a client' }, { status: 400 })

    const parsed = contractFields(body, true)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('elec_service_contracts')
      .insert({ portal_account_id: account.id, client_id: client.id, ...parsed.fields })
      .select(CONTRACT_SELECT)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contract: data })
  } catch (e) {
    return apiError(e)
  }
}
