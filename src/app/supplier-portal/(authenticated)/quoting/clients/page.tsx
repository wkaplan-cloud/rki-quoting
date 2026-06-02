export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { isActivePlan, planRank } from '@/lib/plan-features'
import { redirect } from 'next/navigation'
import { ClientsClient } from './ClientsClient'
import type { ElecClient } from '@/lib/elec-types'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/not-a-supplier')

  // Professional+ only
  if (planRank(account.plan) < 2 || !isActivePlan(account.plan, account.subscription_status, account.trial_ends_at)) {
    redirect('/supplier-portal/upgrade')
  }

  const { data: clients } = await supabaseAdmin
    .from('elec_clients')
    .select('*')
    .eq('portal_account_id', account.id)
    .order('client_name')

  return <ClientsClient portalAccountId={account.id} initialClients={(clients ?? []) as ElecClient[]} />

}
