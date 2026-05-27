import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function QuotingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // getSession reads from cookie — no network round-trip; parent layout already did getUser()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, plan, subscription_status, trial_ends_at')
    .eq('auth_user_id', session.user.id)
    .maybeSingle()

  if (!account) redirect('/supplier-portal/not-a-supplier')

  const isTrialing = account.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  const hasAccess = account.plan === 'quoting' && (account.subscription_status === 'active' || isTrialing)
  if (!hasAccess) redirect('/supplier-portal/upgrade')

  return <>{children}</>
}
