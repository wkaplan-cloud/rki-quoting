import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePortalAccount } from '@/lib/portal-account'
import { isActivePlan, planRank } from '@/lib/plan-features'
import { getTradeType } from '@/lib/trade-type'
import { listKits } from '@/lib/kits'
import { KitsClient } from './KitsClient'

export const metadata = { title: 'Kits — QuotingHub' }

export default async function KitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/not-a-supplier')

  // Business tier, installer trades only
  if (planRank(account.plan) < 3 || !isActivePlan(account.plan, account.subscription_status, account.trial_ends_at)) {
    redirect('/supplier-portal/upgrade')
  }
  if (await getTradeType(account.id) !== 'installer') redirect('/supplier-portal/quoting')

  const kits = await listKits(account.id)
  return <KitsClient portalAccountId={account.id} initialKits={kits} />
}
