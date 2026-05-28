export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TeamClient } from './TeamClient'
import type { PortalOrgMember, ElecStaff, ElecTimePunch } from '@/lib/elec-types'

export const metadata = { title: 'Team — QuotingHub' }

export default async function TeamPage() {
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

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: members }, { data: staff }, { data: punches }] = await Promise.all([
    supabaseAdmin
      .from('portal_org_members')
      .select('*')
      .eq('portal_account_id', account.id)
      .order('invited_at', { ascending: false }),
    supabaseAdmin
      .from('elec_staff')
      .select('*')
      .eq('portal_account_id', account.id)
      .order('name'),
    supabaseAdmin
      .from('elec_time_punches')
      .select('*, staff:elec_staff(id, name, color, role)')
      .eq('portal_account_id', account.id)
      .gte('punched_at', since)
      .order('punched_at', { ascending: false }),
  ])

  return (
    <TeamClient
      orgMembers={(members ?? []) as PortalOrgMember[]}
      staff={(staff ?? []) as ElecStaff[]}
      punches={(punches ?? []) as ElecTimePunch[]}
    />
  )
}
