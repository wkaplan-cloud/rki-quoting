import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function QuotingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, plan, subscription_status')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!account) redirect('/supplier-portal/not-a-supplier')

  if (account.plan !== 'quoting' || account.subscription_status !== 'active') {
    redirect('/supplier-portal/upgrade')
  }

  return <>{children}</>
}
