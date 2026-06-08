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

  // Fetch all COCs with their linked quotes and job cards
  const { data: cocs } = await supabaseAdmin
    .from('elec_coc')
    .select('*, quote:elec_quotes(id, quote_number, project_name, project_address), job_card:elec_job_cards(id, job_number, title, location)')
    .eq('portal_account_id', account.id)
    .order('created_at', { ascending: false })

  return (
    <COCListClient
      initialCOCs={(cocs ?? []) as (ElecCOC & {
        quote: { id: string; quote_number: string; project_name: string; project_address: string | null } | null
        job_card: { id: string; job_number: string; title: string; location: string | null } | null
      })[]}
    />
  )
}
