export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PriceListsManager } from '@/app/(app)/price-lists/PriceListsManager'

export default async function PlatformPriceListsPage() {
  const { data: priceLists } = await supabaseAdmin
    .from('price_lists')
    .select('id, name, supplier_name, item_count, created_at, is_global')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Price Lists</h1>
        <p className="text-sm text-white/50 mt-0.5">Manage platform-wide price lists available to all studios</p>
      </div>
      <PriceListsManager priceLists={priceLists ?? []} canManage={true} basePath="/platform/price-lists" />
    </div>
  )
}
