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
    .select('id, plan, subscription_status')
    .eq('auth_user_id', user.id)
    .single()

  if (!account || !(account.plan === 'quoting' && account.subscription_status === 'active')) {
    redirect('/supplier-portal/upgrade')
  }

  const { data: staff } = await supabaseAdmin
    .from('elec_staff')
    .select('*')
    .eq('portal_account_id', account.id)
    .order('created_at')

  return <StaffManager initialStaff={(staff ?? []) as ElecStaff[]} />
}
