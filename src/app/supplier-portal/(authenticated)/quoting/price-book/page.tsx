import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { isActivePlan, planRank } from '@/lib/plan-features'
import { PriceBookClient } from './PriceBookClient'
import type { ElecItemLibrary } from '@/lib/elec-types'

export default async function PriceBookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/not-a-supplier')

  // Business only
  if (planRank(account.plan) < 3 || !isActivePlan(account.plan, account.subscription_status, account.trial_ends_at)) {
    redirect('/supplier-portal/upgrade')
  }

  const { data: items } = await supabaseAdmin
    .from('elec_item_library')
    .select('*')
    .eq('portal_account_id', account.id)
    .order('category', { ascending: true, nullsFirst: false })
    .order('description', { ascending: true })

  return (
    <PriceBookClient
      portalAccountId={account.id}
      initialItems={(items ?? []) as ElecItemLibrary[]}
    />
  )
}
