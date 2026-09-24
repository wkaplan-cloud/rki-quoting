import { supabaseAdmin } from '@/lib/supabase/admin'
import { todaySA } from '@/lib/dates'
import { addDays, addMonths, contractYear, periodMonths, planSummary } from '@/lib/contract-format'
import type { ElecServiceContract, ElecContractInvoice } from '@/lib/elec-types'

/**
 * Service contracts — server side. Service-role tables (RLS has no policies),
 * so every query filters by portal_account_id itself.
 */

export const CONTRACT_SELECT = '*, client:elec_clients(id, client_name, email)'

/** The active plan for a client, if they have one. */
export async function activeContractForClient(accountId: string, clientId: string | null): Promise<ElecServiceContract | null> {
  if (!clientId) return null
  const { data, error } = await supabaseAdmin
    .from('elec_service_contracts')
    .select(CONTRACT_SELECT)
    .eq('portal_account_id', accountId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data as ElecServiceContract | null
}

/** The handover pack's "service plan" line for a project's client. */
export async function activeServicePlan(accountId: string, quoteId: string): Promise<{ name: string; summary: string } | null> {
  const { data: quote } = await supabaseAdmin
    .from('elec_quotes').select('client_id').eq('id', quoteId).eq('portal_account_id', accountId).maybeSingle()
  const contract = await activeContractForClient(accountId, quote?.client_id ?? null)
  return contract ? { name: contract.name, summary: planSummary(contract) } : null
}

/** Covered visits used in the current contract year. */
export async function visitsUsed(contract: ElecServiceContract): Promise<number> {
  const year = contractYear(contract)
  const { count } = await supabaseAdmin
    .from('elec_job_cards')
    .select('id', { count: 'exact', head: true })
    .eq('service_contract_id', contract.id)
    .eq('contract_coverage', 'covered')
    .neq('status', 'cancelled')
    .gte('created_at', `${year.start}T00:00:00+02:00`)
    .lt('created_at', `${year.end}T00:00:00+02:00`)
  return count ?? 0
}

/**
 * Where a new job card for this client stands: under a plan and covered, under
 * a plan but chargeable (wrong job type, or the year's visits are used up), or
 * not under a plan at all.
 */
export async function coverageForNewJobCard(accountId: string, clientId: string | null, jobType: string):
  Promise<{ service_contract_id: string; contract_coverage: 'covered' | 'billable' } | null> {
  const contract = await activeContractForClient(accountId, clientId)
  if (!contract) return null
  const typeCovered = contract.covered_job_types.includes(jobType)
  const withinVisits = contract.included_visits == null || (await visitsUsed(contract)) < contract.included_visits
  return { service_contract_id: contract.id, contract_coverage: typeCovered && withinVisits ? 'covered' : 'billable' }
}

/** Next support invoice number for an account, e.g. HAV-SUP-2026-004. */
export async function nextContractInvoiceNumber(accountId: string): Promise<string> {
  const [{ data: settings }, { data: account }, { count }] = await Promise.all([
    supabaseAdmin.from('elec_settings').select('company_code, contract_invoice_prefix').eq('portal_account_id', accountId).maybeSingle(),
    supabaseAdmin.from('supplier_portal_accounts').select('company_name').eq('id', accountId).maybeSingle(),
    supabaseAdmin.from('elec_contract_invoices').select('id', { count: 'exact', head: true }).eq('portal_account_id', accountId),
  ])
  const autoCode = (account?.company_name ?? '').split(/\s+/).map((w: string) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 5)
  const code = (settings?.company_code ?? '').trim() || autoCode
  const prefix = settings?.contract_invoice_prefix || 'SUP'
  const num = String((count ?? 0) + 1).padStart(3, '0')
  const year = todaySA().slice(0, 4)
  return code ? `${code}-${prefix}-${year}-${num}` : `${prefix}-${year}-${num}`
}

/**
 * Raises the invoice for the contract's next billing period and moves
 * next_invoice_date on. Safe to call twice for the same period: the unique
 * (contract_id, period_start) key turns the second call into a no-op.
 */
export async function raiseNextInvoice(contract: ElecServiceContract): Promise<ElecContractInvoice | null> {
  if (!contract.next_invoice_date) return null
  const periodStart = contract.next_invoice_date
  const periodEnd = addDays(addMonths(periodStart, periodMonths(contract.billing_period)), -1)

  const [{ data: settings }, { data: client }] = await Promise.all([
    supabaseAdmin.from('elec_settings').select('default_vat_rate').eq('portal_account_id', contract.portal_account_id).maybeSingle(),
    supabaseAdmin.from('elec_clients').select('payment_terms_days').eq('id', contract.client_id).maybeSingle(),
  ])
  const today = todaySA()

  const { data: invoice, error } = await supabaseAdmin
    .from('elec_contract_invoices')
    .insert({
      contract_id: contract.id,
      portal_account_id: contract.portal_account_id,
      invoice_number: await nextContractInvoiceNumber(contract.portal_account_id),
      invoice_date: today,
      due_date: addDays(today, client?.payment_terms_days ?? 7),
      period_start: periodStart,
      period_end: periodEnd,
      amount: contract.fee,
      vat_rate: settings?.default_vat_rate ?? 15,
    })
    .select()
    .single()

  const alreadyRaised = error?.code === '23505'
  if (error && !alreadyRaised) throw new Error(error.message)

  await supabaseAdmin.from('elec_service_contracts')
    .update({ next_invoice_date: addDays(periodEnd, 1), updated_at: new Date().toISOString() })
    .eq('id', contract.id)

  return alreadyRaised ? null : (invoice as ElecContractInvoice)
}

/**
 * Rolls a contract past its renewal date: another year if it auto-renews,
 * otherwise it ends and stops invoicing.
 */
export async function rollRenewal(contract: ElecServiceContract): Promise<'renewed' | 'ended'> {
  if (contract.auto_renew) {
    let renewal = contract.renewal_date
    const today = todaySA()
    while (renewal <= today) renewal = addMonths(renewal, 12)
    await supabaseAdmin.from('elec_service_contracts')
      .update({ renewal_date: renewal, updated_at: new Date().toISOString() }).eq('id', contract.id)
    return 'renewed'
  }
  await supabaseAdmin.from('elec_service_contracts')
    .update({ status: 'ended', next_invoice_date: null, updated_at: new Date().toISOString() }).eq('id', contract.id)
  return 'ended'
}
