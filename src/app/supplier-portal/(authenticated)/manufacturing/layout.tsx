import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePortalAccount } from '@/lib/portal-account'
import { isActivePlan, planRank } from '@/lib/plan-features'

export default async function ManufacturingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  const active = isActivePlan(account.plan, account.subscription_status, account.trial_ends_at)
  const isManufacturer = account.plan_category === 'manufacturer' || account.supplier_category === 'manufacturer'
  const hasQuoting = planRank(account.plan) >= 1 && active

  if (!isManufacturer) redirect('/supplier-portal/upgrade')
  if (!hasQuoting) {
    const trialWasStarted = !!account.trial_ends_at
    redirect(trialWasStarted ? '/supplier-portal/upgrade-manufacturer?trial=expired' : '/supplier-portal/upgrade-manufacturer')
  }

  return <>{children}</>
}
