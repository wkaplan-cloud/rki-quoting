import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { StaffManager } from './StaffManager'
import type { ElecStaff, ElecTimePunch } from '@/lib/elec-types'

export const metadata = { title: 'Staff — QuotingHub' }

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  const isTrialing = account?.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  if (!account || !(account.plan === 'quoting' && (account.subscription_status === 'active' || isTrialing))) {
    redirect('/supplier-portal/upgrade')
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: staff }, { data: punches }] = await Promise.all([
    supabaseAdmin
      .from('elec_staff')
      .select('*')
      .eq('portal_account_id', account.id)
      .order('created_at'),
    supabaseAdmin
      .from('elec_time_punches')
      .select('*, staff:elec_staff(id, name, color, role)')
      .eq('portal_account_id', account.id)
      .gte('punched_at', since)
      .order('punched_at', { ascending: false }),
  ])

  return (
    <StaffManager
      initialStaff={(staff ?? []) as ElecStaff[]}
      punches={(punches ?? []) as ElecTimePunch[]}
    />
  )
}
