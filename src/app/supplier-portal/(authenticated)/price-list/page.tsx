export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PriceListManager } from './PriceListManager'
import type { SupplierPriceListItem } from '@/lib/types'

export default async function PriceListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: portalAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!portalAccount) redirect('/supplier-portal/login')

  const { data: items } = await supabaseAdmin
    .from('supplier_price_list_items')
    .select('*')
    .eq('portal_account_id', portalAccount.id)
    .order('sort_order')
    .order('created_at')

  return <PriceListManager initialItems={(items ?? []) as SupplierPriceListItem[]} />
}
