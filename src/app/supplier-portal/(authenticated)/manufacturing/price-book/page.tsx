export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolvePortalAccount } from '@/lib/portal-account'
import { MfgPriceBookClient } from './MfgPriceBookClient'
import type { MfgPriceBookItem } from '@/lib/mfg-types'

export default async function MfgPriceBookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  const { data: items } = await supabase
    .from('mfg_price_book_items')
    .select('*')
    .eq('portal_account_id', account.id)
    .is('archived_at', null)
    .order('item_type').order('category').order('name')

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#18181B' }}>Price Book</h1>
        <p className="text-sm mt-1" style={{ color: '#71717A' }}>Materials and hardware used in your quotes. Prices auto-fill in the cost builder.</p>
      </div>
      <MfgPriceBookClient initialItems={(items ?? []) as MfgPriceBookItem[]} />
    </div>
  )
}
