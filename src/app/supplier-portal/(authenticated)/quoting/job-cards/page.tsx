export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { JobCardsClient } from './JobCardsClient'
import type { ElecJobCard, ElecStaff, ElecClient } from '@/lib/elec-types'

export const metadata = { title: 'Job Cards — QuotingHub' }

export default async function JobCardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  let accountId: string | null = null

  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id, plan, subscription_status, trial_ends_at')
    .eq('auth_user_id', user.id).maybeSingle()

  if (own) {
    const isTrialing = own.subscription_status === 'trialing' && own.trial_ends_at != null && new Date(own.trial_ends_at) > new Date()
    if (!(own.plan === 'quoting' && (own.subscription_status === 'active' || isTrialing))) redirect('/supplier-portal/upgrade')
    accountId = own.id
  } else {
    const { data: mem } = await supabaseAdmin
      .from('portal_org_members').select('portal_account_id')
      .eq('auth_user_id', user.id).not('accepted_at', 'is', null).maybeSingle()
    if (mem) accountId = mem.portal_account_id
    else redirect('/supplier-portal/not-a-supplier')
  }

  const [{ data: jobCards }, { data: staff }, { data: clients }] = await Promise.all([
    supabaseAdmin
      .from('elec_job_cards')
      .select(`*, staff:elec_staff(id,name,color,role), client:elec_clients(id,client_name,email)`)
      .eq('portal_account_id', accountId!)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('elec_staff')
      .select('id, name, color, role, is_active')
      .eq('portal_account_id', accountId!)
      .eq('is_active', true)
      .order('name'),
    supabaseAdmin
      .from('elec_clients')
      .select('id, client_name, email')
      .eq('portal_account_id', accountId!)
      .order('client_name'),
  ])

  return (
    <JobCardsClient
      initialJobCards={(jobCards ?? []) as ElecJobCard[]}
      staff={(staff ?? []) as ElecStaff[]}
      clients={(clients ?? []) as ElecClient[]}
    />
  )
}
