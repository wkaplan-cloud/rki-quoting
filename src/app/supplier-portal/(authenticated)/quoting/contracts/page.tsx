import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { isActivePlan, planRank } from '@/lib/plan-features'
import { getTradeType } from '@/lib/trade-type'
import { ContractsClient } from './ContractsClient'

export const metadata = { title: 'Contracts — QuotingHub' }

export default async function ContractsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/not-a-supplier')
  if (planRank(account.plan) < 2 || !isActivePlan(account.plan, account.subscription_status, account.trial_ends_at)) {
    redirect('/supplier-portal/upgrade')
  }
  if (await getTradeType(account.id) !== 'installer') redirect('/supplier-portal/quoting')

  const [{ data: clients }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('elec_clients').select('id, client_name, email').eq('portal_account_id', account.id).order('client_name'),
    supabaseAdmin.from('elec_settings').select('sage_company_id').eq('portal_account_id', account.id).maybeSingle(),
  ])

  return (
    <ContractsClient
      clients={(clients ?? []) as { id: string; client_name: string; email: string | null }[]}
      sageConnected={!!settings?.sage_company_id}
    />
  )
}
