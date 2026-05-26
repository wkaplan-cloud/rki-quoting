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
    .select('id, plan, subscription_status')
    .eq('auth_user_id', session.user.id)
    .maybeSingle()

  if (!account) redirect('/supplier-portal/not-a-supplier')

  if (account.plan !== 'quoting' || account.subscription_status !== 'active') {
    redirect('/supplier-portal/upgrade')
  }

  return <>{children}</>
}
