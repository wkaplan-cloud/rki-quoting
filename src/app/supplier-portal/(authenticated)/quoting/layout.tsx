import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePortalAccount } from '@/lib/portal-account'
import { isActivePlan, planRank } from '@/lib/plan-features'

export default async function QuotingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(session.user.id)
  if (!account) redirect('/supplier-portal/not-a-supplier')

  const active = isActivePlan(account.plan, account.subscription_status, account.trial_ends_at)
  if (!(planRank(account.plan) >= 1 && active)) redirect('/supplier-portal/upgrade')

  return <>{children}</>
}
