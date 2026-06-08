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

  // Two separate queries to avoid .or() + .in() Supabase reliability issues:
  // 1. COCs linked to any of this account's quotes (covers all pre-migration project COCs)
  // 2. COCs with portal_account_id set directly (new job-card COCs post-migration)
  const { data: accountQuotes } = await supabaseAdmin
    .from('elec_quotes')
    .select('id')
    .eq('portal_account_id', account.id)

  const quoteIds = (accountQuotes ?? []).map(q => q.id)

  const [{ data: projectCOCs }, { data: jobCardCOCs }] = await Promise.all([
    // All COCs linked to any project in this account
    quoteIds.length > 0
      ? supabaseAdmin
          .from('elec_coc')
          .select('*, quote:elec_quotes(id, quote_number, project_name, project_address), job_card:elec_job_cards(id, job_number, title, location)')
          .in('quote_id', quoteIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    // All COCs linked to job cards (quote_id is null, portal_account_id is set)
    supabaseAdmin
      .from('elec_coc')
      .select('*, quote:elec_quotes(id, quote_number, project_name, project_address), job_card:elec_job_cards(id, job_number, title, location)')
      .eq('portal_account_id', account.id)
      .is('quote_id', null)
      .order('created_at', { ascending: false }),
  ])

  // Merge, deduplicate by id
  const seen = new Set<string>()
  const cocs = [...(projectCOCs ?? []), ...(jobCardCOCs ?? [])].filter(c => {
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
