import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { StaffManager } from './StaffManager'
import type { ElecStaff } from '@/lib/elec-types'

export const metadata = { title: 'Team — QuotingHub' }

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, plan, subscription_status, trial_ends_at')
    .eq('auth_user_id', user.id)
    .single()

  const isTrialing = account?.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  if (!account || !(account.plan === 'quoting' && (account.subscription_status === 'active' || isTrialing))) {
    redirect('/supplier-portal/upgrade')
  }

  const { data: staff } = await supabaseAdmin
    .from('elec_staff')
    .select('*')
    .eq('portal_account_id', account.id)
    .order('created_at')

  return <StaffManager initialStaff={(staff ?? []) as ElecStaff[]} />
}
