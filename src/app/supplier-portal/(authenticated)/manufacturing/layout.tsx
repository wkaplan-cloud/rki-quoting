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
  const hasQuoting = planRank(account.plan) >= 1 && active
  const isManufacturer = account.supplier_category === 'manufacturer'

  if (!hasQuoting || !isManufacturer) redirect('/supplier-portal/upgrade')

  return <>{children}</>
}
