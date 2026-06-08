import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { COCListClient } from './COCListClient'
import type { ElecCOC } from '@/lib/elec-types'

export const metadata = { title: 'COC — QuotingHub' }

export default async function COCPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  const isTrialing = account?.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  if (!account || !(['quoting', 'starter', 'professional', 'business'].includes(account.plan ?? '') && (account.subscription_status === 'active' || isTrialing))) {
    redirect('/supplier-portal/upgrade')
  }

  const SEL = '*, quote:elec_quotes(id, quote_number, project_name, project_address), job_card:elec_job_cards(id, job_number, title, location)'

  // Fetch all quote IDs for this account (paginated to handle > 1000 quotes)
  const quoteIds: string[] = []
  let from = 0
  while (true) {
    const { data: batch } = await supabaseAdmin
      .from('elec_quotes')
      .select('id')
      .eq('portal_account_id', account.id)
      .range(from, from + 999)
    if (!batch?.length) break
    for (const q of batch) quoteIds.push(q.id)
    if (batch.length < 1000) break
    from += 1000
  }

  // Three queries to catch everything regardless of migration state:
  // 1. By portal_account_id (catches backfilled project COCs + new job card COCs)
  // 2. By quote_id IN (catches project COCs where backfill may have missed)
  // 3. Merge & deduplicate
  const [{ data: byAccountId }, { data: byQuoteId }] = await Promise.all([
    supabaseAdmin
      .from('elec_coc')
      .select(SEL)
      .eq('portal_account_id', account.id)
      .order('created_at', { ascending: false })
      .limit(2000),
    quoteIds.length > 0
      ? supabaseAdmin
          .from('elec_coc')
          .select(SEL)
          .in('quote_id', quoteIds)
          .order('created_at', { ascending: false })
          .limit(2000)
      : Promise.resolve({ data: [] }),
  ])

  // Merge, deduplicate by id
  const seen = new Set<string>()
  const cocs = [...(byAccountId ?? []), ...(byQuoteId ?? [])].filter(c => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  }).sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <COCListClient
      initialCOCs={(cocs ?? []) as (ElecCOC & {
        quote: { id: string; quote_number: string; project_name: string; project_address: string | null } | null
        job_card: { id: string; job_number: string; title: string; location: string | null } | null
      })[]}
    />
  )
}
