import { supabaseAdmin } from './supabase/admin'

/**
 * Next claim number for an account, e.g. NEX-CLM-2026-007.
 *
 * Shared by the claims route and the deposit raised on quote acceptance, so
 * both number from the same sequence.
 */
export async function nextClaimNumber(accountId: string, companyName: string | null): Promise<string> {
  const { data: settings } = await supabaseAdmin
    .from('elec_settings')
    .select('company_code, claim_prefix')
    .eq('portal_account_id', accountId)
    .maybeSingle()

  const autoCode = (companyName ?? '').split(/\s+/).map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 5)
  const companyCode = (settings?.company_code ?? '').trim() || autoCode
  const prefix = settings?.claim_prefix ?? 'CLM'
  const year = new Date().getFullYear()

  const { count } = await supabaseAdmin
    .from('elec_claims')
    .select('id', { count: 'exact', head: true })
    .eq('portal_account_id', accountId)

  const num = String((count ?? 0) + 1).padStart(3, '0')
  return companyCode ? `${companyCode}-${prefix}-${year}-${num}` : `${prefix}-${year}-${num}`
}
