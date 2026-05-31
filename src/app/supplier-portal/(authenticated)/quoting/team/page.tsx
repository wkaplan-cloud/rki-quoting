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

  // Owner check first; fall back to invited-admin membership
  let account = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email, plan, subscription_status, trial_ends_at')
    .eq('auth_user_id', user.id)
    .maybeSingle()
    .then(r => r.data)

  if (!account) {
    const { data: membership } = await supabaseAdmin
      .from('portal_org_members')
      .select('portal_account_id')
      .eq('auth_user_id', user.id)
      .not('accepted_at', 'is', null)
      .maybeSingle()
    if (membership) {
      account = await supabaseAdmin
        .from('supplier_portal_accounts')
        .select('id, email, plan, subscription_status, trial_ends_at')
        .eq('id', membership.portal_account_id)
        .maybeSingle()
        .then(r => r.data)
    }
  }

  const isTrialing = account?.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  if (!account || !(account.plan === 'quoting' && (account.subscription_status === 'active' || isTrialing))) {
    redirect('/supplier-portal/upgrade')
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch owner info to display in admin list (owner is not in portal_org_members)
  const { data: ownerAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('email, auth_user_id')
    .eq('id', account.id)
    .single()

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
      ownerEmail={ownerAccount?.email ?? account.email ?? ''}
    />
  )
}
