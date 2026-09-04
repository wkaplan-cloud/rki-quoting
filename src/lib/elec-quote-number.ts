import { supabaseAdmin } from './supabase/admin'

export type QuoteNumberSettings = {
  company_code?: string | null
  quote_prefix?: string | null
} | null

/**
 * Next quote number for an account, e.g. NEX-EQ-2026-004.
 *
 * Takes the already-fetched elec_settings row so callers that need the other
 * quote defaults don't pay for a second round trip.
 */
export async function nextQuoteNumber(
  accountId: string,
  companyName: string | null,
  settings: QuoteNumberSettings,
): Promise<string> {
  const autoCode = (companyName ?? '')
    .split(/\s+/).map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 5)
  const companyCode = (settings?.company_code ?? '').trim() || autoCode
  const prefix = settings?.quote_prefix ?? 'QU'
  const year = new Date().getFullYear()

  const { count } = await supabaseAdmin
    .from('elec_quotes')
    .select('id', { count: 'exact', head: true })
    .eq('portal_account_id', accountId)

  const num = String((count ?? 0) + 1).padStart(3, '0')
  return companyCode ? `${companyCode}-${prefix}-${year}-${num}` : `${prefix}-${year}-${num}`
}
