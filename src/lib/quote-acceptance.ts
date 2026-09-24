import { supabaseAdmin } from '@/lib/supabase/admin'
import { nextClaimNumber } from '@/lib/elec-claim-number'
import { todaySA } from '@/lib/dates'
import type { ElecClaim, ElecClaimLineItem } from '@/lib/elec-types'

/**
 * What happens to a quote's contents the moment it is accepted, whether by
 * the client on the approval link or by the office marking it approved.
 *
 * 1. Optional lines: the ones taken become ordinary lines, the rest are
 *    deleted — claims, as-built and VOs never have to know optionals existed.
 * 2. Deposit: if the quote asks for one, it is raised as a DRAFT claim at the
 *    deposit % on every line. Being an ordinary claim, the next progress
 *    claim carries on from that % automatically; being a draft, the office
 *    reviews it before it goes to the client or to Sage.
 *
 * Both steps tolerate a database that predates the installer migration: the
 * columns they read simply aren't there, and the step is skipped.
 */

const MISSING_COLUMN = '42703'
const round2 = (n: number) => Math.round(n * 100) / 100

export interface AcceptanceResult {
  removedOptionalIds: string[]
  keptOptionalIds: string[]
  depositClaim: (ElecClaim & { line_items: ElecClaimLineItem[] }) | null
}

export async function finaliseAcceptedQuote(opts: {
  quoteId: string
  portalAccountId: string
  /** The optional lines the client ticked. Omit to use what is saved on the lines. */
  selectedOptionalIds?: string[]
}): Promise<AcceptanceResult> {
  const { quoteId, portalAccountId } = opts
  const result: AcceptanceResult = { removedOptionalIds: [], keptOptionalIds: [], depositClaim: null }

  // ── 1. Optional lines ──────────────────────────────────────────────────────
  const { data: optionalRows, error: optErr } = await supabaseAdmin
    .from('elec_quote_line_items')
    .select('id, optional_selected')
    .eq('quote_id', quoteId)
    .eq('is_optional', true)

  if (!optErr && optionalRows && optionalRows.length > 0) {
    const chosen = opts.selectedOptionalIds
      ? new Set(opts.selectedOptionalIds)
      : new Set(optionalRows.filter(r => r.optional_selected).map(r => r.id as string))
    result.keptOptionalIds = optionalRows.filter(r => chosen.has(r.id)).map(r => r.id as string)
    result.removedOptionalIds = optionalRows.filter(r => !chosen.has(r.id)).map(r => r.id as string)

    if (result.keptOptionalIds.length > 0) {
      const { error } = await supabaseAdmin.from('elec_quote_line_items')
        .update({ is_optional: false, optional_selected: true })
        .in('id', result.keptOptionalIds).eq('quote_id', quoteId)
      if (error) throw new Error(`Could not keep the chosen optional lines: ${error.message}`)
    }
    if (result.removedOptionalIds.length > 0) {
      const { error } = await supabaseAdmin.from('elec_quote_line_items')
        .delete()
        .in('id', result.removedOptionalIds).eq('quote_id', quoteId)
      if (error) throw new Error(`Could not remove the optional lines that were not taken: ${error.message}`)
    }
  } else if (optErr && optErr.code !== MISSING_COLUMN) {
    throw new Error(optErr.message)
  }

  // ── 2. Deposit ─────────────────────────────────────────────────────────────
  const { data: quote, error: qErr } = await supabaseAdmin
    .from('elec_quotes')
    .select('id, deposit_percentage, client:elec_clients(client_name, email, qs_name, qs_email)')
    .eq('id', quoteId)
    .eq('portal_account_id', portalAccountId)
    .maybeSingle()
  if (qErr) {
    if (qErr.code === MISSING_COLUMN) return result
    throw new Error(qErr.message)
  }
  const pct = Number(quote?.deposit_percentage ?? 0)
  if (!quote || !(pct > 0)) return result

  // Only ever one deposit, and never once claiming has started.
  const { count: existingClaims } = await supabaseAdmin
    .from('elec_claims').select('id', { count: 'exact', head: true }).eq('quote_id', quoteId)
  if ((existingClaims ?? 0) > 0) return result

  const { data: lines } = await supabaseAdmin
    .from('elec_quote_line_items')
    .select('id, quoted_quantity, quoted_unit_rate, labour_rate')
    .eq('quote_id', quoteId)
    .eq('is_variation', false)
  const claimLines = (lines ?? []).map(l => {
    const contractVal = (l.quoted_quantity ?? 0) * ((l.quoted_unit_rate ?? 0) + (l.labour_rate ?? 0))
    return { quote_line_item_id: l.id as string, percentage_claimed: pct, amount_claimed: round2(contractVal * pct / 100) }
  }).filter(l => l.amount_claimed > 0)
  if (claimLines.length === 0) return result

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts').select('company_name').eq('id', portalAccountId).maybeSingle()
  const client = Array.isArray(quote.client) ? quote.client[0] : quote.client
  const today = todaySA()
  const claimNumber = await nextClaimNumber(portalAccountId, account?.company_name ?? null)

  const { data: claim, error: claimErr } = await supabaseAdmin
    .from('elec_claims')
    .insert({
      quote_id: quoteId,
      portal_account_id: portalAccountId,
      claim_number: claimNumber,
      claim_date: today,
      period_month: `${today.slice(0, 7)}-01`,
      claim_type: 'invoice',
      status: 'draft',
      total_claimed: round2(claimLines.reduce((s, l) => s + l.amount_claimed, 0)),
      sent_to_name: client?.client_name ?? null,
      sent_to_email: client?.email ?? null,
      qs_name: client?.qs_name ?? null,
      qs_email: client?.qs_email ?? null,
      notes: `Deposit — ${pct}% on acceptance`,
    })
    .select()
    .single()
  if (claimErr) throw new Error(`Could not raise the deposit claim: ${claimErr.message}`)

  const { data: savedLines, error: liErr } = await supabaseAdmin
    .from('elec_claim_line_items')
    .insert(claimLines.map(l => ({ claim_id: claim.id, ...l })))
    .select()
  if (liErr) {
    await supabaseAdmin.from('elec_claims').delete().eq('id', claim.id)
    throw new Error(`Could not raise the deposit claim: ${liErr.message}`)
  }

  result.depositClaim = { ...(claim as ElecClaim), line_items: (savedLines ?? []) as ElecClaimLineItem[] }
  return result
}
