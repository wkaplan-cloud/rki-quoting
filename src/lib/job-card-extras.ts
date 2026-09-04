import { supabaseAdmin } from './supabase/admin'
import { resolveAccountOrStaff } from './portal-account'
import { one, type Embedded } from './supabase/embed'
import type { ElecJobCardExtra } from './elec-types'

export type JobCardExtrasSettings = {
  company_code: string | null
  quote_prefix: string | null
  default_vat_rate: number | null
  default_retention_percentage: number | null
  default_payment_terms_days: number | null
  default_defects_liability_days: number | null
  job_card_extras_enabled: boolean | null
} | null

export type ExtrasCard = {
  id: string
  job_number: string
  title: string
  location: string | null
  client_id: string | null
  staff_id: string | null
  additional_staff_ids: string[] | null
}

export type ExtrasContext = {
  accountId: string
  staffId: string | null
  staffName: string | null
  card: ExtrasCard
  settings: JobCardExtrasSettings
}

export type ExtrasResolution =
  | { ok: true; ctx: ExtrasContext }
  | { ok: false; status: number; error: string }

/**
 * Shared guard for the job-card extra-work routes.
 *
 * Owners and org members reach any job card on their account; a staff member
 * only reaches a card they are assigned to. Also carries the account's quote
 * defaults so the submit route doesn't re-query them.
 */
export async function resolveExtrasContext(userId: string, jobCardId: string): Promise<ExtrasResolution> {
  const resolved = await resolveAccountOrStaff(userId)
  if (!resolved) return { ok: false, status: 403, error: 'No account' }

  const [{ data: card }, { data: settings }] = await Promise.all([
    supabaseAdmin
      .from('elec_job_cards')
      .select('id, job_number, title, location, client_id, staff_id, additional_staff_ids')
      .eq('id', jobCardId)
      .eq('portal_account_id', resolved.accountId)
      .maybeSingle(),
    supabaseAdmin
      .from('elec_settings')
      .select('company_code, quote_prefix, default_vat_rate, default_retention_percentage, default_payment_terms_days, default_defects_liability_days, job_card_extras_enabled')
      .eq('portal_account_id', resolved.accountId)
      .maybeSingle(),
  ])

  if (!card) return { ok: false, status: 404, error: 'Not found' }

  if (resolved.staffId) {
    const assigned = card.staff_id === resolved.staffId
      || (card.additional_staff_ids ?? []).includes(resolved.staffId)
    if (!assigned) return { ok: false, status: 404, error: 'Not found' }
  }

  return {
    ok: true,
    ctx: {
      accountId: resolved.accountId,
      staffId: resolved.staffId,
      staffName: resolved.staffName,
      card: card as ExtrasCard,
      settings: settings as JobCardExtrasSettings,
    },
  }
}

/** The kill switch defaults on — only an explicit false turns the step off. */
export function extrasEnabled(settings: { job_card_extras_enabled?: boolean | null } | null): boolean {
  return settings?.job_card_extras_enabled !== false
}

type ExtraRow = Omit<ElecJobCardExtra, 'quote'> & {
  quote?: Embedded<NonNullable<ElecJobCardExtra['quote']>>
}

/** Unwraps the embedded quote on each extra so callers get a plain object or null. */
export function normalizeExtras(rows: unknown): ElecJobCardExtra[] {
  return ((rows ?? []) as ExtraRow[]).map(r => ({ ...r, quote: one(r.quote) }))
}

/**
 * Turns an approved extra-work quote into the job card that work will be done
 * on. Called when the client approves — never before, so a quote they never
 * accept doesn't leave a phantom job card sitting in the office's list.
 *
 * Returns null for any quote that didn't come out of a job card, and for a
 * quote that already has one, so approving twice can't duplicate it.
 */
export async function createJobCardFromExtrasQuote(quoteId: string) {
  const { data: quote, error } = await supabaseAdmin
    .from('elec_quotes')
    .select('id, portal_account_id, project_name, project_address, client_id, staff_id, source_job_card_id')
    .eq('id', quoteId)
    .maybeSingle()
  // A missing source_job_card_id column (migration not run) lands here too.
  if (error || !quote?.source_job_card_id) return null

  const { data: existing } = await supabaseAdmin
    .from('elec_job_cards')
    .select('id')
    .eq('quote_id', quoteId)
    .limit(1)
    .maybeSingle()
  if (existing) return null

  const { data: items } = await supabaseAdmin
    .from('elec_quote_line_items')
    .select('description, unit, quoted_quantity')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true })

  const workDescription = (items ?? [])
    .map(i => `\u2022 ${i.description} \u2014 ${i.quoted_quantity} ${i.unit ?? 'nr'}`)
    .join('\n')

  const { count } = await supabaseAdmin
    .from('elec_job_cards')
    .select('id', { count: 'exact', head: true })
    .eq('portal_account_id', quote.portal_account_id)

  const { data: card } = await supabaseAdmin
    .from('elec_job_cards')
    .insert({
      portal_account_id: quote.portal_account_id,
      quote_id:          quote.id,
      client_id:         quote.client_id,
      staff_id:          quote.staff_id,
      job_number:        `JC-${String((count ?? 0) + 1).padStart(4, '0')}`,
      job_type:          'once_off',
      status:            'pending',
      title:             quote.project_name,
      location:          quote.project_address,
      work_description:  workDescription || null,
      created_by_name:   'Client approval',
    })
    .select('id, job_number')
    .single()

  return card ?? null
}
