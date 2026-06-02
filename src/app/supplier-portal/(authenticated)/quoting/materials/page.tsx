import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { MaterialsClient } from './MaterialsClient'
import type { ElecMaterialRequest } from '@/lib/elec-types'

export const metadata = { title: 'Materials — QuotingHub' }

export default async function MaterialsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  const isTrialing = account?.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  if (!account || !(account.plan === 'quoting' && (account.subscription_status === 'active' || isTrialing))) {
    redirect('/supplier-portal/upgrade')
  }

  const { data } = await supabaseAdmin
    .from('elec_material_requests')
    .select('*, job_card:elec_job_cards(id,job_number,title), quote:elec_quotes(id,quote_number,project_name), line_item:elec_quote_line_items(id,description)')
    .eq('portal_account_id', account.id)
    .order('created_at', { ascending: false })

  return (
    <MaterialsClient
      initialRequests={(data ?? []) as ElecMaterialRequest[]}
      companyName={account.company_name ?? account.email ?? ''}
    />
  )
}
