import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePortalAccount } from '@/lib/portal-account'

export default async function QuotingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(session.user.id)
  if (!account) redirect('/supplier-portal/not-a-supplier')

  const isTrialing = account.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  const hasAccess = account.plan === 'quoting' && (account.subscription_status === 'active' || isTrialing)
  if (!hasAccess) redirect('/supplier-portal/upgrade')

  return <>{children}</>
}
